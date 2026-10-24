/* Test des Quiz: node scripts/test-quiz.js
 * Prüft: genau eine richtige Antwort, keine doppelten Antworten, kurze Erklärungen, gültige Links,
 * erzeugte Morse-/Funk-Fragen, Alphabet-Daten identisch mit js/tool-funk.js und alle Texte in en/es/ar. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var root = path.join(__dirname, '..');
var Q = require('../js/tool-quiz.js');
var QD = require('../data/quiz-fragen.js');
var ALPHA = require('../data/funk-alphabet.js');
var funk = require('../js/tool-funk.js');

// Wörterbuch laden (doppelte Schlüssel in einer Datei sind verboten)
var dict = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'i18n', 'tool-quiz.js'), 'utf8'), {
  OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { assert.ok(!dict[k], 'doppelter Schlüssel: ' + k); dict[k] = o[k]; }); } } }
});
function ph(s) { return (s.match(/\{\d+\}/g) || []).sort().join(','); }
function tr(key, what) {
  var e = dict[key.replace(/\s+/g, ' ').trim()];
  assert.ok(e, 'Übersetzung fehlt (' + what + '): ' + key);
  ['en', 'es', 'ar'].forEach(function (l) {
    assert.ok(typeof e[l] === 'string' && e[l].trim(), l + ' fehlt: ' + key);
    assert.strictEqual(ph(e[l]), ph(key), 'Platzhalter in ' + l + ': ' + key);
    if (l !== 'ar') assert.ok(!/[äöüß]/i.test(e[l]), 'deutsche Reste in ' + l + ': ' + e[l]);
    else assert.ok(!/(?:^|\s)(?:und|oder|der|die|das|nicht)(?:\s|$)/.test(e[l]), 'Deutsch in ar: ' + e[l]);
  });
}
function sentences(s) { return Q.sentences(s).length; }

// Alphabet-Daten identisch mit dem Funk-Spickzettel
assert.deepStrictEqual(ALPHA, funk.ALPHA, 'data/funk-alphabet.js weicht von js/tool-funk.js ab');

/* ---------- Feste Fragen ---------- */
var ids = {}, perCat = {};
QD.QUESTIONS.forEach(function (q) {
  assert.ok(!ids[q.id], 'doppelte Frage-ID ' + q.id); ids[q.id] = 1;
  assert.ok(QD.CATS.some(function (c) { return c.id === q.cat; }), q.id + ': unbekannte Kategorie');
  perCat[q.cat] = (perCat[q.cat] || 0) + 1;
  assert.ok(q.a.length >= 3 && q.a.length <= 4, q.id + ': 3–4 Antworten');
  var lower = q.a.map(function (a) { return a.trim().toLowerCase(); });
  assert.strictEqual(new Set(lower).size, q.a.length, q.id + ': doppelte Antworten');
  assert.ok(q.q.trim() && q.e.trim(), q.id + ': Text fehlt');
  assert.ok(sentences(q.e) <= 2, q.id + ': Erklärung hat mehr als 2 Sätze: ' + q.e);
  assert.ok(fs.existsSync(path.join(root, q.link)), q.id + ': Link existiert nicht: ' + q.link);
  assert.ok(QD.LINKS[q.link], q.id + ': Link-Name fehlt');
  tr(q.q, q.id + ' Frage'); q.a.forEach(function (a) { tr(a, q.id + ' Antwort'); }); tr(q.e, q.id + ' Erklärung');
  // Spielbar: nach dem Mischen genau eine richtige Antwort
  var played = Q.buildRound(q.cat === 'morse' ? 'morse' : q.cat, 10, function () { return 0.5; });
  played.forEach(function (p) { assert.strictEqual(p.answers.filter(function (a) { return a.ok; }).length, 1); });
});
['ersthilfe', 'pflanzen', 'wasser', 'strom'].forEach(function (c) { assert.ok(perCat[c] >= 12 && perCat[c] <= 20, c + ': ' + perCat[c] + ' Fragen (erwartet 12–20)'); });
Object.keys(QD.LINKS).forEach(function (l) { assert.ok(fs.existsSync(path.join(root, l)), 'Link fehlt: ' + l); tr(QD.LINKS[l], 'Link'); });
QD.CATS.forEach(function (c) { tr(c.name, 'Kategorie'); });
tr(Q.MIX.name, 'Mix');

/* ---------- Erzeugte Fragen (viele zufällige Runden) ---------- */
var seed = 12345; function rng() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
var templates = {}, genChars = {}, genLetters = {};
['morse', 'funk', 'mix', 'bilder', 'ersthilfe', 'wasser', 'strom', 'pflanzen'].forEach(function (cat) {
  for (var r = 0; r < 300; r++) {
    var round = Q.buildRound(cat, 10, rng), seen = {};
    assert.strictEqual(round.length, 10, cat + ': Rundenlänge');
    round.forEach(function (q) {
      assert.ok(!seen[q.id], cat + ': doppelte Frage in einer Runde ' + q.id); seen[q.id] = 1;
      assert.strictEqual(q.answers.length >= 3 && q.answers.length <= 4, true);
      assert.strictEqual(q.answers.filter(function (a) { return a.ok; }).length, 1, q.id + ': genau eine richtige Antwort');
      var texts = q.answers.map(function (a) { return a.t; });
      assert.strictEqual(new Set(texts).size, texts.length, q.id + ': doppelte Antworten ' + texts.join('|'));
      if (q.raw) {
        templates[q.q] = 1;
        assert.strictEqual((q.q.match(/\{0\}/g) || []).length, q.qArgs ? 1 : 0, q.id + ': Platzhalter');
        assert.ok(q.eRaw, q.id + ': Lösung');
        if (q.ch) genChars[q.ch] = 1; if (q.letter) genLetters[q.letter] = 1;
      }
    });
  }
});
Object.keys(templates).forEach(function (t) { tr(t, 'Vorlage'); });
assert.strictEqual(Object.keys(templates).length, 6, 'sechs Vorlagen für erzeugte Fragen');
assert.ok(Object.keys(genChars).length >= 12 && Object.keys(genLetters).length >= 12, 'zu wenige verschiedene erzeugte Fragen');
assert.strictEqual(Object.keys(genChars).length, 36); assert.strictEqual(Object.keys(genLetters).length, 26);

// Richtige Lösung der erzeugten Morse-Fragen stimmt mit der Tabelle überein
var MT = require('../data/morse-table.js');
for (var i = 0; i < 200; i++) {
  var q = Q.genMorse(rng, []);
  var ok = q.answers.filter(function (a) { return a.ok; })[0].t;
  if (q.prompt) assert.strictEqual(MT.CODE[ok], q.prompt.replace(/—/g, '-').replace(/•/g, '.'));
  else assert.strictEqual(ok, MT.pretty(MT.CODE[q.qArgs[0]]));
}

// Oberflächentexte aus dem Code und der Seite müssen im Wörterbuch stehen
var js = fs.readFileSync(path.join(root, 'js', 'tool-quiz.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'tools', 'quiz.html'), 'utf8');
var literal = /OA\.t\(\s*(?:[a-zA-Z.+ !&|()?]*\?\s*)?'([^']{2,})'(?:\s*:\s*(?:\([^)]*\?\s*)?'([^']{2,})')?/g, m, n = 0;
while ((m = literal.exec(js))) { [m[1], m[2]].forEach(function (k) { if (k) { tr(k, 'tool-quiz.js'); n++; } }); }
html.replace(/<(?:button|p|h1|h2|span|a|div|strong)[^>]*>([^<]{3,})</g, function (x, t) {
  t = t.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); if (/[A-Za-zÄÖÜäöüß]{3,}/.test(t) && t !== 'Quiz') { tr(t, 'quiz.html'); n++; }
});

/* ---------- Bildfragen: Pflanzen & Pilze erkennen ---------- */
var PD = require('../data/pflanzen.js');
var ITEM = {}; PD.items.forEach(function (it) { ITEM[it.id] = it; });
PD.items.forEach(function (it) {
  assert.ok(fs.existsSync(path.join(root, 'library', 'images', 'pflanzen', it.id + '.jpg')), it.id + ': Bild fehlt');
  var c = PD.credits[it.id];
  assert.ok(c && c.by && c.lic && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(c.url), it.id + ': Namensnennung unvollständig');
});
var imgKeys = Q.imageKeys();
imgKeys.direct.forEach(function (k) { tr(k, 'Bild: Name/Status'); });
imgKeys.sent.forEach(function (e) {
  tr(e.key, 'Bild: Text'); assert.ok(sentences(e.key) <= 2, 'Bildtext hat mehr als 2 Sätze: ' + e.key);
});
['Foto einer Pflanze', 'Foto eines Pilzes', 'Foto: {0} · {1}', 'ggf. verkleinert', 'nur gekocht', 'Pflanzen & Pilze erkennen', 'Mehr dazu: Pflanzen & Pilze',
  'Welche Pflanze ist das?', 'Welcher Pilz ist das?', 'Ist das essbar oder giftig?', '{0} und {1}: Was unterscheidet die beiden?',
  'Quiz ersetzt keine Bestimmung – nur essen, wenn 100 % sicher bestimmt.', 'Pflanzen & Pilze ansehen'].forEach(function (k) { tr(k, 'Bild: Oberfläche'); });
assert.strictEqual(QD.LINKS['tools/pflanzen.html'], 'Mehr dazu: Pflanzen & Pilze');
assert.ok(QD.CATS.some(function (c) { return c.id === 'bilder'; }), 'Kategorie bilder fehlt');
Object.keys(Q.SKIP_DIFF).forEach(function (id) {
  var p = PD.pairs.filter(function (x) { return x.id === id; })[0];
  assert.ok(p, 'SKIP_DIFF: Paar unbekannt ' + id); Q.SKIP_DIFF[id].forEach(function (k) { assert.ok(p.diff[k], 'SKIP_DIFF: Index fehlt ' + id + ':' + k); });
});
assert.deepStrictEqual(Object.keys(Q.LAB).sort(), ['avoid', 'cooked', 'edible', 'inedible', 'raw', 'toxic']);

var kinds = {}, imgSeen = 0, allLab = Object.keys(Q.LAB).map(function (k) { return Q.LAB[k]; });
['bilder', 'mix'].forEach(function (cat) {
  for (var r = 0; r < 400; r++) {
    var round = Q.buildRound(cat, 10, rng), photos = {};
    round.filter(function (q) { return q.cat === 'bilder'; }).forEach(function (q) {
      imgSeen++;
      (kinds[q.kind] = kinds[q.kind] || {})[q.id] = 1;
      assert.ok(q.img && q.img.length >= 1 && q.img.length <= 2, q.id + ': Bilder');
      q.img.forEach(function (id) {
        assert.ok(fs.existsSync(path.join(root, Q.IMG_DIR, id + '.jpg')), q.id + ': Bild fehlt ' + id);
        assert.ok(PD.credits[id].by && PD.credits[id].lic && PD.credits[id].url, q.id + ': Namensnennung fehlt');
        if (cat === 'bilder') { assert.ok(!photos[id], q.id + ': Foto doppelt in einer Runde ' + id); photos[id] = 1; }
      });
      assert.strictEqual(q.link, 'tools/pflanzen.html');
      assert.ok(q.answers.length >= 3 && q.answers.length <= 4, q.id + ': Antwortenzahl');
      assert.strictEqual(q.answers.filter(function (a) { return a.ok; }).length, 1, q.id + ': genau eine richtige Antwort');
      var ts = q.answers.map(function (a) { return a.t; });
      assert.strictEqual(new Set(ts).size, ts.length, q.id + ': doppelte Antworten');
      tr(q.q, q.id + ' Frage'); ts.forEach(function (t) { tr(t, q.id + ' Antwort'); }); tr(q.e, q.id + ' Erklärung');
      assert.ok(sentences(q.e) <= 2, q.id + ': Erklärung hat mehr als 2 Sätze');
      var right = q.answers.filter(function (a) { return a.ok; })[0].t;
      if (q.kind === 'id') {
        assert.strictEqual(right, ITEM[q.item].name);
        ts.forEach(function (t) { assert.strictEqual(PD.items.filter(function (i) { return i.name === t; })[0].type, ITEM[q.item].type, q.id + ': Art gemischt'); });
        assert.deepStrictEqual(q.reveal, [q.item]);
      } else if (q.kind === 'status') {
        ts.forEach(function (t) { assert.ok(allLab.indexOf(t) >= 0, q.id + ': unbekannte Einstufung ' + t); });
        var it = ITEM[q.item], expect = it.st === 'edible' && it.cond === 'nur gekocht' ? Q.LAB.cooked : Q.LAB[it.st];
        assert.strictEqual(right, expect, q.id + ': falsche Einstufung');
        assert.notStrictEqual(it.st, 'avoid', 'Status "nicht empfohlen" wird nicht abgefragt (mehrdeutig)');
        if (it.st !== 'edible' || it.cond) assert.ok(ts.indexOf(Q.LAB.edible) < 0 || it.st !== 'edible' || it.cond, 'essbar darf nicht neben nur gekocht stehen');
      } else if (q.kind === 'diff') {
        var pair = PD.pairs.filter(function (p) { return p.id === q.pair; })[0], y = q.items[1];
        assert.ok(pair.ok.indexOf(q.items[0]) >= 0 && pair.bad.indexOf(y) >= 0, q.id + ': Paar passt nicht');
        assert.ok(Q.diffStatements(pair, y).some(function (s) { return s.text === right; }), q.id + ': richtige Aussage gehört nicht zum Paar');
        ts.forEach(function (t) {
          if (t === right) return;
          assert.ok(t.indexOf(Q.STEM[y]) < 0, q.id + ': falsche Antwort nennt den Doppelgänger: ' + t);
          assert.ok(!PD.pairs.some(function (p) { return (p.ok.indexOf(q.items[0]) >= 0 || p.bad.indexOf(y) >= 0) && p.diff.some(function (d) { return Q.expl([d], 2) === t; }); }), q.id + ': falsche Antwort stammt aus einem verwandten Paar');
        });
        tr('{0} und {1}: Was unterscheidet die beiden?', 'Vorlage'); q.qArgs.forEach(function (a) { tr(a, 'Name'); });
      } else assert.fail('unbekannte Art ' + q.kind);
    });
  }
});
['id', 'status', 'diff'].forEach(function (k) { assert.ok(Object.keys(kinds[k] || {}).length >= 12, 'Bildfragen "' + k + '": weniger als 12 verschiedene (' + Object.keys(kinds[k] || {}).length + ')'); });
assert.ok(imgSeen > 0);
// Statische HTML-Seite: Pflichthinweis und Link auf die Pflanzen-Seite
assert.ok(/Quiz ersetzt keine Bestimmung/.test(html) && /href="pflanzen\.html"/.test(html), 'Pflichthinweis fehlt in quiz.html');
assert.ok(/<script src="\.\.\/data\/pflanzen\.js">/.test(html), 'data/pflanzen.js nicht eingebunden');
var kc = Object.keys(kinds).map(function (k) { return k + ': ' + Object.keys(kinds[k]).length; }).join(', ');

console.log('Quiz: alle Tests bestanden (' + QD.QUESTIONS.length + ' feste Fragen, Bildfragen verschieden: ' + kc + ', ' + Object.keys(dict).length + ' Übersetzungs-Schlüssel, ' + n + ' Oberflächentexte)');
