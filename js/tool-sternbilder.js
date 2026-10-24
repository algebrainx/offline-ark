/* Offline-Ark – Sternbilder (Oberfläche): Sternkarte für Waiblingen (oder eigene Koordinaten), selbst gezeichnet.
 * Rechnung und Daten: data/sternbilder.js. Projektion: stereografisch, Blick nach Norden oder Süden, Blickhöhe 40°.
 * Alle Texte laufen über OA.t. */
(function () {
  'use strict';
  var OA = window.OA, t = OA.t, esc = OA.esc, $ = OA.$;
  var S = window.OA_STERNE;
  var HOME = { lat: 48.8310, lon: 9.3160 };            // Waiblingen (wie im Werkzeug "Sonne")
  var W = 640, H = 470, CX = 320, CY = 256, SC = 260;   // Zeichenfläche und Maßstab (1 Einheit der Projektion = SC Punkte)
  var VIEW_ALT = 40;
  var LABELED = ['polaris', 'dubhe', 'merak', 'vega', 'deneb', 'altair', 'betelgeuse', 'rigel', 'sirius', 'aldebaran'];
  var BRIGHT = ['polaris', 'vega', 'deneb', 'altair', 'betelgeuse', 'rigel', 'sirius', 'aldebaran'];
  var DIRS = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];

  var el = { view: $('#view'), date: $('#date'), time: $('#time'), timeOut: $('#timeOut'), now: $('#now'), lat: $('#lat'), lon: $('#lon'), home: $('#home'),
    status: $('#status'), sky: $('#sky'), visible: $('#visible'), sources: $('#sources') };

  var saved = OA.store.get('sternbilder', null) || {};
  var st = { lat: HOME.lat, lon: HOME.lon, hi: null };
  if (isFinite(saved.lat) && isFinite(saved.lon) && Math.abs(saved.lat) <= 90 && Math.abs(saved.lon) <= 180) { st.lat = saved.lat; st.lon = saved.lon; }
  if (saved.view === 'N' || saved.view === 'S') OA.segSet(el.view, saved.view);

  function dirName(az) { return t(DIRS[Math.round(((az % 360) + 360) % 360 / 45) % 8]); }
  function fmtCoord(v) { return (Math.round(v * 10000) / 10000).toString().replace('.', OA.lang === 'de' || OA.lang === 'es' ? ',' : '.'); }
  function isHome() { return Math.abs(st.lat - HOME.lat) < 1e-6 && Math.abs(st.lon - HOME.lon) < 1e-6; }
  function todayStr() { return OA.today(); }
  function setNow() {
    var d = new Date();
    el.date.value = todayStr();
    el.time.value = String(Math.min(1435, Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5));
  }
  function when() {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(el.date.value || todayStr()), min = Number(el.time.value) || 0;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Math.floor(min / 60), min % 60, 0);
  }
  function hhmm(min) { return OA.pad(Math.floor(min / 60)) + ':' + OA.pad(min % 60); }

  function starName(id) { return t(S.stars[id].name); }
  function pt(p, view) { return p ? { x: CX + SC * p.x, y: CY - SC * p.y } : null; }
  function f1(n) { return n.toFixed(1); }

  /* ---------- Karte ---------- */
  function drawSky(sky, sunAlt, view) {
    var A0 = view === 'S' ? 180 : 0;
    function P(az, alt) { return pt(S.project(az, alt, A0, VIEW_ALT)); }
    var out = [];
    out.push('<defs><clipPath id="skyclip"><rect x="0" y="0" width="' + W + '" height="' + H + '" rx="10"/></clipPath></defs>');
    out.push('<g clip-path="url(#skyclip)"><rect class="bg" x="0" y="0" width="' + W + '" height="' + H + '"/>');

    // Höhenkreise (30°, 60°)
    [30, 60].forEach(function (alt) {
      var pts = [];
      for (var d = -100; d <= 100; d += 4) { var p = P(A0 + d, alt); if (p) pts.push(f1(p.x) + ',' + f1(p.y)); }
      out.push('<polyline class="grid" points="' + pts.join(' ') + '"/>');
      var l = P(A0, alt);
      if (l) out.push('<text class="glabel ltr" x="' + f1(l.x + 6) + '" y="' + f1(l.y - 4) + '">' + alt + '°</text>');
    });

    // Himmelspol (Polarstern liegt in seiner Nähe)
    var pole = st.lat > 0 ? P(0, st.lat) : null;
    var hl = st.hi, cls = {};
    S.constellations.forEach(function (c) { cls[c.id] = c.id === hl; });

    var showPtr = false;
    S.constellations.forEach(function (c) {
      c.lines.forEach(function (l) {
        var a = sky[l[0]], b = sky[l[1]];
        if (a.alt < -6 || b.alt < -6) return;
        var pa = P(a.az, a.alt), pb = P(b.az, b.alt);
        if (pa && pb) out.push('<line class="cline' + (cls[c.id] ? ' on' : '') + '" x1="' + f1(pa.x) + '" y1="' + f1(pa.y) + '" x2="' + f1(pb.x) + '" y2="' + f1(pb.y) + '"/>');
      });
    });

    // Verlängerung Merak -> Dubhe -> Polarstern (gestrichelt)
    (function () {
      var m = sky.merak, d = sky.dubhe, p = sky.polaris;
      if (m.alt < -3 && d.alt < -3) return;
      var pd = P(d.az, d.alt), pp = P(p.az, p.alt);
      if (!pd || !pp) return;
      showPtr = true;
      out.push('<line class="pointer" x1="' + f1(pd.x) + '" y1="' + f1(pd.y) + '" x2="' + f1(pp.x) + '" y2="' + f1(pp.y) + '"/>');
      out.push('<text class="poletxt ltr" text-anchor="middle" x="' + f1((pd.x + pp.x) / 2 + 12) + '" y="' + f1((pd.y + pp.y) / 2 - 6) + '">5×</text>');
    })();

    // Sterne
    out.push('<g class="stars">');
    var inHi = {};
    S.constellations.forEach(function (c) { if (cls[c.id]) c.stars.forEach(function (id) { inHi[id] = true; }); });
    if (S.stars[hl]) inHi[hl] = true;
    Object.keys(S.stars).forEach(function (id) {
      var s = S.stars[id], a = sky[id];
      if (a.alt < -2) return;
      var p = P(a.az, a.alt); if (!p) return;
      var r = Math.max(2.2, Math.min(7, 2.6 + (2.6 - s.mag) * 1.3));
      out.push('<circle class="star' + (inHi[id] ? ' on' : '') + '" cx="' + f1(p.x) + '" cy="' + f1(p.y) + '" r="' + f1(r) + '"/>');
    });
    out.push('</g>');

    // Himmelspol-Marke
    if (pole && pole.x > -20 && pole.x < W + 20 && pole.y > -20 && pole.y < H + 20) {
      out.push('<circle class="pole" cx="' + f1(pole.x) + '" cy="' + f1(pole.y) + '" r="9"/>');
    }

    // Boden und Horizont
    var hp = [], first = null, last = null;
    for (var d = -100; d <= 100; d += 2) { var p = P(A0 + d, 0); if (p) { hp.push(f1(p.x) + ',' + f1(p.y)); if (!first) first = p; last = p; } }
    out.push('<path class="ground" d="M' + hp.join(' L') + ' L' + f1(last.x) + ',900 L' + f1(first.x) + ',900 Z"/>');
    out.push('<polyline class="horizon" points="' + hp.join(' ') + '"/>');

    // Himmelsrichtungen am Horizont
    DIRS.forEach(function (name, i) {
      var p = P(i * 45, 0);
      if (!p || p.x < 40 || p.x > W - 40 || p.y > H - 8 || p.y < 20) return;
      out.push('<text class="compass" text-anchor="middle" x="' + f1(p.x) + '" y="' + f1(Math.min(H - 10, p.y + 22)) + '">' + esc(t(name)) + '</text>');
    });

    // Beschriftungen: Name der Figur unter ihren sichtbaren Sternen (oder darüber, wenn dort kein Platz ist)
    S.constellations.forEach(function (c) {
      var xs = [], ys = [];
      c.stars.forEach(function (id) { var a = sky[id]; if (a.alt < 0) return; var p = P(a.az, a.alt); if (p) { xs.push(p.x); ys.push(p.y); } });
      if (!xs.length) return;
      var cx = xs.reduce(function (s, v) { return s + v; }, 0) / xs.length, low = Math.max.apply(null, ys), high = Math.min.apply(null, ys);
      var y = low + 26 < H - 40 ? low + 26 : high - 16;
      var nm = t(c.name), wd = nm.length * 9.6;
      if (cx < -10 || cx > W + 10 || y < 16 || y > H - 40) return;
      cx = Math.max(wd / 2 + 8, Math.min(W - wd / 2 - 8, cx));
      out.push('<text class="clabel' + (cls[c.id] ? ' on' : '') + '" text-anchor="middle" x="' + f1(cx) + '" y="' + f1(y) + '">' + esc(nm) + '</text>');
    });
    LABELED.forEach(function (id) {
      var a = sky[id]; if (a.alt < 2) return;
      if ((id === 'dubhe' || id === 'merak') && !showPtr) return;
      var p = P(a.az, a.alt); if (!p || p.x < 20 || p.x > W - 20 || p.y < 14 || p.y > H - 8) return;
      var nm = starName(id), flip = p.x + 9 + nm.length * 10.2 > W - 4;
      out.push('<text class="slabel" text-anchor="' + (flip ? 'end' : 'start') + '" x="' + f1(p.x + (flip ? -9 : 9)) + '" y="' + f1(p.y + (id === 'merak' ? 17 : 5)) + '">' + esc(nm) + '</text>');
    });
    out.push('</g>');
    el.sky.setAttribute('class', 'sky' + (sunAlt > -6 ? ' day' : ''));
    el.sky.setAttribute('aria-label', t(view === 'S' ? 'Sternkarte: Blick nach Süden' : 'Sternkarte: Blick nach Norden'));
    el.sky.innerHTML = out.join('');
  }

  /* ---------- Liste "Jetzt sichtbar" ---------- */
  function itemHtml(id, name, sub, status, where, pressed) {
    return '<button type="button" class="item" data-id="' + id + '" aria-pressed="' + (pressed ? 'true' : 'false') + '"><span><span class="name">' + esc(name) + '</span>' +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span><span class="where">' + (status ? esc(status) + '<br>' : '') + where + '</span></button>';
  }
  function whereHtml(a) {
    return esc(t('Richtung {0}, {1}° hoch', [dirName(a.az), '\u0001' + OA.fmt(a.alt, 0) + '\u0002'])).replace('\u0001', '<bdi class="ltr">').replace('\u0002', '</bdi>');
  }
  function drawList(sky) {
    var rows = [], any = false;
    S.constellations.forEach(function (c) {
      var vis = S.visibility(c, sky);
      if (vis === 'none') return;
      any = true;
      var a = sky[c.label];
      var best = c.stars.reduce(function (m, id) { return sky[id].alt > sky[m].alt ? id : m; }, c.stars[0]);
      rows.push(itemHtml(c.id, t(c.name), t(c.sub) + ' · ' + t(c.season), t(vis === 'full' ? 'ganz sichtbar' : 'teilweise sichtbar'), whereHtml(sky[a.alt > 0 ? c.label : best]), st.hi === c.id));
    });
    var stars = BRIGHT.filter(function (id) { return sky[id].alt > 0; });
    var html = '<div class="list-title">' + esc(t('Sternbilder')) + '</div>' +
      (any ? rows.join('') : '<div class="empty">' + esc(t('Im Moment steht keines der Sternbilder über dem Horizont.')) + '</div>') +
      '<div class="list-title">' + esc(t('Helle Einzelsterne')) + '</div>' +
      (stars.length ? stars.map(function (id) {
        return itemHtml(id, starName(id), '', '', whereHtml(sky[id]), st.hi === id);
      }).join('') : '<div class="empty">' + esc(t('Im Moment steht keiner der hellen Sterne über dem Horizont.')) + '</div>');
    el.visible.innerHTML = html;
  }

  /* ---------- Gesamtdarstellung ---------- */
  function render() {
    var date = when(), jd = S.julianDay(date), view = OA.segVal(el.view) || 'N';
    var sky = S.skyAt(jd, st.lat, st.lon), sunAlt = S.sunAltitude(jd, st.lat, st.lon);
    el.timeOut.textContent = hhmm(Number(el.time.value));
    drawSky(sky, sunAlt, view);
    drawList(sky);
    var light = sunAlt > -6 ? 'Die Sonne steht zu hoch: Der Himmel ist noch hell. Sterne sind erst nach der Dämmerung zu sehen.'
      : sunAlt > -18 ? 'Es dämmert noch: Zuerst werden nur die hellsten Sterne sichtbar.' : 'Es ist dunkel genug für viele Sterne.';
    el.status.innerHTML = '<strong>' + esc(isHome() ? 'Waiblingen' : t('Eigener Ort')) + '</strong> · <span class="ltr">' + esc(fmtCoord(st.lat) + '° / ' + fmtCoord(st.lon) + '°') + '</span><br>' +
      esc(t(light)) + ' ' + (sky.polaris.alt > 0 ? esc(t('Polarstern: {0}° über dem Horizont.', ['\u0001' + OA.fmt(sky.polaris.alt, 1) + '\u0002'])).replace('\u0001', '<bdi class="ltr">').replace('\u0002', '</bdi>')
        : esc(t('Der Polarstern steht hier unter dem Horizont.')));
    OA.store.set('sternbilder', { lat: st.lat, lon: st.lon, view: view });
  }

  /* ---------- Eingaben ---------- */
  function readPlace() {
    var la = OA.num(el.lat.value), lo = OA.num(el.lon.value);
    if (isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) { st.lat = la; st.lon = lo; }
  }
  function showPlace() { el.lat.value = fmtCoord(st.lat); el.lon.value = fmtCoord(st.lon); }

  el.view.addEventListener('input', render);
  el.time.addEventListener('input', render);
  el.date.addEventListener('input', render);
  el.now.addEventListener('click', function () { setNow(); render(); });
  [el.lat, el.lon].forEach(function (n) { n.addEventListener('input', function () { readPlace(); render(); }); });
  el.home.addEventListener('click', function () { st.lat = HOME.lat; st.lon = HOME.lon; showPlace(); render(); });
  el.visible.addEventListener('click', function (e) {
    var b = e.target.closest('button.item'); if (!b) return;
    var id = b.getAttribute('data-id');
    st.hi = st.hi === id ? null : id;
    render();
  });

  el.sources.innerHTML = S.sources.map(function (x) {
    return '<li>' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.name) + '</a>' : esc(x.name)) + ' – ' +
      esc(t('Lizenz')) + ': ' + esc(t(x.license)) + ' · ' + esc(t(x.note)) + '</li>';
  }).join('');

  setNow();
  showPlace();
  render();
})();
