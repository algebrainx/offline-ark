/* Offline-Ark – Notizen & Tagebuch. Logik (Datum, Import, Text-Export): js/notizen-core.js */
(function () {
  'use strict';
  var OA = window.OA, N = window.OA_NOTIZEN, $ = OA.$;

  function load(key, fn) {
    var raw = OA.store.get(key, []);
    return Array.isArray(raw) ? raw.map(fn).filter(Boolean) : [];
  }
  var data = { notizen: load('notizen', N.sanitizeNote), tagebuch: load('tagebuch', N.sanitizeEntry) };

  var el = {
    mode: $('#mode'), newBtn: $('#newBtn'), q: $('#q'), otherDay: $('#otherDay'), otherDate: $('#otherDate'), list: $('#list'),
    listView: $('#listView'), editView: $('#editView'), edHead: $('#edHead'), titleField: $('#titleField'), edTitle: $('#edTitle'),
    edText: $('#edText'), saveState: $('#saveState'), storeWarn: $('#storeWarn'), msg: $('#msg'), printView: $('#printView'),
    printBtn: $('#print')
  };
  var cur = null;        // { type: 'notizen'|'tagebuch', item: {...}, isNew: bool }
  var timer = null;

  function mode() { return OA.segVal(el.mode); }

  function persist(key) {
    var ok = OA.store.set(key, data[key]);
    el.storeWarn.hidden = ok;
    return ok;
  }

  /* ---------- Liste ---------- */
  function snippet(t) { return t.replace(/\s+/g, ' ').trim().slice(0, 160); }

  function renderList() {
    var m = mode(), q = el.q.value.trim().toLowerCase(), today = OA.today();
    var items = m === 'notizen' ? N.sortNotes(data.notizen) : N.sortEntries(data.tagebuch);
    items = items.filter(function (it) { return !q || ((it.title || '') + ' ' + it.text).toLowerCase().indexOf(q) >= 0; });

    if (!items.length) {
      el.list.innerHTML = '<div class="empty">' + (q ? 'Nichts gefunden.' : m === 'notizen' ? 'Noch keine Notizen.' : 'Noch keine Einträge.<br>Tippe auf „Heute schreiben“.') + '</div>';
    } else {
      el.list.innerHTML = items.map(function (it) {
        var title = m === 'notizen' ? (it.title || snippet(it.text).slice(0, 60) || '(ohne Titel)') : N.dateLong(it.date) + (it.date === today ? ' · heute' : '');
        var sub = m === 'notizen' ? N.dateTime(it.updated) : '';
        return '<button type="button" class="entry" data-id="' + OA.esc(it.id) + '"><div class="t">' + OA.esc(title) + '</div>' +
          (sub ? '<div class="d">' + OA.esc(sub) + '</div>' : '') +
          '<div class="s">' + OA.esc(snippet(it.text)) + '</div></button>';
      }).join('');
    }
    renderPrint(m);
  }

  function applyMode() {
    var m = mode();
    el.newBtn.textContent = m === 'notizen' ? 'Neue Notiz' : 'Heute schreiben';
    el.q.placeholder = m === 'notizen' ? 'Notizen durchsuchen' : 'Tagebuch durchsuchen';
    el.otherDay.hidden = m !== 'tagebuch';
    el.printBtn.textContent = m === 'notizen' ? 'Notizen drucken' : 'Tagebuch drucken';
    renderList();
  }

  function renderPrint(m) {
    var items = m === 'notizen' ? N.sortNotes(data.notizen) : N.sortEntries(data.tagebuch);
    el.printView.innerHTML = '<h1>' + (m === 'notizen' ? 'Notizen' : 'Tagebuch') + '</h1><p>Gedruckt am ' + OA.esc(N.dateLong(OA.today())) + '</p>' +
      items.map(function (it) {
        var head = m === 'notizen' ? (it.title || '(ohne Titel)') + ' · ' + N.dateTime(it.updated) : N.dateLong(it.date);
        return '<div class="p-item"><h2>' + OA.esc(head) + '</h2><p class="p-text">' + OA.esc(it.text) + '</p></div>';
      }).join('');
  }

  /* ---------- Bearbeiten ---------- */
  function find(type, id) { return data[type].filter(function (x) { return x.id === id; })[0] || null; }

  function openEditor(type, id, date) {
    var item = id ? find(type, id) : null, now = Date.now(), isNew = !item;
    if (!item) item = type === 'notizen'
      ? { id: N.newId(), title: '', text: '', created: now, updated: now }
      : { id: date, date: date, text: '', created: now, updated: now };
    cur = { type: type, item: item, isNew: isNew };
    el.edHead.textContent = type === 'notizen' ? (isNew ? 'Neue Notiz' : 'Notiz') : N.dateLong(item.date);
    el.titleField.hidden = type !== 'notizen';
    el.edTitle.value = item.title || '';
    el.edText.value = item.text;
    el.saveState.textContent = ''; el.saveState.className = 'save-state';
    el.listView.hidden = true; el.editView.hidden = false;
    (type === 'notizen' && isNew ? el.edTitle : el.edText).focus();
    window.scrollTo(0, 0);
  }

  function isEmpty(it) { return !(it.title || '').trim() && !it.text.trim(); }

  /** Felder in den Entwurf übernehmen und speichern (nur wenn etwas drinsteht). */
  function saveNow() {
    clearTimeout(timer); timer = null;
    if (!cur) return;
    var it = cur.item;
    if (cur.type === 'notizen') it.title = el.edTitle.value;
    it.text = el.edText.value;
    if (isEmpty(it)) return;
    it.updated = Date.now();
    var list = data[cur.type], pos = -1;
    list.forEach(function (x, i) { if (x.id === it.id) pos = i; });
    if (pos >= 0) list[pos] = it; else list.push(it);
    cur.isNew = false;
    var ok = persist(cur.type);
    el.saveState.className = 'save-state' + (ok ? '' : ' err');
    el.saveState.textContent = ok ? 'Gespeichert ✓ ' + N.dateTime(Date.now()).slice(11) + ' Uhr'
      : 'Speicher blockiert, bitte Export nutzen.';
  }

  function scheduleSave() {
    el.saveState.className = 'save-state'; el.saveState.textContent = 'Speichern …';
    clearTimeout(timer); timer = setTimeout(saveNow, 600);
  }

  function closeEditor() {
    if (!cur) return;
    saveNow();
    // Leere, schon gespeicherte Einträge aufräumen
    if (!cur.isNew && isEmpty(cur.item)) removeCurrent();
    cur = null;
    el.editView.hidden = true; el.listView.hidden = false;
    renderList();
  }

  function removeCurrent() {
    var key = cur.type, id = cur.item.id;
    data[key] = data[key].filter(function (x) { return x.id !== id; });
    persist(key);
  }

  el.edTitle.addEventListener('input', scheduleSave);
  el.edText.addEventListener('input', scheduleSave);
  $('#done').addEventListener('click', closeEditor);
  $('#back').addEventListener('click', closeEditor);
  $('#stampBtn').addEventListener('click', function () {
    var r = N.insertAt(el.edText.value, el.edText.selectionStart, N.stamp(new Date(), cur.type === 'notizen'));
    el.edText.value = r.text; el.edText.focus(); el.edText.setSelectionRange(r.pos, r.pos);
    scheduleSave();
  });
  $('#delBtn').addEventListener('click', function () {
    if (!cur) return;
    var label = cur.type === 'notizen' ? 'Diese Notiz' : 'Dieser Tagebucheintrag';
    if (!confirm(label + ' wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return;
    clearTimeout(timer);
    if (!cur.isNew) removeCurrent();
    cur = null;
    el.editView.hidden = true; el.listView.hidden = false;
    renderList();
  });
  // Ungespeicherte Änderungen sichern, wenn die Seite verlassen wird
  window.addEventListener('pagehide', function () { if (cur) saveNow(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && cur) saveNow(); });

  /* ---------- Bedienung der Liste ---------- */
  el.mode.addEventListener('input', applyMode);
  el.q.addEventListener('input', renderList);
  el.newBtn.addEventListener('click', function () {
    if (mode() === 'notizen') openEditor('notizen', null);
    else openEditor('tagebuch', OA.today(), OA.today());
  });
  el.list.addEventListener('click', function (e) {
    var b = e.target.closest('.entry'); if (b) openEditor(mode(), b.getAttribute('data-id'));
  });
  $('#otherOpen').addEventListener('click', function () {
    var d = el.otherDate.value;
    if (!N.validDate(d)) { el.otherDate.focus(); return; }
    openEditor('tagebuch', d, d);
  });

  /* ---------- Export / Import / Druck ---------- */
  function say(t) { el.msg.textContent = t; }
  $('#expJson').addEventListener('click', function () {
    OA.download('notizen-' + OA.today() + '.json',
      JSON.stringify({ app: 'offline-ark-notizen', version: 1, exported: OA.today(), notizen: data.notizen, tagebuch: data.tagebuch }, null, 2));
    say('Export gestartet (.json).');
  });
  $('#expTxt').addEventListener('click', function () {
    OA.download('notizen-' + OA.today() + '.txt', '\ufeff' + N.toText(data.notizen, data.tagebuch, OA.today()), 'text/plain;charset=utf-8');
    say('Export gestartet (.txt).');
  });
  $('#impJson').addEventListener('click', function () {
    OA.pickFile('.json,application/json', function (text) {
      var r;
      try { r = N.parseImport(text); } catch (err) { say('Import nicht möglich: ' + err.message); return; }
      data.notizen = N.mergeById(data.notizen, r.notizen);
      data.tagebuch = N.mergeById(data.tagebuch, r.tagebuch);
      persist('notizen'); persist('tagebuch');
      say(r.notizen.length + ' Notizen und ' + r.tagebuch.length + ' Tagebucheinträge übernommen' + (r.skipped ? ' (' + r.skipped + ' ungültige übersprungen).' : '.'));
      renderList();
    });
  });
  el.printBtn.addEventListener('click', function () { window.print(); });

  applyMode();
})();
