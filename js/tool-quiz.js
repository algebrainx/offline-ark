/* Offline-Ark – Quiz.
 * Feste Fragen stehen in data/quiz-fragen.js (alle in content/*.md belegt). Morse- und
 * Funkalphabet-Fragen werden aus den Tabellen erzeugt (data/morse-table.js, data/funk-alphabet.js).
 * Die Fragenlogik steht oben und ist ohne Browser testbar (module.exports am Ende). */
(function () {
  'use strict';
  var node = typeof window === 'undefined';
  var MT = node ? require('../data/morse-table.js') : window.OA_MORSE;
  var ALPHA = node ? require('../data/funk-alphabet.js') : window.OA_ALPHA;
  var QD = node ? require('../data/quiz-fragen.js') : window.OA_QUIZ;

  var ROUND = 10;                      // Fragen pro Runde
  var MIX = { id: 'mix', name: 'Alles gemischt' };

  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pick(list, rng) { return list[Math.floor(rng() * list.length)]; }

  /** Aus einer Frage mit a[0] = richtig ein spielbares Objekt mit gemischten Antworten machen. */
  function fromStatic(q, rng) {
    var answers = shuffle(q.a.map(function (t, i) { return { t: t, ok: i === 0 }; }), rng);
    return { id: q.id, cat: q.cat, q: q.q, qArgs: null, prompt: null, answers: answers, e: q.e, eRaw: null, link: q.link, raw: false };
  }

  /* ---------- Erzeugte Fragen ---------- */
  var MORSE_CHARS = MT.GROUPS[0][1].concat(MT.GROUPS[2][1]).map(function (p) { return p[0]; });   // A–Z, 0–9
  var LETTERS = ALPHA.filter(function (a) { return a[2]; });                                         // A–Z mit NATO-Wort

  function genMorse(rng, used) {
    var free = MORSE_CHARS.filter(function (c) { return used.indexOf(c) < 0; });
    var ch = pick(free.length ? free : MORSE_CHARS, rng), code = MT.CODE[ch];
    var others = shuffle(MORSE_CHARS.filter(function (c) { return c !== ch; }), rng).slice(0, 3);
    var toChar = rng() < 0.5, q;
    if (toChar) {
      q = { q: 'Welcher Buchstabe oder welche Ziffer gehört zu diesem Morsezeichen?', qArgs: null, prompt: MT.pretty(code),
        answers: [{ t: ch, ok: true }].concat(others.map(function (c) { return { t: c, ok: false }; })) };
    } else {
      q = { q: 'Welches Morsezeichen gehört zu „{0}“?', qArgs: [ch], prompt: null,
        answers: [{ t: MT.pretty(code), ok: true }].concat(others.map(function (c) { return { t: MT.pretty(MT.CODE[c]), ok: false }; })) };
    }
    q.answers = shuffle(q.answers, rng);
    q.id = 'gen-morse-' + ch + (toChar ? 'c' : 'm'); q.cat = 'morse'; q.ch = ch;
    q.e = null; q.eRaw = ch + ' = ' + MT.pretty(code); q.link = 'tools/morse.html'; q.raw = true;
    return q;
  }

  var ALPHA_TYPES = [
    { q: 'Welches Wort steht im deutschen Buchstabieralphabet für {0}?', from: 0, to: 1 },
    { q: 'Für welchen Buchstaben steht „{0}“ im deutschen Buchstabieralphabet?', from: 1, to: 0 },
    { q: 'Wie heißt {0} im NATO-Alphabet?', from: 0, to: 2 },
    { q: 'Für welchen Buchstaben steht „{0}“ im NATO-Alphabet?', from: 2, to: 0 }
  ];
  function genAlpha(rng, used, type) {
    var free = LETTERS.filter(function (a) { return used.indexOf(a[0]) < 0; });
    var row = pick(free.length ? free : LETTERS, rng), t = ALPHA_TYPES[type % 4];
    var others = shuffle(LETTERS.filter(function (a) { return a !== row; }), rng).slice(0, 3);
    var q = { q: t.q, qArgs: [row[t.from]], prompt: null,
      answers: shuffle([{ t: row[t.to], ok: true }].concat(others.map(function (a) { return { t: a[t.to], ok: false }; })), rng) };
    q.id = 'gen-funk-' + row[0] + type % 4; q.cat = 'funk'; q.letter = row[0];
    q.e = null; q.eRaw = row[0] + ' = ' + row[1] + ' · ' + row[2]; q.link = 'tools/funk.html'; q.raw = true;
    return q;
  }

  function staticOf(cat) { return QD.QUESTIONS.filter(function (q) { return q.cat === cat; }); }

  /** Baut eine Runde: catId = Kategorie oder 'mix'. */
  function buildRound(catId, n, rng) {
    n = n || ROUND; rng = rng || Math.random;
    var out = [], used = [];
    function genMorseN(k) { for (var i = 0; i < k; i++) { var q = genMorse(rng, used); used.push(q.ch); out.push(q); } }
    function genAlphaN(k) {
      var types = shuffle([0, 1, 2, 3], rng);
      for (var i = 0; i < k; i++) { var q = genAlpha(rng, used, types[i % 4]); used.push(q.letter); out.push(q); if (i % 4 === 3) types = shuffle([0, 1, 2, 3], rng); }
    }
    if (catId === 'morse') {
      var st = shuffle(staticOf('morse'), rng).slice(0, 2);
      st.forEach(function (q) { out.push(fromStatic(q, rng)); });
      genMorseN(n - st.length);
    } else if (catId === 'funk') {
      genAlphaN(n);
    } else if (catId === 'mix') {
      var pool = QD.QUESTIONS.filter(function (q) { return q.cat !== 'morse'; });
      shuffle(pool, rng).slice(0, n - 4).forEach(function (q) { out.push(fromStatic(q, rng)); });
      genMorseN(2); genAlphaN(2);
    } else {
      shuffle(staticOf(catId), rng).slice(0, n).forEach(function (q) { out.push(fromStatic(q, rng)); });
    }
    return shuffle(out, rng);
  }

  /** Gleiche Fragen noch einmal, Antworten neu gemischt (für „falsche wiederholen“). */
  function retryRound(wrong, rng) {
    rng = rng || Math.random;
    return shuffle(wrong, rng).map(function (q) {
      var c = Object.assign({}, q); c.answers = shuffle(q.answers, rng); return c;
    });
  }

  var api = { ROUND: ROUND, MIX: MIX, buildRound: buildRound, retryRound: retryRound, staticOf: staticOf, genMorse: genMorse, genAlpha: genAlpha, shuffle: shuffle, CATS: QD.CATS, QUESTIONS: QD.QUESTIONS, LINKS: QD.LINKS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (node || !window.OA) return;

  /* ====================================================================
   * Oberfläche
   * ==================================================================== */
  var OA = window.OA;
  var el = {
    home: OA.$('#view-home'), q: OA.$('#view-q'), res: OA.$('#view-res'), cats: OA.$('#cat-list'), mix: OA.$('#btn-mix'),
    prog: OA.$('#q-prog'), bar: OA.$('#q-bar'), qcat: OA.$('#q-cat'), text: OA.$('#q-text'), prompt: OA.$('#q-prompt'),
    ans: OA.$('#q-answers'), fb: OA.$('#q-feedback'), fbHead: OA.$('#fb-head'), fbText: OA.$('#fb-text'), fbLink: OA.$('#fb-link'),
    next: OA.$('#btn-next'), quit: OA.$('#btn-quit'),
    resTitle: OA.$('#res-title'), resNum: OA.$('#res-num'), resMsg: OA.$('#res-msg'), retry: OA.$('#btn-retry'), again: OA.$('#btn-again'), back: OA.$('#btn-back')
  };
  var saved = OA.store.get('quiz', {}) || {};
  var S = { best: saved.best || {}, played: saved.played || 0 };
  var run = null;

  function save() { OA.store.set('quiz', S); }
  function catName(id) { return OA.t(id === 'mix' ? MIX.name : QD.CATS.filter(function (c) { return c.id === id; })[0].name); }
  function linkUrl(path) { return /^wissen\//.test(path) ? OA.genUrl(path) : (OA.root || '') + path; }

  function show(v) {
    el.home.hidden = v !== 'home'; el.q.hidden = v !== 'q'; el.res.hidden = v !== 'res';
    window.scrollTo(0, 0);
  }

  function renderHome() {
    el.cats.innerHTML = QD.CATS.map(function (c) {
      var b = S.best[c.id];
      var sub = (c.id === 'morse' || c.id === 'funk') ? OA.t('Immer neue Fragen') : OA.t('{0} Fragen', [staticOf(c.id).length]);
      var best = b ? OA.t('Bestwert: {0} von {1}', [b.ok, b.n]) : OA.t('Noch nicht gespielt');
      return '<button type="button" class="cat" data-cat="' + c.id + '"><span class="name">' + OA.esc(OA.t(c.name)) + '</span>' +
        '<span class="sub">' + OA.esc(sub) + ' · <span class="ltr" data-notranslate>' + OA.esc(best) + '</span></span></button>';
    }).join('');
  }

  function start(catId, questions) {
    run = { cat: catId, qs: questions || buildRound(catId), i: -1, ok: 0, wrong: [], answered: false };
    nextQuestion();
  }

  function nextQuestion() {
    run.i++;
    if (run.i >= run.qs.length) { finish(); return; }
    var q = run.qs[run.i];
    run.answered = false;
    el.prog.textContent = OA.t('Frage {0} von {1}', [run.i + 1, run.qs.length]);
    el.bar.style.width = (run.i / run.qs.length * 100) + '%';
    el.qcat.textContent = catName(q.cat);
    el.text.textContent = OA.t(q.q, q.qArgs);
    el.prompt.hidden = !q.prompt;
    el.prompt.textContent = q.prompt || '';
    el.ans.innerHTML = q.answers.map(function (a, i) {
      return '<button type="button" class="answer' + (q.raw ? ' ltr' : '') + '" data-i="' + i + '"' + (q.raw ? ' data-notranslate' : '') + '><span class="num ltr" aria-hidden="true">' + (i + 1) + '</span><span>' +
        OA.esc(q.raw ? a.t : OA.t(a.t)) + '</span></button>';
    }).join('');
    el.fb.hidden = true; el.next.hidden = true;
    show('q');
  }

  function choose(i) {
    if (!run || run.answered) return;
    var q = run.qs[run.i], a = q.answers[i];
    if (!a) return;
    run.answered = true;
    if (a.ok) run.ok++; else run.wrong.push(q);
    OA.$$('.answer', el.ans).forEach(function (b, k) {
      b.disabled = true;
      if (q.answers[k].ok) b.classList.add('right'); else if (k === i) b.classList.add('wrong');
    });
    el.fbHead.textContent = OA.t(a.ok ? 'Richtig!' : 'Leider falsch.');
    el.fb.className = 'feedback ' + (a.ok ? 'ok' : 'bad');
    el.fbText.innerHTML = q.e ? OA.esc(OA.t(q.e)) : '<strong class="ltr" data-notranslate>' + OA.esc(q.eRaw) + '</strong>';
    el.fbLink.setAttribute('href', linkUrl(q.link));
    el.fbLink.textContent = OA.t(QD.LINKS[q.link]);
    el.fb.hidden = false;
    el.next.hidden = false;
    el.next.textContent = OA.t(run.i + 1 >= run.qs.length ? 'Ergebnis ansehen' : 'Weiter');
    el.next.focus();
  }

  function finish() {
    var n = run.qs.length, pct = Math.round(100 * run.ok / n);
    var isRetry = !!run.retry;
    var prev = S.best[run.cat], better = !prev || run.ok / n > prev.ok / prev.n;
    if (!isRetry) { S.played++; if (better) S.best[run.cat] = { ok: run.ok, n: n }; save(); }
    el.bar.style.width = '100%';
    el.resTitle.textContent = OA.t(pct >= 90 ? 'Sehr gut!' : (pct >= 60 ? 'Gut gemacht!' : 'Bleib dran!'));
    el.resNum.textContent = run.ok + ' / ' + n;
    el.resMsg.textContent = !isRetry && better && prev ? OA.t('Neuer Bestwert!') : (run.wrong.length ? OA.t('{0} Fragen waren falsch. Wiederhole sie gleich.', [run.wrong.length]) : OA.t('Alles richtig!'));
    el.retry.hidden = run.wrong.length === 0;
    el.again.classList.toggle('primary', run.wrong.length === 0);
    el.retry.classList.toggle('primary', run.wrong.length > 0);
    show('res');
    renderHome();
  }

  el.cats.addEventListener('click', function (e) { var b = e.target.closest('.cat'); if (b) start(b.getAttribute('data-cat')); });
  el.mix.addEventListener('click', function () { start('mix'); });
  el.ans.addEventListener('click', function (e) { var b = e.target.closest('.answer'); if (b) choose(Number(b.getAttribute('data-i'))); });
  el.next.addEventListener('click', function () { if (run && run.answered) nextQuestion(); });
  el.quit.addEventListener('click', function () { run = null; show('home'); });
  el.back.addEventListener('click', function () { run = null; show('home'); });
  el.again.addEventListener('click', function () { var c = run.cat; start(c); });
  el.retry.addEventListener('click', function () { var w = retryRound(run.wrong), c = run.cat; start(c, w); run.retry = true; });
  document.addEventListener('keydown', function (e) {
    if (!run || e.ctrlKey || e.metaKey || e.altKey || el.q.hidden) return;
    if (/^[1-4]$/.test(e.key)) { choose(Number(e.key) - 1); }
  });

  renderHome();
  show('home');
})();
