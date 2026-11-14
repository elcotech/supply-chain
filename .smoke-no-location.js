/* Scratch: order flow for a customer with no saved coordinates. */
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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Emulation.setGeolocationOverride', { latitude: 9.015, longitude: 38.755, accuracy: 10 });
    try { await cdp.send('Browser.grantPermissions', { origin: `http://localhost:${PORT}`, permissions: ['geolocation'] }); } catch (e) { console.log('grant failed', e.message); }
    const seed = JSON.parse(fs.readFileSync('C:/Users/ETHIOMK/AppData/Local/Temp/opencode/seed.json', 'utf8'));
    const target = seed.users.find(u => u.userType === 'customer');
    delete target.lat; delete target.lng;
    const seedScript = Object.keys(seed).map(k => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(seed[k]))});`).join('\n');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript });
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2500);
    for (let i = 0; i < 60; i++) { if (await evaluate(cdp, 'document.querySelectorAll("button.nav-link").length')) break; await sleep(500); }

    await evaluate(cdp, `(() => { const b = Array.from(document.querySelectorAll('button.nav-link')).find(x => /login/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
    await sleep(900);
    for (let i = 0; i < 30; i++) { if (await evaluate(cdp, 'document.querySelectorAll("#userList option").length')) break; await sleep(1000); }
    await evaluate(cdp, `(() => { const input=document.querySelector('input[name="selectedUser"]'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(input, ${JSON.stringify(target.email)}); input.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'; })()`);
    await sleep(700);
    await evaluate(cdp, `(() => { const pw=document.querySelector('input[type="password"]'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(pw,'0909'); pw.dispatchEvent(new Event('input',{bubbles:true})); pw.closest('form').requestSubmit(); return 'ok'; })()`);
    await sleep(2000);
    console.log('user coords:', await evaluate(cdp, `JSON.stringify((() => { const u=JSON.parse(localStorage.getItem('currentUser')||'null')||{}; return { email:u.email, lat:u.lat, lng:u.lng }; })())`));

    await evaluate(cdp, `(() => { const b=Array.from(document.querySelectorAll('button.nav-link')).find(x=>/^\\s*search\\s*$/i.test(x.textContent)); if(b)b.click(); return !!b; })()`);
    await sleep(1500);
    await evaluate(cdp, `(() => { const b=document.querySelector('button[title="View details"]'); if(b)b.click(); return !!b; })()`);
    await sleep(4000);
    console.log('summary:', await evaluate(cdp, `(() => { const s=document.querySelector('.pd-summary'); return s ? s.innerText.replace(/\\n+/g,' | ').slice(0,600) : 'NO SUMMARY'; })()`));
    console.log('button:', await evaluate(cdp, `(() => { const b=document.querySelector('.pd-place-order'); return b ? { text:b.textContent.trim(), disabled:b.disabled } : 'NO BUTTON'; })()`));
    console.log('block:', await evaluate(cdp, `(() => { const b=document.querySelector('.pd-summary-block'); return b ? b.innerText.replace(/\\n+/g,' | ') : null; })()`));
    const before = await evaluate(cdp, `(JSON.parse(localStorage.getItem('orders')||'[]')).length`);
    console.log('press:', await evaluate(cdp, `(() => { const b=document.querySelector('.pd-place-order'); if(!b) return 'NO BTN'; if(b.disabled) return 'DISABLED'; b.click(); return 'clicked'; })()`), 'before', before);
    let after = before;
    for (let i = 0; i < 45; i++) { await sleep(1000); after = await evaluate(cdp, `(JSON.parse(localStorage.getItem('orders')||'[]')).length`); if (after > before) break; }
    console.log('orders after:', after);
    console.log('alerts:', await evaluate(cdp, `(document.querySelector('.alert')||{}).innerText||null`));
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '.smoke-no-location.png'), Buffer.from(shot.data, 'base64'));
    console.log('errors:', errors.length ? errors.join('\n') : '(none)');
    cdp.close();
  } catch (e) { console.error('NO-LOC SMOKE FAILED:', e.message); process.exitCode = 1; }
  finally { if (chrome) { try { chrome.kill(); } catch (_) {} } server.close(); }
})();
