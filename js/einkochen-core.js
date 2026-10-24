/* Offline-Ark – Rechenkern für "Haltbar machen" (Browser und Node). Alle Ergebnisse sind Richtwerte. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../data/einkochen.js'));
  else root.OA_EINKOCHEN_CORE = factory(root.OA_EINKOCHEN);
})(typeof window !== 'undefined' ? window : this, function (D) {
  'use strict';

  /** Gelierzucker in Gramm: Verhältnis Früchte : Zucker = ratio : 1 (1:1, 2:1, 3:1). */
  function jamSugar(fruitG, ratio) {
    if (!(fruitG > 0) || !(ratio > 0)) return NaN;
    return fruitG / ratio;
  }

  /** Salz in Gramm für Gemüsegewicht (g) und Salzanteil (%). */
  function saltGrams(vegG, percent) {
    if (!(vegG > 0) || !(percent > 0)) return NaN;
    return vegG * percent / 100;
  }

  /** Zeitfenster für die zweite Erhitzung: ein bis zwei Tage (24 bis 48 Stunden) nach der ersten. */
  function secondHeat(startMs) {
    if (!isFinite(startMs)) return null;
    return { from: startMs + D.secondHeatHours[0] * 3600000, to: startMs + D.secondHeatHours[1] * 3600000 };
  }

  /** Datum (yyyy-mm-dd) und Uhrzeit (hh:mm) als lokale Zeit in Millisekunden. */
  function localMs(dateStr, timeStr) {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '')), t = /^(\d{1,2}):(\d{2})$/.exec(String(timeStr || ''));
    if (!d || !t) return NaN;
    return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], 0, 0).getTime();
  }

  return { jamSugar: jamSugar, saltGrams: saltGrams, secondHeat: secondHeat, localMs: localMs };
});
