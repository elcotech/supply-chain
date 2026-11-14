/* Scratch: debug why the smoke login fails. Not part of the app. */
const fs = require('fs');
const path = require('path');
const { serve, launchChrome, targets, connect, evaluate, sleep, PORT, CDP_PORT } = require('./.smoke-order.js');

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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 414, height: 900, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setGeolocationOverride', { latitude: 9.015, longitude: 38.755, accuracy: 10 });
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2500);
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      if (!(await evaluate(cdp, '!!document.querySelector(".splash-screen")'))) break;
      await sleep(500);
    }

    const targetEmail = await evaluate(cdp, `(() => {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const c = users.find(u => u.userType === 'customer');
      return c ? c.email : 'NO CUSTOMER';
    })()`);
    console.log('target email:', JSON.stringify(targetEmail));

    await evaluate(cdp, `(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /^\\s*login\\s*$/i.test(x.textContent.trim()));
      if (!b) return 'no login nav button'; b.click(); return 'clicked';
    })()`);
    await sleep(900);
    console.log('page now:', (await evaluate(cdp, 'document.body.innerText.slice(0,200)')).replace(/\n+/g, ' | '));

    const ti = Date.now();
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const n = await evaluate(cdp, 'document.querySelectorAll("#userList option").length');
      if (n > 0) { ready = true; console.log(`users ready after ${((Date.now() - ti) / 1000).toFixed(1)}s with ${n} options`); break; }
      await sleep(1000);
    }
    if (!ready) console.log('users NEVER became ready within 60s');

    console.log('datalist:', JSON.stringify(await evaluate(cdp, `(() => ({
      forms: document.forms.length,
      named: document.querySelectorAll('input[name="selectedUser"]').length,
      options: Array.from(document.querySelectorAll('#userList option')).slice(0, 3).map(o => o.value),
      optionCount: document.querySelectorAll('#userList option').length,
      datalists: document.querySelectorAll('datalist').length,
      userListEl: !!document.querySelector('#userList'),
      userListHtml: (document.querySelector('#userList') || { outerHTML: 'MISSING' }).outerHTML.slice(0, 300),
      lsUsers: (JSON.parse(localStorage.getItem('users') || '[]')).length,
      lsFirst: (JSON.parse(localStorage.getItem('users') || '[]'))[0] && (JSON.parse(localStorage.getItem('users') || '[]'))[0].email,
      reactProbe: (() => {
        const dl = document.querySelector('#userList');
        const inp = document.querySelector('input[name="selectedUser"]');
        const pk = el => el && Object.keys(el).find(k => k.indexOf('__reactProps') === 0);
        const dp = dl && dl[pk(dl)];
        const ip = inp && inp[pk(inp)];
        return {
          optionChildren: dp ? (Array.isArray(dp.children) ? dp.children.length : typeof dp.children) : null,
          inputValue: ip ? ip.value : null,
        };
      })(),
    }))()`)));

    const typed = await evaluate(cdp, `(() => {
      const input = document.querySelector('input[name="selectedUser"]');
      if (!input) return 'no field';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(targetEmail)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { value: input.value };
    })()`);
    console.log('typed:', JSON.stringify(typed));
    await sleep(700);

    console.log('after input event:', JSON.stringify(await evaluate(cdp, `(() => ({
      inputValue: (document.querySelector('input[name="selectedUser"]') || {}).value,
      hasPassword: !!document.querySelector('input[type="password"]'),
      alert: (document.querySelector('.alert') || {}).innerText || null,
      body: document.body.innerText.slice(0, 300),
    }))()`)).slice(0, 600));

    const pw = await evaluate(cdp, `(() => {
      const pw = document.querySelector('input[type="password"]');
      if (!pw) return 'no password field';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(pw, '0909');
      pw.dispatchEvent(new Event('input', { bubbles: true }));
      const form = pw.closest('form');
      if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return 'submitted';
    })()`);
    console.log('pw step:', pw);
    await sleep(2500);
    console.log('after submit:', JSON.stringify(await evaluate(cdp, `(() => ({
      alert: (document.querySelector('.alert') || {}).innerText || null,
      currentUser: (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).email || null,
      body: document.body.innerText.slice(0, 200),
    }))()`)).slice(0, 500));
    console.log('errors:', errors.length ? errors.join('\n') : '(none)');
    cdp.close();
  } catch (e) {
    console.error('DEBUG FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    if (chrome) { try { chrome.kill(); } catch (_) {} }
    server.close();
  }
})();
