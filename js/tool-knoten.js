/* Offline-Ark – Knoten (Oberfläche): Suche, Filter nach Zweck, Schritt-für-Schritt mit animierter Zeichnung oder Fotos.
 * Die Animation zeichnet das Seil Stück für Stück (Seillänge wächst); sie lässt sich abschalten und
 * folgt "prefers-reduced-motion". Alle Texte laufen über OA.t. */
(function () {
  'use strict';
  var OA = window.OA, t = OA.t, esc = OA.esc, $ = OA.$;
  var K = window.OA_KNOTEN, SC = window.OA_KNOTEN_SCENES, D = window.OA_KNOTEN_DATA;
  var el = { q: $('#q'), filter: $('#filter'), list: $('#list'), empty: $('#empty'), detail: $('#detail') };

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var saved = OA.store.get('knoten', null) || {};
  var st = { cat: 'alle', q: '', id: D.KNOTS.some(function (k) { return k.id === saved.id; }) ? saved.id : D.KNOTS[0].id, step: 0, anim: typeof saved.anim === 'boolean' ? saved.anim : !reduced };
  var stage = null, raf = 0;

  function persist() { OA.store.set('knoten', { id: st.id, anim: st.anim }); }
  function knot(id) { return D.KNOTS.filter(function (k) { return k.id === id; })[0]; }
  function catLabel(id) { return t(D.CATS.filter(function (c) { return c.id === id; })[0].label); }

  /* ---------- Liste, Suche, Filter ---------- */
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function matches(k) {
    if (st.cat !== 'alle' && k.cats.indexOf(st.cat) < 0) return false;
    if (!st.q) return true;
    var hay = norm([t(k.title), t(k.sub), k.title, k.kw, t(k.purpose), k.cats.map(catLabel).join(' ')].join(' '));
    return norm(st.q).split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function renderFilter() {
    var all = [{ id: 'alle', label: 'Alle' }].concat(D.CATS);
    el.filter.innerHTML = all.map(function (c) {
      return '<button type="button" data-c="' + c.id + '" aria-pressed="' + (c.id === st.cat ? 'true' : 'false') + '">' + esc(t(c.label)) + '</button>';
    }).join('');
  }
  function renderList() {
    var list = D.KNOTS.filter(matches);
    el.list.innerHTML = list.map(function (k) {
      return '<li><button type="button" data-id="' + k.id + '"' + (k.id === st.id ? ' aria-current="true"' : '') + '>' + esc(t(k.title)) + '<small>' + esc(t(k.sub)) + '</small></button></li>';
    }).join('');
    el.empty.hidden = list.length > 0;
  }

  /* ---------- Zeichnung ---------- */
  function sceneDef(k) { var s = SC[k.scene]; return typeof s === 'function' ? s() : s; }
  function marksHtml(marks) {
    return (marks || []).map(function (m) {
      if (m.k === 'text') return '<text x="' + m.x + '" y="' + m.y + '">' + esc(/^[A-Z]$/.test(m.s) && m.s.length === 1 ? m.s : t(m.s)) + '</text>';
      return '<g transform="translate(' + m.x + ' ' + m.y + ') rotate(' + m.a + ')"><path class="mk" d="M0 0L-26 -13L-26 13Z"/><path class="mk-line" d="M-24 0L-58 0"/></g>';
    }).join('');
  }
  function Stage(k) {
    var self = this;
    this.k = k; this.scene = K.build(sceneDef(k)); this.def = this.scene.def;
    this.cur = {};
    this.scene.ropes.forEach(function (r) { self.cur[r.id] = 0; });
    this.svg = null;
  }
  Stage.prototype.target = function (i) {
    var out = {}, step = this.k.steps[i], self = this;
    this.scene.ropes.forEach(function (r) {
      var v = step.reveal && step.reveal[r.id] != null ? step.reveal[r.id] : 99;
      out[r.id] = Math.min(v, r.pts.length);
    });
    return out;
  };
  Stage.prototype.draw = function () {
    var vb = this.def.vb;
    this.svg.innerHTML = K.render(this.scene, this.cur) + '<g class="marks">' + (this.showMarks ? marksHtml(this.k.steps[st.step].marks) : '') + '</g>';
    this.svg.style.setProperty('--rw', this.def.w);
    this.svg.setAttribute('viewBox', vb.join(' '));
  };
  Stage.prototype.go = function (i, animate) {
    var self = this, to = this.target(i), from = {}, maxd = 0;
    cancelAnimationFrame(raf);
    Object.keys(to).forEach(function (id) { from[id] = self.cur[id]; maxd = Math.max(maxd, Math.abs(to[id] - from[id])); });
    this.showMarks = false;
    if (!animate || maxd < 0.01) {
      Object.keys(to).forEach(function (id) { self.cur[id] = to[id]; });
      this.showMarks = true; this.draw(); return;
    }
    var dur = Math.min(1500, 350 + maxd * 120), t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      Object.keys(to).forEach(function (id) { self.cur[id] = from[id] + (to[id] - from[id]) * e; });
      self.showMarks = p >= 1;
      self.draw();
      if (p < 1) raf = requestAnimationFrame(tick);
    })(t0);
  };

  /* ---------- Detailansicht ---------- */
  function renderDetail() {
    var k = knot(st.id), html = '';
    cancelAnimationFrame(raf); stage = null;
    html += '<h2>' + esc(t(k.title)) + '</h2>';
    html += '<div class="kn-tags">' + k.cats.map(function (c) { return '<span class="chip">' + esc(catLabel(c)) + '</span>'; }).join('') + '</div>';
    if (k.warn) html += '<div class="callout warn"><strong>' + esc(t('Achtung')) + '</strong>' + esc(t(k.warn)) + '</div>';

    if (k.scene) {
      html += '<div class="kn-stage"><svg class="kn-svg" id="kn-svg" role="img" aria-label="' + esc(t(k.title)) + '" preserveAspectRatio="xMidYMid meet"></svg><span class="kn-badge" id="kn-badge" aria-hidden="true">1</span></div>';
      html += '<div class="kn-nav"><button type="button" class="btn" id="kn-prev">' + esc(t('Zurück')) + '</button><span class="pos ltr" id="kn-pos" aria-live="polite"></span><button type="button" class="btn primary" id="kn-next">' + esc(t('Weiter')) + '</button></div>';
      html += '<div class="kn-anim"><span id="kn-anim-l">' + esc(t('Animation')) + '</span><label class="switch"><input type="checkbox" id="kn-anim" aria-labelledby="kn-anim-l"' + (st.anim ? ' checked' : '') + '><span></span></label></div>';
      html += '<p class="kn-now" id="kn-now"></p>';
    } else if (k.photos) {
      html += '<div class="kn-photos">' + k.photos.map(function (p) {
        return '<figure><img src="' + esc(OA.root + 'bibliothek/bilder/knoten/' + p.f) + '" alt="' + esc(t(p.c)) + '" loading="lazy" width="720" height="540"><figcaption>' + esc(t(p.c)) +
          ' · <span data-notranslate>' + esc(t('Foto: {0}, {1}', [p.by, p.lic])) + ' · <a href="' + esc(p.u) + '" rel="noopener noreferrer" target="_blank">Wikimedia Commons</a></span></figcaption></figure>';
      }).join('') + '</div>';
    }
    html += '<h3 style="margin-top:1.4em">' + esc(t('Schritte')) + '</h3><ol class="kn-steps" id="kn-steps">' +
      k.steps.map(function (s, i) { return '<li data-i="' + i + '">' + esc(t(s.t)) + '</li>'; }).join('') + '</ol>';
    html += '<div class="kn-meta"><h3>' + esc(t('Wofür')) + '</h3><p>' + esc(t(k.purpose)) + '</p>' +
      '<div class="callout danger" style="margin:1em 0 0"><strong>' + esc(t('Wann nicht benutzen')) + '</strong>' + esc(t(k.avoid)) + '</div>' +
      '<p class="kn-src" style="margin-top:1.2em">' + esc(t('Quellen')) + ': ' + k.src.map(function (s) { return '<a href="' + esc(s.u) + '" rel="noopener noreferrer" target="_blank">' + esc(t(s.l)) + '</a>'; }).join(' · ') +
      (k.credit ? '<br>' + esc(t(k.credit)) : '') + '</p></div>';
    el.detail.innerHTML = html;

    if (k.scene) {
      stage = new Stage(k);
      stage.svg = $('#kn-svg');
      st.step = Math.min(st.step, k.steps.length - 1);
      showStep(false);
    }
  }
  function showStep(animate) {
    var k = knot(st.id);
    var n = k.steps.length, i = st.step;
    $('#kn-pos').textContent = t('Schritt {0} von {1}', [i + 1, n]);
    $('#kn-badge').textContent = i + 1;
    $('#kn-now').textContent = t(k.steps[i].t);
    $('#kn-prev').disabled = i === 0;
    $('#kn-next').disabled = i === n - 1;
    OA.$$('#kn-steps li').forEach(function (li, j) { if (j === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    $('#kn-svg').setAttribute('aria-label', t(k.title) + ': ' + t('Schritt {0} von {1}', [i + 1, n]) + '. ' + t(k.steps[i].t));
    stage.go(i, animate && st.anim);
  }

  /* ---------- Ereignisse ---------- */
  el.q.addEventListener('input', function () { st.q = el.q.value.trim(); renderList(); });
  el.filter.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-c]'); if (!b) return;
    st.cat = b.getAttribute('data-c'); renderFilter(); renderList();
  });
  el.list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]'); if (!b) return;
    st.id = b.getAttribute('data-id'); st.step = 0; persist(); renderList(); renderDetail();
    el.detail.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });
  el.detail.addEventListener('click', function (e) {
    if (!stage) return;
    var k = knot(st.id);
    if (e.target.id === 'kn-prev' && st.step > 0) { st.step--; showStep(true); }
    else if (e.target.id === 'kn-next' && st.step < k.steps.length - 1) { st.step++; showStep(true); }
    else { var li = e.target.closest('#kn-steps li'); if (li) { st.step = Number(li.getAttribute('data-i')); showStep(true); } }
  });
  el.detail.addEventListener('change', function (e) {
    if (e.target.id === 'kn-anim') { st.anim = e.target.checked; persist(); if (stage) showStep(false); }
  });

  renderFilter(); renderList(); renderDetail();
})();
