/* Test der Wörterbücher (data/i18n/tool-*.js): node scripts/test-i18n.js
 * Prüft: alle drei Sprachen vorhanden, gleiche Platzhalter, Tags bei data-t-Schlüsseln,
 * und dass alle Texte aus den Datendateien (Checklisten, Einheiten) übersetzt sind. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var root = path.join(__dirname, '..');
var TOOLS = ['einheiten', 'inventar', 'notizen', 'kontakte', 'checklisten', 'notfallpass', 'kinder', 'knoten'];
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
      if (l !== 'ar') assert.ok(!(l === 'es' ? /[äöß]/i : /[äöüß]/i).test(v) || /BBK|Vorsorgen|Offline-Ark|Telefonseelsorge|Patientenverfügung|Vorsorgevollmacht|Rosenstraße|Rundtörn mit zwei halben Schlägen/.test(v), id + ': deutsche Reste in ' + l + ': ' + v);
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
  var all = '';
  files.forEach(function (f) {
    var src = fs.readFileSync(path.join(root, 'js', f), 'utf8'), re = /(?:OA\.t|\bt)\(([^)]*?)(?:,\s*\[|\)\s*[,;+)\]}]|\))/g, m;
    var lit = /'((?:[^'\\]|\\.)*)'/g;
    while ((m = re.exec(src))) {
      var arg = m[1], q;
      while ((q = lit.exec(arg))) {
        var key = q[1].replace(/\\'/g, "'");
        if (!/[A-Za-zÄÖÜäöüß]{3,}/.test(key) || /^[a-z-]+$/.test(key)) continue;   // Modus-Namen wie 'notizen' sind keine Texte
        assert.ok(dicts[id][key], id + ' (' + f + '): OA.t-Schlüssel fehlt: ' + key);
      }
    }
  });
});
// Notfallpass: Kartenbeschriftungen laufen über lab()/fl()/Zeilenlisten
(function () {
  var src = fs.readFileSync(path.join(root, 'js', 'tool-notfallpass.js'), 'utf8'), re = /(?:lab|fl)\('([^']+)'|\['([^']+)',/g, m;
  while ((m = re.exec(src))) {
    var key = m[1] || m[2]; if (!/^[A-ZÄÖÜ]/.test(key)) continue; if (/^Notfallkontakt \d$/.test(key)) key = 'Notfallkontakt {0}';
    assert.ok(dicts.notfallpass[key], 'Notfallpass: Beschriftung fehlt: ' + key);
  }
  ['Notfallpass', 'geboren', 'Notfallkontakte', 'Notfallkontakt {0}', 'ja', 'nein'].forEach(function (k) { assert.ok(dicts.notfallpass[k], k); });
})();

// Kinderbereich: Karten, Rollenspiel, Spielnamen, Farben, Symbole
(function () {
  var K = require(path.join(root, 'data', 'kinder.js')), d = dicts.kinder, need = function (k) { assert.ok(d[k], 'Kinder: Text fehlt: ' + k); };
  K.cards.forEach(function (c) {
    need(c.title);
    c.blocks.forEach(function (b) { if (b.text) need(b.text); if (b.head) need(b.head); if (b.label) need(b.label); (b.items || []).forEach(function (i) { need(typeof i === 'string' ? i : i.text); }); });
  });
  K.roleplay.forEach(function (q) { need(q.q); q.options.forEach(need); need(q.good); need(q.hint); });
  K.paint.forEach(function (p) { need(p.name); });
  var js = fs.readFileSync(path.join(root, 'js', 'tool-kinder.js'), 'utf8'), m, re = /(?:name|sub): '([^']+)'/g;
  while ((m = re.exec(js))) need(m[1]);
  re = /: '([A-ZÄÖÜ][a-zäöüß]+)'/g;   // Symbolnamen (SYM_NAMES)
  var block = /var SYM_NAMES = \{([^}]*)\}/.exec(js)[1];
  block.replace(/'([^']+)'/g, function (x, n) { need(n); });
})();
// Knoten: Titel, Zweck, Warnungen, Schritte, Quellen und Bildunterschriften aus data/knoten.js
(function () {
  var D = require(path.join(root, 'data', 'knoten.js')), d = dicts.knoten, need = function (k) { assert.ok(d[k], 'Knoten: Text fehlt: ' + k); };
  D.CATS.forEach(function (c) { need(c.label); });
  D.KNOTS.forEach(function (k) {
    ['title', 'sub', 'purpose', 'avoid', 'warn', 'credit'].forEach(function (f) { if (k[f]) need(k[f]); });
    k.steps.forEach(function (s) { need(s.t); });
    k.src.forEach(function (s) { need(s.l); });
    (k.photos || []).forEach(function (p) { need(p.c); });
  });
})();
console.log('i18n: alle Tests bestanden (' + total + ' Schlüssel)');
