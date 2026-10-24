/* Offline-Ark – Pflanzen & Pilze (Oberfläche): Doppelgänger-Paare, giftige Pflanzen, Pilze, Suche, Detailansicht.
 * Daten: data/pflanzen.js (window.OA_PFLANZEN). Alle sichtbaren Texte laufen über OA.t (Schlüssel = deutscher Text).
 * Fotos liegen lokal in library/images/pflanzen/; Urheber und Lizenz stehen unter jedem Foto. */
(function () {
  'use strict';
  var OA = window.OA, t = OA.t, esc = OA.esc, $ = OA.$;
  var D = window.OA_PFLANZEN;
  var IMG = '../library/images/pflanzen/';
  var STATUS = {
    edible: { label: 'essbar', icon: 'check' },
    toxic: { label: 'giftig', icon: 'alert' },
    inedible: { label: 'ungenießbar', icon: 'close' },
    avoid: { label: 'nicht empfohlen', icon: 'alert' }
  };
  var ITEMS = {};
  D.items.forEach(function (it) { ITEMS[it.id] = it; });

  var el = {
    q: $('#q'), seg: $('#seg'), results: $('#results'), empty: $('#empty'), dlg: $('#detail'), body: $('#detail-body'),
    secs: { pairs: $('#sec-pairs'), toxic: $('#sec-toxic'), fungi: $('#sec-fungi') }, search: $('#sec-search')
  };
  var saved = OA.store.get('pflanzen', null) || {};
  var state = { seg: el.secs[saved.seg] ? saved.seg : 'pairs' };

  /* ---------- Bausteine ---------- */
  function name(it) { return t(it.name); }
  /* Weiche Trennstellen für lange deutsche Namen (schmale Spalten auf dem Handy) */
  var SHY = [['Knollenblätterpilz', 'Knollen\u00ADblätter\u00ADpilz'], ['Hundspetersilie', 'Hunds\u00ADpetersilie'], ['Wasserschierling', 'Wasser\u00ADschierling'],
    ['Pfaffenhütchen', 'Pfaffen\u00ADhütchen'], ['Wiesenchampignon', 'Wiesen\u00ADchampignon'], ['Gallenröhrling', 'Gallen\u00ADröhrling'],
    ['Herbstzeitlose', 'Herbst\u00ADzeitlose'], ['Engelstrompete', 'Engels\u00ADtrompete'], ['Sauerampfer', 'Sauer\u00ADampfer'], ['Maiglöckchen', 'Maiglöck\u00ADchen']];
  function dname(it) {
    var n = name(it);
    if (OA.lang === 'de') SHY.forEach(function (p) { n = n.replace(p[0], p[1]); });
    return n;
  }
  function chip(it) {
    var s = STATUS[it.st];
    return '<span class="pf-chip ' + it.st + '">' + OA.icon(s.icon) + '<span>' + esc(t(s.label)) + '</span></span>' +
      (it.cond ? ' <span class="pf-cond">' + esc(t(it.cond)) + '</span>' : '');
  }
  function img(it, lazy) {
    return '<img src="' + IMG + it.id + '.jpg" width="640" height="480"' + (lazy === false ? '' : ' loading="lazy"') +
      ' alt="' + esc(t('Foto von {0}', [name(it)])) + '">';
  }
  /* Namensnennung: Link zur Commons-Seite; bei Lizenzen außer CC0 der Hinweis auf die Bearbeitung */
  function credit(id) {
    var c = D.credits[id];
    var by = '<span dir="auto" data-notranslate>' + esc(c.by) + '</span>';
    var lic = '<span class="ltr" data-notranslate>' + esc(c.lic) + '</span>';
    return '<div class="pf-credit"><a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + t('Foto: {0} · {1}', [by, lic]) +
      (c.lic === 'CC0' ? '' : ' · ' + esc(t('ggf. verkleinert'))) + '</a></div>';
  }
  function figure(id, extra) {
    var it = ITEMS[id];
    return '<figure class="pf-fig ' + it.st + '">' +
      '<button type="button" class="pf-open" data-id="' + id + '" aria-label="' + esc(t('Details: {0}', [name(it)])) + '">' + img(it) +
      '<span class="pf-cap">' + chip(it) + '<span class="pf-name">' + esc(dname(it)) + '</span><span class="pf-latin ltr">' + esc(it.latin) + '</span></span></button>' +
      credit(id) + (extra || '') + '</figure>';
  }
  function list(arr, cls) {
    return '<ul' + (cls ? ' class="' + cls + '"' : '') + '>' + arr.map(function (s) { return '<li>' + esc(t(s)) + '</li>'; }).join('') + '</ul>';
  }
  function ext(url, text) { return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(text) + '</a>'; }
  function fungiNote() {
    return '<div class="callout warn"><strong>' + esc(t('Anfänger sammeln keine Pilze')) + '</strong>' +
      esc(t('Lass jeden Pilz vor dem Essen von einem Pilzsachverständigen (PSV) der Deutschen Gesellschaft für Mykologie (DGfM) bestimmen.')) + '<br>' +
      ext(D.refs.dgfm.url, t('Pilzsachverständige finden (DGfM, nur mit Internet)')) + '</div>';
  }
  function refName(key) {
    var r = D.refs[key];
    return r.name ? t(r.name) : t('Wikipedia – {0}', [name(ITEMS[key])]);
  }
  function refLic(key) { return t(D.refs[key].lic || D.wikiLic); }

  /* ---------- Doppelgänger-Paare ---------- */
  function pairHtml(p) {
    var all = p.ok.concat(p.bad);
    return '<article class="card pf-pair" id="pair-' + p.id + '"><h3>' +
      esc(all.map(function (id) { return dname(ITEMS[id]); }).join(' ↔ ')) + '</h3>' +
      '<div class="pf-photos">' + all.map(function (id) { return figure(id); }).join('') + '</div>' +
      '<h4 class="pf-h">' + esc(t('So unterscheidest du sie')) + '</h4>' + list(p.diff, 'pf-list') +
      '<div class="callout danger"><strong>' + esc(t('Das droht bei Verwechslung')) + '</strong>' + esc(t(p.risk)) + '</div>' +
      (p.fungi ? fungiNote() : '') + '</article>';
  }

  /* ---------- Giftige Pflanzen (Tabellen) ---------- */
  function row(id) {
    var it = ITEMS[id];
    return '<tr><td>' + figure(id) + '</td><td data-label="' + esc(t('Merkmal')) + '">' + list(it.look.slice(0, 2)) + '</td>' +
      '<td data-label="' + esc(t('Gefahr')) + '">' + esc(t(it.danger)) + '</td></tr>';
  }
  var TWINS = ['maigloeckchen', 'herbstzeitlose', 'aronstab', 'hundspetersilie', 'schierling', 'attich', 'tollkirsche'];
  var MORE = ['eibe', 'eisenhut', 'fingerhut', 'goldregen', 'pfaffenhuetchen', 'seidelbast', 'wasserschierling', 'stechapfel', 'engelstrompete', 'baerenklau'];
  var FUNGI = D.items.filter(function (it) { return it.type === 'mushroom'; }).map(function (it) { return it.id; });

  function renderAll() {
    $('#pairs').innerHTML = D.pairs.map(pairHtml).join('');
    $('#tbl-twins').innerHTML = TWINS.map(row).join('');
    $('#tbl-more').innerHTML = MORE.map(row).join('');
    $('#giz-note').innerHTML = esc(t('Eine Übersicht der in Deutschland wichtigen Giftpflanzen:')) + ' ' + ext(D.refs.giz.url, refName('giz'));
    $('#fungi-warn').innerHTML = '<strong>' + esc(t('Anfänger sammeln keine Pilze')) + '</strong>' +
      esc(t('Die häufigste Ursache für echte Pilzvergiftungen sind Verwechslungen mit essbaren Pilzen. Etwa neun von zehn tödlichen Pilzvergiftungen gehen auf Knollenblätterpilze zurück. Die ersten Beschwerden können 6 bis 72 Stunden später kommen. Dann besteht fast immer Lebensgefahr.')) +
      '<br>' + esc(t('Bei Verdacht: Notruf 112 oder Giftinformationszentrum. Reste der Mahlzeit, Putzabfälle und Erbrochenes aufheben.')) +
      '<br>' + ext(D.refs.dgfm.url, t('Pilzsachverständige finden (DGfM, nur mit Internet)'));
    $('#fungi').innerHTML = FUNGI.map(function (id) {
      var it = ITEMS[id];
      return figure(id, '<div class="pf-body">' + list(it.look) + '<p><strong>' + esc(t(it.st === 'edible' ? 'Vorsicht' : 'Gefahr')) + ':</strong> ' + esc(t(it.danger)) + '</p></div>');
    }).join('');
    $('#src-list').innerHTML = D.sources.map(function (k) {
      return '<li>' + ext(D.refs[k].url, refName(k)) + ' · <span>' + esc(refLic(k)) + '</span></li>';
    }).join('');
    $('#wissen').setAttribute('href', OA.genUrl('knowledge/nahrung.html'));
  }

  /* ---------- Detailansicht ---------- */
  function related(id) {
    var out = [];
    D.pairs.forEach(function (p) {
      var all = p.ok.concat(p.bad);
      if (all.indexOf(id) < 0) return;
      all.forEach(function (o) { if (o !== id && out.indexOf(o) < 0) out.push(o); });
    });
    return out;
  }
  function openDetail(id) {
    var it = ITEMS[id], rel = related(id), keys = [id];
    if (id === 'aronstab') keys.push('arumEn');
    if (it.type === 'mushroom') keys.push('pilzvergiftung');
    el.body.innerHTML =
      '<figure class="pf-fig ' + it.st + '">' + img(it, false) + credit(id) + '</figure>' +
      chip(it) + '<h2 id="detail-title">' + esc(name(it)) + '</h2><div class="pf-latin ltr">' + esc(it.latin) + '</div>' +
      '<h4 class="pf-h">' + esc(t('Merkmale')) + '</h4>' + list(it.look, 'pf-list') +
      '<div class="callout ' + (it.st === 'edible' ? 'warn' : 'danger') + '"><strong>' + esc(t(it.st === 'edible' ? 'Vorsicht' : 'Gefahr')) + '</strong>' + esc(t(it.danger)) + '</div>' +
      (it.type === 'mushroom' ? fungiNote() : '') +
      (rel.length ? '<h4 class="pf-h">' + esc(t('Verwechslung mit')) + '</h4><div class="pf-also">' + rel.map(function (o) {
        return '<button type="button" data-id="' + o + '">' + esc(name(ITEMS[o])) + '</button>';
      }).join('') + '</div>' : '') +
      '<h4 class="pf-h">' + esc(t('Quellen')) + '</h4><p class="small muted">' + keys.map(function (k) { return ext(D.refs[k].url, refName(k)); }).join(' · ') + '</p>' +
      '<div class="btn-row"><button type="button" class="btn sm" data-close autofocus>' + esc(t('Schließen')) + '</button></div>';
    if (!el.dlg.open) { if (el.dlg.showModal) el.dlg.showModal(); else el.dlg.setAttribute('open', ''); }
    el.dlg.scrollTop = 0;
  }
  function closeDetail() { if (el.dlg.close) el.dlg.close(); else el.dlg.removeAttribute('open'); }

  /* ---------- Suche ---------- */
  function fold(s) {
    return String(s || '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f\u064B-\u065F\u0640]/g, '');
  }
  function digraph(s) { return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss'); }
  var WORDS = {
    plant: 'pflanze plant planta نبات',
    mushroom: 'pilz mushroom seta hongo فطر',
    edible: 'essbar edible comestible صالح للأكل',
    toxic: 'giftig poisonous toxic venenoso سام',
    inedible: 'ungenießbar inedible no comestible',
    avoid: 'nicht empfohlen not recommended no recomendado'
  };
  function haystack(it) {
    var s = [it.name, name(it), it.latin, it.kw, WORDS[it.type], WORDS[it.st]].join(' ');
    return fold(s) + ' ' + fold(digraph(s));
  }
  function renderResults(q) {
    var words = fold(q).split(/\s+/).filter(Boolean);
    var hits = D.items.filter(function (it) {
      var h = haystack(it);
      return words.every(function (w) { return h.indexOf(w) >= 0; });
    });
    el.results.innerHTML = hits.map(function (it) {
      return '<li><button type="button" class="pf-res" data-id="' + it.id + '">' + img(it) +
        '<span class="pf-txt"><span class="pf-name">' + esc(name(it)) + '</span><span class="pf-latin ltr">' + esc(it.latin) + '</span></span>' + chip(it) + '</button></li>';
    }).join('');
    el.empty.hidden = hits.length > 0;
  }

  /* ---------- Anzeige ---------- */
  function show() {
    var q = el.q.value.trim();
    Object.keys(el.secs).forEach(function (k) { el.secs[k].hidden = !!q || k !== state.seg; });
    el.search.hidden = !q;
    if (q) renderResults(q);
  }

  el.seg.addEventListener('input', function () {
    state.seg = OA.segVal(el.seg) || 'pairs';
    OA.store.set('pflanzen', { seg: state.seg });
    el.q.value = '';
    show();
  });
  el.q.addEventListener('input', show);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]');
    if (b && (b.closest('#sec-pairs') || b.closest('#sec-toxic') || b.closest('#sec-fungi') || b.closest('#sec-search') || b.closest('#detail'))) { openDetail(b.getAttribute('data-id')); return; }
    if (e.target.closest('[data-close]') || e.target === el.dlg) closeDetail();
  });

  OA.segSet(el.seg, state.seg);
  renderAll();
  show();
})();
