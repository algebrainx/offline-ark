#!/usr/bin/env node
/* Offline-Ark – App-Installation (PWA): schreibt Version und Dateiliste in sw.js.
 *
 * Wird von scripts/build.js am Ende aufgerufen, geht aber auch allein:
 *   node scripts/build-pwa.js
 * Die Version ist ein Hash über Pfade und Inhalte aller zwischengespeicherten Dateien –
 * ändert sich eine Datei, ändert sich die Version, und Geräte laden beim nächsten Start neu.
 * PDFs sind NICHT Teil der Version (eigener Cache, nur auf Wunsch). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SW = path.join(ROOT, 'sw.js');
const SKIP_DIRS = new Set(['scripts', 'content', 'docs', 'scratch', 'dist', 'node_modules', 'server', 'icons-src']);
const EXT = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico', '.woff', '.woff2', '.mp3', '.ogg', '.wav', '.txt']);

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.name.startsWith('.') || e.name.startsWith('_')) return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!(dir === ROOT && SKIP_DIRS.has(e.name))) walk(full, out); return; }
    out.push(full);
  });
  return out;
}

function run() {
  const files = walk(ROOT, []).map((f) => path.relative(ROOT, f).split(path.sep).join('/')).sort();
  const assets = files.filter((f) => f !== 'sw.js' && EXT.has(path.extname(f).toLowerCase()));
  const pdfs = files.filter((f) => /\.pdf$/i.test(f));

  const hash = crypto.createHash('sha256');
  assets.forEach((f) => { hash.update(f); hash.update(fs.readFileSync(path.join(ROOT, f))); });
  const version = hash.digest('hex').slice(0, 10);

  const block = `/* <generated> */\nconst VERSION = '${version}';\nconst ASSETS = ${JSON.stringify(assets, null, 1).replace(/\n\s*/g, '\n')};\nconst PDFS = ${JSON.stringify(pdfs)};\n/* </generated> */`;
  const src = fs.readFileSync(SW, 'utf8');
  if (!/\/\* <generated> \*\/[\s\S]*?\/\* <\/generated> \*\//.test(src)) throw new Error('sw.js: Markierungen <generated> fehlen');
  fs.writeFileSync(SW, src.replace(/\/\* <generated> \*\/[\s\S]*?\/\* <\/generated> \*\//, () => block));

  const bytes = assets.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
  console.log(`✓ sw.js (Version ${version}, ${assets.length} Dateien, ${(bytes / 1048576).toFixed(1)} MB; ${pdfs.length} PDFs optional)`);
  if (bytes > 80 * 1048576) console.warn('! Die App-Dateien sind größer als 80 MB – das kann auf manchen Geräten zu viel Speicher sein.');
}

if (require.main === module) run();
module.exports = { run };
