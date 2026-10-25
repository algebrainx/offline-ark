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
      var dy = it[0] - lat, dx = (((it[1] - lon + 540) % 360 + 360) % 360 - 180) * k, approx = dy * dy + dx * dx;
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

  /** Länge in den Bereich [-180, 180) bringen (Datumsgrenze). */
  function wrapLon(lon) { return ((((lon + 180) % 360) + 360) % 360) - 180; }

  /** Punkt-in-Ring (Strahlverfahren); ring = Float64Array [x0,y0,x1,y1,...] (Ring ist implizit geschlossen). */
  function pointInRing(ring, x, y) {
    var inside = false, n = ring.length;
    for (var i = 0, j = n - 2; i < n; j = i, i += 2) {
      var xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  /** Punkt in Polygon mit Löchern: rings[0] = Außenring, danach Löcher; Einträge { p: Float64Array, b: [x0,y0,x1,y1] }. */
  function inPolygon(rings, x, y) {
    var o = rings[0];
    if (x < o.b[0] || x > o.b[2] || y < o.b[1] || y > o.b[3] || !pointInRing(o.p, x, y)) return false;
    for (var i = 1; i < rings.length; i++) {
      var h = rings[i];
      if (x >= h.b[0] && x <= h.b[2] && y >= h.b[1] && y <= h.b[3] && pointInRing(h.p, x, y)) return false;
    }
    return true;
  }

  /** Kleinste Zoomstufe, bei der die ganze Welt (±85°) in ein w × h großes Fenster passt. */
  function worldFitZoom(w, h) { return Math.max(0, Math.log(Math.min(w, h) / TILE) / Math.LN2); }

  /** Kartenmitte und Zoom, damit das Rechteck (s, w, n, e) in ein W × H großes Fenster passt (pad = Anteil, z. B. 0.9). */
  function fitBounds(s, w, n, e, W, H, pad) {
    var a = norm(n, w), b = norm(s, e), dx = Math.max(1e-9, b.x - a.x), dy = Math.max(1e-9, b.y - a.y);
    var z = Math.min(Math.log((W * (pad || 1)) / (TILE * dx)), Math.log((H * (pad || 1)) / (TILE * dy))) / Math.LN2;
    var c = unnorm((a.x + b.x) / 2, (a.y + b.y) / 2);
    return { lat: c.lat, lon: c.lon, z: z };
  }

  /** Ab welcher Zoomstufe eine Stadt (Einwohner in Tausend) beschriftet wird; Hauptstädte etwas früher. */
  function cityMinZoom(popK, capital) {
    var t = popK >= 10000 ? 0.4 : popK >= 5000 ? 2 : popK >= 2500 ? 2.9 : popK >= 1200 ? 3.6 : popK >= 700 ? 4.3 : popK >= 450 ? 4.9 : 5.4;
    return capital && t > 2.2 ? Math.max(2.2, t - 1) : t;
  }

  /** Kachel-Pfad aus Muster mit {z}/{x}/{y} */
  function tilePath(pattern, z, x, y) { return pattern.replace('{z}', z).replace('{x}', x).replace('{y}', y); }

  /** Kopierbarer Text: Dezimalgrad mit Punkt (universell einlesbar). */
  function coordText(lat, lon) { return lat.toFixed(5) + ', ' + lon.toFixed(5); }

  var api = {
    TILE: TILE, MAX_LAT: MAX_LAT, R_EARTH: R_EARTH, clampLat: clampLat, worldSize: worldSize, norm: norm, unnorm: unnorm,
    toWorld: toWorld, fromWorld: fromWorld, metersPerPixel: metersPerPixel, distance: distance, bearing: bearing, dirIndex: dirIndex,
    niceScale: niceScale, lowerBound: lowerBound, inBounds: inBounds, nearest: nearest, decodeLine: decodeLine, distParts: distParts,
    tilePath: tilePath, coordText: coordText, wrapLon: wrapLon, pointInRing: pointInRing, inPolygon: inPolygon,
    worldFitZoom: worldFitZoom, fitBounds: fitBounds, cityMinZoom: cityMinZoom
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OA_KARTE_CORE = api;
})(typeof window !== 'undefined' ? window : globalThis);
