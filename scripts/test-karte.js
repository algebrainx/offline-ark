#!/usr/bin/env node
/* Tests für die Offline-Karte: Projektion, Entfernung, nächste Punkte, Datenformat, Overpass-Skript (mit Mock-Server), PBF-Leser. */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const K = require('../js/karte-core.js');

let n = 0;
function ok(cond, msg) { assert.ok(cond, msg); n++; }
function near(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' erwartet ' + b + ' ±' + tol + ', war ' + a); n++; }

/* ---------- Projektion ---------- */
near(K.norm(0, 0).x, 0.5, 1e-12); near(K.norm(0, 0).y, 0.5, 1e-12);
near(K.toWorld(0, 180, 0).x, 256, 1e-9, 'Länge 180 bei Zoom 0');
near(K.metersPerPixel(0, 0), 156543.03392, 1e-3, 'Meter je Pixel am Äquator, Zoom 0');
near(K.metersPerPixel(48.8, 10), 156543.03392 * Math.cos(48.8 * Math.PI / 180) / 1024, 1e-6);
// Kachel von Waiblingen (48.831 N, 9.316 E) bei Zoom 10 nach der Standardformel aus dem OSM-Wiki
(function () {
  const lat = 48.831, lon = 9.316, z = 10, N = Math.pow(2, z), r = lat * Math.PI / 180;
  const x = Math.floor((lon + 180) / 360 * N), y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * N);
  const w = K.toWorld(lat, lon, z);
  ok(Math.floor(w.x / 256) === x && Math.floor(w.y / 256) === y, 'Kachel ' + x + '/' + y);
  ok(x === 538 && y === 352, 'bekannte Kachel 10/538/352 (Raum Stuttgart)');
})();
for (const [lat, lon, z] of [[48.831, 9.316, 12], [0, 0, 3], [-33.86, 151.21, 8], [78.2, 15.6, 5], [52.52, 13.405, 16.4]]) {
  const w = K.toWorld(lat, lon, z), b = K.fromWorld(w.x, w.y, z);
  near(b.lat, lat, 1e-9, 'Rundlauf lat'); near(b.lon, lon, 1e-9, 'Rundlauf lon');
}

/* ---------- Entfernung und Richtung (Referenz: pyproj/WGS84 bzw. Kugelformel) ---------- */
near(K.distance(48.8310, 9.3160, 48.7758, 9.1829) / 1000, 11.519, 0.01, 'Waiblingen–Stuttgart');
near(K.bearing(48.8310, 9.3160, 48.7758, 9.1829), 237.9, 0.1);
near(K.distance(52.52, 13.405, 48.1351, 11.582) / 1000, 504.4, 0.2, 'Berlin–München');
near(K.bearing(52.52, 13.405, 48.1351, 11.582), 195.6, 0.1);
near(K.distance(0, 0, 0, 1) / 1000, 111.2, 0.05);
ok(K.dirIndex(0) === 0 && K.dirIndex(44) === 1 && K.dirIndex(359) === 0 && K.dirIndex(225) === 5 && K.dirIndex(270) === 6);
ok(K.distParts(850)[1] === 'm' && K.distParts(1234)[0] === 1.2 && K.distParts(12500)[0] === 13);
const ns = K.niceScale(10, 100); ok(ns.meters === 1000 && Math.abs(ns.px - 100) < 1e-9); ok(K.niceScale(0.3, 120).meters === 20);

/* ---------- Suche: im Rechteck und nächste Punkte ---------- */
(function () {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const items = [];
  for (let i = 0; i < 3000; i++) items.push([47.5 + rnd() * 2.3, 7.5 + rnd() * 3, 'h', 'P' + i]);
  items.sort((a, b) => a[0] - b[0]);
  const s = 48.5, w = 9, nn = 48.9, e = 9.6;
  const brute = items.filter(i => i[0] >= s && i[0] <= nn && i[1] >= w && i[1] <= e);
  const fast = K.inBounds(items, s, w, nn, e);
  ok(fast.length === brute.length && fast.every((x, i) => x === brute[i]), 'inBounds = brute force (' + fast.length + ')');
  const lat = 48.83, lon = 9.32;
  const exact = items.map(i => ({ i, d: K.distance(lat, lon, i[0], i[1]) })).sort((a, b) => a.d - b.d).slice(0, 5);
  const got = K.nearest(items, lat, lon, 5);
  ok(got.length === 5 && got.every((g, k) => g.item === exact[k].i), 'nearest = brute force');
  near(got[0].dist, exact[0].d, 1e-6);
  ok(got.every((g, k) => k === 0 || g.dist >= got[k - 1].dist), 'aufsteigend');
  ok(K.nearest(items, lat, lon, 3, it => it[3] === 'P1').length <= 1, 'Filter');
  ok(K.nearest([], 0, 0, 5).length === 0);
})();
ok(K.tilePath('../b/{z}/{x}/{y}', 3, 4, 5) === '../b/3/4/5');
ok(K.coordText(48.831, 9.316) === '48.83100, 9.31600');

/* ---------- Datendateien ---------- */
(function () {
  global.window = global;
  const read = f => fs.readFileSync(path.join(ROOT, 'data', f), 'utf8');
  const sizes = {};
  ['karte-config.js', 'karte-regions.js', 'karte-base.js'].forEach(f => { sizes[f] = read(f).length; });
  vm(read('karte-config.js')); vm(read('karte-regions.js')); vm(read('karte-base.js'));
  const base = window.OA_KARTE_BASE;
  ok(base && base.land.length > 5 && base.states.some(s => s.n === 'Baden-Württemberg') && base.lakes.some(l => l.n === 'Bodensee'), 'Grundkarte: Deutschland, BW, Bodensee');
  ['Rhein', 'Donau', 'Neckar', 'Main'].forEach(r => ok(base.rivers.some(x => x.n === r) || base.rivers.some(x => x.n === 'Rhine'), 'Fluss ' + r));
  const bw = base.states.find(s => s.n === 'Baden-Württemberg');
  const line = K.decodeLine(bw.r[0], base.scale);
  let inside = true;
  for (let i = 0; i < line.length; i += 2) { const p = K.unnorm(line[i], line[i + 1]); if (p.lat < 47.4 || p.lat > 49.9 || p.lon < 7.4 || p.lon > 10.6) inside = false; }
  ok(inside, 'BW-Umriss liegt im erwarteten Rechteck');
  const regs = window.OA_KARTE_REGIONS; ok(Array.isArray(regs) && regs[0].id === 'bw' && regs[0].stand, 'Region bw');
  let total = 0, poi = 0;
  const TYPES = { hospital: 'hH', pharmacy: 'a', defib: 'd', fire: 'fpns', water: 'wbq' };
  Object.keys(regs[0].files).forEach(cat => {
    const f = regs[0].files[cat].replace(/^data\//, ''); const txt = read(f); poi += txt.length; total += txt.length;
    vm(txt);
    const part = window.OA_KARTE_POI[cat].filter(p => p.region === 'bw')[0];
    ok(part && part.items.length === regs[0].counts[cat], cat + ': Anzahl stimmt mit Verzeichnis');
    let prev = -90;
    part.items.forEach(it => {
      ok(it.length === 4 && it[0] >= 47.4 && it[0] <= 49.9 && it[1] >= 7.4 && it[1] <= 10.6, 'Koordinate im BW-Rechteck ' + JSON.stringify(it));
      ok(TYPES[cat].includes(it[2]), 'Typ ' + it[2] + ' in ' + cat);
      ok(it[0] >= prev, 'nach Breite sortiert'); prev = it[0];
    });
  });
  // Nähe Waiblingen muss es Krankenhäuser, Apotheken und Feuerwehr geben
  const near5 = (cat) => K.nearest(window.OA_KARTE_POI[cat][0].items, 48.831, 9.316, 1)[0];
  ok(near5('hospital').dist < 8000, 'Krankenhaus bei Waiblingen: ' + Math.round(near5('hospital').dist) + ' m');
  ok(near5('pharmacy').dist < 2000 && near5('fire').dist < 3000 && near5('water').dist < 5000 && near5('defib').dist < 1500, 'Apotheke/Feuerwehr/Wasser/AED nahe Waiblingen');
  vm(read('karte-geo-bw.js')); vm(read('karte-gemeinden-bw.js'));
  const g = window.OA_KARTE_GEO.bw; ok(g.kreise.length > 1000 && g.kreisNames.length >= 40 && g.rivers.length > 500 && g.places.some(p => p[3] === 'Waiblingen'), 'Geodaten BW');
  ok(g.kreisNames.some(k => /Rems-Murr/.test(k[2])), 'Rems-Murr-Kreis beschriftet');
  const gem = window.OA_KARTE_GEMEINDEN.bw; ok(gem.lines.length > 3000, 'Gemeindegrenzen');
  const baseKb = (read('karte-base.js').length + read('karte-geo-bw.js').length + read('karte-gemeinden-bw.js').length) / 1024;
  ok(baseKb < 1536, 'Kartendaten < 1,5 MB (' + Math.round(baseKb) + ' KB)');
  ok(poi / 1024 < 2560, 'POI-Daten < 2,5 MB (' + Math.round(poi / 1024) + ' KB)');
  console.log('  Größen: Grundkarte+Geo ' + Math.round(baseKb) + ' KB, POI ' + Math.round(poi / 1024) + ' KB');
})();
function vm(code) { new Function(code)(); }       // Datei im globalen window-Kontext auswerten (window = global)

/* ---------- Weltkarte: Daten, Namen, Geometrie, weltweite Entfernungen ---------- */
(function () {
  global.window = global;
  const read = f => fs.readFileSync(path.join(ROOT, 'data', f), 'utf8');
  const wTxt = read('karte-world.js'), cTxt = read('karte-world-cities.js');
  const kb = (wTxt.length + cTxt.length) / 1024;
  ok(kb < 2560, 'Weltdaten < 2,5 MB (' + Math.round(kb) + ' KB)');
  vm(wTxt); vm(cTxt);
  const W = window.OA_KARTE_WORLD, C = window.OA_KARTE_WORLD_CITIES;
  ok(W && W.countries.length >= 190 && W.lakes.length > 20 && /Public Domain/.test(W.source) && /^\d{4}-\d\d-\d\d$/.test(W.stand), 'Weltdaten vorhanden mit Quelle und Stand');
  const arabic = /[\u0600-\u06FF]/;
  const decoded = [];
  W.countries.forEach(c => {
    ok(Array.isArray(c.n) && c.n.length === 4 && c.n.every(s => typeof s === 'string' && s.length > 0), 'Land ' + c.a + ': Namen in 4 Sprachen');
    ok(arabic.test(c.n[3]) || c.n[3] === c.n[0], 'Land ' + c.a + ': arabischer Name oder Fallback');
    ok(c.c[0] >= -180 && c.c[0] <= 180 && c.c[1] >= -90 && c.c[1] <= 90 && c.m >= 0 && c.m < 12, 'Land ' + c.a + ': Beschriftungspunkt');
    c.p.forEach(po => po.forEach((ring, i) => {
      ok(ring.length >= 6 && ring.length % 2 === 0, 'Ring mit mindestens 3 Punkten (' + c.n[0] + ')');
      let x = 0, y = 0, prev = null;
      for (let k = 0; k < ring.length; k += 2) {
        x += ring[k]; y += ring[k + 1];
        const lon = x / W.scale, lat = y / W.scale;
        ok(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90, 'Koordinate im gültigen Bereich (' + c.n[0] + ')');
        if (prev && !(Math.abs(lat) >= 85 && Math.abs(prev[1]) >= 85)) ok(Math.abs(lon - prev[0]) <= 180, 'kein Sprung über die Datumsgrenze (' + c.n[0] + ')');
        prev = [lon, lat];
      }
      decoded.push({ iso: c.a, i, p: K.decodeLine(ring, W.scale) });
    }));
  });
  ['DE', 'FR', 'US', 'RU', 'FJ', 'JP', 'AU', 'BR', 'EG', 'IN', 'CN', 'ZA', 'NZ', 'AQ'].forEach(iso => ok(W.countries.some(c => c.a === iso), 'Land ' + iso + ' vorhanden'));
  const de = W.countries.find(c => c.a === 'DE'); ok(de.n[0] === 'Germany' && de.n[1] === 'Deutschland' && de.n[2] === 'Alemania' && de.n[3] === 'ألمانيا', 'Deutschland in 4 Sprachen');
  ok(W.countries.filter(c => c.b).length >= 14 && W.base.includes('DE'), 'Länder der Detailkarte markiert');
  W.lakes.forEach(r => ok(r.length >= 6, 'See-Ring'));

  // Punkt-in-Land (wie in der Karte: im normierten Mercator-Raum, mit Löchern)
  const countries = W.countries.map(c => ({ iso: c.a, polys: c.p.map(po => po.map(r => { const p = K.decodeLine(r, W.scale); let x0 = 2, y0 = 2, x1 = -1, y1 = -1; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } return { p, b: [x0, y0, x1, y1] }; })) }));
  const countryAt = (lat, lon) => { const q = K.norm(lat, K.wrapLon(lon)); const c = countries.find(c => c.polys.some(po => K.inPolygon(po, q.x, q.y))); return c ? c.iso : null; };
  [[51.0, 10.0, 'DE'], [48.78, 9.18, 'DE'], [46.6, 2.5, 'FR'], [39.5, -98, 'US'], [64, -150, 'US'], [60, 100, 'RU'], [66, 170, 'RU'], [66, -172, 'RU'], [35.7, 139.7, 'JP'],
    [-25, 134, 'AU'], [-10, -52, 'BR'], [26, 30, 'EG'], [22, 79, 'IN'], [35, 103, 'CN'], [-30, 25, 'ZA'], [-17.8, 178.0, 'FJ'], [-16.5, 179.3, 'FJ'], [-44, 170.5, 'NZ'], [-80, 0, 'AQ'],
    [30, -40, null], [0, -140, null], [-17.8, 178.0 - 360, 'FJ']].forEach(([la, lo, iso]) => ok(countryAt(la, lo) === iso, 'Land bei ' + la + '/' + lo + ' = ' + iso + ' (war ' + countryAt(la, lo) + ')'));
  ok(countryAt(-29.6, 28.2) === 'LS', 'Lesotho liegt im Loch von Südafrika');

  // Städte
  const cities = C.cities;
  ok(cities.length >= 1000 && cities.length <= 1600, 'Städte: 1000–1600 (' + cities.length + ')');
  let caps = 0, prevPop = Infinity, noAr = 0, noDe = 0, noEs = 0;
  cities.forEach(c => {
    ok(c.length === 8 && c[0] >= -90 && c[0] <= 90 && c[1] >= -180 && c[1] <= 180 && typeof c[4] === 'string' && c[4].length > 0, 'Stadt gültig: ' + c[4]);
    ok(c[2] <= prevPop, 'nach Einwohnern absteigend sortiert'); prevPop = c[2];
    caps += c[3]; if (!c[7]) noAr++; if (!c[5]) noDe++; if (!c[6]) noEs++;
    ok(!c[7] || arabic.test(c[7]), 'arabischer Stadtname in arabischer Schrift: ' + c[4]);
  });
  ok(caps >= 190, 'Hauptstädte enthalten (' + caps + ')');
  ok(noAr / cities.length < 0.02, 'Arabisch fast überall vorhanden, sonst Fallback auf Englisch (' + noAr + ' ohne)');
  console.log('  Weltdaten: ' + Math.round(wTxt.length / 1024) + ' KB Länder/Seen + ' + Math.round(cTxt.length / 1024) + ' KB Städte; ' + W.countries.length + ' Länder, ' + W.lakes.length + ' Seen, ' + cities.length + ' Städte (davon ' + caps + ' Hauptstädte); ohne Eintrag de/es/ar (Fallback en): ' + noDe + '/' + noEs + '/' + noAr);
  const nm = (en, i) => { const c = cities.find(x => x[4] === en); ok(!!c, 'Stadt ' + en); return c[i] || c[4]; };
  ok(nm('Munich', 5) === 'München' && nm('Cologne', 5) === 'Köln' && nm('Tokyo', 5) === 'Tokio' && nm('Tokyo', 7) === 'طوكيو' && nm('Vienna', 6) === 'Viena' && nm('Berlin', 7) === 'برلين', 'bekannte Städtenamen je Sprache');
  ok(cities.some(c => c[4] === 'Stuttgart') && cities.some(c => c[4] === 'Hamburg'), 'deutsche Großstädte');
  ok(cities.filter(c => c[3] && c[2] > 0).length > 150, 'Hauptstädte mit Einwohnerzahl');

  // Projektion und Anzeige über die ganze Welt
  near(K.norm(85.0511287798, 0).y, 0, 1e-9, 'oberer Rand des Mercator-Quadrats'); near(K.norm(-85.0511287798, 0).y, 1, 1e-9, 'unterer Rand');
  near(K.worldFitZoom(1000, 800), Math.log2(800 / 256), 1e-9, 'Zoom, bei dem die Welt ins Fenster passt'); ok(K.worldFitZoom(100, 100) === 0, 'Zoom nie unter 0');
  const fb = K.fitBounds(47.537, 7.52, 49.805, 10.453, 390, 340, 0.92);
  const a1 = K.toWorld(49.805, 7.52, fb.z), b1 = K.toWorld(47.537, 10.453, fb.z);
  ok(b1.x - a1.x <= 390 * 0.92 + 0.01 && b1.y - a1.y <= 340 * 0.92 + 0.01 && (Math.abs(b1.x - a1.x - 390 * 0.92) < 0.5 || Math.abs(b1.y - a1.y - 340 * 0.92) < 0.5), 'BW passt formatfüllend ins Fenster (z=' + fb.z.toFixed(2) + ')');
  near(fb.lat, 48.67, 0.1, 'Mitte von BW (Breite)'); near(fb.lon, 8.99, 0.1, 'Mitte von BW (Länge)');
  ok(K.cityMinZoom(35000, 1) < K.cityMinZoom(3000, 0) && K.cityMinZoom(3000, 0) < K.cityMinZoom(500, 0) && K.cityMinZoom(500, 0) <= K.cityMinZoom(50, 0), 'größere Städte früher sichtbar');
  ok(K.cityMinZoom(100, 1) < K.cityMinZoom(100, 0), 'Hauptstädte früher sichtbar');
  ok(K.wrapLon(190) === -170 && K.wrapLon(-190) === 170 && K.wrapLon(180) === -180 && K.wrapLon(0) === 0 && K.wrapLon(540) === -180 && K.wrapLon(-179.5) === -179.5, 'Länge wird in [-180, 180) gebracht');

  // Entfernung und Richtung weltweit (Kugelformel; Referenz: unabhängige Haversine-Rechnung bzw. pyproj/WGS84 mit 0,35 % Toleranz)
  near(K.distance(52.52, 13.405, -33.8688, 151.2093) / 1000, 16094.5, 0.6, 'Berlin–Sydney (Kugel)');
  near(K.distance(52.52, 13.405, -33.8688, 151.2093) / 1000, 16088.4, 16088.4 * 0.0035, 'Berlin–Sydney (WGS84)');
  near(K.bearing(52.52, 13.405, -33.8688, 151.2093), 74.8, 0.6, 'Berlin→Sydney Peilung');
  near(K.distance(40.7128, -74.006, 35.6762, 139.6503) / 1000, 10851.7, 0.6, 'New York–Tokio (Kugel)');
  near(K.distance(40.7128, -74.006, 35.6762, 139.6503) / 1000, 10875.7, 10875.7 * 0.0035, 'New York–Tokio (WGS84)');
  near(K.bearing(40.7128, -74.006, 35.6762, 139.6503), 333, 0.8, 'New York→Tokio Peilung (über den Pol)');
  near(K.distance(0, 179.5, 0, -179.5) / 1000, 111.2, 0.1, 'Datumsgrenze am Äquator'); near(K.bearing(0, 179.5, 0, -179.5), 90, 1e-6, 'über die Datumsgrenze nach Osten');
  near(K.bearing(0, -179.5, 0, 179.5), 270, 1e-6, 'über die Datumsgrenze nach Westen');
  near(K.distance(60, 179, 60, -179) / 1000, 111.2, 0.2, 'Datumsgrenze bei 60° N');
  near(K.distance(-36.85, 174.76, -18.14, 178.44) / 1000, 2111.4, 0.6, 'Auckland–Fidschi'); near(K.bearing(-36.85, 174.76, -18.14, 178.44), 10.9, 0.5);
  near(K.distance(48.7758, 9.1829, -0.18, -78.47) / 1000, 9850.7, 0.6, 'Stuttgart–Quito (über den Äquator)');
  near(K.distance(0, 0, 0, 180) / 1000, Math.PI * 6371.0088, 0.01, 'halber Erdumfang'); near(K.distance(90, 0, -90, 0) / 1000, Math.PI * 6371.0088, 0.01, 'Pol zu Pol');
  const across = K.nearest([[0, -179.9, 'a', 'West'], [0, 170, 'a', 'Weit']], 0, 179.9, 1)[0];
  ok(across.item[3] === 'West' && Math.abs(across.dist / 1000 - 22.2) < 0.1, 'nächster Punkt über die Datumsgrenze hinweg');
  // Rundlauf der Projektion an Weltpunkten, auch jenseits der Datumsgrenze
  for (const [lat, lon, z] of [[-33.87, 151.21, 2], [35.68, 139.65, 3.5], [-17.7, 178.1, 6], [64, -170, 1], [-75, 100, 0.4], [84, -30, 2]]) {
    const w = K.toWorld(lat, lon, z), b = K.fromWorld(w.x, w.y, z); near(b.lat, lat, 1e-9, 'Rundlauf lat'); near(b.lon, lon, 1e-9, 'Rundlauf lon');
  }
  const w2 = K.fromWorld(K.worldSize(2) * 1.25, K.worldSize(2) * .5, 2); near(K.wrapLon(w2.lon), -90, 1e-9, 'eine Weltbreite weiter rechts = gleiche Länge');
  near(K.metersPerPixel(0, 0) * 256 / 1000, 40075.017, 0.01, 'Weltumfang am Äquator');
})();

/* ---------- PBF-Leser: kleines, selbst gebautes Testarchiv ---------- */
function varint(v) { const out = []; while (v >= 128) { out.push((v % 128) | 128); v = Math.floor(v / 128); } out.push(v); return Buffer.from(out); }
function zig(v) { return v < 0 ? -2 * v - 1 : 2 * v; }
function field(f, wt, payload) { return Buffer.concat([varint(f * 8 + wt), payload]); }
function bytesField(f, buf) { return field(f, 2, Buffer.concat([varint(buf.length), buf])); }
function packed(vals, z) { return Buffer.concat(vals.map(v => varint(z ? zig(v) : v))); }
function blob(type, data) {
  const z = zlib.deflateSync(data);
  const bl = Buffer.concat([field(2, 0, varint(data.length)), bytesField(3, z)]);
  const hd = Buffer.concat([bytesField(1, Buffer.from(type)), field(3, 0, varint(bl.length))]);
  const len = Buffer.alloc(4); len.writeUInt32BE(hd.length);
  return Buffer.concat([len, hd, bl]);
}
function buildPbf() {
  const strings = ['', 'amenity', 'hospital', 'name', 'Testklinik', 'emergency', 'yes', 'pharmacy', 'Test-Apotheke'];
  const st = Buffer.concat(strings.map(s => bytesField(1, Buffer.from(s))));
  const g = 1e7 / 1e2;                                   // Granularität 100 nm -> Einheiten von 1e-7 Grad
  const lat = [488310000, 488400000, 488500000], lon = [93160000, 93200000, 93300000];
  const d = x => x;                                      // Granularität 100 -> Einheiten von 1e-7 Grad
  // Dense: 3 Knoten, Knoten 1 und 3 mit Tags (Klinik mit Notaufnahme, Apotheke), Knoten 2 ohne
  const dlat = [d(lat[0]), d(lat[1]) - d(lat[0]), d(lat[2]) - d(lat[1])], dlon = [d(lon[0]), d(lon[1]) - d(lon[0]), d(lon[2]) - d(lon[1])];
  const kv = [1, 2, 3, 4, 5, 6, 0, 0, 1, 7, 3, 8, 0];
  const dense = Buffer.concat([bytesField(1, packed([1, 1, 1], true)), bytesField(8, packed(dlat, true)), bytesField(9, packed(dlon, true)), bytesField(10, packed(kv, false))]);
  const nodesGroup = bytesField(2, dense);
  // Weg 100 (Klinik als Gebäude) mit Knoten 1,2,3 -> Mittelpunkt
  const way = Buffer.concat([field(1, 0, varint(100)), bytesField(2, packed([1, 3], false)), bytesField(3, packed([2, 4], false)), bytesField(8, packed([1, 1, 1], true))]);
  const waysGroup = bytesField(3, way);
  const block = Buffer.concat([bytesField(1, st), bytesField(2, nodesGroup), bytesField(2, waysGroup)]);
  const header = field(32, 0, varint(Date.UTC(2026, 9, 23) / 1000));
  return Buffer.concat([blob('OSMHeader', header), blob('OSMData', block)]);
}
(async function () {
  const work = path.join(ROOT, '_work_karte', 'test'); fs.mkdirSync(work, { recursive: true });
  const pbfFile = path.join(work, 'mini.osm.pbf'); fs.writeFileSync(pbfFile, buildPbf());
  const { scan } = require('./lib/pbf');
  const seen = { nodes: [], ways: [] };
  const stand = scan(pbfFile, { nodes: true, ways: true, relations: true }, { node: (id, la, lo, t) => seen.nodes.push([id, la, lo, t]), way: (id, t, r) => seen.ways.push([id, t, r]), relation() {} });
  ok(stand.startsWith('2026-10-23'), 'PBF-Zeitstempel');
  ok(seen.nodes.length === 3 && seen.nodes[0][0] === 1 && seen.nodes[2][0] === 3, 'PBF: 3 Knoten');
  near(seen.nodes[0][1], 48.831, 1e-6); near(seen.nodes[0][2], 9.316, 1e-6); near(seen.nodes[2][1], 48.85, 1e-6);
  ok(seen.nodes[0][3].amenity === 'hospital' && seen.nodes[0][3].emergency === 'yes' && seen.nodes[1][3] === null && seen.nodes[2][3].name === 'Test-Apotheke', 'PBF: Tags');
  ok(seen.ways.length === 1 && seen.ways[0][2].join() === '1,2,3' && seen.ways[0][1].name === 'Testklinik', 'PBF: Weg mit Referenzen');

  process.env.KARTE_DATA_DIR = path.join(work, 'out'); process.env.KARTE_FAST = '1';
  for (const m of ['./lib/karte-common', './lib/karte-poi', './fetch-pois']) delete require.cache[require.resolve(m)];
  const fp = require('./fetch-pois');
  const quiet = () => {};
  const readOut = f => fs.readFileSync(path.join(work, 'out', f), 'utf8');
  // 1) aus dem PBF-Archiv
  await fp.main(['--pbf', pbfFile, '--region', 'Testland', '--id', 'tl'], quiet);
  ok(/"Testklinik"/.test(readOut('karte-poi-tl-hospital.js')) && /"H"/.test(readOut('karte-poi-tl-hospital.js')), 'PBF -> Krankenhaus mit Notaufnahme');
  ok(/Test-Apotheke/.test(readOut('karte-poi-tl-pharmacy.js')), 'PBF -> Apotheke');
  const hospItems = []; { global.window = global; new Function(readOut('karte-poi-tl-hospital.js'))(); window.OA_KARTE_POI.hospital.filter(p => p.region === 'tl').forEach(p => hospItems.push(...p.items)); }
  ok(hospItems.length === 2, 'Knoten + Gebäude (Weg-Mittelpunkt)'); near(hospItems.filter(i => i[3] === 'Testklinik' && i[2] === 'h')[0][0], 48.8403, 1e-3);
  ok(/"id": "tl"/.test(readOut('karte-regions.js')) && /"stand": "2026-10-23"/.test(readOut('karte-regions.js')), 'Regionsverzeichnis');

  // 2) Overpass mit Mock-Server: erster Versuch 500, dann Erfolg; prüft Abfragetext
  const queries = []; let calls = 0;
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      calls++;
      const q = decodeURIComponent(body.replace(/^data=/, '').replace(/\+/g, ' ')); queries.push(q);
      if (calls === 1) { res.statusCode = 500; return res.end('boom'); }
      const cat = /hospital/.test(q) ? 'hospital' : /pharmacy/.test(q) ? 'pharmacy' : 'other';
      const els = cat === 'hospital'
        ? [{ type: 'node', id: 1, lat: 48.8, lon: 9.2, tags: { amenity: 'hospital', name: 'Klinik A', emergency: 'yes' } },
           { type: 'way', id: 2, center: { lat: 48.9, lon: 9.3 }, tags: { amenity: 'hospital', name: 'Klinik B' } },
           { type: 'node', id: 3, lat: 48.7, lon: 9.1, tags: { amenity: 'hospital', access: 'private' } }]
        : cat === 'pharmacy' ? [{ type: 'node', id: 4, lat: 48.81, lon: 9.21, tags: { amenity: 'pharmacy', name: 'Apo' } }] : [];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ version: 0.6, osm3s: { timestamp_osm_base: '2026-10-24T01:02:03Z' }, elements: els }));
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + srv.address().port + '/api/interpreter';
  const res = await fp.main(['--region', 'Baden-Württemberg', '--mirror', url, '--retries', '2', '--cats', 'hospital,pharmacy', '--timeout', '5'], quiet);
  srv.close();
  ok(calls === 3, 'Wiederholung nach HTTP-500 (' + calls + ' Aufrufe)');
  ok(/area\["name"="Baden-Württemberg"\]\["boundary"="administrative"\]\["admin_level"="4"\]->\.a;/.test(queries[0]) && /nwr\["amenity"="hospital"\]\(area\.a\)/.test(queries[0]) && /out center tags/.test(queries[0]), 'Overpass-Abfrage');
  ok(res.counts.hospital === 2 && res.counts.pharmacy === 1, 'Overpass: private Einrichtung ausgefiltert');
  ok(/"stand": "2026-10-24"/.test(readOut('karte-regions.js')), 'Stand aus Overpass-Zeitstempel');
  // 3) Fehlerfall: Server nicht erreichbar -> verständlicher Fehler nach den Wiederholungen
  let failed = false; try { await fp.main(['--region', 'X', '--mirror', 'http://127.0.0.1:1/api', '--retries', '1', '--cats', 'hospital', '--timeout', '2'], quiet); } catch (e) { failed = true; }
  ok(failed, 'Fehler nach erfolglosen Wiederholungen');
  // 4) Kartenkern: Delta-Kodierung stimmt mit Dekoder überein
  const kc = require('./lib/karte-common'); const pts = [[9.316, 48.831], [9.3171, 48.8322], [9.31, 48.8]];
  const back = K.decodeLine(kc.deltaEncode(pts, 10000), 10000);
  pts.forEach((p, i) => { const u = K.unnorm(back[2 * i], back[2 * i + 1]); near(u.lon, p[0], 1e-9); near(u.lat, p[1], 1e-9); });
  const s = kc.simplify([[0, 0], [1, 0.0001], [2, 0], [3, 5]], 0.001); ok(s.length === 3, 'Douglas-Peucker');
  // 5) Weltkarten-Skript: kleine Natural-Earth-Attrappe -> Länder, Seen, Städte mit Namen in 4 Sprachen; Sprung über die Datumsgrenze wird gemeldet
  {
    const { execFileSync } = require('child_process');
    const ne = path.join(work, 'ne'), outW = path.join(work, 'outw'); fs.mkdirSync(ne, { recursive: true });
    const sq = (x, y, d) => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]];
    const props = { NAME_EN: 'Testland', NAME_DE: 'Testland-DE', NAME_ES: 'Testlandia', NAME_AR: 'تيست', ISO_A2_EH: 'TL', LABEL_X: 5, LABEL_Y: 5, MIN_LABEL: 3, POP_EST: 10 };
    const gj = feats => JSON.stringify({ type: 'FeatureCollection', features: feats });
    const countries = (ring) => gj([{ properties: props, geometry: { type: 'Polygon', coordinates: [ring, sq(2, 2, 1)] } },
      { properties: Object.assign({}, props, { NAME_EN: 'Winzig', ISO_A2_EH: 'WZ', NAME_AR: null }), geometry: { type: 'MultiPolygon', coordinates: [[sq(50, 50, 0.01)], [sq(60, 60, 3)]] } }]);
    fs.writeFileSync(path.join(ne, 'ne_50m_lakes.geojson'), gj([{ properties: {}, geometry: { type: 'Polygon', coordinates: [sq(20, 20, 1)] } }, { properties: {}, geometry: { type: 'Polygon', coordinates: [sq(30, 30, 0.01)] } }]));
    fs.writeFileSync(path.join(ne, 'ne_10m_populated_places.geojson'), gj([
      { properties: { NAME_EN: 'Hauptort', NAME_DE: 'Hauptort', NAME_ES: 'Capitalia', NAME_AR: 'عاصمة', POP_MAX: 1000, ADM0CAP: 1, FEATURECLA: 'Admin-0 capital' }, geometry: { type: 'Point', coordinates: [5.5, 6.5] } },
      { properties: { NAME_EN: 'Großstadt', NAME_DE: 'Großstadt', NAME_ES: 'Grande', NAME_AR: 'كبيرة', POP_MAX: 900000, ADM0CAP: 0, FEATURECLA: 'Populated place' }, geometry: { type: 'Point', coordinates: [7.5, 8.5] } },
      { properties: { NAME_EN: 'Dorf', NAME_DE: 'Dorf', NAME_ES: 'Aldea', NAME_AR: 'قرية', POP_MAX: 5000, ADM0CAP: 0, FEATURECLA: 'Populated place' }, geometry: { type: 'Point', coordinates: [9, 9] } }]));
    const run = () => execFileSync(process.execPath, [path.join(__dirname, 'build-karte-world.js'), '--ne', ne], { env: Object.assign({}, process.env, { KARTE_DATA_DIR: outW }), stdio: 'pipe' });
    fs.writeFileSync(path.join(ne, 'ne_50m_admin_0_countries.geojson'), countries(sq(0, 0, 10)));
    run();
    global.window = global; delete global.OA_KARTE_WORLD; delete global.OA_KARTE_WORLD_CITIES;
    new Function(fs.readFileSync(path.join(outW, 'karte-world.js'), 'utf8'))(); new Function(fs.readFileSync(path.join(outW, 'karte-world-cities.js'), 'utf8'))();
    const Wd = window.OA_KARTE_WORLD, Cd = window.OA_KARTE_WORLD_CITIES;
    ok(Wd.countries.length === 2 && Wd.countries[0].a === 'TL' && Wd.countries[0].n.join('|') === 'Testland|Testland-DE|Testlandia|تيست', 'Skript: Länder mit 4 Namen');
    ok(Wd.countries[0].p[0].length === 2 && Wd.countries[1].p.length === 1 && Wd.countries[1].n[3] === 'Winzig', 'Skript: Loch bleibt, winzige Insel entfällt, fehlender arabischer Name -> Englisch');
    ok(Wd.lakes.length === 1, 'Skript: kleiner See entfällt');
    ok(Cd.cities.length === 2 && Cd.cities[0][4] === 'Großstadt' && Cd.cities[1][3] === 1 && Cd.cities[1][5] === '' && Cd.cities[1][6] === 'Capitalia' && Cd.cities[1][7] === 'عاصمة', 'Skript: Städte (Hauptstadt immer, Dorf nicht), gleicher Name -> leer');
    fs.writeFileSync(path.join(ne, 'ne_50m_admin_0_countries.geojson'), countries([[170, 0], [-170, 0], [-170, 10], [170, 10], [170, 0]]));
    let jumped = false; try { run(); } catch (e) { jumped = /Datumsgrenze|Antimeridian/.test(String(e.stderr)); }
    ok(jumped, 'Skript: Ring über die Datumsgrenze wird abgelehnt');
  }
  fs.rmSync(work, { recursive: true, force: true });
  try { fs.rmdirSync(path.join(ROOT, '_work_karte')); } catch (e) { /* nicht leer: enthält Natural-Earth-Downloads */ }
  console.log('Karte: alle ' + n + ' Prüfungen bestanden');
})().catch(e => { console.error(e); process.exit(1); });
