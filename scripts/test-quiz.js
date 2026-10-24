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
function sentences(s) { return (s.match(/[^.!?]+[.!?]+(\s|$)/g) || [s]).length; }

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
['morse', 'funk', 'mix', 'ersthilfe', 'wasser', 'strom', 'pflanzen'].forEach(function (cat) {
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
html.replace(/<(?:button|p|h1|h2|span|a|div)[^>]*>([^<]{3,})</g, function (x, t) {
  t = t.replace(/\s+/g, ' ').trim(); if (/[A-Za-zÄÖÜäöüß]{3,}/.test(t) && t !== 'Quiz') { tr(t, 'quiz.html'); n++; }
});

console.log('Quiz: alle Tests bestanden (' + QD.QUESTIONS.length + ' feste Fragen, ' + Object.keys(dict).length + ' Übersetzungs-Schlüssel, ' + n + ' Oberflächentexte)');
