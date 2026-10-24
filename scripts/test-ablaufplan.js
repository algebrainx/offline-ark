/* Test des Stromausfall-Plans: node scripts/test-ablaufplan.js
 * Prüft Phasen, Punkte, Links, fehlende Dosierungen und dass JEDER Text in en/es/ar übersetzt ist.
 * Mit --keys werden fehlende Wörterbuch-Schlüssel ausgegeben. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var root = path.join(__dirname, '..');
var D = require(path.join(root, 'data', 'ablaufplan.js'));
var LANGS = ['en', 'es', 'ar'], warnings = [];

/* ---------- Struktur ---------- */
assert.deepStrictEqual(D.phases.map(function (p) { return p.id; }), ['sofort', 'tag1', 'tag23', 'woche1', 'danach']);
var ids = {}, total = 0, prevTo = 0;
D.phases.forEach(function (p, i) {
  assert.ok(p.title && p.when, p.id + ': Titel/Zeitraum');
  assert.strictEqual(p.from, prevTo, p.id + ': Phasen müssen lückenlos aufeinander folgen');
  assert.ok(p.to == null ? i === D.phases.length - 1 : p.to > p.from, p.id + ': Ende');
  prevTo = p.to;
  assert.ok(p.items.length >= 5 && p.items.length <= 9, p.id + ': ' + p.items.length + ' Punkte (erlaubt 5–9)');
  p.items.forEach(function (it) {
    assert.ok(it.id && it.text, p.id);
    assert.ok(/^[a-z0-9]+:[a-z0-9-]+$/.test(it.id), 'ID ' + it.id);
    assert.ok(!ids[it.id], 'doppelte ID ' + it.id); ids[it.id] = 1;
    assert.ok(!/\b\d+\s?(mg|µg|ml|tabletten|tropfen)\b/i.test(it.text), 'Dosierung? ' + it.text);
    (it.links || []).forEach(function (l) {
      assert.ok(l.t && (l.tool || l.wissen), it.id + ': Link');
      var f = l.tool ? path.join(root, 'tools', l.tool + '.html') : path.join(root, 'wissen', l.wissen + '.html');
      if (!fs.existsSync(f)) warnings.push(path.relative(root, f) + ' fehlt (verlinkt von ' + it.id + ')');
    });
    total++;
  });
});
assert.ok(fs.existsSync(path.join(root, 'wissen', D.page + '.html')), 'Wissensseite fehlt');
console.log('Phasen:', D.phases.length, '· Punkte:', total, '· je Phase:', D.phases.map(function (p) { return p.items.length; }).join('/'));

/* ---------- Übersetzungen ---------- */
function load(file) {
  var store = {};
  var ctx = { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { var key = k.replace(/\s+/g, ' ').trim(); assert.ok(!store[key], file + ': doppelter Schlüssel ' + k); store[key] = o[k]; }); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'i18n', file), 'utf8'), ctx);
  return store;
}
var core = load('core.js'), dict = load('tool-ablaufplan.js');
var needed = {};
function need(s) { if (typeof s === 'string' && s.trim()) needed[s.replace(/\s+/g, ' ').trim()] = 1; }
D.phases.forEach(function (p) { need(p.title); need(p.when); p.items.forEach(function (it) { need(it.text); (it.links || []).forEach(function (l) { need(l.t); }); }); });
need(D.source);
var js = fs.readFileSync(path.join(root, 'js', 'tool-ablaufplan.js'), 'utf8'), m, re = /(?:\bt|OA\.t)\(\s*'((?:[^'\\]|\\.)*)'/g;
while ((m = re.exec(js))) need(m[1].replace(/\\'/g, "'"));
re = /'((?:[^'\\]|\\.)*\{\d\}(?:[^'\\]|\\.)*)'/g;   // Texte mit Platzhaltern, auch in Bedingungen (a ? '…' : '…')
while ((m = re.exec(js))) need(m[1].replace(/\\'/g, "'"));
var html = fs.readFileSync(path.join(root, 'tools', 'ablaufplan.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
html = html.slice(html.indexOf('<body'));
re = />([^<>]+)</g; while ((m = re.exec(html))) need(m[1]);
re = /(?:aria-label|title|placeholder)="([^"]+)"/g; while ((m = re.exec(html))) need(m[1]);

function ph(s) { return (s.match(/\{\d+\}/g) || []).sort().join(','); }
var missing = [], n = 0;
Object.keys(needed).forEach(function (k) {
  if (core[k]) return;
  n++;
  var e = dict[k];
  if (!e) { missing.push(k); return; }
  LANGS.forEach(function (l) {
    var v = e[l];
    assert.ok(typeof v === 'string' && v.trim(), l + ' fehlt für "' + k + '"');
    assert.strictEqual(ph(v), ph(k), 'Platzhalter in ' + l + ' für "' + k + '"');
    assert.ok(!/<|>/.test(v), 'Tags in ' + l + ' für "' + k + '"');
    if (l !== 'ar') assert.ok(!/[äöüß]/i.test(v), 'deutsche Reste in ' + l + ': ' + v);
    if (l === 'ar') assert.ok(!/(?:^|\s)(?:und|oder|der|die|das|nicht)(?:\s|$)/.test(v), 'Deutsch in ar: ' + v);
    var nums = function (s) { return (s.match(/\d+(?:[–:.,]\d+)*/g) || []).map(function (x) { return x.replace(',', '.'); }).sort(); };
    var kn = nums(k), vn = nums(v);
    if (l === 'ar') {
      kn.filter(function (x) { return x.length > 1 || /[–:.,]/.test(x); }).forEach(function (x) { assert.ok(vn.indexOf(x) !== -1, 'Zahl ' + x + ' fehlt in ar für "' + k + '"'); });
      vn.forEach(function (x) { assert.ok(kn.indexOf(x) !== -1, 'Zahl ' + x + ' erfunden in ar für "' + k + '"'); });
    } else assert.deepStrictEqual(vn, kn, 'Zahlen in ' + l + ' für "' + k + '"');
  });
});
Object.keys(dict).forEach(function (k) { if (!needed[k]) warnings.push('unbenutzter Schlüssel: ' + k); });
if (missing.length) {
  if (process.argv.indexOf('--keys') !== -1) missing.forEach(function (k) { console.log(JSON.stringify(k)); });
  console.error(missing.length + ' Schlüssel ohne Übersetzung:\n  ' + missing.slice(0, 15).map(function (k) { return k.slice(0, 80); }).join('\n  '));
  process.exit(1);
}
warnings.forEach(function (w) { console.log('Hinweis:', w); });
console.log('Ablaufplan: alle Tests bestanden (' + n + ' Texte × 3 Sprachen)');
