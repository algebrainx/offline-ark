/* Minimaler OSM-PBF-Leser (Node >= 16, ohne Pakete).
 * Liest .osm.pbf-Dateien (z. B. von download.geofabrik.de) sequentiell und ruft Rückruffunktionen auf.
 * Unterstützt: DenseNodes, Nodes, Ways, Relations (zlib oder unkomprimiert). */
'use strict';
const fs = require('fs');
const zlib = require('zlib');

class Reader {
  constructor(buf, pos, end) { this.buf = buf; this.pos = pos || 0; this.end = end == null ? buf.length : end; }
  varint() {
    const b = this.buf;
    let x = b[this.pos++];
    if (x < 128) return x;
    x &= 127;
    let m = 128, c;
    do { c = b[this.pos++]; x += (c & 127) * m; m *= 128; } while (c >= 128);
    return x;
  }
  zigzag() { const n = this.varint(); return n % 2 === 0 ? n / 2 : -(n + 1) / 2; }
  skip(wt) {
    if (wt === 0) this.varint();
    else if (wt === 2) { const n = this.varint(); this.pos += n; }
    else if (wt === 1) this.pos += 8;
    else if (wt === 5) this.pos += 4;
    else throw new Error('Unbekannter Wire-Typ ' + wt);
  }
  /** Länge-präfixierter Block -> Unter-Reader */
  sub() { const n = this.varint(); const r = new Reader(this.buf, this.pos, this.pos + n); this.pos += n; return r; }
  packed(fn) { const r = this.sub(); while (r.pos < r.end) fn(r); }
  packedZig() { const out = []; this.packed(r => out.push(r.zigzag())); return out; }
  packedVar() { const out = []; this.packed(r => out.push(r.varint())); return out; }
  string() { const n = this.varint(); const s = this.buf.toString('utf8', this.pos, this.pos + n); this.pos += n; return s; }
}

/** Blobs einer PBF-Datei der Reihe nach liefern: { type, data (entpackt) } */
function* blobs(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const lenBuf = Buffer.alloc(4);
    let pos = 0;
    for (;;) {
      if (fs.readSync(fd, lenBuf, 0, 4, pos) < 4) return;
      pos += 4;
      const hl = lenBuf.readUInt32BE(0);
      const hb = Buffer.alloc(hl);
      fs.readSync(fd, hb, 0, hl, pos); pos += hl;
      const hr = new Reader(hb);
      let type = '', size = 0;
      while (hr.pos < hr.end) {
        const t = hr.varint(), f = t >> 3, w = t & 7;
        if (f === 1 && w === 2) type = hr.string();
        else if (f === 3 && w === 0) size = hr.varint();
        else hr.skip(w);
      }
      const bb = Buffer.alloc(size);
      let got = 0;
      while (got < size) { const n = fs.readSync(fd, bb, got, size - got, pos + got); if (!n) throw new Error('Datei abgeschnitten'); got += n; }
      pos += size;
      const br = new Reader(bb);
      let raw = null, zdata = null;
      while (br.pos < br.end) {
        const t = br.varint(), f = t >> 3, w = t & 7;
        if (f === 1 && w === 2) { const n = br.varint(); raw = bb.subarray(br.pos, br.pos + n); br.pos += n; }
        else if (f === 3 && w === 2) { const n = br.varint(); zdata = bb.subarray(br.pos, br.pos + n); br.pos += n; }
        else br.skip(w);
      }
      yield { type, data: raw || (zdata ? zlib.inflateSync(zdata) : Buffer.alloc(0)) };
    }
  } finally { fs.closeSync(fd); }
}

/** OSMHeader: Zeitstempel der Daten (osmosis_replication_timestamp) in Sekunden, sonst null. */
function parseHeader(data) {
  const r = new Reader(data);
  let ts = null;
  while (r.pos < r.end) {
    const t = r.varint(), f = t >> 3, w = t & 7;
    if (f === 32 && w === 0) ts = r.varint();
    else r.skip(w);
  }
  return ts;
}

/**
 * PrimitiveBlock zerlegen.
 * want: { nodes, ways, relations } (true = auswerten)
 * h.node(id, lat, lon, tags|null)  h.way(id, tags, refs)  h.relation(id, tags, members[{type,id,role}])
 * tags ist ein Objekt {key: value} (bei Knoten nur, wenn welche vorhanden sind).
 */
function parseBlock(data, want, h) {
  const r = new Reader(data);
  const strings = [];
  let gran = 100, latOff = 0, lonOff = 0;
  const groups = [];
  while (r.pos < r.end) {
    const t = r.varint(), f = t >> 3, w = t & 7;
    if (f === 1 && w === 2) { const s = r.sub(); while (s.pos < s.end) { const tt = s.varint(); if ((tt >> 3) === 1) strings.push(s.string()); else s.skip(tt & 7); } }
    else if (f === 2 && w === 2) groups.push(r.sub());
    else if (f === 17 && w === 0) gran = r.varint();
    else if (f === 19 && w === 0) latOff = r.zigzag();
    else if (f === 20 && w === 0) lonOff = r.zigzag();
    else r.skip(w);
  }
  const k = 1e-9 * gran;
  for (const g of groups) {
    while (g.pos < g.end) {
      const t = g.varint(), f = t >> 3, w = t & 7;
      if (w !== 2) { g.skip(w); continue; }
      if (f === 2 && want.nodes) dense(g.sub());
      else if (f === 3 && want.ways) way(g.sub());
      else if (f === 4 && want.relations) relation(g.sub());
      else if (f === 1 && want.nodes) plainNode(g.sub());
      else g.sub();
    }
  }

  function dense(d) {
    let ids = [], lats = [], lons = [], kv = null;
    while (d.pos < d.end) {
      const t = d.varint(), f = t >> 3, w = t & 7;
      if (f === 1 && w === 2) ids = d.packedZig();
      else if (f === 8 && w === 2) lats = d.packedZig();
      else if (f === 9 && w === 2) lons = d.packedZig();
      else if (f === 10 && w === 2) kv = d.packedVar();
      else d.skip(w);
    }
    let id = 0, lat = 0, lon = 0, p = 0;
    for (let i = 0; i < ids.length; i++) {
      id += ids[i]; lat += lats[i]; lon += lons[i];
      let tags = null;
      if (kv) {
        while (kv[p] !== 0 && p < kv.length) { (tags || (tags = {}))[strings[kv[p]]] = strings[kv[p + 1]]; p += 2; }
        p++;
      }
      h.node(id, (latOff + gran * lat) * 1e-9, (lonOff + gran * lon) * 1e-9, tags);
    }
  }
  function plainNode(n) {
    let id = 0, lat = 0, lon = 0, keys = [], vals = [];
    while (n.pos < n.end) {
      const t = n.varint(), f = t >> 3, w = t & 7;
      if (f === 1 && w === 0) id = n.zigzag();
      else if (f === 2 && w === 2) keys = n.packedVar();
      else if (f === 3 && w === 2) vals = n.packedVar();
      else if (f === 8 && w === 0) lat = n.zigzag();
      else if (f === 9 && w === 0) lon = n.zigzag();
      else n.skip(w);
    }
    let tags = null;
    keys.forEach((kk, i) => { (tags || (tags = {}))[strings[kk]] = strings[vals[i]]; });
    h.node(id, (latOff + gran * lat) * 1e-9, (lonOff + gran * lon) * 1e-9, tags);
  }
  function tagsOf(keys, vals) {
    const tags = {};
    for (let i = 0; i < keys.length; i++) tags[strings[keys[i]]] = strings[vals[i]];
    return tags;
  }
  function way(wr) {
    let id = 0, keys = [], vals = [], refs = [];
    while (wr.pos < wr.end) {
      const t = wr.varint(), f = t >> 3, w = t & 7;
      if (f === 1 && w === 0) id = wr.varint();
      else if (f === 2 && w === 2) keys = wr.packedVar();
      else if (f === 3 && w === 2) vals = wr.packedVar();
      else if (f === 8 && w === 2) { refs = wr.packedZig(); let a = 0; for (let i = 0; i < refs.length; i++) { a += refs[i]; refs[i] = a; } }
      else wr.skip(w);
    }
    h.way(id, tagsOf(keys, vals), refs);
  }
  function relation(rr) {
    let id = 0, keys = [], vals = [], roles = [], mem = [], types = [];
    while (rr.pos < rr.end) {
      const t = rr.varint(), f = t >> 3, w = t & 7;
      if (f === 1 && w === 0) id = rr.varint();
      else if (f === 2 && w === 2) keys = rr.packedVar();
      else if (f === 3 && w === 2) vals = rr.packedVar();
      else if (f === 8 && w === 2) roles = rr.packedVar();
      else if (f === 9 && w === 2) { mem = rr.packedZig(); let a = 0; for (let i = 0; i < mem.length; i++) { a += mem[i]; mem[i] = a; } }
      else if (f === 10 && w === 2) types = rr.packedVar();
      else rr.skip(w);
    }
    const members = mem.map((m, i) => ({ type: ['node', 'way', 'relation'][types[i]] || 'node', id: m, role: strings[roles[i]] || '' }));
    h.relation(id, tagsOf(keys, vals), members);
  }
}

/** Ganze Datei einmal durchlaufen. Rückgabe: Datenstand (ISO-Datum) oder null. */
function scan(file, want, h) {
  let stand = null;
  for (const b of blobs(file)) {
    if (b.type === 'OSMHeader') { const ts = parseHeader(b.data); if (ts) stand = new Date(ts * 1000).toISOString(); }
    else if (b.type === 'OSMData') parseBlock(b.data, want, h);
  }
  return stand;
}

module.exports = { scan, blobs, parseBlock, Reader };
