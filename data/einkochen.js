/* Offline-Ark – Daten für "Haltbar machen" (data/einkochen.js).
 * Sicherheitsregeln (Botulismus): BfR, "Selten, aber vermeidbar: Fragen und Antworten zum Botulismus" (2025)
 * und BfR-Verbrauchertipps "Schutz vor Botulismus durch Lebensmittel" (2020).
 *  - Sporen von Clostridium botulinum überleben 100 °C; Sterilisation unter Überdruck bei 121 °C (3 Minuten im ganzen Lebensmittel) tötet sie ab.
 *  - Im Haushalt (Wasserbad, Backofen) wird 100 °C nicht überschritten. Gemüse (vor allem Bohnen), Fleisch: möglichst unter Druck auf 121 °C
 *    erhitzen. Sonst zweimal auf 100 °C im Abstand von ein bis zwei Tagen (dazwischen Raumtemperatur) und direkt vor dem Verzehr
 *    nochmals auf 100 °C erhitzen. Alternativ ansäuern auf pH unter 4,6.
 *  - Marmelade: BZfE, "Obst einkochen" (Einfache Sprache): Gelierzucker 1:1, 2:1, 3:1; Gläser sauber (Spülmaschine oder mindestens
 *    fünf Minuten in kochendem Wasser), heiß abfüllen, dunkel lagern, bei 15 bis 20 °C etwa ein Jahr haltbar.
 *  - Fermentieren: Wikipedia "Sauerkraut": rund 2 % Salz empfohlen, bis 8 % möglich; Lake muss das Gemüse bedecken; 2 bis 6 Wochen.
 *  - Trocknen: Wikipedia "Dörren": 30 bis 70 °C, 6 bis 12 Stunden (Obst, Gemüse, Pilze); Kräuter 2 bis 3 Wochen an der Luft;
 *    Restfeuchte 10 bis 15 %; Schimmelpilze wachsen bis etwa 15 % Wassergehalt.
 */
(function (root, data) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = data; else root.OA_EINKOCHEN = data;
})(typeof window !== 'undefined' ? window : this, {
  // Gelierzucker-Verhältnis: Früchte : Zucker = n : 1
  jamRatios: [1, 2, 3],
  // Salzanteile für das Fermentieren (Prozent vom Gemüsegewicht)
  saltPercents: [2, 2.5, 3],
  saltDefault: 2,
  // Zweite Erhitzung: ein bis zwei Tage nach der ersten (in Stunden)
  secondHeatHours: [24, 48],
  sources: [
    { name: 'BfR – Selten, aber vermeidbar: Fragen und Antworten zum Botulismus', url: 'https://www.bfr.bund.de/fragen-und-antworten/thema/selten-aber-vermeidbar-fragen-und-antworten-zum-botulismus/', license: '© BfR – nur in eigenen Worten zusammengefasst', note: 'Erhitzen, Säure, Erkennen, Entsorgen' },
    { name: 'BfR – Schutz vor Botulismus durch Lebensmittel (Verbrauchertipps)', url: 'https://www.bfr.bund.de/cm/350/hinweise_fuer_verbraucher_zum_botulismus_durch_lebensmittel.pdf', license: '© BfR – nur in eigenen Worten zusammengefasst', note: 'Doppeltes Erhitzen, Honig, Öl' },
    { name: 'BfR – Schimmelpilze in Lebensmitteln', url: 'https://www.bfr.bund.de/fragen-und-antworten/thema/schimmelpilze-in-lebensmitteln-gesundheitliche-risiken-und-wie-sie-sich-vermeiden-lassen/', license: '© BfR – nur in eigenen Worten zusammengefasst', note: 'Schimmel, Trocknung, Entsorgen' },
    { name: 'BZfE – Obst einkochen (Einfache Sprache)', url: 'https://www.bzfe.de/einfache-sprache/kochen-und-aufbewahren/obst-einkochen', license: '© BZfE/BLE – nur in eigenen Worten zusammengefasst', note: 'Gelierzucker, Gläser, Lagerung' },
    { name: 'Wikipedia – Einwecken', url: 'https://de.wikipedia.org/wiki/Einwecken', license: 'CC BY-SA 4.0', note: 'Einkochgläser, Vakuum, Füllhöhe' },
    { name: 'Wikipedia – Sauerkraut', url: 'https://de.wikipedia.org/wiki/Sauerkraut', license: 'CC BY-SA 4.0', note: 'Salzgehalt, Lake, Gärdauer' },
    { name: 'Wikipedia – Dörren', url: 'https://de.wikipedia.org/wiki/D%C3%B6rren', license: 'CC BY-SA 4.0', note: 'Temperatur, Dauer, Restfeuchte, Lagerung' },
    { name: 'Wikipedia – Milchsäuregärung', url: 'https://de.wikipedia.org/wiki/Milchs%C3%A4ureg%C3%A4rung', license: 'CC BY-SA 4.0', note: 'Beispiele fermentierter Lebensmittel' }
  ]
});
