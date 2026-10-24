/* Offline-Ark – Daten und Rechnung für "Sternbilder" (data/sternbilder.js).
 *
 * Sternpositionen: Yale Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991, CDS V/50),
 * Äquinoktium und Epoche J2000. Gegenprobe mit dem Hipparcos-Katalog (ESA 1997, CDS I/239,
 * auf J2000 fortgeschrieben): alle 37 Sterne weichen in der Position um weniger als 1 Bogensekunde ab.
 * Helligkeit: visuelle Helligkeit V aus dem BSC. Bei Navi (γ Cas, veränderlich), Alnitak und Meissa
 * (Doppelsterne) unterscheiden sich BSC und Hipparcos um mehr als 0,15 mag; dort steht der Mittelwert.
 * Die Helligkeit bestimmt nur die Punktgröße.
 * Rechnung: Julianisches Datum -> mittlere Sternzeit (Meeus, Astronomical Algorithms, Kap. 12),
 * Präzession J2000 -> Datum (Meeus Kap. 21, IAU 1976), Höhe/Azimut (Kap. 13),
 * Sonnenhöhe mit der einfachen Formel aus Kap. 25 (Genauigkeit etwa 0,01°).
 * Es wird nicht für die Strahlenbrechung korrigiert (am Horizont rund 0,5°).
 * Azimut zählt von Norden über Osten (N = 0°, O = 90°, S = 180°, W = 270°). */
(function () {
  'use strict';
  var RAD = Math.PI / 180;

  /* ra in Stunden, dec in Grad (J2000), mag = scheinbare Helligkeit */
  var STARS = {
    polaris: { name: 'Polarstern', bayer: 'α UMi', ra: 2.53019, dec: 89.2642, mag: 2.02 },
    kochab: { name: 'Kochab', bayer: 'β UMi', ra: 14.84508, dec: 74.1556, mag: 2.08 },
    pherkad: { name: 'Pherkad', bayer: 'γ UMi', ra: 15.34547, dec: 71.8339, mag: 3.05 },
    yildun: { name: 'Yildun', bayer: 'δ UMi', ra: 17.53692, dec: 86.5864, mag: 4.36 },
    epsumi: { name: 'ε UMi', bayer: 'ε UMi', ra: 16.76614, dec: 82.0372, mag: 4.23 },
    zetumi: { name: 'ζ UMi', bayer: 'ζ UMi', ra: 15.73431, dec: 77.7944, mag: 4.32 },
    etaumi: { name: 'η UMi', bayer: 'η UMi', ra: 16.29175, dec: 75.7553, mag: 4.95 },
    dubhe: { name: 'Dubhe', bayer: 'α UMa', ra: 11.06214, dec: 61.7508, mag: 1.79 },
    merak: { name: 'Merak', bayer: 'β UMa', ra: 11.03069, dec: 56.3825, mag: 2.37 },
    phecda: { name: 'Phecda', bayer: 'γ UMa', ra: 11.89717, dec: 53.6947, mag: 2.44 },
    megrez: { name: 'Megrez', bayer: 'δ UMa', ra: 12.25711, dec: 57.0325, mag: 3.31 },
    alioth: { name: 'Alioth', bayer: 'ε UMa', ra: 12.90047, dec: 55.9597, mag: 1.77 },
    mizar: { name: 'Mizar', bayer: 'ζ UMa', ra: 13.39875, dec: 54.9253, mag: 2.27 },
    alkaid: { name: 'Alkaid', bayer: 'η UMa', ra: 13.79233, dec: 49.3133, mag: 1.86 },
    schedar: { name: 'Schedar', bayer: 'α Cas', ra: 0.67514, dec: 56.5372, mag: 2.23 },
    caph: { name: 'Caph', bayer: 'β Cas', ra: 0.15297, dec: 59.1497, mag: 2.27 },
    navi: { name: 'Navi', bayer: 'γ Cas', ra: 0.94514, dec: 60.7167, mag: 2.3 },
    ruchbah: { name: 'Ruchbah', bayer: 'δ Cas', ra: 1.43028, dec: 60.2353, mag: 2.68 },
    segin: { name: 'Segin', bayer: 'ε Cas', ra: 1.90658, dec: 63.67, mag: 3.38 },
    betelgeuse: { name: 'Beteigeuze', bayer: 'α Ori', ra: 5.91953, dec: 7.4069, mag: 0.5 },
    rigel: { name: 'Rigel', bayer: 'β Ori', ra: 5.24231, dec: -8.2017, mag: 0.12 },
    bellatrix: { name: 'Bellatrix', bayer: 'γ Ori', ra: 5.41886, dec: 6.3497, mag: 1.64 },
    mintaka: { name: 'Mintaka', bayer: 'δ Ori', ra: 5.53344, dec: -0.2992, mag: 2.23 },
    alnilam: { name: 'Alnilam', bayer: 'ε Ori', ra: 5.60356, dec: -1.2019, mag: 1.7 },
    alnitak: { name: 'Alnitak', bayer: 'ζ Ori', ra: 5.67931, dec: -1.9428, mag: 1.9 },
    saiph: { name: 'Saiph', bayer: 'κ Ori', ra: 5.79594, dec: -9.6697, mag: 2.06 },
    meissa: { name: 'Meissa', bayer: 'λ Ori', ra: 5.58564, dec: 9.9342, mag: 3.5 },
    sirius: { name: 'Sirius', bayer: 'α CMa', ra: 6.75247, dec: -16.7161, mag: -1.46 },
    aldebaran: { name: 'Aldebaran', bayer: 'α Tau', ra: 4.59867, dec: 16.5092, mag: 0.85 },
    vega: { name: 'Wega', bayer: 'α Lyr', ra: 18.61564, dec: 38.7836, mag: 0.03 },
    deneb: { name: 'Deneb', bayer: 'α Cyg', ra: 20.69053, dec: 45.2803, mag: 1.25 },
    altair: { name: 'Atair', bayer: 'α Aql', ra: 19.84639, dec: 8.8683, mag: 0.77 },
    markab: { name: 'Markab', bayer: 'α Peg', ra: 23.07936, dec: 15.2053, mag: 2.49 },
    scheat: { name: 'Scheat', bayer: 'β Peg', ra: 23.06292, dec: 28.0828, mag: 2.42 },
    algenib: { name: 'Algenib', bayer: 'γ Peg', ra: 0.22061, dec: 15.1836, mag: 2.83 },
    alpheratz: { name: 'Alpheratz', bayer: 'α And', ra: 0.13981, dec: 29.0906, mag: 2.06 }
  };

  /* Sternbilder bzw. Sternfiguren. lines = Linien zwischen Sternen, label = Stern, an dem der Name steht. */
  var CONSTELLATIONS = [
    { id: 'uma', name: 'Großer Wagen', sub: 'im Großen Bären',
      stars: ['dubhe', 'merak', 'phecda', 'megrez', 'alioth', 'mizar', 'alkaid'],
      lines: [['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'], ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']],
      label: 'megrez', season: 'Das ganze Jahr sichtbar (zirkumpolar)' },
    { id: 'umi', name: 'Kleiner Bär', sub: 'Kleiner Wagen',
      stars: ['polaris', 'yildun', 'epsumi', 'zetumi', 'etaumi', 'pherkad', 'kochab'],
      lines: [['polaris', 'yildun'], ['yildun', 'epsumi'], ['epsumi', 'zetumi'], ['zetumi', 'etaumi'], ['etaumi', 'pherkad'], ['pherkad', 'kochab'], ['kochab', 'zetumi']],
      label: 'pherkad', season: 'Das ganze Jahr sichtbar (zirkumpolar)' },
    { id: 'cas', name: 'Kassiopeia', sub: 'das Himmels-W',
      stars: ['caph', 'schedar', 'navi', 'ruchbah', 'segin'],
      lines: [['caph', 'schedar'], ['schedar', 'navi'], ['navi', 'ruchbah'], ['ruchbah', 'segin']],
      label: 'navi', season: 'Das ganze Jahr sichtbar (zirkumpolar)' },
    { id: 'ori', name: 'Orion', sub: 'Wintersternbild',
      stars: ['betelgeuse', 'bellatrix', 'meissa', 'mintaka', 'alnilam', 'alnitak', 'saiph', 'rigel'],
      lines: [['betelgeuse', 'meissa'], ['meissa', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'], ['mintaka', 'alnilam'], ['alnilam', 'alnitak'], ['alnitak', 'saiph'], ['mintaka', 'rigel']],
      label: 'alnilam', season: 'Im Winterhalbjahr am Abendhimmel' },
    { id: 'sommer', name: 'Sommerdreieck', sub: 'Wega, Deneb, Atair',
      stars: ['vega', 'deneb', 'altair'],
      lines: [['vega', 'deneb'], ['deneb', 'altair'], ['altair', 'vega']],
      label: 'vega', season: 'Im Sommer und Herbst am Abendhimmel' },
    { id: 'peg', name: 'Pegasus-Viereck', sub: 'Herbstviereck',
      stars: ['markab', 'scheat', 'alpheratz', 'algenib'],
      lines: [['alpheratz', 'scheat'], ['scheat', 'markab'], ['markab', 'algenib'], ['algenib', 'alpheratz']],
      label: 'markab', season: 'Im Herbst am Abendhimmel' }
  ];

  /* Hilfssterne ohne eigene Figur */
  var EXTRA = ['sirius', 'aldebaran'];

  /* ---------- Zeit und Koordinaten ---------- */
  function mod(a, n) { return ((a % n) + n) % n; }

  /** Julianisches Datum (UT) zu einem JavaScript-Date. */
  function julianDay(date) { return date.getTime() / 86400000 + 2440587.5; }

  /** Mittlere Greenwich-Sternzeit in Grad. */
  function gmst(jd) {
    var d = jd - 2451545.0, T = d / 36525;
    return mod(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - T * T * T / 38710000, 360);
  }

  /** Mittlere Ortssternzeit in Stunden (lon in Grad, Osten positiv). */
  function localSiderealHours(jd, lon) { return mod(gmst(jd) + lon, 360) / 15; }

  /** Präzession von J2000 auf das Datum jd (Meeus 21.4). Ein- und Ausgabe in Grad. */
  function precess(raDeg, decDeg, jd) {
    var T = (jd - 2451545.0) / 36525;
    var as = Math.PI / 180 / 3600;
    var zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * as;
    var z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * as;
    var th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * as;
    var a0 = raDeg * RAD, d0 = decDeg * RAD;
    var A = Math.cos(d0) * Math.sin(a0 + zeta);
    var B = Math.cos(th) * Math.cos(d0) * Math.cos(a0 + zeta) - Math.sin(th) * Math.sin(d0);
    var C = Math.sin(th) * Math.cos(d0) * Math.cos(a0 + zeta) + Math.cos(th) * Math.sin(d0);
    return { ra: mod(Math.atan2(A, B) / RAD + z / RAD, 360), dec: Math.asin(Math.max(-1, Math.min(1, C))) / RAD };
  }

  /** Höhe und Azimut aus Rektaszension (Grad) und Deklination (Grad) für "jetzt". */
  function toHorizontal(raDeg, decDeg, jd, lat, lon) {
    var H = (gmst(jd) + lon - raDeg) * RAD, d = decDeg * RAD, f = lat * RAD;
    var sinAlt = Math.sin(d) * Math.sin(f) + Math.cos(d) * Math.cos(f) * Math.cos(H);
    var az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.cos(H) * Math.sin(f));
    return { alt: Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD, az: mod(az / RAD, 360), hourAngle: mod(H / RAD + 180, 360) - 180 };
  }

  /** Position eines Sterns aus STARS (J2000) am Himmel von (lat, lon) zum Zeitpunkt jd. */
  function starPosition(id, jd, lat, lon) {
    var s = STARS[id], p = precess(s.ra * 15, s.dec, jd);
    return toHorizontal(p.ra, p.dec, jd, lat, lon);
  }

  /** Höhe der Sonne in Grad (einfache Formel, auf etwa 0,01° genau). */
  function sunAltitude(jd, lat, lon) {
    var n = jd - 2451545.0;
    var L = mod(280.460 + 0.9856474 * n, 360), g = mod(357.528 + 0.9856003 * n, 360) * RAD;
    var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, eps = (23.439 - 0.0000004 * n) * RAD;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / RAD, dec = Math.asin(Math.sin(eps) * Math.sin(lam)) / RAD;
    return toHorizontal(ra, dec, jd, lat, lon).alt;
  }

  /** Stereografische Projektion mit Blickrichtung (centerAz, centerAlt). x nach rechts, y nach oben, Einheit: Radius der Hilfskugel. */
  function project(az, alt, centerAz, centerAlt) {
    var a = (az - centerAz) * RAD, h = alt * RAD, h0 = centerAlt * RAD;
    var cosc = Math.sin(h0) * Math.sin(h) + Math.cos(h0) * Math.cos(h) * Math.cos(a);
    if (cosc <= -0.999) return null;
    var k = 2 / (1 + cosc);
    return { x: k * Math.cos(h) * Math.sin(a), y: k * (Math.cos(h0) * Math.sin(h) - Math.sin(h0) * Math.cos(h) * Math.cos(a)) };
  }

  /** Winkelabstand zweier Himmelspunkte in Grad. */
  function separation(ra1, dec1, ra2, dec2) {
    var a1 = ra1 * RAD, a2 = ra2 * RAD, d1 = dec1 * RAD, d2 = dec2 * RAD;
    var c = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2);
    return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
  }

  /** Alle Sterne einer Zeit/Ort: { id: {alt, az} } */
  function skyAt(jd, lat, lon) {
    var out = {};
    Object.keys(STARS).forEach(function (id) { out[id] = starPosition(id, jd, lat, lon); });
    return out;
  }

  /** Sichtbarkeit einer Figur: 'full' (alle Hauptsterne über 5°), 'part' (mindestens ein Stern über dem Horizont), 'none'. */
  function visibility(c, sky) {
    var up = 0, high = 0;
    c.stars.forEach(function (id) { if (sky[id].alt > 0) up++; if (sky[id].alt > 5) high++; });
    return high === c.stars.length ? 'full' : up > 0 ? 'part' : 'none';
  }

  /** Höchster Punkt der Figur (Sterne mit der größten Höhe), für die Liste "jetzt sichtbar". */
  function bestAltitude(c, sky) {
    return Math.max.apply(null, c.stars.map(function (id) { return sky[id].alt; }));
  }

  /** Himmelsrichtung (N, NO, O, SO, S, SW, W, NW) zum Azimut. */
  function direction(az) { return ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(mod(az, 360) / 45) % 8]; }

  var SOURCES = [
    { name: 'Yale Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991), CDS VizieR V/50', url: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50', license: 'Messwerte; freie Nutzung mit Quellenangabe (CDS VizieR)', note: 'Positionen (J2000) und Helligkeiten der Sterne' },
    { name: 'The Hipparcos and Tycho Catalogues (ESA 1997), CDS VizieR I/239', url: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239', license: 'Messwerte; freie Nutzung mit Quellenangabe (CDS VizieR)', note: 'Gegenprobe der Positionen und Helligkeiten' },
    { name: 'Wikipedia – Polarstern', url: 'https://de.wikipedia.org/wiki/Polarstern', license: 'CC BY-SA 4.0', note: 'Abstand zum Himmelspol, Höhe gleich Breite, Verlängerung der Hinterachse' },
    { name: 'Wikipedia – Kassiopeia (Sternbild)', url: 'https://de.wikipedia.org/wiki/Kassiopeia_(Sternbild)', license: 'CC BY-SA 4.0', note: 'W-Form, Spitze zeigt zum Polarstern' },
    { name: 'Wikipedia – Orion (Sternbild)', url: 'https://de.wikipedia.org/wiki/Orion_(Sternbild)', license: 'CC BY-SA 4.0', note: 'Lage am Himmelsäquator, Gürtelsterne' },
    { name: 'Wikipedia – Sommerdreieck', url: 'https://de.wikipedia.org/wiki/Sommerdreieck', license: 'CC BY-SA 4.0', note: 'Wega, Deneb, Atair' },
    { name: 'Wikipedia – Pegasus (Sternbild)', url: 'https://de.wikipedia.org/wiki/Pegasus_(Sternbild)', license: 'CC BY-SA 4.0', note: 'Viereck am Herbsthimmel, Alpheratz gehört zur Andromeda' },
    { name: 'Wikipedia – Dämmerung', url: 'https://de.wikipedia.org/wiki/D%C3%A4mmerung', license: 'CC BY-SA 4.0', note: 'Dämmerung und Sonnenstand unter dem Horizont' },
    { name: 'Jean Meeus – Astronomical Algorithms (2nd ed., 1998)', url: '', license: 'Verfahren (Formeln); keine Daten übernommen', note: 'Formeln für Sternzeit, Präzession, Höhe und Azimut' }
  ];

  var API = {
    stars: STARS, constellations: CONSTELLATIONS, extra: EXTRA, sources: SOURCES,
    julianDay: julianDay, gmst: gmst, localSiderealHours: localSiderealHours, precess: precess,
    toHorizontal: toHorizontal, starPosition: starPosition, sunAltitude: sunAltitude, project: project,
    separation: separation, skyAt: skyAt, visibility: visibility, bestAltitude: bestAltitude, direction: direction
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.OA_STERNE = API;
})();
