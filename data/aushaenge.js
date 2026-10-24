/* Offline-Ark – Aushang-Vorlagen (nur Daten, ohne DOM). Alle Texte sind deutsche Schlüssel für das Wörterbuch
 * data/i18n/tool-aushaenge.js; der gedruckte Aushang wird daraus in der gewählten Sprache (und optional zusätzlich
 * auf Deutsch) erzeugt.
 *   Feld: { id, type: 'text'|'area'|'check'|'photo', label (Formular), print (Beschriftung im Aushang), ph (Platzhalter), req }
 *   Vorlage: { id, title (Knopf), head (Überschrift im Aushang), sub (Zeile unter der Überschrift), fields, contact (Beschriftung des
 *              Kontaktblocks), foot (feste Schlusszeile), fill ('treffpunkte' = Übernahme aus Kontakte & Treffpunkte) } */
(function () {
  'use strict';

  var TEMPLATES = [
    { id: 'gesucht', title: 'Hilfe gesucht', head: 'Hilfe gesucht', contact: 'Melden bei',
      foot: 'Wer helfen kann, meldet sich bitte. Danke!',
      fields: [
        { id: 'what', type: 'area', req: true, label: 'Was wird gebraucht?', print: 'Wir brauchen', ph: 'z. B. Wasser, Medikamente, ein Auto' },
        { id: 'where', type: 'text', label: 'Wo?', print: 'Wo', ph: 'z. B. Hauptstraße 12, 2. Stock' },
        { id: 'people', type: 'text', label: 'Wie viele Personen?', print: 'Personen', ph: 'z. B. 4, davon 2 Kinder' },
        { id: 'note', type: 'area', label: 'Weitere Hinweise (optional)', print: 'Hinweise', ph: '' }
      ] },
    { id: 'angeboten', title: 'Hilfe angeboten', head: 'Hilfe angeboten', contact: 'Melde dich bei',
      foot: 'Du brauchst Hilfe? Sprich uns an.',
      fields: [
        { id: 'what', type: 'area', req: true, label: 'Was biete ich an?', print: 'Wir bieten an', ph: 'z. B. Schlafplatz, Essen, Fahrten, Erste Hilfe' },
        { id: 'where', type: 'text', label: 'Wo und wann erreichbar?', print: 'Wo und wann', ph: 'z. B. Hauptstraße 12, täglich 8–20 Uhr' },
        { id: 'note', type: 'area', label: 'Weitere Hinweise (optional)', print: 'Hinweise', ph: '' }
      ] },
    { id: 'vermisst', title: 'Vermisstenmeldung', head: 'Vermisst', contact: 'Hinweise bitte an',
      foot: 'Bitte auch die Polizei informieren: Notruf 110.',
      fields: [
        { id: 'pname', type: 'text', req: true, label: 'Name der vermissten Person', print: 'Name', ph: '' },
        { id: 'age', type: 'text', label: 'Alter', print: 'Alter', ph: 'z. B. 8 Jahre' },
        { id: 'look', type: 'area', label: 'Beschreibung (Größe, Haare, Kleidung, Besonderes)', print: 'Beschreibung', ph: 'z. B. 1,20 m, braune Haare, rote Jacke' },
        { id: 'seenwhere', type: 'text', label: 'Zuletzt gesehen: wo?', print: 'Zuletzt gesehen, Ort', ph: '' },
        { id: 'seenwhen', type: 'text', label: 'Zuletzt gesehen: wann?', print: 'Zuletzt gesehen, Zeit', ph: 'z. B. heute, 14 Uhr' },
        { id: 'photo', type: 'photo', label: 'Foto (optional)', print: 'Foto' }
      ] },
    { id: 'treffpunkt', title: 'Treffpunkt / Sammelstelle', head: 'Treffpunkt', contact: 'Fragen an', fill: 'treffpunkte',
      foot: '',
      fields: [
        { id: 'where', type: 'text', req: true, label: 'Ort', print: 'Ort', ph: 'z. B. Turnhalle, Schillerstraße 5' },
        { id: 'when', type: 'text', label: 'Wann?', print: 'Zeit', ph: 'z. B. täglich um 18 Uhr' },
        { id: 'who', type: 'area', label: 'Für wen?', print: 'Für wen', ph: 'z. B. alle Bewohner von Haus 4' },
        { id: 'coords', type: 'text', label: 'Koordinaten (optional)', print: 'Koordinaten', ph: 'z. B. 48.83100, 9.31600', ltr: true },
        { id: 'note', type: 'area', label: 'Bitte mitbringen / Hinweise', print: 'Bitte mitbringen', ph: '' }
      ] },
    { id: 'information', title: 'Information', head: 'Information', contact: 'Auskunft bei',
      foot: '',
      fields: [
        { id: 'topic', type: 'text', req: true, label: 'Worum geht es?', print: 'Thema', ph: 'z. B. Wasserausgabe' },
        { id: 'what', type: 'area', label: 'Was gibt es zu wissen?', print: 'Information', ph: 'z. B. Frisches Trinkwasser, bitte Kanister mitbringen' },
        { id: 'where', type: 'text', label: 'Wo?', print: 'Wo', ph: '' },
        { id: 'when', type: 'text', label: 'Wann (Zeitpunkt)?', print: 'Wann', ph: 'z. B. heute 10 bis 12 Uhr' },
        { id: 'note', type: 'area', label: 'Wichtiger Hinweis', print: 'Wichtig', ph: '' }
      ] },
    { id: 'sicher', title: 'Wir sind in Sicherheit / Familie gefunden', head: 'Wir sind in Sicherheit', sub: 'Nachricht an Rettungsteams und Angehörige', contact: 'So erreicht ihr uns',
      foot: '',
      fields: [
        { id: 'names', type: 'area', req: true, label: 'Wer ist in Sicherheit? (Namen)', print: 'Personen', ph: 'z. B. Anna, Ben und Clara Beispiel' },
        { id: 'where', type: 'text', label: 'Wo sind wir?', print: 'Wir sind hier', ph: 'z. B. Notunterkunft Turnhalle, Schillerstraße 5' },
        { id: 'note', type: 'area', label: 'Weitere Hinweise (z. B. verletzt, brauchen Medikamente)', print: 'Hinweise', ph: '' },
        { id: 'nosearch', type: 'check', label: 'Bitte nicht mehr nach uns suchen', print: 'Bitte nicht mehr nach diesen Personen suchen.' }
      ] }
  ];

  var COMMON = {
    cname: { label: 'Dein Name', ph: 'Vorname Nachname' },
    cphone: { label: 'Telefon', ph: '+49 170 1234567' },
    cextra: { label: 'Weitere Erreichbarkeit (optional)', ph: 'z. B. Haus 4, Klingel Müller' }
  };

  var LANGS = ['de', 'en', 'es', 'ar'];
  var STRIPS = 8;

  /** Alle deutschen Schlüssel, die der gedruckte Aushang braucht (für den Wörterbuch-Test). */
  function printKeys() {
    var out = ['Stand', 'Telefonnummer zum Abreißen'];
    TEMPLATES.forEach(function (t) {
      [t.head, t.sub, t.contact, t.foot].forEach(function (k) { if (k) out.push(k); });
      t.fields.forEach(function (f) { out.push(f.print); });
    });
    return out;
  }
  function formKeys() {
    var out = [];
    TEMPLATES.forEach(function (t) {
      out.push(t.title);
      t.fields.forEach(function (f) { out.push(f.label); if (f.ph) out.push(f.ph); });
    });
    Object.keys(COMMON).forEach(function (k) { out.push(COMMON[k].label, COMMON[k].ph); });
    return out;
  }

  var api = { TEMPLATES: TEMPLATES, COMMON: COMMON, LANGS: LANGS, STRIPS: STRIPS, printKeys: printKeys, formKeys: formKeys };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_AUSHAENGE = api;
})();
