/* Offline-Ark – Vorratsliste: reine Logik (ohne DOM), damit sie in Node testbar ist.
 * Daten: { id, name, qty, unit, cat, exp ('JJJJ-MM-TT' oder ''), note } */
(function () {
  'use strict';

  var CATS = ['Lebensmittel', 'Getränke', 'Medizin', 'Hygiene', 'Technik', 'Sonstiges'];
  var DAY = 86400000;

  /** 'JJJJ-MM-TT' -> UTC-Millisekunden (NaN, wenn kein echtes Datum). UTC vermeidet Sommerzeit-Fehler. */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return NaN;
    var y = +m[1], mo = +m[2], d = +m[3], t = Date.UTC(y, mo - 1, d), c = new Date(t);
    return c.getUTCFullYear() === y && c.getUTCMonth() === mo - 1 && c.getUTCDate() === d ? t : NaN;
  }

  /** Tage von "today" bis "exp" (negativ = abgelaufen). NaN ohne gültiges Datum. */
  function daysUntil(exp, today) {
    var a = parseDate(exp), b = parseDate(today);
    return isNaN(a) || isNaN(b) ? NaN : Math.round((a - b) / DAY);
  }

  /** 'none' (ohne Datum) | 'bad' (abgelaufen) | 'warn' (innerhalb der Schwelle) | 'ok' */
  function status(item, today, warnDays) {
    var d = daysUntil(item.exp, today);
    if (isNaN(d)) return 'none';
    if (d < 0) return 'bad';
    return d <= warnDays ? 'warn' : 'ok';
  }

  /** Kurztext zur Fälligkeit, z. B. "seit 3 Tagen abgelaufen". */
  function dueText(d) {
    if (isNaN(d)) return '';
    if (d < 0) return d === -1 ? 'seit gestern abgelaufen' : 'seit ' + (-d) + ' Tagen abgelaufen';
    if (d === 0) return 'läuft heute ab';
    if (d === 1) return 'läuft morgen ab';
    return 'läuft in ' + d + ' Tagen ab';
  }

  /** 'JJJJ-MM-TT' -> 'TT.MM.JJJJ' */
  function dateDE(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }

  function summary(items, today, warnDays) {
    var out = { total: items.length, bad: 0, warn: 0 };
    items.forEach(function (it) { var s = status(it, today, warnDays); if (s === 'bad') out.bad++; else if (s === 'warn') out.warn++; });
    return out;
  }

  function newId() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /** Rohdaten prüfen und bereinigen; null, wenn unbrauchbar (z. B. ohne Namen). */
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) : '';
    if (!name) return null;
    var qty = typeof raw.qty === 'number' ? raw.qty : Number(String(raw.qty).replace(',', '.'));
    if (!isFinite(qty) || qty < 0) qty = 0;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : newId(),
      name: name,
      qty: Math.round(qty * 1000) / 1000,
      unit: typeof raw.unit === 'string' ? raw.unit.trim().slice(0, 30) : '',
      cat: CATS.indexOf(raw.cat) >= 0 ? raw.cat : 'Sonstiges',
      exp: !isNaN(parseDate(raw.exp)) ? raw.exp : '',
      note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 500) : ''
    };
  }

  /** Importdatei lesen. Erlaubt { app:'offline-ark-inventar', items:[…] } oder eine reine Liste. Wirft Error bei Fehlern. */
  function parseImport(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('Die Datei ist kein gültiges JSON.'); }
    var list = Array.isArray(obj) ? obj : (obj && obj.app === 'offline-ark-inventar' && Array.isArray(obj.items) ? obj.items : null);
    if (!list) throw new Error('Das ist keine Vorratsliste von Offline-Ark.');
    var items = [], skipped = 0;
    list.forEach(function (r) { var it = sanitize(r); if (it) items.push(it); else skipped++; });
    if (!items.length) throw new Error('Die Datei enthält keine gültigen Artikel.');
    return { items: items, skipped: skipped };
  }

  /** Zusammenführen: gleiche ID -> Import überschreibt; neue IDs werden angehängt. */
  function merge(existing, incoming) {
    var out = existing.slice(), idx = {};
    out.forEach(function (it, i) { idx[it.id] = i; });
    incoming.forEach(function (it) {
      if (Object.prototype.hasOwnProperty.call(idx, it.id)) out[idx[it.id]] = it;
      else { idx[it.id] = out.length; out.push(it); }
    });
    return out;
  }

  function byName(a, b) { return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }); }

  /** mode: 'exp' (Ablaufdatum, ohne Datum zuletzt) | 'name' | 'cat' */
  function sortItems(items, mode) {
    return items.slice().sort(function (a, b) {
      if (mode === 'name') return byName(a, b);
      if (mode === 'cat') return (CATS.indexOf(a.cat) - CATS.indexOf(b.cat)) || byName(a, b);
      var da = parseDate(a.exp), db = parseDate(b.exp);
      if (isNaN(da) && isNaN(db)) return byName(a, b);
      if (isNaN(da)) return 1;
      if (isNaN(db)) return -1;
      return (da - db) || byName(a, b);
    });
  }

  var api = { CATS: CATS, parseDate: parseDate, daysUntil: daysUntil, status: status, dueText: dueText, dateDE: dateDE,
    summary: summary, newId: newId, sanitize: sanitize, parseImport: parseImport, merge: merge, sortItems: sortItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_INVENTAR = api;
})();
