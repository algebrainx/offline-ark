/* Offline-Ark – Wiederbelebungs-Takt (Metronom).
 * Genaues Timing: Die Töne werden mit dem Audio-Takt (AudioContext.currentTime) im Voraus
 * auf absolute Zeitpunkte gelegt. Eine kurze Schleife prüft nur, was als Nächstes eingeplant
 * werden muss – sie bestimmt nie selbst den Zeitpunkt eines Schlags, deshalb gibt es keine Drift.
 * Die Ablauflogik (nextEvent) steht oben und ist ohne Browser testbar (module.exports am Ende). */
(function () {
  'use strict';

  var MIN = 100, MAX = 120, DEFAULT = 110;      // Druckfrequenz pro Minute (Leitlinie: 100 bis 120)
  var PAUSE = 5;                                // Sekunden Pause für die 2 Beatmungen im Modus 30:2
  var CYCLE = 30;

  function clampBpm(v) {
    v = Math.round(Number(v));
    if (!isFinite(v)) return DEFAULT;
    return Math.min(MAX, Math.max(MIN, v));
  }

  /** Nächstes Ereignis nach `prev` (null = erster Schlag zur Zeit `start`).
   *  kind: 'beat' (Druck) oder 'breath' (Ansage „2 Beatmungen“, nur im Modus 30:2). */
  function nextEvent(prev, o) {
    var gap = 60 / o.bpm;
    if (!prev) return { time: o.start, kind: 'beat', idx: 1, comp: 1, cycles: 0 };
    if (o.mode === '30:2' && prev.kind === 'beat' && prev.idx >= CYCLE) {
      return { time: prev.time + gap, kind: 'breath', idx: prev.idx, comp: prev.comp, cycles: prev.cycles + 1 };
    }
    if (prev.kind === 'breath') {
      return { time: prev.time + (o.pause == null ? PAUSE : o.pause), kind: 'beat', idx: 1, comp: prev.comp + 1, cycles: prev.cycles };
    }
    return { time: prev.time + gap, kind: 'beat', idx: prev.idx + 1, comp: prev.comp + 1, cycles: prev.cycles };
  }

  var api = { MIN: MIN, MAX: MAX, DEFAULT: DEFAULT, PAUSE: PAUSE, CYCLE: CYCLE, clampBpm: clampBpm, nextEvent: nextEvent };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined' || typeof window === 'undefined' || !window.OA) return;

  /* ====================================================================
   * Oberfläche
   * ==================================================================== */
  var OA = window.OA;
  var el = {
    btn: OA.$('#metro-btn'), btnLabel: OA.$('#metro-label'), heart: OA.$('#metro-heart'),
    bpm: OA.$('#bpm'), bpmRange: OA.$('#bpm-range'), quick: OA.$('#quick'), mode: OA.$('#mode'),
    comp: OA.$('#st-comp'), cycles: OA.$('#st-cycles'), time: OA.$('#st-time'), cyclesBox: OA.$('#box-cycles'),
    breath: OA.$('#breath'), breathSec: OA.$('#breath-sec'), hint: OA.$('#metro-hint'),
    sound: OA.$('#opt-sound'), vib: OA.$('#opt-vib'), vol: OA.$('#opt-vol'), volVal: OA.$('#opt-vol-val'),
    full: OA.$('#btn-full'), link: OA.$('#link-eh')
  };

  var saved = OA.store.get('metronom', {}) || {};
  var S = {
    bpm: clampBpm(saved.bpm || DEFAULT),
    mode: saved.mode === '30:2' ? '30:2' : 'comp',
    sound: saved.sound !== false,
    vib: !!saved.vib,
    vol: typeof saved.vol === 'number' ? Math.min(100, Math.max(5, saved.vol)) : 70
  };
  var run = null;                 // laufender Zustand
  var overlay = null;             // Vollbild-Blinken

  function save() { OA.store.set('metronom', { bpm: S.bpm, mode: S.mode, sound: S.sound, vib: S.vib, vol: S.vol }); }
  function clock() { var c = run && run.ctx; return c ? c.currentTime : performance.now() / 1000; }

  /* ---------- Töne ---------- */
  function tick(ctx, t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 1000;
    var v = Math.max(0.02, S.vol / 100 * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.09);
    return o;
  }
  function lowBeeps(ctx, t) {
    var out = [];
    [0, 0.6].forEach(function (d) {
      var o = ctx.createOscillator(), g = ctx.createGain(), v = Math.max(0.02, S.vol / 100 * 0.7);
      o.type = 'sine'; o.frequency.value = 440;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.linearRampToValueAtTime(v, t + d + 0.02);
      g.gain.setValueAtTime(v, t + d + 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + d + 0.38);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + d); o.stop(t + d + 0.4);
      out.push(o);
    });
    return out;
  }

  /* ---------- Planen und Abarbeiten ---------- */
  function pump() {
    if (!run) return;
    var ahead = document.hidden ? 1.5 : 0.35;      // im Hintergrund drosselt der Browser die Schleife
    while (!run.last || run.last.time < clock() + ahead) {
      var ev = nextEvent(run.last, { bpm: S.bpm, mode: S.mode, start: run.start, pause: PAUSE });
      run.last = ev;
      run.queue.push(ev);
      run.times.push(ev.time);
      if (run.times.length > 400) run.times.shift();
      if (run.ctx && S.sound) {
        if (ev.kind === 'beat') run.nodes.push(tick(run.ctx, ev.time));
        else run.nodes = run.nodes.concat(lowBeeps(run.ctx, ev.time));
        if (run.nodes.length > 60) run.nodes.splice(0, 30);
      }
    }
    dispatch();
  }

  function dispatch() {
    if (!run) return;
    var now = clock();
    while (run.queue.length && run.queue[0].time <= now) handle(run.queue.shift());
  }

  function pulse(node) {
    node.classList.remove('beat');
    void node.offsetWidth;                          // Animation neu starten
    node.classList.add('beat');
  }

  function handle(ev) {
    if (ev.kind === 'beat') {
      run.comp = ev.comp; run.cycles = ev.cycles;
      pulse(el.heart);
      if (overlay) {
        overlay.count.textContent = ev.comp;
        overlay.surface.style.background = '#fff';
        setTimeout(function () { if (overlay) overlay.surface.style.background = '#000'; }, 110);
        overlay.breath.hidden = true;
      }
      if (S.vib) OA.vibrate(40);
      el.breath.hidden = true;
    } else {
      run.cycles = ev.cycles;
      run.breathUntil = ev.time + PAUSE;
      el.breath.hidden = false;
      if (overlay) { overlay.breath.hidden = false; overlay.surface.style.background = '#000'; }
      if (S.vib) OA.vibrate([200, 150, 200]);
      try {
        if (S.sound && window.speechSynthesis) {
          var u = new SpeechSynthesisUtterance(OA.t('2 Beatmungen'));
          u.lang = OA.lang; u.volume = S.vol / 100;
          window.speechSynthesis.speak(u);
        }
      } catch (e) { /* Sprachausgabe nicht verfügbar */ }
    }
    render();
  }

  function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); return OA.pad(Math.floor(sec / 60)) + ':' + OA.pad(sec % 60); }

  function render() {
    el.comp.textContent = run ? run.comp : 0;
    el.cycles.textContent = run ? run.cycles : 0;
    var elapsed = run ? clock() - run.start : 0;
    el.time.textContent = fmtTime(elapsed);
    if (run && run.breathUntil && !el.breath.hidden) {
      el.breathSec.textContent = OA.t('Weiter in {0} s', [Math.max(0, Math.ceil(run.breathUntil - clock()))]);
      if (overlay) overlay.breathSec.textContent = el.breathSec.textContent;
    }
    if (overlay) overlay.count.textContent = run ? run.comp : 0;
  }

  function start() {
    if (run) return;
    var ctx = OA.audio();                            // innerhalb des Tippens freischalten
    var t0 = (ctx ? ctx.currentTime : performance.now() / 1000) + 0.25;
    run = { ctx: ctx, start: t0, queue: [], last: null, nodes: [], times: [], comp: 0, cycles: 0, timer: 0, raf: 0, breathUntil: 0 };
    OA.metronom = { times: run.times };              // nur zum Messen der Taktgenauigkeit
    OA.wake(true);
    el.btn.setAttribute('aria-pressed', 'true');
    el.btn.classList.add('on');
    el.btnLabel.textContent = OA.t('Stopp');
    el.hint.hidden = true;
    pump();
    run.timer = setInterval(function () { pump(); render(); }, 25);
    (function loop() { if (!run) return; dispatch(); render(); run.raf = requestAnimationFrame(loop); })();
  }

  function stop() {
    if (!run) return;
    var r = run; run = null;
    clearInterval(r.timer); cancelAnimationFrame(r.raf);
    r.nodes.forEach(function (n) { try { n.stop(0); } catch (e) { /* schon beendet */ } });
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorieren */ }
    OA.vibrate(0);
    OA.wake(false);
    if (OA.store.get('wake', false)) OA.wake(true);   // globale Einstellung beibehalten
    el.btn.setAttribute('aria-pressed', 'false');
    el.btn.classList.remove('on');
    el.btnLabel.textContent = OA.t('Start');
    el.breath.hidden = true;
    if (overlay) overlay.breath.hidden = true;
    el.hint.hidden = false;
    el.heart.classList.remove('beat');
  }

  /* ---------- Einstellungen ---------- */
  function setBpm(v) {
    S.bpm = clampBpm(v);
    el.bpm.value = S.bpm; el.bpmRange.value = S.bpm;
    OA.$$('button', el.quick).forEach(function (b) { b.classList.toggle('on', Number(b.getAttribute('data-bpm')) === S.bpm); });
    save();
  }
  function applyMode() {
    el.cyclesBox.hidden = S.mode !== '30:2';
    OA.segSet(el.mode, S.mode === '30:2' ? '30:2' : 'comp');
  }

  el.bpm.addEventListener('input', function () { var v = OA.num(el.bpm.value); if (isFinite(v) && v >= MIN && v <= MAX) setBpm(v); });
  el.bpm.addEventListener('change', function () { setBpm(OA.num(el.bpm.value)); });
  el.bpmRange.addEventListener('input', function () { setBpm(el.bpmRange.value); });
  el.quick.addEventListener('click', function (e) { var b = e.target.closest('button[data-bpm]'); if (b) setBpm(b.getAttribute('data-bpm')); });
  el.mode.addEventListener('input', function () { S.mode = OA.segVal(el.mode) === '30:2' ? '30:2' : 'comp'; applyMode(); save(); });
  el.sound.addEventListener('change', function () { S.sound = el.sound.checked; save(); });
  el.vib.addEventListener('change', function () { S.vib = el.vib.checked; save(); if (S.vib) OA.vibrate(60); });
  el.vol.addEventListener('input', function () { S.vol = Number(el.vol.value); el.volVal.textContent = OA.t('{0} %', [S.vol]); save(); });
  el.btn.addEventListener('click', function () { if (run) stop(); else start(); });

  /* ---------- Vollbild-Blinken ---------- */
  function openOverlay() {
    if (overlay) return;
    var s = document.createElement('div');
    s.className = 'fullscreen-surface metro-flash';
    s.style.background = '#000';
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-label', OA.t('Blinken im Vollbild'));
    s.innerHTML = '<div class="flash-count ltr" data-notranslate>0</div>' +
      '<div class="flash-breath" hidden><div>' + OA.esc(OA.t('2 Beatmungen')) + '</div><small class="ltr" data-notranslate></small></div>' +
      '<button type="button" class="flash-close" aria-label="' + OA.esc(OA.t('Schließen')) + '">' + OA.icon('close') + '</button>';
    document.body.appendChild(s);
    overlay = {
      surface: s, count: s.querySelector('.flash-count'), breath: s.querySelector('.flash-breath'),
      breathSec: s.querySelector('.flash-breath small'), onKey: function (e) { if (e.key === 'Escape') closeOverlay(); }
    };
    s.querySelector('.flash-close').addEventListener('click', closeOverlay);
    document.addEventListener('keydown', overlay.onKey);
    overlay.count.textContent = run ? run.comp : 0;
    s.querySelector('.flash-close').focus();
  }
  function closeOverlay() {
    if (!overlay) return;
    document.removeEventListener('keydown', overlay.onKey);
    overlay.surface.remove(); overlay = null;
    el.full.focus();
  }
  el.full.addEventListener('click', openOverlay);

  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', function () { if (run && document.visibilityState === 'visible') OA.wake(true); });

  /* ---------- Start ---------- */
  el.heart.innerHTML = OA.icon('heart');
  el.link.setAttribute('href', OA.genUrl('knowledge/erste-hilfe.html'));
  el.sound.checked = S.sound; el.vib.checked = S.vib; el.vol.value = S.vol; el.volVal.textContent = OA.t('{0} %', [S.vol]);
  if (!navigator.vibrate) { el.vib.closest('.switch-row').hidden = true; }
  setBpm(S.bpm);
  applyMode();
  render();
})();
