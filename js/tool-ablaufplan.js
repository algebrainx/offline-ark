/* Offline-Ark – Stromausfall-Plan zum Abhaken. Inhalte: data/ablaufplan.js
 * Gespeichert (OA.store 'ablaufplan'): { start: Millisekunden | null, checked: { punktId: true }, custom: [{ id, text, phase }] } */
(function () {
  'use strict';
  var OA = window.OA, D = window.OA_ABLAUFPLAN, $ = OA.$, PH = D.phases;
  var HOUR = 3600000, MIN = 60000;

  /* ---------- Zustand ---------- */
  var st = OA.store.get('ablaufplan', null);
  if (!st || typeof st !== 'object') st = {};
  if (typeof st.start !== 'number' || !isFinite(st.start)) st.start = null;
  if (!st.checked || typeof st.checked !== 'object' || Array.isArray(st.checked)) st.checked = {};
  st.custom = (Array.isArray(st.custom) ? st.custom : []).filter(function (x) {
    return x && typeof x.id === 'string' && typeof x.text === 'string' && x.text.trim() && PH.some(function (p) { return p.id === x.phase; });
  });

  var el = {
    status: $('#status'), next: $('#next'), plan: $('#plan'), overallText: $('#overallText'), overallBar: $('#overallBar'), overallWrap: $('#overallWrap'),
    storeWarn: $('#storeWarn'), addForm: $('#addForm'), addText: $('#addText'), addPhase: $('#addPhase'), printView: $('#printView')
  };
  var openMap = {};   // Phase-ID -> aufgeklappt (bleibt beim Neuzeichnen erhalten)
  var curIdx = -1;

  function save() { el.storeWarn.hidden = OA.store.set('ablaufplan', st); }

  /* ---------- Hilfen ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUM = /\d+(?:[–:.,]\d+)*/g;
  /** Übersetzen und Zahlen linksläufig markieren (Arabisch). */
  function t(de, args) { return esc(OA.t(de, args)).replace(NUM, '<span class="ltr">$&</span>'); }
  function itemsOf(p) { return p.items.concat(st.custom.filter(function (c) { return c.phase === p.id; })); }
  function isDone(it) { return !!st.checked[it.id]; }
  function count(items) { var d = items.filter(isDone).length; return { done: d, total: items.length }; }

  /** Vergangene Zeit lesbar: "12 Min.", "3 Std. 5 Min.", "2 Tage 4 Std." */
  function dur(ms) {
    var m = Math.max(0, Math.floor(ms / MIN)), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d >= 1) return OA.t(d === 1 ? '{0} Tag {1} Std.' : '{0} Tage {1} Std.', [d, h - d * 24]);
    if (h >= 1) return OA.t('{0} Std. {1} Min.', [h, m - h * 60]);
    return OA.t('{0} Min.', [m]);
  }
  /** Index der aktuellen Phase (-1: noch nicht gestartet). */
  function phaseNow() {
    if (st.start == null) return -1;
    var h = (Date.now() - st.start) / HOUR;
    for (var i = 0; i < PH.length; i++) if (PH[i].to == null || h < PH[i].to) return i;
    return PH.length - 1;
  }
  function fmtTime(ms) {
    try { return new Date(ms).toLocaleString(OA.locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return new Date(ms).toString(); }
  }
  function toInput(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + OA.pad(d.getMonth() + 1) + '-' + OA.pad(d.getDate()) + 'T' + OA.pad(d.getHours()) + ':' + OA.pad(d.getMinutes());
  }
  function linkHtml(l) {
    var href = l.tool ? l.tool + '.html' : OA.genUrl('wissen/' + l.wissen + '.html');
    return '<a class="lnk" href="' + esc(href) + '">' + esc(OA.t(l.t)) + '</a>';
  }

  /* ---------- Anzeige ---------- */
  function renderStatus() {
    var h;
    if (st.start == null) {
      h = '<h2 class="s-title">' + t('Ist der Strom gerade ausgefallen?') + '</h2>' +
        '<p class="muted">' + t('Drück den Knopf, sobald der Strom weg ist. Dann siehst du, wie lange es schon dauert und welche Phase gerade gilt.') + '</p>' +
        '<div class="btn-row"><button type="button" class="btn primary" id="startNow">' + OA.icon('play') + '<span>' + t('Jetzt gestartet') + '</span></button></div>';
    } else {
      h = '<p class="kicker">' + t('Der Ausfall dauert schon') + '</p>' +
        '<div class="big" id="elapsed" role="timer"></div>' +
        '<p class="muted" id="since"></p>' +
        '<p class="phase-now" id="phaseNow"></p>' +
        '<details class="chg"><summary>' + t('Startzeit ändern') + '</summary><div class="field"><label class="label" for="startIn">' + t('Ausfall begann um …') + '</label>' +
        '<input type="datetime-local" id="startIn" value="' + toInput(st.start) + '" aria-label="' + esc(OA.t('Ausfall begann um …')) + '"></div></details>' +
        '<div class="btn-row"><button type="button" class="btn danger" id="reset">' + t('Alles zurücksetzen') + '</button><button type="button" class="btn" id="print">' + OA.icon('print') + '<span>' + t('Plan drucken') + '</span></button></div>';
    }
    el.status.innerHTML = h;
    tick();
  }

  /** Nur Zeitanzeigen aktualisieren. Wechselt die Phase, wird alles neu gezeichnet. */
  function tick() {
    var idx = phaseNow();
    if (idx !== curIdx) { curIdx = idx; renderAll(false); return; }
    if (st.start == null) return;
    var e = $('#elapsed'); if (!e) return;
    var ms = Date.now() - st.start;
    e.textContent = ms < 0 ? OA.t('Startzeit liegt in der Zukunft') : dur(ms);
    $('#since').innerHTML = t('Ausfall begann um {0}', ['\u0001']).replace('\u0001', '<bdi>' + esc(fmtTime(st.start)) + '</bdi>');
    var p = PH[idx], line = t('Jetzt: {0}', [OA.t(p.title)]);
    if (p.to != null) line += ' · ' + t('nächste Phase in {0}', [dur(st.start + p.to * HOUR - Date.now())]);
    $('#phaseNow').innerHTML = line;
  }

  function checkRow(it, custom) {
    var label = custom ? '<span data-notranslate>' + esc(it.text) + '</span>' : '<span>' + esc(OA.t(it.text)) + '</span>';
    var cb = '<label class="check"><input type="checkbox" data-id="' + esc(it.id) + '"' + (isDone(it) ? ' checked' : '') + '>' + label + '</label>';
    var del = custom ? '<button type="button" class="x" data-del="' + esc(it.id) + '" aria-label="' + esc(OA.t('Punkt entfernen: {0}', [it.text])) + '">✕</button>' : '';
    var lnks = (it.links && it.links.length) ? '<div class="lnks">' + it.links.map(linkHtml).join('') + '</div>' : '';
    return '<div class="irow">' + '<div class="main">' + cb + lnks + '</div>' + del + '</div>';
  }

  function renderNext() {
    var from = Math.max(0, curIdx), list = [];
    for (var i = from; i < PH.length && list.length < 3; i++) {
      itemsOf(PH[i]).forEach(function (it) { if (list.length < 3 && !isDone(it)) list.push({ it: it, p: PH[i], custom: st.custom.indexOf(it) !== -1 }); });
    }
    if (!list.length) { el.next.innerHTML = '<h2 class="s-title">' + t('Als Nächstes') + '</h2><p class="muted">' + t('Alles abgehakt. Gut gemacht!') + '</p>'; return; }
    el.next.innerHTML = '<h2 class="s-title">' + t('Als Nächstes') + '</h2>' +
      list.map(function (x) { return '<div class="nrow">' + checkRow(x.it, x.custom) + '<span class="chip ph">' + esc(OA.t(x.p.title)) + '</span></div>'; }).join('');
  }

  function renderPlan() {
    el.plan.innerHTML = PH.map(function (p, i) {
      var items = itemsOf(p), c = count(items), pct = c.total ? Math.round(c.done / c.total * 100) : 0, now = i === curIdx;
      var open = openMap[p.id] != null ? openMap[p.id] : (curIdx >= 0 ? now : i === 0);
      return '<details class="phase' + (now ? ' now' : '') + '" data-phase="' + p.id + '"' + (open ? ' open' : '') + '>' +
        '<summary><span class="ptitle"><strong>' + t(p.title) + '</strong>' + (now ? '<span class="chip on">' + t('Jetzt') + '</span>' : '') +
        '<span class="muted small">' + t(p.when) + '</span></span><span class="pn">' + c.done + ' / ' + c.total + '</span></summary>' +
        '<div class="bar sm" role="progressbar" aria-label="' + esc(OA.t(p.title)) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="rows">' + p.items.map(function (it) { return checkRow(it, false); }).join('') +
        st.custom.filter(function (x) { return x.phase === p.id; }).map(function (x) { return checkRow(x, true); }).join('') + '</div></details>';
    }).join('');
  }

  function renderOverall() {
    var all = [];
    PH.forEach(function (p) { all = all.concat(itemsOf(p)); });
    var c = count(all), pct = c.total ? Math.round(c.done / c.total * 100) : 0;
    el.overallText.textContent = OA.t('{0} von {1}', [c.done, c.total]);
    el.overallBar.style.width = pct + '%';
    el.overallWrap.setAttribute('aria-valuenow', pct);
  }

  function renderSelect() {
    var sel = el.addPhase.value;
    el.addPhase.innerHTML = PH.map(function (p) { return '<option value="' + p.id + '">' + esc(OA.t(p.title)) + '</option>'; }).join('');
    el.addPhase.value = sel && PH.some(function (p) { return p.id === sel; }) ? sel : PH[Math.max(0, curIdx)].id;
  }

  function renderPrint() {
    var h = '<h1>' + esc(OA.t('Stromausfall-Plan')) + '</h1>';
    if (st.start != null) h += '<p>' + esc(OA.t('Ausfall begann um {0}', [fmtTime(st.start)])) + '</p>';
    h += PH.map(function (p) {
      var box = function (it, custom) { return '<li><span class="box">' + (isDone(it) ? '☑' : '☐') + '</span>' + (custom ? '<span data-notranslate>' + esc(it.text) + '</span>' : esc(OA.t(it.text))) + '</li>'; };
      return '<h2>' + esc(OA.t(p.title)) + ' <small>' + esc(OA.t(p.when)) + '</small></h2><ul>' + p.items.map(function (it) { return box(it, false); }).join('') +
        st.custom.filter(function (x) { return x.phase === p.id; }).map(function (x) { return box(x, true); }).join('') + '</ul>';
    }).join('');
    h += '<p class="src">' + esc(OA.t(D.source)) + ' ' + esc(OA.t('Im Notfall 112.')) + '</p>';
    el.printView.innerHTML = h;
  }

  function renderAll(withStatus) {
    curIdx = phaseNow();
    if (withStatus !== false) renderStatus();
    renderNext(); renderPlan(); renderOverall(); renderSelect(); renderPrint();
    if (withStatus === false) tick();
  }

  /* ---------- Bedienung ---------- */
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('#startNow')) { st.start = Date.now(); save(); renderAll(true); return; }
    if (e.target.closest('#print')) { window.print(); return; }
    if (e.target.closest('#reset')) {
      if (!confirm(OA.t('Startzeit und alle Häkchen wirklich zurücksetzen? Deine eigenen Punkte bleiben erhalten.'))) return;
      st.start = null; st.checked = {}; openMap = {}; save(); renderAll(true); return;
    }
    if ((b = e.target.closest('[data-del]'))) {
      var id = b.getAttribute('data-del');
      st.custom = st.custom.filter(function (x) { return x.id !== id; }); delete st.checked[id]; save(); renderAll(false);
    }
  });

  document.addEventListener('change', function (e) {
    var cb = e.target;
    if (cb.id === 'startIn') {
      var ms = new Date(cb.value).getTime();
      if (isFinite(ms)) { st.start = ms; save(); renderAll(true); }
      return;
    }
    if (!cb.matches || !cb.matches('input[type="checkbox"][data-id]')) return;
    var id = cb.getAttribute('data-id');
    if (cb.checked) st.checked[id] = true; else delete st.checked[id];
    save(); renderAll(false);
  });

  // Aufgeklappt/zugeklappt merken
  el.plan.addEventListener('toggle', function (e) {
    var d = e.target; if (d.matches && d.matches('details.phase')) openMap[d.getAttribute('data-phase')] = d.open;
  }, true);

  el.addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var txt = el.addText.value.trim();
    if (!txt) { el.addText.focus(); return; }
    var ph = el.addPhase.value;
    st.custom.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: txt.slice(0, 120), phase: ph });
    openMap[ph] = true;
    el.addText.value = '';
    save(); renderAll(false); el.addText.focus();
  });

  renderAll(true);
  setInterval(tick, 15000);
})();
