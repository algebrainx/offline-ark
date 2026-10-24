/* Offline-Ark – Koordinaten & GPS.
 * Umrechnung Dezimalgrad <-> Grad/Min/Sek <-> UTM (WGS84, Krüger-Reihe nach Karney 2011),
 * Entfernung (Haversine) und Peilung (Anfangskurs), Wegpunkte, GPS. Alles lokal, ohne Netz. */
(function () {
  'use strict';

  var RAD = Math.PI / 180;
  var BANDS = 'CDEFGHJKLMNPQRSTUVWX';
  var R_EARTH = 6371008.8;                              // mittlerer Erdradius in Metern

  /* ---------- UTM (WGS84) ---------- */
  var WA = 6378137, WF = 1 / 298.257223563, K0 = 0.9996;
  var n = WF / (2 - WF), n2 = n * n, n3 = n2 * n, n4 = n3 * n;
  var E_ = Math.sqrt(WF * (2 - WF));
  var AA = WA / (1 + n) * (1 + n2 / 4 + n4 / 64);
  var ALPHA = [n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180, 13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440,
               61 * n3 / 240 - 103 * n4 / 140, 49561 * n4 / 161280];
  var BETA = [n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360, n2 / 48 + n3 / 15 - 437 * n4 / 1440,
              17 * n3 / 480 - 37 * n4 / 840, 4397 * n4 / 161280];
  var DELTA = [2 * n - 2 * n2 / 3 - 2 * n3 + 116 * n4 / 45, 7 * n2 / 3 - 8 * n3 / 5 - 227 * n4 / 45,
               56 * n3 / 15 - 136 * n4 / 35, 4279 * n4 / 630];

  function bandFor(lat) {
    if (lat < -80 || lat > 84) return null;
    return lat >= 72 ? 'X' : BANDS.charAt(Math.floor((lat + 80) / 8));
  }
  /** UTM-Zone inkl. Sonderfälle Norwegen (32V) und Spitzbergen (31X–37X). */
  function zoneFor(lat, lon) {
    var z = Math.floor((lon + 180) / 6) + 1;
    if (z > 60) z = 60;
    if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;
    if (lat >= 72 && lat < 84) {
      if (lon >= 0 && lon < 9) z = 31; else if (lon >= 9 && lon < 21) z = 33;
      else if (lon >= 21 && lon < 33) z = 35; else if (lon >= 33 && lon < 42) z = 37;
    }
    return z;
  }

  /** Dezimalgrad -> UTM. null außerhalb 80° S bis 84° N. */
  function toUTM(lat, lon) {
    var band = bandFor(lat);
    if (!band || !isFinite(lon)) return null;
    var zone = zoneFor(lat, lon);
    var lam0 = (zone * 6 - 183) * RAD;
    var dl = lon * RAD - lam0;
    dl = Math.atan2(Math.sin(dl), Math.cos(dl));
    var s = Math.sin(lat * RAD);
    var t = Math.sinh(Math.atanh(s) - E_ * Math.atanh(E_ * s));
    var xi0 = Math.atan2(t, Math.cos(dl));
    var eta0 = Math.atanh(Math.sin(dl) / Math.hypot(1, t));
    var xi = xi0, eta = eta0;
    for (var j = 1; j <= 4; j++) {
      xi += ALPHA[j - 1] * Math.sin(2 * j * xi0) * Math.cosh(2 * j * eta0);
      eta += ALPHA[j - 1] * Math.cos(2 * j * xi0) * Math.sinh(2 * j * eta0);
    }
    var north = lat >= 0;
    return { zone: zone, band: band, north: north, easting: 500000 + K0 * AA * eta, northing: (north ? 0 : 10000000) + K0 * AA * xi };
  }

  /** UTM -> Dezimalgrad. Die Halbkugel ergibt sich aus dem Band (ab N = Nord). */
  function fromUTM(zone, band, easting, northing) {
    var north = band.toUpperCase() >= 'N';
    var xi = (north ? northing : northing - 10000000) / (K0 * AA);
    var eta = (easting - 500000) / (K0 * AA);
    var xi0 = xi, eta0 = eta;
    for (var j = 1; j <= 4; j++) {
      xi0 -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
      eta0 -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    }
    var chi = Math.asin(Math.sin(xi0) / Math.cosh(eta0));
    var phi = chi;
    for (var k = 1; k <= 4; k++) phi += DELTA[k - 1] * Math.sin(2 * k * chi);
    var lam = (zone * 6 - 183) * RAD + Math.atan2(Math.sinh(eta0), Math.cos(xi0));
    return { lat: phi / RAD, lon: lam / RAD };
  }

  /* ---------- Entfernung und Richtung ---------- */
  function distance(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * RAD, p2 = lat2 * RAD, dp = (lat2 - lat1) * RAD, dl = (lon2 - lon1) * RAD;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function bearing(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD;
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return ((Math.atan2(y, x) / RAD) + 360) % 360;
  }
  var DIRS = [['N', 'Norden'], ['NO', 'Nordosten'], ['O', 'Osten'], ['SO', 'Südosten'],
              ['S', 'Süden'], ['SW', 'Südwesten'], ['W', 'Westen'], ['NW', 'Nordwesten']];
  function dirName(deg) { return DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]; }

  /* ---------- Formate ---------- */
  function toDMS(value) {
    var a = Math.abs(value);
    var total = Math.round(a * 3600 * 10) / 10;          // Sekunden auf 0,1 gerundet, damit "60,0" nicht vorkommt
    var d = Math.floor(total / 3600), m = Math.floor((total - d * 3600) / 60), s = Math.round((total - d * 3600 - m * 60) * 10) / 10;
    return { deg: d, min: m, sec: s, neg: value < 0 };
  }
  function comma(x, digits) { return x.toFixed(digits).replace('.', ','); }
  function fmtDecimal(lat, lon) {
    return comma(Math.abs(lat), 5) + '° ' + (lat < 0 ? 'S' : 'N') + ' · ' + comma(Math.abs(lon), 5) + '° ' + (lon < 0 ? 'W' : 'O');
  }
  function fmtDMS(lat, lon) {
    function one(v, pos, neg) {
      var p = toDMS(v);
      return p.deg + '° ' + p.min + '′ ' + comma(p.sec, 1) + '″ ' + (p.neg ? neg : pos);
    }
    return one(lat, 'N', 'S') + ' · ' + one(lon, 'O', 'W');
  }
  function fmtUTM(lat, lon) {
    var u = toUTM(lat, lon);
    if (!u) return null;
    return u.zone + u.band + ' ' + Math.round(u.easting) + ' ' + Math.round(u.northing);
  }

  /* ---------- Eingaben lesen ---------- */
  function num(s) {
    s = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
    return s === '' ? NaN : Number(s);
  }
  /** Einzelne Dezimalzahl mit optionalem Vorzeichen/Hemisphärenbuchstaben. isLat: N/S, sonst O/E/W. */
  function parseDecimalPart(text, isLat) {
    var s = String(text == null ? '' : text).trim().toUpperCase().replace(/[−–]/g, '-').replace('°', '');
    var m = /^([NSEOW])?\s*(-?\s*\d+(?:[.,]\d+)?)\s*([NSEOW])?$/.exec(s);
    if (!m) return NaN;
    var letter = m[1] || m[3] || '', v = num(m[2]);
    if (isLat && (letter === 'E' || letter === 'O' || letter === 'W')) return NaN;
    if (!isLat && (letter === 'N' || letter === 'S')) return NaN;
    if (letter === 'S' || letter === 'W') v = -Math.abs(v);
    return v;
  }
  function validLatLon(lat, lon) {
    return isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }
  /** Zone+Band wie "32U" lesen. */
  function parseZoneBand(text) {
    var m = /^\s*(\d{1,2})\s*([C-HJ-NP-X])\s*$/i.exec(String(text || ''));
    if (!m) return null;
    var z = Number(m[1]);
    return z >= 1 && z <= 60 ? { zone: z, band: m[2].toUpperCase() } : null;
  }
  function utmToPoint(zone, band, e, nn) {
    if (!(e >= 100000 && e <= 900000)) return { error: 'Der Ostwert liegt normalerweise zwischen 100000 und 900000 Metern.' };
    if (!(nn >= 0 && nn <= 10000000)) return { error: 'Der Nordwert muss zwischen 0 und 10000000 Metern liegen.' };
    var p = fromUTM(zone, band, e, nn);
    return validLatLon(p.lat, p.lon) ? p : { error: 'Diese UTM-Angabe ergibt keine gültige Position.' };
  }

  /** Freitext (Dezimal, Grad/Min/Sek, Grad/Dezimalminuten oder UTM) in eine Position umwandeln. */
  function parseAny(text) {
    var s = String(text == null ? '' : text).trim().replace(/[−–]/g, '-');
    if (!s) return { error: 'leer' };
    var u = /^(\d{1,2})\s*([A-Za-z])[\s,;]+(\d+(?:[.,]\d+)?)\s*m?\s*[EeOo]?[\s,;]+(\d+(?:[.,]\d+)?)\s*m?\s*[Nn]?$/.exec(s);
    if (u) {
      var zb = parseZoneBand(u[1] + u[2]);
      if (!zb) return { error: 'Zone/Band ungültig (z. B. 32U).' };
      return utmToPoint(zb.zone, zb.band, num(u[3]), num(u[4]));
    }
    var nums = [], starts = [], re = /\d+(?:[.,]\d+)?/g, mm;
    while ((mm = re.exec(s))) { nums.push(mm[0]); starts.push(mm.index); }
    var up = s.toUpperCase().replace(/SEK/g, '');
    var south = /S/.test(up), west = /W/.test(up);
    var parts = null, k = nums.length, second = k / 2;
    if (k === 2) parts = [[nums[0]], [nums[1]]];
    else if (k === 4) parts = [nums.slice(0, 2), nums.slice(2)];
    else if (k === 6) parts = [nums.slice(0, 3), nums.slice(3)];
    if (!parts) return { error: 'Nicht erkannt. Beispiel: 48,7758 9,1829' };
    function val(arr) {
      var v = num(arr[0]);
      if (arr[1] != null) { var mi = num(arr[1]); if (mi >= 60) return NaN; v += mi / 60; }
      if (arr[2] != null) { var se = num(arr[2]); if (se >= 60) return NaN; v += se / 3600; }
      return v;
    }
    var lat = val(parts[0]), lon = val(parts[1]);
    // Minus vor der jeweiligen Hälfte oder Buchstabe S / W
    var neg1 = /-\s*$/.test(s.slice(0, starts[0])) || south;
    var neg2 = /-\s*$/.test(s.slice(0, starts[second])) || west;
    if (neg1) lat = -lat;
    if (neg2) lon = -lon;
    return validLatLon(lat, lon) ? { lat: lat, lon: lon } : { error: 'Die Werte liegen außerhalb des gültigen Bereichs.' };
  }

  var api = {
    toUTM: toUTM, fromUTM: fromUTM, zoneFor: zoneFor, bandFor: bandFor, distance: distance, bearing: bearing, dirName: dirName,
    toDMS: toDMS, fmtDecimal: fmtDecimal, fmtDMS: fmtDMS, fmtUTM: fmtUTM, parseAny: parseAny, parseDecimalPart: parseDecimalPart,
    parseZoneBand: parseZoneBand
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- Oberfläche ---------- */
  var OA = window.OA;
  var $ = OA.$;
  var el = {
    go: $('#go'), gpsMsg: $('#gpsMsg'), fmt: $('#fmt'),
    panDez: $('#panDez'), panDms: $('#panDms'), panUtm: $('#panUtm'),
    latDez: $('#latDez'), lonDez: $('#lonDez'),
    latD: $('#latD'), latM: $('#latM'), latS: $('#latS'), latH: $('#latH'),
    lonD: $('#lonD'), lonM: $('#lonM'), lonS: $('#lonS'), lonH: $('#lonH'),
    zoneBand: $('#zoneBand'), utmE: $('#utmE'), utmN: $('#utmN'), inErr: $('#inErr'), out: $('#out'),
    target: $('#target'), targetMsg: $('#targetMsg'), arrow: $('#arrow'),
    distNum: $('#distNum'), distUnit: $('#distUnit'), distCap: $('#distCap'),
    wpName: $('#wpName'), wpSave: $('#wpSave'), wpErr: $('#wpErr'), wpList: $('#wpList'), wpExport: $('#wpExport')
  };

  var current = null;      // aktuelle Position {lat, lon}
  var gpsInfo = '';        // Text zur letzten GPS-Messung

  function save() {
    OA.store.set('koordinaten', {
      lat: current ? current.lat : null, lon: current ? current.lon : null,
      tab: OA.segVal(el.fmt), target: el.target.value
    });
  }

  /** Eingabefelder (außer dem gerade bedienten Format) mit der Position füllen. */
  function fillFields(p, skip) {
    if (skip !== 'dez') { el.latDez.value = comma(p.lat, 5); el.lonDez.value = comma(p.lon, 5); }
    if (skip !== 'dms') {
      var a = toDMS(p.lat), b = toDMS(p.lon);
      el.latD.value = a.deg; el.latM.value = a.min; el.latS.value = String(a.sec).replace('.', ',');
      el.lonD.value = b.deg; el.lonM.value = b.min; el.lonS.value = String(b.sec).replace('.', ',');
      OA.segSet(el.latH, a.neg ? 'S' : 'N'); OA.segSet(el.lonH, b.neg ? 'W' : 'E');
    }
    if (skip !== 'utm') {
      var u = toUTM(p.lat, p.lon);
      el.zoneBand.value = u ? u.zone + u.band : ''; el.utmE.value = u ? Math.round(u.easting) : ''; el.utmN.value = u ? Math.round(u.northing) : '';
    }
  }

  function readInput() {
    var f = OA.segVal(el.fmt);
    if (f === 'dez') {
      if (!el.latDez.value.trim() && !el.lonDez.value.trim()) return { empty: true };
      var lat = parseDecimalPart(el.latDez.value, true), lon = parseDecimalPart(el.lonDez.value, false);
      if (isNaN(lat) || isNaN(lon)) return { error: 'Bitte Breite und Länge als Zahl eingeben, z. B. 48,8310 und 9,3160.' };
      if (!validLatLon(lat, lon)) return { error: 'Breite: −90 bis 90, Länge: −180 bis 180.' };
      return { lat: lat, lon: lon };
    }
    if (f === 'dms') {
      var empty = !(el.latD.value + el.latM.value + el.latS.value + el.lonD.value + el.lonM.value + el.lonS.value).trim();
      if (empty) return { empty: true };
      function part(d, m, s) {
        var dv = num(d.value), mv = num(m.value || '0'), sv = num(s.value || '0');
        if (isNaN(dv) || isNaN(mv) || isNaN(sv) || dv < 0 || mv < 0 || sv < 0) return NaN;
        if (mv >= 60 || sv >= 60) return NaN;
        return dv + mv / 60 + sv / 3600;
      }
      var la = part(el.latD, el.latM, el.latS), lo = part(el.lonD, el.lonM, el.lonS);
      if (isNaN(la) || isNaN(lo)) return { error: 'Grad, Minuten und Sekunden als Zahlen eingeben (Minuten und Sekunden unter 60).' };
      if (OA.segVal(el.latH) === 'S') la = -la;
      if (OA.segVal(el.lonH) === 'W') lo = -lo;
      return validLatLon(la, lo) ? { lat: la, lon: lo } : { error: 'Breite: bis 90°, Länge: bis 180°.' };
    }
    // UTM: auch eine eingefügte Gesamtangabe im ersten Feld erlauben
    var all = el.zoneBand.value.trim();
    if (!all && !el.utmE.value.trim() && !el.utmN.value.trim()) return { empty: true };
    if (/\s/.test(all) && !parseZoneBand(all)) {
      var pa = parseAny(all);
      return pa.error ? { error: pa.error } : pa;
    }
    var zb = parseZoneBand(all);
    if (!zb) return { error: 'Zone und Band wie „32U“ eingeben (Zone 1–60, Band C–X).' };
    var e = num(el.utmE.value), nn = num(el.utmN.value);
    if (isNaN(e) || isNaN(nn)) return { error: 'Ostwert und Nordwert als Zahl in Metern eingeben.' };
    return utmToPoint(zb.zone, zb.band, e, nn);
  }

  function row(k, v) { return '<div class="fmtrow"><div class="k">' + OA.esc(k) + '</div><div class="v">' + OA.esc(v) + '</div></div>'; }

  function renderOut() {
    if (!current) {
      el.out.innerHTML = '<p class="muted" style="margin:0">Position eingeben oder per GPS holen. Dann erscheint sie hier in allen Formaten.</p>';
      return;
    }
    var utm = fmtUTM(current.lat, current.lon);
    el.out.innerHTML =
      row('Dezimalgrad', fmtDecimal(current.lat, current.lon)) +
      row('Grad, Minuten, Sekunden', fmtDMS(current.lat, current.lon)) +
      row('UTM (WGS84)', utm || 'nicht möglich (UTM gilt von 80° S bis 84° N)') +
      (gpsInfo ? '<div class="hint">' + OA.esc(gpsInfo) + '</div>' : '');
  }

  function distText(m) {
    if (m < 1000) return [OA.fmt(Math.round(m), 0), 'Meter'];
    if (m < 100000) return [OA.fmt(m / 1000, 1), 'Kilometer'];
    return [OA.fmt(Math.round(m / 1000), 0), 'Kilometer'];
  }

  function renderTarget() {
    var txt = el.target.value.trim();
    var t = txt ? parseAny(txt) : null;
    el.arrow.setAttribute('transform', 'rotate(0 50 50)');
    if (!txt || (t && t.error)) {
      el.distNum.textContent = '–'; el.distUnit.textContent = '';
      el.targetMsg.textContent = t && t.error ? t.error : 'Start ist die Position oben. Das Ziel in Dezimalgrad, Grad Min Sek oder UTM eingeben.';
      el.distCap.textContent = 'Start und Ziel eingeben.';
      return;
    }
    el.targetMsg.textContent = 'Ziel: ' + fmtDecimal(t.lat, t.lon);
    if (!current) {
      el.distNum.textContent = '–'; el.distUnit.textContent = '';
      el.distCap.textContent = 'Startposition fehlt: oben Position eingeben oder GPS holen.';
      return;
    }
    var m = distance(current.lat, current.lon, t.lat, t.lon);
    var b = bearing(current.lat, current.lon, t.lat, t.lon), d = dirName(b);
    var dt = distText(m);
    el.distNum.textContent = dt[0]; el.distUnit.textContent = dt[1];
    if (m < 1) { el.distCap.textContent = 'Du bist am Ziel.'; return; }
    el.distCap.textContent = 'Richtung ' + Math.round(b) % 360 + '° (' + d[0] + ', ' + d[1] + ') · Luftlinie, Richtwert';
    el.arrow.setAttribute('transform', 'rotate(' + b.toFixed(1) + ' 50 50)');
  }

  /** Neue Position übernehmen. skip: Format, dessen Felder gerade getippt werden. */
  function setCurrent(p, skip) {
    current = p ? { lat: p.lat, lon: p.lon } : null;
    if (current) fillFields(current, skip);
    renderOut(); renderTarget(); save();
  }

  function onInput() {
    var f = OA.segVal(el.fmt), r = readInput();
    el.inErr.textContent = r.error || '';
    gpsInfo = '';
    setCurrent(r.error || r.empty ? null : r, f);
  }
  [el.latDez, el.lonDez, el.latD, el.latM, el.latS, el.lonD, el.lonM, el.lonS, el.zoneBand, el.utmE, el.utmN].forEach(function (i) {
    i.addEventListener('input', onInput);
  });
  [el.latH, el.lonH].forEach(function (g) { g.addEventListener('input', onInput); });
  // Eine eingefügte Gesamtangabe ("32U 523191 5408717") nach dem Verlassen des Feldes auf die drei Felder verteilen
  el.zoneBand.addEventListener('change', function () {
    if (current && /\s/.test(el.zoneBand.value) && !parseZoneBand(el.zoneBand.value)) fillFields(current);
  });

  function showTab() {
    var f = OA.segVal(el.fmt);
    el.panDez.hidden = f !== 'dez'; el.panDms.hidden = f !== 'dms'; el.panUtm.hidden = f !== 'utm';
  }
  function clearFields() {
    [el.latDez, el.lonDez, el.latD, el.latM, el.latS, el.lonD, el.lonM, el.lonS, el.zoneBand, el.utmE, el.utmN].forEach(function (i) { i.value = ''; });
  }
  el.fmt.addEventListener('input', function () {
    showTab(); el.inErr.textContent = '';
    if (current) fillFields(current); else clearFields();
    save();
  });

  /* ---------- GPS ---------- */
  function geoError(err) {
    if (err && err.code === 1) return 'Standortzugriff verweigert. Erlaube ihn in den Browser- oder Geräteeinstellungen für diese Seite – oder gib die Position oben selbst ein.';
    if (err && err.code === 3) return 'Zeitüberschreitung: Noch keine Position gefunden. Gehe ins Freie mit freiem Blick zum Himmel und versuche es erneut. Das kann eine Minute dauern.';
    return 'Position nicht verfügbar. GPS braucht freien Himmel (nicht im Gebäude). Versuche es draußen noch einmal oder gib die Position selbst ein.';
  }
  el.go.addEventListener('click', function () {
    if (!navigator.geolocation) { el.gpsMsg.textContent = 'Dieses Gerät oder dieser Browser bietet keine Standortfunktion. Position bitte selbst eingeben.'; return; }
    el.go.disabled = true;
    el.gpsMsg.textContent = 'Suche Position … funktioniert ohne Internet, kann draußen aber bis zu einer Minute dauern.';
    navigator.geolocation.getCurrentPosition(function (p) {
      el.go.disabled = false;
      var c = p.coords, now = new Date();
      gpsInfo = 'GPS-Position um ' + OA.pad(now.getHours()) + ':' + OA.pad(now.getMinutes()) + ' Uhr, Genauigkeit ±' + OA.fmt(c.accuracy, 0) + ' m' +
        (c.altitude != null && isFinite(c.altitude) ? ', Höhe ca. ' + OA.fmt(c.altitude, 0) + ' m' : '') + '.';
      el.gpsMsg.textContent = c.accuracy > 100 ? 'Position gefunden, aber ungenau (±' + OA.fmt(c.accuracy, 0) + ' m). Ins Freie gehen und erneut versuchen.' : 'Position gefunden.';
      el.inErr.textContent = '';
      setCurrent({ lat: c.latitude, lon: c.longitude });
    }, function (err) {
      el.go.disabled = false;
      el.gpsMsg.textContent = geoError(err);
    }, { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 });
  });

  el.target.addEventListener('input', function () { renderTarget(); save(); });

  /* ---------- Wegpunkte ---------- */
  var wps = OA.store.get('wegpunkte', []);
  if (!Array.isArray(wps)) wps = [];

  function renderWps() {
    if (!wps.length) { el.wpList.innerHTML = '<p class="muted" style="margin:12px 0 0">Noch keine Wegpunkte gespeichert.</p>'; el.wpExport.disabled = true; return; }
    el.wpExport.disabled = false;
    el.wpList.innerHTML = wps.map(function (w, i) {
      return '<div class="wp"><div class="info"><div class="name">' + OA.esc(w.name) + '</div><div class="co">' +
        OA.esc(fmtDecimal(w.lat, w.lon)) + '</div><div class="co">UTM ' + OA.esc(fmtUTM(w.lat, w.lon) || '–') + '</div></div>' +
        '<button type="button" class="btn sm" data-act="target" data-i="' + i + '">Als Ziel</button>' +
        '<button type="button" class="btn sm danger" data-act="del" data-i="' + i + '" aria-label="' + OA.esc(w.name) + ' löschen">Löschen</button></div>';
    }).join('');
  }
  function saveWps() { OA.store.set('wegpunkte', wps); }

  el.wpSave.addEventListener('click', function () {
    if (!current) { el.wpErr.textContent = 'Zuerst oben eine Position eingeben oder per GPS holen.'; return; }
    el.wpErr.textContent = '';
    var name = el.wpName.value.trim() || 'Wegpunkt ' + (wps.length + 1);
    wps.push({ id: Date.now().toString(36), name: name, lat: current.lat, lon: current.lon, t: new Date().toISOString() });
    saveWps(); renderWps();
    el.wpName.value = '';
  });
  el.wpList.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var i = Number(b.getAttribute('data-i')), w = wps[i];
    if (!w) return;
    if (b.getAttribute('data-act') === 'target') {
      el.target.value = comma(w.lat, 5) + '; ' + comma(w.lon, 5);
      renderTarget(); save();
      el.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (confirm('Wegpunkt „' + w.name + '“ löschen?')) {
      wps.splice(i, 1); saveWps(); renderWps();
    }
  });
  el.wpExport.addEventListener('click', function () {
    OA.download('wegpunkte-' + OA.today() + '.json', JSON.stringify({ app: 'offline-ark', typ: 'wegpunkte', version: 1, wegpunkte: wps }, null, 2));
  });

  /* ---------- Start ---------- */
  var s = OA.store.get('koordinaten', null);
  if (s) {
    if (s.tab) OA.segSet(el.fmt, s.tab);
    if (typeof s.target === 'string') el.target.value = s.target;
    if (isFinite(s.lat) && isFinite(s.lon) && s.lat !== null && s.lon !== null) current = { lat: s.lat, lon: s.lon };
  }
  showTab();
  if (current) fillFields(current);
  renderOut(); renderTarget(); renderWps();
})();
