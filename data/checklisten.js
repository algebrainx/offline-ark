/* Offline-Ark – Checklisten (window.OA_CHECKLISTEN).
 * Inhalte orientieren sich an den Vorsorge-Empfehlungen des BBK ("Vorsorgen für Krisen und Katastrophen"),
 * sind aber in eigenen Worten zusammengefasst. Keine Medikamenten-Dosierungen: nur Material und Arten.
 * Punkt-IDs werden aus dem Text abgeleitet (Liste:Kurzform) und müssen je Liste eindeutig sein –
 * wer einen Text ändert, setzt damit gespeicherte Häkchen dieses Punkts zurück. */
(function () {
  'use strict';

  var LISTS = [
    {
      id: 'notgepaeck', title: 'Notgepäck', short: 'Fluchtrucksack',
      intro: 'Ein gepackter Rucksack pro Person, der griffbereit steht – für den Fall, dass ihr schnell das Haus verlassen müsst. Das BBK rät außerdem zu einem Vorrat für 10 Tage, mindestens aber 3 Tage. Passe die Liste an deine Familie an.',
      sections: [
        { title: 'Dokumente & Geld', items: [
          'Personalausweis oder Reisepass (zusätzlich Kopien)',
          'Geburts-, Heirats- und Impfurkunden als Kopie',
          'Impfausweis, Krankenversicherungskarte, Allergiepass',
          'Bargeld in kleinen Scheinen und Münzen',
          'Wichtige Telefonnummern und Adressen auf Papier',
          'Speicherstick mit Scans der wichtigsten Dokumente',
          'Schlüssel (Wohnung, Auto, Ersatz)'
        ] },
        { title: 'Kleidung & Schlafen', items: [
          'Wetterfeste Jacke und feste Schuhe',
          'Wechselkleidung, Unterwäsche, Socken',
          'Mütze, Handschuhe, Schal',
          'Schlafsack oder warme Decke',
          'Rettungsdecke (Wärmefolie)',
          'Regenponcho'
        ] },
        { title: 'Essen & Trinken', items: [
          'Wasser in Flaschen (Richtwert: 2 Liter pro Person und Tag)',
          'Haltbare Lebensmittel, die ohne Kochen essbar sind',
          'Dosenöffner oder Taschenmesser',
          'Trinkflasche, Becher, Besteck',
          'Babynahrung oder Spezialkost, falls nötig',
          'Wasserfilter oder Tabletten zum Entkeimen'
        ] },
        { title: 'Hygiene & Gesundheit', items: [
          'Zahnbürste, Zahnpasta, Seife',
          'Toilettenpapier, Taschentücher, Feuchttücher',
          'Binden, Windeln, weitere persönliche Hygieneartikel',
          'Kleines Erste-Hilfe-Set',
          'Persönliche Medikamente samt Medikamentenplan',
          'Brille, Ersatzbrille oder Kontaktlinsen',
          'Müllbeutel'
        ] },
        { title: 'Licht, Strom & Kommunikation', items: [
          'Taschenlampe oder Stirnlampe mit Ersatzbatterien',
          'Kurbel- oder Batterieradio',
          'Handy, Ladekabel und geladene Powerbank',
          'Trillerpfeife zum Bemerkbarmachen',
          'Feuerzeug oder wasserfeste Streichhölzer',
          'Landkarte der Umgebung, Stift und Notizblock'
        ] },
        { title: 'Familie, Tiere & Sonstiges', items: [
          'Beschäftigung für Kinder (Spielzeug, Kuscheltier, Buch)',
          'Futter, Leine und Impfpass für Haustiere',
          'Arbeitshandschuhe',
          'Atemschutzmasken',
          'Multitool oder Taschenmesser'
        ] }
      ]
    },
    {
      id: 'hausapotheke', title: 'Hausapotheke', short: 'Material & Arten',
      intro: 'Das ist eine Materialliste, keine ärztliche Beratung. Welche Medikamente für dich passen und wie du sie anwendest, klärst du mit Arztpraxis oder Apotheke. Prüfe die Haltbarkeit regelmäßig und bewahre alles trocken, kühl und außer Reichweite von Kindern auf.',
      sections: [
        { title: 'Verbandmaterial', items: [
          'Pflaster in verschiedenen Größen',
          'Sterile Wundauflagen (Kompressen)',
          'Mullbinden und elastische Binden',
          'Dreiecktuch',
          'Heftpflaster zum Fixieren von Verbänden',
          'Verbandpäckchen für größere Wunden',
          'Rettungsdecke'
        ] },
        { title: 'Geräte & Werkzeug', items: [
          'Schere für Verbandmaterial',
          'Pinzette',
          'Zeckenkarte oder Zeckenzange',
          'Fieberthermometer',
          'Einmalhandschuhe',
          'Beatmungstuch',
          'Sicherheitsnadeln'
        ] },
        { title: 'Reinigung & Desinfektion', items: [
          'Desinfektionsmittel für die Haut',
          'Händedesinfektionsmittel',
          'Wunddesinfektionsmittel',
          'Kühlkompressen (Kältepacks)',
          'Mittel gegen Insektenstiche',
          'Sonnenschutz'
        ] },
        { title: 'Persönliche Medikamente', items: [
          'Regelmäßig benötigte Medikamente mit ausreichendem Vorrat (mit Arztpraxis absprechen)',
          'Aktueller Medikamentenplan als Kopie',
          'Notfallmedikamente laut ärztlicher Verordnung (z. B. bei Allergien oder Asthma)',
          'Mittel gegen Schmerzen und Fieber – Auswahl mit Apotheke besprechen',
          'Mittel gegen Durchfall und Elektrolytlösung – Auswahl mit Apotheke besprechen',
          'Kindgerechte Präparate, falls Kinder im Haushalt leben'
        ] },
        { title: 'Pflege & Organisation', items: [
          'Erste-Hilfe-Anleitung (gedruckt)',
          'Liste mit Notrufnummern und Hausarzt',
          'Ablaufdaten aller Inhalte regelmäßig prüfen',
          'Beipackzettel aufbewahren',
          'Apotheke kindersicher und trocken lagern'
        ] }
      ]
    },
    {
      id: 'stromausfall', title: 'Stromausfall', short: 'Zuhause vorbereiten',
      intro: 'Ein längerer Stromausfall betrifft Licht, Heizung, Kühlung, Telefon und Zahlungsverkehr. Mit wenigen Dingen kommt ihr gut durch die ersten Tage. Kerzen, Kocher und Aggregate nie in geschlossenen Räumen ohne Frischluft betreiben – Brand- und Vergiftungsgefahr.',
      sections: [
        { title: 'Licht & Wärme', items: [
          'Taschenlampen oder Stirnlampen mit Ersatzbatterien',
          'Kerzen oder Teelichter mit sicheren Haltern',
          'Streichhölzer oder Feuerzeug',
          'Warme Decken und Schlafsäcke',
          'Wärmflaschen',
          'Einen Raum auswählen, den ihr notfalls zusammen warm haltet'
        ] },
        { title: 'Information & Kommunikation', items: [
          'Kurbel- oder Batterieradio',
          'Powerbanks geladen halten',
          'Wichtige Telefonnummern auf Papier',
          'Treffpunkt und Verhalten mit der Familie besprochen',
          'Nachbarn kennen und Hilfe verabreden'
        ] },
        { title: 'Essen & Trinken', items: [
          'Wasservorrat (Richtwert: 2 Liter pro Person und Tag)',
          'Lebensmittel, die ohne Kühlung haltbar sind',
          'Campingkocher mit Brennstoff (nur im Freien oder gut belüftet)',
          'Geschirr und Besteck für den Notbetrieb',
          'Thermoskanne für heiße Getränke'
        ] },
        { title: 'Im Ernstfall', items: [
          'Elektrogeräte vom Netz nehmen, die bei Rückkehr des Stroms Schaden nehmen könnten',
          'Kühlschrank und Gefrierschrank möglichst geschlossen lassen',
          'Bei Nachbarn nachfragen, besonders bei älteren oder kranken Menschen',
          'Aggregat nie im Haus oder in der Garage laufen lassen',
          'Tank des Autos möglichst nicht leer fahren'
        ] },
        { title: 'Gesundheit & Geld', items: [
          'Medikamente, die gekühlt werden müssen: Plan für den Ausfall mit der Praxis klären',
          'Ersatzbatterien für Hörgeräte und Messgeräte',
          'Ausreichend Bargeld, denn Kartenzahlung kann ausfallen',
          'Lösung für elektrische Pflege- und Atemhilfen vorab klären'
        ] }
      ]
    },
    {
      id: 'evakuierung', title: 'Evakuierung', short: 'Schnell raus',
      intro: 'Wenn die Behörden zum Verlassen auffordern, zählt jede Minute. Hör auf Durchsagen, Warn-Apps und Radio. Wer vorher klärt, wohin und mit wem, bleibt ruhiger. Gefährde dich nicht, um Dinge zu holen.',
      sections: [
        { title: 'Vorher klären', items: [
          'Notgepäck gepackt und griffbereit',
          'Fluchtwege und Treffpunkte mit allen besprochen',
          'Ort für Dokumente und Schlüssel festgelegt',
          'Wissen, wo Gas, Strom und Wasser abgestellt werden',
          'Kontaktperson außerhalb der Region bestimmt'
        ] },
        { title: 'Beim Verlassen der Wohnung', items: [
          'Herd und Kerzen ausmachen',
          'Strom, Gas und Wasser abstellen, wenn es sicher möglich ist',
          'Fenster schließen und Tür abschließen',
          'Zettel hinterlassen: wer, wohin, wann',
          'Nachbarn warnen und Hilfe anbieten',
          'Haustiere mitnehmen (Transportbox, Leine)'
        ] },
        { title: 'Mitnehmen', items: [
          'Notgepäck',
          'Ausweise und wichtige Dokumente',
          'Handy, Ladekabel, Powerbank',
          'Persönliche Medikamente',
          'Bargeld',
          'Warme Kleidung und feste Schuhe',
          'Wasser und Verpflegung'
        ] },
        { title: 'Unterwegs', items: [
          'Anweisungen und Sammelstellen der Einsatzkräfte beachten',
          'Zusammenbleiben, Kinder mit Name und Telefonnummer versehen',
          'Kontaktperson außerhalb der Region informieren',
          'Bei Autofahrt: Tank prüfen, Wasser und Decken mitnehmen',
          'Nur gesicherte Wege nutzen, keine Abkürzungen durch Gefahrenzonen'
        ] }
      ]
    },
    {
      id: 'winter', title: 'Winter', short: 'Kälte & Schnee',
      intro: 'Kälte, Schnee und Glätte können Heizung, Verkehr und Versorgung lahmlegen. Vorbereitung im Herbst zahlt sich aus. Zum Heizen nie Grill, Gas-Campingkocher oder Heizpilz in geschlossenen Räumen benutzen – Gefahr durch Kohlenmonoxid.',
      sections: [
        { title: 'Wohnung & Wärme', items: [
          'Decken, Schlafsäcke und Wärmflaschen bereitlegen',
          'Fenster und Türen abdichten',
          'Wasserleitungen und Außenhähne vor Frost schützen',
          'Brennstoff trocken lagern, falls ihr mit Holz oder Pellets heizt',
          'Rauchmelder und Kohlenmonoxid-Melder prüfen',
          'Einen Raum festlegen, der im Notfall warm gehalten wird'
        ] },
        { title: 'Kleidung', items: [
          'Warme Kleidung in mehreren Schichten',
          'Thermounterwäsche',
          'Mütze, Handschuhe, Schal',
          'Wasserdichte, warme Winterschuhe',
          'Ersatzsocken zum Wechseln'
        ] },
        { title: 'Haus & Weg', items: [
          'Schneeschaufel und Besen',
          'Streumittel wie Sand oder Splitt',
          'Eiskratzer',
          'Taschenlampe mit Ersatzbatterien',
          'Nachbarn und ältere Menschen im Blick behalten'
        ] },
        { title: 'Auto', items: [
          'Winterreifen aufgezogen',
          'Frostschutz in der Scheibenwaschanlage',
          'Decken, Warnweste und Warndreieck',
          'Thermoskanne mit warmem Getränk',
          'Starthilfekabel und Handschuhe',
          'Tank bei Kälte möglichst gut gefüllt'
        ] },
        { title: 'Vorrat', items: [
          'Wasservorrat (Leitungen können einfrieren)',
          'Lebensmittel ohne Kühlung haltbar',
          'Heiße Getränke und Suppen für die Kälte',
          'Kocher mit Brennstoff (nur gut belüftet oder im Freien)',
          'Powerbank und Radio bereithalten'
        ] }
      ]
    },
    {
      id: 'dokumente', title: 'Dokumente', short: 'Dokumentenmappe',
      intro: 'Eine Mappe, in der alle wichtigen Unterlagen beisammen liegen, spart im Ernstfall Zeit und Nerven. Halte Originale oder Kopien griffbereit und lege eine zweite Sammlung digital oder bei einer Vertrauensperson ab. Prüfe den Inhalt einmal im Jahr.',
      sections: [
        { title: 'Ausweise & Urkunden', items: [
          'Personalausweis, Reisepass und gegebenenfalls Aufenthaltstitel',
          'Geburtsurkunden aller Familienmitglieder',
          'Heiratsurkunde oder Nachweis der Lebenspartnerschaft',
          'Führerschein',
          'Aktuelle Passfotos',
          'Sterbe- oder Scheidungsurkunden, falls vorhanden'
        ] },
        { title: 'Gesundheit & Versicherung', items: [
          'Krankenversicherungskarte oder Versicherungsnachweis',
          'Impfpass',
          'Aktueller Medikamentenplan',
          'Notfallpass mit Blutgruppe und Allergien',
          'Organspendeausweis, falls vorhanden',
          'Policen der Haftpflicht-, Hausrat- und Unfallversicherung',
          'Telefonnummern der Versicherungen für den Schadensfall'
        ] },
        { title: 'Vorsorge & Recht', items: [
          'Vorsorgevollmacht',
          'Patientenverfügung',
          'Testament',
          'Einer Vertrauensperson sagen, wo die Unterlagen liegen'
        ] },
        { title: 'Geld & Verträge', items: [
          'Bank- und Kreditkarten',
          'Kontonummern (IBAN) getrennt von den Karten notiert',
          'Sperrnummer für Karten notiert',
          'Bargeld in kleinen Scheinen und Münzen',
          'Miet- oder Kaufvertrag, bei Eigentum Grundbuchauszug',
          'Wichtige Verträge (Strom, Internet, Handy) mit Kundennummern'
        ] },
        { title: 'Fahrzeug & Besitz', items: [
          'Fahrzeugschein und weitere Fahrzeugpapiere',
          'Versicherungsnachweis fürs Auto',
          'Fotos von Wertgegenständen und Hausrat als Nachweis',
          'Liste der Wertsachen mit Seriennummern'
        ] },
        { title: 'Kopien & Aufbewahrung', items: [
          'Kopien aller wichtigen Dokumente auf Papier',
          'Digitale Kopien auf einem Speicherstick, möglichst verschlüsselt',
          'Alles in Klarsichthüllen und einer wasserfesten Mappe',
          'Mappe an einem festen Ort, griffbereit beim Notgepäck',
          'Zweite Kopie bei einer Vertrauensperson außerhalb der Region',
          'Liste mit Notfallkontakten auf Papier',
          'Inhalt einmal im Jahr prüfen und aktualisieren'
        ] }
      ]
    }
  ];

  /** Text -> kurze, stabile Kennung (ohne Umlaute und Sonderzeichen). */
  function slug(s) {
    return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  }

  // Strings in { id, text } umwandeln
  LISTS.forEach(function (l) {
    l.sections.forEach(function (sec) {
      sec.items = sec.items.map(function (t) { return { id: l.id + ':' + slug(t), text: t }; });
    });
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = LISTS;
  else window.OA_CHECKLISTEN = LISTS;
})();
