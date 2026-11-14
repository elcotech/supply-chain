const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');
(async () => {
  const server = await serve();
  let chrome;
  try {
    chrome = await launchChrome();
    const page = (await targets()).find(t => t.type === 'page');
    const cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*router.project-osrm.org*'] });
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2000);
    const out = await evaluate(cdp, `(async () => {
      const t = Date.now();
      const c = new AbortController();
      const timer = setTimeout(() => c.abort(), 9000);
      try { await fetch('https://router.project-osrm.org/route/v1/driving/1,1;2,2', { signal: c.signal }); return 'resolved ' + (Date.now()-t); }
      catch (e) { return 'rejected ' + e.name + ' ' + (Date.now()-t); }
      finally { clearTimeout(timer); }
    })()`);
    console.log('fetch result:', out);
  } finally { if (chrome) chrome.kill(); server.close(); }
})();
