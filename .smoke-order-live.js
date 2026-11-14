/* Scratch: order flow against the live cloud data, writes blocked after pull. */
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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 414, height: 900, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setGeolocationOverride', { latitude: 9.015, longitude: 38.755, accuracy: 10 });

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2500);
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const n = await evaluate(cdp, `(() => ({
        users: (JSON.parse(localStorage.getItem('users') || '[]')).length,
        mats: (JSON.parse(localStorage.getItem('materials') || '[]')).length,
        splash: !!document.querySelector('.splash-screen'),
        fabs: document.querySelectorAll('.m-fab, .m-tab').length,
      }))()`);
      if (n.mats > 0 && n.fabs > 0) { console.log('live data ready', JSON.stringify(n)); break; }
      await sleep(1000);
    }
    console.log('state:', await evaluate(cdp, `JSON.stringify({
      users: (JSON.parse(localStorage.getItem('users') || '[]')).length,
      companies: (JSON.parse(localStorage.getItem('companies') || '[]')).length,
      materials: (JSON.parse(localStorage.getItem('materials') || '[]')).length,
      orders: (JSON.parse(localStorage.getItem('orders') || '[]')).length,
    })`));
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
    console.log('cloud now blocked');

    const targetEmail = await evaluate(cdp, `(() => {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const c = users.find(u => u.userType === 'customer');
      return c ? c.email : 'NO CUSTOMER';
    })()`);
    console.log('target email:', targetEmail);

    const clicked = await evaluate(cdp, `(() => {
      const b = document.querySelector('.m-fab') || Array.from(document.querySelectorAll('button')).find(x => /login/i.test(x.textContent));
      if (!b) return 'NO MOBILE LOGIN';
      b.click(); return 'clicked ' + b.textContent.trim();
    })()`);
    console.log('login fab:', clicked);
    await sleep(1200);
    for (let i = 0; i < 30; i++) {
      const n = await evaluate(cdp, 'document.querySelectorAll("#userList option").length');
      if (n > 0) { console.log('accounts ready', n); break; }
      await sleep(1000);
    }
    await evaluate(cdp, `(() => {
      const input = document.querySelector('input[name="selectedUser"]');
      if (!input) return 'no field';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(targetEmail)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return 'typed';
    })()`);
    await sleep(700);
    await evaluate(cdp, `(() => {
      const pw = document.querySelector('input[type="password"]');
      if (!pw) return 'no pw';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(pw, '0909');
      pw.dispatchEvent(new Event('input', { bubbles: true }));
      const form = pw.closest('form');
      if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return 'submitted';
    })()`);
    await sleep(2500);
    console.log('after login:', JSON.stringify(await evaluate(cdp, `(() => ({
      user: (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).email || null,
      lat: (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).lat,
      lng: (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).lng,
      alert: (document.querySelector('.alert') || {}).innerText || null,
    }))()`)));

    await evaluate(cdp, `(() => { const b = Array.from(document.querySelectorAll('.m-tab')).find(x => /search/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
    await sleep(1500);
    const opened = await evaluate(cdp, `(() => {
      const b = document.querySelector('.m-pc-img') || document.querySelector('button[aria-label^="View details"]') || document.querySelector('button[title="View details"]');
      if (!b) return 'NO PRODUCT';
      b.click(); return 'opened ' + (b.getAttribute('aria-label') || b.title);
    })()`);
    console.log('open product:', opened);
    await sleep(3000);
    console.log('sections:', await evaluate(cdp, `JSON.stringify(Array.from(document.querySelectorAll('.pd-section h3')).map(h => h.textContent.trim()))`));
    console.log('summary:', await evaluate(cdp, `(() => { const s = document.querySelector('.pd-summary'); return s ? s.innerText.replace(/\\n+/g, ' | ').slice(0, 500) : 'NO SUMMARY'; })()`));
    console.log('button:', await evaluate(cdp, `(() => { const b = document.querySelector('.pd-place-order'); return b ? { text: b.textContent.trim(), disabled: b.disabled } : 'NO BUTTON'; })()`));

    const before = await evaluate(cdp, `(JSON.parse(localStorage.getItem('orders') || '[]')).length`);
    const pressed = await evaluate(cdp, `(() => { const b = document.querySelector('.pd-place-order'); if (!b) return 'NO BTN'; if (b.disabled) return 'DISABLED'; b.click(); return 'clicked'; })()`);
    console.log('press:', pressed, 'before', before);
    let after = before;
    const t1 = Date.now();
    while (Date.now() - t1 < 45000) {
      await sleep(1000);
      after = await evaluate(cdp, `(JSON.parse(localStorage.getItem('orders') || '[]')).length`);
      if (after > before) break;
    }
    console.log('orders after:', after);
    console.log('alert:', await evaluate(cdp, `(document.querySelector('.alert') || {}).innerText || null`));
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '.smoke-order-live.png'), Buffer.from(shot.data, 'base64'));
    console.log('errors:', errors.length ? errors.join('\n') : '(none)');
    cdp.close();
  } catch (e) {
    console.error('LIVE SMOKE FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    if (chrome) { try { chrome.kill(); } catch (_) {} }
    server.close();
  }
})();
