/* Offline-Ark – Rechenkern des Brennholz-Rechners (läuft im Browser und in Node).
 * Alle Ergebnisse sind Näherungen (Richtwerte). Siehe Kommentar in data/brennholz.js. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../data/brennholz.js'));
  else root.OA_BRENNHOLZ_CORE = factory(root.OA_BRENNHOLZ);
})(typeof window !== 'undefined' ? window : this, function (D) {
  'use strict';

  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /** Heizwert in kWh/kg bei Wassergehalt w (Anteil 0..1), bezogen auf den Tabellenwert für 15 % Wassergehalt. */
  function kwhPerKg(sp, w) {
    var f = function (x) { return D.dryEnergy - (D.dryEnergy + D.evapEnergy) * x; };
    return sp.kwhKg * f(w) / f(D.refWater);
  }
  /** Energie je Raummeter in kWh bei Wassergehalt w: Trockenmasse bleibt gleich, Gewicht wächst mit dem Wasser. */
  function kwhPerRm(sp, w) {
    var dry = sp.kgRm * (1 - D.refWater);
    return dry / (1 - w) * kwhPerKg(sp, w);
  }
  /** Wärmeverlust je m² Fläche und Kelvin in W/(m²·K) für eine Klasse. */
  function lossFactor(ins) { return ins.kwhM2a * 1000 / D.fullLoadHours / D.designDeltaT; }

  /**
   * in: { area (m²) | volume (m³) + height (m), insulation, tIn, tOut, hours, days,
   *       species, water (% Wassergehalt), stove, len ('33'|'100') }
   */
  function calc(inp) {
    var ins = byId(D.insulation, inp.insulation), sp = byId(D.species, inp.species), st = byId(D.stoves, inp.stove);
    var height = clamp(isFinite(inp.height) ? inp.height : 2.5, 1.8, 6);
    var area = isFinite(inp.area) ? inp.area : (isFinite(inp.volume) ? inp.volume / height : NaN);
    var tIn = isFinite(inp.tIn) ? inp.tIn : 20, tOut = isFinite(inp.tOut) ? inp.tOut : -5;
    var hours = clamp(isFinite(inp.hours) ? inp.hours : 10, 0, 24), days = clamp(isFinite(inp.days) ? inp.days : 7, 0, 366);
    var wPct = clamp(isFinite(inp.water) ? inp.water : 15, 5, 60), w = wPct / 100;
    var len = inp.len === '100' ? '100' : '33';
    var out = { ok: false, warnings: [] };
    if (!(area > 0)) return out;
    var dT = Math.max(0, tIn - tOut);
    var powerW = lossFactor(ins) * area * dT;
    var heatKwh = powerW * hours * days / 1000;
    var fuelKwh = heatKwh / st.eta;
    var kgNeeded = fuelKwh / kwhPerKg(sp, w);
    var rm = fuelKwh / kwhPerRm(sp, w);
    var conv = D.conv[len];
    out = {
      ok: true, warnings: [], area: area, dT: dT, powerKw: powerW / 1000, lossFactor: lossFactor(ins),
      heatKwh: heatKwh, fuelKwh: fuelKwh, kg: kgNeeded, kgPerDay: days > 0 ? kgNeeded / days : 0,
      rm: rm, fm: rm * conv.fm, srm: rm * conv.srm,
      stackDepth: rm / (D.stack.height * D.stack.width), kwhKg: kwhPerKg(sp, w), kwhRm: kwhPerRm(sp, w), eta: st.eta
    };
    if (wPct > D.maxWaterLegal) out.warnings.push('wet');
    if (tOut >= tIn) out.warnings.push('nodiff');
    if (st.eta <= 0.3) out.warnings.push('open');
    return out;
  }

  return { calc: calc, kwhPerKg: kwhPerKg, kwhPerRm: kwhPerRm, lossFactor: lossFactor, byId: byId };
});
