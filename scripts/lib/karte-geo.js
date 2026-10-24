/* Grenzen (Landkreise, Gemeinden), Flüsse und Orte aus einem OSM-PBF-Auszug für die Offline-Karte. */
'use strict';
const { collect } = require('./karte-pbf');
const { simplify, deltaEncode, writeData, DATA } = require('./karte-common');
const fs = require('fs');
const path = require('path');

const SCALE = 10000;

async function build(pbfFile, id, name) {
  console.log('Karten-Geodaten aus ' + pbfFile);
  const c = collect(pbfFile, {
    node: t => (t.place === 'city' || t.place === 'town' || t.place === 'village') && t.name,
    way: t => t.waterway === 'river' && t.name,
    relation: t => t.type === 'boundary' && t.boundary === 'administrative' && (t.admin_level === '6' || t.admin_level === '8')
  }, m => console.log('  ' + m));
  const stand = String(c.stand || new Date().toISOString()).slice(0, 10);

  function wayPts(w) { return w.refs.map(r => { const p = c.coord.get(r); return p ? [p[1], p[0]] : null; }).filter(Boolean); }
  function enc(pts, tol) { const s = simplify(pts, tol); return s.length >= 2 ? deltaEncode(s, SCALE) : null; }

  // Grenzen: jeder Weg nur einmal (gemeinsame Grenzen); Landkreis-Grenzen haben Vorrang vor Gemeindegrenzen
  const kreisWays = new Set(), gemWays = new Set();
  const kreise = [];
  c.rels.forEach(r => {
    const lvl = r.tags.admin_level;
    const ids = r.members.filter(m => m.type === 'way' && (m.role === 'outer' || m.role === 'inner' || m.role === '')).map(m => m.id);
    if (lvl === '6') {
      ids.forEach(i => kreisWays.add(i));
      kreise.push({ name: r.tags.name, rs: String(r.tags['de:regionalschluessel'] || '').slice(0, 2), ids });
    } else ids.forEach(i => gemWays.add(i));
  });
  const kreisLines = [], gemLines = [];
  function emit(set, out, tol, skip) {
    set.forEach(wid => {
      if (skip && skip.has(wid)) return;
      const w = c.memberWays.get(wid);
      if (!w) return;
      const e = enc(wayPts(w), tol);
      if (e) out.push(e);
    });
  }
  emit(kreisWays, kreisLines, 0.0004);
  emit(gemWays, gemLines, 0.0004, kreisWays);

  // Beschriftung der Landkreise: Mitte aller Wegpunkte; nur das häufigste Länderkürzel (z. B. 08 = Baden-Württemberg)
  const freq = {};
  kreise.forEach(k => { freq[k.rs] = (freq[k.rs] || 0) + 1; });
  const main = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
  const kreisNames = [];
  kreise.filter(k => k.rs === main && k.name).forEach(k => {
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    k.ids.forEach(wid => { const w = c.memberWays.get(wid); if (w) wayPts(w).forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); });
    if (x0 < x1) kreisNames.push([+((y0 + y1) / 2).toFixed(3), +((x0 + x1) / 2).toFixed(3), k.name]);
  });

  const rivers = [];
  c.ways.forEach(w => { const e = enc(wayPts(w), 0.0004); if (e) rivers.push({ n: w.tags.name, l: e }); });

  const kind = { city: 'c', town: 't', village: 'v' };
  const places = c.nodes.map(n => [+n.lat.toFixed(4), +n.lon.toFixed(4), kind[n.tags.place], n.tags.name, parseInt(n.tags.population, 10) || 0]);
  places.sort((a, b) => b[4] - a[4]);

  const head = (what) => '/* ' + what + ' – © OpenStreetMap-Mitwirkende (ODbL), vereinfacht; erzeugt von scripts/build-karte-base.js */\n';
  const geo = { v: 1, scale: SCALE, name, stand, kreise: kreisLines, kreisNames, rivers, places };
  writeData('karte-geo-' + id + '.js', head('Landkreise, Flüsse, Orte ' + name) + '(window.OA_KARTE_GEO = window.OA_KARTE_GEO || {});\nOA_KARTE_GEO[' + JSON.stringify(id) + '] = ' + JSON.stringify(geo) + ';\n');
  const gem = { v: 1, scale: SCALE, stand, lines: gemLines };
  writeData('karte-gemeinden-' + id + '.js', head('Gemeindegrenzen ' + name) + '(window.OA_KARTE_GEMEINDEN = window.OA_KARTE_GEMEINDEN || {});\nOA_KARTE_GEMEINDEN[' + JSON.stringify(id) + '] = ' + JSON.stringify(gem) + ';\n');
  console.log('  Landkreis-Linien: ' + kreisLines.length + ', Gemeinde-Linien: ' + gemLines.length + ', Landkreise beschriftet: ' + kreisNames.length +
    ', Flussabschnitte: ' + rivers.length + ', Orte: ' + places.length);

  // Region im Verzeichnis ergänzen (falls schon vorhanden)
  const regFile = path.join(DATA, 'karte-regions.js');
  if (fs.existsSync(regFile)) {
    let regs = JSON.parse(fs.readFileSync(regFile, 'utf8').replace(/^[\s\S]*?window\.OA_KARTE_REGIONS = /, '').replace(/;\s*$/, ''));
    const r = regs.find(x => x.id === id);
    if (r) { r.geo = 'data/karte-geo-' + id + '.js'; r.gemeinden = 'data/karte-gemeinden-' + id + '.js'; }
    writeData('karte-regions.js', '/* Verfügbare Regionen der Offline-Karte – wird von scripts/fetch-pois.js gepflegt. */\nwindow.OA_KARTE_REGIONS = ' + JSON.stringify(regs, null, 1) + ';\n');
  }
}

module.exports = { build };
