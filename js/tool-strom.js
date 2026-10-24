/* Offline-Ark – Strom & Akku: Laufzeit-Rechner und Solarpanel-Rechner.
 * Alle Verbraucherwerte sind Richtwerte, keine Messwerte. */
(function () {
  'use strict';

  var PHONE_WH = 12;        // Richtwert: eine Handy-Ladung
  var LAPTOP_W = 45, LED_W = 5;

  /** Laufzeit in Stunden aus Energie (Wh), Leistung (W) und Wirkungsgrad (%). */
  function runtimeHours(wh, watt, effPct) {
    if (!(wh > 0) || !(watt > 0)) return NaN;
    return wh * (effPct / 100) / watt;
  }
  /** Energie in Wh aus mAh und Spannung. */
  function whFromMah(mah, volt) { return mah / 1000 * volt; }
  /** Solarertrag in Wh pro Tag (Volllaststunden, Systemverluste in %). */
  function solarWhPerDay(panelW, sunHours, lossPct) {
    return panelW * sunHours * (1 - lossPct / 100);
  }

  /** Dauer verständlich ausgeben, z. B. "1 Tag 5 Std 20 Min". */
  function durationText(hours) {
    var total = Math.round(hours * 60);
    var d = Math.floor(total / 1440), h = Math.floor((total % 1440) / 60), m = total % 60;
    var parts = [];
    if (d) parts.push(d + (d === 1 ? ' Tag' : ' Tage'));
    if (h) parts.push(h + ' Std');
    if (m && d === 0) parts.push(m + ' Min');
    return parts.length ? parts.join(' ') : 'unter 1 Min';
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runtimeHours: runtimeHours, whFromMah: whFromMah, solarWhPerDay: solarWhPerDay, durationText: durationText };
  }
  if (typeof document === 'undefined') return;

  var OA = window.OA;
  var PICKS = [
    ['Radio', 3], ['LED-Lampe', 5], ['Handy laden', 10], ['Router', 10],
    ['Laptop', 45], ['Fernseher', 80], ['Kühlschrank', 100]
  ];

  var el = {
    tab: OA.$('#tab'), paneL: OA.$('#paneLaufzeit'), paneS: OA.$('#paneSolar'),
    unit: OA.$('#unit'), boxWh: OA.$('#boxWh'), boxMah: OA.$('#boxMah'), boxV: OA.$('#boxV'),
    wh: OA.$('#wh'), mah: OA.$('#mah'), volt: OA.$('#volt'), watt: OA.$('#watt'), eff: OA.$('#eff'), picks: OA.$('#picks'),
    runNum: OA.$('#runNum'), runUnit: OA.$('#runUnit'), runCap: OA.$('#runCap'),
    pw: OA.$('#pw'), loss: OA.$('#loss'), season: OA.$('#season'), sun: OA.$('#sun'),
    solWh: OA.$('#solWh'), solCap: OA.$('#solCap'), solStats: OA.$('#solStats')
  };

  var selected = {};   // gewählte Verbraucher (Name -> true)

  el.picks.innerHTML = PICKS.map(function (p) {
    return '<button type="button" class="pick" aria-pressed="false" data-n="' + OA.esc(p[0]) + '" data-w="' + p[1] + '">' +
      OA.esc(p[0]) + '<span>~' + p[1] + ' W</span></button>';
  }).join('');

  function syncPicks() {
    var sum = 0, any = false;
    OA.$$('.pick', el.picks).forEach(function (b) {
      var on = !!selected[b.getAttribute('data-n')];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) { sum += Number(b.getAttribute('data-w')); any = true; }
    });
    if (any) el.watt.value = String(sum);
  }

  function batteryWh() {
    if (OA.segVal(el.unit) === 'mah') {
      var mah = OA.num(el.mah.value), v = OA.num(el.volt.value);
      return mah > 0 && v > 0 ? whFromMah(mah, v) : NaN;
    }
    return OA.num(el.wh.value);
  }

  function calcRuntime() {
    var mah = OA.segVal(el.unit) === 'mah';
    el.boxWh.hidden = mah; el.boxMah.hidden = !mah; el.boxV.hidden = !mah;

    var wh = batteryWh(), watt = OA.num(el.watt.value);
    var eff = Math.min(100, Math.max(1, OA.num(el.eff.value) || 85));
    var h = runtimeHours(wh, watt, eff);
    if (isNaN(h)) {
      el.runNum.textContent = '–'; el.runUnit.textContent = '';
      el.runCap.textContent = 'Akku-Energie und Leistung eingeben.';
    } else {
      if (h < 1) { el.runNum.textContent = OA.fmt(h * 60, 0); el.runUnit.textContent = 'Minuten'; }
      else if (h < 48) { el.runNum.textContent = OA.fmt(h, 1); el.runUnit.textContent = 'Stunden'; }
      else { el.runNum.textContent = OA.fmt(h / 24, 1); el.runUnit.textContent = 'Tage'; }
      el.runCap.textContent = '≈ ' + durationText(h) + ' · nutzbar ' + OA.fmt(wh * eff / 100, 1) + ' von ' + OA.fmt(wh, 1) + ' Wh (Richtwert)';
    }
    save();
  }

  function calcSolar() {
    var pw = OA.num(el.pw.value), sun = OA.num(el.sun.value), loss = OA.num(el.loss.value);
    if (isNaN(loss)) loss = 25;
    if (!(pw > 0) || !(sun >= 0)) {
      el.solWh.textContent = '–'; el.solCap.textContent = 'Leistung und Sonnenstunden eingeben.'; el.solStats.innerHTML = '';
      save(); return;
    }
    var wh = solarWhPerDay(pw, sun, loss);
    el.solWh.textContent = OA.fmt(wh, 0);
    el.solCap.textContent = OA.fmt(pw, 0) + ' W × ' + OA.fmt(sun, 1) + ' Std × ' + OA.fmt(100 - loss, 0) + ' % (nach Abzug der Verluste) · Richtwert';
    el.solStats.innerHTML = [
      [OA.fmt(Math.floor(wh / PHONE_WH), 0), 'volle Handy-Ladungen pro Tag (≈ ' + PHONE_WH + ' Wh je Ladung)'],
      [OA.fmt(wh / LAPTOP_W, 1), 'Stunden Laptop (' + LAPTOP_W + ' W)'],
      [OA.fmt(wh / LED_W, 1), 'Stunden LED-Lampe (' + LED_W + ' W)']
    ].map(function (c) { return '<div class="stat"><div class="num">' + c[0] + '</div><div class="cap">' + c[1] + '</div></div>'; }).join('');
    save();
  }

  function showTab() {
    var solar = OA.segVal(el.tab) === 'solar';
    el.paneL.hidden = solar; el.paneS.hidden = !solar;
    save();
  }

  function save() {
    OA.store.set('strom', {
      tab: OA.segVal(el.tab), unit: OA.segVal(el.unit), wh: el.wh.value, mah: el.mah.value, volt: el.volt.value,
      watt: el.watt.value, eff: el.eff.value, pw: el.pw.value, loss: el.loss.value, sun: el.sun.value, season: OA.segVal(el.season)
    });
  }

  // gespeicherte Eingaben laden
  var s = OA.store.get('strom', null);
  if (s) {
    ['wh', 'mah', 'volt', 'watt', 'eff', 'pw', 'loss', 'sun'].forEach(function (k) { if (s[k] != null) el[k].value = s[k]; });
    if (s.tab) OA.segSet(el.tab, s.tab);
    if (s.unit) OA.segSet(el.unit, s.unit);
    OA.segSet(el.season, s.season || null);
  } else {
    OA.segSet(el.season, '5');
  }

  el.picks.addEventListener('click', function (e) {
    var b = e.target.closest('.pick'); if (!b) return;
    var n = b.getAttribute('data-n');
    if (selected[n]) delete selected[n]; else selected[n] = true;
    syncPicks();
    if (!Object.keys(selected).length) el.watt.value = '';
    calcRuntime();
  });
  el.watt.addEventListener('input', function () {      // eigener Wert: Auswahl zurücksetzen
    selected = {};
    OA.$$('.pick', el.picks).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  });

  el.season.addEventListener('input', function () { el.sun.value = OA.segVal(el.season); calcSolar(); });
  el.sun.addEventListener('input', function () { OA.segSet(el.season, null); });

  [el.wh, el.mah, el.volt, el.watt, el.eff, el.unit].forEach(function (n) {
    n.addEventListener('input', calcRuntime); n.addEventListener('change', calcRuntime);
  });
  [el.pw, el.loss, el.sun].forEach(function (n) {
    n.addEventListener('input', calcSolar); n.addEventListener('change', calcSolar);
  });
  el.tab.addEventListener('input', showTab);

  calcRuntime(); calcSolar(); showTab();
})();
