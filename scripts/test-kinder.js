/* Test der Kinder-Spiellogik und Inhalte: node scripts/test-kinder.js */
'use strict';
var assert = require('assert');
var G = require('../js/kinder-core.js');
var K = require('../data/kinder.js');

// Zufall mit festem Startwert, damit Tests wiederholbar sind
function seeded(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// Memory
[3, 6, 10].forEach(function (n) {
  var d = G.memoryDeck(n, K.memoryIcons, seeded(7)), cnt = {};
  assert.strictEqual(d.length, n * 2);
  d.forEach(function (c) { cnt[c.sym] = (cnt[c.sym] || 0) + 1; });
  Object.keys(cnt).forEach(function (k) { assert.strictEqual(cnt[k], 2); });
  assert.strictEqual(Object.keys(cnt).length, n);
});
assert.ok(K.memoryIcons.length >= 10);

// Tic-Tac-Toe
assert.strictEqual(G.winner(['X', 'X', 'X', '', '', '', '', '', '']), 'X');
assert.strictEqual(G.winner(['', 'O', '', '', 'O', '', '', 'O', '']), 'O');
assert.strictEqual(G.winner(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']), 'draw');
assert.strictEqual(G.winner(['X', '', '', '', '', '', '', '', '']), null);
assert.strictEqual(G.aiMove(['O', 'O', '', 'X', 'X', '', '', '', ''], 'O', 'X', seeded(1), 0), 2);       // gewinnt
assert.strictEqual(G.aiMove(['X', 'X', '', '', 'O', '', '', '', ''], 'O', 'X', seeded(1), 0), 2);       // blockt
assert.strictEqual(G.aiMove(['X', '', '', '', '', '', '', '', ''], 'O', 'X', seeded(1), 0), 4);         // Mitte
assert.ok([0, 2, 6, 8].indexOf(G.aiMove(['', '', '', '', 'X', '', '', '', ''], 'O', 'X', seeded(3), 0)) >= 0);
assert.strictEqual(G.aiMove(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'], 'O', 'X'), -1);
// Computer verliert nie, wenn er fehlerfrei spielt (Zufallsspieler gegen KI, viele Partien)
var lost = 0;
for (var g = 0; g < 300; g++) {
  var r = seeded(g + 11), b = Array(9).fill(''), turn = 'X';
  while (!G.winner(b)) {
    var free = []; b.forEach(function (c, i) { if (!c) free.push(i); });
    var mv = turn === 'X' ? free[Math.floor(r() * free.length)] : G.aiMove(b, 'O', 'X', r, 0);
    b[mv] = turn; turn = turn === 'X' ? 'O' : 'X';
  }
  if (G.winner(b) === 'X') lost++;
}
assert.ok(lost < 30, 'KI verliert zu oft gegen Zufall: ' + lost);

// Buchstabenraten
assert.strictEqual(G.normLetter('ä', 'de'), 'A'); assert.strictEqual(G.normLetter('é', 'es'), 'E'); assert.strictEqual(G.normLetter('ñ', 'es'), 'Ñ');
assert.strictEqual(G.normLetter('أ', 'ar'), 'ا'); assert.strictEqual(G.normLetter('ة', 'ar'), 'ه');
var h = G.hangman('KATZE', ['K', 'A', 'X'], 'de', 6);
assert.deepStrictEqual(h.slots, ['K', 'A', null, null, null]); assert.strictEqual(h.wrong, 1); assert.ok(!h.won && !h.lost);
assert.ok(G.hangman('KATZE', ['K', 'A', 'T', 'Z', 'E'], 'de', 6).won);
assert.ok(G.hangman('KATZE', ['B', 'C', 'D', 'F', 'G', 'H'], 'de', 6).lost);
assert.ok(G.hangman('شمس', ['ش', 'م', 'س'], 'ar', 6).won);
// Wortlisten: jedes Wort nur aus Tastaturbuchstaben der Sprache
['de', 'en', 'es', 'ar'].forEach(function (l) {
  assert.ok(K.words[l].length >= 15, l);
  K.words[l].forEach(function (w) {
    assert.ok(Array.from(w).length >= 3 && Array.from(w).length <= 8, l + ' ' + w);
    G.wordLetters(w, l).forEach(function (c) { assert.ok(K.keyboard[l].indexOf(c) >= 0, l + ' Buchstabe fehlt: ' + c + ' in ' + w); });
  });
  assert.strictEqual(new Set(K.words[l]).size, K.words[l].length, 'doppelte Wörter ' + l);
});

// Zahl raten
assert.strictEqual(G.numberHint(3, 7), 'low'); assert.strictEqual(G.numberHint(9, 7), 'high'); assert.strictEqual(G.numberHint(7, 7), 'ok');

// Inhalte
K.cards.forEach(function (c) { assert.ok(c.id && c.icon && c.title && c.blocks.length, c.id); });
K.roleplay.forEach(function (q) { assert.strictEqual(q.options.length, 3); assert.ok(q.a >= 0 && q.a < 3 && q.good && q.hint); });
assert.strictEqual(K.paint.length, 6);
assert.strictEqual(G.shuffle([1, 2, 3, 4, 5], seeded(2)).slice().sort().join(''), '12345');
console.log('Kinder: alle Tests bestanden');
