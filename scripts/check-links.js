#!/usr/bin/env node
/* Offline-Ark – prüft, ob alle in content/*.md angegebenen Quellen-Links
 * noch erreichbar sind. Nur Warnungen, ändert nichts.
 * Hinweis: Manche Seiten (z. B. mit Bot-Schutz) antworten 403/202 – dann
 * bitte im Browser prüfen. Benötigt Internet und Node.js ≥ 16. */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const dir = path.resolve(__dirname, '..', 'content');
const urls = new Map();
fs.readdirSync(dir).filter((f) => f.endsWith('.md')).forEach((f) => {
  fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*-\s+[^|]+\|\s*(https?:\/\/[^\s|]+)\s*\|/);
    if (m) urls.set(m[1], (urls.get(m[1]) || []).concat(f));
  });
});

function status(url, hops = 0) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 offline-ark-linkcheck' }, timeout: 15000 }, (res) => {
      res.resume();
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 6) {
        return resolve(status(new URL(res.headers.location, url).toString(), hops + 1));
      }
      resolve(res.statusCode);
    });
    req.on('error', (e) => resolve(e.code || 'Fehler'));
    req.on('timeout', () => { req.destroy(); resolve('Timeout'); });
  });
}

(async () => {
  let bad = 0;
  for (const [url, files] of urls) {
    const s = await status(url);
    const ok = s === 200;
    if (!ok) bad++;
    console.log((ok ? '✓ ' : '! ') + s + '  ' + url + (ok ? '' : '   (' + files.join(', ') + ')'));
  }
  console.log(`\n${urls.size} Links geprüft, ${bad} auffällig.`);
})();
