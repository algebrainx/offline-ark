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
  fs.rmSync(work, { recursive: true, force: true });
  console.log('Karte: alle ' + n + ' Prüfungen bestanden');
})().catch(e => { console.error(e); process.exit(1); });
