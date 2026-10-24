/* Offline-Ark – Kontakte, Treffpunkte, Adressen. Logik (Prüfen, Import, Reihenfolge): js/kontakte-core.js */
(function () {
  'use strict';
  var OA = window.OA, K = window.OA_KONTAKTE, $ = OA.$;

  var data = {};
  K.KEYS.forEach(function (k) {
    var raw = OA.store.get(k, []);
    data[k] = Array.isArray(raw) ? raw.map(K.sanitize[k]).filter(Boolean) : [];
  });

  var el = {
    sec: $('#sec'), add: $('#add'), list: $('#list'), sos: $('#sosCard'), tips: $('#tipsCard'), storeWarn: $('#storeWarn'), msg: $('#msg'),
    printView: $('#printView'), dlg: $('#dlg'), form: $('#form'), title: $('#dlgTitle'), err: $('#formErr'), moveRow: $('#moveRow'),
    fDelete: $('#fDelete'), impDlg: $('#impDlg'), impText: $('#impText')
  };
  var TEXT = {
    kontakte: { add: 'Kontakt hinzufügen', title: 'Kontakt', nameLabel: 'Name', empty: 'Noch keine Kontakte.<br>Trage die wichtigsten Menschen ein – mit Telefonnummer.' },
    treffpunkte: { add: 'Treffpunkt hinzufügen', title: 'Treffpunkt', nameLabel: 'Bezeichnung des Treffpunkts', empty: 'Noch keine Treffpunkte.<br>Lege mindestens einen fest, den alle kennen.' },
    adressen: { add: 'Adresse hinzufügen', title: 'Adresse', nameLabel: 'Name', empty: 'Noch keine Adressen.<br>Z. B. Hausarzt, nächste Apotheke, Krankenhaus.' }
  };
  var editType = null, editId = null, pending = null;

  $('#f-type').innerHTML = K.TYPES.map(function (t) { return '<option value="' + t.id + '">' + OA.esc(t.label) + '</option>'; }).join('');
  $('#f-cat').innerHTML = K.ADDR_CATS.map(function (c) { return '<option>' + OA.esc(c) + '</option>'; }).join('');

  function sec() { return OA.segVal(el.sec); }
  function persist(key) {
    var ok = OA.store.set(key, data[key]);
    el.storeWarn.hidden = ok;
    return ok;
  }
  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }
  function typeLabel(id) { var t = K.TYPES.filter(function (x) { return x.id === id; })[0]; return t ? t.label : id; }
  function find(type, id) { return data[type].filter(function (x) { return x.id === id; })[0] || null; }

  /* ---------- Anzeige ---------- */
  function phoneBtn(phone) {
    var href = K.telHref(phone);
    return href ? '<a class="btn sm" href="' + OA.esc(href) + '" aria-label="Anrufen: ' + OA.esc(phone) + '">' + OA.esc(phone) + '</a>' : '';
  }
  function joinText() { return Array.prototype.filter.call(arguments, Boolean).map(OA.esc).join('\n'); }

  function rowHtml(type, it) {
    var chips = '', txt = '', phone = '', lead = '';
    if (type === 'kontakte') {
      lead = '<button type="button" class="star" data-act="star" aria-pressed="' + it.star + '" aria-label="' + (it.star ? 'Nicht mehr wichtig: ' : 'Als wichtig markieren: ') + OA.esc(it.name) + '">' + (it.star ? '★' : '☆') + '</button>';
      chips = it.rel ? '<span class="chip">' + OA.esc(it.rel) + '</span>' : '';
      txt = joinText(it.note); phone = phoneBtn(it.phone);
    } else if (type === 'treffpunkte') {
      chips = '<span class="chip">' + OA.esc(typeLabel(it.type)) + '</span>' + (it.coords ? '<span class="chip">' + OA.esc(it.coords) + '</span>' : '');
      txt = joinText(it.place, it.note);
    } else {
      chips = '<span class="chip">' + OA.esc(it.cat) + '</span>';
      txt = joinText(it.address, it.note); phone = phoneBtn(it.phone);
    }
    return '<article class="row" data-id="' + OA.esc(it.id) + '">' + lead +
      '<div class="main"><div class="name">' + OA.esc(it.name) + '</div>' + (chips ? '<div class="meta">' + chips + '</div>' : '') +
      (txt ? '<div class="txt">' + txt + '</div>' : '') + '</div>' +
      '<div class="acts">' + phone + '<button type="button" class="btn sm" data-act="edit" aria-label="Bearbeiten: ' + OA.esc(it.name) + '">Bearbeiten</button></div></article>';
  }

  function ordered(type) {
    if (type === 'kontakte') return K.displayContacts(data.kontakte);
    return type === 'treffpunkte' ? K.sortMeetings(data.treffpunkte) : K.sortAddresses(data.adressen);
  }

  function render() {
    var type = sec(), items = ordered(type);
    el.add.textContent = TEXT[type].add;
    el.sos.hidden = type !== 'kontakte';
    el.tips.hidden = type !== 'treffpunkte';
    el.list.innerHTML = items.length ? items.map(function (it) { return rowHtml(type, it); }).join('') : '<div class="empty">' + TEXT[type].empty + '</div>';
    renderPrint();
  }

  function renderPrint() {
    var e = OA.esc, p = function (html) { return '<p>' + html + '</p>'; }, today = new Date();
    var d = OA.pad(today.getDate()) + '.' + OA.pad(today.getMonth() + 1) + '.' + today.getFullYear();
    var out = '<h1>Notfallkarte</h1><p class="small sub">Stand: ' + d + ' · Offline-Ark</p>';
    out += '<h2>Notruf</h2><div class="cols">' +
      p('<strong>112</strong> Feuerwehr, Rettungsdienst') + p('<strong>110</strong> Polizei') +
      p('<strong>116 117</strong> Ärztlicher Bereitschaftsdienst') + p('<strong>116 123</strong> Telefonseelsorge') +
      p('<strong>Giftinformationszentrale:</strong> ______________________') + '</div>';
    if (data.kontakte.length) out += '<h2>Kontakte</h2><div class="cols">' + K.displayContacts(data.kontakte).map(function (c) {
      return p((c.star ? '★ ' : '') + '<strong>' + e(c.name) + '</strong>' + (c.rel ? ' (' + e(c.rel) + ')' : '') + (c.phone ? ' · ' + e(c.phone) : '') +
        (c.note ? '<br><span class="sub">' + e(c.note) + '</span>' : ''));
    }).join('') + '</div>';
    if (data.treffpunkte.length) out += '<h2>Treffpunkte</h2><div class="cols">' + K.sortMeetings(data.treffpunkte).map(function (t) {
      return p('<strong>' + e(t.name) + '</strong> <span class="sub">(' + e(typeLabel(t.type)) + ')</span>' + (t.place ? '<br>' + e(t.place) : '') +
        (t.coords ? '<br>Koordinaten: ' + e(t.coords) : '') + (t.note ? '<br><span class="sub">' + e(t.note) + '</span>' : ''));
    }).join('') + '</div>';
    if (data.adressen.length) out += '<h2>Adressen</h2><div class="cols">' + K.sortAddresses(data.adressen).map(function (a) {
      return p('<strong>' + e(a.name) + '</strong> <span class="sub">(' + e(a.cat) + ')</span>' + (a.address ? '<br>' + e(a.address) : '') +
        (a.phone ? '<br>' + e(a.phone) : '') + (a.note ? '<br><span class="sub">' + e(a.note) + '</span>' : ''));
    }).join('') + '</div>';
    el.printView.innerHTML = out;
  }

  /* ---------- Formular ---------- */
  function showError(t) { el.err.textContent = t; el.err.hidden = !t; }

  function openForm(type, id) {
    var it = id ? find(type, id) : null;
    editType = type; editId = it ? it.id : null;
    el.title.textContent = TEXT[type].title + (it ? ' bearbeiten' : ' hinzufügen');
    $('#l-name').textContent = TEXT[type].nameLabel;
    OA.$$('[data-t]', el.form).forEach(function (f) { f.hidden = f.getAttribute('data-t').split(' ').indexOf(type) < 0; });
    OA.$$('[data-k]', el.form).forEach(function (inp) {
      var k = inp.getAttribute('data-k');
      if (inp.type === 'checkbox') inp.checked = !!(it && it[k]);
      else if (it && it[k] != null) inp.value = it[k];
      else inp.value = inp.tagName === 'SELECT' ? inp.options[0].value : '';
    });
    el.moveRow.hidden = !(it && type === 'kontakte' && data.kontakte.length > 1);
    el.fDelete.hidden = !it;
    showError('');
    openDlg(el.dlg);
    $('#f-name').focus();
  }

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = { id: editId || K.newId() };
    OA.$$('[data-k]', el.form).forEach(function (inp) {
      var wrap = inp.closest('[data-t]');
      if (wrap.hidden) return;
      raw[inp.getAttribute('data-k')] = inp.type === 'checkbox' ? inp.checked : inp.value;
    });
    var it = K.sanitize[editType](raw);
    if (!it) { showError('Bitte einen Namen eingeben.'); $('#f-name').focus(); return; }
    var list = data[editType], pos = -1;
    list.forEach(function (x, i) { if (x.id === it.id) pos = i; });
    if (pos >= 0) list[pos] = it; else list.push(it);
    persist(editType); closeDlg(el.dlg); render();
  });
  $('#fCancel').addEventListener('click', function () { closeDlg(el.dlg); });
  el.fDelete.addEventListener('click', function () {
    var it = find(editType, editId);
    if (!it || !confirm('„' + it.name + '“ wirklich löschen?')) return;
    data[editType] = data[editType].filter(function (x) { return x.id !== editId; });
    persist(editType); closeDlg(el.dlg); render();
  });
  function move(dir) { data.kontakte = K.moveContact(data.kontakte, editId, dir); persist('kontakte'); render(); }
  $('#mUp').addEventListener('click', function () { move(-1); });
  $('#mDown').addEventListener('click', function () { move(1); });

  /* ---------- Liste ---------- */
  el.sec.addEventListener('input', render);
  el.add.addEventListener('click', function () { openForm(sec(), null); });
  el.list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var id = b.closest('.row').getAttribute('data-id');
    if (b.getAttribute('data-act') === 'edit') { openForm(sec(), id); return; }
    var c = find('kontakte', id);
    if (c) { c.star = !c.star; persist('kontakte'); render(); var again = OA.$('.row[data-id="' + id + '"] .star', el.list); if (again) again.focus(); }
  });

  /* ---------- Export / Import / Druck ---------- */
  function say(t) { el.msg.textContent = t; }
  $('#export').addEventListener('click', function () {
    OA.download('kontakte-' + OA.today() + '.json', JSON.stringify({ app: 'offline-ark-kontakte', version: 1, exported: OA.today(),
      kontakte: data.kontakte, treffpunkte: data.treffpunkte, adressen: data.adressen }, null, 2));
    say('Export gestartet.');
  });
  $('#import').addEventListener('click', function () {
    OA.pickFile('.json,application/json', function (text) {
      try { pending = K.parseImport(text); } catch (err) { pending = null; say('Import nicht möglich: ' + err.message); return; }
      el.impText.textContent = pending.kontakte.length + ' Kontakte, ' + pending.treffpunkte.length + ' Treffpunkte, ' + pending.adressen.length + ' Adressen gefunden' +
        (pending.skipped ? ' (' + pending.skipped + ' ungültige übersprungen)' : '') + '.';
      openDlg(el.impDlg);
    });
  });
  function finishImport(replace) {
    if (!pending) return;
    K.KEYS.forEach(function (k) { data[k] = replace ? pending[k] : K.merge(data[k], pending[k]); persist(k); });
    say(replace ? 'Import abgeschlossen (ersetzt).' : 'Import abgeschlossen (zusammengeführt).');
    pending = null; closeDlg(el.impDlg); render();
  }
  $('#impMerge').addEventListener('click', function () { finishImport(false); });
  $('#impReplace').addEventListener('click', function () {
    var any = K.KEYS.some(function (k) { return data[k].length; });
    if (!any || confirm('Deine jetzigen Einträge werden ersetzt. Fortfahren?')) finishImport(true);
  });
  $('#impCancel').addEventListener('click', function () { pending = null; closeDlg(el.impDlg); });
  $('#print').addEventListener('click', function () { window.print(); });

  render();
})();
