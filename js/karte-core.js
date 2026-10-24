/* Offline-Ark – Kartenrechnung (rein mathematisch, ohne DOM; läuft auch in Node für Tests).
 * Projektion: Web-Mercator (wie OSM-Kacheln, 256 px je Kachel). Entfernung: Haversine, Richtung: Anfangskurs
 * (gleiche Formeln wie im Werkzeug "Koordinaten & GPS"). */
(function (root) {
  'use strict';
  var RAD = Math.PI / 180, R_EARTH = 6371008.8, TILE = 256, MAX_LAT = 85.0511287798;

  function clampLat(lat) { return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)); }
  function worldSize(z) { return TILE * Math.pow(2, z); }

  /** Normierte Mercator-Koordinaten 0..1 (x nach Osten, y nach Süden). */
  function norm(lat, lon) {
    var s = Math.sin(clampLat(lat) * RAD);
    return { x: (lon + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
  }
  function unnorm(x, y) {
    var n = Math.PI - 2 * Math.PI * y;
    return { lat: Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) / RAD, lon: x * 360 - 180 };
  }
  /** Weltpixel bei Zoom z (z darf Kommazahl sein). */
  function toWorld(lat, lon, z) { var n = norm(lat, lon), S = worldSize(z); return { x: n.x * S, y: n.y * S }; }
  function fromWorld(x, y, z) { var S = worldSize(z); return unnorm(x / S, y / S); }

  /** Meter je Bildschirmpixel auf Breite lat bei Zoom z (Web-Mercator rechnet mit dem Äquatorradius 6378137 m). */
  function metersPerPixel(lat, z) { return 2 * Math.PI * 6378137 * Math.cos(clampLat(lat) * RAD) / worldSize(z); }

  function distance(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * RAD, p2 = lat2 * RAD, dp = (lat2 - lat1) * RAD, dl = (lon2 - lon1) * RAD;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function bearing(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD;
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return ((Math.atan2(y, x) / RAD) + 360) % 360;
  }
  /** Himmelsrichtung (0..7: N, NO, O, SO, S, SW, W, NW) */
  function dirIndex(deg) { return Math.round((((deg % 360) + 360) % 360) / 45) % 8; }

  /** Schöne Maßstabslänge (1, 2, 5 × 10^n Meter) für höchstens maxPx Pixel. -> { meters, px } */
  function niceScale(mpp, maxPx) {
    var raw = mpp * maxPx, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var m = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
    return { meters: m, px: m / mpp };
  }

  /** Erster Index mit items[i][0] >= lat (items sind nach Breite sortiert). */
  function lowerBound(items, lat) {
    var lo = 0, hi = items.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (items[mid][0] < lat) lo = mid + 1; else hi = mid; }
    return lo;
  }
  /** Alle Einträge im Rechteck (s, w, n, e); max begrenzt die Menge. */
  function inBounds(items, s, w, n, e, max) {
    var out = [];
    for (var i = lowerBound(items, s); i < items.length && items[i][0] <= n; i++) {
      var lon = items[i][1];
      if (lon >= w && lon <= e) { out.push(items[i]); if (max && out.length >= max) break; }
    }
    return out;
  }

  /** Die n nächsten Einträge (Filter optional). Rückgabe: [{ item, dist, bearing }] aufsteigend. */
  function nearest(items, lat, lon, n, filter) {
    var best = [], k = Math.cos(lat * RAD);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (filter && !filter(it)) continue;
      var dy = it[0] - lat, dx = (it[1] - lon) * k, approx = dy * dy + dx * dx;
      if (best.length === n && approx > best[n - 1].approx) continue;
      best.push({ item: it, approx: approx });
      best.sort(function (a, b) { return a.approx - b.approx; });
      if (best.length > n) best.pop();
    }
    return best.map(function (b) {
      return { item: b.item, dist: distance(lat, lon, b.item[0], b.item[1]), bearing: bearing(lat, lon, b.item[0], b.item[1]) };
    }).sort(function (a, b) { return a.dist - b.dist; });
  }

  /** Delta-codierte Linie [x0,y0,dx,dy,...] -> Float64Array normierter Mercator-Punkte [nx,ny,...] */
  function decodeLine(arr, scale) {
    var out = new Float64Array(arr.length), x = 0, y = 0;
    for (var i = 0; i < arr.length; i += 2) {
      x += arr[i]; y += arr[i + 1];
      var n = norm(y / scale, x / scale);
      out[i] = n.x; out[i + 1] = n.y;
    }
    return out;
  }

  /** Entfernung als [Zahl, Einheit] in m/km (metrisch). */
  function distParts(m) {
    if (m < 1000) return [Math.round(m), 'm'];
    if (m < 10000) return [Math.round(m / 100) / 10, 'km'];
    return [Math.round(m / 1000), 'km'];
  }

  /** Kachel-Pfad aus Muster mit {z}/{x}/{y} */
  function tilePath(pattern, z, x, y) { return pattern.replace('{z}', z).replace('{x}', x).replace('{y}', y); }

  /** Kopierbarer Text: Dezimalgrad mit Punkt (universell einlesbar). */
  function coordText(lat, lon) { return lat.toFixed(5) + ', ' + lon.toFixed(5); }

  var api = {
    TILE: TILE, MAX_LAT: MAX_LAT, R_EARTH: R_EARTH, clampLat: clampLat, worldSize: worldSize, norm: norm, unnorm: unnorm,
    toWorld: toWorld, fromWorld: fromWorld, metersPerPixel: metersPerPixel, distance: distance, bearing: bearing, dirIndex: dirIndex,
    niceScale: niceScale, lowerBound: lowerBound, inBounds: inBounds, nearest: nearest, decodeLine: decodeLine, distParts: distParts,
    tilePath: tilePath, coordText: coordText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OA_KARTE_CORE = api;
})(typeof window !== 'undefined' ? window : globalThis);
