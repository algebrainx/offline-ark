#!/usr/bin/env node
/* Offline-Ark – lädt die PDFs aus scripts/library.json nach /bibliothek.
 * Nur gemeinfreie bzw. frei lizenzierte Dokumente gehören in library.json.
 * Bereits vorhandene Dateien werden übersprungen (mit --force neu laden).
 * Benötigt Internet und Node.js ≥ 16, keine Pakete. */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const DIR = path.resolve(__dirname, '..', 'bibliothek');
const force = process.argv.includes('--force');

function get(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Zu viele Weiterleitungen'));
    https.get(url, { headers: { 'User-Agent': 'offline-ark-update/1.0' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), dest, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => out.close(() => {
        // Prüfen, dass wirklich ein PDF ankam (und keine Fehlerseite)
        const head = Buffer.alloc(5); const fd = fs.openSync(tmp, 'r'); fs.readSync(fd, head, 0, 5, 0); fs.closeSync(fd);
        if (head.toString() !== '%PDF-') { fs.unlinkSync(tmp); return reject(new Error('Keine PDF-Datei erhalten')); }
        fs.renameSync(tmp, dest); resolve();
      }));
      out.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  const lib = JSON.parse(fs.readFileSync(path.join(__dirname, 'library.json'), 'utf8'));
  fs.mkdirSync(DIR, { recursive: true });
  let failed = 0;
  for (const item of lib) {
    const dest = path.join(DIR, item.file);
    if (fs.existsSync(dest) && !force) { console.log('= ' + item.file + ' (vorhanden)'); continue; }
    try { await get(item.url, dest); console.log('✓ ' + item.file); }
    catch (e) { failed++; console.warn('! ' + item.file + ': ' + e.message); }
  }
  process.exit(failed ? 1 : 0);
})();
