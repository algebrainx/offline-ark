/* POI-Kategorien, Normalisierung und Ausgabe für die Offline-Karte (gemeinsam für Overpass und PBF). */
'use strict';
const fs = require('fs');
const path = require('path');
const { DATA, writeData } = require('./karte-common');

/* Kategorie -> Regeln (OSM-Tag -> Typkürzel). Die Typen werden im Viewer beschriftet (js/tool-karte.js). */
const CATS = {
  hospital: [['amenity', 'hospital', 'h']],
  pharmacy: [['amenity', 'pharmacy', 'a']],
  defib: [['emergency', 'defibrillator', 'd']],
  fire: [['amenity', 'fire_station', 'f'], ['amenity', 'police', 'p'], ['emergency', 'phone', 'n'], ['emergency', 'assembly_point', 's']],
  water: [['amenity', 'drinking_water', 'w'], ['amenity', 'water_point', 'w'], ['man_made', 'water_well', 'b'], ['natural', 'spring', 'q']]
};
const CAT_IDS = Object.keys(CATS);

/** Gehört dieses Element in eine Kategorie? -> { cat, typ } oder null */
function classify(tags) {
  if (!tags) return null;
  if (tags.disused || tags['disused:amenity'] || tags.abandoned || tags['abandoned:amenity']) return null;
  if (tags.access === 'private' || tags.access === 'no') return null;
  for (const cat of CAT_IDS) {
    for (const [k, v, typ] of CATS[cat]) {
      if (tags[k] !== v) continue;
      if ((typ === 'w' || typ === 'b' || typ === 'q') && tags.drinking_water === 'no') return null;
      if (typ === 'h' && tags.emergency === 'yes') return { cat, typ: 'H' };
      return { cat, typ };
    }
  }
  return null;
}

function nameOf(tags) {
  const n = tags.name || tags['defibrillator:location'] || tags['defibrillator:location:de'] || tags.operator || tags.description || '';
  return String(n).replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** Kompakter Eintrag [lat, lon, typ, name] mit 5 Nachkommastellen. */
function toItem(lat, lon, tags) {
  const c = classify(tags);
  if (!c) return null;
  return { cat: c.cat, item: [+lat.toFixed(5), +lon.toFixed(5), c.typ, nameOf(tags)] };
}

/** Doppelte (gleicher Typ, gleiche Position auf ~1 m) entfernen. */
function dedupe(items) {
  const seen = new Set();
  return items.filter(it => {
    const k = it[2] + '|' + it[0] + '|' + it[1];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function slug(s) { return String(s).toLowerCase().replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

/** Overpass-Abfrage für eine Kategorie (nwr = Knoten, Wege, Relationen). */
function overpassFor(cat, areaClause) {
  const parts = [];
  CATS[cat].forEach(([k, v]) => parts.push('  nwr["' + k + '"="' + v + '"](area.a);'));
  return '[out:json][timeout:240];\n' + areaClause + '\n(\n' + parts.join('\n') + '\n);\nout center tags qt;';
}

/** Region-Dateien schreiben: data/karte-poi-<id>-<cat>.js + Eintrag in data/karte-regions.js */
function writeRegion(id, name, stand, source, bbox, byCat) {
  const files = {};
  const counts = {};
  let total = 0;
  CAT_IDS.forEach(cat => {
    const items = dedupe(byCat[cat] || []).sort((a, b) => a[0] - b[0]);   // nach Breitengrad sortiert: schnelle Suche im Viewer
    counts[cat] = items.length;
    const file = 'karte-poi-' + id + '-' + cat + '.js';
    const text = '/* © OpenStreetMap-Mitwirkende (ODbL) – erzeugt von scripts/fetch-pois.js. Einträge: [lat, lon, typ, name] */\n' +
      '(window.OA_KARTE_POI = window.OA_KARTE_POI || {});\n' +
      '(OA_KARTE_POI[' + JSON.stringify(cat) + '] = OA_KARTE_POI[' + JSON.stringify(cat) + '] || []).push({ region: ' + JSON.stringify(id) +
      ', name: ' + JSON.stringify(name) + ', stand: ' + JSON.stringify(stand) + ', items: [\n' +
      items.map(i => JSON.stringify(i)).join(',\n') + '\n] });\n';
    total += writeData(file, text);
    files[cat] = 'data/' + file;
  });
  // Region-Verzeichnis lesen, ergänzen, zurückschreiben
  const regFile = path.join(DATA, 'karte-regions.js');
  let regs = [];
  if (fs.existsSync(regFile)) {
    try { regs = JSON.parse(fs.readFileSync(regFile, 'utf8').replace(/^[\s\S]*?window\.OA_KARTE_REGIONS = /, '').replace(/;\s*$/, '')); } catch (e) { regs = []; }
  }
  const prev = regs.find(r => r.id === id);
  const entry = Object.assign({}, prev || {}, { id, name, bbox, stand, source, files, counts });
  regs = regs.filter(r => r.id !== id).concat([entry]);
  writeData('karte-regions.js', '/* Verfügbare Regionen der Offline-Karte – wird von scripts/fetch-pois.js gepflegt. */\nwindow.OA_KARTE_REGIONS = ' + JSON.stringify(regs, null, 1) + ';\n');
  console.log('Summe POI-Daten: ' + total + ' KB; Anzahl je Kategorie:', counts);
  return { files, counts, total };
}

module.exports = { CATS, CAT_IDS, classify, nameOf, toItem, dedupe, slug, overpassFor, writeRegion };
