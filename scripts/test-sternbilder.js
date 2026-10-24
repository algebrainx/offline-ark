/* Test der Sternen-Rechnung für "Sternbilder": node scripts/test-sternbilder.js
 * Prüft Sternzeit, Präzession, Höhe/Azimut und die Projektion gegen bekannte Werte. */
'use strict';
var assert = require('assert');
var S = require('../data/sternbilder.js');
var LAT = 48.8310, LON = 9.3160;          // Waiblingen
var RAD = Math.PI / 180;
function close(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= tol, msg + ': ' + a + ' vs ' + b + ' (±' + tol + ')'); }
function utc(y, m, d, h, mi) { return S.julianDay(new Date(Date.UTC(y, m - 1, d, h || 0, mi || 0))); }

// Julianisches Datum und Sternzeit: Meeus, Beispiel 12.a (1987-04-10 0:00 UT: JD 2446895.5, GMST 13h10m46.3668s)
var jd0 = utc(1987, 4, 10, 0, 0);
close(jd0, 2446895.5, 1e-6, 'JD 1987-04-10');
close(S.gmst(jd0) / 15, 13 + 10 / 60 + 46.3668 / 3600, 1e-4, 'GMST 1987-04-10 0h UT');
// J2000.0: JD 2451545.0 = 2000-01-01 12:00 UT, GMST = 18h41m50.55s
close(S.gmst(utc(2000, 1, 1, 12, 0)) / 15, 18 + 41 / 60 + 50.55 / 3600, 1e-4, 'GMST J2000');

// Präzession: Meeus Beispiel 21.b (θ Persei, 2000 -> 2028-11-13.19 TD): α 41,5472°, δ 49,3485°
(function () {
  var jd = 2462088.69;
  var p = S.precess(41.054063, 49.227750, jd);
  close(p.ra, 41.547214, 2e-4, 'Präzession RA (Meeus 21.b)');
  close(p.dec, 49.348483, 2e-4, 'Präzession Dec (Meeus 21.b)');
})();

// Höhe/Azimut: Meeus Beispiel 13.b (Venus, Washington): h = 15,1249°, A (von Süden) = 68,0337° -> von Norden 248,0337°
(function () {
  var jd = S.julianDay(new Date(Date.UTC(1987, 3, 10, 19, 21, 0)));
  var p = S.toHorizontal(347.3193375, -6.719892, jd, 38.921389, -77.065556);
  close(p.alt, 15.1249, 0.02, 'Höhe Venus');
  close(p.az, 248.0337, 0.03, 'Azimut Venus');
})();

// Polarstern in Waiblingen: Höhe = Breite ± Poldistanz (heute etwa 0,66°), Azimut nahe Nord
(function () {
  var jd = utc(2026, 10, 24, 0, 0), lo = 99, hi = -99, azMin = 999, azMax = -999;
  for (var m = 0; m < 24 * 60; m += 5) {
    var p = S.starPosition('polaris', jd + m / 1440, LAT, LON);
    lo = Math.min(lo, p.alt); hi = Math.max(hi, p.alt);
    var az = p.az > 180 ? p.az - 360 : p.az; azMin = Math.min(azMin, az); azMax = Math.max(azMax, az);
  }
  var pp = S.precess(S.stars.polaris.ra * 15, S.stars.polaris.dec, jd);
  var poleDist = 90 - pp.dec;
  assert.ok(poleDist > 0.6 && poleDist < 0.72, 'Poldistanz 2026 ~0,66°: ' + poleDist);       // Wikipedia: "etwa 0,7°"
  close(hi, LAT + poleDist, 0.02, 'Polarstern oberer Kulminationspunkt');
  close(lo, LAT - poleDist, 0.02, 'Polarstern unterer Kulminationspunkt');
  assert.ok(lo > LAT - 0.8 && hi < LAT + 0.8, 'Höhe bleibt innerhalb Breite ± 0,8°');
  assert.ok(azMin > -1.3 && azMax < 1.3, 'Azimut bleibt nahe Norden: ' + azMin + '..' + azMax);
})();

// Wega: obere Kulmination in 90° - |Breite - Deklination| = 79,95°; Durchgang Mitte August am späten Abend im Süden
(function () {
  var best = null, jd = utc(2026, 8, 15, 12, 0);
  for (var m = 0; m < 24 * 60; m++) {
    var p = S.starPosition('vega', jd + m / 1440, LAT, LON);
    if (!best || p.alt > best.alt) best = { alt: p.alt, m: m, az: p.az };
  }
  close(best.alt, 90 - Math.abs(LAT - 38.7836), 0.15, 'Wega Kulminationshöhe');
  close(best.az, 180, 1, 'Wega kulminiert im Süden');
  var utcHours = (12 * 60 + best.m) / 60 % 24;   // ab 12 UT des Starttags
  // Mitteleuropäische Zeit = UT + 1; Wikipedia: Mitte August steht das Sommerdreieck gegen 22 Uhr MEZ im Süden (Mitte der Figur, Wega etwas früher)
  assert.ok(utcHours + 1 > 20.5 && utcHours + 1 < 22.5, 'Wega-Durchgang Mitte August ca. 21-22 Uhr MEZ: ' + (utcHours + 1));
})();

// Sirius: kulminiert Ende Dezember um Mitternacht, höchste Höhe in Mitteleuropa gut 24°
(function () {
  var jd = utc(2026, 12, 30, 12, 0), best = null;
  for (var m = 0; m < 24 * 60; m++) {
    var p = S.starPosition('sirius', jd + m / 1440, LAT, LON);
    if (!best || p.alt > best.alt) best = { alt: p.alt, m: m };
  }
  close(best.alt, 90 - (LAT + 16.7161), 0.2, 'Sirius Kulminationshöhe (~24,5°)');
  var h = ((12 * 60 + best.m) / 60) % 24 + 1;          // in MEZ
  assert.ok(h > 23 || h < 1, 'Sirius um Silvester gegen Mitternacht: ' + h);
})();

// Orion liegt am Himmelsäquator: der Gürtelstern Mintaka geht fast genau im Osten auf
(function () {
  var jd = utc(2026, 12, 1, 12, 0), prev = null, rise = null;
  for (var m = 0; m < 24 * 60; m++) {
    var p = S.starPosition('mintaka', jd + m / 1440, LAT, LON);
    if (prev && prev.alt < 0 && p.alt >= 0) rise = p;
    prev = p;
  }
  assert.ok(rise, 'Mintaka geht auf');
  close(rise.az, 90, 1.5, 'Aufgang im Osten');
})();

// Großer Wagen: Verlängerung Merak -> Dubhe um etwa das Fünffache führt zum Polarstern
(function () {
  var st = S.stars;
  function v(id) { var a = st[id].ra * 15 * RAD, d = st[id].dec * RAD; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  var sepMD = S.separation(st.merak.ra * 15, st.merak.dec, st.dubhe.ra * 15, st.dubhe.dec);
  var sepDP = S.separation(st.dubhe.ra * 15, st.dubhe.dec, st.polaris.ra * 15, st.polaris.dec);
  close(sepMD, 5.4, 0.3, 'Abstand Merak-Dubhe ~5,4°');
  close(sepDP / sepMD, 5, 0.5, 'Dubhe-Polaris = ~5 x Merak-Dubhe');
  var n = cross(v('merak'), v('dubhe')), nl = Math.sqrt(dot(n, n));
  var off = Math.abs(Math.asin(dot(n, v('polaris')) / nl)) / RAD;       // Abstand des Polarsterns von der Großkreis-Linie
  // gerechnet knapp 2° (Wikipedia nennt etwa 1,5 Monddurchmesser = 0,75°); die Linie führt jedenfalls nahe am Polarstern vorbei
  assert.ok(off < 2.5, 'Polarstern liegt nahe der Linie: ' + off + '°');
})();

// Die Kassiopeia liegt auf der anderen Seite des Pols: Rektaszensionen von Dubhe (~11 h) und Schedar (~0,7 h) unterscheiden sich um etwa 10-11 h
(function () {
  var d = Math.abs(S.stars.dubhe.ra - S.stars.schedar.ra);
  assert.ok(d > 9.5 && d < 12, 'Gegenüberliegende Seiten: ' + d + ' h');
})();

// Projektion (stereografisch): Mittelpunkt -> (0,0); Abstand d zum Zentrum -> r = 2 tan(d/2)
(function () {
  var c = S.project(0, 40, 0, 40);
  close(c.x, 0, 1e-12, 'Zentrum x'); close(c.y, 0, 1e-12, 'Zentrum y');
  var up = S.project(0, 60, 0, 40);
  close(up.y, 2 * Math.tan(10 * RAD), 1e-9, 'y nach oben'); close(up.x, 0, 1e-12, 'x');
  var east = S.project(90, 0, 0, 0);                                       // 90° rechts vom Blickpunkt am Horizont
  close(east.x, 2 * Math.tan(45 * RAD), 1e-9, 'Osten rechts bei Blick nach Norden');
  var west = S.project(270, 0, 0, 0);
  close(west.x, -east.x, 1e-9, 'Westen links');
  var far = S.project(180, 40, 0, 40);                                     // 100° vom Zentrum entfernt: r = 2 tan(50°)
  close(Math.hypot(far.x, far.y), 2 * Math.tan(50 * RAD), 1e-9, 'Abstand 100°');
  assert.strictEqual(S.project(180, -40, 0, 40), null, 'Gegenpunkt nicht abbildbar');
  var w2 = S.project(270, 20, 180, 40);
  assert.ok(w2.x > 0, 'Blick nach Süden: Westen rechts');
  var a = S.project(5, 0, 0, 0), b = S.project(-5, 0, 0, 0);
  close(a.x - b.x, 4 * Math.tan(2.5 * RAD), 1e-9, 'Horizont-Abstand');
  // gleicher Winkelabstand vom Zentrum ergibt gleichen Abstand auf der Karte (Kreise bleiben Kreise um die Mitte)
  var p1 = S.project(30, 40, 0, 40), p2 = S.project(-30, 40, 0, 40);
  close(Math.hypot(p1.x, p1.y), Math.hypot(p2.x, p2.y), 1e-12, 'Symmetrie');
})();

// Sonne: am 21. Juni mittags in Waiblingen etwa 64,6° (= 90 - 48,83 + 23,44); Wintersonnenwende tiefster Stand
(function () {
  var noon = -999;
  for (var m = 0; m < 24 * 60; m += 2) noon = Math.max(noon, S.sunAltitude(utc(2026, 6, 21, 0, 0) + m / 1440, LAT, LON));
  close(noon, 90 - LAT + 23.44, 0.15, 'Sonnenhöhe Sommersonnenwende');
  var low = 999;
  for (var k = 0; k < 24 * 60; k += 2) low = Math.min(low, S.sunAltitude(utc(2026, 12, 21, 0, 0) + k / 1440, LAT, LON));
  close(low, -(90 - LAT) - 23.44, 0.15, 'Sonne tiefster Stand Wintersonnenwende');
})();

// Sichtbarkeit: Kassiopeia, Großer Wagen und Kleiner Bär sind in Waiblingen immer (zumindest teilweise) über dem Horizont
(function () {
  var cons = {}; S.constellations.forEach(function (c) { cons[c.id] = c; });
  var jd = utc(2026, 3, 1, 0, 0);
  for (var m = 0; m < 24 * 60; m += 30) {
    var sky = S.skyAt(jd + m / 1440, LAT, LON);
    assert.notStrictEqual(S.visibility(cons.umi, sky), 'none', 'Kleiner Bär immer teilweise sichtbar');
    assert.notStrictEqual(S.visibility(cons.cas, sky), 'none', 'Kassiopeia');
    assert.notStrictEqual(S.visibility(cons.uma, sky), 'none', 'Großer Wagen');
  }
  // Orion steht im Dezember um Mitternacht hoch im Süden, im Juli abends nicht über dem Horizont
  var dec = S.skyAt(utc(2026, 12, 15, 23, 0), LAT, LON), jul = S.skyAt(utc(2026, 7, 15, 22, 0), LAT, LON);
  assert.strictEqual(S.visibility(cons.ori, dec), 'full');
  assert.strictEqual(S.visibility(cons.ori, jul), 'none');
})();

// Daten: jeder Stern einer Figur existiert; Linien nutzen Sterne der Figur; Wertebereiche
S.constellations.forEach(function (c) {
  c.stars.forEach(function (id) { assert.ok(S.stars[id], c.id + ': Stern fehlt ' + id); });
  c.lines.forEach(function (l) { l.forEach(function (id) { assert.ok(c.stars.indexOf(id) >= 0, c.id + ': Linie mit fremdem Stern ' + id); }); });
  assert.ok(c.stars.indexOf(c.label) >= 0, c.id + ': Beschriftungsstern');
});
Object.keys(S.stars).forEach(function (id) {
  var s = S.stars[id];
  assert.ok(s.ra >= 0 && s.ra < 24 && s.dec >= -90 && s.dec <= 90 && s.mag > -2 && s.mag < 6, id + ': Wertebereich');
});
// Bekannte Katalogwerte (J2000): Wega 18h36m56.3s +38°47'01", Deneb 20h41m25.9s +45°16'49", Atair 19h50m47.0s +08°52'06"
close(S.stars.vega.ra, 18 + 36 / 60 + 56.3 / 3600, 2e-4, 'Wega RA'); close(S.stars.vega.dec, 38 + 47 / 60 + 1 / 3600, 2e-4, 'Wega Dec');
close(S.stars.deneb.ra, 20 + 41 / 60 + 25.9 / 3600, 2e-4, 'Deneb RA'); close(S.stars.deneb.dec, 45 + 16 / 60 + 49 / 3600, 2e-4, 'Deneb Dec');
close(S.stars.altair.ra, 19 + 50 / 60 + 47.0 / 3600, 2e-4, 'Atair RA'); close(S.stars.altair.dec, 8 + 52 / 60 + 6 / 3600, 2e-4, 'Atair Dec');
close(S.stars.polaris.ra, 2 + 31 / 60 + 49.09 / 3600, 3e-4, 'Polarstern RA'); close(S.stars.polaris.dec, 89 + 15 / 60 + 50.8 / 3600, 2e-4, 'Polarstern Dec');
assert.strictEqual(S.direction(0), 'N'); assert.strictEqual(S.direction(100), 'O'); assert.strictEqual(S.direction(359), 'N'); assert.strictEqual(S.direction(200), 'S');

// Orion: Die Linie durch die Gürtelsterne führt (verlängert) in etwa zu Sirius; Sirius ist der hellste Stern des Katalogs
(function () {
  var st = S.stars;
  function v(id) { var a = st[id].ra * 15 * RAD, d = st[id].dec * RAD; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  var n = cross(v('mintaka'), v('alnitak')), nl = Math.sqrt(dot(n, n));
  var off = Math.abs(Math.asin(dot(n, v('sirius')) / nl)) / RAD;
  assert.ok(off < 4, 'Gürtellinie führt nahe an Sirius vorbei: ' + off + '°');
  assert.ok(S.stars.sirius.mag < S.stars.vega.mag && Object.keys(st).every(function (id) { return st[id].mag >= st.sirius.mag; }), 'Sirius ist der hellste Stern');
  // Polarstern liegt etwa in der Mitte zwischen Dubhe (Großer Wagen) und Navi (Kassiopeia)
  var a = S.separation(st.dubhe.ra * 15, st.dubhe.dec, st.polaris.ra * 15, st.polaris.dec), b = S.separation(st.navi.ra * 15, st.navi.dec, st.polaris.ra * 15, st.polaris.dec);
  assert.ok(Math.abs(a - b) < 3, 'Polarstern etwa mittig zwischen Wagen und Kassiopeia: ' + a + ' / ' + b);
})();

// Dämmerung, Zenit: Karte in der Sicht nach Norden zeigt den Polarstern oberhalb der Mitte der Horizontlinie
(function () {
  var jd = utc(2026, 10, 24, 20, 0), p = S.starPosition('polaris', jd, LAT, LON);
  var pr = S.project(p.az, p.alt, 0, 40), hz = S.project(0, 0, 0, 40);
  assert.ok(Math.abs(pr.x) < 0.03 && pr.y > hz.y, 'Polarstern nahe der Mittellinie und über dem Horizont');
})();

// Übersetzungen (Seite, Skript, Daten)
var LABELED = ['polaris', 'dubhe', 'merak', 'vega', 'deneb', 'altair', 'betelgeuse', 'rigel', 'sirius', 'aldebaran'];
require('./lib/tool-i18n-check.js')({
  id: 'sternbilder',
  data: [S.constellations.map(function (c) { return { name: c.name, sub: c.sub, season: c.season }; }),
    S.sources.map(function (s) { return { license: s.license, note: s.note }; })],
  dataFields: ['name', 'sub', 'season', 'license', 'note'],
  extra: LABELED.map(function (id) { return S.stars[id].name; }).concat(['ganz sichtbar', 'teilweise sichtbar']),
  htmlIgnore: ['Waiblingen'], jsIgnore: ['Waiblingen']
});

console.log('Sternbilder: alle Tests bestanden');
