/* Scratch: measure what blocks first render of the account list / catalogue.
   Not part of the app. */
const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');

(async () => {
  const server = await serve();
  let chrome;
  try {
    chrome = await launchChrome();
    const list = await targets();
    const page = list.find(t => t.type === 'page');
    const cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
    const requests = [];
    cdp.on(msg => {
      if (msg.method === 'Network.requestWillBeSent') {
        requests.push([Math.round(performance.now ? 0 : 0), msg.params.request.url.slice(0, 80)]);
      }
    });

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 414, height: 900, deviceScaleFactor: 2, mobile: true });
    const started = Date.now();
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });

    // Timeline: splash gone -> catalogue present -> login open -> accounts present
    const marks = {};
    for (let i = 0; i < 40; i++) {
      const probe = await evaluate(cdp, `JSON.stringify({
        t: Math.round(performance.now()),
        splash: !!document.querySelector('.splash-screen'),
        accounts: document.querySelectorAll('#userList option').length,
        loginOpen: !!document.querySelector('input[name="selectedUser"]'),
        noProducts: document.body.innerText.indexOf('No products listed yet') >= 0,
        clicked: !!window.__clickedLogin,
        supa: performance.getEntriesByType('resource').filter(e => e.name.indexOf('supabase') >= 0).map(e => e.name.slice(0, 55) + ' :: ' + Math.round(e.duration) + 'ms'),
        js: performance.getEntriesByType('resource').filter(e => e.name.indexOf('.js') >= 0).map(e => Math.round(e.duration) + 'ms'),
        size: Object.keys(localStorage).reduce((s, k) => s + (localStorage.getItem(k) || '').length, 0),
      })`);
      const p0 = JSON.parse(probe);
      const catalogueReady = p0.t > 3000 && !p0.noProducts;
      if (!p0.splash && !p0.clicked && (catalogueReady || p0.t > 9000)) {
        await evaluate(cdp, `(() => {
          window.__clickedLogin = true;
          const b = Array.from(document.querySelectorAll('button')).find(x => /^\\s*login\\s*$/i.test(x.textContent.trim()));
          if (b) b.click();
          return !!b;
        })()`);
      }
      const probe2 = await evaluate(cdp, `JSON.stringify({
        t: Math.round(performance.now()),
        splash: !!document.querySelector('.splash-screen'),
        accounts: document.querySelectorAll('#userList option').length,
        loginOpen: !!document.querySelector('input[name="selectedUser"]'),
        noProducts: document.body.innerText.indexOf('No products listed yet') >= 0,
        size: Object.keys(localStorage).reduce((s, k) => s + (localStorage.getItem(k) || '').length, 0),
        supa: performance.getEntriesByType('resource').filter(e => e.name.indexOf('supabase') >= 0).map(e => e.name.slice(0, 55) + ' :: ' + Math.round(e.duration) + 'ms'),
        slow: performance.getEntriesByType('resource').filter(e => e.duration > 500).map(e => e.name.slice(0, 55) + ' :: ' + Math.round(e.duration) + 'ms'),
        js: performance.getEntriesByType('resource').filter(e => e.name.indexOf('.js') >= 0).map(e => Math.round(e.duration) + 'ms'),
      })`);
      const p = JSON.parse(probe2);
      if (!marks.splash && !p.splash) { marks.splash = p.t; console.log(`splash cleared at ${p.t}ms`); }
      if (!marks.loginOpen && p.loginOpen) { marks.loginOpen = p.t; console.log(`login form open at ${p.t}ms`); }
      if (!marks.accounts && p.accounts > 0) { marks.accounts = p.t; console.log(`accounts present at ${p.t}ms (count ${p.accounts})`); }
      if (!marks.noProducts && !p.loginOpen && !p.noProducts && p.t > 3000) { marks.noProducts = p.t; console.log(`catalogue present at ${p.t}ms`); }
      if (i === 6) console.log('snapshot:', JSON.stringify(p, null, 1));
      if (marks.accounts && marks.noProducts) break;
      await sleep(400);
      if (Date.now() - started > 45000) break;
    }
    const final = JSON.parse(await evaluate(cdp, `JSON.stringify({
      t: Math.round(performance.now()),
      accounts: document.querySelectorAll('#userList option').length,
      supa: performance.getEntriesByType('resource').filter(e => e.name.indexOf('supabase') >= 0).map(e => e.name.slice(0, 55) + ' :: ' + Math.round(e.duration) + 'ms'),
      slow: performance.getEntriesByType('resource').filter(e => e.duration > 500).map(e => e.name.slice(0, 55) + ' :: ' + Math.round(e.duration) + 'ms'),
      js: performance.getEntriesByType('resource').filter(e => e.name.indexOf('.js') >= 0).map(e => Math.round(e.duration) + 'ms'),
      size: Object.keys(localStorage).reduce((s, k) => s + (localStorage.getItem(k) || '').length, 0),
    })`));
    console.log('final:', JSON.stringify(final, null, 1));
    cdp.close();
  } catch (e) {
    console.error('PROBE FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    if (chrome) { try { chrome.kill(); } catch (_) {} }
    server.close();
  }
})();
