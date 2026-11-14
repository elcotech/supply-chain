/* Scratch end-to-end smoke test for the order flow. Not part of the app. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const BUILD = path.join(__dirname, 'build');
const PORT = 8099;
const CDP_PORT = 9333;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(__dirname, '.chrome-smoke');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(BUILD, p);
      if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        const idx = path.join(BUILD, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return fs.createReadStream(idx).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

function launchChrome() {
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME, [
      '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE}`, '--no-first-run', '--disable-gpu',
      '--window-size=414,900', '--hide-scrollbars', '--no-sandbox',
      'about:blank',
    ], { stdio: 'ignore', detached: false });
    const deadline = Date.now() + 20000;
    (function poll() {
      http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, res => {
        res.resume(); resolve(child);
      }).on('error', () => {
        if (Date.now() > deadline) return reject(new Error('chrome did not start'));
        setTimeout(poll, 300);
      });
    })();
  });
}

async function targets() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    ws.on('error', reject);
    ws.on('open', () => {
      let id = 0;
      const pending = new Map();
      const listeners = [];
      ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (msg.id && pending.has(msg.id)) {
          const { resolve: r, reject: j } = pending.get(msg.id);
          pending.delete(msg.id);
          msg.error ? j(new Error(msg.error.message)) : r(msg.result);
        } else if (msg.method) {
          listeners.forEach(fn => fn(msg));
        }
      });
      resolve({
        send: (method, params = {}) => new Promise((r, j) => {
          const mid = ++id;
          pending.set(mid, { resolve: r, reject: j });
          ws.send(JSON.stringify({ id: mid, method, params }));
        }),
        on: fn => listeners.push(fn),
        close: () => ws.close(),
      });
    });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- End-to-end order flow -------------------------------------------------
// Signs in as the seeded customer, opens a product and presses Place Order,
// then reports whether an order actually landed.
async function runOrderFlow(cdp, errors) {
  const step = async (label, expression) => {
    const v = await evaluate(cdp, expression);
    console.log(`[${label}]`, typeof v === 'string' ? v.slice(0, 300) : v);
    return v;
  };

  // Who is signed in / what catalogue is present?
  await step('state', `
    JSON.stringify({
      initialized: !!localStorage.getItem('users'),
      users: (JSON.parse(localStorage.getItem('users') || '[]')).length,
      companies: (JSON.parse(localStorage.getItem('companies') || '[]')).length,
      materials: (JSON.parse(localStorage.getItem('materials') || '[]')).length,
      orders: (JSON.parse(localStorage.getItem('orders') || '[]')).length,
      currentUser: (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).email || null,
    })`);

  // Sign in as a seeded customer through the real form (email + datalist).
  const targetEmail = await step('choose-customer', `
    (() => {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const c = users.find(u => u.userType === 'customer') ;
      return c ? c.email : 'NO CUSTOMER';
    })()`);
  await sleep(500);

  // Navigate to the login screen.
  await step('goto-login', `
    (() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /^\s*login\s*$/i.test(x.textContent.trim()));
      if (!b) return 'no login nav button';
      b.click();
      return 'clicked';
    })()`);
  await sleep(900);

  // Init geocodes every supplier before `users` reaches React state, so the
  // login form is on screen with an empty account list for a few seconds.
  // Wait for the datalist to fill, otherwise login reports "valid user" and the
  // rest of the flow tests nothing.
  const tInit = Date.now();
  for (;;) {
    const n = await evaluate(cdp, 'document.querySelectorAll("#userList option").length');
    if (n > 0) break;
    if (Date.now() - tInit > 60000) { console.log('[init] accounts never loaded'); break; }
    await sleep(500);
  }
  console.log(`[init] accounts ready after ${((Date.now() - tInit) / 1000).toFixed(1)}s`);

  await step('email', `
    (() => {
      const input = document.querySelector('input[name="selectedUser"]');
      if (!input) return 'no email field';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(targetEmail)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return 'typed ' + ${JSON.stringify(targetEmail)};
    })()`);
  await sleep(900);

  await step('password', `
    (() => {
      const pw = document.querySelector('input[type="password"]');
      if (!pw) return 'no password field';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(pw, '0909');
      pw.dispatchEvent(new Event('input', { bubbles: true }));
      const form = pw.closest('form');
      if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return 'submitted';
    })()`);
  await sleep(2500);

  await step('after-login', `JSON.stringify({
    page: (document.body.innerText.slice(0, 120)),
    user: (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).email || null,
    type: (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).userType || null,
  })`);

  // Give GPS + startup sync a moment to settle.
  await sleep(1500);

  // Open a product from the home page.
  await step('open-product', `
    (() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /view details/i.test(x.textContent));
      if (!b) return 'no product button';
      b.click();
      return 'clicked';
    })()`);
  await sleep(2500);

  await step('details-sections', `
    JSON.stringify(Array.from(document.querySelectorAll('.pd-section h3')).map(h => h.textContent.trim()))`);

  await step('summary', `
    (() => {
      const s = document.querySelector('.pd-summary');
      if (!s) return 'NO ORDER SUMMARY';
      return s.innerText.replace(/\\n+/g, ' | ').slice(0, 400);
    })()`);

  const before = await step('orders-before', `(JSON.parse(localStorage.getItem('orders') || '[]')).length`);

  // Press Place Order.
  await step('press-place-order', `
    (() => {
      const b = document.querySelector('.pd-place-order');
      if (!b) return 'NO PLACE ORDER BUTTON';
      if (b.disabled) return 'BUTTON DISABLED: ' + b.textContent.trim();
      b.click();
      return 'clicked: ' + b.textContent.trim();
    })()`);

  // Wait for the order to land (GPS + OSRM + commit).
  let after = before;
  const t1 = Date.now();
  while (Date.now() - t1 < 30000) {
    await sleep(1000);
    after = await evaluate(cdp, `(JSON.parse(localStorage.getItem('orders') || '[]')).length`);
    if (after > before) break;
  }
  console.log(`[orders] before=${before} after=${after}`);

  await step('result', `JSON.stringify({
    alert: (document.querySelector('.alert') || {}).innerText || null,
    orders: (JSON.parse(localStorage.getItem('orders') || '[]')).map(o => ({ inv: o.invoiceNumber, qty: o.quantity, total: o.totalAmount, status: o.status })),
  })`);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '.smoke-order.png'), Buffer.from(shot.data, 'base64'));
  console.log('screenshot -> .smoke-order.png');

  console.log('--- ERRORS AFTER LOGIN ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(res.exceptionDetails.exception));
  return res.result.value;
}

module.exports = { serve, launchChrome, targets, connect, evaluate, sleep, PORT, CDP_PORT };

if (require.main === module) {
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
        if (msg.method === 'Runtime.exceptionThrown') {
          errors.push('EXCEPTION: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 400));
        }
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
          errors.push('CONSOLE: ' + msg.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 300));
        }
      });
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 414, height: 900, deviceScaleFactor: 2, mobile: true });
      // Mock GPS so the order path can measure delivery.
      await cdp.send('Emulation.setGeolocationOverride', { latitude: 9.015, longitude: 38.755, accuracy: 10 });

      // By default the cloud is blocked so this run cannot write a test order
      // into the project's live Supabase data. Pass --cloud to allow writes.
      const allowCloud = process.argv.includes('--cloud');
      if (!allowCloud) {
        await cdp.send('Network.enable');
        await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
        console.log('cloud writes: BLOCKED (pass --cloud to allow)');
      } else {
        console.log('cloud writes: ALLOWED');
      }

      await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
      await sleep(2000);

      // Wait for the splash to clear (poll up to 45 s).
      const t0 = Date.now();
      let ready = false;
      while (Date.now() - t0 < 45000) {
        const showing = await evaluate(cdp, '!!document.querySelector(".splash-screen")');
        if (!showing) { ready = true; break; }
        await sleep(500);
      }
      console.log(`splash cleared: ${ready} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      const text = await evaluate(cdp, 'document.body.innerText.slice(0, 1200)');
      console.log('--- PAGE TEXT ---');
      console.log(text);
      console.log('--- ERRORS ---');
      console.log(errors.length ? errors.join('\n') : '(none)');

      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(__dirname, '.smoke-home.png'), Buffer.from(shot.data, 'base64'));
      console.log('screenshot -> .smoke-home.png');

      if (process.argv[2] === '--order') {
        await runOrderFlow(cdp, errors);
      }

      cdp.close();
    } catch (e) {
      console.error('SMOKE FAILED:', e.message);
      process.exitCode = 1;
    } finally {
      if (chrome) { try { chrome.kill(); } catch (_) {} }
      server.close();
    }
  })();
}
