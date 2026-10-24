/* Auswertung einer .osm.pbf-Datei (z. B. Geofabrik-Auszug) für die Offline-Karte.
 * Wird benutzt, wenn die Overpass-API nicht erreichbar ist (fetch-pois.js --pbf) und für Grenzen/Flüsse/Orte. */
'use strict';
const { scan } = require('./pbf');
const { toItem } = require('./karte-poi');

/**
 * Drei Durchläufe: (1) Knoten/Wege/Relationen filtern, (2) Mitglieds-Wege der Relationen, (3) Koordinaten der benötigten Knoten.
 * spec: { node(tags)->bool, way(tags)->bool, relation(tags)->bool }
 */
function collect(file, spec, log) {
  log = log || (() => {});
  const nodes = [], ways = new Map(), rels = [];
  log('Durchlauf 1/3: Elemente filtern …');
  const stand = scan(file, { nodes: true, ways: true, relations: true }, {
    node(id, lat, lon, tags) { if (tags && spec.node && spec.node(tags)) nodes.push({ id, lat, lon, tags }); },
    way(id, tags, refs) { if (spec.way && spec.way(tags)) ways.set(id, { tags, refs }); },
    relation(id, tags, members) { if (spec.relation && spec.relation(tags)) rels.push({ id, tags, members }); }
  });
  const memberWays = new Map();
  rels.forEach(r => r.members.forEach(m => { if (m.type === 'way' && !ways.has(m.id)) memberWays.set(m.id, null); }));
  if (memberWays.size) {
    log('Durchlauf 2/3: ' + memberWays.size + ' Mitglieds-Wege …');
    scan(file, { ways: true }, { way(id, tags, refs) { if (memberWays.has(id)) memberWays.set(id, { tags, refs }); } });
  }
  const need = new Set();
  ways.forEach(w => w.refs.forEach(r => need.add(r)));
  memberWays.forEach(w => { if (w) w.refs.forEach(r => need.add(r)); });
  log('Durchlauf 3/3: ' + need.size + ' Knotenkoordinaten …');
  const coord = new Map();
  scan(file, { nodes: true }, { node(id, lat, lon) { if (need.has(id)) coord.set(id, [lat, lon]); } });
  return { stand, nodes, ways, rels, memberWays, coord };
}

function centroid(refs, coord) {
  let la = 0, lo = 0, n = 0;
  refs.forEach(r => { const c = coord.get(r); if (c) { la += c[0]; lo += c[1]; n++; } });
  return n ? [la / n, lo / n] : null;
}

/** POIs aus der PBF-Datei: { stand, byCat } */
function extractPois(file, log) {
  const isPoi = tags => !!toItem(0, 0, tags);
  const c = collect(file, { node: isPoi, way: isPoi, relation: isPoi }, log);
  const byCat = {};
  function add(res) { if (res) (byCat[res.cat] = byCat[res.cat] || []).push(res.item); }
  c.nodes.forEach(n => add(toItem(n.lat, n.lon, n.tags)));
  c.ways.forEach(w => { const m = centroid(w.refs, c.coord); if (m) add(toItem(m[0], m[1], w.tags)); });
  c.rels.forEach(r => {
    const pts = [];
    r.members.forEach(m => {
      if (m.type !== 'way') return;
      const w = c.ways.get(m.id) || c.memberWays.get(m.id);
      if (w) { const m2 = centroid(w.refs, c.coord); if (m2) pts.push(m2); }
    });
    if (pts.length) add(toItem(pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length, r.tags));
  });
  return { stand: c.stand, byCat };
}

module.exports = { collect, centroid, extractPois };
