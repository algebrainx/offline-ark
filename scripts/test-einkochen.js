/* Test der Rechenformeln fÃ¼r "Haltbar machen": node scripts/test-einkochen.js */
'use strict';
var assert = require('assert');
var C = require('../js/einkochen-core.js');
var D = require('../data/einkochen.js');

// Gelierzucker nach BZfE: 1 kg FrÃ¼chte -> 1 kg bei 1:1, 500 g bei 2:1, 333 g bei 3:1
assert.strictEqual(C.jamSugar(1000, 1), 1000);
assert.strictEqual(C.jamSugar(1000, 2), 500);
assert.strictEqual(C.jamSugar(500, 2), 250);                       // Beispiel aus dem BZfE-Text
assert.ok(Math.abs(C.jamSugar(1500, 3) - 500) < 1e-9);             // Beispiel aus dem BZfE-Text: 1,5 kg FrÃ¼chte, 3:1 -> 500 g
assert.ok(isNaN(C.jamSugar(0, 2)) && isNaN(C.jamSugar(100, 0)) && isNaN(C.jamSugar(-5, 1)));

// Salz: 2 % von 1 kg Kohl = 20 g, 2,5 % von 800 g = 20 g, 3 % von 1,2 kg = 36 g
assert.strictEqual(C.saltGrams(1000, 2), 20);
assert.strictEqual(C.saltGrams(800, 2.5), 20);
assert.ok(Math.abs(C.saltGrams(1200, 3) - 36) < 1e-9);
assert.ok(isNaN(C.saltGrams(0, 2)));
assert.deepStrictEqual(D.saltPercents, [2, 2.5, 3]);

// Zweite Erhitzung: ein bis zwei Tage spÃ¤ter
var start = C.localMs('2026-07-10', '18:30');
assert.ok(isFinite(start));
var w = C.secondHeat(start);
assert.strictEqual(w.to - w.from, 24 * 3600000);
assert.strictEqual(w.from - start, 24 * 3600000);
var f = new Date(w.from), t = new Date(w.to);
assert.strictEqual(f.getDate(), 11); assert.strictEqual(t.getDate(), 12);
assert.strictEqual(f.getHours(), 18); assert.strictEqual(f.getMinutes(), 30);
assert.ok(isNaN(C.localMs('', '10:00')) && isNaN(C.localMs('2026-07-10', '')));
assert.strictEqual(C.secondHeat(NaN), null);

// Jede Quelle hat Name, URL und Lizenz
D.sources.forEach(function (s) { assert.ok(s.name && /^https:\/\//.test(s.url) && s.license && s.note); });

console.log('einkochen: alle Tests bestanden');

