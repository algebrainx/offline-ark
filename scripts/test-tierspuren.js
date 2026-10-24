/* Test für "Tierspuren": node scripts/test-tierspuren.js
 * Prüft die Suchlogik (Mini-Bestimmer), die Daten (Maße nur wie in den Quellen, Zeichnungen vorhanden) und die Übersetzungen. */
'use strict';
var fs = require('fs'), path = require('path'), assert = require('assert');
var root = path.join(__dirname, '..');
var T = require('../data/tierspuren.js');

function ids(list) { return list.map(function (r) { return r.animal.id; }).sort(); }
function has(list, id) { return ids(list).indexOf(id) >= 0; }
function A(id) { return T.animals.filter(function (a) { return a.id === id; })[0]; }

/* ---------- Mini-Bestimmer ---------- */
// ohne Angabe: keine Ergebnisse
var none = T.identify({});
assert.strictEqual(none.any, false); assert.deepStrictEqual(none.fit, []); assert.deepStrictEqual(none.maybe, []);
assert.strictEqual(T.identify({ len: null, claws: null, toes: null }).any, false);
assert.strictEqual(T.identify({ len: NaN }).any, false);

// 5 cm, Krallen ja, 4 Zehen: Fuchs passt sicher; Hund (Größe offen) und Katze (Krallen selten) sind möglich; Hufe, Dachs (5 Zehen) und Wolf (zu groß) nicht
var r1 = T.identify({ len: 5, claws: 'yes', toes: 4 });
assert.ok(has(r1.fit, 'fuchs'), 'Fuchs passt');
assert.ok(has(r1.fit, 'feldhase'), 'Feldhase (4-5 Zehen, 5-6 cm, Krallen) passt ebenfalls');
assert.ok(has(r1.maybe, 'hund'), 'Hund möglich');
assert.ok(!has(r1.fit, 'hund'), 'Hund nicht sicher');
assert.ok(has(r1.maybe, 'katze') && !has(r1.fit, 'katze'), 'Katze nur möglich (Krallen selten sichtbar)');
['reh', 'wildschwein', 'dachs', 'wolf', 'marder', 'biber'].forEach(function (id) { assert.ok(!has(r1.fit, id) && !has(r1.maybe, id), id + ' passt nicht zu 5 cm / 4 Zehen / Krallen'); });

// 9 cm, 4 Zehen, Krallen: Wolf passt; Fuchs nicht; Hund möglich
var r2 = T.identify({ len: 9, claws: 'yes', toes: 4 });
assert.ok(has(r2.fit, 'wolf'));
assert.ok(!has(r2.fit, 'fuchs') && !has(r2.maybe, 'fuchs'));
assert.ok(has(r2.maybe, 'hund'));

// 2 Zehen (Hufe), 4,5 cm: Reh und Wildschwein passen, Rothirsch ist möglich (Größe nur "größer als Reh"), keine Krallentiere
var r3 = T.identify({ len: 4.5, toes: 2 });
assert.deepStrictEqual(ids(r3.fit), ['reh', 'wildschwein']);
assert.ok(has(r3.maybe, 'rothirsch'));
assert.strictEqual(r3.fit.length + r3.maybe.length, 3);
// sehr kleiner Abdruck (3 cm) mit 2 Zehen: nur Wildschwein (3 bis 8 cm), Reh liegt mit Spielraum von 1 cm knapp außerhalb (4 - 1 = 3 passt)
assert.ok(has(T.identify({ len: 3, toes: 2 }).fit, 'wildschwein'));
// Krallen "ja" schließt Huftiere aus
var r4 = T.identify({ claws: 'yes', toes: 2 });
assert.strictEqual(r4.fit.length + r4.maybe.length, 0);
// 15 cm: nur der Biber (Hinterpfote 12 bis 17 cm) passt belegt; Tiere ohne belegte Maße bleiben "möglich"
var r5 = T.identify({ len: 15 });
assert.deepStrictEqual(ids(r5.fit), ['biber']);
assert.deepStrictEqual(ids(r5.maybe), ['eichhoernchen', 'hund', 'rothirsch']);
// zwischen den Pfotengrößen des Bibers (9 cm): Biber passt nicht, Wolf und Waschbär (Hinterpfote mit Ferse 9-10 cm) schon
var r6 = T.identify({ len: 9 });
assert.ok(!has(r6.fit, 'biber') && !has(r6.maybe, 'biber'));
assert.ok(has(r6.fit, 'wolf') && has(r6.fit, 'waschbaer'));
// Katze: 3,5 cm, keine Krallen, 4 Zehen
var r7 = T.identify({ len: 3.5, claws: 'no', toes: 4 });
assert.ok(has(r7.fit, 'katze'));
assert.ok(has(r7.maybe, 'hund') && has(r7.maybe, 'fuchs') === false);
// Länge wirkt nur mit Spielraum: Fuchs bei 6 cm (5 + 1) noch ja, bei 6,5 nein
assert.ok(has(T.identify({ len: 6, toes: 4 }).fit, 'fuchs'));
assert.ok(!has(T.identify({ len: 6.5, toes: 4 }).fit, 'fuchs'));
// Eichhörnchen: Zehen 4 oder 5 ohne Maße -> möglich
assert.ok(has(T.identify({ toes: 5 }).fit, 'eichhoernchen'));
// Einzeln gegeben: jedes Tier steht in mindestens einer Liste, wenn nur "Weiß nicht" gewählt wurde (kein Merkmal) -> leer
assert.strictEqual(T.identify({ claws: null }).any, false);

/* ---------- Daten ---------- */
assert.strictEqual(T.animals.length, 13);
var idsAll = T.animals.map(function (a) { return a.id; });
['reh', 'wildschwein', 'rothirsch', 'fuchs', 'feldhase', 'dachs', 'waschbaer', 'wolf', 'marder', 'eichhoernchen', 'biber', 'hund', 'katze'].forEach(function (id) { assert.ok(idsAll.indexOf(id) >= 0, id); });
assert.strictEqual(new Set(idsAll).size, idsAll.length, 'eindeutige Kennungen');

// Maße: genau wie in der Quelle (Wikipedia "Trittsiegel"/"Wolf") – Länge x Breite in cm
var EXPECT = {
  reh: [[4, 5, null]],
  wildschwein: [[3, 8, [2.5, 7.6]]],
  fuchs: [[5, 5, [4.5, 4.5]]],
  feldhase: [[5, 5, [3, 3]], [6, 6, [3.5, 3.5]]],
  dachs: [[5, 5, [5, 5.5]]],
  waschbaer: [[4, 6, [7, 7]], [4, 5, [6, 7]], [9, 10, null]],
  wolf: [[8, 10, [7, 9]]],
  marder: [[3.5, 4, [3, 3]]],
  biber: [[5, 7, [4.5, 4.5]], [12, 17, [10, 10]]],
  katze: [[2.5, 4.5, [2.5, 4.5]]],
  rothirsch: [], eichhoernchen: [], hund: []
};
Object.keys(EXPECT).forEach(function (id) {
  var a = A(id);
  assert.strictEqual(a.sizes.length, EXPECT[id].length, id + ': Anzahl Maße');
  EXPECT[id].forEach(function (e, i) {
    assert.deepStrictEqual(a.sizes[i].len, [e[0], e[1]], id + ': Länge');
    assert.deepStrictEqual(a.sizes[i].wid, e[2], id + ': Breite');
    assert.ok(T.srcIds.indexOf(a.sizes[i].src) >= 0, id + ': Quelle der Maße');
  });
});
// Alle Maße haben eine Quelle; Tiere ohne belegte Maße haben keine erfundenen Zahlen
T.animals.forEach(function (a) {
  assert.ok(a.features && a.features.length >= 1, a.id + ': Merkmale');
  assert.ok(a.name && a.la && a.group && a.shape, a.id + ': Pflichtfelder');
  a.sizes.forEach(function (s) { assert.ok(s.len[0] > 0 && s.len[0] <= s.len[1] && s.len[1] <= 20, a.id + ': Längenbereich'); if (s.wid) assert.ok(s.wid[0] <= s.wid[1]); });
  assert.ok(a.claws === null || ['yes', 'rare', 'no'].indexOf(a.claws) >= 0, a.id + ': Krallen');
  assert.ok(a.toes === null || a.toes.every(function (n) { return [2, 4, 5].indexOf(n) >= 0; }), a.id + ': Zehen');
});
assert.strictEqual(A('rothirsch').sizes.length, 0, 'Rothirsch: keine belegten Maße, keine erfundenen');
// Zahlen in den Texten: keine Maßangaben ohne Beleg (Rothirsch/Hund/Eichhörnchen enthalten keine cm-Werte)
['rothirsch', 'hund', 'eichhoernchen'].forEach(function (id) { assert.ok(!/\d+(,\d+)? ?cm/.test(A(id).features.join(' ')), id + ': keine unbelegten cm-Angaben'); });
// Wolf: Schrittlänge beim Schnüren 1,1-1,4 m, Fuchs etwa 30 cm, Reh 35-45 cm
assert.ok(/1,1 bis 1,4 m/.test(A('wolf').gait)); assert.ok(/30 cm/.test(A('fuchs').gait)); assert.ok(/35 bis 45 cm/.test(A('reh').gait));
// Bereichstext
assert.strictEqual(T.range([4, 5], String), '4–5'); assert.strictEqual(T.range([5, 5], String), '5');

// Jede Tierform hat eine Zeichnung im Skript
var js = fs.readFileSync(path.join(root, 'js', 'tool-tierspuren.js'), 'utf8');
T.animals.forEach(function (a) { assert.ok(new RegExp('\\b' + a.shape + ': function').test(js), a.id + ': Zeichnung ' + a.shape); });

// Sicherheitshinweise nur zu Wolf, Wildschwein, Waschbär; Quellen vorhanden
assert.deepStrictEqual(T.safety.items.map(function (i) { return i.id; }), ['wolf', 'wildschwein', 'waschbaer']);
var urls = {};
T.sources.forEach(function (s) { assert.ok(/^https:\/\//.test(s.url) && !urls[s.url], 'Quelle ' + s.url); urls[s.url] = 1; assert.ok(s.name && s.license && s.note); });
assert.ok(T.sources.some(function (s) { return /dbb-wolf\.de/.test(s.url); }) && T.sources.some(function (s) { return /bfn\.de/.test(s.url); }) && T.sources.some(function (s) { return /jagdverband\.de/.test(s.url); }));
// Wolf-Hund-Tabelle: 4 Zeilen, 3 Spalten
assert.strictEqual(T.compare.rows.length, 4); T.compare.rows.forEach(function (r) { assert.strictEqual(r.length, 3); });

/* ---------- Übersetzungen ---------- */
var flat = [];
T.compare.rows.forEach(function (r) { r.forEach(function (c) { flat.push(c); }); });
require('./lib/tool-i18n-check.js')({
  id: 'tierspuren',
  data: [T.animals.map(function (a) { return { name: a.name, group: a.group, features: a.features, gait: a.gait }; }), T.safety,
    { title: T.compare.title, intro: T.compare.intro, note: T.compare.note }, T.sources.map(function (s) { return { license: s.license, note: s.note }; })],
  dataFields: ['name', 'group', 'features', 'gait', 'title', 'items', 'intro', 'note', 'license'],
  extra: flat.concat(T.compare.cols, ['ja', 'nein', 'selten sichtbar', 'nicht angegeben', '2 (Hufhälften)', '{0} bis {1}', 'z. B. 5']),
  jsIgnore: [], htmlIgnore: []
});
console.log('Tierspuren: alle Tests bestanden');
