/* Offline-Ark – Gartenkalender (Oberfläche). Rechenkern: js/garten-core.js, Daten: data/garten.js.
 * Termine: Bayerische Gartenakademie (LWG), siehe Quellen auf der Seite. Richtwerte, auf halbe Monate gerundet. */
(function () {
  'use strict';
  var OA = window.OA, D = window.OA_GARTEN, C = window.OA_GARTEN_CORE;

  var nowM = new Date().getMonth();
  var saved = OA.store.get('garten', {}) || {};
  var state = { q: '', filter: saved.filter || 'all', month: nowM, store: !!saved.store };
  var open = {};

  var el = {
    q: OA.$('#q'), filter: OA.$('#filter'), month: OA.$('#month'), store: OA.$('#store'), count: OA.$('#count'), mhead: OA.$('#mhead'),
    list: OA.$('#list'), storeIntro: OA.$('#storeIntro'), storeList: OA.$('#storeList'), emerList: OA.$('#emerList'),
    frostList: OA.$('#frostList'), sources: OA.$('#sources'), fSow: OA.$('#fSow'), fHarvest: OA.$('#fHarvest')
  };
  OA.segSet(el.filter, state.filter);
  el.store.checked = state.store;

  function mname(m, style) { return new Date(2000, m, 1).toLocaleString(OA.locale || 'de-DE', { month: style || 'long' }); }
  function pos(p) { return OA.t({ start: 'Anfang', mid: 'Mitte', end: 'Ende' }[p]); }

  function rangeText(ranges) {
    return C.describe(ranges).map(function (d) {
      if (d.a.pos === 'start' && d.b.pos === 'end') {
        return d.a.m === d.b.m ? OA.t('im {0}', [mname(d.a.m)]) : OA.t('von {0} bis {1}', [mname(d.a.m), mname(d.b.m)]);
      }
      return OA.t('von {0} {1} bis {2} {3}', [pos(d.a.pos), mname(d.a.m), pos(d.b.pos), mname(d.b.m)]);
    }).join('; ');
  }

  var LANES = [
    ['pre', 'pre', 'V', 'Vorkultur (Frühbeet oder drinnen)'],
    ['sow', 'sow', 'S', 'Aussaat ins Freiland'],
    ['plant', 'plant', 'P', 'Pflanzen, Stecken oder Legen draußen'],
    ['harvest', 'harv', 'E', 'Ernte']
  ];

  function bars(c) {
    return LANES.filter(function (l) { return c[l[0]] && c[l[0]].length; }).map(function (l) {
      return '<div class="lane">' + c[l[0]].map(function (r, i) {
        return '<span class="bar ' + l[1] + '" style="left:' + (r[0] / 12 * 100).toFixed(2) + '%;width:' + ((r[1] - r[0]) / 12 * 100).toFixed(2) + '%">' +
          (i === 0 ? '<span class="tag">' + OA.esc(OA.t(l[2])) + '</span>' : '') + '</span>';
      }).join('') + '</div>';
    }).join('');
  }

  function summary(c) {
    return LANES.filter(function (l) { return c[l[0]] && c[l[0]].length; }).map(function (l) { return OA.t(l[3]) + ': ' + rangeText(c[l[0]]); }).join('. ');
  }

  function detail(c) {
    var rows = LANES.filter(function (l) { return c[l[0]] && c[l[0]].length; }).map(function (l) {
      return '<div><span class="k">' + OA.esc(OA.t(l[3])) + ':</span> ' + OA.esc(rangeText(c[l[0]])) + '</div>';
    });
    if (c.plantFoil && c.plantFoil.length) rows.push('<div>' + OA.esc(OA.t('Mit Folie oder Vlies früher pflanzen: {0}', [rangeText(c.plantFoil)])) + '</div>');
    if (c.harvestFoil && c.harvestFoil.length) rows.push('<div>' + OA.esc(OA.t('Mit Folie oder Vlies früher ernten: {0}', [rangeText(c.harvestFoil)])) + '</div>');
    if (c.regrow) rows.push('<div>' + OA.esc(OA.t('Wächst nach dem Schnitt nach.')) + '</div>');
    if (c.store) rows.push('<div>' + OA.esc(OA.t('Lagerfähig, siehe Liste unten.')) + '</div>');
    return rows.join('');
  }

  function chips(c) {
    var f = C.flags(c, state.month), out = [];
    if (f.pre) out.push('Vorziehen'); if (f.sow) out.push('Säen'); if (f.plant) out.push('Pflanzen'); if (f.harvest) out.push('Ernten');
    return out.map(function (t) { return '<span class="chip">' + OA.esc(OA.t(t)) + '</span>'; }).join('');
  }

  function render() {
    var q = state.q.trim().toLowerCase();
    var rows = D.crops.map(function (c) { return { c: c, name: OA.t(c.name) }; }).filter(function (r) {
      if (state.store && !r.c.store) return false;
      if (!C.matches(r.c, state.month, state.filter)) return false;
      return !q || r.name.toLowerCase().indexOf(q) !== -1 || r.c.name.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return a.name.localeCompare(b.name, OA.locale || 'de'); });

    el.count.textContent = OA.t('{0} von {1} Kulturen', [rows.length, D.crops.length]);
    el.list.innerHTML = rows.length ? rows.map(function (r) {
      var c = r.c, id = 'crop-' + c.id, isOpen = !!open[c.id];
      return '<article class="crop"><button type="button" class="crop-head" data-id="' + c.id + '" aria-expanded="' + isOpen + '" aria-controls="' + id + '">' +
        '<span>' + OA.esc(r.name) + '</span><span class="chips">' + chips(c) + '</span></button>' +
        '<div class="cal" role="img" aria-label="' + OA.esc(summary(c)) + '"><div class="track"><span class="now" style="left:' + (state.month / 12 * 100).toFixed(3) + '%"></span>' + bars(c) + '</div></div>' +
        '<div class="detail" id="' + id + '"' + (isOpen ? '' : ' hidden') + '>' + detail(c) + '</div></article>';
    }).join('') : '<p class="muted">' + OA.esc(OA.t('Keine passende Kultur gefunden.')) + '</p>';

    el.fSow.textContent = state.month === nowM ? OA.t('Jetzt säen') : OA.t('Im {0} säen', [mname(state.month)]);
    el.fHarvest.textContent = state.month === nowM ? OA.t('Jetzt ernten') : OA.t('Im {0} ernten', [mname(state.month)]);
    OA.$$('span', el.mhead).forEach(function (s, i) { s.className = i === state.month ? 'cur' : ''; });
  }

  // feste Teile einmal aufbauen
  el.mhead.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (m) {
    return '<span title="' + OA.esc(mname(m)) + '">' + OA.esc(mname(m, 'narrow')) + '</span>';
  }).join('');
  el.month.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (m) {
    return '<option value="' + m + '"' + (m === nowM ? ' selected' : '') + '>' + OA.esc(m === nowM ? OA.t('{0} (jetzt)', [mname(m)]) : mname(m)) + '</option>';
  }).join('');
  [['lgV', 'V'], ['lgS', 'S'], ['lgP', 'P'], ['lgE', 'E']].forEach(function (x) { OA.$('#' + x[0]).textContent = OA.t(x[1]); });

  var storeNames = D.crops.filter(function (c) { return c.store; }).map(function (c) { return OA.t(c.name); }).join(', ');
  el.storeIntro.textContent = OA.t('Diese Kulturen aus dem Kalender gelten als lagerfähig: {0}.', [storeNames]);
  function items(list) {
    return list.map(function (x) { return '<div class="item"><strong>' + OA.esc(OA.t(x.name)) + '</strong>' + OA.esc(OA.t(x.text)) + '</div>'; }).join('');
  }
  el.storeList.innerHTML = items(D.storage);
  el.emerList.innerHTML = items(D.emergency);
  el.frostList.innerHTML = D.frost.map(function (x) { return '<li>' + OA.esc(OA.t(x.text)) + '</li>'; }).join('');
  el.sources.innerHTML = D.sources.map(function (s) {
    return '<li><a href="' + OA.esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + OA.esc(s.name) + '</a> – ' +
      OA.esc(OA.t('Lizenz')) + ': ' + OA.esc(OA.t(s.license)) + ' · ' + OA.esc(OA.t(s.note)) + '</li>';
  }).join('');

  el.q.addEventListener('input', function () { state.q = el.q.value; render(); });
  el.filter.addEventListener('input', function () { state.filter = OA.segVal(el.filter); persist(); render(); });
  el.month.addEventListener('change', function () { state.month = Number(el.month.value); render(); });
  el.store.addEventListener('change', function () { state.store = el.store.checked; persist(); render(); });
  el.list.addEventListener('click', function (e) {
    var b = e.target.closest('.crop-head'); if (!b) return;
    var id = b.getAttribute('data-id'); open[id] = !open[id];
    b.setAttribute('aria-expanded', open[id] ? 'true' : 'false');
    var d = OA.$('#crop-' + id); if (d) d.hidden = !open[id];
  });
  function persist() { OA.store.set('garten', { filter: state.filter, store: state.store }); }
  render();
})();
