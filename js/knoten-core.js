/* Offline-Ark – Knoten-Zeichnungen: Geometrie und SVG-Ausgabe (ohne DOM, auch in Node nutzbar).
 *
 * Ein Seil ist eine Liste von Stützpunkten [x, y, z]; z > 0 liegt oben (näher am Betrachter).
 * Aus den Punkten entsteht eine glatte Kurve (Catmull-Rom). Über-/Unterkreuzungen ergeben sich aus z –
 * dieselbe Kurve wird zum Zeichnen UND zum Prüfen (scripts/test-knoten.js: Kreuzungen, Gauß-Code, Jones-Polynom) benutzt.
 * Gezeichnet wird das ganze Seil und dann jede Überkreuzung noch einmal oben auf einer kleinen Lücke ("Flicken"). */
(function () {
  'use strict';

  var S = 12;   // Stützstellen je Kurvenstück

  /* ---------- Kurve ---------- */
  function cr(p0, p1, p2, p3, t) {
    // zentripetaler Catmull-Rom (alpha 0.5) in Barry-Goldman-Form
    function tj(ti, a, b) { return ti + Math.pow(Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1e-6), 0.5); }
    var t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3), tt = t1 + (t2 - t1) * t, out = [0, 0, 0];
    for (var k = 0; k < 3; k++) {
      var a1 = (t1 - tt) / (t1 - t0) * p0[k] + (tt - t0) / (t1 - t0) * p1[k];
      var a2 = (t2 - tt) / (t2 - t1) * p1[k] + (tt - t1) / (t2 - t1) * p2[k];
      var a3 = (t3 - tt) / (t3 - t2) * p2[k] + (tt - t2) / (t3 - t2) * p3[k];
      var b1 = (t2 - tt) / (t2 - t0) * a1 + (tt - t0) / (t2 - t0) * a2;
      var b2 = (t3 - tt) / (t3 - t1) * a2 + (tt - t1) / (t3 - t1) * a3;
      out[k] = (t2 - tt) / (t2 - t1) * b1 + (tt - t1) / (t2 - t1) * b2;
    }
    return out;
  }
  /** Stützpunkte -> Polylinie mit Tiefe: [{x,y,z}] */
  function sample(pts) {
    var out = [], n = pts.length, i, j;
    if (n < 2) return pts.map(function (p) { return { x: p[0], y: p[1], z: p[2] || 0 }; });
    var P = pts.map(function (p) { return [p[0], p[1], p[2] || 0]; });
    var first = [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1], P[0][2]], last = [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1], P[n - 1][2]];
    var Q = [first].concat(P, [last]);
    for (i = 1; i < n; i++) {
      for (j = 0; j < S; j++) { var c = cr(Q[i - 1], Q[i], Q[i + 1], Q[i + 2], j / S); out.push({ x: c[0], y: c[1], z: c[2] }); }
    }
    out.push({ x: P[n - 1][0], y: P[n - 1][1], z: P[n - 1][2] });
    return out;
  }

  /* ---------- Kreuzungen ---------- */
  function segInter(a, b, c, d) {
    var rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    var t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den, u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
    if (t < 0 || t >= 1 || u < 0 || u >= 1) return null;
    return { t: t, u: u, x: a.x + t * rx, y: a.y + t * ry, sin: Math.abs(den) / (Math.hypot(rx, ry) * Math.hypot(sx, sy)) };
  }
  /** Alle Kreuzungen zwischen (und innerhalb) der Seile. ropes: [{id, s: Polylinie}] */
  function findCrossings(ropes) {
    var out = [], a, b, i, j, r;
    for (a = 0; a < ropes.length; a++) for (b = a; b < ropes.length; b++) {
      var A = ropes[a].s, B = ropes[b].s;
      for (i = 0; i < A.length - 1; i++) for (j = (a === b ? i + 2 : 0); j < B.length - 1; j++) {
        r = segInter(A[i], A[i + 1], B[j], B[j + 1]);
        if (!r) continue;
        var za = A[i].z + (A[i + 1].z - A[i].z) * r.t, zb = B[j].z + (B[j + 1].z - B[j].z) * r.u;
        out.push({ ra: a, ia: i, ta: r.t, rb: b, ib: j, tb: r.u, x: r.x, y: r.y, sin: r.sin, za: za, zb: zb, aOver: za > zb });
      }
    }
    return out;
  }

  /* ---------- Szene ---------- */
  function build(def) {
    var ropes = def.ropes.map(function (r) { return { id: r.id, cls: r.cls || r.id, aux: !!r.aux, pts: r.pts, s: sample(r.pts) }; });
    return { def: def, w: def.w || 9, gap: def.gap == null ? 3.2 : def.gap, ropes: ropes, crossings: findCrossings(ropes) };
  }

  function f(n) { return Math.round(n * 10) / 10; }
  function pathOf(s, i0, i1, frac) {
    if (i1 <= i0) return '';
    var d = 'M' + f(s[i0].x) + ' ' + f(s[i0].y), i;
    for (i = i0 + 1; i <= Math.min(i1, s.length - 1); i++) d += 'L' + f(s[i].x) + ' ' + f(s[i].y);
    if (frac && i1 + 1 < s.length) {
      var a = s[i1], b = s[i1 + 1];
      d += 'L' + f(a.x + (b.x - a.x) * frac) + ' ' + f(a.y + (b.y - a.y) * frac);
    }
    return d;
  }

  /** SVG-Inhalt (ohne <svg>-Hülle). reveal: { ropeId: Anzahl sichtbarer Stützpunkte (auch Bruchteile) } */
  function render(scene, reveal) {
    var out = '', visible = {}, i;
    scene.ropes.forEach(function (r, ri) {
      if (r.aux) return;
      var n = reveal && reveal[r.id] != null ? reveal[r.id] : r.pts.length;
      var idx = Math.max(0, Math.min(r.pts.length - 1, n - 1)) * S, i1 = Math.floor(idx), frac = idx - i1;
      visible[ri] = { i1: i1, frac: frac, pos: idx };
      if (n <= 0.001) return;
      out += stroke(pathOf(r.s, 0, i1, frac), r);
    });
    scene.crossings.forEach(function (c) {
      var ra = scene.ropes[c.ra], rb = scene.ropes[c.rb];
      if (ra.aux || rb.aux) return;
      var va = visible[c.ra], vb = visible[c.rb];
      if (!va || !vb || c.ia + c.ta > va.pos || c.ib + c.tb > vb.pos) return;
      var over = c.aOver ? { r: ra, i: c.ia, t: c.ta } : { r: rb, i: c.ib, t: c.tb };
      var vis = c.aOver ? va : vb;
      var half = Math.min(scene.w * 1.6, (scene.w / 2 + scene.gap + 1) / Math.max(c.sin, 0.5));   // halbe Länge des Flickens entlang des oberen Seils
      var s = over.r.s, lo = over.i + over.t, hi = over.i + over.t, len = 0;
      // Flicken: vom Kreuzungspunkt je 'half' Längeneinheiten rückwärts und vorwärts
      var a = Math.floor(lo), b = a + 1;
      while (a > 0 && len < half) { len += Math.hypot(s[a].x - s[a - 1].x, s[a].y - s[a - 1].y); a--; }
      len = 0;
      while (b < Math.min(s.length - 1, vis.i1) && len < half) { len += Math.hypot(s[b + 1].x - s[b].x, s[b + 1].y - s[b].y); b++; }
      var d = pathOf(s, a, Math.min(b, Math.floor(vis.pos)), 0);
      if (!d) return;
      out += '<path d="' + d + '" class="halo" stroke-width="' + (scene.w + 2 * scene.gap) + '"/>' + stroke(d, over.r);
    });
    return out;
  }
  function stroke(d, r) {
    if (!d) return '';
    return '<path d="' + d + '" class="rope rope-' + r.cls + '"/>' + (r.cls === 'b' ? '<path d="' + d + '" class="stripe"/>' : '');
  }

  /* ---------- Prüfung: Gauß-Code, Schreibweise, Jones-Polynom (für Node-Tests) ---------- */
  /** Kreuzungen in Reihenfolge entlang der Seile; liefert für jedes Seil eine Zeichenkette aus O (oben) / U (unten). */
  function overUnder(scene) {
    var seq = scene.ropes.map(function () { return []; });
    scene.crossings.forEach(function (c, k) {
      seq[c.ra].push({ pos: c.ia + c.ta, c: k, over: c.aOver });
      seq[c.rb].push({ pos: c.ib + c.tb, c: k, over: !c.aOver });
    });
    return seq.map(function (l) {
      l.sort(function (p, q) { return p.pos - q.pos; });
      return { code: l.map(function (e) { return e.over ? 'O' : 'U'; }).join(''), ids: l.map(function (e) { return e.c; }) };
    });
  }

  /** Jones-Polynom über die Kauffman-Klammer. Alle Seile (auch aux) zusammen müssen ein geschlossenes Diagramm bilden:
   *  die Enden werden in Reihenfolge der Seile verbunden (Ende des Seils i -> Anfang des Seils i+1), mit Option "ends"
   *  als Liste von [seilA, 'start'|'end', seilB, 'start'|'end']. Rückgabe: { poly: {exponent: Koeffizient}, writhe, crossings }. */
  function jones(scene, joins) {
    var ropes = scene.ropes, nodes = [], i;
    // Seile zu einer Kurve verketten: jedes Seil wird in Laufrichtung oder rückwärts durchlaufen
    var order = [], used = {};
    var cur = joins[0];            // [id, dir] Startseil
    var seqList = joins;           // [[id, 'f'|'b'], ...] in Reihenfolge
    seqList.forEach(function (e) { order.push({ r: ropes.map(function (r) { return r.id; }).indexOf(e[0]), back: e[1] === 'b' }); });
    // Besuche: pro Kreuzung zwei Besuche in Reihenfolge der Kurve
    var visits = [], vid = 0;
    var cross = scene.crossings;
    var visitsOf = cross.map(function () { return []; });
    order.forEach(function (o) {
      var list = [];
      cross.forEach(function (c, k) {
        if (c.ra === o.r) list.push({ pos: c.ia + c.ta, c: k, side: 'a' });
        if (c.rb === o.r) list.push({ pos: c.ib + c.tb, c: k, side: 'b' });
      });
      list.sort(function (p, q) { return o.back ? q.pos - p.pos : p.pos - q.pos; });
      list.forEach(function (e) { e.rope = o.r; e.back = o.back; visits.push(e); });
    });
    visits.forEach(function (v, k) { v.k = k; visitsOf[v.c].push(v); });
    var n = visits.length;
    // Kante k läuft von Besuch k zu Besuch k+1 (zyklisch)
    function dirAt(v) {
      var c = cross[v.c], r = ropes[v.rope].s, i = v.side === 'a' ? c.ia : c.ib;
      var dx = r[i + 1].x - r[i].x, dy = -(r[i + 1].y - r[i].y);   // y nach oben
      return v.back ? [-dx, -dy] : [dx, dy];
    }
    var X = [], writhe = 0;
    cross.forEach(function (c, k) {
      var vs = visitsOf[k];
      var vo = vs.filter(function (v) { return (v.side === 'a') === c.aOver; })[0], vu = vs.filter(function (v) { return v !== vo; })[0];
      var dO = dirAt(vo), dU = dirAt(vu);
      var sign = Math.sign(dO[0] * dU[1] - dO[1] * dU[0]);
      writhe += sign;
      // Enden: Kantenindex vor/nach dem Besuch
      var inE = function (v) { return (v.k - 1 + n) % n; }, outE = function (v) { return v.k; };
      var ends = [
        { e: inE(vu), ang: Math.atan2(-dU[1], -dU[0]) },   // unten, ankommend
        { e: outE(vu), ang: Math.atan2(dU[1], dU[0]) },
        { e: inE(vo), ang: Math.atan2(-dO[1], -dO[0]) },
        { e: outE(vo), ang: Math.atan2(dO[1], dO[0]) }
      ];
      var start = ends[0].ang;
      ends.forEach(function (x) { x.rel = ((x.ang - start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); });
      ends.sort(function (p, q) { return p.rel - q.rel; });   // gegen den Uhrzeigersinn, beginnend bei "unten ankommend"
      X.push(ends.map(function (x) { return x.e; }));
    });
    // Zustandssumme
    var terms = {};   // Exponent von A -> Koeffizient
    function add(exp, co) { terms[exp] = (terms[exp] || 0) + co; if (!terms[exp]) delete terms[exp]; }
    function polyMul(p, q) { var r = {}; Object.keys(p).forEach(function (a) { Object.keys(q).forEach(function (b) { var e = Number(a) + Number(b); r[e] = (r[e] || 0) + p[a] * q[b]; }); }); return r; }
    var delta = { 2: -1, '-2': -1 }, total = {};
    var m = X.length;
    for (var s = 0; s < (1 << m); s++) {
      var par = []; for (i = 0; i < n; i++) par.push(i);
      var find = function (x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      var na = 0, nb = 0;
      for (var c = 0; c < m; c++) {
        var q = X[c], A = !((s >> c) & 1);
        if (A) { na++; par[find(q[0])] = find(q[1]); par[find(q[2])] = find(q[3]); }
        else { nb++; par[find(q[0])] = find(q[3]); par[find(q[1])] = find(q[2]); }
      }
      var comps = {}; for (i = 0; i < n; i++) comps[find(i)] = 1;
      var loops = Object.keys(comps).length, term = {}; term[na - nb] = 1;
      for (i = 0; i < loops - 1; i++) term = polyMul(term, delta);
      Object.keys(term).forEach(function (e) { total[e] = (total[e] || 0) + term[e]; });
    }
    // Jones: (-A^3)^(-w) * <K>; t = A^-4
    var fac = {}; fac[-3 * writhe] = (writhe % 2 ? -1 : 1);
    var v = polyMul(total, fac), poly = {};
    Object.keys(v).forEach(function (e) {
      if (!v[e]) return;
      var tExp = -Number(e) / 4;
      poly[tExp] = (poly[tExp] || 0) + v[e];
    });
    return { poly: poly, writhe: writhe, crossings: m };
  }

  var api = { S: S, sample: sample, build: build, render: render, findCrossings: findCrossings, overUnder: overUnder, jones: jones, pathOf: pathOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_KNOTEN = api;
})();
