/* Offline-Ark – Knoten: Zeichnungen (Seile als Stützpunkte, siehe js/knoten-core.js).
 * Hier nur der Kreuzknoten, dessen Zeichnung rechnerisch geprüft ist (scripts/test-knoten.js):
 *   Kreuzknoten:  nach dem Wikimedia-Diagramm "Square knot.svg" (6 Kreuzungen); Jones-Polynom des geschlossenen Knotens = Trefoil × Spiegel-Trefoil.
 * Alle anderen Knoten haben Fotos und/oder Textschritte (data/knoten.js). Eine Achterknoten-Zeichnung (Zopf-Abschluss, 4_1) war
 * zwar mathematisch richtig, zeigte aber einen Zopf statt der Knüpfschritte und wurde deshalb entfernt. */
(function () {
  'use strict';

  /* Kreuzknoten (Rifknoten): zwei ineinandergehakte Buchten. a = rotes Seil (beide Enden links), b = blaues Seil (beide Enden rechts). */
  var reef = {
    vb: [-85, -20, 670, 310], w: 22, gap: 6,
    ropes: [
      { id: 'a', cls: 'a', pts: [
        [70, 95, 1], [115, 95, 1], [190, 95, 1], [205, 88, 0], [252, 52, -1], [300, 18, 0], [345, 40, 1], [352, 100, 1], [350, 190, 1],
        [320, 245, 0], [270, 258, -1], [240, 228, -1], [200, 197, 0], [150, 190, 1], [0, 190, 1]
      ] },
      { id: 'b', cls: 'b', pts: [
        [430, 95, -1], [360, 95, -1], [300, 95, -1], [275, 78, 0], [246, 55, 1], [205, 22, 1], [168, 22, 0], [148, 60, -1], [148, 100, -1], [148, 190, -1],
        [162, 230, 0], [200, 255, 1], [240, 250, 1], [285, 215, 1], [320, 192, 0], [352, 190, -1], [500, 190, -1]
      ] }    ],
    // Reihenfolge, in der die Enden zum geschlossenen Knoten verbunden werden (Prüfung): a vorwärts, dann b rückwärts
    closure: [['a', 'f'], ['b', 'b']]
  };

  var api = { reef: reef };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_KNOTEN_SCENES = api;
})();
