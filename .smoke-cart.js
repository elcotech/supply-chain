/* Scratch check: does a second product from the SAME supplier land in the cart?
   D1  "Add to cart & review instead" with a same-supplier line already in the cart
   D2  "Place Order" with a same-supplier line already in the cart
   Cards are opened by product NAME: the grid re-sorts itself once geocoding
   lands, so index-based navigation clicks the wrong card.                     */
const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');

const click = (cdp, expr) => evaluate(cdp, `(() => { const el = ${expr}; if (!el) return 'MISSING'; el.click(); return 'clicked'; })()`);
const text = (cdp, expr) => evaluate(cdp, `(() => { const el = ${expr}; return el ? String(el.innerText).split(String.fromCharCode(10)).filter(Boolean).join(' | ').slice(0, 300) : null; })()`);

async function waitUntil(cdp, expr, label, timeout = 20000) {
  const t0 = Date.now();
  for (;;) {
    if (await evaluate(cdp, expr)) return true;
    if (Date.now() - t0 > timeout) { console.log(`  ! timeout waiting for ${label}`); return false; }
    await sleep(400);
  }
}

const cartLines = cdp => evaluate(cdp, `(() => {
  const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!u) return 'NO USER';
  return JSON.parse(localStorage.getItem('cart_' + u.id) || '[]')
    .map(l => l.materialName + ' x' + l.quantity + ' [' + (l.supplierName || '?') + ']');
})()`);

const domLines = cdp => evaluate(cdp, `(() => {
  const m = document.querySelector('.cart-modal');
  if (!m) return 'NO CART MODAL';
  const names = Array.from(m.querySelectorAll('h4')).map(h => h.innerText.trim().slice(0, 60));
  return names.length ? names : ['(no lines rendered)'];
})()`);

const readCards = cdp => evaluate(cdp, `(() => Array.from(document.querySelectorAll('.m-search-item')).map(c => {
  const t = c.querySelector('.m-pc-name');
  const s = c.querySelector('.m-pc-supplier');
  return { title: t ? t.innerText.trim() : null, supplier: s ? s.innerText.trim() : null };
}).filter(c => c.title))()`);

(async () => {
  const server = await serve();
  let chrome;
  try {
    chrome = await launchChrome();
    const list = await targets();
    const page = list.find(t => t.type === 'page');
    const cdp = await connect(page.webSocketDebuggerUrl);
    const errors = [];
    cdp.on(msg => {
      if (msg.method === 'Runtime.exceptionThrown') errors.push('EXC ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('CON ' + msg.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 250));
    });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 414, height: 900, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setGeolocationOverride', { latitude: 9.015, longitude: 38.755, accuracy: 10 });
    await cdp.send('Network.enable');
    // Seed from Supabase on first load, then cut the connection so nothing this
    // test does can be written back to the real database.
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2500);
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      if (!(await evaluate(cdp, '!!document.querySelector(".splash-screen")'))) break;
      await sleep(400);
    }
    const tSeed = Date.now();
    for (;;) {
      const n = await evaluate(cdp, '(JSON.parse(localStorage.getItem("users") || "[]")).length');
      if (n > 0) break;
      if (Date.now() - tSeed > 60000) { console.log('seeded accounts never arrived'); break; }
      await sleep(500);
    }
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
    console.log('cloud cut after pull; seeded users:', await evaluate(cdp, '(JSON.parse(localStorage.getItem("users") || "[]")).length'));

    // ---- login -----------------------------------------------------------
    const targetEmail = await evaluate(cdp, `(() => {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const c = users.find(u => u.userType === 'customer');
      return c ? c.email : 'NO CUSTOMER';
    })()`);
    await click(cdp, `Array.from(document.querySelectorAll('button')).find(x => /^\s*login\s*$/i.test(x.textContent.trim()))`);
    await waitUntil(cdp, 'document.querySelectorAll("#userList option").length > 0', 'accounts');
    await evaluate(cdp, `(() => {
      const input = document.querySelector('input[name="selectedUser"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(targetEmail)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(400);
    await evaluate(cdp, `(() => {
      const pw = document.querySelector('input[type="password"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(pw, '0909');
      pw.dispatchEvent(new Event('input', { bubbles: true }));
      const form = pw.closest('form');
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()`);
    await waitUntil(cdp, '!!(JSON.parse(localStorage.getItem("currentUser") || "null"))', 'login');
    console.log('logged in as', targetEmail);

    // ---- start from an empty cart (through the real Clear Cart button) ----
    await click(cdp, 'document.querySelector(".m-fab-cart")');
    await sleep(1500);
    if (await evaluate(cdp, '!!document.querySelector(".cart-modal")')) {
      await click(cdp, `Array.from(document.querySelectorAll('.cart-modal button')).find(b => /Clear Cart/i.test(b.innerText))`);
      await sleep(800);
      await click(cdp, 'document.querySelector(".cart-modal .modal-close")');
      await sleep(400);
    }
    console.log('cart at start:', JSON.stringify(await cartLines(cdp)));

    await click(cdp, `Array.from(document.querySelectorAll('.mobile-tabbar .m-tab')).find(b => /Search/.test(b.innerText))`);
    await waitUntil(cdp, 'document.querySelectorAll(".m-search-item").length > 0', 'search grid');

    // Two cards that genuinely share a supplier.
    const cards = await readCards(cdp);
    let titleA = null, titleB = null, supplierA = null;
    for (const c of cards) {
      if (!supplierA) { supplierA = c.supplier; titleA = c.title; continue; }
      if (c.supplier === supplierA && c.title !== titleA) { titleB = c.title; break; }
    }
    console.log('supplier A:', supplierA, '| product 1:', titleA, '| product 2:', titleB);
    if (!titleB) { console.log('RESULT: no second product from the same supplier'); cdp.close(); return; }

    const openByName = async name => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await evaluate(cdp, `(() => {
          const cards = Array.from(document.querySelectorAll('.m-search-item'));
          const c = cards.find(x => { const t = x.querySelector('.m-pc-name'); return t && t.innerText.trim() === ${JSON.stringify(name)}; });
          if (!c) return 'CARD NOT FOUND';
          c.querySelector('.m-pc-name').click();
          return 'clicked';
        })()`);
        if (r !== 'clicked') { await sleep(600); continue; }
        const ok = await waitUntil(cdp, `(() => {
          const t = document.querySelector('.pd-title');
          return !!t && t.innerText.trim() === ${JSON.stringify(name)} && !!document.querySelector('.pd-summary');
        })()`, 'details for ' + name, 8000);
        if (ok) {
          await waitUntil(cdp, `(() => {
            if (document.querySelector('.pd-summary-block')) return true;
            const b = document.querySelector('.pd-place-order');
            return !!b && !b.disabled;
          })()`, 'settled summary', 20000);
          return true;
        }
      }
      return false;
    };
    const supplierOf = () => evaluate(cdp, '(() => { const el = document.querySelector(".pd-supplier-name"); return el ? el.innerText.trim().split("\\n")[0] : null; })()');
    const buttonState = sel => evaluate(cdp, `(() => { const b = document.querySelector('${sel}'); return b ? (b.disabled ? 'DISABLED' : 'ENABLED') : 'MISSING'; })()`);
    const closeCart = async () => { await click(cdp, 'document.querySelector(".cart-modal .modal-close")'); await sleep(400); };

    // ---- D1: Add to cart & review — same supplier ------------------------
    console.log('\n[D1] Add to cart & review — same supplier');
    if (!(await openByName(titleA))) { console.log('  !! could not open product 1'); cdp.close(); return; }
    console.log('  product 1:', await text(cdp, 'document.querySelector(".pd-title")'), '| supplier:', await supplierOf());
    await click(cdp, 'document.querySelector(".pd-add-to-cart")');
    await waitUntil(cdp, '!!document.querySelector(".cart-modal")', 'cart modal', 10000);
    await sleep(1500);
    console.log('  cart after 1st add — state:', JSON.stringify(await cartLines(cdp)));
    console.log('  cart after 1st add — DOM  :', JSON.stringify(await domLines(cdp)));
    await closeCart();

    if (!(await openByName(titleB))) { console.log('  !! could not open product 2'); cdp.close(); return; }
    console.log('  product 2:', await text(cdp, 'document.querySelector(".pd-title")'), '| supplier:', await supplierOf());
    console.log('  summary block:', await text(cdp, 'document.querySelector(".pd-summary-block")') || '(none)');
    console.log('  buttons — place:', await buttonState('.pd-place-order'), '| add:', await buttonState('.pd-add-to-cart'));
    console.log('  click add ->', await click(cdp, 'document.querySelector(".pd-add-to-cart")'));
    await sleep(900);
    console.log('  alert right after click:', await text(cdp, 'document.querySelector(".alert")'));
    await waitUntil(cdp, '!!document.querySelector(".cart-modal")', 'cart modal 2', 6000);
    await sleep(1500);
    console.log('  cart after 2nd add — state:', JSON.stringify(await cartLines(cdp)));
    console.log('  cart after 2nd add — DOM  :', JSON.stringify(await domLines(cdp)));
    await closeCart();

    // ---- D2: Place Order — same supplier line already in the cart --------
    console.log('\n[D2] Place Order — same supplier line already in the cart');
    if (!(await openByName(titleB))) { console.log('  !! could not reopen product 2'); cdp.close(); return; }
    console.log('  product:', await text(cdp, 'document.querySelector(".pd-title")'));
    console.log('  cart before Place Order:', JSON.stringify(await cartLines(cdp)));
    console.log('  summary block:', await text(cdp, 'document.querySelector(".pd-summary-block")') || '(none)');
    console.log('  buttons — place:', await buttonState('.pd-place-order'), '| add:', await buttonState('.pd-add-to-cart'));
    const ordersBefore = await evaluate(cdp, '(JSON.parse(localStorage.getItem("orders") || "[]")).length');
    console.log('  click place ->', await click(cdp, 'document.querySelector(".pd-place-order")'));
    await sleep(900);
    console.log('  alert right after click:', await text(cdp, 'document.querySelector(".alert")'));
    let placed = false;
    const tb = Date.now();
    while (Date.now() - tb < 40000) {
      await sleep(1000);
      const o = await evaluate(cdp, '(JSON.parse(localStorage.getItem("orders") || "[]")).length');
      if (o > ordersBefore) { placed = true; break; }
    }
    await sleep(1500);
    console.log('  order created:', placed);
    console.log('  cart after Place Order — state:', JSON.stringify(await cartLines(cdp)));
    console.log('  cart modal open:', await evaluate(cdp, '!!document.querySelector(".cart-modal")'));
    console.log('  alert:', await text(cdp, 'document.querySelector(".alert")'));
    console.log('  page heading:', await text(cdp, 'document.querySelector("h1, .dashboard-title")'));

    console.log('\n--- ERRORS ---');
    console.log(errors.length ? errors.join('\n') : '(none)');
    cdp.close();
  } catch (e) {
    console.error('CART RUN FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    if (chrome) { try { chrome.kill(); } catch (_) {} }
    try { server.close(); } catch (_) {}
  }
})();
