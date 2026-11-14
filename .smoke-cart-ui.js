/* Scratch: verify the rebuilt cart (Sample Layout) and that the product-page
   distance carries into the cart. Not part of the app. */
const fs = require('fs');
const path = require('path');
const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');

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
      if (msg.method === 'Runtime.exceptionThrown') errors.push('EXC ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 400));
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('CON ' + msg.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 300));
    });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 980, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Emulation.setGeolocationOverride', { latitude: 9.015, longitude: 38.755, accuracy: 10 });
    const seed = JSON.parse(fs.readFileSync('C:/Users/ETHIOMK/AppData/Local/Temp/opencode/seed.json', 'utf8'));
    const seedScript = Object.keys(seed).map(k => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(seed[k]))});`).join('\n');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript });
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2500);
    for (let i = 0; i < 60; i++) { if (await evaluate(cdp, 'document.querySelectorAll("button.nav-link").length')) break; await sleep(500); }

    // Login as the first customer account.
    const targetEmail = await evaluate(cdp, `(() => { const u = JSON.parse(localStorage.getItem('users')||'[]').find(u => u.userType==='customer'); return u ? u.email : 'NO'; })()`);
    await evaluate(cdp, `(() => { const b = Array.from(document.querySelectorAll('button.nav-link')).find(x => /login/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
    await sleep(900);
    for (let i = 0; i < 30; i++) { if (await evaluate(cdp, 'document.querySelectorAll("#userList option").length')) break; await sleep(1000); }
    await evaluate(cdp, `(() => { const input=document.querySelector('input[name="selectedUser"]'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(input, ${JSON.stringify(targetEmail)}); input.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'; })()`);
    await sleep(700);
    await evaluate(cdp, `(() => { const pw=document.querySelector('input[type="password"]'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(pw,'0909'); pw.dispatchEvent(new Event('input',{bubbles:true})); const f=pw.closest('form'); f.requestSubmit(); return 'ok'; })()`);
    await sleep(2500);

    // Open a product from search.
    await evaluate(cdp, `(() => { const b=Array.from(document.querySelectorAll('button.nav-link')).find(x=>/^\\s*search\\s*$/i.test(x.textContent)); if(b)b.click(); return !!b; })()`);
    await sleep(1500);
    await evaluate(cdp, `(() => { const b=document.querySelector('button[title="View details"]'); if(b)b.click(); return !!b; })()`);
    await sleep(3500);

    // Exact KM shown on the product page.
    const productKm = await evaluate(cdp, `(() => { const p=document.querySelector('.pd-map-pill'); return p ? p.textContent.trim() : 'NO PILL'; })()`);
    console.log('product page distance:', productKm);

    // Add to cart, then wait for the priced cart modal.
    console.log('add-to-cart:', await evaluate(cdp, `(() => { const b=document.querySelector('.pd-add-to-cart'); if(!b) return 'NO BTN'; if(b.disabled) return 'DISABLED'; b.click(); return 'clicked'; })()`));
    await sleep(5000);

    const cartInfo = await evaluate(cdp, `(() => {
      const m = document.querySelector('.cart-sample-modal');
      if (!m) return null;
      const rows = Array.from(m.querySelectorAll('.cart-sample-row')).map(r => r.innerText.replace(/\\n+/g,' | ').trim());
      return {
        head: (m.querySelector('.cart-sample-head')||{}).innerText || '',
        clock: (m.querySelector('.cart-live-clock')||{}).innerText || '',
        steps: Array.from(m.querySelectorAll('.cart-order-step')).map(b => b.innerText.replace(/\\n+/g,' ').trim()),
        cards: Array.from(m.querySelectorAll('.cart-sample-product')).map(c => c.innerText.replace(/\\n+/g,' | ').trim()),
        viewMap: Array.from(m.querySelectorAll('.cart-sample-card-btn')).map(b => b.textContent.trim()),
        rows,
        payment: (m.querySelector('.payment-selector')||{}).innerText || '',
        actions: (m.querySelector('.cart-sample-actions')||{}).innerText.replace(/\\n+/g,' | ') || '',
      };
    })()`);
    if (!cartInfo) {
      console.log('CART MODAL MISSING');
    } else {
      console.log('header:', JSON.stringify(cartInfo.head));
      console.log('clock:', JSON.stringify(cartInfo.clock));
      console.log('steps:', JSON.stringify(cartInfo.steps));
      console.log('card:', JSON.stringify(cartInfo.cards[0] || ''));
      console.log('view/map btns:', JSON.stringify(cartInfo.viewMap));
      cartInfo.rows.forEach(r => console.log('row:', r));
      console.log('payment:', JSON.stringify(cartInfo.payment.slice(0, 200)));
      console.log('actions:', JSON.stringify(cartInfo.actions));
      const deliveryRow = cartInfo.rows.find(r => /Delivery Cost/i.test(r)) || '';
      const cartKm = (deliveryRow.match(/([\d.]+)\s*km/) || [])[1];
      const pageKm = (productKm.match(/([\d.]+)\s*km/) || [])[1];
      console.log('DISTANCE CARRY:', pageKm && cartKm ? (pageKm === cartKm ? `MATCH ${pageKm} km` : `MISMATCH page=${pageKm} cart=${cartKm}`) : `UNVERIFIED page=${productKm} row=${deliveryRow}`);
    }
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '.smoke-cart-ui.png'), Buffer.from(shot.data, 'base64'));
    console.log('errors:', errors.length ? errors.join('\n') : '(none)');
    cdp.close();
  } catch (e) { console.error('CART UI SMOKE FAILED:', e.message); process.exitCode = 1; }
  finally { if (chrome) { try { chrome.kill(); } catch (_) {} } server.close(); }
})();
