/* Scratch: capture the product-details page for a visual check against
   Sample Layout.jpg. Not part of the app. */
const fs = require('fs');
const path = require('path');
const { serve, launchChrome, targets, connect, evaluate, sleep, PORT } = require('./.smoke-order.js');

const shot = async (cdp, file) => {
  const s = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(__dirname, file), Buffer.from(s.data, 'base64'));
  console.log('screenshot ->', file);
};

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

    const email = await evaluate(cdp, `(() => {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const c = users.find(u => u.userType === 'customer');
      return c ? c.email : '';
    })()`);
    await evaluate(cdp, `(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /^\\s*login\\s*$/i.test(x.textContent.trim()));
      if (b) b.click();
    })()`);
    const t1 = Date.now();
    while (Date.now() - t1 < 60000) {
      if ((await evaluate(cdp, 'document.querySelectorAll("#userList option").length')) > 0) break;
      await sleep(400);
    }
    await evaluate(cdp, `(() => {
      const input = document.querySelector('input[name="selectedUser"]');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(input, ${JSON.stringify(email)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(400);
    await evaluate(cdp, `(() => {
      const pw = document.querySelector('input[type="password"]');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(pw, '0909');
      pw.dispatchEvent(new Event('input', { bubbles: true }));
      const form = pw.closest('form');
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()`);
    const t2 = Date.now();
    while (Date.now() - t2 < 30000) {
      if (await evaluate(cdp, '!!(JSON.parse(localStorage.getItem("currentUser") || "null"))')) break;
      await sleep(400);
    }

    // Search -> open the first product with a photo if there is one.
    await evaluate(cdp, `(() => {
      const b = Array.from(document.querySelectorAll('.mobile-tabbar .m-tab')).find(x => /Search/.test(x.innerText));
      if (b) b.click();
    })()`);
    const t3 = Date.now();
    while (Date.now() - t3 < 20000) {
      if ((await evaluate(cdp, 'document.querySelectorAll(".m-search-item").length')) > 0) break;
      await sleep(400);
    }
    await evaluate(cdp, `(() => {
      const cards = Array.from(document.querySelectorAll('.m-search-item'));
      const withPhoto = cards.find(c => c.querySelector('img'));
      const target = withPhoto || cards[0];
      if (target) target.querySelector('.m-pc-name').click();
    })()`);
    const t4 = Date.now();
    while (Date.now() - t4 < 20000) {
      if (await evaluate(cdp, '!!document.querySelector(".pd-summary")')) break;
      await sleep(400);
    }
    const t5 = Date.now();
    while (Date.now() - t5 < 20000) {
      const ready = await evaluate(cdp, `(() => {
        const b = document.querySelector('.pd-place-order');
        return !!b && !b.disabled;
      })()`);
      if (ready) break;
      await sleep(400);
    }
    console.log('sections:', await evaluate(cdp, 'JSON.stringify(Array.from(document.querySelectorAll(".pd-section h3")).map(h => h.textContent.trim()))'));

    // Top of the product page, then the summary/reviews further down.
    await shot(cdp, '.details-top.png');
    await evaluate(cdp, '(() => { const m = document.querySelector(".modal-content"); if (m) m.scrollTop = Math.round(m.scrollHeight * 0.42); })()');
    await sleep(500);
    await shot(cdp, '.details-middle.png');
    await evaluate(cdp, '(() => { const m = document.querySelector(".modal-content"); if (m) m.scrollTop = m.scrollHeight; })()');
    await sleep(600);
    await shot(cdp, '.details-bottom.png');

    cdp.close();
  } catch (e) {
    console.error('SHOT FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    if (chrome) { try { chrome.kill(); } catch (_) {} }
    server.close();
  }
})();
