/* Scratch smoke test: ordering a second product from the supplier already in
 * the cart must never do nothing — the goods have to show up in the cart (or
 * the order must land). Two phases: with location available, and without.
 * Not part of the app. */
const fs = require('fs');
const path = require('path');
const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');

const SHOT = name => path.join(__dirname, `.smoke-${name}.png`);

async function shot(cdp, name) {
  const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SHOT(name), Buffer.from(s.data, 'base64'));
}

async function pageState(cdp) {
  return JSON.parse(await evaluate(cdp, `(() => {
    const cartKeys = Object.keys(localStorage).filter(k => k.startsWith('cart_'));
    const items = cartKeys.flatMap(k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } });
    const modal = document.querySelector('.cart-modal');
    return JSON.stringify({
      cart: items.map(i => ({ name: i.materialName, qty: i.quantity, sup: i.supplierName })),
      badge: (document.querySelector('.cart-badge') || {}).textContent || '',
      cartOpen: !!modal,
      cartText: modal ? modal.innerText.replace(/\\n+/g, ' | ').slice(0, 500) : null,
      orders: (JSON.parse(localStorage.getItem('orders') || '[]')).length,
      alert: (document.querySelector('.alert') || {}).innerText || null,
      pdTitle: (document.querySelector('.pd-title') || {}).textContent || null,
      placeOrder: (() => { const b = document.querySelector('.pd-place-order'); return b ? b.textContent.trim() + (b.disabled ? ' [DISABLED]' : '') : null; })(),
      summaryBlock: (document.querySelector('.pd-summary-block') || { innerText: '' }).innerText.replace(/\\n+/g, ' | ').slice(0, 300) || null,
      addToCartBtn: !!document.querySelector('.pd-add-to-cart'),
    });
  })()`));
}

async function cards(cdp) {
  return JSON.parse(await evaluate(cdp, `JSON.stringify(
    Array.from(document.querySelectorAll('.m-product-card, .product-card')).map(c => ({
      name: ((c.querySelector('.m-pc-name') || c.querySelector('h3') || c.querySelector('h4') || {}).textContent || c.innerText.split('\\n')[0] || '').trim().slice(0, 60),
      supplier: ((c.querySelector('.m-pc-supplier') || {}).textContent || '').trim().slice(0, 60),
    })).filter(c => c.name)
  )`));
}

// Open a product page by name and wait for the details modal.
async function openDetails(cdp, name) {
  const res = await evaluate(cdp, `(() => {
    const target = ${JSON.stringify(name)};
    const card = Array.from(document.querySelectorAll('.m-product-card, .product-card'))
      .find(c => c.innerText.includes(target));
    if (!card) return 'NO CARD';
    const btn = card.querySelector('[aria-label^="View details"]') || card.querySelector('.m-pc-name') || card.querySelector('button');
    if (!btn) return 'NO BUTTON';
    btn.click();
    return 'clicked';
  })()`);
  await sleep(1800);
  const st = await pageState(cdp);
  return { clicked: res, title: st.pdTitle };
}

async function closeCart(cdp) {
  await evaluate(cdp, `(() => { const c = document.querySelector('.cart-modal .modal-close'); if (c) c.click(); return !!c; })()`);
  await sleep(600);
}

async function login(cdp) {
  // The test profile persists a session between runs: reuse it when it is
  // already a customer, and sign out first when it is not.
  const existing = JSON.parse(await evaluate(cdp, `JSON.stringify(
    (JSON.parse(localStorage.getItem('currentUser') || 'null') || { email: null, userType: null })
  )`));
  if (existing.email && existing.userType === 'customer') {
    console.log('already signed in:', existing.email);
    return existing.email;
  }
  if (existing.email) {
    await evaluate(cdp, `(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /log\s*out|sign\s*out/i.test(x.textContent));
      if (b) b.click();
      return !!b;
    })()`);
    await sleep(1500);
  }
  const email = await evaluate(cdp, `(() => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const c = users.find(u => u.userType === 'customer');
    return c ? c.email : 'NO CUSTOMER';
  })()`);
  await sleep(400);
  await evaluate(cdp, `(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /^\\s*login\\s*$/i.test(x.textContent.trim()));
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(900);
  const t = Date.now();
  for (;;) {
    const n = await evaluate(cdp, 'document.querySelectorAll("#userList option").length');
    const hasField = await evaluate(cdp, '!!document.querySelector(\'input[name="selectedUser"]\')');
    if (hasField && n > 0) break;
    if (Date.now() - t > 45000) break;
    await sleep(500);
  }
  console.log('accounts in datalist:', await evaluate(cdp, 'document.querySelectorAll("#userList option").length'));
  const typed = await evaluate(cdp, `(() => {
    const input = document.querySelector('input[name="selectedUser"]');
    if (!input) return 'NO EMAIL FIELD';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(email)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  console.log('email field:', typed);
  if (typed === 'NO EMAIL FIELD') {
    const dbg = await evaluate(cdp, `JSON.stringify({
      splash: !!document.querySelector('.splash-screen'),
      buttons: Array.from(document.querySelectorAll('button')).slice(0, 25).map(b => b.textContent.trim().slice(0, 30)),
      body: document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 400),
    })`);
    console.log('LOGIN DEBUG:', dbg);
  }
  await sleep(700);
  const pw = await evaluate(cdp, `(() => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const c = users.find(u => u.userType === 'customer');
    return (c && (c.password || c.pass || c.pin)) || '0909';
  })()`);
  const pwRes = await evaluate(cdp, `(() => {
    const field = document.querySelector('input[type="password"]');
    if (!field) return 'NO PASSWORD FIELD';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(field, ${JSON.stringify(pw)});
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const form = field.closest('form');
    if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return 'submitted';
  })()`);
  console.log('password:', pwRes);
  const t2 = Date.now();
  for (;;) {
    const who = await evaluate(cdp, `(JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).email || null`);
    if (who) return who;
    if (Date.now() - t2 > 8000) {
      console.log('login alert:', await evaluate(cdp, '(document.querySelector(".alert") || {}).innerText || null'));
      return null;
    }
    await sleep(500);
  }
}

async function findPair(cdp) {
  let list = await cards(cdp);
  if (list.length < 2) {
    await evaluate(cdp, `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /^\\s*search\\s*$/i.test(x.textContent.trim())); if (b) b.click(); return !!b; })()`);
    await sleep(2000);
    list = await cards(cdp);
  }
  const bySup = {};
  list.forEach(c => { if (c.supplier) (bySup[c.supplier] = bySup[c.supplier] || []).push(c.name); });
  const entry = Object.entries(bySup).find(([, names]) => names.length >= 2);
  if (!entry) return null;
  return { supplier: entry[0], first: entry[1][0], second: entry[1][1], totalCards: list.length };
}

// The reported bug: with supplier X's product already in the cart, ordering a
// second product from X must show it in the cart (or place the order).
async function runScenario(cdp, label, withLocation, errors) {
  console.log(`\n=== ${label} ===`);
  if (withLocation) {
    await cdp.send('Emulation.clearGeolocationOverride').catch(() => {});
    await cdp.send('Emulation.setGeolocationOverride', { latitude: 9.015, longitude: 38.755, accuracy: 10 }).catch(() => {});
    await cdp.send('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'granted', origin: `http://localhost:${PORT}` }).catch(() => {});
  } else {
    await cdp.send('Emulation.clearGeolocationOverride').catch(() => {});
    await cdp.send('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'denied', origin: `http://localhost:${PORT}` }).catch(() => {});
    // No saved pin either: the buyer's profile has no coordinates at all.
    await evaluate(cdp, `(() => {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      users.forEach(u => { delete u.lat; delete u.lng; });
      localStorage.setItem('users', JSON.stringify(users));
      const cur = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (cur) { delete cur.lat; delete cur.lng; localStorage.setItem('currentUser', JSON.stringify(cur)); }
      const uid = cur ? cur.id : null;
      if (uid) localStorage.removeItem('cart_' + uid);
      return 'coords cleared';
    })()`);
    await cdp.send('Page.reload').catch(() => {});
    await sleep(4000);
  }

  const who = await login(cdp);
  console.log('logged in as:', who);
  if (!who) return console.log('LOGIN FAILED — cannot test');

  const pair = await findPair(cdp);
  console.log('same-supplier pair:', JSON.stringify(pair));
  if (!pair) return console.log('NO SAME-SUPPLIER PAIR — cannot test');

  // 1. Collect the first product into the cart.
  const a = await openDetails(cdp, pair.first);
  console.log('opened product A:', JSON.stringify(a));
  const addRes = await evaluate(cdp, `(() => { const b = document.querySelector('.pd-add-to-cart'); if (!b) return 'NO ADD BUTTON'; b.click(); return 'clicked'; })()`);
  await sleep(3000);
  console.log('add A:', addRes, JSON.stringify(await pageState(cdp)));
  await closeCart(cdp);

  // 2. Order the second product from the same supplier.
  const b = await openDetails(cdp, pair.second);
  console.log('opened product B:', JSON.stringify(b));
  const before = await pageState(cdp);
  console.log('before Place Order:', JSON.stringify(before));

  const pressRes = await evaluate(cdp, `(() => {
    const btn = document.querySelector('.pd-place-order');
    if (btn) { if (btn.disabled) return 'PLACE DISABLED: ' + btn.textContent.trim(); btn.click(); return 'clicked place order'; }
    const alt = document.querySelector('.pd-summary-block-btn, .pd-add-to-cart');
    return 'NO PLACE ORDER BUTTON; fallback=' + (alt ? alt.textContent.trim() : 'none');
  })()`);
  console.log('press:', pressRes);

  let after = before;
  const t = Date.now();
  while (Date.now() - t < 30000) {
    await sleep(1000);
    after = await pageState(cdp);
    if (after.orders > before.orders || after.cart.length > before.cart.length || after.cartOpen) break;
  }
  console.log('after:', JSON.stringify(after));
  console.log(`orders ${before.orders} -> ${after.orders}; cart ${before.cart.length} -> ${after.cart.length}; cartOpen=${after.cartOpen}`);
  console.log('VERDICT:', after.orders > before.orders
    ? 'ORDER PLACED'
    : after.cart.some(i => i.name === pair.second)
      ? 'ITEM IS IN THE CART (order deferred — needs location)'
      : 'NOTHING HAPPENED — BUG');
  await shot(cdp, 'cart-order-' + (withLocation ? 'gps' : 'nogps'));
  console.log('console errors:', errors.length ? errors.slice(-5).join(' || ') : '(none)');

  // Reset the cart for the next scenario.
  await evaluate(cdp, `(() => { const k = Object.keys(localStorage).find(x => x.startsWith('cart_')); if (k) localStorage.removeItem(k); return 'cart cleared'; })()`);
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
      if (msg.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push('CONSOLE: ' + msg.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 250));
      }
    });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 414, height: 900, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
    console.log('cloud writes: BLOCKED');
    await cdp.send('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'granted', origin: `http://localhost:${PORT}` }).catch(() => {});

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2500);
    const t0 = Date.now();
    let cleared = false;
    while (Date.now() - t0 < 45000) {
      if (!(await evaluate(cdp, '!!document.querySelector(".splash-screen")'))) { cleared = true; break; }
      await sleep(500);
    }
    console.log('splash cleared:', cleared);

    await runScenario(cdp, 'PHASE A — location available', true, errors);
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(3000);
    await runScenario(cdp, 'PHASE B — location denied, no saved pin', false, errors);

    console.log('\n--- ALL CONSOLE ERRORS ---');
    console.log(errors.length ? errors.join('\n') : '(none)');
    cdp.close();
  } catch (e) {
    console.error('SMOKE FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    if (chrome) { try { chrome.kill(); } catch (_) {} }
    server.close();
  }
})();
