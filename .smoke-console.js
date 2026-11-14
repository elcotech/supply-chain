const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');
(async () => {
  const server = await serve();
  let chrome;
  try {
    chrome = await launchChrome();
    const page = (await targets()).find(t => t.type === 'page');
    const cdp = await connect(page.webSocketDebuggerUrl);
    const seen = [];
    cdp.on(msg => { if (msg.method === 'Runtime.consoleAPICalled') seen.push(msg.params.type + ':' + msg.params.args.map(a => a.value || a.description || '').join(' ')); });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2500);
    await evaluate(cdp, `console.log('HELLO_LOG', 42); console.error('HELLO_ERR')`);
    await sleep(500);
    console.log('seen:', JSON.stringify(seen));
    const info = await evaluate(cdp, `JSON.stringify({scripts: Array.from(document.scripts).map(s => s.src), hasDiag: null})`);
    console.log('info:', info);
    console.log('check:', await evaluate(cdp, `fetch(Array.from(document.scripts).find(s => /main\\./.test(s.src)).src).then(r => r.text()).then(t => t.includes('PRICE_DIAG'))`));
  } finally { if (chrome) chrome.kill(); server.close(); }
})();
