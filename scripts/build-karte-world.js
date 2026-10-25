#!/usr/bin/env node
/* Offline-Ark – grobe Weltkarte aus Natural Earth (Public Domain, https://www.naturalearthdata.com/) erzeugen.
 *
 * Aufruf:   node scripts/build-karte-world.js [--ne <Ordner>] [--tol 0.012] [--minpop 350000]
 *   --ne      Ordner für die heruntergeladenen GeoJSON-Dateien (Standard: _work_karte/, wird bei Bedarf angelegt;
 *             fehlende Dateien lädt das Skript von https://github.com/nvkelso/natural-earth-vector, Node >= 16, keine Pakete)
 *   --tol     Douglas-Peucker-Toleranz in Grad für Länder und Seen (Standard 0.012, ca. 1,3 km)
 *   --minpop  Mindest-Einwohnerzahl (POP_MAX) für Städte; alle Hauptstädte kommen immer dazu (Standard 350000)
 *
 * Quellen:  ne_50m_admin_0_countries  (Länder, Namen in de/en/es/ar, Beschriftungspunkt, MIN_LABEL)
 *           ne_50m_lakes              (Seen)
 *           ne_10m_populated_places   (Städte mit Namen in de/en/es/ar und Einwohnerzahl)
 * Ergebnis: data/karte-world.js         window.OA_KARTE_WORLD         (Länder + Seen, Koordinaten als ganze Zahlen, delta-codiert, 1e-3 Grad)
 *           data/karte-world-cities.js  window.OA_KARTE_WORLD_CITIES  ([lat, lon, Einwohner/1000, Hauptstadt(0|1), en, de, es, ar]; de/es/ar leer = wie en)
 * Die Seite lädt beide Dateien erst beim Herauszoomen bzw. über den Knopf "Welt" (siehe js/tool-karte.js).
 * Der Antimeridian ist bei Natural Earth bereits geschnitten (Russland, Fidschi, USA); das Skript prüft, dass kein Ring springt. */
'use strict';
const fs = require('fs');
const path = require('path');
const { simplify, deltaEncode, writeData, bboxOf, ROOT, download } = require('./lib/karte-common');

const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; }
const neDir = path.resolve(opt('ne', path.join(ROOT, '_work_karte')));
const TOL = +opt('tol', 0.012), MIN_POP = +opt('minpop', 350000);
const SCALE = 1000;
const BASE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILES = ['ne_50m_admin_0_countries', 'ne_50m_lakes', 'ne_10m_populated_places'];
// Länder, die die detaillierte Grundkarte (data/karte-base.js, scripts/build-karte-base.js) bereits enthält
const BASE_ISO = ['DE', 'FR', 'CH', 'AT', 'CZ', 'PL', 'DK', 'NL', 'BE', 'LU', 'IT', 'LI', 'SI', 'HU', 'SK', 'SE'];

function polygons(geom) {            // -> Liste von Polygonen, jedes [Außenring, Löcher …]
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}
function extent(r) { const b = bboxOf([r]); return Math.max(b[2] - b[0], b[3] - b[1]); }
/** Ring vereinfachen, auf das Raster runden, Doppelpunkte und Schlusspunkt entfernen; null wenn zu klein. */
function prepRing(ring, minPts) {
  let pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice();
  pts = simplify(pts, TOL).map(p => [Math.round(p[0] * SCALE) / SCALE, Math.round(p[1] * SCALE) / SCALE]);
  pts = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  return pts.length >= (minPts || 3) ? pts : null;
}
function checkNoJump(pts, what) {
  for (let i = 1; i < pts.length; i++) {
    const pole = Math.abs(pts[i][1]) >= 85 && Math.abs(pts[i - 1][1]) >= 85;       // Antarktis: Kante entlang des Südpols ist gewollt
    if (!pole && Math.abs(pts[i][0] - pts[i - 1][0]) > 180) throw new Error('Ring springt über den Antimeridian: ' + what);
  }
}
const nm = (p, k) => { const v = p[k]; return typeof v === 'string' && v.trim() ? v.trim() : ''; };

(async function main() {
  fs.mkdirSync(neDir, { recursive: true });
  for (const f of FILES) {
    const file = path.join(neDir, f + '.geojson');
    if (!fs.existsSync(file)) { console.log('Lade ' + f + ' …'); await download(BASE_URL + f + '.geojson', file); }
  }
  const load = f => JSON.parse(fs.readFileSync(path.join(neDir, f + '.geojson'), 'utf8')).features;

  /* Länder */
  const countries = [];
  let vertices = 0;
  load(FILES[0]).forEach(f => {
    const p = f.properties, en = nm(p, 'NAME_EN') || nm(p, 'NAME') || nm(p, 'ADMIN');
    const iso = (p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : p.ADM0_A3) || '';
    const polys = polygons(f.geometry);
    let biggest = 0;
    polys.forEach(po => { biggest = Math.max(biggest, extent(po[0])); });
    const out = [];
    polys.forEach(po => {
      const rings = [];
      for (let i = 0; i < po.length; i++) {
        const r = po[i], e = extent(r);
        const keep = i === 0 ? (e >= 0.04 || e === biggest) : e >= 0.08;       // winzige Inseln und Löcher weglassen
        const q = keep ? prepRing(r, 3) : null;
        if (!q) { if (i === 0) break; continue; }                              // ohne Außenring kein Polygon
        checkNoJump(q, en);
        rings.push(deltaEncode(q, SCALE)); vertices += q.length;
      }
      if (rings.length) out.push(rings);
    });
    if (!out.length) return;
    countries.push({
      a: iso, n: [en, nm(p, 'NAME_DE') || en, nm(p, 'NAME_ES') || en, nm(p, 'NAME_AR') || en],
      c: [+(+p.LABEL_X).toFixed(2), +(+p.LABEL_Y).toFixed(2)], m: +(+p.MIN_LABEL || 5).toFixed(1), b: BASE_ISO.includes(iso) ? 1 : 0, p: out,
      pop: p.POP_EST || 0
    });
  });
  countries.sort((a, b) => a.m - b.m || b.pop - a.pop);
  countries.forEach(c => { delete c.pop; if (!c.b) delete c.b; });

  /* Seen */
  const lakes = [];
  load(FILES[1]).forEach(f => {
    polygons(f.geometry).forEach(po => {
      if (extent(po[0]) < 0.25) return;
      po.forEach((r, i) => {
        if (i > 0 && extent(r) < 0.1) return;
        const q = prepRing(r, 3);
        if (q) { checkNoJump(q, 'See'); lakes.push(deltaEncode(q, SCALE)); vertices += q.length; }
      });
    });
  });

  const world = {
    v: 1, scale: SCALE, stand: new Date().toISOString().slice(0, 10), source: 'Natural Earth 1:50m (Public Domain)',
    names: ['en', 'de', 'es', 'ar'], base: BASE_ISO, countries, lakes
  };
  const head = '/* Natural Earth 1:50m (Public Domain, naturalearthdata.com): Länder und Seen, stark vereinfacht – erzeugt von scripts/build-karte-world.js */\n';
  console.log('Welt:', { countries: countries.length, lakes: lakes.length, vertices });
  const kb1 = writeData('karte-world.js', head + 'window.OA_KARTE_WORLD = ' + JSON.stringify(world) + ';\n');

  /* Städte */
  const all = load(FILES[2]).map(f => Object.assign({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }, f.properties))
    .filter(p => p.ADM0CAP === 1 || /Admin-0 capital/.test(p.FEATURECLA || '') || p.POP_MAX >= MIN_POP);
  all.sort((a, b) => (b.POP_MAX || 0) - (a.POP_MAX || 0) || String(a.NAME_EN).localeCompare(String(b.NAME_EN)));
  const cities = [], seen = new Set();
  let missing = { de: 0, es: 0, ar: 0 };
  all.forEach(p => {
    const en = nm(p, 'NAME_EN') || nm(p, 'NAME') || nm(p, 'NAMEASCII');
    if (!en) return;
    const key = en + '|' + Math.round(p.lat * 20) + '|' + Math.round(p.lon * 20);
    if (seen.has(key)) return;
    seen.add(key);
    const de = nm(p, 'NAME_DE'), es = nm(p, 'NAME_ES'), ar = nm(p, 'NAME_AR');
    if (!de) missing.de++; if (!es) missing.es++; if (!ar) missing.ar++;
    cities.push([+p.lat.toFixed(3), +p.lon.toFixed(3), Math.round((p.POP_MAX || 0) / 1000), p.ADM0CAP === 1 || /Admin-0 capital/.test(p.FEATURECLA || '') ? 1 : 0,
      en, de && de !== en ? de : '', es && es !== en ? es : '', ar && ar !== en ? ar : '']);
  });
  console.log('Städte:', cities.length, '(fehlende Namen -> Fallback Englisch:', missing, ')');
  const kb2 = writeData('karte-world-cities.js', '/* Natural Earth 1:10m populated places (Public Domain): Hauptstädte und große Städte mit Namen in en/de/es/ar – erzeugt von scripts/build-karte-world.js */\n' +
    'window.OA_KARTE_WORLD_CITIES = ' + JSON.stringify({ v: 1, stand: world.stand, source: 'Natural Earth 1:10m populated places (Public Domain)', cities }) + ';\n');
  console.log('Weltdaten gesamt: ' + (kb1 + kb2) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
