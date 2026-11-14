const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { serve, PORT } = require('./.smoke-order.js');
const BUILD = path.join(__dirname, 'build');
const rel = '/static/js/main.c9538072.js';
const file = path.join(BUILD, rel);
const disk = fs.readFileSync(file);
(async () => {
  const server = await serve();
  http.get(`http://localhost:${PORT}${rel}`, res => {
    const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => {
      const served = Buffer.concat(chunks);
      const d = disk.toString(); const s = served.toString();
      console.log('disk len', disk.length, 'diag', d.includes('PRICE_DIAG'), 'hash', crypto.createHash('sha1').update(disk).digest('hex'));
      console.log('served len', served.length, 'diag', s.includes('PRICE_DIAG'), 'hash', crypto.createHash('sha1').update(served).digest('hex'));
      console.log('files with diag:', fs.readdirSync(path.join(BUILD,'static','js')).map(f => [f, fs.readFileSync(path.join(BUILD,'static','js',f),'utf8').includes('PRICE_DIAG')]));
      server.close();
    });
  });
})();
