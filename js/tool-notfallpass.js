/* Offline-Ark – Notfallpass. Logik (Prüfen, Import, Textform): js/notfallpass-core.js */
(function () {
  'use strict';
  var OA = window.OA, P = window.OA_NOTFALLPASS, $ = OA.$;

  /* ---------- Zustand ---------- */
  var raw = OA.store.get('notfallpass', null);
  var state = { people: [], current: null, bilingual: null, copies: 2 };
  if (raw && Array.isArray(raw.people)) {
    state.people = raw.people.map(P.sanitize).filter(Boolean);
    if (typeof raw.bilingual === 'boolean') state.bilingual = raw.bilingual;
    if (raw.copies >= 1 && raw.copies <= 4) state.copies = Math.round(raw.copies);
    state.current = raw.current;
  }
  if (!state.people.length) state.people.push(P.blank());
  if (!state.people.some(function (p) { return p.id === state.current; })) state.current = state.people[0].id;

  var el = {
    people: $('#people'), contactBoxes: $('#contactBoxes'), storeWarn: $('#storeWarn'), saveState: $('#saveState'),
    pvFront: $('#pvFront .preview-box'), pvBack: $('#pvBack .preview-box'), fitWarn: $('#fitWarn'),
    bilingual: $('#bilingual'), bilingualRow: $('#bilingualRow'), copies: $('#copies'), copyMsg: $('#copyMsg'), copybox: $('#copybox'),
    printCards: $('#printCards'), printA4: $('#printA4'), msg: $('#msg'), impDlg: $('#impDlg'), impText: $('#impText')
  };
  var saveTimer = null, pending = null;

  function person() { return state.people.filter(function (p) { return p.id === state.current; })[0]; }
  function secondOn() { return OA.lang !== 'de' && (state.bilingual === null ? true : state.bilingual); }
  function t(k, a) { return OA.t(k, a); }
  function ymd(s) { return P.dateLocal(s, OA.locale); }

  // Die Engine überspringt <textarea>: Platzhalter hier selbst übersetzen
  OA.$$('textarea[placeholder]').forEach(function (ta) { ta.placeholder = t(ta.getAttribute('placeholder')); });

  /* ---------- Formular ---------- */
  var CKEYS = ['name', 'rel', 'phone'];
  el.contactBoxes.innerHTML = [0, 1, 2].map(function (i) {
    return '<div class="contact-box"><h3>' + OA.esc(t('Notfallkontakt {0}', [i + 1])) + '</h3><div class="row3">' +
      '<div class="field"><label for="c' + i + 'n">' + OA.esc(t('Name')) + '</label><input type="text" id="c' + i + 'n" data-c="' + i + '" data-ck="name" maxlength="80" autocomplete="off"></div>' +
      '<div class="field"><label for="c' + i + 'r">' + OA.esc(t('Beziehung')) + '</label><input type="text" id="c' + i + 'r" data-c="' + i + '" data-ck="rel" maxlength="60" autocomplete="off" placeholder="' + OA.esc(t('z. B. Schwester')) + '"></div>' +
      '<div class="field"><label for="c' + i + 'p">' + OA.esc(t('Telefon')) + '</label><input type="tel" id="c' + i + 'p" data-c="' + i + '" data-ck="phone" inputmode="tel" maxlength="40" autocomplete="off"></div>' +
      '</div></div>';
  }).join('');

  function fillForm() {
    var p = person();
    OA.$$('[data-k]').forEach(function (inp) { inp.value = p[inp.getAttribute('data-k')]; });
    OA.$$('[data-c]').forEach(function (inp) { inp.value = p.contacts[+inp.getAttribute('data-c')][inp.getAttribute('data-ck')]; });
    togglePlaces();
  }
  function togglePlaces() {
    $('#organPlaceField').hidden = $('#f-organ').value !== 'ja';
    $('#pvPlaceField').hidden = $('#f-pv').value !== 'ja';
  }
  function collect() {
    var p = person();
    OA.$$('[data-k]').forEach(function (inp) { p[inp.getAttribute('data-k')] = inp.value; });
    OA.$$('[data-c]').forEach(function (inp) { p.contacts[+inp.getAttribute('data-c')][inp.getAttribute('data-ck')] = inp.value; });
  }

  function save() {
    var ok = OA.store.set('notfallpass', state);
    el.storeWarn.hidden = ok;
    el.saveState.textContent = ok ? t('Gespeichert ✓') : t('Speicher blockiert, bitte Export nutzen.');
    return ok;
  }
  function onChange() {
    collect(); togglePlaces(); renderPeopleLabels(); renderPreview();
    el.saveState.textContent = t('Speichern …');
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 400);
  }
  document.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('[data-k],[data-c]')) onChange(); });
  document.addEventListener('change', function (e) { if (e.target.matches && e.target.matches('[data-k],[data-c]')) onChange(); });
  window.addEventListener('pagehide', function () { clearTimeout(saveTimer); collect(); save(); });

  /* ---------- Personen ---------- */
  function renderPeople() {
    el.people.innerHTML = state.people.map(function (p) {
      return '<button type="button" data-v="' + OA.esc(p.id) + '" data-notranslate aria-pressed="' + (p.id === state.current) + '">' + OA.esc(p.name || t('Neue Person')) + '</button>';
    }).join('');
  }
  function renderPeopleLabels() {
    OA.$$('button', el.people).forEach(function (b, i) { b.textContent = state.people[i].name || t('Neue Person'); });
  }
  el.people.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    collect(); state.current = b.getAttribute('data-v'); save(); renderPeople(); fillForm(); renderPreview();
  });
  $('#addPerson').addEventListener('click', function () {
    collect(); var p = P.blank(); state.people.push(p); state.current = p.id; save(); renderPeople(); fillForm(); renderPreview();
    $('#f-name').focus(); window.scrollTo(0, 0);
  });
  $('#delPerson').addEventListener('click', function () {
    var p = person();
    if (!confirm(t('„{0}“ wirklich löschen?', [p.name || t('Neue Person')]))) return;
    state.people = state.people.filter(function (x) { return x.id !== p.id; });
    if (!state.people.length) state.people.push(P.blank());
    state.current = state.people[0].id; save(); renderPeople(); fillForm(); renderPreview();
  });

  /* ---------- Karte und Blatt ---------- */
  // Deutsche Beschriftung immer; in der gewählten Sprache zusätzlich, wenn zweisprachig. Alles in data-notranslate, damit die Engine Deutsch nicht übersetzt.
  function lab(key, second) {
    var o = second ? t(key) : '';
    return '<span class="k">' + OA.esc(key) + '</span>' + (o && o !== key ? ' <span class="k2" lang="' + OA.lang + '" dir="auto">/ ' + OA.esc(o) + '</span>' : '');
  }
  function val(s) { return '<span class="v" dir="auto">' + OA.esc(s) + '</span>'; }
  function yesNo(v, place, second) {
    if (!v) return '';
    var o = second ? t(v) : '';
    return OA.esc(v) + (o && o !== v ? ' / ' + OA.esc(o) : '') + (place ? ' (' + OA.esc(place) + ')' : '');
  }
  function fl(key, html, second) { return html ? '<div class="fl">' + lab(key, second) + ': ' + html + '</div>' : ''; }

  function header(second) {
    var o = second && t('Notfallpass') !== 'Notfallpass' ? ' · ' + OA.esc(t('Notfallpass')) : '';
    return '<div class="hd"><span>' + OA.esc('NOTFALLPASS') + o + '</span><span class="sos">' + OA.esc('Notruf 112') + '</span></div>';
  }

  function cardFront(p, second) {
    var blood = P.bloodText(p);
    return '<div class="pass-card" data-notranslate>' + header(second) +
      '<div class="who"><div><div class="nm" dir="auto">' + (p.name ? OA.esc(p.name) : '&nbsp;') + '</div>' +
      (p.birth ? '<div class="bd">' + lab('geboren', second) + ' ' + OA.esc(P.dateLocal(p.birth, 'de-DE')) + '</div>' : '') + '</div>' +
      (blood ? '<div class="blood"><b>' + OA.esc(blood) + '</b><small>' + lab('Blutgruppe', second) + '</small></div>' : '') + '</div>' +
      fl('Allergien', p.allergies && val(p.allergies), second) + fl('Vorerkrankungen', p.conditions && val(p.conditions), second) +
      fl('Medikamente', p.meds && val(p.meds), second) + fl('Implantate / Hilfsmittel', p.implants && val(p.implants), second) + '</div>';
  }
  function cardBack(p, second) {
    var contacts = p.contacts.filter(function (c) { return c.name || c.phone; }).map(function (c) {
      return '<div class="v" dir="auto">' + OA.esc(c.name + (c.rel ? ' (' + c.rel + ')' : '')) + (c.phone ? ' · ' + OA.esc(c.phone) : '') + '</div>';
    }).join('');
    var gp = [p.gpName, p.gpPhone].filter(Boolean).join(' · ');
    return '<div class="pass-card" data-notranslate>' + header(second) +
      (contacts ? '<div class="fl">' + lab('Notfallkontakte', second) + ':' + contacts + '</div>' : '') +
      fl('Hausarzt', gp && val(gp), second) +
      fl('Organspendeausweis', yesNo(p.organ, p.organPlace, second), second) + fl('Patientenverfügung', yesNo(p.pv, p.pvPlace, second), second) +
      fl('Tetanus-Impfung', p.tetanus && val(P.dateLocal(p.tetanus, 'de-DE')), second) + fl('Sprachen', p.langs && val(p.langs), second) +
      fl('Hinweis für Retter', p.note && val(p.note), second) + '</div>';
  }

  function sheetA4(p, second) {
    var rows = [['Name', p.name], ['Geburtsdatum', p.birth && P.dateLocal(p.birth, 'de-DE')], ['Blutgruppe', P.bloodText(p), 'big'], ['Allergien', p.allergies],
      ['Vorerkrankungen', p.conditions], ['Medikamente', p.meds], ['Implantate / Hilfsmittel', p.implants], ['Tetanus-Impfung', p.tetanus && P.dateLocal(p.tetanus, 'de-DE')],
      ['Organspendeausweis', p.organ ? p.organ + (p.organPlace ? ' (' + p.organPlace + ')' : '') : ''], ['Patientenverfügung', p.pv ? p.pv + (p.pvPlace ? ' (' + p.pvPlace + ')' : '') : ''],
      ['Hausarzt', [p.gpName, p.gpPhone].filter(Boolean).join(' · ')]];
    p.contacts.forEach(function (c, i) { rows.push(['Notfallkontakt ' + (i + 1), [c.name + (c.rel ? ' (' + c.rel + ')' : ''), c.phone].filter(function (x) { return x.trim(); }).join(' · ')]); });
    rows.push(['Sprachen', p.langs], ['Hinweis für Retter', p.note]);
    var th = function (key) {
      var m = /^(Notfallkontakt) (\d)$/.exec(key), o;
      if (m) { o = second ? t('Notfallkontakt {0}', [m[2]]) : ''; return OA.esc(key) + (o ? '<small lang="' + OA.lang + '" dir="auto">' + OA.esc(o) + '</small>' : ''); }
      o = second ? t(key) : '';
      return OA.esc(key) + (o && o !== key ? '<small lang="' + OA.lang + '" dir="auto">' + OA.esc(o) + '</small>' : '');
    };
    var title = 'Notfallpass' + (second && t('Notfallpass') !== 'Notfallpass' ? ' / ' + t('Notfallpass') : '');
    return '<div data-notranslate><h1>' + OA.esc(title) + '</h1><table><tbody>' + rows.map(function (r) {
      return '<tr><th>' + th(r[0]) + '</th><td dir="auto"' + (r[2] ? ' class="' + r[2] + '"' : '') + '>' + OA.esc(r[1] || '') + '</td></tr>';
    }).join('') + '</tbody></table><p class="note">' + OA.esc('Notruf 112') + ' · ' + OA.esc(t('Gedruckt am {0}', [ymd(OA.today())])) +
      ' · ' + OA.esc(t('Bewahre dieses Blatt sicher auf.')) + '</p></div>';
  }

  function scalePreview(box) {
    var card = box.firstChild; if (!card) return;
    var w = box.parentNode.clientWidth, s = Math.min(1, (w || card.offsetWidth) / card.offsetWidth);
    card.style.transform = 'scale(' + s + ')';
    box.style.height = Math.ceil(card.offsetHeight * s) + 'px';
  }
  function renderPreview() {
    var p = person(), second = secondOn();
    el.pvFront.innerHTML = cardFront(p, second); el.pvBack.innerHTML = cardBack(p, second);
    [el.pvFront, el.pvBack].forEach(scalePreview);
    var cards = OA.$$('.pass-card', el.pvFront.parentNode.parentNode);
    el.fitWarn.hidden = !cards.some(function (c) { return c.scrollHeight > c.clientHeight + 1; });
    el.copybox.value = P.toText(p, { second: second ? OA.t : null });
  }
  window.addEventListener('resize', function () { [el.pvFront, el.pvBack].forEach(scalePreview); });

  function cutCell(html) { return '<div class="cut">' + html + '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>'; }
  function buildPrint(mode) {
    var p = person(), second = secondOn();
    if (mode === 'cards') {
      var n = Math.max(1, Math.min(4, Math.round(OA.num(el.copies.value)) || 1)), pairs = '';
      for (var i = 0; i < n; i++) pairs += '<div class="pair">' + cutCell(cardFront(p, second)) + cutCell(cardBack(p, second)) + '</div>';
      el.printCards.innerHTML = '<p class="hint" data-notranslate>' + OA.esc(t('Ausschneiden an den Schnittmarken. Vorder- und Rückseite zusammenkleben oder in der Mitte falten.')) + '</p>' + pairs;
    } else el.printA4.innerHTML = sheetA4(p, second);
  }
  function doPrint(mode) {
    collect(); buildPrint(mode);
    document.body.setAttribute('data-print', mode);
    window.print();
    setTimeout(function () { document.body.removeAttribute('data-print'); }, 300);
  }
  // Strg+P / „Seite drucken“ im Menü: Standard ist die Karte
  window.addEventListener('beforeprint', function () { if (!document.body.hasAttribute('data-print')) { collect(); buildPrint('cards'); document.body.setAttribute('data-print', 'cards'); } });
  window.addEventListener('afterprint', function () { document.body.removeAttribute('data-print'); });
  $('#printCardsBtn').addEventListener('click', function () { doPrint('cards'); });
  $('#printA4Btn').addEventListener('click', function () { doPrint('a4'); });

  el.bilingualRow.hidden = OA.lang === 'de';
  el.bilingual.checked = secondOn();
  el.bilingual.addEventListener('change', function () { state.bilingual = el.bilingual.checked; save(); renderPreview(); });
  el.copies.value = state.copies;
  el.copies.addEventListener('input', function () { var n = Math.round(OA.num(el.copies.value)); if (n >= 1 && n <= 4) { state.copies = n; save(); } });

  /* ---------- Text kopieren ---------- */
  $('#copyBtn').addEventListener('click', function () {
    collect(); renderPreview();
    var text = el.copybox.value, ok = false;
    function done(good) { el.copyMsg.textContent = good ? t('Kopiert.') : t('Kopieren nicht möglich. Öffne „Mehr“, markiere den Text und kopiere ihn selbst.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { done(true); }, fallback); return; }
    fallback();
    function fallback() {
      try { el.copybox.select(); ok = document.execCommand('copy'); } catch (e) { ok = false; }
      done(ok);
    }
  });

  /* ---------- Export / Import ---------- */
  function say(s) { el.msg.textContent = s; }
  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }
  $('#export').addEventListener('click', function () {
    collect();
    OA.download('notfallpass-' + OA.today() + '.json', JSON.stringify({ app: 'offline-ark-notfallpass', version: 1, exported: OA.today(), people: state.people }, null, 2));
    say(t('Export gestartet: {0} Personen.', [state.people.length]));
  });
  $('#import').addEventListener('click', function () {
    OA.pickFile('.json,application/json', function (text) {
      try { pending = P.parseImport(text); } catch (err) { pending = null; say(t('Import nicht möglich: {0}', [t(err.message)])); return; }
      el.impText.textContent = t('{0} Personen gefunden.', [pending.people.length]) + (pending.skipped ? ' ' + t('({0} ungültige übersprungen)', [pending.skipped]) : '');
      openDlg(el.impDlg);
    });
  });
  function finishImport(replace) {
    if (!pending) return;
    collect();
    state.people = replace ? pending.people : P.merge(state.people, pending.people);
    state.current = state.people[0].id; pending = null;
    save(); closeDlg(el.impDlg); renderPeople(); fillForm(); renderPreview();
    say(t(replace ? 'Import abgeschlossen (ersetzt).' : 'Import abgeschlossen (zusammengeführt).'));
  }
  $('#impMerge').addEventListener('click', function () { finishImport(false); });
  $('#impReplace').addEventListener('click', function () { if (confirm(t('Deine jetzigen Personen werden ersetzt. Fortfahren?'))) finishImport(true); });
  $('#impCancel').addEventListener('click', function () { pending = null; closeDlg(el.impDlg); });

  renderPeople(); fillForm(); renderPreview(); save();
})();
