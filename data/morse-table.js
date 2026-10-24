/* Offline-Ark – Morse-Tabelle für Trainer und Quiz (window.OA_MORSE).
 * Die Daten sind identisch mit denen in js/tool-morse.js (scripts/test-quiz.js prüft das). */
(function (root) {
  'use strict';

  var GROUPS = [
    ['Buchstaben', [
      ['A', '.-'], ['B', '-...'], ['C', '-.-.'], ['D', '-..'], ['E', '.'], ['F', '..-.'], ['G', '--.'], ['H', '....'],
      ['I', '..'], ['J', '.---'], ['K', '-.-'], ['L', '.-..'], ['M', '--'], ['N', '-.'], ['O', '---'], ['P', '.--.'],
      ['Q', '--.-'], ['R', '.-.'], ['S', '...'], ['T', '-'], ['U', '..-'], ['V', '...-'], ['W', '.--'], ['X', '-..-'],
      ['Y', '-.--'], ['Z', '--..']]],
    ['Umlaute', [['Ä', '.-.-'], ['Ö', '---.'], ['Ü', '..--'], ['ß', '...--..']]],
    ['Ziffern', [
      ['0', '-----'], ['1', '.----'], ['2', '..---'], ['3', '...--'], ['4', '....-'],
      ['5', '.....'], ['6', '-....'], ['7', '--...'], ['8', '---..'], ['9', '----.']]],
    ['Satzzeichen', [
      ['.', '.-.-.-'], [',', '--..--'], ['?', '..--..'], ['!', '-.-.--'], ['\'', '.----.'], ['"', '.-..-.'],
      [':', '---...'], [';', '-.-.-.'], ['-', '-....-'], ['/', '-..-.'], ['(', '-.--.'], [')', '-.--.-'],
      ['=', '-...-'], ['+', '.-.-.'], ['@', '.--.-.'], ['&', '.-...'], ['_', '..--.-'], ['$', '...-..-']]]
  ];

  // Arabisches Morsealphabet (Wikipedia „Morse code for non-Latin alphabets“)
  var ARABIC = [
    ['ا', '.-'], ['ب', '-...'], ['ت', '-'], ['ث', '-.-.'], ['ج', '.---'], ['ح', '....'], ['خ', '---'],
    ['د', '-..'], ['ذ', '--..'], ['ر', '.-.'], ['ز', '---.'], ['س', '...'], ['ش', '----'], ['ص', '-..-'],
    ['ض', '...-'], ['ط', '..-'], ['ظ', '-.--'], ['ع', '.-.-'], ['غ', '--.'], ['ف', '..-.'], ['ق', '--.-'],
    ['ك', '-.-'], ['ل', '.-..'], ['م', '--'], ['ن', '-.'], ['ه', '..-..'], ['و', '.--'], ['ي', '..'], ['ء', '.']
  ];

  var CODE = {}, CHAR = {};
  GROUPS.forEach(function (g) { g[1].forEach(function (p) { CODE[p[0]] = p[1]; CHAR[p[1]] = p[0]; }); });

  // Reihenfolge nach der Koch-Methode (wie in gängigen Lernprogrammen); nur Zeichen aus der Tabelle oben
  var KOCH = 'KMRSUAPTLOWI.NJEF0Y,VG5/Q9ZH38B?427C1D6X'.split('');

  /** Punkt-Strich-Darstellung zum Anzeigen: • und —. */
  function pretty(code) { return code.replace(/-/g, '—').replace(/\./g, '•'); }

  /** Zeitplan in ms. words = [[code, code …], …]. cu = Zeichen-Einheit in ms, gu = Pausen-Einheit (Farnsworth) in ms. */
  function timeline(words, cu, gu) {
    var segs = [], t = 0;
    function add(on, ms) { segs.push({ on: on, start: t, end: t + ms }); t += ms; }
    words.forEach(function (w, wi) {
      if (wi > 0) add(false, 7 * gu);
      w.forEach(function (code, ci) {
        if (ci > 0) add(false, 3 * gu);
        code.split('').forEach(function (el, ei) {
          if (ei > 0) add(false, cu);
          add(true, (el === '.' ? 1 : 3) * cu);
        });
      });
    });
    return { segs: segs, total: t };
  }

  /** Farnsworth: Zeichen mit charWpm, Gesamttempo effWpm (<= charWpm). Liefert Einheiten in ms. */
  function farnsworth(charWpm, effWpm) {
    var cu = 1200 / charWpm;                       // Einheit eines Punkts
    var eff = Math.min(effWpm, charWpm);
    // Ein Wort „PARIS“ hat 31 Einheiten Zeichen und 19 Einheiten Pause (4 × 3 + 7)
    var gu = (60000 / eff - 31 * cu) / 19;
    return { cu: cu, gu: Math.max(gu, cu) };
  }

  var api = {
    GROUPS: GROUPS, ARABIC: ARABIC, CODE: CODE, CHAR: CHAR, KOCH: KOCH, SOS_RUN: '...---...',
    pretty: pretty, timeline: timeline, farnsworth: farnsworth
  };
  root.OA_MORSE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
