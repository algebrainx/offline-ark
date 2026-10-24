/* Offline-Ark – Morse-Trainer (Koch-Methode mit Farnsworth-Pausen).
 * Zeichen werden schnell gesendet (18 bis 22 WPM), die Pausen sind zu Beginn länger
 * (Gesamttempo ab 10 WPM). Ab 90 % Treffern in einer Runde steigt das Tempo, am Ende
 * die Stufe. Die Lernlogik steht oben und ist ohne Browser testbar (module.exports). */
(function () {
  'use strict';
  var MT = (typeof window !== 'undefined' && window.OA_MORSE) || (typeof require === 'function' ? require('../data/morse-table.js') : null);

  var START_EFF = 10;          // Gesamttempo (WPM) am Anfang: lange Pausen
  var EFF_STEP = 2;
  var CW_MIN = 18, CW_MAX = 22, CW_DEFAULT = 20;
  var LEVELS = MT.KOCH.length - 1;                  // Stufe 1 = 2 Zeichen, Stufe n = n + 1 Zeichen
  var ROUND = { learn: 20, words: 8, sos: 8 };
  // Wörter nur aus Buchstaben und Ziffern; Rufzeichen sind frei erfunden Beispiele
  var WORDS = ['SOS', 'NOT', 'HELP', 'HILFE', 'ARZT', 'FEUER', 'WASSER', 'STROM', 'RADIO', 'NOTRUF', 'ERSTE', 'KARTE',
    'LICHT', 'DL1ABC', 'DK5XY', 'DB2ZZ', 'OE3ABC', 'HB9XYZ', 'PMR446', 'CB27'];
  var SOS_WORDS = ['SOS', 'HILFE', 'HELP', 'NOT', 'FEUER', 'ARZT'];

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function levelChars(level) { return MT.KOCH.slice(0, clamp(Math.round(level), 1, LEVELS) + 1); }

  /** Trefferquote eines Zeichens (geglättet, unbekannt = 0,5). */
  function acc(stats, c) { var s = stats && stats[c]; return s ? (s.ok + 1) / (s.total + 2) : 0.5; }

  /** Zufälliges Zeichen: schwache Zeichen und das neueste Zeichen kommen öfter dran, nie dasselbe zweimal hintereinander. */
  function pickChar(chars, stats, rng, last) {
    var weights = chars.map(function (c, i) {
      var w = 1 + 4 * (1 - acc(stats, c));
      if (i === chars.length - 1 && chars.length > 2) w *= 1.8;
      if (c === last && chars.length > 1) w = 0;
      return w;
    });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0), r = rng() * sum;
    for (var i = 0; i < chars.length; i++) { r -= weights[i]; if (r < 0) return chars[i]; }
    return chars[chars.length - 1];
  }

  /** Neues Tempo/neue Stufe nach einer Runde. */
  function nextTempo(p) {
    var out = { eff: p.eff, level: p.level, change: null };
    if (p.total > 0 && p.ok / p.total >= 0.9) {
      if (p.eff < p.charWpm) { out.eff = Math.min(p.charWpm, p.eff + EFF_STEP); out.change = 'tempo'; }
      else if (p.mode === 'learn' && p.level < LEVELS) { out.level = p.level + 1; out.eff = Math.min(p.charWpm, START_EFF + 2); out.change = 'level'; }
      else out.change = 'max';
    }
    return out;
  }

  /** Mischt eine Liste (Fisher-Yates) und liefert die ersten n Einträge. */
  function sample(list, n, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.slice(0, n);
  }

  /** Morsecodes eines Wortes; „SOS“ wird wie das Notzeichen ohne Pausen gesendet. */
  function wordCodes(word, asSignal) {
    if (asSignal && word === 'SOS') return [MT.SOS_RUN];
    return word.split('').map(function (c) { return MT.CODE[c]; });
  }

  var api = {
    START_EFF: START_EFF, CW_MIN: CW_MIN, CW_MAX: CW_MAX, CW_DEFAULT: CW_DEFAULT, LEVELS: LEVELS, ROUND: ROUND,
    WORDS: WORDS, SOS_WORDS: SOS_WORDS, levelChars: levelChars, acc: acc, pickChar: pickChar, nextTempo: nextTempo,
    sample: sample, wordCodes: wordCodes
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined' || typeof window === 'undefined' || !window.OA) return;

  /* ====================================================================
   * Oberfläche
   * ==================================================================== */
  var OA = window.OA;
  var el = {
    modes: OA.$('#modes'), setup: OA.$('#view-setup'), play: OA.$('#view-play'), result: OA.$('#view-result'),
    level: OA.$('#level'), levelBox: OA.$('#level-box'), chars: OA.$('#level-chars'), tempoInfo: OA.$('#tempo-info'),
    start: OA.$('#btn-start'), hz: OA.$('#hz'), hzVal: OA.$('#hz-val'), cw: OA.$('#cw'), eff: OA.$('#eff'),
    stats: OA.$('#stats-body'), statsNone: OA.$('#stats-none'), reset: OA.$('#btn-reset'),
    prog: OA.$('#prog'), score: OA.$('#score'), lamp: OA.$('#lamp'), replay: OA.$('#btn-replay'), abort: OA.$('#btn-abort'),
    keys: OA.$('#keys'), word: OA.$('#word-box'), wordIn: OA.$('#word-in'), wordGo: OA.$('#btn-check'), opts: OA.$('#opts'),
    fb: OA.$('#feedback'), next: OA.$('#btn-next'),
    resTitle: OA.$('#res-title'), resNum: OA.$('#res-num'), resMsg: OA.$('#res-msg'), again: OA.$('#btn-again'), back: OA.$('#btn-back')
  };

  var saved = OA.store.get('morsetrainer', {}) || {};
  var S = {
    mode: ['learn', 'words', 'sos'].indexOf(saved.mode) >= 0 ? saved.mode : 'learn',
    level: clamp(Math.round(saved.level || 1), 1, LEVELS),
    cw: clamp(Math.round(saved.cw || CW_DEFAULT), CW_MIN, CW_MAX),
    eff: clamp(Math.round(saved.eff || START_EFF), 5, CW_MAX),
    hz: clamp(Math.round(saved.hz || 600), 400, 1000),
    stats: saved.stats || {},
    rounds: saved.rounds || 0,
    best: saved.best || {}
  };
  var run = null;       // laufende Runde
  var tone = null;      // laufende Tonausgabe
  var rng = Math.random;

  function save() { OA.store.set('morsetrainer', { mode: S.mode, level: S.level, cw: S.cw, eff: S.eff, hz: S.hz, stats: S.stats, rounds: S.rounds, best: S.best }); }
  function pretty(code) { return MT.pretty(code); }

  /* ---------- Ton ---------- */
  function stopTone() {
    if (!tone) return;
    var t = tone; tone = null;
    clearTimeout(t.end); t.timers.forEach(clearTimeout);
    try { t.g.gain.cancelScheduledValues(0); t.g.gain.value = 0; t.o.stop(); t.o.disconnect(); t.g.disconnect(); } catch (e) { /* schon beendet */ }
    el.lamp.classList.remove('on');
  }

  /** Spielt Wörter (Listen von Morsecodes). Gibt die Dauer in ms zurück. */
  function playWords(words, done) {
    stopTone();
    var f = MT.farnsworth(S.cw, S.eff), tl = MT.timeline(words, f.cu, f.gu);
    var c = OA.audio(), t0 = c ? c.currentTime + 0.06 : 0, timers = [];
    var o = null, g = null;
    if (c) {
      o = c.createOscillator(); g = c.createGain();
      o.type = 'sine'; o.frequency.value = S.hz; g.gain.value = 0;
      o.connect(g); g.connect(c.destination);
      tl.segs.forEach(function (s) {
        if (!s.on) return;
        var a = t0 + s.start / 1000, b = t0 + s.end / 1000;
        g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(0.3, a + 0.004);
        g.gain.setValueAtTime(0.3, b - 0.004); g.gain.linearRampToValueAtTime(0, b);
      });
      o.start(t0); o.stop(t0 + tl.total / 1000 + 0.1);
    }
    tl.segs.forEach(function (s) {          // Lampe im Takt (auch ohne Ton sichtbar)
      timers.push(setTimeout(function () { el.lamp.classList.toggle('on', s.on); }, 60 + s.start));
    });
    tone = { o: o, g: g, timers: timers, end: setTimeout(function () { el.lamp.classList.remove('on'); tone = null; if (done) done(); }, 60 + tl.total + 30) };
    return tl.total;
  }

  /* ---------- Ansichten ---------- */
  function show(view) {
    el.setup.hidden = view !== 'setup'; el.play.hidden = view !== 'play'; el.result.hidden = view !== 'result';
    OA.wake(view === 'play');
    if (view !== 'play' && OA.store.get('wake', false)) OA.wake(true);
  }

  function effText() { return OA.t('Zeichen mit {0} WPM, Pausen wie bei {1} WPM', [S.cw, Math.min(S.eff, S.cw)]); }

  function renderSetup() {
    OA.segSet(el.modes, S.mode);
    el.levelBox.hidden = S.mode !== 'learn';
    el.level.value = S.level;
    var chars = levelChars(S.level);
    el.chars.innerHTML = chars.map(function (c, i) {
      return '<span class="ch' + (i === chars.length - 1 ? ' new' : '') + '" data-notranslate>' + OA.esc(c) + '</span>';
    }).join('');
    el.tempoInfo.textContent = effText();
    el.cw.value = S.cw; el.eff.value = Math.min(S.eff, S.cw); el.hz.value = S.hz; el.hzVal.textContent = OA.t('{0} Hz', [S.hz]);
    renderStats();
  }

  function renderStats() {
    var rows = levelChars(LEVELS).filter(function (c) { return S.stats[c] && S.stats[c].total; });
    el.statsNone.hidden = rows.length > 0;
    el.stats.innerHTML = rows.map(function (c) {
      var s = S.stats[c], pct = Math.round(100 * s.ok / s.total);
      return '<tr data-notranslate><td class="ltr"><strong>' + OA.esc(c) + '</strong></td><td class="ltr">' + pretty(MT.CODE[c]) +
        '</td><td class="num ltr">' + pct + ' % (' + s.ok + '/' + s.total + ')</td></tr>';
    }).join('');
  }

  /* ---------- Runde ---------- */
  function startRound() {
    var n = ROUND[S.mode];
    run = { mode: S.mode, n: n, i: 0, ok: 0, items: [], cur: null, answered: false, last: null, timer: 0 };
    if (S.mode === 'words') run.items = sample(WORDS, n, rng);
    else if (S.mode === 'sos') run.items = sample(SOS_WORDS.concat(SOS_WORDS), n, rng);
    OA.audio();
    show('play');
    nextItem();
  }

  function codesFor(item) {
    return run.mode === 'learn' ? [MT.CODE[item]] : wordCodes(item, run.mode === 'sos');
  }

  function nextItem() {
    clearTimeout(run.timer);
    if (run.i >= run.n) { finishRound(); return; }
    run.i++;
    run.answered = false;
    run.cur = run.mode === 'learn' ? pickChar(levelChars(S.level), S.stats, rng, run.last) : run.items[run.i - 1];
    run.last = run.cur;
    el.prog.textContent = OA.t('Frage {0} von {1}', [run.i, run.n]);
    el.score.textContent = OA.t('{0} richtig', [run.ok]);
    el.fb.hidden = true; el.fb.className = 'feedback';
    el.next.hidden = true;
    el.keys.hidden = run.mode !== 'learn'; el.word.hidden = run.mode !== 'words'; el.opts.hidden = run.mode !== 'sos';
    if (run.mode === 'learn') {
      el.keys.innerHTML = levelChars(S.level).map(function (c) { return '<button type="button" class="key" data-c="' + OA.esc(c) + '" data-notranslate>' + OA.esc(c) + '</button>'; }).join('');
    } else if (run.mode === 'words') {
      el.wordIn.value = ''; el.wordIn.disabled = false; el.wordGo.disabled = false; el.wordIn.focus();
    } else {
      var pool = sample(SOS_WORDS.filter(function (w) { return w !== run.cur; }), 3, rng).concat([run.cur]);
      el.opts.innerHTML = sample(pool, 4, rng).map(function (w) { return '<button type="button" class="btn opt" data-w="' + OA.esc(w) + '" data-notranslate>' + OA.esc(w) + '</button>'; }).join('');
    }
    setTimeout(function () { if (run && !run.answered) playWords([codesFor(run.cur)]); }, 250);
  }

  function answer(given) {
    if (!run || run.answered) return;
    run.answered = true;
    var right = given === run.cur;
    if (right) run.ok++;
    if (run.mode === 'learn') {
      var st = S.stats[run.cur] || (S.stats[run.cur] = { ok: 0, total: 0 });
      st.total++; if (right) st.ok++;
    }
    var code = run.mode === 'sos' && run.cur === 'SOS' ? pretty(MT.SOS_RUN) : codesFor(run.cur).map(pretty).join(' ');
    var solution = '<strong class="ltr" data-notranslate>' + OA.esc(run.cur) + ' &nbsp; ' + code + '</strong>';
    el.fb.hidden = false;
    el.fb.className = 'feedback ' + (right ? 'ok' : 'bad');
    el.fb.innerHTML = right ? '<span>' + OA.esc(OA.t('Richtig!')) + '</span> ' + solution
      : '<span>' + OA.t('Falsch. Es war: {0}', [solution]) + '</span>';
    el.score.textContent = OA.t('{0} richtig', [run.ok]);
    OA.$$('.key', el.keys).forEach(function (k) { k.disabled = true; if (k.getAttribute('data-c') === run.cur) k.classList.add('right'); else if (k.getAttribute('data-c') === given) k.classList.add('wrong'); });
    OA.$$('.opt', el.opts).forEach(function (k) { k.disabled = true; if (k.getAttribute('data-w') === run.cur) k.classList.add('right'); else if (k.getAttribute('data-w') === given) k.classList.add('wrong'); });
    el.wordIn.disabled = true; el.wordGo.disabled = true;
    el.next.hidden = false;
    if (!right) playWords([codesFor(run.cur)]);           // richtige Lösung noch einmal hören
    save();
    run.timer = setTimeout(nextItem, right ? 1100 : 3200);
  }

  function finishRound() {
    var r = run; run = null;
    stopTone();
    var res = nextTempo({ ok: r.ok, total: r.n, eff: S.eff, charWpm: S.cw, level: S.level, mode: r.mode });
    var pct = Math.round(100 * r.ok / r.n);
    S.rounds++;
    var key = r.mode === 'learn' ? 'learn' + S.level : r.mode;
    if (!S.best[key] || pct > S.best[key]) S.best[key] = pct;
    S.eff = res.eff; S.level = res.level;
    save();
    el.resTitle.textContent = OA.t(pct >= 90 ? 'Sehr gut!' : (pct >= 60 ? 'Weiter so!' : 'Bleib dran!'));
    el.resNum.textContent = r.ok + ' / ' + r.n + ' (' + pct + ' %)';
    var msg = '';
    if (res.change === 'tempo') msg = OA.t('Ab 90 % wird es schneller: Die Pausen sind jetzt kürzer ({0} WPM).', [S.eff]);
    else if (res.change === 'level') msg = OA.t('Neue Stufe {0}: Ein weiteres Zeichen kommt dazu.', [S.level]);
    else if (res.change === 'max') msg = OA.t('Volles Tempo erreicht.');
    else msg = OA.t('Ab 90 % richtig wird das Tempo erhöht.');
    msg += ' ' + OA.t('Dein Bestwert hier: {0} %', [S.best[key]]);
    el.resMsg.textContent = msg;
    show('result');
  }

  /* ---------- Ereignisse ---------- */
  el.modes.addEventListener('input', function () { S.mode = OA.segVal(el.modes); save(); renderSetup(); });
  el.level.addEventListener('input', function () { var v = OA.num(el.level.value); if (isFinite(v)) { S.level = clamp(Math.round(v), 1, LEVELS); save(); renderSetup(); } });
  el.cw.addEventListener('input', function () { var v = OA.num(el.cw.value); if (isFinite(v)) { S.cw = clamp(Math.round(v), CW_MIN, CW_MAX); save(); el.tempoInfo.textContent = effText(); } });
  el.eff.addEventListener('input', function () { var v = OA.num(el.eff.value); if (isFinite(v)) { S.eff = clamp(Math.round(v), 5, CW_MAX); save(); el.tempoInfo.textContent = effText(); } });
  el.hz.addEventListener('input', function () { S.hz = Number(el.hz.value); el.hzVal.textContent = OA.t('{0} Hz', [S.hz]); save(); });
  el.start.addEventListener('click', startRound);
  el.again.addEventListener('click', function () { renderSetup(); startRound(); });
  el.back.addEventListener('click', function () { renderSetup(); show('setup'); });
  el.abort.addEventListener('click', function () { if (run) { clearTimeout(run.timer); run = null; } stopTone(); renderSetup(); show('setup'); });
  el.replay.addEventListener('click', function () { if (run) playWords([codesFor(run.cur)]); });
  el.next.addEventListener('click', function () { if (run && run.answered) nextItem(); });
  el.keys.addEventListener('click', function (e) { var b = e.target.closest('.key'); if (b) answer(b.getAttribute('data-c')); });
  el.opts.addEventListener('click', function (e) { var b = e.target.closest('.opt'); if (b) answer(b.getAttribute('data-w')); });
  el.wordGo.addEventListener('click', function () { answer(el.wordIn.value.trim().toUpperCase()); });
  el.wordIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); answer(el.wordIn.value.trim().toUpperCase()); } });
  el.reset.addEventListener('click', function () {
    if (window.confirm(OA.t('Alle Lernstände dieses Trainers löschen?'))) { S.stats = {}; S.best = {}; S.level = 1; S.eff = START_EFF; S.rounds = 0; save(); renderSetup(); }
  });
  // PC-Tastatur: Zeichen direkt tippen (Stufen-Modus)
  document.addEventListener('keydown', function (e) {
    if (!run || run.mode !== 'learn' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter' && run.answered) { e.preventDefault(); nextItem(); return; }
    var k = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (k && levelChars(S.level).indexOf(k) >= 0 && !run.answered) { e.preventDefault(); answer(k); }
  });
  window.addEventListener('pagehide', stopTone);

  renderSetup();
  show('setup');
})();
