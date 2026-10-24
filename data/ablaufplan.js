/* Offline-Ark – Stromausfall-Plan (window.OA_ABLAUFPLAN).
 * Inhalte stammen aus unserer Wissensseite content/stromausfall.md (nach BBK und FEMA/ready.gov, in eigenen Worten).
 * Es steht nur drin, was dort belegt ist. Wer ändert: Text auch in data/i18n/tool-ablaufplan.js übersetzen
 * und `node scripts/test-ablaufplan.js` laufen lassen.
 *
 * Phasen: `from`/`to` in Stunden nach Beginn des Ausfalls (to = null: offen). Punkt-IDs müssen je Plan eindeutig sein;
 * wer einen Text ändert, behält die ID, damit gespeicherte Häkchen erhalten bleiben.
 * Links: { tool: 'strom', t: 'Strom & Akku' }  oder  { wissen: 'wasser', t: 'Wasser finden & aufbereiten' } */
(function () {
  'use strict';

  var PHASES = [
    {
      id: 'sofort', title: 'Sofort (erste Stunde)', when: 'Stunde 0 bis 1', from: 0, to: 1,
      items: [
        { id: 'betroffen', text: 'Schau nach, wer betroffen ist. Prüfe die Sicherungen. Frag die Nachbarn: Ist nur dein Haus ohne Strom?' },
        { id: 'geraete', text: 'Schalte Wärmegeräte aus: Herd, Ofen, Bügeleisen, Kaffeemaschine, Wasserkocher, Heizlüfter. Ziehe empfindliche Geräte aus der Steckdose.' },
        { id: 'radio', text: 'Mach das Radio an. Ein Batterie- oder Kurbelradio funktioniert ohne Steckdose, ebenso das Autoradio.' },
        { id: 'kuehlschrank', text: 'Schließ Kühlschrank und Gefriertruhe. Öffne sie nur, wenn es sein muss.' },
        { id: 'licht', text: 'Nimm Taschenlampen, keine Kerzen. Kerzen brauchen Aufsicht und Luft zum Atmen.' },
        { id: 'kohlenmonoxid', text: 'Benutze nie Grill, Campingkocher oder Aggregat in der Wohnung, im Keller oder in der Garage. Kohlenmonoxid ist unsichtbar und geruchlos.',
          links: [{ wissen: 'erste-hilfe', t: 'Erste Hilfe' }] },
        { id: 'nachbarn', text: 'Sprich mit den Nachbarn. Vielleicht braucht jemand Hilfe oder kann dir helfen.' },
        { id: 'telefon', text: 'Telefoniere nur das Nötigste. 112 ist nur für echte Notfälle, nicht für Fragen zur Dauer.' },
        { id: 'sos', text: 'Brauchst du Hilfe und niemand hört dich? Nutze das SOS-Licht.', links: [{ tool: 'sos', t: 'SOS-Licht' }] }
      ]
    },
    {
      id: 'tag1', title: 'Erster Tag', when: 'Stunde 1 bis 24', from: 1, to: 24,
      items: [
        { id: 'akku', text: 'Spare Akku: Schicke nur Wichtiges. Halte die Powerbank bereit und rechne aus, wie lange sie reicht.', links: [{ tool: 'strom', t: 'Strom & Akku' }] },
        { id: 'wasser', text: 'Prüfe deinen Wasservorrat. Das BBK plant mit 2 Litern pro Person und Tag, davon 0,5 Liter zum Kochen.', links: [{ tool: 'wasserbedarf', t: 'Wasserbedarf' }] },
        { id: 'waerme', text: 'Bleib möglichst in einem Raum. Halte die Türen zu, trag warme Kleidung und lüfte kurz und kräftig.' },
        { id: 'kochen', text: 'Koche sicher: Camping-Kocher und Grill nur draußen. Drinnen nur Stövchen, Fondue-Set oder Gaskocher mit Zulassung für Innenräume. Stell Löschmittel bereit.' },
        { id: 'essen', text: 'Iss zuerst, was verderblich ist. Ein geschlossener Kühlschrank hält etwa 4 Stunden kalt, eine volle Gefriertruhe etwa 48 Stunden.' },
        { id: 'bargeld', text: 'Prüfe dein Bargeld. Geldautomaten und Kassen fallen aus.' },
        { id: 'medizin', text: 'Kühlpflichtige Medikamente und medizinische Geräte: Frag Arzt, Apotheke oder Pflegedienst, was bei einem Stromausfall gilt.' },
        { id: 'anlaufstellen', text: 'Frag bei deiner Gemeinde: Wo gibt es Informationen und Hilfe? Rathäuser oder Notfalltreffpunkte sind oft Anlaufstellen.', links: [{ tool: 'kontakte', t: 'Kontakte & Treffpunkte' }] },
        { id: 'notrufausfall', text: 'Wenn 110 und 112 nicht mehr gehen: Geh bei einem Notfall möglichst zur nächsten Polizeiwache oder ins Krankenhaus.', links: [{ tool: 'karte', t: 'Offline-Karte' }] }
      ]
    },
    {
      id: 'tag23', title: 'Tag 2–3', when: 'Stunde 24 bis 72', from: 24, to: 72,
      items: [
        { id: 'vorrat', text: 'Teile deinen Vorrat ein. Plane lieber mit mehr Tagen.', links: [{ tool: 'notvorrat', t: 'Notvorrat' }] },
        { id: 'radio2', text: 'Hör regelmäßig Radio, aber spare Batterien, zum Beispiel zu festen Zeiten.' },
        { id: 'nachbarn2', text: 'Tausch dich mit den Nachbarn aus. Teilt Kochstellen und Wärme, aber nur im Freien oder sicher belüftet.' },
        { id: 'wasser2', text: 'Bleibt der Wasserhahn trocken? Lies, wie du Wasser findest und sicher machst.',
          links: [{ wissen: 'wasser', t: 'Wasser finden & aufbereiten' }, { tool: 'entkeimung', t: 'Wasser entkeimen' }] },
        { id: 'hygiene', text: 'Halte Hygiene ein, sonst drohen Krankheiten.', links: [{ wissen: 'hygiene', t: 'Hygiene & Sanitär' }] },
        { id: 'heizen', text: 'Heize sicher: Gasheizer nur mit Sauerstoffmangel- und Zündsicherung und nur, wenn sie für Innenräume zugelassen sind. Lüfte regelmäßig.' },
        { id: 'extreme', text: 'Ist es sehr kalt oder sehr heiß? Frag die Behörde nach Wärme- oder Kühlorten.', links: [{ tool: 'karte', t: 'Offline-Karte' }] },
        { id: 'solar', text: 'Lade Handy und Powerbank mit einem Solarladegerät, wenn du eines hast.', links: [{ tool: 'strom', t: 'Strom & Akku' }] }
      ]
    },
    {
      id: 'woche1', title: 'Woche 1', when: 'Tag 4 bis 7', from: 72, to: 168,
      items: [
        { id: 'tage', text: 'Rechne nach: Wie viele Tage reicht dein Vorrat? Das BBK empfiehlt 10 Tage. Schon 3 Tage helfen sehr.',
          links: [{ tool: 'notvorrat', t: 'Notvorrat' }, { tool: 'checklisten', t: 'Checklisten' }] },
        { id: 'info', text: 'Verfolge weiter die Meldungen der Behörden und deines Stromnetzbetreibers. Es können auch Tage werden, etwa nach Sturm oder Schnee.' },
        { id: 'pflege', text: 'Besprich mit Ärztin, Arzt oder Pflegedienst, wie Geräte und Pflege weiterlaufen. Wer Angehörige pflegt, sollte sie notfalls einige Zeit selbst versorgen können.' },
        { id: 'wasserhygiene', text: 'Halte Wasser und Hygiene weiter im Griff.', links: [{ wissen: 'wasser', t: 'Wasser finden & aufbereiten' }, { wissen: 'hygiene', t: 'Hygiene & Sanitär' }] },
        { id: 'erstehilfe', text: 'Halte dein Erste-Hilfe-Wissen bereit.', links: [{ tool: 'assistent', t: 'Notfall-Assistent' }, { wissen: 'erste-hilfe', t: 'Erste Hilfe' }] }
      ]
    },
    {
      id: 'danach', title: 'Danach oder länger', when: 'Ab Tag 8', from: 168, to: null,
      items: [
        { id: 'strom-zurueck', text: 'Kehrt der Strom zurück: Schalte Geräte nacheinander wieder ein.' },
        { id: 'essen2', text: 'Prüfe Essen aus Kühlschrank und Gefriertruhe. Wirf weg, was 2 Stunden oder länger über etwa 4 °C war oder komisch riecht und aussieht. Im Zweifel: weg damit.' },
        { id: 'medikamente', text: 'Kühlpflichtige Medikamente: Nach mehr als einem Tag ohne Strom rät FEMA zum Entsorgen, wenn auf dem Beipackzettel nichts anderes steht. Frag Arzt oder Apotheke nach Ersatz.' },
        { id: 'auffuellen', text: 'Fülle deinen Vorrat wieder auf. Das BBK empfiehlt 10 Tage, mindestens 3.', links: [{ tool: 'notvorrat', t: 'Notvorrat' }, { tool: 'checklisten', t: 'Checklisten' }] },
        { id: 'melder', text: 'Prüfe Rauchmelder, Feuerlöscher und Kohlenmonoxid-Melder.' },
        { id: 'naechstes-mal', text: 'Halte für den nächsten Ausfall etwas Bargeld bereit und lade alle Akkus, sobald ein Ausfall droht.' }
      ]
    }
  ];

  PHASES.forEach(function (p) { p.items.forEach(function (it) { it.id = p.id + ':' + it.id; }); });

  var DATA = { phases: PHASES, page: 'stromausfall', source: 'Quelle: Offline-Ark, Wissensseite „Stromausfall-Leitfaden“ (nach BBK und FEMA, in eigenen Worten zusammengefasst).' };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else window.OA_ABLAUFPLAN = DATA;
})();
