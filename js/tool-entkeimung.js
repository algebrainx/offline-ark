/* Offline-Ark – Wasser entkeimen: Abkochzeit nach Höhe + Countdown-Timer.
 * Regel (konservativ, CDC/WHO): bis 2000 m mindestens 1 Minute sprudelnd kochen, darüber 3 Minuten. */
(function () {
  'use strict';

  /** Abkochzeit in Sekunden für eine Höhe in Metern. */
  function boilSeconds(alt) {
    return alt > 2000 ? 180 : 60;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { boilSeconds: boilSeconds };
  if (typeof document === 'undefined') return;

  var OA = window.OA;
  var el = {
    alt: OA.$('#alt'), mins: OA.$('#mins'), unit: OA.$('#minsUnit'), cap: OA.$('#minsCap'),
    clock: OA.$('#clock'), timerCap: OA.$('#timerCap'), start: OA.$('#start'), stop: OA.$('#stop')
  };
  var IDLE_CAP = 'Zeit erst starten, wenn das Wasser durchgehend sprudelt (große Blasen).';

  var tick = null, alarm = null, alarmStop = null, endAt = 0, running = false, ringing = false;

  function mmss(sec) { return OA.pad(Math.floor(sec / 60)) + ':' + OA.pad(sec % 60); }

  function currentSeconds() {
    var a = OA.num(el.alt.value);
    return boilSeconds(isNaN(a) ? 0 : a);
  }

  function showRule() {
    var s = currentSeconds(), m = s / 60;
    el.mins.textContent = m;
    el.unit.textContent = m === 1 ? 'Minute' : 'Minuten';
    el.cap.textContent = s > 60
      ? 'sprudelnd kochen (ab 2000 m Höhe: 3 Minuten)'
      : 'sprudelnd kochen, mindestens (bis 2000 m Höhe)';
    if (!running && !ringing) el.clock.textContent = mmss(s);
    OA.store.set('entkeimung', { alt: isNaN(OA.num(el.alt.value)) ? 0 : OA.num(el.alt.value) });
  }

  function releaseWake() { if (!OA.store.get('wake', false)) OA.wake(false); }

  function reset() {
    running = false; ringing = false;
    clearInterval(tick); clearInterval(alarm);
    if (alarmStop) { alarmStop(); alarmStop = null; }
    el.clock.classList.remove('done');
    el.timerCap.textContent = IDLE_CAP;
    el.start.hidden = false; el.stop.hidden = true;
    releaseWake();
    showRule();
  }

  function ring() {
    running = false; ringing = true;
    clearInterval(tick);
    el.clock.textContent = '00:00';
    el.clock.classList.add('done');
    el.timerCap.textContent = 'Fertig! Herd ausmachen und das Wasser abkühlen lassen.';
    el.start.hidden = true; el.stop.hidden = false; el.stop.textContent = 'Alarm aus';
    var n = 0;
    function once() {
      OA.beep(880, 450);
      OA.vibrate([300, 150, 300]);
      if (++n >= 45) reset();      // nach ca. einer Minute von selbst aufhören
    }
    once();
    alarm = setInterval(once, 1300);
  }

  function update() {
    var left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    el.clock.textContent = mmss(left);
    if (left <= 0) ring();
  }

  el.start.addEventListener('click', function () {
    OA.audio();                    // Ton muss durch einen Klick freigeschaltet werden
    OA.wake(true);                 // Bildschirm anlassen, damit der Alarm nicht verschlafen wird
    endAt = Date.now() + currentSeconds() * 1000;
    running = true;
    el.timerCap.textContent = 'Wasser sprudelnd kochen lassen …';
    el.start.hidden = true; el.stop.hidden = false; el.stop.textContent = 'Abbrechen';
    update();
    tick = setInterval(update, 250);
  });
  el.stop.addEventListener('click', reset);

  var saved = OA.store.get('entkeimung', null);
  if (saved && isFinite(saved.alt)) el.alt.value = saved.alt;
  el.alt.addEventListener('input', showRule);
  showRule();
})();
