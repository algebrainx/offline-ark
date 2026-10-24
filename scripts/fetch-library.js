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

const RETRY_STATUS = [408, 425, 429, 500, 502, 503, 504];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Zu viele Weiterleitungen'));
    const req = https.get(url, { headers: { 'User-Agent': 'offline-ark-update/1.0', 'Accept': 'application/pdf,*/*' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        const err = new Error('HTTP ' + res.statusCode);
        err.retry = RETRY_STATUS.includes(res.statusCode);
        const wait = parseInt(res.headers['retry-after'], 10);
        if (wait > 0) err.waitMs = Math.min(wait, 60) * 1000;
        return reject(err);
      }
      const tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      res.on('error', (e) => { out.destroy(); fs.rmSync(tmp, { force: true }); e.retry = true; reject(e); });
      res.on('aborted', () => { out.destroy(); fs.rmSync(tmp, { force: true }); const e = new Error('Verbindung abgebrochen'); e.retry = true; reject(e); });
      out.on('finish', () => out.close(() => {
        // Prüfen, dass wirklich ein PDF ankam (und keine Fehlerseite)
        const head = Buffer.alloc(5); const fd = fs.openSync(tmp, 'r'); fs.readSync(fd, head, 0, 5, 0); fs.closeSync(fd);
        const expected = parseInt(res.headers['content-length'], 10);
        if (head.toString() !== '%PDF-') { fs.unlinkSync(tmp); return reject(new Error('Keine PDF-Datei erhalten')); }
        if (expected && fs.statSync(tmp).size !== expected) { fs.unlinkSync(tmp); const e = new Error('Datei unvollständig'); e.retry = true; return reject(e); }
        fs.renameSync(tmp, dest); resolve();
      }));
      out.on('error', reject);
    });
    req.setTimeout(60000, () => { const e = new Error('Zeitüberschreitung'); e.retry = true; req.destroy(e); });
    req.on('error', (e) => { if (e.retry === undefined) e.retry = true; reject(e); });
  });
}

async function getWithRetry(url, dest, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await get(url, dest); }
    catch (e) {
      if (!e.retry || i >= tries) throw e;
      const wait = e.waitMs || 2000 * 2 ** (i - 1);
      console.warn('  … ' + e.message + ', neuer Versuch in ' + Math.round(wait / 1000) + ' s (' + (i + 1) + '/' + tries + ')');
      await sleep(wait);
    }
  }
}

(async () => {
  const lib = JSON.parse(fs.readFileSync(path.join(__dirname, 'library.json'), 'utf8'));
  fs.mkdirSync(DIR, { recursive: true });
  let failed = 0;
  for (const item of lib) {
    const dest = path.join(DIR, item.file);
    if (fs.existsSync(dest) && !force) { console.log('= ' + item.file + ' (vorhanden)'); continue; }
    try { await getWithRetry(item.url, dest); console.log('✓ ' + item.file); }
    catch (e) { failed++; console.warn('! ' + item.file + ': ' + e.message); }
  }
  process.exit(failed ? 1 : 0);
})();
