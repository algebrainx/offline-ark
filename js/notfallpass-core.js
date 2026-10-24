/* Offline-Ark – Notfallpass: reine Logik (ohne DOM), in Node testbar.
 * Person: { id, name, birth ('JJJJ-MM-TT'|''), abo ('?'|'A'|'B'|'AB'|'0'), rh ('?'|'+'|'-'), allergies, conditions, meds, implants,
 *           tetanus ('JJJJ-MM-TT'|''), organ ('', 'ja', 'nein'), organPlace, pv ('', 'ja', 'nein'), pvPlace,
 *           gpName, gpPhone, contacts: [{ name, rel, phone } × 3], langs, note } */
(function () {
  'use strict';

  var ABO = ['?', 'A', 'B', 'AB', '0'], RH = ['?', '+', '-'], YN = ['', 'ja', 'nein'];

  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
  function pick(v, list, fb) { return list.indexOf(v) >= 0 ? v : fb; }
  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function validDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  /** 'JJJJ-MM-TT' -> Datum im Format der Sprache (Richtungsmarken entfernt); '' bei ungültigem Datum */
  function dateLocal(s, locale) {
    if (!validDate(s)) return '';
    var p = s.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString(locale || 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
      .replace(/[\u200e\u200f]/g, '');
  }

  function blank() {
    return { id: newId(), name: '', birth: '', abo: '?', rh: '?', allergies: '', conditions: '', meds: '', implants: '', tetanus: '',
      organ: '', organPlace: '', pv: '', pvPlace: '', gpName: '', gpPhone: '', contacts: [{ name: '', rel: '', phone: '' }, { name: '', rel: '', phone: '' }, { name: '', rel: '', phone: '' }],
      langs: '', note: '' };
  }

  /** Rohdaten prüfen und bereinigen; null, wenn kein Objekt. */
  function sanitize(r) {
    if (!r || typeof r !== 'object') return null;
    var c = Array.isArray(r.contacts) ? r.contacts : [], contacts = [];
    for (var i = 0; i < 3; i++) {
      var x = c[i] && typeof c[i] === 'object' ? c[i] : {};
      contacts.push({ name: str(x.name, 80), rel: str(x.rel, 60), phone: str(x.phone, 40) });
    }
    return {
      id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : newId(),
      name: str(r.name, 100), birth: validDate(r.birth) ? r.birth : '',
      abo: pick(r.abo, ABO, '?'), rh: pick(r.rh, RH, '?'),
      allergies: str(r.allergies, 600), conditions: str(r.conditions, 600), meds: str(r.meds, 900), implants: str(r.implants, 400),
      tetanus: validDate(r.tetanus) ? r.tetanus : '',
      organ: pick(r.organ, YN, ''), organPlace: str(r.organPlace, 120), pv: pick(r.pv, YN, ''), pvPlace: str(r.pvPlace, 120),
      gpName: str(r.gpName, 100), gpPhone: str(r.gpPhone, 40), contacts: contacts,
      langs: str(r.langs, 120), note: str(r.note, 600)
    };
  }

  /** 'A Rh+' – leer, wenn nichts bekannt ist. */
  function bloodText(p) {
    if (p.abo === '?' && p.rh === '?') return '';
    return (p.abo === '?' ? '?' : p.abo) + ' ' + (p.rh === '?' ? 'Rh?' : p.rh === '+' ? 'Rh+' : 'Rh−');
  }

  function parseImport(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('Die Datei ist kein gültiges JSON.'); }
    if (!obj || obj.app !== 'offline-ark-notfallpass' || !Array.isArray(obj.people)) throw new Error('Das ist keine Notfallpass-Datei von Offline-Ark.');
    var people = [], skipped = 0;
    obj.people.forEach(function (r) { var p = sanitize(r); if (p) people.push(p); else skipped++; });
    if (!people.length) throw new Error('Die Datei enthält keine gültigen Personen.');
    return { people: people, skipped: skipped };
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

  /**
   * Kompakter Text (z. B. für QR-Code oder Nachricht). Deutsche Feldnamen immer; mit opt.second (Funktion Deutsch -> andere Sprache)
   * steht die Übersetzung nach einem Schrägstrich dahinter. opt.locale = Datumsformat der Übersetzung nicht nötig: Datum immer TT.MM.JJJJ.
   */
  function toText(p, opt) {
    opt = opt || {};
    var second = opt.second;
    function lab(de) { var o = second ? second(de) : ''; return o && o !== de ? de + ' / ' + o : de; }
    function yn(v, place) { return v === 'ja' ? 'ja' + (place ? ' (' + place + ')' : '') : v === 'nein' ? 'nein' : ''; }
    var lines = [], d = function (s) { return dateLocal(s, 'de-DE'); };
    var head = lab('Notfallpass') + ': ' + (p.name || '–') + (p.birth ? ', ' + lab('geboren') + ' ' + d(p.birth) : '');
    lines.push(head);
    var add = function (key, val) { if (val) lines.push(lab(key) + ': ' + val); };
    add('Blutgruppe', bloodText(p));
    add('Allergien', p.allergies);
    add('Vorerkrankungen', p.conditions);
    add('Medikamente', p.meds);
    add('Implantate / Hilfsmittel', p.implants);
    add('Tetanus-Impfung', d(p.tetanus));
    add('Organspendeausweis', yn(p.organ, p.organPlace));
    add('Patientenverfügung', yn(p.pv, p.pvPlace));
    add('Hausarzt', [p.gpName, p.gpPhone].filter(Boolean).join(', '));
    p.contacts.forEach(function (c, i) {
      if (c.name || c.phone) lines.push(lab('Notfallkontakt') + ' ' + (i + 1) + ': ' + [c.name + (c.rel ? ' (' + c.rel + ')' : ''), c.phone].filter(function (x) { return x.trim(); }).join(', '));
    });
    add('Sprachen', p.langs);
    add('Hinweis für Retter', p.note);
    return lines.join('\n');
  }

  var api = { ABO: ABO, RH: RH, validDate: validDate, dateLocal: dateLocal, blank: blank, sanitize: sanitize, bloodText: bloodText,
    parseImport: parseImport, merge: merge, toText: toText, newId: newId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_NOTFALLPASS = api;
})();
