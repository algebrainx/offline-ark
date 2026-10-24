/* Wörterbuch-Test für garten, einkochen, brennholz: node scripts/test-tools-i18n.js
 * Prüft: en/es/ar vorhanden, gleiche Platzhalter und Tags, keine deutschen Reste in en/es,
 * und dass alle Texte aus den Datendateien übersetzt sind. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var root = path.join(__dirname, '..');
var LANGS = ['en', 'es', 'ar'];

function load(id) {
  var store = {};
  var ctx = { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { assert.ok(!store[k.replace(/\s+/g, ' ').trim()], id + ': doppelter Schlüssel ' + k); store[k.replace(/\s+/g, ' ').trim()] = o[k]; }); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'i18n', 'tool-' + id + '.js'), 'utf8'), ctx);
  return store;
}
function ph(s) { return (s.match(/\{\d+\}/g) || []).sort().join(','); }
function tags(s) { return (s.match(/<\/?[a-z]+[^>]*>/g) || []).map(function (t) { return t.replace(/\s+/g, ' '); }).sort().join(''); }
var DE_WORDS = /\b(und|oder|der|die|das|nicht|mit|für|ist|wird|bei|nach|ein|eine|im|zu|von)\b/;

var dicts = {};
['garten', 'einkochen', 'brennholz', 'knoten'].forEach(function (id) {
  var d = dicts[id] = load(id), n = 0;
  Object.keys(d).forEach(function (k) {
    LANGS.forEach(function (l) {
      var v = d[k][l];
      assert.ok(typeof v === 'string' && v.trim(), id + ': ' + l + ' fehlt für "' + k + '"');
      assert.strictEqual(ph(v), ph(k), id + ': Platzhalter in ' + l + ' für "' + k + '"');
      assert.strictEqual(tags(v), tags(k), id + ': Tags in ' + l + ' für "' + k + '"');
      if (l !== 'ar') assert.ok(!/[äöüß]/i.test(v) || /BBK|Offline-Ark|Baden-Württemberg|Veitshöchheim|Gelierzucker|Schornsteinfeger|Rundtörn mit zwei halben Schlägen/.test(v), id + ': deutsche Reste in ' + l + ': ' + v);
      if (l === 'en') assert.ok(!DE_WORDS.test(v) || /Baden|Veitsh|Rundtörn mit zwei/.test(v), id + ': Deutsch in en: ' + v);
      if (l === 'ar') assert.ok(!/[A-Za-z]{4,}.*\s(und|oder)\s/.test(v), id + ': Deutsch in ar: ' + v);
    });
    n++;
  });
  console.log(id, n, 'Schlüssel');
});

function need(id, key) { assert.ok(dicts[id][String(key).replace(/\s+/g, ' ').trim()], id + ': Übersetzung fehlt für "' + key + '"'); }

var G = require(path.join(root, 'data', 'garten.js'));
G.crops.forEach(function (c) { need('garten', c.name); });
[G.storage, G.emergency].forEach(function (a) { a.forEach(function (x) { need('garten', x.name); need('garten', x.text); }); });
G.frost.forEach(function (x) { need('garten', x.text); });
G.sources.forEach(function (s) { need('garten', s.license); need('garten', s.note); });

var E = require(path.join(root, 'data', 'einkochen.js'));
(E.sources || []).forEach(function (s) { need('einkochen', s.license); need('einkochen', s.note); });
var B = require(path.join(root, 'data', 'brennholz.js'));
(B.sources || []).forEach(function (s) { need('brennholz', s.license); need('brennholz', s.note); });
(B.species || []).forEach(function (s) { need('brennholz', s.name); });
(B.insulation || B.insulations || []).forEach(function (s) { if (s.name) need('brennholz', s.name); });
(B.stoves || []).forEach(function (s) { if (s.name) need('brennholz', s.name); });
console.log('Daten-Texte übersetzt: OK');

// Knoten: Seite (HTML), Oberfläche (OA.t-Literale) und alle Daten-Texte müssen im Wörterbuch stehen (Kern-Wörterbuch zählt mit)
(function () {
  var core = {}, tool = dicts.knoten, norm = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'i18n', 'core.js'), 'utf8'), { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { core[norm(k)] = o[k]; }); } } } });
  var seen = 0, used = {};
  function need(key) {
    var k = norm(key);
    assert.ok(tool[k] || core[k], 'knoten: Übersetzung fehlt für "' + key + '"');
    used[k] = 1;
    seen++;
  }
  var D = require(path.join(root, 'data', 'knoten.js'));
  D.CATS.forEach(function (c) { need(c.label); });
  D.KNOTS.forEach(function (k) {
    ['title', 'sub', 'purpose', 'avoid', 'warn', 'credit'].forEach(function (f) { if (k[f]) need(k[f]); });
    k.steps.forEach(function (s) {
      need(s.t);
      (s.marks || []).forEach(function (m) { if (m.k === 'text' && !/^[A-Z]$/.test(m.s)) need(m.s); });
    });
    k.src.forEach(function (s) { need(s.l); });
    (k.photos || []).forEach(function (p) {
      need(p.c);
      assert.ok(p.by && p.lic && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.u), 'knoten: Quellenzeile unvollständig für ' + p.f);
    });
  });
  var js = fs.readFileSync(path.join(root, 'js', 'tool-knoten.js'), 'utf8'), m, re = /\bt\('((?:[^'\\]|\\.)*)'/g;
  while ((m = re.exec(js))) need(m[1].replace(/\\'/g, "'"));
  re = /label: '((?:[^'\\]|\\.)*)'/g;   // Filter-Schaltfläche „Alle“
  while ((m = re.exec(js))) need(m[1]);
  var html = fs.readFileSync(path.join(root, 'tools', 'knoten.html'), 'utf8').replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, '');
  html = html.slice(html.indexOf('<body'));
  re = />([^<>]+)</g;
  while ((m = re.exec(html))) if (/[A-Za-zÄÖÜäöü]{2,}/.test(m[1])) need(m[1]);
  re = /\s(?:placeholder|aria-label|title|alt)="([^"]+)"/g;
  while ((m = re.exec(html))) need(m[1]);
  Object.keys(tool).forEach(function (k) { assert.ok(used[k], 'knoten: Wörterbuch-Schlüssel wird nicht benutzt: ' + k); });
  console.log('knoten: ' + seen + ' Texte (Seite, Oberfläche, Daten) übersetzt: OK');
})();
