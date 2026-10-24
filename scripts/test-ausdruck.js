/* Test Ausdruck-Paket: node scripts/test-ausdruck.js
 * Prüft das Wörterbuch (alle Sprachen, gleiche Platzhalter) und dass jeder deutsche Text
 * aus js/tool-ausdruck.js und tools/ausdruck.html in einem der geladenen Wörterbücher steht. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function load(file) {
  const store = {};
  const ctx = { OA: { i18n: { add: (o) => Object.keys(o).forEach((k) => { assert.ok(!store[k], file + ': doppelter Schlüssel ' + k); store[k] = o[k]; }) } } };
  vm.runInNewContext(read(file), ctx);
  return store;
}
const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');

const own = load('data/i18n/tool-ausdruck.js');
Object.keys(own).forEach((k) => ['en', 'es', 'ar'].forEach((l) => {
  const v = own[k][l];
  assert.ok(typeof v === 'string' && v.trim(), `${l} fehlt für "${k}"`);
  assert.strictEqual(ph(v), ph(k), `Platzhalter in ${l} für "${k}"`);
}));

const all = Object.assign({}, ...['core', 'tool-ausdruck', 'tool-checklisten', 'tool-notvorrat', 'tool-kontakte', 'tool-morse'].map((n) => load(`data/i18n/${n}.js`)));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const missing = [];

// Zeichenketten im Skript, die wie deutsche Texte aussehen
const js = read('js/tool-ausdruck.js'), lit = /'((?:[^'\\]|\\.)*)'/g;
let m;
while ((m = lit.exec(js))) {
  const k = m[1].replace(/\\'/g, "'");
  if (!/[A-Za-zÄÖÜäöüß]{3,}/.test(k) || /^[a-z:.#_-]+$/i.test(k) && !/\s/.test(k) && !/^[A-ZÄÖÜ]/.test(k)) continue;
  if (/[<>=;\[]|^\s|^use strict|^2-digit|^callout|^pp-|^#|^data-|^\.|^wissen:|^check:|^(de|en|es|ar)$|^[A-Z]{1,3}$|px|mm|\/|^notruf|^kontakte|^morse|^notfallpass|^notvorrat|^karten|^listen|^wichtig|^alles|^nichts|^Offline-Ark$|^Rh|^ltr|^rtl|^SOS$/.test(k)) continue;
  if (!all[norm(k)]) missing.push(k);
}
// Statische Texte im HTML (Textknoten, aria-label)
const html = read('tools/ausdruck.html').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
const texts = [];
html.replace(/>([^<>]+)</g, (x, t) => texts.push(t));
html.replace(/aria-label="([^"]+)"/g, (x, t) => texts.push(t));
texts.map(norm).map((t) => t.replace(/ – Offline-Ark$/, '')).filter((t) => /[A-Za-zÄÖÜäöüß]{3,}/.test(t)).forEach((t) => { if (!all[t]) missing.push(t); });

assert.deepStrictEqual(Array.from(new Set(missing)), [], 'Ohne Übersetzung');
console.log('ausdruck: alle Tests bestanden (' + Object.keys(own).length + ' Schlüssel)');
