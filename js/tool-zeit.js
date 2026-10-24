/* Offline-Ark – Stoppuhr, Timer, Countdown.
 * Alle Zeiten werden aus der Systemzeit (Date.now) berechnet, nie durch Zählen von
 * Intervall-Schritten – so bleibt alles genau, auch wenn der Browser im Hintergrund
 * bremst. Zielzeiten und Stände liegen in OA.store und laufen nach dem Neuladen weiter. */
(function () {
  'use strict';
  var OA = window.OA;
  var MAX_TIMERS = 3, MAX_LAPS = 99;
  var BASE_TITLE = OA.t('Stoppuhr & Timer') + ' – Offline-Ark';
  // Dezimalzeichen der Hundertstel (de/es Komma, en/ar Punkt)
  var DEC = (OA.lang === 'en' || OA.lang === 'ar') ? '.' : ',';

  var el = {
    tabs: OA.$('#tabs'), alarm: OA.$('#alarm'), alarmText: OA.$('#alarm-text'), alarmAck: OA.$('#alarm-ack'),
    swTime: OA.$('#sw-time'), swStart: OA.$('#sw-start'), swLap: OA.$('#sw-lap'), swReset: OA.$('#sw-reset'),
    lapsWrap: OA.$('#laps-wrap'), laps: OA.$('#laps'),
    th: OA.$('#th'), tm: OA.$('#tm'), ts: OA.$('#ts'), quick: OA.$('#quick'), tname: OA.$('#tname'),
    tAdd: OA.$('#t-add'), tHint: OA.$('#t-hint'), timers: OA.$('#timers'), tTest: OA.$('#t-test'),
    cdDate: OA.$('#cd-date'), cdTime: OA.$('#cd-time'), cdLabel: OA.$('#cd-label'), cdStart: OA.$('#cd-start'),
    cdHint: OA.$('#cd-hint'), cdSetup: OA.$('#cd-setup'), cdRun: OA.$('#cd-run'), cdTitle: OA.$('#cd-title'),
    cdStop: OA.$('#cd-stop'), cdReached: OA.$('#cd-reached'),
    cd: { d: OA.$('#cd-d'), h: OA.$('#cd-h'), m: OA.$('#cd-m'), s: OA.$('#cd-s') }
  };

  /* ---------- Zustand (gespeichert) ---------- */
  var saved = OA.store.get('zeit', {}) || {};
  var S = {
    tab: ['sw', 'timer', 'cd'].indexOf(saved.tab) >= 0 ? saved.tab : 'sw',
    // Stoppuhr: running + start (Systemzeit des letzten Starts) + base (bereits gelaufene ms)
    sw: Object.assign({ running: false, start: 0, base: 0, laps: [] }, saved.sw || {}),
    timers: Array.isArray(saved.timers) ? saved.timers.slice(0, MAX_TIMERS) : [],
    cd: Object.assign({ state: 'idle', target: 0, label: '' }, saved.cd || {}),
    dur: Object.assign({ h: 0, m: 5, s: 0 }, saved.dur || {}),
    cdForm: saved.cdForm || null
  };
  function save() { OA.store.set('zeit', S); }

  /* ---------- Formatierung ---------- */
  function hms(totalSec) {
    var h = Math.floor(totalSec / 3600), m = Math.floor(totalSec % 3600 / 60), s = totalSec % 60;
    return (h > 0 ? h + ':' + OA.pad(m) : OA.pad(m)) + ':' + OA.pad(s);
  }
  function swParts(ms) {
    var cs = Math.floor(ms / 10), sec = Math.floor(cs / 100);
    return { main: hms(sec), cs: OA.pad(cs % 100) };
  }
  function swText(ms) { var p = swParts(ms); return p.main + DEC + p.cs; }
  function now() { return Date.now(); }

  /* ====================================================================
   * Alarm: Ton + Vibration wiederholen sich, bis quittiert wird
   * ==================================================================== */
  var alarmLoop = 0;
  function ring() {
    [0, 260, 520].forEach(function (d) { setTimeout(function () { OA.beep(880, 170, 0.3); }, d); });
    OA.vibrate([350, 150, 350, 150, 350]);
  }
  function startAlarm() { if (alarmLoop) return; ring(); alarmLoop = setInterval(ring, 1800); }
  function stopAlarm() { if (!alarmLoop) return; clearInterval(alarmLoop); alarmLoop = 0; OA.vibrate(0); }

  function timerName(t) { return t.name || OA.t('Timer {0}', [t.num || 1]); }
  function ringingNames() {
    var n = S.timers.filter(function (t) { return t.state === 'ringing'; }).map(timerName);
    if (S.cd.state === 'ringing') n.push(S.cd.label || OA.t('Countdown'));
    return n;
  }
  function reconcileAlarm() {
    var names = ringingNames();
    if (names.length) {
      el.alarm.hidden = false;
      el.alarmText.innerHTML = '<span data-notranslate>' + OA.esc(names.join(OA.lang === 'ar' ? '، ' : ', ')) + '</span>';
      startAlarm();
    } else { el.alarm.hidden = true; stopAlarm(); }
  }
  el.alarmAck.addEventListener('click', function () {
    S.timers.forEach(function (t) { if (t.state === 'ringing') { t.state = 'idle'; t.left = t.total; t.target = 0; } });
    if (S.cd.state === 'ringing') S.cd.state = 'reached';
    save(); renderTimers(); renderCd(); reconcileAlarm(); updateTitle();
  });
  // Browser erlauben Ton erst nach einer Bedienung: beim ersten Tippen Audio freischalten
  ['pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function unlock() { OA.audio(); document.removeEventListener(ev, unlock); });
  });

  /* ====================================================================
   * Reiter
   * ==================================================================== */
  function showTab() {
    ['sw', 'timer', 'cd'].forEach(function (id) { OA.$('#tab-' + id).hidden = id !== S.tab; });
    OA.segSet(el.tabs, S.tab);
  }
  el.tabs.addEventListener('input', function () { S.tab = OA.segVal(el.tabs); showTab(); save(); });

  /* ====================================================================
   * Stoppuhr
   * ==================================================================== */
  function swElapsed() { return Math.max(0, S.sw.base + (S.sw.running ? now() - S.sw.start : 0)); }

  function renderSw() {
    var p = swParts(swElapsed());
    el.swTime.innerHTML = OA.esc(p.main) + '<small>' + DEC + p.cs + '</small>';
    el.swStart.textContent = OA.t(S.sw.running ? 'Stopp' : (S.sw.base > 0 ? 'Weiter' : 'Start'));
    el.swLap.disabled = !S.sw.running;
    el.swReset.disabled = S.sw.running || (S.sw.base === 0 && !S.sw.laps.length);
  }
  function renderLaps() {
    el.lapsWrap.hidden = !S.sw.laps.length;
    var n = S.sw.laps.length;
    el.laps.innerHTML = S.sw.laps.map(function (l, i) {
      return '<tr><td>' + (n - i) + '</td><td class="num ltr">' + swText(l.lap) + '</td><td class="num ltr">' + swText(l.total) + '</td></tr>';
    }).join('');
  }
  el.swStart.addEventListener('click', function () {
    var t = now();
    if (S.sw.running) { S.sw.base += t - S.sw.start; S.sw.running = false; }
    else { S.sw.start = t; S.sw.running = true; }
    save(); renderSw(); updateTitle();
  });
  el.swLap.addEventListener('click', function () {
    if (!S.sw.running || S.sw.laps.length >= MAX_LAPS) return;
    var total = swElapsed(), prev = S.sw.laps.length ? S.sw.laps[0].total : 0;
    S.sw.laps.unshift({ lap: total - prev, total: total });
    save(); renderLaps(); renderSw();
  });
  el.swReset.addEventListener('click', function () {
    S.sw = { running: false, start: 0, base: 0, laps: [] };
    save(); renderLaps(); renderSw(); updateTitle();
  });

  /* ====================================================================
   * Timer
   * ==================================================================== */
  function readDur() {
    var h = Math.min(99, Math.max(0, Math.floor(OA.num(el.th.value)) || 0));
    var m = Math.min(59, Math.max(0, Math.floor(OA.num(el.tm.value)) || 0));
    var s = Math.min(59, Math.max(0, Math.floor(OA.num(el.ts.value)) || 0));
    return { h: h, m: m, s: s, ms: (h * 3600 + m * 60 + s) * 1000 };
  }
  function timerLeft(t) {
    if (t.state === 'running') return Math.max(0, t.target - now());
    if (t.state === 'ringing') return 0;
    return t.left;
  }
  var STATE_KEY = { idle: 'Bereit', running: 'Läuft', paused: 'Pausiert', ringing: 'Abgelaufen' };

  function formUpdate() {
    var d = readDur();
    S.dur = { h: d.h, m: d.m, s: d.s };
    var full = S.timers.length >= MAX_TIMERS;
    el.tAdd.disabled = full || d.ms <= 0;
    el.tHint.textContent = OA.t(full ? 'Es laufen schon 3 Timer. Entferne einen, um einen neuen zu starten.'
      : (d.ms <= 0 ? 'Bitte eine Dauer einstellen.' : 'Bis zu 3 Timer gleichzeitig.'));
    save();
  }

  function renderTimers() {
    el.timers.innerHTML = S.timers.map(function (t) {
      var btns;
      if (t.state === 'ringing') btns = '<button type="button" class="btn primary sm" data-a="ack">' + OA.t('Quittieren') + '</button>';
      else if (t.state === 'running') btns = '<button type="button" class="btn sm" data-a="pause">' + OA.t('Pause') + '</button><button type="button" class="btn sm" data-a="remove">' + OA.t('Entfernen') + '</button>';
      else if (t.state === 'paused') btns = '<button type="button" class="btn sm" data-a="resume">' + OA.t('Weiter') + '</button><button type="button" class="btn sm" data-a="reset">' + OA.t('Zurücksetzen') + '</button><button type="button" class="btn sm" data-a="remove">' + OA.t('Entfernen') + '</button>';
      else btns = '<button type="button" class="btn sm" data-a="resume">' + OA.t('Start') + '</button><button type="button" class="btn sm" data-a="remove">' + OA.t('Entfernen') + '</button>';
      return '<div class="card timer-card' + (t.state === 'ringing' ? ' ringing' : '') + '" data-id="' + OA.esc(t.id) + '">' +
        '<div class="head"><span class="name" data-notranslate>' + OA.esc(timerName(t)) + '</span><span class="state">' + OA.esc(OA.t(STATE_KEY[t.state])) + ' · <span class="ltr">' + hms(Math.round(t.total / 1000)) + '</span></span></div>' +
        '<div class="big-time sm ltr" data-t="' + OA.esc(t.id) + '">' + hms(Math.ceil(timerLeft(t) / 1000)) + '</div>' +
        '<div class="bar" aria-hidden="true"><span data-b="' + OA.esc(t.id) + '"></span></div>' +
        '<div class="btn-row">' + btns + '</div></div>';
    }).join('');
    updateTimerDisplays();
    formUpdate();
  }
  function updateTimerDisplays() {
    S.timers.forEach(function (t) {
      var left = timerLeft(t);
      var tx = OA.$('[data-t="' + t.id + '"]', el.timers), bar = OA.$('[data-b="' + t.id + '"]', el.timers);
      if (tx) tx.textContent = hms(Math.ceil(left / 1000));
      if (bar) bar.style.width = (t.total ? Math.max(0, Math.min(100, left / t.total * 100)) : 0) + '%';
    });
  }

  function addTimer() {
    var d = readDur();
    if (S.timers.length >= MAX_TIMERS || d.ms <= 0) return;
    OA.audio();                                         // Ton während der Bedienung freischalten
    var used = S.timers.map(function (t) { return t.num; }), n = 1;
    while (used.indexOf(n) >= 0) n++;
    S.timers.push({
      id: 't' + now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: el.tname.value.trim(), num: n, total: d.ms, left: d.ms, target: now() + d.ms, state: 'running'
    });
    el.tname.value = '';
    save(); renderTimers(); updateTitle();
  }
  el.tAdd.addEventListener('click', addTimer);

  el.timers.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var card = b.closest('.timer-card'), id = card.getAttribute('data-id');
    var t = S.timers.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var a = b.getAttribute('data-a');
    if (a === 'pause') { t.left = Math.max(0, t.target - now()); t.state = 'paused'; t.target = 0; }
    else if (a === 'resume') { OA.audio(); t.target = now() + t.left; t.state = 'running'; }
    else if (a === 'reset') { t.left = t.total; t.state = 'idle'; t.target = 0; }
    else if (a === 'ack') { t.left = t.total; t.state = 'idle'; t.target = 0; }
    else if (a === 'remove') { S.timers = S.timers.filter(function (x) { return x !== t; }); }
    save(); renderTimers(); reconcileAlarm(); updateTitle();
  });

  el.quick.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-min]'); if (!b) return;
    var min = Number(b.getAttribute('data-min'));
    el.th.value = 0; el.tm.value = min; el.ts.value = 0;
    formUpdate();
  });
  ['input', 'change'].forEach(function (ev) { [el.th, el.tm, el.ts].forEach(function (i) { i.addEventListener(ev, formUpdate); }); });
  el.tTest.addEventListener('click', function () { OA.audio(); ring(); });

  /* ====================================================================
   * Countdown bis Datum/Uhrzeit
   * ==================================================================== */
  function pad2(n) { return OA.pad(n, 2); }
  function dateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  function readTarget() {
    var dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(el.cdDate.value), tm = /^(\d{1,2}):(\d{2})/.exec(el.cdTime.value);
    if (!dm || !tm) return NaN;
    return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), 0, 0).getTime();
  }
  function cdFormUpdate() {
    var t = readTarget();
    var ok = !isNaN(t) && t > now();
    el.cdStart.disabled = !ok;
    el.cdHint.textContent = ok ? OA.t('Ziel: {0}', [new Date(t).toLocaleString(OA.locale, { dateStyle: 'full', timeStyle: 'short' })]) : OA.t('Bitte ein Ziel in der Zukunft wählen.');
    S.cdForm = { date: el.cdDate.value, time: el.cdTime.value, label: el.cdLabel.value };
    save();
  }
  function renderCd() {
    var active = S.cd.state !== 'idle';
    el.cdSetup.hidden = active; el.cdRun.hidden = !active;
    el.cdTitle.textContent = active ? (S.cd.label ? S.cd.label + ' · ' : '') + new Date(S.cd.target).toLocaleString(OA.locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
    el.cdReached.hidden = !(S.cd.state === 'ringing' || S.cd.state === 'reached');
    el.cdStop.textContent = OA.t(S.cd.state === 'running' ? 'Countdown abbrechen' : 'Schließen');
    updateCd();
  }
  function updateCd() {
    if (S.cd.state === 'idle') return;
    var left = S.cd.state === 'running' ? Math.max(0, S.cd.target - now()) : 0;
    var sec = Math.ceil(left / 1000);
    el.cd.d.textContent = Math.floor(sec / 86400);
    el.cd.h.textContent = Math.floor(sec % 86400 / 3600);
    el.cd.m.textContent = Math.floor(sec % 3600 / 60);
    el.cd.s.textContent = sec % 60;
  }
  el.cdStart.addEventListener('click', function () {
    var t = readTarget(); if (isNaN(t) || t <= now()) return;
    OA.audio();
    S.cd = { state: 'running', target: t, label: el.cdLabel.value.trim() };
    save(); renderCd(); updateTitle();
  });
  el.cdStop.addEventListener('click', function () {
    S.cd = { state: 'idle', target: 0, label: '' };
    save(); renderCd(); reconcileAlarm(); updateTitle();
  });
  [el.cdDate, el.cdTime, el.cdLabel].forEach(function (i) { i.addEventListener('input', cdFormUpdate); i.addEventListener('change', cdFormUpdate); });

  /* ====================================================================
   * Seitentitel + Haupt-Takt
   * ==================================================================== */
  function updateTitle() {
    var t = now(), title = BASE_TITLE;
    if (ringingNames().length) title = OA.t('⏰ Zeit abgelaufen!') + ' – ' + BASE_TITLE;
    else {
      var next = null;
      S.timers.forEach(function (x) { if (x.state === 'running' && (next === null || x.target < next.target)) next = x; });
      if (next) title = hms(Math.ceil(Math.max(0, next.target - t) / 1000)) + ' ' + timerName(next);
      else if (S.sw.running) title = hms(Math.floor(swElapsed() / 1000)) + ' ' + OA.t('Stoppuhr');
      else if (S.cd.state === 'running') {
        var sec = Math.ceil((S.cd.target - t) / 1000), d = Math.floor(sec / 86400);
        title = (d ? d + ' T ' : '') + hms(sec % 86400) + (S.cd.label ? ' ' + S.cd.label : ' ' + OA.t('Countdown'));
      }
    }
    if (document.title !== title) document.title = title;
  }

  function tick() {
    var t = now(), changed = false;
    S.timers.forEach(function (x) {
      if (x.state === 'running' && t >= x.target) { x.state = 'ringing'; x.left = 0; changed = true; }
    });
    if (S.cd.state === 'running' && t >= S.cd.target) { S.cd.state = 'ringing'; changed = true; }
    if (changed) { save(); renderTimers(); renderCd(); }
    updateTimerDisplays();
    updateCd();
    reconcileAlarm();
    updateTitle();
  }

  // Stoppuhr flüssig im Hundertstel-Takt; alles andere reicht 4× pro Sekunde
  var raf = 0;
  function frame() {
    raf = 0;
    if (S.sw.running && S.tab === 'sw' && !document.hidden) { renderSw(); raf = requestAnimationFrame(frame); }
  }
  function ensureFrame() { if (!raf && S.sw.running && !document.hidden) raf = requestAnimationFrame(frame); }
  el.swStart.addEventListener('click', ensureFrame);
  el.tabs.addEventListener('input', ensureFrame);
  document.addEventListener('visibilitychange', function () { tick(); renderSw(); ensureFrame(); });
  setInterval(function () { tick(); if (S.sw.running && !raf) renderSw(); }, 250);

  /* ---------- Start ---------- */
  el.th.value = S.dur.h; el.tm.value = S.dur.m; el.ts.value = S.dur.s;
  var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  el.cdDate.value = S.cdForm && S.cdForm.date ? S.cdForm.date : dateStr(tomorrow);
  if (S.cdForm && S.cdForm.time) el.cdTime.value = S.cdForm.time;
  if (S.cdForm && S.cdForm.label) el.cdLabel.value = S.cdForm.label;
  el.cdDate.setAttribute('min', dateStr(new Date()));

  // Gespeicherte Timer prüfen (ggf. während der Abwesenheit abgelaufen)
  S.timers = S.timers.filter(function (x) { return x && x.id && x.total > 0; });
  showTab(); renderSw(); renderLaps(); renderTimers(); renderCd(); cdFormUpdate();
  tick(); ensureFrame();
})();
