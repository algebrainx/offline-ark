/* Test der Wörterbücher (data/i18n/tool-*.js): node scripts/test-i18n.js
 * Prüft: alle drei Sprachen vorhanden, gleiche Platzhalter, Tags bei data-t-Schlüsseln,
 * und dass alle Texte aus den Datendateien (Checklisten, Einheiten) übersetzt sind. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var root = path.join(__dirname, '..');
var TOOLS = ['einheiten', 'inventar', 'notizen', 'kontakte', 'checklisten'];
var LANGS = ['en', 'es', 'ar'];
var total = 0;

function load(id) {
  var store = {};
  var ctx = { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { assert.ok(!store[k], id + ': doppelter Schlüssel ' + k); store[k] = o[k]; }); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'i18n', 'tool-' + id + '.js'), 'utf8'), ctx);
  return store;
}
function ph(s) { return (s.match(/\{\d+\}/g) || []).sort().join(','); }
function tags(s) { return (s.match(/<\/?[a-z]+[^>]*>/g) || []).map(function (t) { return t.replace(/\s+/g, ' '); }).sort().join(''); }

var dicts = {};
TOOLS.forEach(function (id) {
  var d = dicts[id] = load(id), n = 0;
  Object.keys(d).forEach(function (k) {
    LANGS.forEach(function (l) {
      var v = d[k][l];
      assert.ok(typeof v === 'string' && v.trim(), id + ': ' + l + ' fehlt für "' + k + '"');
      assert.strictEqual(ph(v), ph(k), id + ': Platzhalter in ' + l + ' für "' + k + '"');
      assert.strictEqual(tags(v), tags(k), id + ': Tags in ' + l + ' für "' + k + '"');
      if (l !== 'ar') assert.ok(!/[äöüß]/i.test(v) || /BBK|Vorsorgen|Offline-Ark|Telefonseelsorge/.test(v), id + ': deutsche Reste in ' + l + ': ' + v);
      if (l === 'ar' && !/Vorsorgen/.test(v)) assert.ok(!/(?:^|\s)(?:und|oder|der|die|das)(?:\s|$)/.test(v), id + ': Deutsch in ar: ' + v);
    });
    n++;
  });
  total += n;
  console.log(id, n, 'Schlüssel');
});

// Checklisten: jeder Text muss übersetzt sein
var lists = require(path.join(root, 'data', 'checklisten.js'));
lists.forEach(function (l) {
  [l.title, l.intro].forEach(function (k) { assert.ok(dicts.checklisten[k], 'Checkliste fehlt: ' + k); });
  l.sections.forEach(function (s) {
    assert.ok(dicts.checklisten[s.title], 'Abschnitt fehlt: ' + s.title);
    s.items.forEach(function (it) { assert.ok(dicts.checklisten[it.text], 'Punkt fehlt: ' + it.text); });
  });
});

// Einheiten: Kategorien, Einheiten, Kürzel
var E = require(path.join(root, 'data', 'einheiten.js'));
E.cats.forEach(function (c) {
  assert.ok(dicts.einheiten[c.name], 'Kategorie fehlt: ' + c.name);
  c.units.forEach(function (u) {
    assert.ok(dicts.einheiten[u.name], 'Einheit fehlt: ' + u.name);
  });
});
assert.ok(dicts.einheiten.sm && dicts.einheiten.Tasse);   // einzige Kürzel mit deutschem Bezug

// Inventar/Kontakte: Kategorien aus den Logik-Dateien
require(path.join(root, 'js', 'inventar-core.js')).CATS.forEach(function (c) { assert.ok(dicts.inventar[c], 'Inventar-Kategorie fehlt: ' + c); });
var K = require(path.join(root, 'js', 'kontakte-core.js'));
K.TYPES.forEach(function (t) { assert.ok(dicts.kontakte[t.label], 'Treffpunkt-Art fehlt: ' + t.label); });
K.ADDR_CATS.forEach(function (c) { assert.ok(dicts.kontakte[c], 'Adress-Kategorie fehlt: ' + c); });

// Alle OA.t('…')-Literale in den Tool-Skripten müssen im Wörterbuch stehen (einfache Anführungszeichen)
TOOLS.forEach(function (id) {
  var files = ['tool-' + id + '.js'].concat(id === 'inventar' ? ['inventar-core.js'] : id === 'notizen' ? ['notizen-core.js'] : []);
  files.forEach(function (f) {
    var src = fs.readFileSync(path.join(root, 'js', f), 'utf8'), re = /OA\.t\(([^)]*?)(?:,\s*\[|\)\s*[,;+)\]}]|\))/g, m;
    var lit = /'((?:[^'\\]|\\.)*)'/g;
    while ((m = re.exec(src))) {
      var arg = m[1], q;
      while ((q = lit.exec(arg))) {
        var key = q[1].replace(/\\'/g, "'");
        if (!/[A-Za-zÄÖÜäöüß]{3,}/.test(key) || /^[a-z]+$/.test(key)) continue;   // Modus-Namen wie 'notizen' sind keine Texte
        assert.ok(dicts[id][key], id + ' (' + f + '): OA.t-Schlüssel fehlt: ' + key);
      }
    }
  });
});
console.log('i18n: alle Tests bestanden (' + total + ' Schlüssel)');
