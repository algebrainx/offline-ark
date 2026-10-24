/* Test des Notfall-Assistenten: node scripts/test-assistent.js
 * Prüft Datenmodell (Verweise, Sackgassen, Zyklen, Erreichbarkeit), Inhaltsregeln (keine Dosierungen),
 * Anker in den erzeugten Wissensseiten und dass JEDER Text in en/es/ar übersetzt ist.
 * Mit --keys werden fehlende Wörterbuch-Schlüssel als Vorlage ausgegeben. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var root = path.join(__dirname, '..');
var D = require(path.join(root, 'data', 'assistent.js'));
var NODES = D.nodes, LANGS = ['en', 'es', 'ar'];
var warnings = [];

/* ---------- Struktur ---------- */
assert.ok(NODES[D.start] && NODES[D.start].type === 'menu', 'Startknoten fehlt oder ist kein Menü');
var ids = Object.keys(NODES);
ids.forEach(function (id) {
  var n = NODES[id];
  assert.ok(/^[a-z0-9_]+$/.test(id), 'ID ' + id);
  assert.ok(['menu', 'question', 'result'].indexOf(n.type) !== -1, id + ': Typ');
  assert.ok(n.title || n.type === 'menu', id + ': Titel fehlt');
  if (n.type === 'result') {
    assert.ok(Array.isArray(n.steps) && n.steps.length >= 3 && n.steps.length <= 8, id + ': ' + (n.steps ? n.steps.length : 0) + ' Schritte (erlaubt 3–8)');
    assert.ok(!n.answers, id + ': Ergebnis mit Antworten');
    (n.next || []).forEach(function (x) { assert.ok(NODES[x.to], id + ': next → ' + x.to + ' existiert nicht'); assert.ok(x.t, id + ': next ohne Text'); });
    assert.ok(n.more && n.more.length, id + ': "Mehr dazu" fehlt');
    n.more.forEach(function (m) {
      assert.ok(D.anchors[m[0]] && D.anchors[m[0]][m[1]], id + ': Anker ' + m.join('/') + ' unbekannt');
    });
    (n.links || []).forEach(function (l) { assert.ok(l.tool && l.t, id + ': Link'); });
  } else {
    assert.ok(n.text, id + ': Frage fehlt');
    assert.ok(Array.isArray(n.answers) && n.answers.length >= 2 && n.answers.length <= 10, id + ': Antworten');
    n.answers.forEach(function (x) { assert.ok(NODES[x.to], id + ': → ' + x.to + ' existiert nicht'); assert.ok(x.t, id + ': Antwort ohne Text'); });
    assert.ok(!n.next, id + ': Frage mit next');
    if (n.steps) assert.ok(n.steps.length >= 1 && n.steps.length <= 8, id + ': Schritte');
  }
  // Keine Dosierungen, keine Medikamentennamen
  var all = JSON.stringify(n);
  assert.ok(!/\b\d+\s?(mg|µg|ml|tabletten|tropfen|aspirin|ibuprofen|paracetamol|adrenalin)\b/i.test(all) && !/aspirin|ibuprofen|paracetamol|adrenalin|naloxon/i.test(all), id + ': Medikament oder Dosierung?');
});

/* Nur über Antworten: keine Zyklen, und jede Frage erreicht ein Ergebnis (keine Sackgassen) */
var color = {};
function visit(id) {
  var n = NODES[id];
  if (n.type === 'result') return;
  assert.ok(color[id] !== 1, 'Zyklus über Antworten bei ' + id);
  if (color[id] === 2) return;
  color[id] = 1;
  n.answers.forEach(function (x) { visit(x.to); });
  color[id] = 2;
}
visit(D.start);
// Alles erreichbar (auch über next)
var seen = {};
(function walk(id) {
  if (seen[id]) return; seen[id] = 1;
  var n = NODES[id];
  (n.answers || []).concat(n.next || []).forEach(function (x) { walk(x.to); });
})(D.start);
ids.forEach(function (id) { assert.ok(seen[id], 'Knoten nicht erreichbar: ' + id); });

/* Pfade (Antworten von der Startfrage bis zu einem Ergebnis) */
var paths = 0, longest = 0;
(function count(id, depth) {
  var n = NODES[id];
  if (n.type === 'result') { paths++; longest = Math.max(longest, depth); return; }
  n.answers.forEach(function (x) { count(x.to, depth + 1); });
})(D.start, 0);
assert.ok(longest <= 8, 'Pfad zu lang: ' + longest + ' Bildschirme');
var results = ids.filter(function (i) { return NODES[i].type === 'result'; }).length;
var nextEdges = 0; ids.forEach(function (i) { nextEdges += (NODES[i].next || []).length; });
console.log('Knoten:', ids.length, '· Ergebnisse:', results, '· Pfade (Antworten):', paths, '· Anschlüsse (next):', nextEdges, '· längster Pfad:', longest, 'Bildschirme');

/* ---------- Anker in den erzeugten Wissensseiten ---------- */
Object.keys(D.anchors).forEach(function (page) {
  Object.keys(D.anchors[page]).forEach(function (key) {
    if (key === 'title') return;
    ['de', 'en', 'es', 'ar'].forEach(function (l) {
      var f = path.join(root, 'knowledge', l === 'de' ? '' : l, page + '.html');
      var html = fs.readFileSync(f, 'utf8'), id = D.anchors[page][key][l];
      assert.ok(id, page + '/' + key + ': Anker für ' + l + ' fehlt');
      assert.ok(html.indexOf('id="' + id + '"') !== -1, 'Anker ' + id + ' fehlt in ' + path.relative(root, f));
    });
  });
});

/* Verlinkte Werkzeuge müssen existieren (metronom/karte entstehen parallel: nur Warnung) */
ids.forEach(function (id) {
  (NODES[id].links || []).forEach(function (l) {
    if (!fs.existsSync(path.join(root, 'tools', l.tool + '.html'))) warnings.push('tools/' + l.tool + '.html fehlt noch (verlinkt von ' + id + ')');
  });
});

/* ---------- Übersetzungen ---------- */
function load(file) {
  var store = {};
  var ctx = { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { var key = k.replace(/\s+/g, ' ').trim(); assert.ok(!store[key], file + ': doppelter Schlüssel ' + k); store[key] = o[k]; }); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'i18n', file), 'utf8'), ctx);
  return store;
}
var core = load('core.js'), dict = load('tool-assistent.js');

var needed = {};
function need(s) { if (typeof s === 'string' && s.trim()) needed[s.replace(/\s+/g, ' ').trim()] = 1; }
ids.forEach(function (id) {
  var n = NODES[id];
  need(n.title); need(n.lead); need(n.text);
  (n.steps || []).forEach(need);
  (n.notes || []).forEach(function (x) { need(x.t); need(x.x); });
  (n.answers || []).concat(n.next || []).forEach(function (x) { need(x.t); });
  (n.links || []).forEach(function (l) { need(l.t); });
});
Object.keys(D.anchors).forEach(function (p) { need(D.anchors[p].title); });
// Texte aus dem Skript: rich('…') und OA.t('…')
var js = fs.readFileSync(path.join(root, 'js', 'tool-assistent.js'), 'utf8'), m, re = /(?:rich|OA\.t|plain)\(\s*'((?:[^'\\]|\\.)*)'/g;
while ((m = re.exec(js))) need(m[1].replace(/\\'/g, "'"));
// Statischer Text der Seite
var html = fs.readFileSync(path.join(root, 'tools', 'assistent.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
html = html.slice(html.indexOf('<body'));
var t; re = />([^<>]+)</g; while ((m = re.exec(html))) { t = m[1].trim(); if (t) need(t); }
re = /(?:aria-label|title|placeholder)="([^"]+)"/g; while ((m = re.exec(html))) need(m[1]);

function ph(s) { return (s.match(/\{\d+\}/g) || []).sort().join(','); }
function bold(s) { return (s.match(/\*\*/g) || []).length; }
var missing = [], total = 0;
Object.keys(needed).forEach(function (k) {
  if (core[k]) return;                       // steht schon im gemeinsamen Wörterbuch
  total++;
  var e = dict[k];
  if (!e) { missing.push(k); return; }
  LANGS.forEach(function (l) {
    var v = e[l];
    assert.ok(typeof v === 'string' && v.trim(), l + ' fehlt für "' + k + '"');
    assert.strictEqual(ph(v), ph(k), 'Platzhalter in ' + l + ' für "' + k + '"');
    assert.strictEqual(bold(v), bold(k), '** in ' + l + ' für "' + k + '"');
    assert.ok(!/<|>/.test(v), 'Tags in ' + l + ' für "' + k + '"');
    if (l !== 'ar') assert.ok(!/[äöüß]/i.test(v), 'deutsche Reste in ' + l + ': ' + v);
    if (l === 'ar') assert.ok(!/(?:^|\s)(?:und|oder|der|die|das|nicht|Ruf)(?:\s|$)/.test(v), 'Deutsch in ar: ' + v);
    // Zahlen (112, 5–6, 100–120, 30:2 …) müssen stimmen: en/es exakt, ar mindestens alle mehrstelligen; nie erfundene Zahlen
    var nums = function (s) { return (s.match(/\d+(?:[–:.,]\d+)*/g) || []).sort(); };
    var kn = nums(k), vn = nums(v);
    if (l === 'ar') {
      kn.filter(function (x) { return x.length > 1; }).forEach(function (x) { assert.ok(vn.indexOf(x) !== -1, 'Zahl ' + x + ' fehlt in ar für "' + k + '"'); });
      vn.forEach(function (x) { assert.ok(kn.indexOf(x) !== -1, 'Zahl ' + x + ' erfunden in ar für "' + k + '"'); });
    } else assert.deepStrictEqual(vn, kn, 'Zahlen in ' + l + ' für "' + k + '"');
  });
});
// Überflüssige Schlüssel melden
Object.keys(dict).forEach(function (k) { if (!needed[k]) warnings.push('unbenutzter Schlüssel: ' + k); });

if (missing.length) {
  if (process.argv.indexOf('--keys') !== -1) missing.forEach(function (k) { console.log(JSON.stringify(k)); });
  console.error(missing.length + ' Schlüssel ohne Übersetzung:\n  ' + missing.slice(0, 15).map(function (k) { return k.slice(0, 80); }).join('\n  '));
  process.exit(1);
}
warnings.forEach(function (w) { console.log('Hinweis:', w); });
console.log('Assistent: alle Tests bestanden (' + total + ' Texte × 3 Sprachen)');
