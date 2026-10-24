#!/usr/bin/env node
/* Offline-Ark – Grundkarte aus Natural Earth (Public Domain) erzeugen.
 *
 * Aufruf:   node scripts/build-karte-base.js [--ne <Ordner mit geojson>] [--pbf <region.osm.pbf>]
 * Ohne --ne werden die Natural-Earth-Dateien von GitHub geladen (nvkelso/natural-earth-vector).
 * Ergebnis: data/karte-base.js   (Deutschland, Länder, Seen, große Flüsse, große Städte)
 * Mit --pbf zusätzlich data/karte-geo-<id>.js (Landkreise, Flüsse, Orte aus OpenStreetMap-Daten), siehe fetch-pois.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const { simplify, deltaEncode, writeData, bboxOf, intersects, ROOT } = require('./lib/karte-common');

const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; }
const neDir = path.resolve(opt('ne', path.join(ROOT, '_work_karte')));
const BASE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILES = ['ne_10m_admin_0_countries', 'ne_10m_admin_1_states_provinces', 'ne_10m_lakes', 'ne_10m_lakes_europe',
  'ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe', 'ne_10m_populated_places_simple'];
const BBOX = [4.5, 46.0, 16.5, 55.5];
const NEIGHBOURS = ['France', 'Switzerland', 'Austria', 'Czechia', 'Poland', 'Denmark', 'Netherlands', 'Belgium', 'Luxembourg',
  'Italy', 'Liechtenstein', 'Slovenia', 'Hungary', 'Slovakia', 'Sweden'];
const SCALE = 10000;
const DE_NAMES = { Cologne: 'Köln', Munich: 'München', Hanover: 'Hannover', Nuremberg: 'Nürnberg', Vienna: 'Wien', Prague: 'Prag', Warsaw: 'Warschau', Copenhagen: 'Kopenhagen', Brussels: 'Brüssel', Zurich: 'Zürich', Geneva: 'Genf', Milan: 'Mailand', Turin: 'Turin', Luxembourg: 'Luxemburg' };

function download(url, file, redirects) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'offline-ark-build-karte/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (redirects || 0) < 5) {
        res.resume(); return resolve(download(res.headers.location, file, (redirects || 0) + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' ' + url)); }
      const out = fs.createWriteStream(file);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

function polygons(geom) {            // -> Liste von Ringen ([[lon,lat],...])
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return [].concat(...geom.coordinates);
  return [];
}
function lines(geom) {
  if (!geom) return [];
  if (geom.type === 'LineString') return [geom.coordinates];
  if (geom.type === 'MultiLineString') return geom.coordinates;
  return [];
}
function encRings(rings, tol, minPts) {
  return rings.map(r => simplify(r, tol)).filter(r => r.length >= (minPts || 3)).map(r => deltaEncode(r, SCALE));
}

(async function main() {
  fs.mkdirSync(neDir, { recursive: true });
  for (const f of FILES) {
    const file = path.join(neDir, f + '.geojson');
    if (!fs.existsSync(file)) { console.log('Lade ' + f + ' …'); await download(BASE_URL + f + '.geojson', file); }
  }
  const load = f => JSON.parse(fs.readFileSync(path.join(neDir, f + '.geojson'), 'utf8')).features;

  const countries = load(FILES[0]);
  const land = [], nb = [];
  countries.forEach(c => {
    const name = c.properties.ADMIN || c.properties.admin;
    const rings = polygons(c.geometry).filter(r => intersects(bboxOf([r]), BBOX));
    if (name === 'Germany') land.push(...encRings(rings, 0.004, 4));
    else if (NEIGHBOURS.includes(name)) nb.push(...encRings(rings, 0.02, 4));
  });

  const states = [];
  load(FILES[1]).filter(s => (s.properties.admin || s.properties.ADMIN) === 'Germany').forEach(s => {
    const p = s.properties;
    states.push({ n: p.name_de || p.name, c: [+(+p.longitude).toFixed(3), +(+p.latitude).toFixed(3)], r: encRings(polygons(s.geometry), 0.004, 4) });
  });

  const lakes = [];
  const seenLake = new Set();
  [FILES[2], FILES[3]].forEach(f => load(f).forEach(l => {
    const rings = polygons(l.geometry).filter(r => intersects(bboxOf([r]), BBOX));
    if (!rings.length) return;
    const name = l.properties.name_de || l.properties.name || '';
    const key = name + Math.round(bboxOf(rings)[0] * 10);
    if (seenLake.has(key)) return;
    seenLake.add(key);
    lakes.push({ n: name, r: encRings(rings, 0.004, 4) });
  }));

  const rivers = [];
  const seenRiver = new Set();
  [FILES[5], FILES[4]].forEach(f => load(f).forEach(r => {
    const name = r.properties.name_de || r.properties.name || '';
    lines(r.geometry).filter(l => intersects(bboxOf([l]), BBOX)).forEach(l => {
      const key = name + '|' + l[0].map(v => v.toFixed(1)).join(',');
      if (seenRiver.has(key)) return;
      seenRiver.add(key);
      const s = simplify(l, 0.006);
      if (s.length >= 2) rivers.push({ n: name, l: deltaEncode(s, SCALE) });
    });
  }));

  const places = [];
  load(FILES[6]).forEach(p => {
    const pr = p.properties, [lon, lat] = p.geometry.coordinates;
    if (lon < BBOX[0] || lon > BBOX[2] || lat < BBOX[1] || lat > BBOX[3]) return;
    const de = pr.iso_a2 === 'DE' || pr.adm0name === 'Germany';
    if (!de && !(pr.pop_max >= 400000)) return;
    places.push([+lat.toFixed(3), +lon.toFixed(3), pr.pop_max || 0, DE_NAMES[pr.name] || pr.name, de ? 1 : 0]);
  });

  const data = {
    v: 1, scale: SCALE, bbox: BBOX, source: 'Natural Earth 1:10m (Public Domain)',
    land, nb, states, lakes, rivers, places
  };
  const out = '/* Natural Earth (Public Domain, naturalearthdata.com), vereinfacht – erzeugt von scripts/build-karte-base.js */\n' +
    'window.OA_KARTE_BASE = ' + JSON.stringify(data) + ';\n';
  console.log('Grundkarte:', { land: land.length, nb: nb.length, states: states.length, lakes: lakes.length, rivers: rivers.length, places: places.length });
  writeData('karte-base.js', out);

  const pbf = opt('pbf');
  if (pbf) {
    const geo = require('./lib/karte-geo');
    await geo.build(path.resolve(pbf), opt('id', 'bw'), opt('name', 'Baden-Württemberg'));
  }
})().catch(e => { console.error(e); process.exit(1); });
