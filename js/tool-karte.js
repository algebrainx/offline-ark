/* Offline-Ark – Offline-Karte: Canvas-Viewer (Pan, Zoom, Pinch), Ebenen, Position, eigene Punkte, optionale Kacheln.
 * Rechenfunktionen stehen in js/karte-core.js. Kartendaten: data/karte-*.js (lazy per <script>, kein fetch). */
(function () {
  'use strict';
  var OA = window.OA, K = window.OA_KARTE_CORE, CFG = window.OA_KARTE_CONFIG, BASE = window.OA_KARTE_BASE;
  var REGIONS = window.OA_KARTE_REGIONS || [];
  var $ = OA.$;

  /* ---------- Typen und Ebenen ---------- */
  // Farbe: Schlüssel der CSS-Variablen; minZoom: ab dieser Zoomstufe sichtbar
  var TYPES = {
    h: { layer: 'hospital', name: 'Krankenhaus', glyph: 'cross', color: 'danger', shape: 'circle', minZoom: 6.5 },
    H: { layer: 'hospital', name: 'Krankenhaus mit Notaufnahme', glyph: 'cross', color: 'danger', shape: 'circle', minZoom: 6.5, big: 1 },
    a: { layer: 'pharmacy', name: 'Apotheke', glyph: 'A', color: 'ok', shape: 'circle', minZoom: 10 },
    d: { layer: 'defib', name: 'Defibrillator (AED)', glyph: 'bolt', color: 'accent', shape: 'circle', minZoom: 11.5 },
    f: { layer: 'fire', name: 'Feuerwehr', glyph: 'F', color: 'danger', shape: 'square', minZoom: 10 },
    p: { layer: 'fire', name: 'Polizei', glyph: 'P', color: 'accent', shape: 'square', minZoom: 10 },
    n: { layer: 'fire', name: 'Notrufsäule', glyph: 'N', color: 'text2', shape: 'square', minZoom: 13.5 },
    s: { layer: 'fire', name: 'Sammelplatz (Notfall)', glyph: 'flag', color: 'ok', shape: 'square', minZoom: 12.5 },
    w: { layer: 'water', name: 'Trinkwasser', glyph: 'drop', color: 'accent', shape: 'drop', minZoom: 11.5 },
    b: { layer: 'water', name: 'Brunnen', glyph: 'dropo', color: 'accent', shape: 'drop', minZoom: 13, hint: 'water' },
    q: { layer: 'water', name: 'Quelle', glyph: 'dropo', color: 'accent', shape: 'drop', minZoom: 13, hint: 'water' }
  };
  var OWN_TYPES = {
    t: { name: 'Treffpunkt', glyph: 'flag', color: 'accent' },
    l: { name: 'Leuchtturm / Notfalltreffpunkt', glyph: 'star', color: 'accent' },
    w: { name: 'Wasserstelle', glyph: 'drop', color: 'accent' },
    u: { name: 'Notunterkunft', glyph: 'house', color: 'accent' },
    x: { name: 'Sonstiges', glyph: 'dot', color: 'accent' }
  };
  var POI_LAYERS = ['hospital', 'pharmacy', 'fire', 'water', 'defib'];     // Priorität beim Ausdünnen (wichtigstes zuerst)
  var LAYER_NAMES = { hospital: 'Krankenhäuser', pharmacy: 'Apotheken', defib: 'Defibrillatoren', fire: 'Feuerwehr & Notfall', water: 'Wasser', own: 'Meine Punkte', wp: 'Wegpunkte' };
  var LAYER_ORDER = ['hospital', 'pharmacy', 'defib', 'fire', 'water', 'own', 'wp'];

  var DIRS = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];
  var SHORT = {
    de: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'], en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    es: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'], ar: null
  };

  /* ---------- Zustand ---------- */
  var saved = OA.store.get('karte', null) || {};
  var view = { lat: CFG.view.lat, lon: CFG.view.lon, z: CFG.view.zoom };
  if (saved.view && isFinite(saved.view.lat) && isFinite(saved.view.lon) && isFinite(saved.view.z)) view = { lat: saved.view.lat, lon: saved.view.lon, z: saved.view.z };
  var layersOn = saved.layers || { hospital: true, own: true, wp: true };
  var data = {};                 // Ebene -> { items, state: 'idle'|'loading'|'ok'|'error' }
  var geo = { ready: false, kreise: [], rivers: [], places: [], kreisNames: [], gem: [], gemLoaded: false, gemLoading: false };
  var pos = null;                // { lat, lon, acc }
  var sel = null;                // angetippter Punkt oder gewähltes Objekt
  var ownPoints = OA.store.get('karte_punkte', []);
  if (!Array.isArray(ownPoints)) ownPoints = [];
  var waypoints = [];
  var tapPoint = null;           // zuletzt angetippte Stelle (für "Ort" im Formular)
  var editing = null;            // id des bearbeiteten Punktes

  var canvas = $('#map'), ctx = canvas.getContext('2d'), box = $('#mapbox');
  var W = 300, H = 300, DPR = 1, dirty = true, C = {}, hits = [];

  /* ---------- Hilfen ---------- */
  function clampZ(z) { return Math.max(CFG.minZoom, Math.min(CFG.maxZoom, z)); }
  function fmtDist(m) {
    var p = K.distParts(m);
    return OA.fmt(p[0], p[1] === 'km' && p[0] < 10 ? 1 : 0) + ' ' + p[1];
  }
  function dirShort(deg) {
    var i = K.dirIndex(deg), s = SHORT[OA.lang];
    return s ? s[i] : OA.t(DIRS[i]);
  }
  function dirLine(m, deg) { return fmtDist(m) + ' · ' + dirShort(deg) + ' (' + Math.round(deg) % 360 + '°)'; }
  function hemi(lat, lon) {
    var de = OA.lang === 'de', es = OA.lang === 'es';
    function f(v) { return Math.abs(v).toLocaleString(OA.locale, { minimumFractionDigits: 5, maximumFractionDigits: 5, useGrouping: false }); }
    return f(lat) + '° ' + (lat < 0 ? 'S' : 'N') + ', ' + f(lon) + '° ' + (lon < 0 ? (es ? 'O' : 'W') : (de ? 'O' : 'E'));
  }
  function setStatus(t) { $('#status').textContent = t || ''; }
  function saveState() {
    OA.store.set('karte', { view: { lat: +view.lat.toFixed(5), lon: +view.lon.toFixed(5), z: +view.z.toFixed(2) }, layers: layersOn });
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = OA.root + src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  function refreshColors() {
    var cs = getComputedStyle(document.documentElement);
    function v(n) { return cs.getPropertyValue(n).trim() || '#888'; }
    C = { bg: v('--bg'), surface: v('--surface'), surface2: v('--surface-2'), text: v('--text'), text2: v('--text-2'), line: v('--line'),
      accent: v('--accent'), danger: v('--danger'), ok: v('--ok'), on: v('--on-accent'), font: getComputedStyle(document.body).fontFamily };
    dirty = true;
  }
  function col(name) { return name === 'text2' ? C.text2 : C[name]; }

  /* ---------- Grundkarte dekodieren ---------- */
  function mkLine(arr, scale, name) {
    var p = K.decodeLine(arr, scale), x0 = 2, y0 = 2, x1 = -1, y1 = -1;
    for (var i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; }
    return { p: p, b: [x0, y0, x1, y1], n: name };
  }
  var base = { land: [], nb: [], states: [], lakes: [], rivers: [], places: [] };
  if (BASE) {
    base.land = BASE.land.map(function (r) { return mkLine(r, BASE.scale); });
    base.nb = BASE.nb.map(function (r) { return mkLine(r, BASE.scale); });
    BASE.states.forEach(function (s) { base.states.push({ n: s.n, c: s.c, r: s.r.map(function (r) { return mkLine(r, BASE.scale, s.n); }) }); });
    BASE.lakes.forEach(function (l) { l.r.forEach(function (r) { base.lakes.push(mkLine(r, BASE.scale, l.n)); }); });
    base.rivers = BASE.rivers.map(function (r) { return mkLine(r.l, BASE.scale, r.n); });
    base.places = BASE.places.map(function (p) { return { lat: p[0], lon: p[1], pop: p[2], name: p[3], de: p[4] }; });
  }

  function loadGeo() {
    var regs = REGIONS.filter(function (r) { return r.geo; });
    return Promise.all(regs.map(function (r) { return loadScript(r.geo).then(function () { return r; }).catch(function () { return null; }); })).then(function (list) {
      list.forEach(function (r) {
        var g = r && window.OA_KARTE_GEO && window.OA_KARTE_GEO[r.id];
        if (!g) return;
        g.kreise.forEach(function (l) { geo.kreise.push(mkLine(l, g.scale)); });
        g.rivers.forEach(function (l) { geo.rivers.push(mkLine(l.l, g.scale, l.n)); });
        g.places.forEach(function (p) { geo.places.push({ lat: p[0], lon: p[1], kind: p[2], name: p[3], pop: p[4] }); });
        g.kreisNames.forEach(function (n) { geo.kreisNames.push({ lat: n[0], lon: n[1], name: n[2] }); });
        geo.ready = true;
      });
      dirty = true;
    });
  }
  function loadGemeinden() {
    if (geo.gemLoaded || geo.gemLoading) return;
    geo.gemLoading = true;
    var regs = REGIONS.filter(function (r) { return r.gemeinden; });
    Promise.all(regs.map(function (r) { return loadScript(r.gemeinden).then(function () { return r; }).catch(function () { return null; }); })).then(function (list) {
      list.forEach(function (r) {
        var g = r && window.OA_KARTE_GEMEINDEN && window.OA_KARTE_GEMEINDEN[r.id];
        if (g) g.lines.forEach(function (l) { geo.gem.push(mkLine(l, g.scale)); });
      });
      geo.gemLoaded = true; geo.gemLoading = false; dirty = true;
    });
  }

  /* ---------- Punktdaten (POI) lazy laden ---------- */
  function ensureLayer(cat) {
    var d = data[cat] || (data[cat] = { items: [], state: 'idle' });
    if (d.state === 'ok' || d.state === 'loading') return d.promise || Promise.resolve();
    d.state = 'loading'; setChipBusy(cat, true);
    var regs = REGIONS.filter(function (r) { return r.files && r.files[cat]; });
    d.promise = Promise.all(regs.map(function (r) { return loadScript(r.files[cat]); })).then(function () {
      var parts = (window.OA_KARTE_POI && window.OA_KARTE_POI[cat]) || [];
      var items = [];
      parts.forEach(function (p) { items = items.concat(p.items); });
      items.sort(function (a, b) { return a[0] - b[0]; });
      d.items = items; d.state = 'ok'; setChipBusy(cat, false); dirty = true; updateNearby();
    }).catch(function () {
      d.state = 'error'; setChipBusy(cat, false);
      setStatus(OA.t('Daten konnten nicht geladen werden.'));
    });
    return d.promise;
  }
  function setChipBusy(cat, on) { var b = $('.lchip[data-layer="' + cat + '"]'); if (b) b.setAttribute('aria-busy', on ? 'true' : 'false'); }

  function readWaypoints() {
    var w = OA.store.get('wegpunkte', []);
    waypoints = Array.isArray(w) ? w.filter(function (x) { return x && isFinite(x.lat) && isFinite(x.lon); }) : [];
  }

  /* ---------- Marker zeichnen ---------- */
  function drawMarker(g, x, y, spec, scale) {
    var r = (spec.big ? 11 : 9) * (scale || 1), colr = col(spec.color);
    g.save();
    g.lineWidth = 2; g.strokeStyle = C.surface; g.fillStyle = colr;
    g.beginPath();
    if (spec.shape === 'square') { rr(g, x - r, y - r, 2 * r, 2 * r, r * .3); }
    else if (spec.shape === 'drop') { g.moveTo(x, y - r * 1.25); g.bezierCurveTo(x + r * 1.1, y - r * .1, x + r * .95, y + r, x, y + r); g.bezierCurveTo(x - r * .95, y + r, x - r * 1.1, y - r * .1, x, y - r * 1.25); }
    else g.arc(x, y, r, 0, 7);
    g.fill(); g.stroke();
    g.fillStyle = C.on; g.strokeStyle = C.on; g.lineWidth = Math.max(1.5, r * .22); g.lineCap = 'round'; g.lineJoin = 'round';
    var k = r * .55;
    switch (spec.glyph) {
      case 'cross': g.fillRect(x - k * .32, y - k, k * .64, k * 2); g.fillRect(x - k, y - k * .32, k * 2, k * .64); break;
      case 'bolt': g.beginPath(); g.moveTo(x + k * .3, y - k * 1.1); g.lineTo(x - k * .6, y + k * .15); g.lineTo(x, y + k * .15); g.lineTo(x - k * .3, y + k * 1.1); g.lineTo(x + k * .6, y - k * .15); g.lineTo(x, y - k * .15); g.closePath(); g.fill(); break;
      case 'drop': g.beginPath(); g.moveTo(x, y - k * .9); g.quadraticCurveTo(x + k * 1.1, y + k * .3, x, y + k * 1); g.quadraticCurveTo(x - k * 1.1, y + k * .3, x, y - k * .9); g.fill(); break;
      case 'dropo': g.beginPath(); g.arc(x, y + k * .1, k * .55, 0, 7); g.stroke(); break;
      case 'flag': g.beginPath(); g.moveTo(x - k * .6, y + k); g.lineTo(x - k * .6, y - k); g.stroke(); g.beginPath(); g.moveTo(x - k * .6, y - k); g.lineTo(x + k * .9, y - k * .35); g.lineTo(x - k * .6, y + k * .2); g.closePath(); g.fill(); break;
      case 'star': g.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? k * .5 : k * 1.2; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); g.fill(); break;
      case 'house': g.beginPath(); g.moveTo(x - k, y); g.lineTo(x, y - k); g.lineTo(x + k, y); g.lineTo(x + k * .7, y); g.lineTo(x + k * .7, y + k); g.lineTo(x - k * .7, y + k); g.lineTo(x - k * .7, y); g.closePath(); g.fill(); break;
      case 'dot': g.beginPath(); g.arc(x, y, k * .5, 0, 7); g.fill(); break;
      default: g.font = '700 ' + Math.round(r * 1.25) + 'px ' + C.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spec.glyph, x, y + 1);
    }
    g.restore();
  }
  function rr(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /* ---------- Kacheln (optional, eigene Dateien) ---------- */
  var T = { on: !!OA.store.get('karte_tiles', CFG.tiles.enabled), cache: {}, pending: 0, found: 0, failed: 0 };
  function tileFor(z, x, y) {
    var key = z + '/' + x + '/' + y, t = T.cache[key];
    if (t) return t;
    if (T.pending >= 8) return null;
    t = T.cache[key] = { img: null, state: 0 };
    T.pending++;
    tryExt(t, z, x, y, 0);
    return t;
  }
  function tryExt(t, z, x, y, i) {
    var exts = CFG.tiles.exts, img = new Image();
    img.onload = function () { t.img = img; t.state = 1; T.found++; T.pending--; dirty = true; };
    img.onerror = function () {
      if (i + 1 < exts.length) tryExt(t, z, x, y, i + 1);
      else { t.state = 2; T.failed++; T.pending--; dirty = true; }
    };
    img.src = K.tilePath(CFG.tiles.path, z, x, y) + '.' + exts[i];
  }
  function drawTiles(g, S, cx, cy) {
    var tc = CFG.tiles, tz = Math.max(tc.minZoom, Math.min(tc.maxZoom, Math.round(view.z))), n = Math.pow(2, tz), f = Math.pow(2, view.z - tz), ts = 256 * f;
    var x0 = Math.floor((cx - W / 2) / ts), x1 = Math.floor((cx + W / 2) / ts), y0 = Math.floor((cy - H / 2) / ts), y1 = Math.floor((cy + H / 2) / ts);
    var drew = false;
    for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      var t = tileFor(tz, ((x % n) + n) % n, y);
      if (t && t.state === 1) { g.drawImage(t.img, Math.round(x * ts - cx + W / 2), Math.round(y * ts - cy + H / 2), Math.ceil(ts), Math.ceil(ts)); drew = true; }
    }
    return drew;
  }

  /* ---------- Zeichnen ---------- */
  function render(g, opts) {
    opts = opts || {};
    var S = K.worldSize(view.z), c = K.norm(view.lat, view.lon), cx = c.x * S, cy = c.y * S;
    var nx0 = (cx - W / 2) / S, nx1 = (cx + W / 2) / S, ny0 = (cy - H / 2) / S, ny1 = (cy + H / 2) / S;
    function vis(b) { return !(b[2] < nx0 || b[0] > nx1 || b[3] < ny0 || b[1] > ny1); }
    function sx(n) { return n * S - cx + W / 2; }
    function sy(n) { return n * S - cy + H / 2; }
    function trace(l, close) {
      var p = l.p, n = p.length, x = sx(p[0]), y = sy(p[1]), lx = x, ly = y;
      g.moveTo(x, y);
      for (var i = 2; i < n; i += 2) {
        x = p[i] * S - cx + W / 2; y = p[i + 1] * S - cy + H / 2;
        if (i < n - 2 && Math.abs(x - lx) < .6 && Math.abs(y - ly) < .6) continue;
        g.lineTo(x, y); lx = x; ly = y;
      }
      if (close) g.closePath();
    }
    function polys(list, fill, stroke, lw) {
      g.beginPath();
      for (var i = 0; i < list.length; i++) if (vis(list[i].b)) trace(list[i], true);
      if (fill) { g.fillStyle = fill; g.fill('evenodd'); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    }
    function strokes(list, stroke, lw, alpha) {
      g.beginPath();
      for (var i = 0; i < list.length; i++) if (vis(list[i].b)) trace(list[i], false);
      g.globalAlpha = alpha == null ? 1 : alpha; g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); g.globalAlpha = 1;
    }

    g.setTransform(opts.scale || DPR, 0, 0, opts.scale || DPR, 0, 0);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.globalAlpha = .13; g.fillStyle = C.accent; g.fillRect(0, 0, W, H); g.globalAlpha = 1;      // Meer/Außenbereich leicht getönt

    var tilesDrawn = false;
    if (T.on && !opts.noTiles) tilesDrawn = drawTiles(g, S, cx, cy);
    var z = view.z;
    if (!tilesDrawn) {
      polys(base.nb, C.surface2, C.line, 1);
      polys(base.land, C.surface, C.text2, 1);
      g.globalAlpha = .35; g.fillStyle = C.accent; g.beginPath();
      for (var li = 0; li < base.lakes.length; li++) if (vis(base.lakes[li].b)) trace(base.lakes[li], true);
      g.fill('evenodd'); g.globalAlpha = 1;
    }
    // Flüsse
    var riverList = geo.ready && z >= 7 ? geo.rivers : [];
    strokes(base.rivers, C.accent, Math.max(1, Math.min(3, (z - 3) * .35)), .75);
    if (riverList.length) strokes(riverList, C.accent, Math.max(.8, Math.min(2.4, (z - 6) * .3)), .8);
    // Grenzen: Länder (Natural Earth), im geladenen Gebiet ab Zoom 9 die genaueren Landkreis-/Gemeindegrenzen
    var stateLines = [];
    base.states.forEach(function (s) { s.r.forEach(function (r) { stateLines.push(r); }); });
    strokes(stateLines, C.text2, z < 9 ? 1.2 : .8, z < 9 ? .8 : .4);
    if (geo.ready && z >= 8.3) strokes(geo.kreise, C.text2, z < 10 ? 1 : 1.5, .75);
    if (geo.gemLoaded && z >= 10.3) strokes(geo.gem, C.text2, .8, .45);
    g.globalAlpha = 1;

    // Beschriftungen mit einfacher Kollisionsprüfung
    var boxes = [];
    function label(text, x, y, size, color, italic, bold) {
      g.font = (italic ? 'italic ' : '') + (bold ? '700 ' : '500 ') + size + 'px ' + C.font;
      var w = g.measureText(text).width, bx = x - w / 2 - 2, by = y - size / 2 - 1, bw = w + 4, bh = size + 2;
      if (bx > W || bx + bw < 0 || by > H || by + bh < 0) return false;
      for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (bx < b[0] + b[2] && bx + bw > b[0] && by < b[1] + b[3] && by + bh > b[1]) return false; }
      boxes.push([bx, by, bw, bh]);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = C.surface; g.strokeText(text, x, y);
      g.fillStyle = color; g.fillText(text, x, y);
      return true;
    }
    function pt(lat, lon) { var n = K.norm(lat, lon); return [sx(n.x), sy(n.y)]; }

    if (z < 9) base.states.forEach(function (s) { var p = pt(s.c[1], s.c[0]); label(s.n.toUpperCase(), p[0], p[1], 10, C.text2, false, true); });
    if (geo.ready && z >= 8.3 && z < 11) geo.kreisNames.forEach(function (k) { var p = pt(k.lat, k.lon); label(k.name, p[0], p[1], 11, C.text2, true); });
    // Orte
    var placeDots = [];
    if (geo.ready && z >= 7) {
      var minKind = z >= 11.5 ? 'v' : z >= 8.8 ? 't' : 'c';
      geo.places.forEach(function (p) {
        if (p.kind === 'v' && minKind !== 'v' && !(p.pop >= 8000 && z >= 10)) return;
        if (p.kind === 't' && minKind === 'c' && !(p.pop >= 40000 && z >= 7.8)) return;
        var n = K.norm(p.lat, p.lon), x = sx(n.x), y = sy(n.y);
        if (x < -40 || x > W + 40 || y < -20 || y > H + 20) return;
        placeDots.push([x, y, p]);
      });
    }
    placeDots.forEach(function (d) {
      var p = d[2], big = p.kind === 'c' ? 14 : p.kind === 't' ? 12 : 11;
      g.fillStyle = C.text; g.beginPath(); g.arc(d[0], d[1], p.kind === 'c' ? 3 : 2.2, 0, 7); g.fill();
      label(p.name, d[0], d[1] - big * .9, big, C.text, false, p.kind === 'c');
    });
    base.places.forEach(function (p) {
      if (geo.ready && z >= 7 && inRegion(p.lat, p.lon)) return;      // dort kommen die OSM-Orte
      var need = p.pop >= 1000000 ? 4 : p.pop >= 300000 ? 5.5 : 6.5;
      if (z < need || (!p.de && z > 8)) return;
      var q = pt(p.lat, p.lon);
      g.fillStyle = C.text; g.beginPath(); g.arc(q[0], q[1], 3, 0, 7); g.fill();
      label(p.name, q[0], q[1] - 12, p.pop >= 500000 ? 13 : 11.5, C.text, false, p.pop >= 500000);
    });
    // Flussnamen
    if (z >= 9.5 && geo.ready) {
      var seen = {};
      geo.rivers.forEach(function (r) {
        if (!r.n || seen[r.n] || !vis(r.b)) return;
        var m = r.p.length / 4 | 0, mi = m * 2, x = sx(r.p[mi]), y = sy(r.p[mi + 1]);
        if (x < 10 || x > W - 10 || y < 10 || y > H - 10) return;
        if (label(r.n, x, y, 10.5, C.accent, true)) seen[r.n] = 1;
      });
    }

    // Punkte der Ebenen
    hits = [];
    var grid = {}, drawQueue = [];
    var s0 = null;
    function bounds() {
      var tl = K.fromWorld(cx - W / 2, cy - H / 2, z), br = K.fromWorld(cx + W / 2, cy + H / 2, z);
      return { n: tl.lat, s: br.lat, w: tl.lon, e: br.lon };
    }
    var bb = bounds();
    var cell = z < 14 ? 22 : 0;
    function enqueue(spec, lat, lon, ref) {
      var n = K.norm(lat, lon), x = sx(n.x), y = sy(n.y);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
      if (cell) { var key = Math.floor(x / cell) * 10000 + Math.floor(y / cell); if (grid[key]) return; grid[key] = 1; }
      drawQueue.push([x, y, spec, ref]);
    }
    function cellBypass(spec, lat, lon, ref) {            // eigene Punkte werden nie ausgedünnt
      var n = K.norm(lat, lon), x = sx(n.x), y = sy(n.y);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
      drawQueue.push([x, y, spec, ref, 1]);
    }
    if (layersOn.own) ownPoints.forEach(function (p) { var sp = OWN_TYPES[p.type] || OWN_TYPES.x; cellBypass(sp, p.lat, p.lon, { kind: 'own', item: p }); });
    if (layersOn.wp) waypoints.forEach(function (p) { cellBypass({ glyph: 'dot', color: 'text', shape: 'diamond' }, p.lat, p.lon, { kind: 'wp', item: p }); });
    POI_LAYERS.forEach(function (cat) {
      var d = data[cat];
      if (!layersOn[cat] || !d || d.state !== 'ok') return;
      var list = K.inBounds(d.items, bb.s, bb.w, bb.n, bb.e, 6000);
      list.forEach(function (it) { var spec = TYPES[it[2]]; if (spec && z >= spec.minZoom) enqueue(spec, it[0], it[1], { kind: 'poi', item: it }); });
    });
    // wichtigste zuletzt zeichnen (liegen oben)
    for (var qi = drawQueue.length - 1; qi >= 0; qi--) {
      var q = drawQueue[qi];
      if (q[2].shape === 'diamond') drawWaypoint(g, q[0], q[1]); else drawMarker(g, q[0], q[1], q[2], z < 9 ? .8 : 1);
      hits.push({ x: q[0], y: q[1], r: 14, ref: q[3] });
    }
    hits.reverse();

    // angetippte Stelle
    if (sel && !opts.noSel) {
      var sn = K.norm(sel.lat, sel.lon), ssx = sx(sn.x), ssy = sy(sn.y);
      g.strokeStyle = C.text; g.lineWidth = 2; g.beginPath(); g.arc(ssx, ssy, 14, 0, 7); g.stroke();
      g.strokeStyle = C.surface; g.lineWidth = 4; g.beginPath(); g.moveTo(ssx - 22, ssy); g.lineTo(ssx - 8, ssy); g.moveTo(ssx + 8, ssy); g.lineTo(ssx + 22, ssy); g.moveTo(ssx, ssy - 22); g.lineTo(ssx, ssy - 8); g.moveTo(ssx, ssy + 8); g.lineTo(ssx, ssy + 22); g.stroke();
      g.strokeStyle = C.text; g.lineWidth = 2; g.stroke();
    }
    // eigene Position + Genauigkeitskreis
    if (pos) {
      var pn = K.norm(pos.lat, pos.lon), px = sx(pn.x), py = sy(pn.y), ar = pos.acc / K.metersPerPixel(pos.lat, z);
      if (ar > 6) { g.globalAlpha = .15; g.fillStyle = C.accent; g.beginPath(); g.arc(px, py, ar, 0, 7); g.fill(); g.globalAlpha = .6; g.strokeStyle = C.accent; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; }
      g.fillStyle = C.surface; g.beginPath(); g.arc(px, py, 9, 0, 7); g.fill();
      g.fillStyle = C.accent; g.beginPath(); g.arc(px, py, 6.5, 0, 7); g.fill();
    }
    // Kartenmitte (kleines Kreuz)
    if (!opts.noCenter) { g.strokeStyle = C.text2; g.lineWidth = 1; g.globalAlpha = .7; g.beginPath(); g.moveTo(W / 2 - 6, H / 2); g.lineTo(W / 2 + 6, H / 2); g.moveTo(W / 2, H / 2 - 6); g.lineTo(W / 2, H / 2 + 6); g.stroke(); g.globalAlpha = 1; }
  }
  function drawWaypoint(g, x, y) {
    g.save(); g.fillStyle = C.surface; g.strokeStyle = C.text; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 8, y); g.lineTo(x, y + 9); g.lineTo(x - 8, y); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = C.text; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); g.restore();
  }
  function inRegion(lat, lon) {
    return REGIONS.some(function (r) { return r.bbox && lat >= r.bbox[0] && lat <= r.bbox[2] && lon >= r.bbox[1] && lon <= r.bbox[3]; });
  }

  /* ---------- Overlay (Maßstab, Quellenangabe, Hinweis) ---------- */
  var lastScale = '', lastHint = '';
  function updateOverlay() {
    var mpp = K.metersPerPixel(view.lat, view.z), ns = K.niceScale(mpp, Math.min(140, W * .35));
    var txt = ns.meters >= 1000 ? OA.fmt(ns.meters / 1000, 0) + ' km' : OA.fmt(ns.meters, 0) + ' m';
    var key = txt + Math.round(ns.px);
    if (key !== lastScale) { lastScale = key; $('#scaleBar').style.width = Math.round(ns.px) + 'px'; $('#scaleTxt').textContent = txt; }
    var a = OA.t(CFG.attribution);
    if (T.on && T.found > 0 && a.indexOf(CFG.tiles.attribution) < 0) a = CFG.tiles.attribution + ' · ' + a;
    if ($('#attrib').textContent !== a) $('#attrib').textContent = a;
    var hint = '';
    var anyPoi = POI_LAYERS.some(function (c) { return layersOn[c]; });
    if (anyPoi && !inRegion(view.lat, view.lon)) hint = OA.t('Für diesen Ausschnitt gibt es keine Punkte-Daten (nur Baden-Württemberg).');
    else if (anyPoi && view.z < 6.5) hint = OA.t('Näher heranzoomen, um Punkte zu sehen.');
    else if (anyPoi) {
      var minZ = 99;
      POI_LAYERS.forEach(function (c) { if (layersOn[c]) Object.keys(TYPES).forEach(function (t) { if (TYPES[t].layer === c) minZ = Math.min(minZ, TYPES[t].minZoom); }); });
      var shown = false;
      POI_LAYERS.forEach(function (c) { if (layersOn[c] && data[c] && data[c].state === 'ok') shown = true; });
      if (shown && view.z < minZ) hint = OA.t('Näher heranzoomen, um Punkte zu sehen.');
    }
    if (hint !== lastHint) { lastHint = hint; $('#maphintText').textContent = hint; $('#maphint').hidden = !hint; }
  }

  /* ---------- Ansicht ändern ---------- */
  var moveTimer = 0;
  function setView(lat, lon, z) {
    view.lat = Math.max(-80, Math.min(80, lat)); view.lon = ((lon + 540) % 360) - 180; view.z = clampZ(z);
    dirty = true;
    if (view.z >= 10.3) loadGemeinden();
    clearTimeout(moveTimer);
    moveTimer = setTimeout(function () { saveState(); if (!pos) updateNearby(); updatePformCoord(); }, 300);
  }
  function zoomAt(px, py, newZ) {
    newZ = clampZ(newZ);
    var S = K.worldSize(view.z), c = K.norm(view.lat, view.lon);
    var wx = c.x * S + (px - W / 2), wy = c.y * S + (py - H / 2), ll = K.fromWorld(wx, wy, view.z);
    var t = K.toWorld(ll.lat, ll.lon, newZ), cc = K.fromWorld(t.x - (px - W / 2), t.y - (py - H / 2), newZ);
    setView(cc.lat, cc.lon, newZ);
  }
  function panBy(dx, dy) {
    var S = K.worldSize(view.z), c = K.norm(view.lat, view.lon), ll = K.fromWorld(c.x * S - dx, c.y * S - dy, view.z);
    setView(ll.lat, ll.lon, view.z);
  }
  function screenToLL(px, py) {
    var S = K.worldSize(view.z), c = K.norm(view.lat, view.lon);
    return K.fromWorld(c.x * S + (px - W / 2), c.y * S + (py - H / 2), view.z);
  }

  /* ---------- Eingabe: Maus, Touch, Tastatur ---------- */
  var pts = {}, nPts = 0, down = null, longTimer = 0, pinch = null;
  function rel(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', function (e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignorieren */ }
    var p = rel(e);
    if (!pts[e.pointerId]) nPts++;
    pts[e.pointerId] = p;
    if (nPts === 1) {
      down = { x: p.x, y: p.y, t: Date.now(), moved: false };
      clearTimeout(longTimer);
      longTimer = setTimeout(function () { if (down && !down.moved && nPts === 1) { var d = down; down = null; onLongPress(d.x, d.y); } }, 600);
    } else if (nPts === 2) {
      clearTimeout(longTimer); down = null;
      var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pts[e.pointerId]) return;
    var p = rel(e), old = pts[e.pointerId];
    pts[e.pointerId] = p;
    if (nPts === 1 && down) {
      if (!down.moved && Math.hypot(p.x - down.x, p.y - down.y) > 7) { down.moved = true; clearTimeout(longTimer); }
      if (down.moved) panBy(p.x - old.x, p.y - old.y);
    } else if (nPts === 2 && pinch) {
      var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.d > 0 && d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.z + Math.log2(d / pinch.d));
    }
  });
  function endPointer(e, cancelled) {
    if (!pts[e.pointerId]) return;
    var p = rel(e);
    delete pts[e.pointerId]; nPts = Math.max(0, nPts - 1);
    clearTimeout(longTimer);
    if (nPts === 0 && down && !down.moved && !cancelled && Date.now() - down.t < 600) onTap(p.x, p.y);
    if (nPts < 2) pinch = null;
    if (nPts === 0) down = null;
  }
  canvas.addEventListener('pointerup', function (e) { endPointer(e, false); });
  canvas.addEventListener('pointercancel', function (e) { endPointer(e, true); });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = rel(e), dz = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018) * (e.ctrlKey ? 3 : 1);
    zoomAt(p.x, p.y, view.z + dz);
  }, { passive: false });
  canvas.addEventListener('dblclick', function (e) { var p = rel(e); zoomAt(p.x, p.y, view.z + 1); });
  canvas.addEventListener('keydown', function (e) {
    var k = e.key, step = 80;
    if (k === 'ArrowLeft') panBy(step, 0); else if (k === 'ArrowRight') panBy(-step, 0);
    else if (k === 'ArrowUp') panBy(0, step); else if (k === 'ArrowDown') panBy(0, -step);
    else if (k === '+' || k === '=') setView(view.lat, view.lon, view.z + 1); else if (k === '-') setView(view.lat, view.lon, view.z - 1);
    else return;
    e.preventDefault();
  });
  $('#zin').addEventListener('click', function () { setView(view.lat, view.lon, Math.round(view.z) + 1); });
  $('#zout').addEventListener('click', function () { setView(view.lat, view.lon, Math.round(view.z) - 1); });

  function onTap(x, y) {
    if (dirty) { dirty = false; render(ctx); }       // Trefferliste muss zur aktuellen Ansicht passen
    var best = null, bd = 1e9;
    for (var i = 0; i < hits.length; i++) { var h = hits[i], d = Math.hypot(h.x - x, h.y - y); if (d < h.r && d < bd) { bd = d; best = h; } }
    if (best) selectRef(best.ref);
    else { var ll = screenToLL(x, y); tapPoint = { lat: ll.lat, lon: ll.lon }; select({ lat: ll.lat, lon: ll.lon, kind: 'tap' }); }
  }
  function onLongPress(x, y) {
    var ll = screenToLL(x, y);
    tapPoint = { lat: ll.lat, lon: ll.lon };
    select({ lat: ll.lat, lon: ll.lon, kind: 'tap' });
    OA.vibrate(30);
    openForm(null, 'tap');
  }

  /* ---------- Auswahl-Karte ---------- */
  function selectRef(ref) {
    var it = ref.item;
    if (ref.kind === 'poi') select({ lat: it[0], lon: it[1], kind: 'poi', type: it[2], name: it[3] });
    else if (ref.kind === 'own') select({ lat: it.lat, lon: it.lon, kind: 'own', own: it });
    else select({ lat: it.lat, lon: it.lon, kind: 'wp', name: it.name });
  }
  function select(s) {
    sel = s; dirty = true;
    var card = $('#sel'); card.hidden = false;
    var kind, title = '', note = '';
    if (s.kind === 'poi') { var T0 = TYPES[s.type]; kind = OA.t(T0.name); title = s.name || ''; if (T0.hint === 'water') note = OA.t('Trinkbarkeit unbekannt: Wasser vor dem Trinken aufbereiten (siehe „Wasser entkeimen“).'); else note = OA.t('Daten aus OpenStreetMap, können veraltet sein. Im Notfall: 112.'); }
    else if (s.kind === 'own') { kind = OA.t(OWN_TYPES[s.own.type] ? OWN_TYPES[s.own.type].name : 'Sonstiges'); title = s.own.name; note = s.own.note || ''; }
    else if (s.kind === 'wp') { kind = OA.t('Wegpunkt'); title = s.name || ''; }
    else kind = OA.t('Angetippter Punkt');
    $('#selKind').textContent = kind;
    var tEl = $('#selTitle'); tEl.innerHTML = '<span data-notranslate>' + OA.esc(title) + '</span>'; tEl.hidden = !title;
    var nEl = $('#selNote'); nEl.hidden = !note;
    nEl.innerHTML = s.kind === 'own' ? '<span data-notranslate>' + OA.esc(note) + '</span>' : OA.esc(note);
    $('#selCoord').textContent = hemi(s.lat, s.lon);
    updateSelDist();
    $('#selEdit').hidden = $('#selDel').hidden = s.kind !== 'own';
    $('#selCopy').textContent = OA.t('Koordinaten kopieren');
  }
  function updateSelDist() {
    if (!sel) return;
    var el = $('#selDist');
    if (pos) el.textContent = OA.t('Von deiner Position: {0}', [dirLine(K.distance(pos.lat, pos.lon, sel.lat, sel.lon), K.bearing(pos.lat, pos.lon, sel.lat, sel.lon))]);
    else el.textContent = OA.t('Entfernung und Richtung erscheinen, sobald „Meine Position“ bekannt ist.');
  }
  $('#selCopy').addEventListener('click', function () {
    if (!sel) return;
    var text = K.coordText(sel.lat, sel.lon), b = $('#selCopy');
    function done() { b.textContent = OA.t('Kopiert'); setTimeout(function () { b.textContent = OA.t('Koordinaten kopieren'); }, 1600); }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { window.prompt(OA.t('Koordinaten kopieren'), text); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  });
  $('#selAdd').addEventListener('click', function () { tapPoint = { lat: sel.lat, lon: sel.lon }; openForm(null, 'tap'); });
  $('#selEdit').addEventListener('click', function () { if (sel && sel.own) openForm(sel.own, null); });
  $('#selDel').addEventListener('click', function () { if (sel && sel.own) deleteOwn(sel.own.id); });

  /* ---------- Meine Position ---------- */
  var locating = false;
  function geoError(err) {
    if (err && err.code === 1) return OA.t('Standortzugriff verweigert. Erlaube ihn in den Browser- oder Geräteeinstellungen für diese Seite.');
    if (err && err.code === 3) return OA.t('Zeitüberschreitung: Noch keine Position gefunden. Gehe ins Freie mit freiem Blick zum Himmel und versuche es erneut. Das kann eine Minute dauern.');
    return OA.t('Position nicht verfügbar. GPS braucht freien Himmel (nicht im Gebäude). Versuche es draußen noch einmal.');
  }
  $('#locate').addEventListener('click', function () {
    if (!navigator.geolocation) { setStatus(OA.t('Dieses Gerät oder dieser Browser bietet keine Standortfunktion.')); return; }
    if (locating) return;
    locating = true; $('#locate').disabled = true;
    setStatus(OA.t('Suche Position … funktioniert ohne Internet, kann draußen aber bis zu einer Minute dauern.'));
    navigator.geolocation.getCurrentPosition(function (p) {
      locating = false; $('#locate').disabled = false;
      pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy || 0 };
      setStatus(p.coords.accuracy > 100
        ? OA.t('Position gefunden, aber ungenau (±{0} m). Ins Freie gehen und erneut versuchen.', [OA.fmt(p.coords.accuracy, 0)])
        : OA.t('Position gefunden (Genauigkeit ±{0} m).', [OA.fmt(p.coords.accuracy, 0)]));
      setView(pos.lat, pos.lon, Math.max(view.z, 14));
      updateSelDist(); updateNearby(); dirty = true;
    }, function (err) {
      locating = false; $('#locate').disabled = false;
      setStatus(geoError(err));
    }, { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 });
  });

  /* ---------- Ebenen-Schalter ---------- */
  OA.$$('[data-icon]').forEach(function (s) { s.innerHTML = OA.icon(s.getAttribute('data-icon')); });
  function syncChips() {
    OA.$$('.lchip').forEach(function (b) { b.setAttribute('aria-pressed', layersOn[b.getAttribute('data-layer')] ? 'true' : 'false'); });
  }
  $('#layers').addEventListener('click', function (e) {
    var b = e.target.closest('.lchip'); if (!b) return;
    var l = b.getAttribute('data-layer');
    layersOn[l] = !layersOn[l];
    syncChips(); saveState();
    if (layersOn[l] && POI_LAYERS.indexOf(l) >= 0) ensureLayer(l);
    if (l === 'wp') readWaypoints();
    dirty = true; updateNearby();
  });

  /* ---------- Nächstgelegene ---------- */
  var nearTimer = 0;
  function updateNearby() {
    clearTimeout(nearTimer);
    nearTimer = setTimeout(renderNearby, 40);
  }
  function renderNearby() {
    var ref = pos || { lat: view.lat, lon: view.lon };
    $('#nearRef').textContent = pos ? OA.t('Ab deiner Position') : OA.t('Ab der Kartenmitte (für deine Position oben „Meine Position“ tippen)');
    var html = '', any = false;
    LAYER_ORDER.forEach(function (l) {
      if (!layersOn[l]) return;
      var res = [];
      if (POI_LAYERS.indexOf(l) >= 0) {
        var d = data[l];
        if (d && d.state === 'ok') res = K.nearest(d.items, ref.lat, ref.lon, 5).map(function (r) { return { lat: r.item[0], lon: r.item[1], title: r.item[3], sub: OA.t(TYPES[r.item[2]].name), d: r.dist, b: r.bearing, type: r.item[2], name: r.item[3] }; });
        else if (d && d.state === 'loading') { html += '<div class="near-group"><h3>' + OA.esc(OA.t(LAYER_NAMES[l])) + '</h3><div class="small muted">' + OA.esc(OA.t('Lade Daten …')) + '</div></div>'; any = true; return; }
      } else if (l === 'own') {
        res = K.nearest(ownPoints.map(function (p) { return [p.lat, p.lon, p.type, p.name, p]; }), ref.lat, ref.lon, 5).map(function (r) { var p = r.item[4]; return { lat: p.lat, lon: p.lon, title: p.name, sub: OA.t((OWN_TYPES[p.type] || OWN_TYPES.x).name), d: r.dist, b: r.bearing, own: p }; });
      } else if (l === 'wp') {
        res = K.nearest(waypoints.map(function (p) { return [p.lat, p.lon, 'wp', p.name || '']; }), ref.lat, ref.lon, 5).map(function (r) { return { lat: r.item[0], lon: r.item[1], title: r.item[3], sub: '', d: r.dist, b: r.bearing, wp: true }; });
      }
      if (!res.length) return;
      any = true;
      html += '<div class="near-group"><h3>' + OA.esc(OA.t(LAYER_NAMES[l])) + '</h3>' + res.map(function (r, i) {
        var nameTxt = r.title || r.sub;
        return '<button type="button" class="near-item" data-l="' + l + '" data-i="' + i + '"><span class="nm"><span data-notranslate>' + OA.esc(nameTxt) + '</span>' +
          (r.title && r.sub ? '<small>' + OA.esc(r.sub) + '</small>' : '') + '</span><span class="ds ltr" data-notranslate>' + OA.esc(dirLine(r.d, r.b)) + '</span></button>';
      }).join('') + '</div>';
      nearCache[l] = res;
    });
    $('#nearList').innerHTML = any ? html : '<p class="small muted" style="margin:0">' + OA.esc(OA.t('Schalte oben eine Ebene ein, dann erscheinen hier die nächsten Punkte.')) + '</p>';
  }
  var nearCache = {};
  $('#nearList').addEventListener('click', function (e) {
    var b = e.target.closest('.near-item'); if (!b) return;
    var r = (nearCache[b.getAttribute('data-l')] || [])[Number(b.getAttribute('data-i'))];
    if (!r) return;
    setView(r.lat, r.lon, Math.max(view.z, 15));
    if (r.own) select({ lat: r.lat, lon: r.lon, kind: 'own', own: r.own });
    else if (r.wp) select({ lat: r.lat, lon: r.lon, kind: 'wp', name: r.title });
    else select({ lat: r.lat, lon: r.lon, kind: 'poi', type: r.type, name: r.name });
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ---------- Eigene Punkte ---------- */
  function persistOwn() { OA.store.set('karte_punkte', ownPoints); dirty = true; renderOwn(); updateNearby(); }
  function renderOwn() {
    var el = $('#ownList');
    if (!ownPoints.length) { el.innerHTML = '<p class="muted small" style="margin:0">' + OA.esc(OA.t('Noch keine eigenen Punkte. Tippe auf „Punkt hinzufügen“ oder halte den Finger auf der Karte.')) + '</p>'; $('#pExport').disabled = true; return; }
    $('#pExport').disabled = false;
    el.innerHTML = ownPoints.map(function (p, i) {
      var t = OWN_TYPES[p.type] || OWN_TYPES.x;
      return '<div class="pt"><div class="info"><div class="name" data-notranslate>' + OA.esc(p.name) + '</div><div class="sub">' + OA.esc(OA.t(t.name)) + '</div><div class="sub ltr" data-notranslate>' + OA.esc(hemi(p.lat, p.lon)) + '</div>' +
        (p.note ? '<div class="note" data-notranslate>' + OA.esc(p.note) + '</div>' : '') + '</div>' +
        '<button type="button" class="btn sm" data-act="show" data-i="' + i + '">' + OA.esc(OA.t('Zeigen')) + '</button>' +
        '<button type="button" class="btn sm" data-act="edit" data-i="' + i + '">' + OA.esc(OA.t('Bearbeiten')) + '</button>' +
        '<button type="button" class="btn sm danger" data-act="del" data-i="' + i + '" aria-label="' + OA.esc(OA.t('{0} löschen', [p.name])) + '">' + OA.esc(OA.t('Löschen')) + '</button></div>';
    }).join('');
  }
  $('#ownList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var p = ownPoints[Number(b.getAttribute('data-i'))]; if (!p) return;
    var act = b.getAttribute('data-act');
    if (act === 'show') { layersOn.own = true; syncChips(); setView(p.lat, p.lon, Math.max(view.z, 15)); select({ lat: p.lat, lon: p.lon, kind: 'own', own: p }); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else if (act === 'edit') openForm(p, null);
    else deleteOwn(p.id);
  });
  function deleteOwn(id) {
    var p = ownPoints.filter(function (x) { return x.id === id; })[0];
    if (!p || !confirm(OA.t('Punkt „{0}“ löschen?', [p.name]))) return;
    ownPoints = ownPoints.filter(function (x) { return x.id !== id; });
    if (sel && sel.own && sel.own.id === id) { sel = null; $('#sel').hidden = true; }
    persistOwn();
  }
  var pLoc = 'center';
  function locCoords() {
    if (pLoc === 'gps') return pos ? { lat: pos.lat, lon: pos.lon } : null;
    if (pLoc === 'tap') return tapPoint;
    if (pLoc === 'keep') return editing ? { lat: editing.lat, lon: editing.lon } : null;
    return { lat: view.lat, lon: view.lon };
  }
  function updatePformCoord() {
    if ($('#pform').hidden) return;
    var c = locCoords();
    $('#pCoord').textContent = c ? hemi(c.lat, c.lon) : '–';
  }
  function openForm(existing, loc) {
    editing = existing;
    $('#pformTitle').textContent = existing ? OA.t('Punkt bearbeiten') : OA.t('Punkt hinzufügen');
    $('#pName').value = existing ? existing.name : '';
    $('#pType').value = existing ? existing.type : 'x';
    $('#pNote').value = existing ? existing.note || '' : '';
    $('#pErr').textContent = '';
    pLoc = existing ? 'keep' : (loc === 'tap' && tapPoint ? 'tap' : (pos && loc === 'gps' ? 'gps' : 'center'));
    OA.segSet($('#pLoc'), existing ? null : pLoc);
    $('#pform').hidden = false;
    $('#locate').classList.remove('primary'); $('#pSave').classList.add('primary');
    updatePformCoord();
    $('#pform').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { $('#pName').focus({ preventScroll: true }); }, 350);
  }
  function closeForm() {
    $('#pform').hidden = true; editing = null;
    $('#locate').classList.add('primary');
  }
  $('#add').addEventListener('click', function () { openForm(null, pos ? 'gps' : 'center'); });
  $('#pLoc').addEventListener('input', function () { pLoc = OA.segVal($('#pLoc')) || 'center'; updatePformCoord(); });
  $('#pCancel').addEventListener('click', closeForm);
  $('#pSave').addEventListener('click', function () {
    var name = $('#pName').value.trim(), c = locCoords();
    if (!name) { $('#pErr').textContent = OA.t('Bitte einen Namen eingeben.'); return; }
    if (!c) { $('#pErr').textContent = pLoc === 'gps' ? OA.t('Deine Position ist noch nicht bekannt. Tippe zuerst auf „Meine Position“.') : OA.t('Tippe zuerst auf die Karte, um eine Stelle zu wählen.'); return; }
    var obj = { id: editing ? editing.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name.slice(0, 60), type: $('#pType').value,
      note: $('#pNote').value.trim().slice(0, 400), lat: +c.lat.toFixed(6), lon: +c.lon.toFixed(6), t: editing ? editing.t : new Date().toISOString() };
    if (editing) ownPoints = ownPoints.map(function (p) { return p.id === editing.id ? obj : p; }); else ownPoints.push(obj);
    layersOn.own = true; syncChips(); saveState();
    closeForm(); persistOwn();
    select({ lat: obj.lat, lon: obj.lon, kind: 'own', own: obj });
  });
  $('#pExport').addEventListener('click', function () {
    OA.download('karte-punkte-' + OA.today() + '.json', JSON.stringify({ app: 'offline-ark', typ: 'karte-punkte', version: 1, punkte: ownPoints }, null, 2));
  });
  $('#pImport').addEventListener('click', function () {
    OA.pickFile('.json,application/json', function (text) {
      try {
        var obj = JSON.parse(text), list = Array.isArray(obj) ? obj : obj && obj.punkte;
        if (!Array.isArray(list)) throw new Error('Format');
        var n = 0;
        list.forEach(function (p) {
          if (!p || !isFinite(p.lat) || !isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return;
          var id = typeof p.id === 'string' && p.id ? p.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          if (ownPoints.some(function (x) { return x.id === id; })) id += Math.random().toString(36).slice(2, 5);
          ownPoints.push({ id: id, name: String(p.name || OA.t('Punkt')).slice(0, 60), type: OWN_TYPES[p.type] ? p.type : 'x', note: String(p.note || '').slice(0, 400), lat: +p.lat, lon: +p.lon, t: p.t || new Date().toISOString() });
          n++;
        });
        $('#pMsg').textContent = OA.t('{0} Punkte geladen.', [n]);
        layersOn.own = true; syncChips(); persistOwn();
      } catch (e) { $('#pMsg').textContent = OA.t('Diese Datei ist keine gültige Punkte-Sicherung.'); }
    });
  });

  /* ---------- Vollbild, Bild, Druck ---------- */
  function setFs(on) {
    box.classList.toggle('fs', on);
    document.documentElement.style.overflow = on ? 'hidden' : '';
    $('#fs').setAttribute('aria-label', OA.t(on ? 'Vollbild beenden' : 'Vollbild'));
    resize();
  }
  $('#fs').addEventListener('click', function () { setFs(!box.classList.contains('fs')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('fs')) setFs(false); });

  function legendLine() {
    var used = {};
    Object.keys(TYPES).forEach(function (t) { if (layersOn[TYPES[t].layer]) used[TYPES[t].name] = 1; });
    return Object.keys(used).map(function (n) { return OA.t(n); }).join(' · ');
  }
  $('#save').addEventListener('click', function () {
    var scale = Math.min(2, Math.max(1, DPR)), barH = 30;
    var out = document.createElement('canvas'); out.width = Math.round(W * scale); out.height = Math.round((H + barH) * scale);
    var g = out.getContext('2d');
    function paint(noTiles) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, out.width, out.height);
      render(g, { scale: scale, noTiles: noTiles });
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.fillStyle = C.surface; g.fillRect(0, H, W, barH);
      g.fillStyle = C.text; g.font = '600 11px ' + C.font; g.textAlign = 'left'; g.textBaseline = 'middle';
      var mpp = K.metersPerPixel(view.lat, view.z), ns = K.niceScale(mpp, 90);
      g.fillText(K.coordText(view.lat, view.lon) + ' · ' + (ns.meters >= 1000 ? ns.meters / 1000 + ' km' : ns.meters + ' m') + ' · ' + OA.t(CFG.attribution), 8, H + barH / 2);
    }
    function finish(noTiles) {
      paint(noTiles);
      out.toBlob(function (blob) {
        if (blob) OA.download('karte-' + OA.today() + '.png', blob, 'image/png');
        else setStatus(OA.t('Das Bild konnte nicht gespeichert werden.'));
      }, 'image/png');
    }
    try { finish(false); } catch (e) { try { finish(true); } catch (e2) { setStatus(OA.t('Das Bild konnte nicht gespeichert werden.')); } }   // Kacheln unter file:// machen das Bild "unsicher"
  });
  function preparePrint() {
    $('#printCenter').textContent = OA.t('Kartenmitte: {0}', [hemi(view.lat, view.lon)]);
    var l = legendLine();
    $('#printLegend').textContent = l ? OA.t('Legende: {0}', [l]) : '';
    $('#printSrc').textContent = OA.t(CFG.attribution);
    render(ctx);
  }
  window.addEventListener('beforeprint', preparePrint);

  /* ---------- Legende ---------- */
  function buildLegend() {
    var el = $('#legend'), html = '';
    var rows = Object.keys(TYPES).map(function (t) { return { id: t, name: TYPES[t].name, spec: TYPES[t] }; })
      .concat(Object.keys(OWN_TYPES).map(function (t) { return { id: 'o' + t, name: OWN_TYPES[t].name, spec: OWN_TYPES[t] }; }));
    rows.push({ id: 'wp', name: 'Wegpunkt', spec: { shape: 'diamond' } }, { id: 'pos', name: 'Meine Position', spec: { shape: 'pos' } });
    rows = rows.filter(function (r, i, a) { return a.findIndex(function (x) { return x.name === r.name; }) === i; });
    el.innerHTML = rows.map(function (r, i) { return '<div><canvas width="48" height="48" data-i="' + i + '"></canvas><span>' + OA.esc(OA.t(r.name)) + '</span></div>'; }).join('');
    OA.$$('canvas', el).forEach(function (cv) {
      var r = rows[Number(cv.getAttribute('data-i'))], g = cv.getContext('2d');
      g.scale(2, 2);
      if (r.spec.shape === 'diamond') drawWaypoint(g, 12, 12);
      else if (r.spec.shape === 'pos') { g.fillStyle = C.accent; g.beginPath(); g.arc(12, 12, 6.5, 0, 7); g.fill(); g.strokeStyle = C.surface; g.lineWidth = 2; g.stroke(); }
      else drawMarker(g, 12, 12, Object.assign({ shape: 'circle' }, r.spec), .95);
    });
  }

  /* ---------- Kacheln: Schalter und Test ---------- */
  var tilesOn = $('#tilesOn'); tilesOn.checked = T.on;
  tilesOn.addEventListener('change', function () {
    T.on = tilesOn.checked; OA.store.set('karte_tiles', T.on); T.cache = {}; T.found = 0; T.failed = 0; T.pending = 0; dirty = true;
    $('#tilesMsg').textContent = T.on ? OA.t('Eigene Kacheln sind eingeschaltet. Fehlende Kacheln werden übersprungen.') : '';
  });
  $('#tilesTest').addEventListener('click', function () {
    var z = Math.max(CFG.tiles.minZoom, Math.min(CFG.tiles.maxZoom, Math.round(view.z))), n = Math.pow(2, z), c = K.norm(view.lat, view.lon);
    var x = Math.floor(c.x * n), y = Math.floor(c.y * n), exts = CFG.tiles.exts.slice(), msg = $('#tilesMsg');
    msg.textContent = OA.t('Prüfe …');
    (function next() {
      if (!exts.length) { msg.textContent = OA.t('Keine Kachel gefunden für Zoom {0}, Ausschnitt in der Kartenmitte. Pfad: {1}', [z, K.tilePath(CFG.tiles.path, z, x, y) + '.*']); return; }
      var ext = exts.shift(), img = new Image();
      img.onload = function () { msg.textContent = OA.t('Kachel gefunden: {0}', [K.tilePath(CFG.tiles.path, z, x, y) + '.' + ext]); };
      img.onerror = next;
      img.src = K.tilePath(CFG.tiles.path, z, x, y) + '.' + ext;
    })();
  });

  /* ---------- Stand der Daten ---------- */
  function renderStand() {
    var el = $('#dataStand');
    if (!REGIONS.length) { el.textContent = OA.t('Keine Punkte-Daten vorhanden.'); return; }
    el.innerHTML = REGIONS.map(function (r) {
      var d = new Date(r.stand + 'T12:00:00'), ds = isNaN(d) ? r.stand : d.toLocaleDateString(OA.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
      var n = 0; Object.keys(r.counts || {}).forEach(function (k) { n += r.counts[k]; });
      return '<div>' + OA.esc(OA.t('Stand der Daten: {0} (abgerufen am {1}), {2} Punkte', [r.name, ds, OA.fmt(n, 0)])) + '</div>';
    }).join('');
  }

  /* ---------- Größe, Schleife, Start ---------- */
  function resize() {
    var r = box.getBoundingClientRect();
    W = Math.max(100, Math.round(r.width)); H = Math.max(100, Math.round(r.height));
    DPR = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    dirty = true;
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(box); else window.addEventListener('resize', resize);
  new MutationObserver(function () { refreshColors(); buildLegend(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('storage', function () { readWaypoints(); dirty = true; updateNearby(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { readWaypoints(); dirty = true; } });

  function frame() {
    if (dirty) { dirty = false; render(ctx); updateOverlay(); }
    requestAnimationFrame(frame);
  }

  // Beschriftungen, die von der Sprache abhängen
  if (OA.lang === 'ar') $('#northLetter').textContent = 'ش';
  $('#maphint').hidden = true;
  readWaypoints(); refreshColors(); resize(); syncChips(); renderOwn(); renderStand(); buildLegend();
  POI_LAYERS.forEach(function (l) { if (layersOn[l]) ensureLayer(l); });
  loadGeo().then(function () { if (view.z >= 10.3) loadGemeinden(); });
  updateNearby();
  requestAnimationFrame(frame);

  // Für Tests im Browser
  window.OA_KARTE_DEBUG = { renderTime: function () { var t = performance.now(); render(ctx); return performance.now() - t; }, view: function () { return view; }, setView: setView, data: data, geo: geo, state: function () { return { pos: pos, sel: sel, layersOn: layersOn, tiles: T }; }, setPos: function (p) { pos = p; dirty = true; updateNearby(); updateSelDist(); } };
})();
