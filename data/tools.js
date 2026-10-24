/* Offline-Ark – Register aller Werkzeuge und Wissensseiten.
 * Wird von der Startseite (Kacheln) und der Suche benutzt.
 * Neue Tools: hier eintragen + HTML-Datei in /tools/ anlegen.
 * Gruppen sind bewusst klein gehalten (max. 4 Einträge). */
(function () {
  'use strict';
  window.OA_TOOL_GROUPS = [
    { id: 'versorgung', title: 'Versorgung' },
    { id: 'rechnen', title: 'Rechnen & Zeit' },
    { id: 'orientierung', title: 'Orientierung' },
    { id: 'signal', title: 'Signal & Funk' },
    { id: 'organisation', title: 'Organisation' }
  ];

  window.OA_TOOLS = [
    // Versorgung
    { id: 'wasserbedarf', group: 'versorgung', icon: 'drop', title: 'Wasserbedarf', sub: 'Liter für Personen und Tage',
      desc: 'Wie viel Trinkwasser brauchen wir? Nach Klima und Aktivität.', kw: 'trinkwasser liter durst personen tage hitze' },
    { id: 'notvorrat', group: 'versorgung', icon: 'box', title: 'Notvorrat', sub: 'Menge, Kalorien, Wasser',
      desc: 'Vorrat für Personen und Tage berechnen, orientiert am BBK.', kw: 'vorrat bevorraten lebensmittel kalorien bbk essen konserven' },
    { id: 'entkeimung', group: 'versorgung', icon: 'flame', title: 'Wasser entkeimen', sub: 'Abkochen, Filter, Tabletten',
      desc: 'Abkochzeiten (auch in der Höhe), Hinweise zu Filtern und Tabletten.', kw: 'abkochen wasser aufbereiten filter chlor tabletten keime trinkwasser höhe' },
    { id: 'strom', group: 'versorgung', icon: 'battery', title: 'Strom & Akku', sub: 'Laufzeit, Solar',
      desc: 'Wie lange hält der Akku? Wie viel liefert ein Solarpanel?', kw: 'akku powerbank laufzeit solar panel watt wh energie batterie' },

    // Rechnen & Zeit
    { id: 'einheiten', group: 'rechnen', icon: 'ruler', title: 'Einheiten', sub: 'Länge, Gewicht, Energie …',
      desc: 'Länge, Gewicht, Volumen, Temperatur, Fläche, Geschwindigkeit, Energie.', kw: 'umrechnen einheitenrechner meter kilogramm liter celsius fahrenheit wh kwh mah' },
    { id: 'taschenrechner', group: 'rechnen', icon: 'calc', title: 'Taschenrechner', sub: 'Mit Wissenschaftsfunktionen',
      desc: 'Grundrechenarten, Wurzel, Potenzen, Winkelfunktionen, Logarithmen.', kw: 'rechner rechnen sinus cosinus wurzel logarithmus' },
    { id: 'zeit', group: 'rechnen', icon: 'timer', title: 'Stoppuhr & Timer', sub: 'Mit Alarmton',
      desc: 'Stoppuhr, Timer und Countdown mit Alarmton.', kw: 'stoppuhr timer countdown alarm wecker zeit' },

    // Orientierung
    { id: 'kompass', group: 'orientierung', icon: 'compass', title: 'Kompass', sub: 'Auch ohne Kompass',
      desc: 'Kompass über Handysensor und Anleitungen für Sonne, Uhr und Sterne.', kw: 'himmelsrichtung norden sonne uhr sterne polarstern richtung' },
    { id: 'sonne', group: 'orientierung', icon: 'sun', title: 'Sonne & Tageslicht', sub: 'Aufgang, Untergang',
      desc: 'Sonnenauf- und -untergang und Tageslichtdauer, offline berechnet.', kw: 'sonnenaufgang sonnenuntergang dämmerung tageslicht tageslänge' },
    { id: 'koordinaten', group: 'orientierung', icon: 'pin', title: 'Koordinaten & GPS', sub: 'Dezimal, UTM, Wegpunkte',
      desc: 'Koordinaten umrechnen, Entfernung und Richtung, GPS-Position, Wegpunkte.', kw: 'gps position utm grad wegpunkt entfernung peilung standort breitengrad längengrad' },

    // Signal & Funk
    { id: 'morse', group: 'signal', icon: 'morse', title: 'Morse-Code', sub: 'Text, Ton, Blinken',
      desc: 'Text in Morsecode umwandeln, als Ton abspielen oder Bildschirm blinken lassen.', kw: 'morsen sos signal ton blinker' },
    { id: 'sos', group: 'signal', icon: 'bulb', title: 'SOS-Licht', sub: 'Vollbild-Leuchte',
      desc: 'Bildschirm als weiße oder rote Lampe, mit SOS-Blinkmuster.', kw: 'taschenlampe licht notsignal blinken lampe leuchte' },
    { id: 'funk', group: 'signal', icon: 'radio', title: 'Funk-Spickzettel', sub: 'PMR, CB, Meshtastic',
      desc: 'PMR446-Kanäle, Freenet, CB-Funk, Meshtastic, Funkalphabet.', kw: 'pmr446 freenet cb funk walkie talkie meshtastic nato alphabet buchstabieren frequenz kanal' },

    // Organisation
    { id: 'inventar', group: 'organisation', icon: 'list', title: 'Vorratsliste', sub: 'Mit Ablaufwarnung',
      desc: 'Artikel, Menge und Ablaufdatum – mit Warnung und JSON-Export.', kw: 'inventar vorrat ablaufdatum haltbarkeit mhd liste export' },
    { id: 'notizen', group: 'organisation', icon: 'note', title: 'Notizen & Tagebuch', sub: 'Lokal gespeichert',
      desc: 'Notizen und Tagebuch mit Datum, nur auf diesem Gerät gespeichert.', kw: 'tagebuch notiz schreiben' },
    { id: 'kontakte', group: 'organisation', icon: 'users', title: 'Kontakte & Treffpunkte', sub: 'Familie, Adressen',
      desc: 'Notfallkontakte, Familien-Treffpunkt und wichtige Adressen.', kw: 'notfallkontakt treffpunkt telefon adresse familie' },
    { id: 'checklisten', group: 'organisation', icon: 'check', title: 'Checklisten', sub: 'Zum Abhaken',
      desc: 'Notgepäck, Hausapotheke, Stromausfall, Evakuierung, Winter.', kw: 'checkliste notgepäck fluchtrucksack hausapotheke evakuierung winter' }
  ];

  /* Wissensseiten in sinnvoller Lesereihenfolge. Die Texte selbst liegen
   * in /content/*.md und werden von scripts/build.js zu /wissen/*.html. */
  window.OA_WISSEN = [
    { id: 'erste-hilfe', icon: 'aid', title: 'Erste Hilfe', sub: 'Seitenlage, Wiederbelebung, Blutung' },
    { id: 'stromausfall', icon: 'boltoff', title: 'Stromausfall-Leitfaden', sub: 'Die ersten Stunden und Tage' },
    { id: 'wasser', icon: 'drop', title: 'Wasser finden & aufbereiten', sub: 'Sicher trinken' },
    { id: 'feuer-waerme', icon: 'flame', title: 'Feuer, Wärme & Unterschlupf', sub: 'Warm bleiben' },
    { id: 'nahrung', icon: 'leaf', title: 'Nahrung', sub: 'Vorrat, haltbar machen, Pflanzen' },
    { id: 'hygiene', icon: 'sparkle', title: 'Hygiene & Sanitär', sub: 'Ohne fließendes Wasser' },
    { id: 'navigation', icon: 'map', title: 'Navigation ohne GPS', sub: 'Karte, Sonne, Sterne' },
    { id: 'kommunikation', icon: 'antenna', title: 'Kommunikation & Funk', sub: 'Gehört werden' },
    { id: 'strom-energie', icon: 'plug', title: 'Strom & Energie off-grid', sub: 'Akkus, Solar, Aggregat' }
  ];
})();
