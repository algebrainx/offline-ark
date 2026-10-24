/* Offline-Ark – Checklisten zum Abhaken. Inhalte: data/checklisten.js */
(function () {
  'use strict';
  var OA = window.OA, LISTS = window.OA_CHECKLISTEN, $ = OA.$;

  // Gespeicherter Zustand: checked = { punktId: true }, custom = { listenId: [{ id, text }] }, last = zuletzt gewählte Liste
  var st = OA.store.get('checklisten', null);
  if (!st || typeof st !== 'object') st = {};
  if (!st.checked || typeof st.checked !== 'object' || Array.isArray(st.checked)) st.checked = {};
  if (!st.custom || typeof st.custom !== 'object' || Array.isArray(st.custom)) st.custom = {};
  LISTS.forEach(function (l) {
    var c = st.custom[l.id];
    st.custom[l.id] = Array.isArray(c) ? c.filter(function (x) { return x && typeof x.id === 'string' && typeof x.text === 'string' && x.text.trim(); }) : [];
  });
  var cur = LISTS.some(function (l) { return l.id === st.last; }) ? st.last : LISTS[0].id;

  var el = {
    picks: $('#picks'), progText: $('#progText'), progPct: $('#progPct'), bar: $('#bar'), barWrap: $('#barWrap'), intro: $('#intro'),
    sections: $('#sections'), customList: $('#customList'), customN: $('#customN'), addForm: $('#addForm'), addText: $('#addText'),
    storeWarn: $('#storeWarn'), printView: $('#printView')
  };

  function list() { return LISTS.filter(function (l) { return l.id === cur; })[0]; }
  function save() { st.last = cur; el.storeWarn.hidden = OA.store.set('checklisten', st); }

  /** Alle Punkte einer Liste: feste + eigene. */
  function allItems(l) {
    var out = [];
    l.sections.forEach(function (s) { out = out.concat(s.items); });
    return out.concat(st.custom[l.id]);
  }
  function count(l) {
    var items = allItems(l), done = items.filter(function (it) { return st.checked[it.id]; }).length;
    return { done: done, total: items.length };
  }

  function row(it, custom) {
    // Eigene Punkte sind Nutzertext und werden nie übersetzt; feste Punkte kommen aus dem Wörterbuch
    var label = custom ? '<span data-notranslate>' + OA.esc(it.text) + '</span>' : '<span>' + OA.esc(OA.t(it.text)) + '</span>';
    var cb = '<label class="check"><input type="checkbox" data-id="' + OA.esc(it.id) + '"' + (st.checked[it.id] ? ' checked' : '') + '>' + label + '</label>';
    return custom ? '<div class="crow">' + cb + '<button type="button" class="x" data-del="' + OA.esc(it.id) + '" aria-label="' + OA.esc(OA.t('Punkt entfernen: {0}', [it.text])) + '">✕</button></div>' : cb;
  }

  /* ---------- Anzeige ---------- */
  function renderPicks() {
    el.picks.innerHTML = LISTS.map(function (l) {
      var c = count(l);
      return '<button type="button" class="pick" data-list="' + l.id + '" aria-pressed="' + (l.id === cur) + '"><span class="t">' + OA.esc(OA.t(l.title)) +
        '</span><span class="c">' + OA.esc(OA.t('{0} von {1}', [c.done, c.total])) + '</span></button>';
    }).join('');
  }

  function updateProgress() {
    var c = count(list()), pct = c.total ? Math.round(c.done / c.total * 100) : 0;
    el.progText.textContent = OA.t('{0} von {1}', [c.done, c.total]);
    el.progPct.textContent = OA.t('{0} % erledigt', [pct]);
    el.bar.style.width = pct + '%';
    el.barWrap.setAttribute('aria-valuenow', pct);
    OA.$$('.pick', el.picks).forEach(function (b) {
      var l = LISTS.filter(function (x) { return x.id === b.getAttribute('data-list'); })[0], n = count(l);
      OA.$('.c', b).textContent = OA.t('{0} von {1}', [n.done, n.total]);
    });
    OA.$$('[data-sec]', el.sections).forEach(function (s) {
      var boxes = OA.$$('input[type="checkbox"]', s);
      OA.$('.n', s).textContent = boxes.filter(function (b) { return b.checked; }).length + ' / ' + boxes.length;
    });
  }

  function renderPrint(l) {
    var li = function (txt, custom) { return '<li><span class="box">☐</span>' + (custom ? '<span data-notranslate>' + OA.esc(txt) + '</span>' : OA.esc(OA.t(txt))) + '</li>'; };
    var secs = l.sections.map(function (s) {
      return '<h2>' + OA.esc(OA.t(s.title)) + '</h2><ul>' + s.items.map(function (it) { return li(it.text, false); }).join('') + '</ul>';
    }).join('');
    var custom = st.custom[l.id];
    if (custom.length) secs += '<h2>' + OA.esc(OA.t('Eigene Punkte')) + '</h2><ul>' + custom.map(function (it) { return li(it.text, true); }).join('') + '</ul>';
    el.printView.innerHTML = '<h1>' + OA.esc(OA.t('{0} – Checkliste', [OA.t(l.title)])) + '</h1><p>' + OA.esc(OA.t(l.intro)) + '</p><div class="cols">' + secs + '</div>' +
      '<p class="src">' + OA.esc(OA.t('Orientierung: BBK-Ratgeber „Vorsorgen für Krisen und Katastrophen“ (bbk.bund.de). © BBK, Inhalte hier in eigenen Worten zusammengefasst.')) + '</p>';
  }

  function renderCustom() {
    var c = st.custom[cur];
    el.customList.innerHTML = c.map(function (it) { return row(it, true); }).join('');
    el.customN.textContent = c.length ? c.filter(function (it) { return st.checked[it.id]; }).length + ' / ' + c.length : '';
  }

  function render() {
    var l = list();
    el.intro.innerHTML = '<strong>' + OA.esc(OA.t(l.title)) + '</strong>' + OA.esc(OA.t(l.intro));
    el.sections.innerHTML = l.sections.map(function (s) {
      return '<section class="card" data-sec><div class="sec-head"><h2>' + OA.esc(OA.t(s.title)) + '</h2><span class="n"></span></div>' +
        s.items.map(function (it) { return row(it, false); }).join('') + '</section>';
    }).join('');
    renderCustom();
    renderPicks();
    updateProgress();
    renderPrint(l);
  }

  /* ---------- Bedienung ---------- */
  el.picks.addEventListener('click', function (e) {
    var b = e.target.closest('.pick'); if (!b) return;
    cur = b.getAttribute('data-list'); save(); render();
  });

  document.addEventListener('change', function (e) {
    var cb = e.target;
    if (!cb.matches || !cb.matches('input[type="checkbox"][data-id]')) return;
    var id = cb.getAttribute('data-id');
    if (cb.checked) st.checked[id] = true; else delete st.checked[id];
    save(); updateProgress();
    var n = st.custom[cur];
    el.customN.textContent = n.length ? n.filter(function (it) { return st.checked[it.id]; }).length + ' / ' + n.length : '';
  });

  el.customList.addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var id = b.getAttribute('data-del');
    st.custom[cur] = st.custom[cur].filter(function (it) { return it.id !== id; });
    delete st.checked[id];
    save(); render();
  });

  el.addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = el.addText.value.trim();
    if (!t) { el.addText.focus(); return; }
    st.custom[cur].push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: t.slice(0, 120) });
    el.addText.value = '';
    save(); render(); el.addText.focus();
  });

  $('#reset').addEventListener('click', function () {
    var l = list();
    if (!count(l).done) return;
    if (!confirm(OA.t('Alle Häkchen in der Liste „{0}“ wirklich zurücksetzen? Deine eigenen Punkte bleiben erhalten.', [OA.t(l.title)]))) return;
    allItems(l).forEach(function (it) { delete st.checked[it.id]; });
    save(); render();
  });
  $('#print').addEventListener('click', function () { window.print(); });

  render();
})();
