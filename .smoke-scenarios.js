/* Scratch scenario checks for the order flow. Not part of the app.
   Verifies the states a real buyer hits: a cart that already holds another
   supplier's line, ordering from the product page, and ordering from the cart. */
const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');

const results = [];
const report = (name, value) => { results.push([name, value]); console.log(`  • ${name}: ${value}`); };

const click = (cdp, expr) => evaluate(cdp, `(() => { const el = ${expr}; if (!el) return 'MISSING'; el.click(); return 'clicked'; })()`);
const text = (cdp, expr) => evaluate(cdp, `(() => { const el = ${expr}; return el ? el.innerText.replace(/\\n+/g, ' | ').slice(0, 260) : null; })()`);

async function waitUntil(cdp, expr, label, timeout = 20000) {
  const t0 = Date.now();
  for (;;) {
    const ok = await evaluate(cdp, expr);
    if (ok) return true;
    if (Date.now() - t0 > timeout) { console.log(`  ! timeout waiting for ${label}`); return false; }
    await sleep(400);
  }
}

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
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2500);
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      if (!(await evaluate(cdp, '!!document.querySelector(".splash-screen")'))) break;
      await sleep(400);
    }

    // ---- login -------------------------------------------------------------
    const targetEmail = await evaluate(cdp, `(() => {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const c = users.find(u => u.userType === 'customer');
      return c ? c.email : 'NO CUSTOMER';
    })()`);
    await click(cdp, `Array.from(document.querySelectorAll('button')).find(x => /^\\s*login\\s*$/i.test(x.textContent.trim()))`);
    const tAccounts = Date.now();
    await waitUntil(cdp, 'document.querySelectorAll("#userList option").length > 0', 'accounts');
    console.log(`accounts available after ${((Date.now() - tAccounts) / 1000).toFixed(1)}s on the login form (page age ${Math.round(await evaluate(cdp, 'performance.now()') / 1000)}s)`);
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

    // ---- go to search ------------------------------------------------------
    await click(cdp, `Array.from(document.querySelectorAll('.mobile-tabbar .m-tab')).find(b => /Search/.test(b.innerText))`);
    await waitUntil(cdp, 'document.querySelectorAll(".m-search-item").length > 0', 'search grid');
    const cardCount = await evaluate(cdp, 'document.querySelectorAll(".m-search-item").length');
    console.log('product cards:', cardCount);

    const openCard = async i => {
      await evaluate(cdp, `(() => {
        const card = document.querySelectorAll('.m-search-item')[${i}];
        if (!card) return 'NO CARD ' + ${i};
        const btn = card.querySelector('.m-pc-name');
        if (!btn) return 'NO BUTTON';
        btn.click();
        return 'clicked';
      })()`);
      await waitUntil(cdp, '!!document.querySelector(".pd-summary")', 'details summary', 8000);
      // The summary settles 250 ms after the product opens: either it quotes, or
      // it explains why it cannot. Sample only once one of those is on screen.
      await waitUntil(cdp, `(() => {
        if (document.querySelector('.pd-summary-block')) return true;
        const b = document.querySelector('.pd-place-order');
        return !!b && !b.disabled;
      })()`, 'settled summary', 20000);
    };
    const supplierOf = () => evaluate(cdp, '(() => { const el = document.querySelector(".pd-supplier-name"); return el ? el.innerText.trim().split("\\n")[0] : null; })()');
    const closeDetails = async () => { await click(cdp, 'document.querySelector(".modal-close")'); await sleep(300); };
    const placeState = async () => evaluate(cdp, `(() => {
      const b = document.querySelector('.pd-place-order');
      if (!b) return 'NO BUTTON';
      return (b.disabled ? 'DISABLED' : 'ENABLED') + ' :: ' + b.innerText.trim();
    })()`);

    // ---- scenario A: cart already holds a different supplier ---------------
    console.log('\n[scenario A] cart holds supplier #1, product from supplier #2');
    await openCard(0);
    const supplierA = await supplierOf();
    console.log('  supplier A:', supplierA);
    await click(cdp, 'document.querySelector(".pd-add-to-cart")');
    await waitUntil(cdp, '!!document.querySelector(".cart-modal")', 'cart modal', 10000);
    await sleep(1200);
    await click(cdp, 'document.querySelector(".cart-modal .modal-close")');
    await sleep(400);

    let idx = -1;
    for (let i = 1; i < Math.min(cardCount, 25); i++) {
      await openCard(i);
      const s = await supplierOf();
      if (s && s !== supplierA) { idx = i; console.log('  supplier B:', s, `(card ${i})`); break; }
      await closeDetails();
    }
    if (idx < 0) {
      report('A: second supplier product', 'NOT FOUND (all cards share one supplier)');
    } else {
      report('A: Place Order with foreign cart line', await placeState(cdp));
      report('A: visible summary / warning', (await text(cdp, 'document.querySelector(".pd-summary")')) || 'none');
    }

    // ---- clear the cart, then order from the product page ------------------
    console.log('\n[scenario B] clear the cart, then Place Order from the product page');
    await closeDetails();
    await click(cdp, 'document.querySelector(".m-fab-cart")');
    await sleep(1500);
    await click(cdp, `Array.from(document.querySelectorAll('.cart-modal button')).find(b => /Clear Cart/i.test(b.innerText))`);
    await sleep(600);
    const cartLines = await evaluate(cdp, `(() => {
      const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (!u) return -1;
      return (JSON.parse(localStorage.getItem('cart_' + u.id) || '[]')).length;
    })()`);
    report('B: cart lines after Clear Cart', cartLines);
    await click(cdp, 'document.querySelector(".cart-modal .modal-close")');
    await sleep(400);

    await openCard(idx >= 0 ? idx : 0);
    // The summary prices 250 ms after the product opens, so wait for the button
    // to become pressable rather than sampling it mid-calculation.
    await waitUntil(cdp, `(() => { const b = document.querySelector('.pd-place-order'); return !!b && !b.disabled; })()`, 'enabled Place Order', 20000);
    report('B: Place Order after clearing cart', await placeState(cdp));
    const ordersBefore = await evaluate(cdp, '(JSON.parse(localStorage.getItem("orders") || "[]")).length');
    await click(cdp, 'document.querySelector(".pd-place-order")');
    let placed = false;
    const tb = Date.now();
    while (Date.now() - tb < 40000) {
      await sleep(1000);
      const n = await evaluate(cdp, '(JSON.parse(localStorage.getItem("orders") || "[]")).length');
      if (n > ordersBefore) { placed = true; break; }
    }
    report('B: order created from product page', placed ? 'YES' : 'NO — ' + ((await text(cdp, 'document.querySelector(".alert")')) || 'no alert'));

    // ---- scenario C: order from the cart -----------------------------------
    console.log('\n[scenario C] add to cart, then press 1 To Purchase');
    // A placed order navigates to the Orders tab, so go back to the catalogue.
    await click(cdp, 'Array.from(document.querySelectorAll(".mobile-tabbar .m-tab")).find(b => /Search/.test(b.innerText))');
    await waitUntil(cdp, 'document.querySelectorAll(".m-search-item").length > 0', 'search grid', 10000);
    await openCard(idx >= 0 ? idx : 0);
    await click(cdp, 'document.querySelector(".pd-add-to-cart")');
    await waitUntil(cdp, '!!document.querySelector(".cart-modal")', 'cart modal', 10000);
    await sleep(2500);
    await waitUntil(cdp, `(() => {
      const b = Array.from(document.querySelectorAll('.cart-order-step')).find(x => /To Purchase/.test(x.innerText));
      return !!b && !b.disabled;
    })()`, 'enabled To Purchase', 25000);
    const cartReady = await text(cdp, 'document.querySelector(".cart-order-steps")');
    report('C: cart order steps', cartReady || 'NO STEPS VISIBLE');
    const before2 = await evaluate(cdp, '(JSON.parse(localStorage.getItem("orders") || "[]")).length');
    await click(cdp, `Array.from(document.querySelectorAll('.cart-order-step')).find(b => /To Purchase/.test(b.innerText))`);
    let placed2 = false;
    const tc = Date.now();
    while (Date.now() - tc < 40000) {
      await sleep(1000);
      const n = await evaluate(cdp, '(JSON.parse(localStorage.getItem("orders") || "[]")).length');
      if (n > before2) { placed2 = true; break; }
    }
    report('C: order created from cart', placed2 ? 'YES' : 'NO — ' + ((await text(cdp, 'document.querySelector(".alert")')) || 'no alert'));

    console.log('\n--- ERRORS ---');
    console.log(errors.length ? errors.join('\n') : '(none)');
    cdp.close();
  } catch (e) {
    console.error('SCENARIO RUN FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    if (chrome) { try { chrome.kill(); } catch (_) {} }
    server.close();
  }
})();
