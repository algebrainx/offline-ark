#!/usr/bin/env node
/* Offline-Ark – Punkte (POI) aus OpenStreetMap holen und kompakt für die Offline-Karte speichern.
 *
 *   node scripts/fetch-pois.js --region "Baden-Württemberg"
 *   node scripts/fetch-pois.js --region "Bayern" --id by
 *   node scripts/fetch-pois.js --bbox 48.7,9.1,48.9,9.4 --id test --name "Testgebiet"
 *   node scripts/fetch-pois.js --pbf baden-wuerttemberg-latest.osm.pbf --region "Baden-Württemberg"   (ohne Overpass, aus Geofabrik-Auszug)
 *
 * Optionen:
 *   --region <Name>     Verwaltungsgebiet (OSM-Name, admin_level 4; mit --admin-level änderbar)
 *   --bbox s,w,n,e      statt --region ein Rechteck verwenden
 *   --id <kurz>         Dateikürzel (Standard: bw für Baden-Württemberg, sonst aus dem Namen)
 *   --name <Anzeigename> Standard: der Regionsname
 *   --cats a,b          nur diese Kategorien: hospital,pharmacy,defib,fire,water
 *   --mirror <url,...>  Overpass-Endpunkt(e); Standard: overpass-api.de und einige Spiegel
 *   --timeout <s>       Zeitlimit je Abfrage (Standard 300)   --retries <n> (Standard 3)
 *   --pbf <datei>       OSM-PBF-Auszug statt Overpass lesen (z. B. von download.geofabrik.de)
 * Ergebnis: data/karte-poi-<id>-<kategorie>.js und Eintrag in data/karte-regions.js.
 * Daten: © OpenStreetMap-Mitwirkende, ODbL 1.0 – https://www.openstreetmap.org/copyright
 * Node >= 16, keine Pakete. */
'use strict';
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { CAT_IDS, toItem, slug, overpassFor, writeRegion } = require('./lib/karte-poi');

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const KNOWN_IDS = { 'baden-wuerttemberg': 'bw', 'bayern': 'by', 'nordrhein-westfalen': 'nw', 'niedersachsen': 'ni', 'hessen': 'he', 'rheinland-pfalz': 'rp', 'sachsen': 'sn' };

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2); o[k] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
  }
  return o;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Eine Overpass-Abfrage per POST senden; liefert das geparste JSON. */
function overpassOnce(endpoint, query, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(endpoint);
    const body = 'data=' + encodeURIComponent(query);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request({
      method: 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search,
      headers: {
        'User-Agent': 'offline-ark-fetch-pois/1.0 (offline emergency map, personal use)',
        'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(Object.assign(new Error('HTTP ' + res.statusCode + ' von ' + u.hostname), { status: res.statusCode }));
        try {
          const json = JSON.parse(text);
          if (json.remark && /error|timed out|out of memory/i.test(json.remark)) return reject(new Error('Overpass: ' + json.remark));
          resolve(json);
        } catch (e) { reject(new Error('Antwort ist kein JSON (' + text.slice(0, 80).replace(/\s+/g, ' ') + ')')); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Zeitüberschreitung nach ' + Math.round(timeoutMs / 1000) + ' s')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Mit Wiederholungen und wechselnden Spiegeln. */
async function overpass(mirrors, query, timeoutMs, retries, log) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const endpoint = mirrors[attempt % mirrors.length];
    try { return await overpassOnce(endpoint, query, timeoutMs); }
    catch (e) {
      lastErr = e;
      log('  Versuch ' + (attempt + 1) + ' fehlgeschlagen (' + endpoint + '): ' + e.message);
      if (attempt < retries) await sleep(Math.min(60000, 5000 * Math.pow(2, attempt)) * (process.env.KARTE_FAST ? 0.001 : 1));
    }
  }
  throw lastErr;
}

/** Overpass-Elemente -> { cat: [[lat,lon,typ,name],...] } */
function itemsFromElements(elements) {
  const byCat = {};
  elements.forEach(el => {
    const lat = el.lat != null ? el.lat : el.center && el.center.lat;
    const lon = el.lon != null ? el.lon : el.center && el.center.lon;
    if (lat == null || lon == null) return;
    const r = toItem(lat, lon, el.tags || {});
    if (r) (byCat[r.cat] = byCat[r.cat] || []).push(r.item);
  });
  return byCat;
}

function bboxOfCats(byCat) {
  let s = 90, w = 180, n = -90, e = -180;
  Object.values(byCat).forEach(items => items.forEach(i => { if (i[0] < s) s = i[0]; if (i[0] > n) n = i[0]; if (i[1] < w) w = i[1]; if (i[1] > e) e = i[1]; }));
  return s > n ? null : [s, w, n, e].map(v => +v.toFixed(3));
}

async function main(argv, log) {
  log = log || console.log;
  const o = parseArgs(argv);
  const cats = o.cats ? String(o.cats).split(',').filter(c => CAT_IDS.includes(c)) : CAT_IDS;
  const region = typeof o.region === 'string' ? o.region : null;
  const name = o.name || region || 'Gebiet';
  const id = o.id || KNOWN_IDS[slug(name)] || slug(name);
  if (!region && !o.bbox && !o.pbf) throw new Error('Bitte --region "Name" (oder --bbox s,w,n,e / --pbf Datei) angeben.');
  let byCat = {}, stand;

  if (o.pbf) {
    log('Lese ' + o.pbf + ' (ohne Overpass) …');
    const res = require('./lib/karte-pbf').extractPois(o.pbf, log);
    byCat = res.byCat; stand = String(res.stand || new Date().toISOString()).slice(0, 10);
    Object.keys(byCat).forEach(c => { if (!cats.includes(c)) delete byCat[c]; });
  } else {
    const mirrors = o.mirror ? String(o.mirror).split(',') : MIRRORS;
    const area = o.bbox ? '' : 'area["name"=' + JSON.stringify(region) + ']["boundary"="administrative"]["admin_level"="' + (o['admin-level'] || 4) + '"]->.a;';
    for (const cat of cats) {
      let q = overpassFor(cat, area);
      if (o.bbox) q = q.replace(/\(area\.a\)/g, '(' + o.bbox + ')');
      log('Hole ' + cat + ' …');
      const json = await overpass(mirrors, q, (Number(o.timeout) || 300) * 1000, o.retries != null ? Number(o.retries) : 3, log);
      const part = itemsFromElements(json.elements || []);
      byCat[cat] = part[cat] || [];
      log('  ' + byCat[cat].length + ' Einträge');
      stand = String(json.osm3s && json.osm3s.timestamp_osm_base || new Date().toISOString()).slice(0, 10);
      if (cat !== cats[cats.length - 1]) await sleep(process.env.KARTE_FAST ? 1 : 3000);   // freundlich zum Server
    }
  }
  const bbox = o.bbox ? String(o.bbox).split(',').map(Number) : bboxOfCats(byCat);
  const source = o.pbf ? 'OpenStreetMap-Auszug (Geofabrik), ODbL' : 'OpenStreetMap über Overpass API, ODbL';
  return writeRegion(id, name, stand, source, bbox, byCat);
}

module.exports = { main, overpass, overpassOnce, itemsFromElements, parseArgs };
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error('Fehler: ' + e.message); process.exit(1); });
