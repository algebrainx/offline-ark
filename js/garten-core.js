/* Offline-Ark – Rechenkern des Gartenkalenders (Browser und Node). */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OA_GARTEN_CORE = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /** Überlappung (in Monaten) eines Bereichs [a, b] mit Monat m (0 = Januar). */
  function overlap(r, m) { return Math.min(r[1], m + 1) - Math.max(r[0], m); }
  function activeIn(ranges, m) {
    if (!ranges) return false;
    for (var i = 0; i < ranges.length; i++) if (overlap(ranges[i], m) > 0.01) return true;
    return false;
  }

  /** Was ist in Monat m zu tun? */
  function flags(crop, m) {
    return { pre: activeIn(crop.pre, m), sow: activeIn(crop.sow, m), plant: activeIn(crop.plant, m), harvest: activeIn(crop.harvest, m) };
  }

  /** filter: 'all' | 'sow' (vorziehen, säen, pflanzen) | 'harvest' */
  function matches(crop, m, filter) {
    var f = flags(crop, m);
    if (filter === 'sow') return f.pre || f.sow || f.plant;
    if (filter === 'harvest') return f.harvest;
    return true;
  }

  /** Position im Monat für Anfang (isEnd = false) oder Ende eines Bereichs: 'start' | 'mid' | 'end'. */
  function point(v, isEnd) {
    var m, frac;
    if (isEnd) {
      if (Math.abs(v - Math.round(v)) < 0.01) return { m: Math.round(v) - 1, pos: 'end' };
      m = Math.floor(v); frac = v - m;
      return { m: m, pos: frac < 0.35 ? 'start' : (frac < 0.75 ? 'mid' : 'end') };
    }
    m = Math.floor(v + 0.001); frac = v - m;
    return { m: m, pos: frac < 0.25 ? 'start' : (frac < 0.65 ? 'mid' : 'end') };
  }

  /** Bereiche als lesbare Anfangs- und Endpunkte. */
  function describe(ranges) {
    return (ranges || []).map(function (r) { return { a: point(r[0], false), b: point(r[1], true) }; });
  }

  return { overlap: overlap, activeIn: activeIn, flags: flags, matches: matches, point: point, describe: describe };
});
