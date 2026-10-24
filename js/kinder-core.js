/* Offline-Ark – Kinderbereich: Spiellogik ohne DOM (in Node testbar). */
(function () {
  'use strict';

  function shuffle(arr, rnd) {
    rnd = rnd || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- Memory ---------- */
  /** pairs Paare mit zufälligen Symbolen; jede Karte { id, sym } – zwei Karten mit gleichem sym sind ein Paar. */
  function memoryDeck(pairs, icons, rnd) {
    var syms = shuffle(icons, rnd).slice(0, pairs), cards = [];
    syms.forEach(function (s) { cards.push({ sym: s }, { sym: s }); });
    return shuffle(cards, rnd).map(function (c, i) { return { id: i, sym: c.sym }; });
  }

  /* ---------- Tic-Tac-Toe ---------- */
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  /** 'X' | 'O' | 'draw' | null (Spiel läuft). board: 9 Felder mit 'X', 'O' oder ''. */
  function winner(b) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i];
      if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return b[l[0]];
    }
    return b.every(function (c) { return c; }) ? 'draw' : null;
  }
  function lineMove(b, who) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i], mine = l.filter(function (k) { return b[k] === who; }).length, free = l.filter(function (k) { return !b[k]; });
      if (mine === 2 && free.length === 1) return free[0];
    }
    return -1;
  }
  /** Einfache KI: gewinnt, wenn möglich, blockt, nimmt Mitte/Ecken. mistake = Chance auf zufälligen Zug (macht sie schlagbar). */
  function aiMove(b, me, foe, rnd, mistake) {
    rnd = rnd || Math.random;
    var free = []; b.forEach(function (c, i) { if (!c) free.push(i); });
    if (!free.length) return -1;
    if (rnd() < (mistake || 0)) return free[Math.floor(rnd() * free.length)];
    var m = lineMove(b, me); if (m >= 0) return m;
    m = lineMove(b, foe); if (m >= 0) return m;
    if (!b[4]) return 4;
    var corners = [0, 2, 6, 8].filter(function (k) { return !b[k]; });
    if (corners.length) return corners[Math.floor(rnd() * corners.length)];
    return free[Math.floor(rnd() * free.length)];
  }

  /* ---------- Buchstabenraten ---------- */
  /** Buchstabe vereinheitlichen: Großbuchstaben, Akzente weg; Arabisch: Alef-Formen, Tashkeel, Taa marbuta/Alef maksura vereinheitlicht. */
  function normLetter(ch, lang) {
    ch = String(ch);
    if (lang === 'ar') return ch.replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    var up = ch.toUpperCase();
    if (lang === 'es' && up === 'Ñ') return 'Ñ';
    return up.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function wordLetters(word, lang) { return Array.from(word).map(function (c) { return normLetter(c, lang); }); }
  /** { slots: [Buchstabe|null], wrong, won, lost } – guessed: Liste normalisierter Buchstaben. */
  function hangman(word, guessed, lang, maxWrong) {
    var letters = wordLetters(word, lang), wrong = guessed.filter(function (g) { return letters.indexOf(g) < 0; }).length;
    var slots = letters.map(function (l) { return guessed.indexOf(l) >= 0 ? l : null; });
    var won = slots.every(function (s) { return s !== null; });
    return { slots: slots, wrong: wrong, won: won, lost: !won && wrong >= maxWrong };
  }

  /* ---------- Zahl raten ---------- */
  function numberHint(guess, secret) { return guess === secret ? 'ok' : guess < secret ? 'low' : 'high'; }

  var api = { shuffle: shuffle, memoryDeck: memoryDeck, winner: winner, aiMove: aiMove, normLetter: normLetter, wordLetters: wordLetters, hangman: hangman, numberHint: numberHint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_KINDER_GAMES = api;
})();
