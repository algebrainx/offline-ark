/* Offline-Ark – Notizen & Tagebuch: reine Logik (ohne DOM), in Node testbar.
 * Notiz:    { id, title, text, created, updated }   (Zeiten in Millisekunden)
 * Eintrag:  { id (= Datum), date 'JJJJ-MM-TT', text, created, updated } – ein Eintrag pro Tag */
(function () {
  'use strict';

  var WD_FALLBACK = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function validDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  /** 'JJJJ-MM-TT' -> 'Samstag, 24.10.2026' (Wochentag und Format je nach locale, Standard de-DE) */
  function dateLong(s, locale) {
    if (!validDate(s)) return String(s || '');
    var p = s.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    try {
      return d.toLocaleDateString(locale || 'de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).replace(/[\u200e\u200f]/g, '');
    } catch (e) { return WD_FALLBACK[d.getUTCDay()] + ', ' + p[2] + '.' + p[1] + '.' + p[0]; }
  }
  /** Millisekunden -> 'TT.MM.JJJJ HH:MM' (Ortszeit, Datumsformat je nach locale) */
  function dateTime(ms, locale) {
    var d = new Date(ms);
    return d.toLocaleDateString(locale || 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/[\u200e\u200f]/g, '') + ' ' + timeOf(ms);
  }
  /** Millisekunden -> 'HH:MM' (Ortszeit, 24 Stunden) */
  function timeOf(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function localDate(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  /** Zeitstempel zum Einfügen: '[14:35] ' bzw. '[24.10.2026 14:35] ' */
  function stamp(d, withDate) {
    d = d || new Date();
    return '[' + (withDate ? pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' : '') + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '] ';
  }
  /** Text an Cursorposition einfügen; beginnt der Cursor nicht am Zeilenanfang, kommt vorher ein Zeilenumbruch. */
  function insertAt(text, pos, ins) {
    pos = Math.max(0, Math.min(text.length, pos == null ? text.length : pos));
    var before = text.slice(0, pos), after = text.slice(pos);
    var lead = before && before.charAt(before.length - 1) !== '\n' ? '\n' : '';
    return { text: before + lead + ins + after, pos: (before + lead + ins).length };
  }

  function newId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function ts(v, fallback) { return typeof v === 'number' && isFinite(v) && v > 0 ? v : fallback; }

  function sanitizeNote(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : '';
    var text = typeof raw.text === 'string' ? raw.text.slice(0, 200000) : '';
    if (!title && !text.trim()) return null;
    var now = Date.now(), created = ts(raw.created, ts(raw.updated, now));
    return { id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : newId(), title: title, text: text, created: created, updated: ts(raw.updated, created) };
  }
  function sanitizeEntry(raw) {
    if (!raw || typeof raw !== 'object' || !validDate(raw.date)) return null;
    var text = typeof raw.text === 'string' ? raw.text.slice(0, 200000) : '';
    if (!text.trim()) return null;
    var created = ts(raw.created, ts(raw.updated, Date.now()));
    return { id: raw.date, date: raw.date, text: text, created: created, updated: ts(raw.updated, created) };
  }

  /** Gleiche ID: der neuere Eintrag (updated) gewinnt; Rest wird ergänzt. */
  function mergeById(existing, incoming) {
    var out = existing.slice(), idx = {};
    out.forEach(function (x, i) { idx[x.id] = i; });
    incoming.forEach(function (x) {
      if (Object.prototype.hasOwnProperty.call(idx, x.id)) { if (x.updated > out[idx[x.id]].updated) out[idx[x.id]] = x; }
      else { idx[x.id] = out.length; out.push(x); }
    });
    return out;
  }

  /** Importdatei lesen: { app:'offline-ark-notizen', notizen:[…], tagebuch:[…] }. Wirft Error bei Fehlern. */
  function parseImport(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('Die Datei ist kein gültiges JSON.'); }
    if (!obj || obj.app !== 'offline-ark-notizen') throw new Error('Das ist keine Notizen-Datei von Offline-Ark.');
    var notes = [], entries = [], skipped = 0;
    (Array.isArray(obj.notizen) ? obj.notizen : []).forEach(function (r) { var n = sanitizeNote(r); if (n) notes.push(n); else skipped++; });
    (Array.isArray(obj.tagebuch) ? obj.tagebuch : []).forEach(function (r) { var n = sanitizeEntry(r); if (n) entries.push(n); else skipped++; });
    if (!notes.length && !entries.length) throw new Error('Die Datei enthält keine gültigen Einträge.');
    return { notizen: notes, tagebuch: entries, skipped: skipped };
  }

  function sortNotes(list) { return list.slice().sort(function (a, b) { return b.updated - a.updated; }); }
  function sortEntries(list) { return list.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }

  /** Alles als lesbarer Text (.txt-Export). opt: { t: Übersetzer (OA.t), locale } – ohne opt deutsch. */
  function toText(notes, entries, todayStr, opt) {
    opt = opt || {};
    var t = opt.t || function (de, a) { return a ? de.replace(/\{(\d+)\}/g, function (m, i) { return a[i]; }) : de; };
    var loc = opt.locale;
    var out = [t('OFFLINE-ARK – NOTIZEN UND TAGEBUCH'), t('Exportiert am {0}', [dateLong(todayStr, loc)]), ''];
    out.push(t('=== NOTIZEN ({0}) ===', [notes.length]), '');
    sortNotes(notes).forEach(function (n) {
      out.push('--- ' + (n.title || t('(ohne Titel)')) + ' · ' + dateTime(n.updated, loc) + ' ---', n.text.replace(/\r?\n/g, '\n'), '');
    });
    out.push(t('=== TAGEBUCH ({0}) ===', [entries.length]), '');
    sortEntries(entries).forEach(function (e) { out.push('--- ' + dateLong(e.date, loc) + ' ---', e.text, ''); });
    return out.join('\r\n');
  }

  var api = { validDate: validDate, dateLong: dateLong, dateTime: dateTime, timeOf: timeOf, localDate: localDate, stamp: stamp, insertAt: insertAt, newId: newId,
    sanitizeNote: sanitizeNote, sanitizeEntry: sanitizeEntry, mergeById: mergeById, parseImport: parseImport,
    sortNotes: sortNotes, sortEntries: sortEntries, toText: toText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_NOTIZEN = api;
})();
