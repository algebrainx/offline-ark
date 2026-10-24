/* Gemeinsame Hilfen für die Karten-Skripte (Node >= 16, keine Pakete). */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DATA = process.env.KARTE_DATA_DIR || path.join(ROOT, 'data');

/** Douglas-Peucker für [lon,lat]-Linien; tol in Grad. Iterativ, damit lange Linien nicht den Stack sprengen. */
function simplify(pts, tol) {
  const n = pts.length;
  if (n <= 2 || tol <= 0) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = -1, idx = -1;
    const ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] - ax, py = pts[i][1] - ay;
      let d2;
      if (len2 === 0) d2 = px * px + py * py;
      else {
        let t = (px * dx + py * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = px - t * dx, qy = py - t * dy;
        d2 = qx * qx + qy * qy;
      }
      if (d2 > max) { max = d2; idx = i; }
    }
    if (max > t2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

/** Linie [[lon,lat],...] -> [lon0,lat0,dlon,dlat,...] als ganze Zahlen (scale = 10000 -> 1e-4 Grad). */
function deltaEncode(pts, scale) {
  const out = [];
  let pl = 0, pb = 0;
  pts.forEach((p, i) => {
    const x = Math.round(p[0] * scale), y = Math.round(p[1] * scale);
    out.push(i === 0 ? x : x - pl, i === 0 ? y : y - pb);
    pl = x; pb = y;
  });
  return out;
}
function deltaDecode(arr, scale) {
  const out = [];
  let x = 0, y = 0;
  for (let i = 0; i < arr.length; i += 2) {
    x += arr[i]; y += arr[i + 1];
    out.push([x / scale, y / scale]);
  }
  return out;
}

/** Schreibt eine Datei in data/ und meldet die Größe. */
function writeData(name, text) {
  const file = path.join(DATA, name);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(file, text);
  const kb = Math.round(Buffer.byteLength(text) / 1024);
  console.log('  ' + name + ': ' + kb + ' KB');
  return kb;
}

function bboxOf(rings) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  rings.forEach(r => r.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }));
  return [x0, y0, x1, y1];
}
function intersects(a, b) { return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]); }

module.exports = { ROOT, DATA, simplify, deltaEncode, deltaDecode, writeData, bboxOf, intersects };
