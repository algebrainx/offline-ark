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
    kontakte: { add: 'Kontakt hinzufügen', edit: 'Kontakt bearbeiten', nameLabel: 'Name', empty: ['Noch keine Kontakte.', 'Trage die wichtigsten Menschen ein – mit Telefonnummer.'] },
    treffpunkte: { add: 'Treffpunkt hinzufügen', edit: 'Treffpunkt bearbeiten', nameLabel: 'Bezeichnung des Treffpunkts', empty: ['Noch keine Treffpunkte.', 'Lege mindestens einen fest, den alle kennen.'] },
    adressen: { add: 'Adresse hinzufügen', edit: 'Adresse bearbeiten', nameLabel: 'Name', empty: ['Noch keine Adressen.', 'Z. B. Hausarzt, nächste Apotheke, Krankenhaus.'] }
  };
  var editType = null, editId = null, pending = null;

  $('#f-type').innerHTML = K.TYPES.map(function (t) { return '<option value="' + t.id + '">' + OA.esc(OA.t(t.label)) + '</option>'; }).join('');
  $('#f-cat').innerHTML = K.ADDR_CATS.map(function (c) { return '<option value="' + OA.esc(c) + '">' + OA.esc(OA.t(c)) + '</option>'; }).join('');

  // Die Übersetzungs-Engine überspringt <textarea>: Platzhalter hier selbst übersetzen
  OA.$$('textarea[placeholder]').forEach(function (ta) { ta.placeholder = OA.t(ta.getAttribute('placeholder')); });

  function sec() { return OA.segVal(el.sec); }
  function persist(key) {
    var ok = OA.store.set(key, data[key]);
    el.storeWarn.hidden = ok;
    return ok;
  }
  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }
  function typeLabel(id) { var t = K.TYPES.filter(function (x) { return x.id === id; })[0]; return OA.t(t ? t.label : id); }
  function find(type, id) { return data[type].filter(function (x) { return x.id === id; })[0] || null; }

  /* ---------- Anzeige ---------- */
  function phoneBtn(phone) {
    var href = K.telHref(phone);
    return href ? '<a class="btn sm ltr" data-notranslate href="' + OA.esc(href) + '" aria-label="' + OA.esc(OA.t('Anrufen: {0}', [phone])) + '">' + OA.esc(phone) + '</a>' : '';
  }
  function joinText() { return Array.prototype.filter.call(arguments, Boolean).map(OA.esc).join('\n'); }

  function rowHtml(type, it) {
    var chips = '', txt = '', phone = '', lead = '';
    if (type === 'kontakte') {
      lead = '<button type="button" class="star" data-act="star" aria-pressed="' + it.star + '" aria-label="' +
        OA.esc(OA.t(it.star ? 'Nicht mehr wichtig: {0}' : 'Als wichtig markieren: {0}', [it.name])) + '">' + (it.star ? '★' : '☆') + '</button>';
      chips = it.rel ? '<span class="chip" data-notranslate>' + OA.esc(it.rel) + '</span>' : '';
      txt = joinText(it.note); phone = phoneBtn(it.phone);
    } else if (type === 'treffpunkte') {
      chips = '<span class="chip">' + OA.esc(typeLabel(it.type)) + '</span>' + (it.coords ? '<span class="chip ltr" data-notranslate>' + OA.esc(it.coords) + '</span>' : '');
      txt = joinText(it.place, it.note);
    } else {
      chips = '<span class="chip">' + OA.esc(OA.t(it.cat)) + '</span>';
      txt = joinText(it.address, it.note); phone = phoneBtn(it.phone);
    }
    return '<article class="row" data-id="' + OA.esc(it.id) + '">' + lead +
      '<div class="main"><div class="name" data-notranslate>' + OA.esc(it.name) + '</div>' + (chips ? '<div class="meta">' + chips + '</div>' : '') +
      (txt ? '<div class="txt" data-notranslate>' + txt + '</div>' : '') + '</div>' +
      '<div class="acts">' + phone + '<button type="button" class="btn sm" data-act="edit" aria-label="' + OA.esc(OA.t('Bearbeiten: {0}', [it.name])) + '">' + OA.esc(OA.t('Bearbeiten')) + '</button></div></article>';
  }

  function ordered(type) {
    if (type === 'kontakte') return K.displayContacts(data.kontakte);
    return type === 'treffpunkte' ? K.sortMeetings(data.treffpunkte) : K.sortAddresses(data.adressen);
  }

  function render() {
    var type = sec(), items = ordered(type);
    el.add.textContent = OA.t(TEXT[type].add);
    el.sos.hidden = type !== 'kontakte';
    el.tips.hidden = type !== 'treffpunkte';
    el.list.innerHTML = items.length ? items.map(function (it) { return rowHtml(type, it); }).join('') :
      '<div class="empty">' + OA.esc(OA.t(TEXT[type].empty[0])) + '<br>' + OA.esc(OA.t(TEXT[type].empty[1])) + '</div>';
    renderPrint();
  }

  function renderPrint() {
    var e = OA.esc, t = OA.t, p = function (html) { return '<p>' + html + '</p>'; };
    var nt = function (s) { return '<span data-notranslate>' + e(s) + '</span>'; };   // Nutzereingaben nie übersetzen
    var d = new Date().toLocaleDateString(OA.locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/[\u200e\u200f]/g, '');
    var out = '<h1>' + e(t('Notfallkarte')) + '</h1><p class="small sub">' + e(t('Stand: {0} · Offline-Ark', [d])) + '</p>';
    out += '<h2>' + e(t('Notruf')) + '</h2><div class="cols">' +
      p('<strong class="ltr">112</strong> ' + e(t('Feuerwehr, Rettungsdienst'))) + p('<strong class="ltr">110</strong> ' + e(t('Polizei'))) +
      p('<strong class="ltr">116 117</strong> ' + e(t('Ärztlicher Bereitschaftsdienst'))) + p('<strong class="ltr">116 123</strong> ' + e(t('Telefonseelsorge'))) +
      p('<strong>' + e(t('Giftinformationszentrale:')) + '</strong> ______________________') + '</div>';
    if (data.kontakte.length) out += '<h2>' + e(t('Kontakte')) + '</h2><div class="cols">' + K.displayContacts(data.kontakte).map(function (c) {
      return p((c.star ? '★ ' : '') + '<strong>' + nt(c.name) + '</strong>' + (c.rel ? ' (' + nt(c.rel) + ')' : '') + (c.phone ? ' · <span class="ltr">' + nt(c.phone) + '</span>' : '') +
        (c.note ? '<br><span class="sub">' + nt(c.note) + '</span>' : ''));
    }).join('') + '</div>';
    if (data.treffpunkte.length) out += '<h2>' + e(t('Treffpunkte')) + '</h2><div class="cols">' + K.sortMeetings(data.treffpunkte).map(function (m) {
      return p('<strong>' + nt(m.name) + '</strong> <span class="sub">(' + e(typeLabel(m.type)) + ')</span>' + (m.place ? '<br>' + nt(m.place) : '') +
        (m.coords ? '<br>' + e(t('Koordinaten:')) + ' <span class="ltr">' + nt(m.coords) + '</span>' : '') + (m.note ? '<br><span class="sub">' + nt(m.note) + '</span>' : ''));
    }).join('') + '</div>';
    if (data.adressen.length) out += '<h2>' + e(t('Adressen')) + '</h2><div class="cols">' + K.sortAddresses(data.adressen).map(function (a) {
      return p('<strong>' + nt(a.name) + '</strong> <span class="sub">(' + e(t(a.cat)) + ')</span>' + (a.address ? '<br>' + nt(a.address) : '') +
        (a.phone ? '<br><span class="ltr">' + nt(a.phone) + '</span>' : '') + (a.note ? '<br><span class="sub">' + nt(a.note) + '</span>' : ''));
    }).join('') + '</div>';
    el.printView.innerHTML = out;
  }

  /* ---------- Formular ---------- */
  function showError(t) { el.err.textContent = t; el.err.hidden = !t; }

  function openForm(type, id) {
    var it = id ? find(type, id) : null;
    editType = type; editId = it ? it.id : null;
    el.title.textContent = OA.t(it ? TEXT[type].edit : TEXT[type].add);
    $('#l-name').textContent = OA.t(TEXT[type].nameLabel);
    OA.$$('[data-for]', el.form).forEach(function (f) { f.hidden = f.getAttribute('data-for').split(' ').indexOf(type) < 0; });
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
      var wrap = inp.closest('[data-for]');
      if (wrap.hidden) return;
      raw[inp.getAttribute('data-k')] = inp.type === 'checkbox' ? inp.checked : inp.value;
    });
    var it = K.sanitize[editType](raw);
    if (!it) { showError(OA.t('Bitte einen Namen eingeben.')); $('#f-name').focus(); return; }
    var list = data[editType], pos = -1;
    list.forEach(function (x, i) { if (x.id === it.id) pos = i; });
    if (pos >= 0) list[pos] = it; else list.push(it);
    persist(editType); closeDlg(el.dlg); render();
  });
  $('#fCancel').addEventListener('click', function () { closeDlg(el.dlg); });
  el.fDelete.addEventListener('click', function () {
    var it = find(editType, editId);
    if (!it || !confirm(OA.t('„{0}“ wirklich löschen?', [it.name]))) return;
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
    say(OA.t('Export gestartet.'));
  });
  $('#import').addEventListener('click', function () {
    OA.pickFile('.json,application/json', function (text) {
      try { pending = K.parseImport(text); } catch (err) { pending = null; say(OA.t('Import nicht möglich: {0}', [OA.t(err.message)])); return; }
      var args = [pending.kontakte.length, pending.treffpunkte.length, pending.adressen.length, pending.skipped];
      el.impText.textContent = pending.skipped ? OA.t('{0} Kontakte, {1} Treffpunkte, {2} Adressen gefunden ({3} ungültige übersprungen).', args)
        : OA.t('{0} Kontakte, {1} Treffpunkte, {2} Adressen gefunden.', args);
      openDlg(el.impDlg);
    });
  });
  function finishImport(replace) {
    if (!pending) return;
    K.KEYS.forEach(function (k) { data[k] = replace ? pending[k] : K.merge(data[k], pending[k]); persist(k); });
    say(OA.t(replace ? 'Import abgeschlossen (ersetzt).' : 'Import abgeschlossen (zusammengeführt).'));
    pending = null; closeDlg(el.impDlg); render();
  }
  $('#impMerge').addEventListener('click', function () { finishImport(false); });
  $('#impReplace').addEventListener('click', function () {
    var any = K.KEYS.some(function (k) { return data[k].length; });
    if (!any || confirm(OA.t('Deine jetzigen Einträge werden ersetzt. Fortfahren?'))) finishImport(true);
  });
  $('#impCancel').addEventListener('click', function () { pending = null; closeDlg(el.impDlg); });
  $('#print').addEventListener('click', function () { window.print(); });

  render();
})();
