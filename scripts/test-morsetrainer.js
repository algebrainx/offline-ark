/* Test der Morse-Daten und der Trainer-Logik: node scripts/test-morsetrainer.js */
'use strict';
var assert = require('assert');
var MT = require('../data/morse-table.js');
var T = require('../js/tool-morsetrainer.js');
var tool = require('../js/tool-morse.js');

// Die Tabelle ist identisch mit js/tool-morse.js
assert.deepStrictEqual(MT.GROUPS, tool.GROUPS, 'Morse-Tabelle weicht von tool-morse.js ab');
assert.deepStrictEqual(MT.ARABIC, tool.ARABIC, 'Arabische Tabelle weicht ab');
// Rückrichtung: jede Zeichenfolge eindeutig
var seen = {};
MT.GROUPS.forEach(function (g) { g[1].forEach(function (p) { assert.ok(!seen[p[1]], 'doppelter Code ' + p[1]); seen[p[1]] = 1; }); });
assert.strictEqual(MT.CODE.S, '...'); assert.strictEqual(MT.CODE.O, '---');
assert.strictEqual(MT.pretty('.-'), '•—');
// Koch-Reihenfolge: alle Zeichen existieren, keine Doppelten
assert.strictEqual(MT.KOCH.length, 40);
assert.strictEqual(new Set(MT.KOCH).size, 40);
MT.KOCH.forEach(function (c) { assert.ok(MT.CODE[c], 'Zeichen fehlt: ' + c); });

// Farnsworth: bei gleichem Tempo gleiche Einheit; langsamer = längere Pausen; Wortlänge stimmt
var f = MT.farnsworth(20, 20); assert.ok(Math.abs(f.cu - 60) < 1e-9 && Math.abs(f.gu - 60) < 1e-6);
f = MT.farnsworth(20, 10);
assert.ok(f.gu > f.cu);
// „PARIS“ dauert bei 10 WPM Gesamttempo genau 6 s (31 Zeichen-Einheiten + 19 Pausen-Einheiten)
assert.ok(Math.abs(31 * f.cu + 19 * f.gu - 6000) < 1e-6);
var tl = MT.timeline([['.-', '.']], 60, 60);          // A E: 1+1+3, Pause 3, 1
assert.deepStrictEqual(tl.segs.map(function (s) { return s.end - s.start; }), [60, 60, 180, 180, 60]);
assert.strictEqual(MT.timeline([['.'], ['.']], 60, 100).total, 60 + 700 + 60);

// Stufen
assert.deepStrictEqual(T.levelChars(1), ['K', 'M']);
assert.strictEqual(T.levelChars(5).length, 6);
assert.strictEqual(T.levelChars(999).length, 40);
assert.strictEqual(T.LEVELS, 39);

// Zeichenauswahl: nie zweimal dasselbe, schwache Zeichen häufiger
var seed = 7; function rng() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
var chars = T.levelChars(4), stats = { K: { ok: 1, total: 20 }, M: { ok: 20, total: 20 } }, last = null, cnt = {};
for (var i = 0; i < 3000; i++) { var c = T.pickChar(chars, stats, rng, last); assert.notStrictEqual(c, last); cnt[c] = (cnt[c] || 0) + 1; last = c; }
assert.ok(cnt.K > cnt.M, 'schwaches Zeichen nicht bevorzugt');
Object.keys(cnt).forEach(function (k) { assert.ok(chars.indexOf(k) >= 0); });

// Tempo-Regeln
var r = T.nextTempo({ ok: 18, total: 20, eff: 10, charWpm: 20, level: 1, mode: 'learn' });
assert.strictEqual(r.eff, 12); assert.strictEqual(r.change, 'tempo');
r = T.nextTempo({ ok: 17, total: 20, eff: 10, charWpm: 20, level: 1, mode: 'learn' });
assert.strictEqual(r.eff, 10); assert.strictEqual(r.change, null);          // 85 % reicht nicht
r = T.nextTempo({ ok: 19, total: 20, eff: 20, charWpm: 20, level: 3, mode: 'learn' });
assert.strictEqual(r.level, 4); assert.strictEqual(r.change, 'level'); assert.ok(r.eff < 20);
r = T.nextTempo({ ok: 8, total: 8, eff: 20, charWpm: 20, level: 3, mode: 'words' });
assert.strictEqual(r.level, 3); assert.strictEqual(r.change, 'max');

// Wörter bestehen nur aus Zeichen der Tabelle; SOS als Notzeichen ohne Pausen
T.WORDS.concat(T.SOS_WORDS).forEach(function (w) { T.wordCodes(w).forEach(function (code) { assert.ok(code, 'Wort nicht kodierbar: ' + w); }); });
assert.deepStrictEqual(T.wordCodes('SOS', true), ['...---...']);
assert.deepStrictEqual(T.wordCodes('SOS', false), ['...', '---', '...']);
assert.strictEqual(T.sample(T.WORDS, 8, rng).length, 8);
assert.strictEqual(new Set(T.sample(T.WORDS, 8, rng)).size, 8);

console.log('Morse-Trainer: alle Tests bestanden');
