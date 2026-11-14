/* Scratch: add to cart with geolocation denied, then retry and preview proforma. */
const fs = require('fs');
const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');

const clickText = (cdp, re) => evaluate(cdp, `(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => ${re}.test(x.innerText));
  if (!b) return 'MISSING'; b.click(); return 'clicked';
})()`);
const text = (cdp, sel) => evaluate(cdp, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.innerText.replace(/\\n+/g, ' | ').slice(0, 700) : null; })()`);
const cartLines = cdp => evaluate(cdp, `(() => {
  const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!u) return 'NO USER';
  return JSON.parse(localStorage.getItem('cart_' + u.id) || '[]').map(l => l.materialName + ' x' + l.quantity);
})()`);

async function waitUntil(cdp, expr, label, timeout = 20000) {
  const t0 = Date.now();
  for (;;) {
    if (await evaluate(cdp, expr)) return true;
    if (Date.now() - t0 > timeout) { console.log('TIMEOUT waiting for ' + label); return false; }
    await sleep(400);
  }
}

(async () => {
  const server = await serve();
  let chrome;
  try {
    chrome = await launchChrome();
    const page = (await targets()).find(t => t.type === 'page');
    const cdp = await connect(page.webSocketDebuggerUrl);
    const errors = [];
    cdp.on(msg => {
      if (msg.method === 'Runtime.exceptionThrown') errors.push('EXC ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('CON ' + msg.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 250));
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.args.some(a => String(a.value || a.description || '').includes('PRICE_DIAG'))) errors.push('DIAG ' + msg.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 250));
    });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*', '*router.project-osrm.org*', '*routing.openstreetmap.de*'] });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    const origin = `http://localhost:${PORT}`;
    await cdp.send('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'denied', origin });
    await cdp.send('Emulation.setGeolocationOverride', { latitude: 9.015, longitude: 38.755, accuracy: 10 });

    const seed = JSON.parse(fs.readFileSync('C:/Users/ETHIOMK/AppData/Local/Temp/opencode/seed.json', 'utf8'));
    const target = seed.users.find(u => u.userType === 'customer');
    delete target.lat; delete target.lng;
    const seedScript = Object.keys(seed).map(k => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(seed[k]))});`).join('\n')
      + `\nlocalStorage.removeItem(${JSON.stringify('cart_' + target.id)});`;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript });
    await cdp.send('Page.navigate', { url: origin + '/' });
    await sleep(2500);
    for (let i = 0; i < 60; i++) { if (await evaluate(cdp, 'document.querySelectorAll("button.nav-link").length')) break; await sleep(500); }

    await clickText(cdp, /^\s*login\s*$/i);
    await waitUntil(cdp, 'document.querySelectorAll("#userList option").length > 0', 'accounts');
    await evaluate(cdp, `(() => {
      const input = document.querySelector('input[name="selectedUser"]');
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(input, ${JSON.stringify(target.email)}); input.dispatchEvent(new Event('input', { bubbles: true }));
      const pw = document.querySelector('input[type="password"]');
      s.call(pw, '0909'); pw.dispatchEvent(new Event('input', { bubbles: true }));
      pw.closest('form').requestSubmit();
    })()`);
    await waitUntil(cdp, '!!(JSON.parse(localStorage.getItem("currentUser") || "null"))', 'login');
    console.log('logged in:', target.email, '| coords:', await evaluate(cdp, `JSON.stringify((() => { const u=JSON.parse(localStorage.getItem('currentUser')||'{}'); return {lat:u.lat,lng:u.lng}; })())`));

    await clickText(cdp, /^\s*search\s*$/i);
    await sleep(1200);
    await evaluate(cdp, `(() => { const b = document.querySelector('button[title="View details"]'); if (b) b.click(); return !!b; })()`);
    await waitUntil(cdp, '!!document.querySelector(".pd-title")', 'product details');
    console.log('product:', await text(cdp, '.pd-title'));
    console.log('add button:', await evaluate(cdp, `(() => { const b=document.querySelector('.pd-add-to-cart'); return b ? {text:b.innerText.trim(), disabled:b.disabled} : 'MISSING'; })()`));
    console.log('before add cart/alerts:', JSON.stringify(await cartLines(cdp)), '|', await text(cdp, '.alert'));
    console.log('clicked:', await evaluate(cdp, `(() => { const b = document.querySelector('.pd-add-to-cart'); if (b) b.click(); return !!b; })()`));
    await sleep(1500);
    console.log('after add cart/alerts:', JSON.stringify(await cartLines(cdp)), '|', await text(cdp, '.alert'));

    await waitUntil(cdp, '!!document.querySelector(".cart-modal")', 'cart modal');
    await waitUntil(cdp, `!!document.querySelector('.cart-loading-items, .cart-order-steps')`, 'cart contents');
    await sleep(1200);
    console.log('cart state after add:', JSON.stringify(await cartLines(cdp)));
    console.log('cart visible items:', await text(cdp, '.cart-loading-items') || await text(cdp, '.cart-items'));
    console.log('cart action:', await evaluate(cdp, `(() => { const b=Array.from(document.querySelectorAll('.cart-modal button')).find(x=>/location|retry/i.test(x.innerText)); return b ? b.innerText.trim() : 'MISSING'; })()`));
    console.log('proforma available before location:', await evaluate(cdp, `!!Array.from(document.querySelectorAll('.cart-order-step')).find(x=>/proforma/i.test(x.innerText))`));

    await cdp.send('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'granted', origin });
    console.log('click location:', await evaluate(cdp, `(() => {
      const b = Array.from(document.querySelectorAll('.cart-modal button')).find(x => /use my current location/i.test(x.innerText));
      if (!b) return 'MISSING'; b.click(); return 'clicked';
    })()`));
    await sleep(2500);
    console.log('after location click:', await evaluate(cdp, `JSON.stringify((() => { const u=JSON.parse(localStorage.getItem('currentUser')||'{}'); return {lat:u.lat,lng:u.lng}; })())`), '| alert:', await text(cdp, '.alert'), '| cart:', await text(cdp, '.cart-modal'));
    await sleep(5000);
    console.log('routing requests:', await evaluate(cdp, `JSON.stringify((() => { const r=performance.getEntriesByType('resource').filter(e => /osrm|openstreetmap/.test(e.name)); const c={}; r.forEach(e => { const k=/osrm/.test(e.name)?'osrm':'nominatim'; c[k]=(c[k]||0)+1; }); return c; })())`));
    const priced = await waitUntil(cdp, `!!Array.from(document.querySelectorAll('.cart-order-step')).find(x=>/proforma/i.test(x.innerText))`, 'priced cart', 15000);
    console.log('priced:', priced, '| block:', await text(cdp, '.cart-loading-error'), '| cart:', await text(cdp, '.cart-modal'));
    await sleep(600);
    console.log('cart steps:', await text(cdp, '.cart-order-steps'));
    console.log('supplier:', await text(cdp, '.cart-supplier-info'));

    console.log('click preview:', await clickText(cdp, /to preview/i));
    await waitUntil(cdp, '!!document.querySelector(".proforma-document")', 'proforma', 10000);
    console.log('proforma visible:', await evaluate(cdp, `!!document.querySelector('.proforma-document')`));
    console.log('proforma text:', (await text(cdp, '.proforma-document') || '').slice(0, 500));
    console.log('errors:', errors.length ? errors.join('\n') : '(none)');
    cdp.close();
  } catch (e) { console.error('NOGPS CART SMOKE FAILED:', e.message); process.exitCode = 1; }
  finally { if (chrome) { try { chrome.kill(); } catch (_) {} } server.close(); }
})();
