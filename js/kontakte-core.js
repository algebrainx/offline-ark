/* Offline-Ark – Kontakte & Treffpunkte: reine Logik (ohne DOM), in Node testbar.
 * Kontakt:    { id, name, phone, rel, note, star }
 * Treffpunkt: { id, name, place, coords, type ('nah'|'viertel'|'aussen'), note }
 * Adresse:    { id, name, cat, address, phone, note } */
(function () {
  'use strict';

  var TYPES = [
    { id: 'nah', label: 'Nah (z. B. Haus/Straße)' },
    { id: 'viertel', label: 'Im Viertel' },
    { id: 'aussen', label: 'Außerhalb der Stadt' }
  ];
  var ADDR_CATS = ['Arzt', 'Apotheke', 'Krankenhaus', 'Sammelstelle', 'Wasserstelle', 'Sonstiges'];
  var KEYS = ['kontakte', 'treffpunkte', 'adressen'];

  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
  function id(raw) { return typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : newId(); }
  function newId() { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var sanitize = {
    kontakte: function (r) {
      if (!r || typeof r !== 'object' || !str(r.name, 120)) return null;
      return { id: id(r), name: str(r.name, 120), phone: str(r.phone, 40), rel: str(r.rel, 60), note: str(r.note, 500), star: r.star === true };
    },
    treffpunkte: function (r) {
      if (!r || typeof r !== 'object' || !str(r.name, 120)) return null;
      var type = TYPES.some(function (t) { return t.id === r.type; }) ? r.type : 'nah';
      return { id: id(r), name: str(r.name, 120), place: str(r.place, 500), coords: str(r.coords, 60), type: type, note: str(r.note, 500) };
    },
    adressen: function (r) {
      if (!r || typeof r !== 'object' || !str(r.name, 120)) return null;
      return { id: id(r), name: str(r.name, 120), cat: ADDR_CATS.indexOf(r.cat) >= 0 ? r.cat : 'Sonstiges',
        address: str(r.address, 300), phone: str(r.phone, 40), note: str(r.note, 500) };
    }
  };

  /** Telefonnummer -> tel:-Link (nur Ziffern, + und Sternchen/Raute); '' ohne Ziffern. */
  function telHref(phone) {
    var clean = String(phone || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    return /\d/.test(clean) ? 'tel:' + clean : '';
  }

  /** Anzeigereihenfolge der Kontakte: Wichtige zuerst, sonst Reihenfolge der Liste. */
  function displayContacts(list) {
    return list.filter(function (c) { return c.star; }).concat(list.filter(function (c) { return !c.star; }));
  }

  /** Kontakt um eine Position nach oben (-1) bzw. unten (+1) schieben – nur innerhalb der Gruppe (wichtig / übrige). */
  function moveContact(list, cid, dir) {
    var disp = displayContacts(list), i = -1;
    disp.forEach(function (c, k) { if (c.id === cid) i = k; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= disp.length || disp[i].star !== disp[j].star) return list;
    var a = list.indexOf(disp[i]), b = list.indexOf(disp[j]), out = list.slice(), t = out[a];
    out[a] = out[b]; out[b] = t;
    return out;
  }

  function sortMeetings(list) {
    var order = TYPES.map(function (t) { return t.id; });
    return list.map(function (x, i) { return { x: x, i: i }; })
      .sort(function (p, q) { return (order.indexOf(p.x.type) - order.indexOf(q.x.type)) || (p.i - q.i); })
      .map(function (p) { return p.x; });
  }
  function sortAddresses(list) {
    return list.map(function (x, i) { return { x: x, i: i }; })
      .sort(function (p, q) { return (ADDR_CATS.indexOf(p.x.cat) - ADDR_CATS.indexOf(q.x.cat)) || (p.i - q.i); })
      .map(function (p) { return p.x; });
  }

  function merge(existing, incoming) {
    var out = existing.slice(), idx = {};
    out.forEach(function (x, i) { idx[x.id] = i; });
    incoming.forEach(function (x) {
      if (Object.prototype.hasOwnProperty.call(idx, x.id)) out[idx[x.id]] = x;
      else { idx[x.id] = out.length; out.push(x); }
    });
    return out;
  }

  /** Importdatei lesen. Wirft Error bei Fehlern. Ergebnis: { kontakte, treffpunkte, adressen, skipped } */
  function parseImport(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('Die Datei ist kein gültiges JSON.'); }
    if (!obj || obj.app !== 'offline-ark-kontakte') throw new Error('Das ist keine Kontakte-Datei von Offline-Ark.');
    var out = { skipped: 0 }, total = 0;
    KEYS.forEach(function (k) {
      out[k] = [];
      (Array.isArray(obj[k]) ? obj[k] : []).forEach(function (r) { var it = sanitize[k](r); if (it) out[k].push(it); else out.skipped++; });
      total += out[k].length;
    });
    if (!total) throw new Error('Die Datei enthält keine gültigen Einträge.');
    return out;
  }

  var api = { TYPES: TYPES, ADDR_CATS: ADDR_CATS, KEYS: KEYS, sanitize: sanitize, newId: newId, telHref: telHref, displayContacts: displayContacts,
    moveContact: moveContact, sortMeetings: sortMeetings, sortAddresses: sortAddresses, merge: merge, parseImport: parseImport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_KONTAKTE = api;
})();
