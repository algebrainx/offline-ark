/* Offline-Ark – Register aller Werkzeuge und Wissensseiten.
 * Wird von der Startseite (Kacheln), der Suche und dem Ausdruck-Paket benutzt.
 * Neue Tools: hier eintragen + HTML-Datei in /tools/ anlegen + Wörterbuch
 * data/i18n/tool-<id>.js (Titel/Beschreibung selbst stehen in data/i18n/core.js).
 * Gruppen sind bewusst klein gehalten (max. 6 Einträge, meist 3–4). */
(function () {
  'use strict';
  window.OA_TOOL_GROUPS = [
    { id: 'ernstfall', title: 'Im Ernstfall' },
    { id: 'versorgung', title: 'Versorgung' },
    { id: 'rechnen', title: 'Rechnen & Zeit' },
    { id: 'orientierung', title: 'Orientierung' },
    { id: 'signal', title: 'Signal & Funk' },
    { id: 'mitteilen', title: 'Mitteilen' },
    { id: 'natur', title: 'Natur & Bestimmen' },
    { id: 'selbst', title: 'Selbstversorgung' },
    { id: 'lernen', title: 'Lernen & Üben' },
    { id: 'organisation', title: 'Organisation' }
  ];

  window.OA_TOOLS = [
    // Im Ernstfall
    { id: 'assistent', group: 'ernstfall', icon: 'alert', title: 'Notfall-Assistent', sub: 'Was ist passiert?',
      desc: 'Fragen beantworten, dann Schritt für Schritt Anweisungen erhalten.', kw: 'entscheidungsbaum hilfe unfall bewusstlos atmet blutet notfall anleitung' },
    { id: 'metronom', group: 'ernstfall', icon: 'heart', title: 'Wiederbelebungs-Takt', sub: '100–120 pro Minute',
      desc: 'Takt mit Ton und Blinken für die Herzdruckmassage.', kw: 'reanimation herzdruckmassage metronom takt hlw wiederbelebung rhythmus' },
    { id: 'ablaufplan', group: 'ernstfall', icon: 'steps', title: 'Stromausfall-Plan', sub: 'Stunde 1 bis Woche 1',
      desc: 'Was wann zu tun ist: Stunde 1, Tag 1, Tag 3, Woche 1 zum Abhaken.', kw: 'stromausfall ablauf plan blackout stunden tage woche' },

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
    { id: 'karte', group: 'orientierung', icon: 'map', title: 'Offline-Karte', sub: 'Wasser, Ärzte, Anlaufstellen',
      desc: 'Karte von Baden-Württemberg mit Krankenhäusern, Apotheken, Wasserstellen und eigenen Punkten.', kw: 'karte kartenansicht krankenhaus apotheke wasserstelle defibrillator feuerwehr anlaufstelle leuchtturm treffpunkt' },

    // Signal & Funk
    { id: 'morse', group: 'signal', icon: 'morse', title: 'Morse-Code', sub: 'Text, Ton, Blinken',
      desc: 'Text in Morsecode umwandeln, als Ton abspielen oder Bildschirm blinken lassen.', kw: 'morsen sos signal ton blinker' },
    { id: 'sos', group: 'signal', icon: 'bulb', title: 'SOS-Licht', sub: 'Vollbild-Leuchte',
      desc: 'Bildschirm als weiße oder rote Lampe, mit SOS-Blinkmuster.', kw: 'taschenlampe licht notsignal blinken lampe leuchte' },
    { id: 'funk', group: 'signal', icon: 'radio', title: 'Funk-Spickzettel', sub: 'PMR, CB, Meshtastic',
      desc: 'PMR446-Kanäle, Freenet, CB-Funk, Meshtastic, Funkalphabet.', kw: 'pmr446 freenet cb funk walkie talkie meshtastic nato alphabet buchstabieren frequenz kanal' },

    // Mitteilen
    { id: 'aushaenge', group: 'mitteilen', icon: 'sign', title: 'Aushänge', sub: 'Druckbare Vorlagen',
      desc: 'Hilfe gesucht, Vermisstenmeldung, Treffpunkt: Aushang ausfüllen und drucken.', kw: 'aushang plakat vermisst hilfe gesucht treffpunkt zettel drucken' },
    { id: 'qrcode', group: 'mitteilen', icon: 'qr', title: 'QR-Code', sub: 'Von Handy zu Handy',
      desc: 'QR-Codes für Text, Koordinaten und Kontakte erzeugen, komplett offline.', kw: 'qr code teilen übertragen koordinaten kontakt' },
    { id: 'chat', group: 'mitteilen', icon: 'chat', title: 'Chat im lokalen Netz', sub: 'Ohne Internet im WLAN',
      desc: 'Mini-Server auf einem Laptop oder Raspberry Pi: alle im selben WLAN können schreiben.', kw: 'chat messenger wlan lokal server raspberry pi nachrichten nachbarn' },
    { id: 'ausdruck', group: 'mitteilen', icon: 'print', title: 'Ausdruck-Paket', sub: 'Das Wichtigste auf Papier',
      desc: 'Die wichtigsten Seiten auswählen und als Sammlung ausdrucken.', kw: 'ausdrucken drucken papier paket pdf sammlung' },

    // Natur & Bestimmen
    { id: 'pflanzen', group: 'natur', icon: 'leaf', title: 'Pflanzen & Pilze', sub: 'Gefährliche Doppelgänger',
      desc: 'Bestimmungshilfe mit Fotos: giftige Doppelgänger essbarer Pflanzen und Pilze.', kw: 'bestimmen pflanzen pilze beeren giftig doppelgänger bärlauch maiglöckchen knollenblätterpilz champignon' },
    { id: 'wolken', group: 'natur', icon: 'cloud', title: 'Wolken & Wetter', sub: 'Wetterzeichen erkennen',
      desc: 'Wolkenarten und Wetterzeichen, die Wetterumschwünge ankündigen.', kw: 'wetter wolken gewitter regen front vorhersage' },
    { id: 'sternbilder', group: 'natur', icon: 'star', title: 'Sternbilder', sub: 'Orientierung nachts',
      desc: 'Großer Wagen, Polarstern, Kassiopeia, Orion: Himmelsrichtung nachts finden.', kw: 'sterne sternbild polarstern großer wagen kassiopeia orion nacht norden' },
    { id: 'tierspuren', group: 'natur', icon: 'paw', title: 'Tierspuren', sub: 'Wer war das?',
      desc: 'Trittsiegel und Spuren häufiger Tiere in Deutschland erkennen.', kw: 'tierspuren trittsiegel fährte wildschwein reh fuchs wolf hund' },

    // Selbstversorgung
    { id: 'garten', group: 'selbst', icon: 'sprout', title: 'Gartenkalender', sub: 'Säen und ernten',
      desc: 'Was wann in Süddeutschland (mit Hinweisen für Baden-Württemberg) gesät, gepflanzt und geerntet wird.', kw: 'garten aussaat säen ernten gemüse kalender anbau beet' },
    { id: 'einkochen', group: 'selbst', icon: 'jar', title: 'Haltbar machen', sub: 'Einkochen, Fermentieren, Trocknen',
      desc: 'Rechner und Anleitungen für sicheres Haltbarmachen.', kw: 'einkochen einwecken fermentieren trocknen sauerkraut salz haltbar konservieren' },
    { id: 'brennholz', group: 'selbst', icon: 'log', title: 'Brennholz-Rechner', sub: 'Holzbedarf für den Ofen',
      desc: 'Wie viel Holz brauche ich für Raum und Zeit?', kw: 'holz brennholz ofen kamin heizen raummeter ster heizbedarf' },

    // Lernen & Üben
    { id: 'quiz', group: 'lernen', icon: 'question', title: 'Quiz', sub: 'Erste Hilfe, Morse, Funk',
      desc: 'Wissen testen: Erste Hilfe, Morsecode, Funkalphabet, Pflanzen.', kw: 'quiz test üben fragen lernen' },
    { id: 'knoten', group: 'lernen', icon: 'knot', title: 'Knoten', sub: 'Schritt für Schritt',
      desc: 'Wichtige Knoten mit Schritt-für-Schritt-Bildern.', kw: 'knoten palstek kreuzknoten seil leine stek' },
    { id: 'morsetrainer', group: 'lernen', icon: 'morse', title: 'Morse-Trainer', sub: 'Mit steigendem Tempo',
      desc: 'Morsezeichen hören und lernen, mit steigendem Tempo.', kw: 'morse trainer lernen hören koch methode' },

    // Organisation
    { id: 'inventar', group: 'organisation', icon: 'list', title: 'Vorratsliste', sub: 'Mit Ablaufwarnung',
      desc: 'Artikel, Menge und Ablaufdatum – mit Warnung und JSON-Export.', kw: 'inventar vorrat ablaufdatum haltbarkeit mhd liste export' },
    { id: 'notizen', group: 'organisation', icon: 'note', title: 'Notizen & Tagebuch', sub: 'Lokal gespeichert',
      desc: 'Notizen und Tagebuch mit Datum, nur auf diesem Gerät gespeichert.', kw: 'tagebuch notiz schreiben' },
    { id: 'kontakte', group: 'organisation', icon: 'users', title: 'Kontakte & Treffpunkte', sub: 'Familie, Adressen',
      desc: 'Notfallkontakte, Familien-Treffpunkt und wichtige Adressen.', kw: 'notfallkontakt treffpunkt telefon adresse familie' },
    { id: 'checklisten', group: 'organisation', icon: 'check', title: 'Checklisten', sub: 'Zum Abhaken',
      desc: 'Notgepäck, Hausapotheke, Stromausfall, Evakuierung, Winter, Dokumente.', kw: 'checkliste notgepäck fluchtrucksack hausapotheke evakuierung winter dokumente' },
    { id: 'notfallpass', group: 'organisation', icon: 'idcard', title: 'Notfallpass', sub: 'Pro Person zum Ausdrucken',
      desc: 'Blutgruppe, Allergien, Medikamente und Kontakte auf einer Karte.', kw: 'notfallpass blutgruppe allergie medikament ausweis karte' },
    { id: 'kinder', group: 'organisation', icon: 'smile', title: 'Kinderbereich', sub: 'Erklärt und Spiele',
      desc: 'Einfache Erklärungen für Kinder und Offline-Spiele gegen Langeweile.', kw: 'kinder spiele erklärung langeweile spielen' }
  ];

  /* Wissensseiten in sinnvoller Lesereihenfolge. Die Texte selbst liegen
   * in /content/*.md und werden von scripts/build.js zu /wissen/*.html.
   * group: 'notfall' oder 'draussen' (zwei Listen auf der Startseite). */
  window.OA_WISSEN_GROUPS = [
    { id: 'notfall', title: 'Wissen: Im Notfall' },
    { id: 'draussen', title: 'Wissen: Draußen & Technik' }
  ];
  window.OA_WISSEN = [
    { id: 'erste-hilfe', group: 'notfall', icon: 'aid', title: 'Erste Hilfe', sub: 'Seitenlage, Wiederbelebung, Blutung' },
    { id: 'stromausfall', group: 'notfall', icon: 'boltoff', title: 'Stromausfall-Leitfaden', sub: 'Die ersten Stunden und Tage' },
    { id: 'wasser', group: 'notfall', icon: 'drop', title: 'Wasser finden & aufbereiten', sub: 'Sicher trinken' },
    { id: 'hygiene', group: 'notfall', icon: 'sparkle', title: 'Hygiene & Sanitär', sub: 'Ohne fließendes Wasser' },
    { id: 'feuer-waerme', group: 'draussen', icon: 'flame', title: 'Feuer, Wärme & Unterschlupf', sub: 'Warm bleiben' },
    { id: 'nahrung', group: 'draussen', icon: 'leaf', title: 'Nahrung', sub: 'Vorrat, haltbar machen, Pflanzen' },
    { id: 'navigation', group: 'draussen', icon: 'map', title: 'Navigation ohne GPS', sub: 'Karte, Sonne, Sterne' },
    { id: 'kommunikation', group: 'draussen', icon: 'antenna', title: 'Kommunikation & Funk', sub: 'Gehört werden' },
    { id: 'strom-energie', group: 'draussen', icon: 'plug', title: 'Strom & Energie off-grid', sub: 'Akkus, Solar, Aggregat' },
    { id: 'reparatur', group: 'draussen', icon: 'wrench', title: 'Reparatur-Basics', sub: 'Fahrrad, Wasser, Strom-Sicherheit' }
  ];
})();
