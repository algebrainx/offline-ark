/* Offline-Ark – Vorratsliste. Logik (Datum, Sortierung, Import): js/inventar-core.js */
(function () {
  'use strict';
  var OA = window.OA, I = window.OA_INVENTAR;

  var state = OA.store.get('inventar', null);
  if (!state || !Array.isArray(state.items)) state = { items: [], warn: 30, sort: 'exp' };
  state.items = state.items.map(I.sanitize).filter(Boolean);
  if ([7, 30, 90].indexOf(state.warn) < 0) state.warn = 30;
  if (['exp', 'name', 'cat'].indexOf(state.sort) < 0) state.sort = 'exp';

  var $ = OA.$;
  var el = {
    list: $('#list'), q: $('#q'), fcat: $('#fcat'), sort: $('#sort'), warn: $('#warn'),
    nBad: $('#nBad'), nWarn: $('#nWarn'), nTotal: $('#nTotal'), sumLine: $('#sumLine'),
    storeWarn: $('#storeWarn'), msg: $('#msg'), printView: $('#printView'),
    dlg: $('#dlg'), form: $('#form'), title: $('#dlgTitle'), err: $('#formErr'),
    fName: $('#fName'), fQty: $('#fQty'), fUnit: $('#fUnit'), fCat: $('#fCat'), fExp: $('#fExp'), fNote: $('#fNote'), fDelete: $('#fDelete'),
    impDlg: $('#impDlg'), impText: $('#impText')
  };
  var editId = null, pending = null;   // pending = Import wartet auf Auswahl

  el.fcat.innerHTML = '<option value="">Alle Kategorien</option>' + I.CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
  el.fCat.innerHTML = I.CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
  OA.segSet(el.sort, state.sort);
  OA.segSet(el.warn, String(state.warn));

  function save() {
    var ok = OA.store.set('inventar', state);
    el.storeWarn.hidden = ok;
    return ok;
  }

  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }

  function qtyText(it) { return OA.fmt(it.qty, 3); }

  /* ---------- Anzeige ---------- */
  function visibleItems() {
    var q = el.q.value.trim().toLowerCase(), cat = el.fcat.value;
    return I.sortItems(state.items, state.sort).filter(function (it) {
      if (cat && it.cat !== cat) return false;
      return !q || (it.name + ' ' + it.note).toLowerCase().indexOf(q) >= 0;
    });
  }

  function chips(it, today) {
    var s = I.status(it, today, state.warn), out = '<span class="chip">' + OA.esc(it.cat) + '</span>';
    if (s === 'none') return out;
    var d = I.daysUntil(it.exp, today);
    var cls = s === 'bad' ? ' bad' : s === 'warn' ? ' warn' : '';
    return out + '<span class="chip' + cls + '">' + OA.esc(cls ? I.dueText(d) : 'bis ' + I.dateDE(it.exp)) + '</span>' +
      (cls ? '<span class="chip">' + OA.esc(I.dateDE(it.exp)) + '</span>' : '');
  }

  function render() {
    var today = OA.today(), sum = I.summary(state.items, today, state.warn);
    el.nBad.textContent = sum.bad; el.nWarn.textContent = sum.warn; el.nTotal.textContent = sum.total;
    el.sumLine.textContent = !sum.total ? 'Noch nichts eingetragen.' :
      (sum.bad || sum.warn) ? sum.bad + ' abgelaufen, ' + sum.warn + ' bald fällig (Warnung ab ' + state.warn + ' Tagen vor Ablauf)' : 'Alles in Ordnung: nichts läuft bald ab.';

    var items = visibleItems();
    if (!state.items.length) {
      el.list.innerHTML = '<div class="empty">Noch keine Artikel.<br>Tippe auf „Artikel hinzufügen“.</div>';
    } else if (!items.length) {
      el.list.innerHTML = '<div class="empty">Nichts gefunden.</div>';
    } else {
      el.list.innerHTML = items.map(function (it) {
        var s = I.status(it, today, state.warn), cls = s === 'bad' || s === 'warn' ? ' ' + s : '';
        return '<article class="inv' + cls + '" data-id="' + OA.esc(it.id) + '">' +
          '<div class="inv-main"><div class="inv-name">' + OA.esc(it.name) + '</div>' +
          '<div class="inv-meta">' + chips(it, today) + '</div>' +
          (it.note ? '<div class="inv-note small muted">' + OA.esc(it.note) + '</div>' : '') + '</div>' +
          '<div class="inv-side"><div class="qty">' +
          '<button type="button" data-act="minus" aria-label="Weniger: ' + OA.esc(it.name) + '">−</button>' +
          '<div class="val" aria-live="polite">' + qtyText(it) + (it.unit ? '<small>' + OA.esc(it.unit) + '</small>' : '') + '</div>' +
          '<button type="button" data-act="plus" aria-label="Mehr: ' + OA.esc(it.name) + '">+</button></div>' +
          '<button type="button" class="btn sm" data-act="edit" aria-label="Bearbeiten: ' + OA.esc(it.name) + '">Bearbeiten</button></div>' +
          '</article>';
      }).join('');
    }
    renderPrint(today);
  }

  function renderPrint(today) {
    var rows = I.sortItems(state.items, 'cat').map(function (it) {
      var d = I.daysUntil(it.exp, today), flag = I.status(it, today, state.warn);
      return '<tr><td>' + OA.esc(it.name) + '</td><td>' + qtyText(it) + ' ' + OA.esc(it.unit) + '</td><td>' + OA.esc(it.cat) + '</td><td>' +
        OA.esc(I.dateDE(it.exp)) + (flag === 'bad' || flag === 'warn' ? ' (' + OA.esc(I.dueText(d)) + ')' : '') + '</td><td>' + OA.esc(it.note) + '</td></tr>';
    }).join('');
    el.printView.innerHTML = '<h1>Vorratsliste</h1><p>Stand: ' + OA.esc(I.dateDE(today)) + ' · ' + state.items.length + ' Artikel</p>' +
      '<table><thead><tr><th>Artikel</th><th>Menge</th><th>Kategorie</th><th>Ablauf</th><th>Notiz</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---------- Hinzufügen / Bearbeiten ---------- */
  function showError(t) { el.err.textContent = t; el.err.hidden = !t; }

  function openForm(id) {
    var it = id ? state.items.filter(function (x) { return x.id === id; })[0] : null;
    editId = it ? it.id : null;
    el.title.textContent = it ? 'Artikel bearbeiten' : 'Artikel hinzufügen';
    el.fName.value = it ? it.name : '';
    el.fQty.value = it ? String(it.qty).replace('.', ',') : '1';
    el.fUnit.value = it ? it.unit : '';
    el.fCat.value = it ? it.cat : (el.fcat.value || I.CATS[0]);
    el.fExp.value = it ? it.exp : '';
    el.fNote.value = it ? it.note : '';
    el.fDelete.hidden = !it;
    showError('');
    openDlg(el.dlg);
    el.fName.focus();
  }

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var qty = OA.num(el.fQty.value);
    if (!el.fName.value.trim()) { showError('Bitte einen Namen eingeben.'); el.fName.focus(); return; }
    if (isNaN(qty) || qty < 0) { showError('Bitte eine Menge ab 0 eingeben.'); el.fQty.focus(); return; }
    if (el.fExp.value && isNaN(I.parseDate(el.fExp.value))) { showError('Das Ablaufdatum ist ungültig.'); return; }
    var it = I.sanitize({ id: editId || I.newId(), name: el.fName.value, qty: qty, unit: el.fUnit.value, cat: el.fCat.value, exp: el.fExp.value, note: el.fNote.value });
    var pos = -1;
    state.items.forEach(function (x, i) { if (x.id === editId) pos = i; });
    if (pos >= 0) state.items[pos] = it; else state.items.push(it);
    save(); closeDlg(el.dlg); render();
  });
  el.fDelete.addEventListener('click', function () {
    var it = state.items.filter(function (x) { return x.id === editId; })[0];
    if (!it || !confirm('„' + it.name + '“ wirklich löschen?')) return;
    state.items = state.items.filter(function (x) { return x.id !== editId; });
    save(); closeDlg(el.dlg); render();
  });
  $('#fCancel').addEventListener('click', function () { closeDlg(el.dlg); });
  $('#add').addEventListener('click', function () { openForm(null); });

  /* ---------- Liste: + / − / Bearbeiten ---------- */
  el.list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var row = b.closest('.inv'), id = row.getAttribute('data-id'), act = b.getAttribute('data-act');
    if (act === 'edit') { openForm(id); return; }
    state.items.forEach(function (it) {
      if (it.id !== id) return;
      it.qty = Math.max(0, Math.round((it.qty + (act === 'plus' ? 1 : -1)) * 1000) / 1000);
    });
    save(); render();
    var again = OA.$('.inv[data-id="' + id + '"] [data-act="' + act + '"]', el.list);   // Fokus behalten
    if (again) again.focus();
  });

  /* ---------- Filter, Sortierung, Schwelle ---------- */
  el.q.addEventListener('input', render);
  el.fcat.addEventListener('change', render);
  el.sort.addEventListener('input', function () { state.sort = OA.segVal(el.sort); save(); render(); });
  el.warn.addEventListener('input', function () { state.warn = Number(OA.segVal(el.warn)); save(); render(); });

  /* ---------- Export / Import / Druck ---------- */
  function say(t) { el.msg.textContent = t; }

  $('#export').addEventListener('click', function () {
    OA.download('vorratsliste-' + OA.today() + '.json',
      JSON.stringify({ app: 'offline-ark-inventar', version: 1, exported: OA.today(), items: state.items }, null, 2));
    say('Export gestartet: ' + state.items.length + ' Artikel.');
  });
  $('#import').addEventListener('click', function () {
    OA.pickFile('.json,application/json', function (text) {
      try { pending = I.parseImport(text); } catch (err) { pending = null; say('Import nicht möglich: ' + err.message); return; }
      el.impText.textContent = pending.items.length + ' Artikel gefunden' + (pending.skipped ? ' (' + pending.skipped + ' ungültige übersprungen)' : '') +
        '. Deine Liste hat jetzt ' + state.items.length + ' Artikel.';
      openDlg(el.impDlg);
    });
  });
  function finishImport(replace) {
    if (!pending) return;
    state.items = replace ? pending.items : I.merge(state.items, pending.items);
    say(pending.items.length + ' Artikel ' + (replace ? 'übernommen (Liste ersetzt).' : 'zusammengeführt.'));
    pending = null; save(); closeDlg(el.impDlg); render();
  }
  $('#impMerge').addEventListener('click', function () { finishImport(false); });
  $('#impReplace').addEventListener('click', function () {
    if (!state.items.length || confirm('Deine jetzige Liste wird ersetzt. Fortfahren?')) finishImport(true);
  });
  $('#impCancel').addEventListener('click', function () { pending = null; closeDlg(el.impDlg); });
  $('#print').addEventListener('click', function () { window.print(); });

  render();
  save();
})();
