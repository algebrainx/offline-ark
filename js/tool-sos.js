/* Offline-Ark – SOS-Licht.
 * Vollbild-Lampe mit möglichst wenig Bedienelementen: nur ein Schließen-Knopf.
 * Blinkmuster werden gegen die Systemzeit geplant (kein Auseinanderlaufen). */
(function () {
  'use strict';
  var OA = window.OA;

  /* SOS: abwechselnd an/aus, in Zeiteinheiten – … --- … mit Standard-Abständen (1/3/7) */
  var SOS = [1, 1, 1, 1, 1, 3, 3, 1, 3, 1, 3, 3, 1, 1, 1, 1, 1, 7];
  var UNIT = { slow: 400, mid: 250, fast: 150 };          // ms pro Einheit
  var STROBE_HZ = { slow: 2, mid: 3, fast: 4 };

  var el = {
    modes: OA.$('#modes'), bright: OA.$('#bright'), brightVal: OA.$('#bright-val'), speed: OA.$('#speed'),
    tempo: OA.$('#tempo-field'), warn: OA.$('#strobe-warn'), ok: OA.$('#strobe-ok'), start: OA.$('#start')
  };

  var saved = OA.store.get('sos', {}) || {};
  var mode = ['white', 'red', 'sos', 'sosred', 'strobe'].indexOf(saved.mode) >= 0 ? saved.mode : 'white';
  el.bright.value = saved.bright || 100;
  OA.segSet(el.speed, saved.speed || 'mid');
  var run = null;

  function save() { OA.store.set('sos', { mode: mode, bright: Number(el.bright.value), speed: OA.segVal(el.speed) || 'mid' }); }

  function ui() {
    OA.$$('.mode', el.modes).forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-v') === mode ? 'true' : 'false'); });
    el.brightVal.textContent = OA.t('{0} %', [el.bright.value]);
    el.tempo.hidden = mode === 'white' || mode === 'red';
    el.warn.hidden = mode !== 'strobe';
    // Stroboskop startet nur nach ausdrücklicher Bestätigung (wird nicht gespeichert)
    el.start.disabled = mode === 'strobe' && !el.ok.checked;
  }

  /** Farbe der „An“-Phase passend zu Lichtart und Helligkeit. */
  function onColor() {
    var v = Math.round(255 * Number(el.bright.value) / 100);
    return (mode === 'red' || mode === 'sosred') ? 'rgb(' + v + ',0,0)' : 'rgb(' + v + ',' + v + ',' + v + ')';
  }

  function enterFullscreen() {
    try {
      var d = document.documentElement;
      if (d.requestFullscreen) { var p = d.requestFullscreen(); if (p && p.catch) p.catch(function () {}); }
      else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen();
    } catch (e) { /* Vollbild nicht möglich – die Fläche deckt trotzdem die Seite ab */ }
  }
  function leaveFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) { var p = document.exitFullscreen(); if (p && p.catch) p.catch(function () {}); }
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) { /* ignorieren */ }
  }

  function stop() {
    if (!run) return;
    var r = run; run = null;
    clearTimeout(r.timer);
    r.surface.remove();
    document.body.classList.remove('lamp-on');
    document.removeEventListener('keydown', r.onKey);
    document.removeEventListener('fullscreenchange', r.onFs);
    document.removeEventListener('webkitfullscreenchange', r.onFs);
    leaveFullscreen();
    OA.wake(false);
    if (OA.store.get('wake', false)) OA.wake(true);   // globale Einstellung beibehalten
    el.start.focus();
  }

  function start() {
    if (run) return;
    if (mode === 'strobe' && !el.ok.checked) return;
    save();

    var surface = document.createElement('div');
    surface.className = 'fullscreen-surface lamp-surface';
    surface.setAttribute('role', 'dialog');
    surface.setAttribute('aria-label', OA.t('Lampe an'));
    var close = document.createElement('button');
    close.type = 'button'; close.className = 'lamp-close'; close.setAttribute('aria-label', OA.t('Lampe ausschalten und schließen'));
    close.innerHTML = OA.icon('close');
    surface.appendChild(close);
    document.body.appendChild(surface);
    document.body.classList.add('lamp-on');
    close.addEventListener('click', stop);

    var me = run = {
      surface: surface, timer: 0,
      onKey: function (e) { if (e.key === 'Escape') stop(); },
      // Beenden des Vollbilds über das System (z. B. Wischgeste) schließt auch die Lampe
      onFs: function () { if (!document.fullscreenElement && !document.webkitFullscreenElement && run === me && me.fsEntered) stop(); }
    };
    document.addEventListener('keydown', me.onKey);
    document.addEventListener('fullscreenchange', me.onFs);
    document.addEventListener('webkitfullscreenchange', me.onFs);
    enterFullscreen();
    setTimeout(function () { if (run === me) me.fsEntered = !!(document.fullscreenElement || document.webkitFullscreenElement); }, 400);
    OA.wake(true);
    close.focus();

    var on = onColor(), off = '#000';
    function paint(isOn) { surface.style.background = isOn ? on : off; }

    if (mode === 'white' || mode === 'red') { paint(true); return; }

    // Blinken: Dauer jeder Phase in ms, Zeitpunkte absolut gegen performance.now()
    var phases, i = 0, next = performance.now();
    if (mode === 'strobe') {
      var half = 500 / STROBE_HZ[OA.segVal(el.speed) || 'mid'];
      phases = [half, half];
    } else {
      var u = UNIT[OA.segVal(el.speed) || 'mid'];
      phases = SOS.map(function (n) { return n * u; });
    }
    (function step() {
      if (run !== me) return;
      paint(i % 2 === 0);
      next += phases[i % phases.length];
      i++;
      me.timer = setTimeout(step, Math.max(0, next - performance.now()));
    })();
  }

  /* ---------- Ereignisse ---------- */
  el.modes.addEventListener('click', function (e) {
    var b = e.target.closest('.mode'); if (!b) return;
    mode = b.getAttribute('data-v');
    if (mode !== 'strobe') el.ok.checked = false;
    ui(); save();
  });
  el.bright.addEventListener('input', function () { ui(); save(); });
  el.speed.addEventListener('input', save);
  el.ok.addEventListener('change', ui);
  el.start.addEventListener('click', start);
  document.addEventListener('visibilitychange', function () {
    if (run && document.visibilityState === 'visible') OA.wake(true);
  });
  window.addEventListener('pagehide', stop);

  ui();
})();
