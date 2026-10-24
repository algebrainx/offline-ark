#!/usr/bin/env node
/* Offline-Ark – App-Symbole (PNG) aus den SVG-Vorlagen in icons/ erzeugen.
 * Nur nötig, wenn das Symbol geändert wird; die fertigen PNGs liegen im Repository.
 * Braucht Microsoft Edge oder Chrome (Pfad per Umgebungsvariable BROWSER setzen). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ICONS = path.resolve(__dirname, '..', 'icons');
const BROWSER = process.env.BROWSER || [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].find((p) => fs.existsSync(p));
if (!BROWSER) { console.error('Kein Edge/Chrome gefunden (BROWSER=Pfad setzen).'); process.exit(1); }

const JOBS = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180]
];

JOBS.forEach(([svg, out, size]) => {
  const wrap = path.join(ICONS, '_wrap.html');
  fs.writeFileSync(wrap, `<!DOCTYPE html><html><body style="margin:0;background:transparent"><img src="${svg}" width="${size}" height="${size}" style="display:block"></body></html>`);
  execFileSync(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    '--screenshot=' + path.join(ICONS, out), `--window-size=${size},${size}`, 'file:///' + wrap.replace(/\\/g, '/')], { stdio: 'ignore' });
  console.log('✓ icons/' + out + ' (' + Math.round(fs.statSync(path.join(ICONS, out)).size / 1024) + ' KB)');
});
fs.unlinkSync(path.join(ICONS, '_wrap.html'));
