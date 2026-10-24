/* Offline-Ark – Aushang-Generator.
 * Formular -> live A4-Vorschau -> window.print() (nur der Aushang). Der Aushang wird in der gewählten Sprache
 * und optional zusätzlich auf Deutsch gesetzt; die Beschriftungen kommen aus dem Wörterbuch (data/i18n/tool-aushaenge.js),
 * eingegebene Texte bleiben unverändert. Gespeichert werden nur Einstellungen – nie Namen, Fotos oder Telefonnummern. */
(function () {
  'use strict';
  var OA = window.OA, D = window.OA_AUSHAENGE, t = OA.t, $ = OA.$, esc = OA.esc;
  var el = {
    tpl: $('#tpl'), fields: $('#fields'), paper: $('#paper'), pv: $('#pv'), warn: $('#fit-warn'), plang: $('#plang'), bi: $('#bi'), biRow: $('#bi-row'),
    strips: $('#strips'), print: $('#print'), cname: $('#f-cname'), cphone: $('#f-cphone'), cextra: $('#f-cextra'), stand: $('#f-stand'),
    fillWrap: $('#fill-wrap'), fillPick: $('#fill-pick'), ctWrap: $('#ct-wrap'), ctPick: $('#ct-pick')
  };
  var LOCALES = { de: 'de-DE', en: 'en-GB', es: 'es-ES', ar: 'ar-u-nu-latn' };

  var saved = OA.store.get('aushaenge', null) || {};
  var cfg = {
    tpl: D.TEMPLATES.some(function (x) { return x.id === saved.tpl; }) ? saved.tpl : D.TEMPLATES[0].id,
    lang: D.LANGS.indexOf(saved.lang) >= 0 ? saved.lang : OA.lang,
    bi: typeof saved.bi === 'boolean' ? saved.bi : OA.lang !== 'de',
    strips: !!saved.strips
  };
  var vals = {};        // Feldwerte (nur im Arbeitsspeicher)
  var photoUrl = '';    // Blob-Adresse des Fotos (nur im Arbeitsspeicher)

  function tpl() { return D.TEMPLATES.filter(function (x) { return x.id === cfg.tpl; })[0]; }
  function persist() { OA.store.set('aushaenge', { tpl: cfg.tpl, lang: cfg.lang, bi: cfg.bi, strips: cfg.strips }); }

  /* ---------- Übersetzung für den Druck (unabhängig von der Anzeigesprache) ---------- */
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function tr(de, lang) {
    if (lang === 'de') return de;
    var e = OA.i18n && OA.i18n.dict[norm(de)];
    return (e && e[lang]) || de;
  }
  function printLangs() { return cfg.bi && cfg.lang !== 'de' ? ['de', cfg.lang] : [cfg.lang]; }
  function dirOf(l) { return l === 'ar' ? 'rtl' : 'ltr'; }
  function inline(de) {   // Beschriftung: "Deutsch / Sprache"
    return printLangs().map(function (l) { return '<span lang="' + l + '" dir="' + dirOf(l) + '">' + esc(tr(de, l)) + '</span>'; }).join(' / ');
  }
  function stacked(de) {  // Satz: eine Zeile je Sprache
    return printLangs().map(function (l) { return '<span style="display:block" lang="' + l + '" dir="' + dirOf(l) + '">' + esc(tr(de, l)) + '</span>'; }).join('');
  }

  /* ---------- Übernahme aus Kontakte & Treffpunkte (nur lesen) ---------- */
  var fillItems = (function () { var l = OA.store.get('treffpunkte', []); return Array.isArray(l) ? l.filter(function (x) { return x && x.name; }) : []; })();
  var contactItems = (function () { var l = OA.store.get('kontakte', []); return Array.isArray(l) ? l.filter(function (x) { return x && x.name; }) : []; })();

  /* ---------- Formular ---------- */
  function renderTemplates() {
    el.tpl.innerHTML = D.TEMPLATES.map(function (x) {
      return '<button type="button" data-id="' + x.id + '" aria-pressed="' + (x.id === cfg.tpl ? 'true' : 'false') + '">' + esc(t(x.title)) + '</button>';
    }).join('');
  }
  function showPhoto() {
    var img = $('#photo-prev'), clr = $('#photo-clear');
    if (!img) return;
    img.src = photoUrl; img.hidden = false; clr.hidden = false;
  }
  function renderFields() {
    var tp = tpl();
    el.fields.innerHTML = tp.fields.map(function (f) {
      var label = esc(t(f.label)) + (f.req ? '<span class="req" aria-hidden="true">*</span>' : '');
      if (f.type === 'photo') {
        return '<div class="field"><label for="f-photo">' + label + '</label><div class="photo-row"><input type="file" id="f-photo" accept="image/*" data-f="photo">' +
          '<img id="photo-prev" alt="" hidden><button type="button" class="btn sm" id="photo-clear" hidden>' + esc(t('Foto entfernen')) + '</button></div>' +
          '<p class="hint">' + esc(t('Das Foto bleibt nur in diesem Browser-Tab und wird nicht gespeichert.')) + '</p></div>';
      }
      if (f.type === 'check') {
        return '<div class="field"><label class="check-row" style="font-size:1rem;color:var(--text);font-weight:600"><input type="checkbox" id="f-' + f.id + '" data-f="' + f.id + '"' + (vals[f.id] ? ' checked' : '') + '><span>' + esc(t(f.label)) + '</span></label></div>';
      }
      var ph = f.ph ? ' placeholder="' + esc(t(f.ph)) + '"' : '';
      var cls = f.ltr ? ' class="ltr"' : '';
      var v = esc(vals[f.id] || '');
      if (f.type === 'area') {
        return '<div class="field"><label for="f-' + f.id + '">' + label + '</label><textarea id="f-' + f.id + '" data-f="' + f.id + '" dir="auto" maxlength="400" style="min-height:84px"' + ph + '>' + v + '</textarea></div>';
      }
      return '<div class="field"><label for="f-' + f.id + '">' + label + '</label><input type="text" id="f-' + f.id + '" data-f="' + f.id + '"' + cls + ' dir="auto" maxlength="160" autocomplete="off"' + ph + ' value="' + v + '"></div>';
    }).join('');
    el.fillWrap.hidden = !(tp.fill === 'treffpunkte' && fillItems.length);
    if (photoUrl) showPhoto();
  }

  el.fields.addEventListener('input', function (e) {
    var id = e.target.getAttribute('data-f');
    if (!id || id === 'photo') return;
    vals[id] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    schedule();
  });
  el.fields.addEventListener('change', function (e) {
    if (e.target.getAttribute('data-f') !== 'photo') return;
    var f = e.target.files && e.target.files[0];
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = ''; }
    if (f && /^image\//.test(f.type)) { photoUrl = URL.createObjectURL(f); showPhoto(); }
    schedule();
  });
  el.fields.addEventListener('click', function (e) {
    if (e.target.id !== 'photo-clear') return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = ''; $('#f-photo').value = ''; $('#photo-prev').hidden = true; e.target.hidden = true;
    schedule();
  });
  el.tpl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]'); if (!b) return;
    cfg.tpl = b.getAttribute('data-id'); persist();
    renderTemplates(); renderFields(); schedule();
  });
  [el.cname, el.cphone, el.cextra, el.stand].forEach(function (n) { n.addEventListener('input', schedule); });
  el.plang.addEventListener('input', function () { cfg.lang = OA.segVal(el.plang); el.biRow.hidden = cfg.lang === 'de'; persist(); schedule(); });
  el.bi.addEventListener('change', function () { cfg.bi = el.bi.checked; persist(); schedule(); });
  el.strips.addEventListener('change', function () { cfg.strips = el.strips.checked; persist(); schedule(); });
  el.print.addEventListener('click', function () { render(); window.print(); });

  if (fillItems.length) {
    el.fillPick.innerHTML = '<option data-notranslate value="">' + esc(t('– Treffpunkt wählen –')) + '</option>' + fillItems.map(function (x, i) { return '<option data-notranslate value="' + i + '">' + esc(x.name) + '</option>'; }).join('');
    el.fillPick.addEventListener('change', function () {
      var x = fillItems[Number(el.fillPick.value)]; if (!x) return;
      vals.where = x.place ? x.name + ', ' + x.place : x.name;
      if (x.coords) vals.coords = x.coords;
      if (x.note) vals.note = x.note;
      renderFields(); schedule();
    });
  }
  if (contactItems.length) {
    el.ctWrap.hidden = false;
    el.ctPick.innerHTML = '<option data-notranslate value="">' + esc(t('– Kontakt wählen –')) + '</option>' + contactItems.map(function (x, i) { return '<option data-notranslate value="' + i + '">' + esc(x.name) + '</option>'; }).join('');
    el.ctPick.addEventListener('change', function () {
      var x = contactItems[Number(el.ctPick.value)]; if (!x) return;
      el.cname.value = x.name || ''; el.cphone.value = x.phone || ''; schedule();
    });
  }

  /* ---------- Aushang ---------- */
  function fmtStand() {
    var v = el.stand.value; if (!v) return '';
    var d = new Date(v); if (isNaN(d)) return '';
    return d.toLocaleString(LOCALES[printLangs()[0]], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function row(label, valueHtml, cls) {
    return '<div class="p-row' + (cls ? ' ' + cls : '') + '"><div class="lab">' + inline(label) + '</div>' + valueHtml + '</div>';
  }

  function paperHtml() {
    var tp = tpl(), ls = printLangs(), rows = '', i;
    // Überschrift: erste Sprache groß, zweite kleiner
    var head = '<div class="p-head">' + ls.map(function (l, k) {
      return '<h2 class="h' + (k + 1) + '" lang="' + l + '" dir="' + dirOf(l) + '">' + esc(tr(tp.head, l)) + '</h2>';
    }).join('') + '</div>';
    var sub = tp.sub ? '<p class="p-sub">' + stacked(tp.sub) + '</p>' : '';

    tp.fields.forEach(function (f) {
      if (f.type === 'photo') return;
      if (f.type === 'check') { if (vals[f.id]) rows += '<p class="p-stat check">' + stacked(f.print) + '</p>'; return; }
      var v = String(vals[f.id] || '').trim();
      if (v) rows += row(f.print, '<div class="val" dir="auto">' + esc(v) + '</div>');
      else if (f.req) rows += row(f.print, '<div class="val ph" dir="auto">' + esc(f.ph ? t(f.ph) : '…') + '</div>');
    });

    var name = el.cname.value.trim(), tel = el.cphone.value.trim(), extra = el.cextra.value.trim();
    var contact = name || tel || extra
      ? '<div class="val" dir="auto">' + (name ? esc(name) : '') + (tel ? '<span class="tel">' + esc(tel) + '</span>' : '') + (extra ? '<span class="xtra">' + esc(extra) + '</span>' : '') + '</div>'
      : '<div class="val ph">' + esc(t('Name und Telefon')) + '</div>';
    rows += row(tp.contact, contact, 'contact');
    if (tp.foot) rows += '<p class="p-stat">' + stacked(tp.foot) + '</p>';

    var hasPhoto = photoUrl && tp.fields.some(function (f) { return f.type === 'photo'; });
    var main = '<div class="p-main">' + (hasPhoto ? '<div class="p-photo"><img src="' + esc(photoUrl) + '" alt=""></div>' : '') + '<div class="p-rows">' + rows + '</div></div>';

    var stand = fmtStand();
    var meta = '<div class="p-meta"><span>' + (stand ? inline('Stand') + ': <span class="ltr">' + esc(stand) + '</span>' : '') + '</span></div>';

    var strips = '';
    if (cfg.strips) {
      var s = '<div class="s">' + (tel ? '<div>' + esc(tel) + (name ? '<small>' + esc(name) + '</small>' : '') + '</div>' : '<div class="ph">+49 …</div>') + '</div>';
      for (i = 0; i < D.STRIPS; i++) strips += s;
      strips = '<div class="p-strips">' + strips + '</div><div class="p-cut">' + inline('Telefonnummer zum Abreißen') + '</div>';
    }
    return head + sub + '<div class="p-body">' + main + '</div>' + meta + strips;
  }

  /* Überschrift so groß wie möglich (60–80 pt), Text so groß wie möglich, bis er auf ein Blatt passt */
  function fit() {
    var paper = el.paper;
    OA.$$('.p-head h2', paper).forEach(function (h, i) {
      var max = i === 0 ? 80 : 52, min = i === 0 ? 60 : 40, size = max;
      h.style.overflowWrap = 'normal'; h.style.fontSize = size + 'pt';
      while (size > min && (h.scrollWidth > h.clientWidth + 1 || h.offsetHeight > size * 1.3333 * 1.05 * 2 + 4)) { size -= 2; h.style.fontSize = size + 'pt'; }
      if (h.scrollWidth > h.clientWidth + 1) h.style.overflowWrap = 'anywhere';
    });
    var body = $('.p-body', paper), k = 1;
    paper.style.setProperty('--k', k);
    while (k > 0.46 && body.scrollHeight > body.clientHeight + 1) { k = Math.round((k - 0.04) * 100) / 100; paper.style.setProperty('--k', k); }
    el.warn.hidden = !(k < 0.62 || body.scrollHeight > body.clientHeight + 1);
  }
  function scale() {
    var w = el.pv.clientWidth, pw = el.paper.offsetWidth;
    if (!w || !pw) return;
    var s = w / pw;
    el.paper.style.transform = 'scale(' + s + ')';
    el.pv.style.height = Math.ceil(el.paper.offsetHeight * s) + 'px';
  }
  function render() {
    var first = printLangs()[0];
    el.paper.setAttribute('lang', first); el.paper.setAttribute('dir', dirOf(first));
    el.paper.innerHTML = paperHtml();
    // Der Aushang darf nie von der automatischen Seitenübersetzung verändert werden (der Beobachter prüft nur neu eingefügte Knoten selbst)
    Array.prototype.forEach.call(el.paper.children, function (c) { c.setAttribute('data-notranslate', ''); });
    fit(); scale();
  }
  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; render(); }); }

  window.addEventListener('resize', scale);
  if (window.ResizeObserver) new ResizeObserver(scale).observe(el.pv);
  window.addEventListener('beforeprint', render);

  /* ---------- Start ---------- */
  var now = new Date(), pad = OA.pad;
  el.stand.value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  OA.segSet(el.plang, cfg.lang);
  el.bi.checked = cfg.bi; el.biRow.hidden = cfg.lang === 'de';
  el.strips.checked = cfg.strips;
  renderTemplates(); renderFields();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  window.addEventListener('pagehide', function () { if (photoUrl) URL.revokeObjectURL(photoUrl); });
})();
