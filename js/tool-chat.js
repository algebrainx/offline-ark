/* Offline-Ark – Chat im lokalen Netz (Oberfläche).
 * Unter file:// gibt es nur die Anleitung. Unter http(s):// (Seite vom Chat-Server geladen) erscheint der Chat.
 * Nachrichten werden nie als HTML eingefügt: alles läuft durch OA.esc, Links entstehen nur aus geprüften Zahlen. */
(function () {
  'use strict';
  var OA = window.OA, t = OA.t, $ = OA.$;
  var guide = $('#guide'), chat = $('#chat');

  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    guide.open = true;
    $('#file-intro').hidden = false;
    return;
  }
  chat.hidden = false;

  var el = {
    join: $('#join'), view: $('#room-view'), name: $('#name'), pin: $('#pin'), pinField: $('#pin-field'), joinGo: $('#join-go'), joinErr: $('#join-err'),
    status: $('#status'), statusText: $('#status-text'), sound: $('#sound'), room: $('#room'), roomNew: $('#room-new'), nameChange: $('#name-change'),
    newRow: $('#room-new-row'), newName: $('#room-new-name'), newGo: $('#room-new-go'),
    msgs: $('#msgs'), text: $('#text'), send: $('#send'), counter: $('#counter'), sendErr: $('#send-err'), loc: $('#loc'), noserver: $('#noserver')
  };
  var DEFAULT_ROOM = 'Nachbarschaft', MAX_TEXT = 1000;
  var state = OA.store.get('chat', {}) || {};
  var pin = '';
  try { pin = sessionStorage.getItem('oa.chat.pin') || ''; } catch (e) { pin = ''; }
  var info = null, room = '', lastId = 0, gen = 0, ctrl = null, timer = null, retry = 0, first = true, rooms = [];

  function save() { OA.store.set('chat', { name: state.name || '', room: state.room || '', sound: !!state.sound }); }
  function headers(extra) { var h = Object.assign({}, extra || {}); if (pin) h['X-Chat-Pin'] = pin; return h; }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = headers(opts.headers); opts.cache = 'no-store';
    return fetch(path, opts);
  }

  /* ---------- Anzeige ---------- */
  function setStatus(kind) {
    el.status.className = 'status ' + (kind || '');
    el.statusText.textContent = kind === 'on' ? t('Verbunden') : kind === 'off' ? t('Keine Verbindung. Versuche es erneut …') : t('Verbinde …');
  }
  function fmtTime(ts) {
    var d = new Date(ts), now = new Date();
    var time = d.toLocaleTimeString(OA.locale, { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return time;
    return d.toLocaleDateString(OA.locale, { day: '2-digit', month: '2-digit' }) + ' ' + time;
  }
  function bodyHtml(text) {
    return OA.esc(text).replace(/geo:(-?\d{1,2}\.\d{1,6}),(-?\d{1,3}\.\d{1,6})/g, function (m, a, o) {
      return '<a class="ltr" href="geo:' + a + ',' + o + '">geo:' + a + ',' + o + '</a>';
    });
  }
  function msgHtml(m) {
    var mine = m.name === state.name;
    return '<li class="msg' + (mine ? ' mine' : '') + '" data-id="' + Number(m.id) + '"><div class="meta"><strong dir="auto" data-notranslate>' + OA.esc(m.name) +
      '</strong><time class="ltr" datetime="' + OA.esc(new Date(m.ts).toISOString()) + '">' + OA.esc(fmtTime(m.ts)) + '</time></div>' +
      '<div class="body" dir="auto" data-notranslate>' + bodyHtml(m.text) + '</div></li>';
  }
  function showEmpty() {
    el.msgs.innerHTML = '<li class="empty">' + OA.esc(t('Noch keine Nachrichten. Schreibe die erste.')) + '</li>';
  }
  function addMessages(list, fromOthers) {
    var fresh = list.filter(function (m) { return m.id > lastId; });
    if (!fresh.length) return;
    var atBottom = el.msgs.scrollHeight - el.msgs.scrollTop - el.msgs.clientHeight < 90;
    var empty = el.msgs.querySelector('.empty'); if (empty) empty.remove();
    el.msgs.insertAdjacentHTML('beforeend', fresh.map(msgHtml).join(''));
    lastId = fresh[fresh.length - 1].id;
    if (first || atBottom) el.msgs.scrollTop = el.msgs.scrollHeight;
    if (fromOthers && !first && state.sound && fresh.some(function (m) { return m.name !== state.name; })) { OA.beep(880, 130, 0.15); OA.vibrate(60); }
    first = false;
  }

  /* ---------- Verbindung: Long-Polling ---------- */
  function stopPoll() { gen++; if (ctrl) ctrl.abort(); ctrl = null; clearTimeout(timer); }
  function startPoll() {
    stopPoll();
    lastId = 0; first = true; showEmpty(); setStatus('');
    api('/api/chat/messages?room=' + encodeURIComponent(room) + '&limit=100').then(function (r) {
      if (r.status === 401) throw 401;
      if (!r.ok) throw r.status;
      return r.json();
    }).then(function (d) {
      if (d.room !== room) return;
      addMessages(d.messages, false); first = false; lastId = Math.max(lastId, d.last || 0);
      setStatus('on'); poll(gen);
    }).catch(function (e) { onPollError(e, gen); });
  }
  function poll(my) {
    if (my !== gen) return;
    ctrl = new AbortController();
    api('/api/chat/messages?room=' + encodeURIComponent(room) + '&since=' + lastId + '&wait=20', { signal: ctrl.signal }).then(function (r) {
      if (r.status === 401) throw 401;
      if (!r.ok) throw r.status;
      return r.json();
    }).then(function (d) {
      if (my !== gen) return;
      retry = 0; setStatus('on');
      addMessages(d.messages, true);
      poll(my);
    }).catch(function (e) { onPollError(e, my); });
  }
  function onPollError(e, my) {
    if (my !== gen || (e && e.name === 'AbortError')) return;
    if (e === 401) { showJoin(t('Der Chat-Code fehlt oder ist falsch.'), true); return; }
    setStatus('off');
    retry = Math.min(retry + 1, 5);
    timer = setTimeout(function () { if (my === gen) (lastId ? poll(my) : startPoll()); }, 1500 * retry);
  }

  /* ---------- Räume ---------- */
  function loadRooms() {
    return api('/api/chat/rooms').then(function (r) { return r.ok ? r.json() : { rooms: [] }; }).then(function (d) {
      rooms = (d.rooms || []).map(function (x) { return x.name; });
      if (rooms.indexOf(room) < 0) rooms.push(room);
      el.room.innerHTML = rooms.map(function (n) { return '<option data-notranslate value="' + OA.esc(n) + '"' + (n === room ? ' selected' : '') + '>' + OA.esc(n) + '</option>'; }).join('');
    }).catch(function () {});
  }
  function switchRoom(name) {
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!name) return;
    room = name; state.room = room; save();
    if (rooms.indexOf(room) < 0) { rooms.push(room); }
    el.room.innerHTML = rooms.map(function (n) { return '<option data-notranslate value="' + OA.esc(n) + '"' + (n === room ? ' selected' : '') + '>' + OA.esc(n) + '</option>'; }).join('');
    el.newRow.hidden = true;
    startPoll();
  }
  el.room.addEventListener('change', function () { switchRoom(el.room.value); });
  el.roomNew.addEventListener('click', function () { el.newRow.hidden = !el.newRow.hidden; if (!el.newRow.hidden) el.newName.focus(); });
  el.newGo.addEventListener('click', function () { switchRoom(el.newName.value); el.newName.value = ''; });
  el.newName.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.newGo.click(); } });

  /* ---------- Beitreten ---------- */
  function showJoin(msg, needPin) {
    stopPoll();
    el.view.hidden = true; el.join.hidden = false;
    el.name.value = state.name || '';
    el.pinField.hidden = !(needPin || (info && info.pinRequired));
    el.joinErr.textContent = msg || '';
    (state.name && !el.pinField.hidden ? el.pin : el.name).focus();
  }
  function enter() {
    el.join.hidden = true; el.view.hidden = false;
    el.sound.checked = !!state.sound;
    room = state.room || (info && info.defaultRoom) || DEFAULT_ROOM;
    loadRooms().then(function () { switchRoom(room); });
  }
  el.joinGo.addEventListener('click', function () {
    var name = el.name.value.replace(/\s+/g, ' ').trim();
    if (!name) { el.joinErr.textContent = t('Bitte gib einen Namen ein.'); el.name.focus(); return; }
    if (name.length > 30) { el.joinErr.textContent = t('Der Name ist zu lang (höchstens 30 Zeichen).'); return; }
    if (info && info.pinRequired) {
      pin = el.pin.value.trim();
      try { sessionStorage.setItem('oa.chat.pin', pin); } catch (e) { /* ignorieren */ }
    }
    state.name = name; save();
    // PIN prüfen, bevor wir den Raum öffnen
    api('/api/chat/rooms').then(function (r) {
      if (r.status === 401) { el.joinErr.textContent = t('Der Chat-Code fehlt oder ist falsch.'); el.pin.focus(); return; }
      if (r.status === 429) { el.joinErr.textContent = t('Zu viele Versuche. Bitte warte eine Minute.'); return; }
      el.joinErr.textContent = ''; enter();
    }).catch(function () { el.joinErr.textContent = t('Keine Verbindung zum Chat-Server.'); });
  });
  [el.name, el.pin].forEach(function (n) { n.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.joinGo.click(); } }); });
  el.nameChange.addEventListener('click', function () { showJoin('', false); });
  el.sound.addEventListener('change', function () { state.sound = el.sound.checked; save(); if (state.sound) OA.beep(880, 130, 0.15); });

  /* ---------- Senden ---------- */
  function updateCounter() {
    var n = el.text.value.length;
    el.counter.textContent = n > 800 ? n + ' / ' + MAX_TEXT : '';
  }
  function sendError(status, code) {
    if (status === 429) return t('Zu viele Nachrichten. Bitte warte kurz.');
    if (status === 401) return t('Der Chat-Code fehlt oder ist falsch.');
    if (code === 'text_too_long') return t('Die Nachricht ist zu lang (höchstens 1000 Zeichen).');
    if (code === 'name_too_long') return t('Der Name ist zu lang (höchstens 30 Zeichen).');
    if (code === 'too_many_rooms') return t('Es gibt schon zu viele Räume. Nimm einen vorhandenen Raum.');
    return t('Senden hat nicht geklappt. Prüfe die Verbindung.');
  }
  function sendNow() {
    var text = el.text.value.trim();
    if (!text) { el.sendErr.textContent = t('Schreibe zuerst eine Nachricht.'); el.text.focus(); return; }
    el.sendErr.textContent = ''; el.send.disabled = true;
    api('/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: state.name, text: text, room: room }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        el.send.disabled = false;
        if (res.status === 201 && res.d.message) {
          el.text.value = ''; updateCounter();
          if (res.d.message.room === room) { addMessages([res.d.message], false); el.msgs.scrollTop = el.msgs.scrollHeight; }
          el.text.focus();
        } else el.sendErr.textContent = sendError(res.status, res.d && res.d.error);
      }).catch(function () { el.send.disabled = false; el.sendErr.textContent = sendError(0); });
  }
  el.send.addEventListener('click', sendNow);
  el.text.addEventListener('input', updateCounter);
  el.text.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendNow(); } });

  /* ---------- Schnellnachrichten und Standort ---------- */
  // Bei anderer Sprache steht die Nachricht zusätzlich auf Deutsch: Nachbarn in Deutschland lesen Deutsch.
  function both(de, own) { return OA.lang === 'de' ? de : own + ' / ' + de; }
  var QUICK = {
    water: function () { return both('Wir brauchen Wasser', t('Wir brauchen Wasser')); },
    medical: function () { return both('Wir brauchen Hilfe (medizinisch)', t('Wir brauchen Hilfe (medizinisch)')); },
    safe: function () { return both('Wir sind in Sicherheit', t('Wir sind in Sicherheit')); },
    meet: function () { return both('Treffpunkt', t('Treffpunkt')) + ': '; }
  };
  OA.$$('[data-q]').forEach(function (b) {
    b.addEventListener('click', function () {
      var add = QUICK[b.getAttribute('data-q')]();
      el.text.value = el.text.value.trim() ? el.text.value.trim() + '\n' + add : add;
      updateCounter(); el.text.focus();
      el.text.setSelectionRange(el.text.value.length, el.text.value.length);
    });
  });
  el.loc.addEventListener('click', function () {
    if (!navigator.geolocation) { el.sendErr.textContent = t('Dieses Gerät kann den Standort nicht bestimmen.'); return; }
    el.sendErr.textContent = ''; el.loc.disabled = true;
    navigator.geolocation.getCurrentPosition(function (p) {
      el.loc.disabled = false;
      var c = p.coords, geo = 'geo:' + c.latitude.toFixed(5) + ',' + c.longitude.toFixed(5);
      var line = both('Mein Standort', t('Mein Standort')) + ': ' + geo + (isFinite(c.accuracy) ? ' (±' + Math.round(c.accuracy) + ' m)' : '');
      el.text.value = el.text.value.trim() ? el.text.value.trim() + '\n' + line : line;
      updateCounter(); el.text.focus();
    }, function () {
      el.loc.disabled = false;
      el.sendErr.textContent = t('Standort nicht verfügbar. Erlaube den Standort im Browser. Ohne Internet braucht das Handy dafür GPS.');
    }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 });
  });

  /* ---------- Start ---------- */
  fetch('/api/chat/info', { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('info');
    return r.json();
  }).then(function (d) {
    if (!d || d.app !== 'offline-ark-chat') throw new Error('info');
    info = d;
    if (state.name && (!info.pinRequired || pin)) { el.join.hidden = true; enter(); } else showJoin('', info.pinRequired);
  }).catch(function () {
    el.join.hidden = true; el.noserver.hidden = false; guide.open = true;
  });
  setInterval(function () { if (!el.view.hidden && document.visibilityState === 'visible') loadRooms(); }, 30000);
  window.addEventListener('pagehide', stopPoll);
})();
