/* Offline-Ark – Daten für den Brennholz-Rechner (data/brennholz.js).
 * Alle Werte sind Näherungen; Quellen stehen auf der Werkzeug-Seite.
 *  - Heizwert und Handelsdichte je Holzart (lufttrocken, ca. 15 % Wassergehalt): Tabelle in Wikipedia "Brennholz"
 *    (Heizwert kWh/kg, Handelsdichte kg/Rm).
 *  - Energie von trockener Holzmasse: 5,2 kWh/kg, Verdampfungswärme des Wassers 0,63 kWh/kg (Beispielrechnung in Wikipedia "Brennholz").
 *  - Dämmstandard: Obergrenzen der Energieeffizienzklassen B, E, G nach Gebäudeenergiegesetz (GEG), Anlage 10
 *    (Endenergie in kWh pro m² Gebäudenutzfläche und Jahr: B ≤ 75, E ≤ 160, G ≤ 250).
 *  - Volllaststunden 1600 (untere Angabe der Kesselhersteller, 1600–2100 h) und Norm-Außentemperatur −10 °C
 *    als Beispiel (beides Wikipedia "Heizlast"): daraus die Heizlast bei 30 K Temperaturunterschied.
 *  - Ofenwirkungsgrad: Kaminöfen über 80 %, offene Kamine bis 30 % (Wikipedia "Brennholz"); 70 % ist ein vorsichtiger Annahmewert.
 *  - Umrechnung Raummeter/Festmeter/Schüttraummeter: TFZ Bayern (Buche, 2006) nach Wikipedia "Brennholz".
 */
(function (root, data) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = data; else root.OA_BRENNHOLZ = data;
})(typeof window !== 'undefined' ? window : this, {
  species: [
    { id: 'buche', name: 'Buche, Esche', kwhKg: 4.2, kgRm: 480 },
    { id: 'eiche', name: 'Eiche', kwhKg: 4.2, kgRm: 470 },
    { id: 'birke', name: 'Birke', kwhKg: 4.2, kgRm: 450 },
    { id: 'laerche', name: 'Lärche', kwhKg: 4.3, kgRm: 420 },
    { id: 'kiefer', name: 'Kiefer', kwhKg: 4.3, kgRm: 360 },
    { id: 'fichte', name: 'Fichte', kwhKg: 4.3, kgRm: 330 }
  ],
  insulation: [
    { id: 'gut', name: 'Gut gedämmt', klass: 'B', kwhM2a: 75 },
    { id: 'mittel', name: 'Mittel', klass: 'E', kwhM2a: 160 },
    { id: 'schlecht', name: 'Schlecht gedämmt', klass: 'G', kwhM2a: 250 }
  ],
  stoves: [
    { id: 'offen', name: 'Offener Kamin', eta: 0.30 },
    { id: 'normal', name: 'Kaminofen (vorsichtig gerechnet)', eta: 0.70 },
    { id: 'modern', name: 'Moderner Kaminofen', eta: 0.80 }
  ],
  fullLoadHours: 1600,     // h/a
  designDeltaT: 30,        // K (20 °C innen, −10 °C außen)
  dryEnergy: 5.2,          // kWh pro kg trockener Holzmasse
  evapEnergy: 0.63,        // kWh pro kg Wasser im Holz
  refWater: 0.15,          // Wassergehalt, für den die Tabellenwerte gelten
  maxWaterLegal: 20,       // % Wassergehalt, höchstens für Kaminöfen (Verbraucherzentrale)
  // Umrechnung von 1 Raummeter Scheite: [Festmeter, Schüttraummeter] (Buche, TFZ 2006)
  conv: { '33': { fm: 0.62, srm: 1.48 }, '100': { fm: 0.50, srm: 1.20 } },
  stack: { height: 1, width: 2 },  // m, Beispiel-Stapel
  sources: [
    { name: 'Wikipedia – Brennholz', url: 'https://de.wikipedia.org/wiki/Brennholz', license: 'CC BY-SA 4.0', note: 'Heizwerte, Handelsdichte, Wirkungsgrade, Umrechnung Raummeter (TFZ Bayern)' },
    { name: 'Wikipedia – Heizlast', url: 'https://de.wikipedia.org/wiki/Heizlast', license: 'CC BY-SA 4.0', note: 'Volllaststunden, Norm-Außentemperatur' },
    { name: 'Gesetze im Internet – Anlage 10: Energieeffizienzklassen von Wohngebäuden', url: 'https://www.gesetze-im-internet.de/geg/anlage_10.html', license: 'Amtliches Werk, gemeinfrei', note: 'Klassen B, E und G' },
    { name: 'Verbraucherzentrale – Kaminöfen umweltfreundlich nutzen', url: 'https://www.verbraucherzentrale.de/wissen/energie/heizen-und-warmwasser/kaminoefen-so-nutzen-sie-ihren-kaminofen-umweltfreundlich-44636', license: '© Verbraucherzentralen – nur in eigenen Worten zusammengefasst', note: 'Wassergehalt höchstens 20 %, zwei Jahre trocknen, Schornsteinfeger' },
    { name: 'Wikipedia – Kaminofen', url: 'https://de.wikipedia.org/wiki/Kaminofen', license: 'CC BY-SA 4.0', note: 'Luftzufuhr nicht drosseln' },
    { name: 'Wikipedia – Holzfeuchte', url: 'https://de.wikipedia.org/wiki/Holzfeuchte', license: 'CC BY-SA 4.0', note: 'Wassergehalt von frischem Holz' },
    { name: 'Wikipedia – Rauchmelder', url: 'https://de.wikipedia.org/wiki/Rauchmelder', license: 'CC BY-SA 4.0', note: 'Rauchmelderpflicht regeln die Bundesländer' },
    { name: 'BBK – Vorsorge und Handeln bei Stromausfall', url: 'https://www.bbk.bund.de/DE/Warnung-Vorsorge/Vorsorge/Stromausfall/stromausfall_node.html', license: '© BBK – nur in eigenen Worten zusammengefasst', note: 'Kohlenmonoxid-Warnmelder, regelmäßig lüften' }
  ]
});
