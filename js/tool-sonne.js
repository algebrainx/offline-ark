/* Offline-Ark – Sonne & Tageslicht, komplett offline berechnet.
 * Verfahren: NOAA Solar Calculator (Meeus, "Astronomical Algorithms").
 * Zeiten werden in UTC-Minuten gerechnet und in der Ortszeit des Geräts angezeigt (Sommerzeit inklusive). */
(function () {
  'use strict';

  var RAD = Math.PI / 180;
  var ZENITH_SUN = 90.833;     // Sonnenauf-/untergang: Sonnenradius + Refraktion
  var ZENITH_CIVIL = 96;       // bürgerliche Dämmerung: Sonne 6° unter dem Horizont

  /** Julianisches Datum für 0:00 UTC. */
  function julianDay(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
  }

  /** Sonnendeklination (Grad) und Zeitgleichung (Minuten) zu einem Julianischen Datum. */
  function sunPos(jd) {
    var t = (jd - 2451545) / 36525;
    var l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
    var m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    var e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    var c = Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
            Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * m * RAD) * 0.000289;
    var trueLong = l0 + c;
    var omega = 125.04 - 1934.136 * t;
    var appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    var obliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
    var obliqCorr = obliq + 0.00256 * Math.cos(omega * RAD);
    var decl = Math.asin(Math.sin(obliqCorr * RAD) * Math.sin(appLong * RAD)) / RAD;
    var y = Math.tan(obliqCorr * RAD / 2); y *= y;
    var eqt = 4 / RAD * (y * Math.sin(2 * l0 * RAD) - 2 * e * Math.sin(m * RAD) +
              4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
              0.5 * y * y * Math.sin(4 * l0 * RAD) - 1.25 * e * e * Math.sin(2 * m * RAD));
    return { decl: decl, eqt: eqt };
  }

  /** cos(Stundenwinkel) für einen Zenitwinkel; >1: Sonne erreicht ihn nie, <-1: sie fällt nie darunter. */
  function cosHourAngle(lat, decl, zenith) {
    return (Math.cos(zenith * RAD) - Math.sin(lat * RAD) * Math.sin(decl * RAD)) /
           (Math.cos(lat * RAD) * Math.cos(decl * RAD));
  }

  /** Zeitpunkt (UTC-Minuten ab 0:00 UTC des Datums) eines Ereignisses; sign: -1 Aufgang, +1 Untergang. */
  function eventMinutes(jd0, lat, lon, zenith, sign) {
    var min = 720 - 4 * lon;
    for (var i = 0; i < 4; i++) {
      var p = sunPos(jd0 + min / 1440);
      var ch = cosHourAngle(lat, p.decl, zenith);
      if (ch > 1) return { state: 'never' };
      if (ch < -1) return { state: 'always' };
      var h = Math.acos(ch) / RAD;
      min = 720 - 4 * (lon - sign * h) - p.eqt;
    }
    return { state: 'ok', min: min };
  }

  /** Alles für einen Kalendertag (y, m 1–12, d) am Ort lat/lon (Ost positiv). */
  function compute(y, m, d, lat, lon) {
    var jd0 = julianDay(y, m, d);
    var base = Date.UTC(y, m - 1, d);
    var noon = 720 - 4 * lon - sunPos(jd0 + (720 - 4 * lon) / 1440).eqt;
    noon = 720 - 4 * lon - sunPos(jd0 + noon / 1440).eqt;
    var decl = sunPos(jd0 + noon / 1440).decl;

    function at(r) { return r.state === 'ok' ? new Date(base + r.min * 60000) : null; }
    var rise = eventMinutes(jd0, lat, lon, ZENITH_SUN, -1), set = eventMinutes(jd0, lat, lon, ZENITH_SUN, 1);
    var cRise = eventMinutes(jd0, lat, lon, ZENITH_CIVIL, -1), cSet = eventMinutes(jd0, lat, lon, ZENITH_CIVIL, 1);

    var polar = null, daylight;
    if (rise.state === 'always' || set.state === 'always') { polar = 'day'; daylight = 1440; }
    else if (rise.state === 'never' || set.state === 'never') { polar = 'night'; daylight = 0; }
    else daylight = set.min - rise.min;

    return {
      sunrise: at(rise), sunset: at(set), civilBegin: at(cRise), civilEnd: at(cSet),
      civilState: cRise.state === 'ok' ? 'ok' : cRise.state,   // 'always' = nie richtig dunkel, 'never' = nie hell genug
      noon: new Date(base + noon * 60000),
      maxElevation: 90 - Math.abs(lat - decl),
      daylightMinutes: daylight, polar: polar
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute, julianDay: julianDay, sunPos: sunPos };
  if (typeof document === 'undefined') return;

  /* ---------- Oberfläche ---------- */
  var OA = window.OA;
  var PLACES = {
    waiblingen: { name: 'Waiblingen', lat: 48.8310, lon: 9.3160 },
    stuttgart: { name: 'Stuttgart', lat: 48.7758, lon: 9.1829 }
  };
  var el = {
    place: OA.$('#place'), gps: OA.$('#gps'), gpsMsg: OA.$('#gpsMsg'), date: OA.$('#date'), today: OA.$('#today'),
    lat: OA.$('#lat'), lon: OA.$('#lon'), where: OA.$('#where'),
    dur: OA.$('#dur'), durCap: OA.$('#durCap'), stats: OA.$('#stats'), tbody: OA.$('#week'), tzNote: OA.$('#tzNote')
  };

  var pos = { lat: PLACES.waiblingen.lat, lon: PLACES.waiblingen.lon, name: 'Waiblingen' };

  // Zeiten auf die nächste Minute runden und in Gerätezeit ausgeben
  function hm(date) {
    if (!date) return '–';
    var r = new Date(Math.round(date.getTime() / 60000) * 60000);
    return OA.pad(r.getHours()) + ':' + OA.pad(r.getMinutes());
  }
  function hmDur(min) {
    var t = Math.round(min);
    return OA.t('{0} Std {1} Min', [Math.floor(t / 60), OA.pad(t % 60)]);
  }
  function parseDate() {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(el.date.value || '');
    if (!m) { var n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; }
    return { y: +m[1], m: +m[2], d: +m[3] };
  }
  function zoneName(date) {
    try {
      var parts = new Intl.DateTimeFormat(OA.locale, { timeZoneName: 'short' }).formatToParts(date);
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'timeZoneName') return parts[i].value;
    } catch (e) { /* ältere Browser */ }
    var off = -date.getTimezoneOffset() / 60;
    return 'UTC' + (off >= 0 ? '+' : '') + off;
  }
  function stat(num, cap) { return '<div class="stat"><div class="num ltr">' + num + '</div><div class="cap">' + OA.esc(cap) + '</div></div>'; }
  // Himmelsrichtungs-Buchstaben für Koordinaten: de N/S/O/W, es N/S/E/O, sonst N/S/E/W
  function hem(lat, lon) {
    var es = OA.lang === 'es', de = OA.lang === 'de';
    return { ns: lat < 0 ? 'S' : 'N', ew: lon < 0 ? (es ? 'O' : 'W') : (de ? 'O' : 'E') };
  }

  function render() {
    var D = parseDate();
    var r = compute(D.y, D.m, D.d, pos.lat, pos.lon);
    var prev = compute(D.y, D.m, D.d - 1, pos.lat, pos.lon);

    var h = hem(pos.lat, pos.lon);
    el.where.textContent = OA.t(pos.name) + ' · \u2066' + OA.fmt(Math.abs(pos.lat), 4) + '° ' + h.ns + ', ' + OA.fmt(Math.abs(pos.lon), 4) + '° ' + h.ew + '\u2069';
    el.tzNote.textContent = OA.t('Zeiten in der Ortszeit deines Geräts ({0}), einschließlich Sommerzeit. Berechnung auf etwa ±2 Minuten genau.', [zoneName(r.noon)]);

    if (r.polar === 'day') { el.dur.textContent = OA.t('{0} Std', [24]); el.durCap.textContent = OA.t('Polartag: Die Sonne geht nicht unter.'); }
    else if (r.polar === 'night') { el.dur.textContent = OA.t('{0} Std', [0]); el.durCap.textContent = OA.t('Polarnacht: Die Sonne geht nicht auf.'); }
    else {
      el.dur.textContent = hmDur(r.daylightMinutes);
      var diff = (r.daylightMinutes - prev.daylightMinutes) * 60;     // Sekunden
      var ad = Math.abs(Math.round(diff));
      var txt;
      if (ad < 5) txt = OA.t('etwa so lang wie gestern');
      else {
        var longer = diff > 0;
        txt = ad >= 60
          ? OA.t(longer ? '{0} Min {1} Sek länger als gestern' : '{0} Min {1} Sek kürzer als gestern', [Math.floor(ad / 60), ad % 60])
          : OA.t(longer ? '{0} Sek länger als gestern' : '{0} Sek kürzer als gestern', [ad]);
      }
      el.durCap.textContent = OA.t('Sonnenaufgang bis -untergang · {0}', [txt]);
    }

    var civ = r.civilState;    // 'ok' | 'always' (nie richtig dunkel) | 'never' (nie hell genug)
    var polarSuffix = r.polar === 'night' ? ' · Polarnacht' : ' · Polartag';
    el.stats.innerHTML = [
      stat(hm(r.sunrise), r.polar ? OA.t('Sonnenaufgang' + polarSuffix) : OA.t('Sonnenaufgang')),
      stat(hm(r.sunset), r.polar ? OA.t('Sonnenuntergang' + polarSuffix) : OA.t('Sonnenuntergang')),
      stat(hm(r.civilBegin), civ === 'always' ? OA.t('Dämmerung beginnt · ganze Nacht hell genug') : civ === 'never' ? OA.t('Dämmerung beginnt · bleibt zu dunkel') : OA.t('Dämmerung beginnt · es wird hell')),
      stat(hm(r.civilEnd), civ === 'always' ? OA.t('Dämmerung endet · ganze Nacht hell genug') : civ === 'never' ? OA.t('Dämmerung endet · bleibt zu dunkel') : OA.t('Dämmerung endet · es wird dunkel')),
      stat(hm(r.noon), r.maxElevation < 0
        ? OA.t('Höchststand · Sonne bleibt {0}° unter dem Horizont', [OA.fmt(-r.maxElevation, 0)])
        : OA.t('Höchststand · Sonne {0}° über dem Horizont', [OA.fmt(r.maxElevation, 0)]))
    ].join('');

    var rows = '';
    for (var i = 0; i < 7; i++) {
      var day = new Date(D.y, D.m - 1, D.d + i);
      var c = compute(day.getFullYear(), day.getMonth() + 1, day.getDate(), pos.lat, pos.lon);
      var label = day.toLocaleDateString(OA.locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
      rows += '<tr><td>' + OA.esc(label) + '</td><td class="num ltr">' + hm(c.sunrise) + '</td><td class="num ltr">' + hm(c.sunset) +
        '</td><td class="num">' + (c.polar === 'day' ? OA.t('{0} Std', [24]) : c.polar === 'night' ? OA.t('{0} Std', [0]) : hmDur(c.daylightMinutes)) + '</td></tr>';
    }
    el.tbody.innerHTML = rows;

    OA.store.set('sonne', { place: OA.segVal(el.place), lat: pos.lat, lon: pos.lon, name: pos.name });
  }

  function setPos(lat, lon, name, key) {
    pos = { lat: lat, lon: lon, name: name };
    el.lat.value = OA.fmt(lat, 4); el.lon.value = OA.fmt(lon, 4);
    OA.segSet(el.place, key);
    render();
  }

  /* GPS (funktioniert ohne Internet, braucht aber freien Himmel und Zeit) */
  function geoError(err) {
    if (err && err.code === 1) return OA.t('Standortzugriff wurde verweigert. Erlaube ihn in den Browser- oder Geräteeinstellungen oder gib die Koordinaten selbst ein.');
    if (err && err.code === 3) return OA.t('Zeitüberschreitung: Das GPS braucht draußen oft eine halbe Minute oder länger. Nochmal versuchen oder Koordinaten eingeben.');
    return OA.t('Position nicht verfügbar. Gehe ins Freie und versuche es erneut, oder gib die Koordinaten selbst ein.');
  }
  el.gps.addEventListener('click', function () {
    if (!navigator.geolocation) { el.gpsMsg.textContent = OA.t('Dieses Gerät oder dieser Browser bietet keine Standortfunktion.'); return; }
    el.gps.disabled = true;
    el.gpsMsg.textContent = OA.t('Suche Position … Das funktioniert ohne Internet, kann draußen aber bis zu einer halben Minute dauern.');
    navigator.geolocation.getCurrentPosition(function (p) {
      el.gps.disabled = false;
      el.gpsMsg.textContent = OA.t('GPS-Position übernommen (Genauigkeit ca. {0} m).', [OA.fmt(p.coords.accuracy, 0)]);
      setPos(p.coords.latitude, p.coords.longitude, 'GPS-Position', 'custom');
    }, function (err) {
      el.gps.disabled = false;
      el.gpsMsg.textContent = geoError(err);
    }, { enableHighAccuracy: false, timeout: 30000, maximumAge: 600000 });
  });

  el.place.addEventListener('input', function () {
    var key = OA.segVal(el.place);
    if (PLACES[key]) setPos(PLACES[key].lat, PLACES[key].lon, PLACES[key].name, key);
    else { pos.name = 'Eigener Ort'; render(); }
  });

  function manual() {
    var lat = OA.num(el.lat.value), lon = OA.num(el.lon.value);
    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      el.gpsMsg.textContent = OA.t('Breite muss zwischen -90 und 90, Länge zwischen -180 und 180 liegen.');
      return;
    }
    el.gpsMsg.textContent = '';
    pos = { lat: lat, lon: lon, name: 'Eigener Ort' };
    OA.segSet(el.place, 'custom');
    render();
  }
  el.lat.addEventListener('input', manual); el.lon.addEventListener('input', manual);

  function todayStr() {
    var n = new Date();
    return n.getFullYear() + '-' + OA.pad(n.getMonth() + 1) + '-' + OA.pad(n.getDate());
  }
  el.date.value = todayStr();
  el.date.addEventListener('input', render); el.date.addEventListener('change', render);
  el.today.addEventListener('click', function () { el.date.value = todayStr(); render(); });

  var saved = OA.store.get('sonne', null);
  if (saved && isFinite(saved.lat) && isFinite(saved.lon)) {
    var key = PLACES[saved.place] ? saved.place : 'custom';
    pos = { lat: saved.lat, lon: saved.lon, name: PLACES[key] ? PLACES[key].name : (saved.name || 'Eigener Ort') };
    el.lat.value = OA.fmt(pos.lat, 4); el.lon.value = OA.fmt(pos.lon, 4);
    OA.segSet(el.place, key);
  } else {
    el.lat.value = OA.fmt(pos.lat, 4); el.lon.value = OA.fmt(pos.lon, 4);
    OA.segSet(el.place, 'waiblingen');
  }
  render();
})();
