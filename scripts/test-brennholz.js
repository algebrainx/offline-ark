/* Test der Brennholz-Formeln: node scripts/test-brennholz.js */
'use strict';
var assert = require('assert');
var C = require('../js/brennholz-core.js');
var D = require('../data/brennholz.js');
function near(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' erwartet ' + b + ' ± ' + tol + ', ist ' + a); }

// Heizwert je kg: Tabellenwert bei 15 %, Beispielrechnung Wikipedia: 20 % Wassergehalt -> rund 4,03 kWh/kg bei 5,2 kWh Trockenmasse
var buche = C.byId(D.species, 'buche');
near(C.kwhPerKg(buche, 0.15), 4.2, 1e-9, 'Buche 15 %');
near(C.kwhPerKg(buche, 0.20), 4.2 * (5.2 - 5.83 * 0.20) / (5.2 - 5.83 * 0.15), 1e-9, 'Buche 20 %');
assert.ok(C.kwhPerKg(buche, 0.20) < C.kwhPerKg(buche, 0.15), 'feuchter = weniger Heizwert');
assert.ok(C.kwhPerKg(buche, 0.20) > 3.8 && C.kwhPerKg(buche, 0.20) < 4.0, 'ca. 3,9 kWh/kg bei 20 %');
near(C.kwhPerRm(buche, 0.15), 2016, 1e-6, 'Buche kWh/Rm bei 15 %');
near(C.kwhPerRm(C.byId(D.species, 'fichte'), 0.15), 330 * 4.3, 1e-6, 'Fichte kWh/Rm');

// Verlustfaktor: Klasse B -> 75000 / 1600 / 30 = 1,5625 W/(m²K)
near(C.lossFactor(C.byId(D.insulation, 'gut')), 1.5625, 1e-9, 'Verlustfaktor B');
near(C.lossFactor(C.byId(D.insulation, 'schlecht')), 250000 / 1600 / 30, 1e-9, 'Verlustfaktor G');

// Beispiel: 25 m², gut gedämmt, 20 °C innen, −5 °C außen, 10 h/Tag, 7 Tage, Buche 15 %, moderner Ofen 80 %
var r = C.calc({ area: 25, insulation: 'gut', tIn: 20, tOut: -5, hours: 10, days: 7, species: 'buche', water: 15, stove: 'modern', len: '33' });
assert.ok(r.ok);
near(r.dT, 25, 1e-9, 'dT');
near(r.powerKw, 1.5625 * 25 * 25 / 1000, 1e-9, 'Leistung kW');           // 0,9766 kW
near(r.heatKwh, 0.9765625 * 70, 1e-6, 'Wärmebedarf kWh');                // 68,36 kWh
near(r.fuelKwh, r.heatKwh / 0.8, 1e-9, 'Brennstoffenergie');
near(r.kg, r.fuelKwh / 4.2, 1e-6, 'kg');                                  // 20,3 kg
near(r.rm, r.fuelKwh / 2016, 1e-9, 'Rm');                                 // 0,0424 Rm
near(r.fm, r.rm * 0.62, 1e-9, 'Fm (33 cm)');
near(r.srm, r.rm * 1.48, 1e-9, 'Srm (33 cm)');
near(r.stackDepth, r.rm / 2, 1e-9, 'Stapeltiefe');

// Volumen statt Fläche: 62,5 m³ bei 2,5 m Höhe = 25 m²
var v = C.calc({ volume: 62.5, height: 2.5, insulation: 'gut', tIn: 20, tOut: -5, hours: 10, days: 7, species: 'buche', water: 15, stove: 'modern', len: '33' });
near(v.heatKwh, r.heatKwh, 1e-9, 'Volumen = Fläche × Höhe');

// Schlechter gedämmt braucht mehr; offener Kamin braucht mehr; Nadelholz braucht mehr Raummeter
var bad = C.calc({ area: 25, insulation: 'schlecht', tIn: 20, tOut: -5, hours: 10, days: 7, species: 'buche', water: 15, stove: 'modern' });
assert.ok(bad.heatKwh > r.heatKwh * 3, 'Klasse G ≈ 3,3-mal Klasse B');
var open = C.calc({ area: 25, insulation: 'gut', tIn: 20, tOut: -5, hours: 10, days: 7, species: 'buche', water: 15, stove: 'offen' });
assert.ok(open.kg > r.kg * 2.5 && open.warnings.indexOf('open') !== -1);
var fichte = C.calc({ area: 25, insulation: 'gut', tIn: 20, tOut: -5, hours: 10, days: 7, species: 'fichte', water: 15, stove: 'modern' });
assert.ok(fichte.rm > r.rm * 1.4, 'Fichte braucht mehr Raummeter');
near(fichte.kg, r.kg * 4.2 / 4.3, 1e-6, 'kg Fichte');

// Zu feuchtes Holz: Warnung und mehr Masse
var wet = C.calc({ area: 25, insulation: 'gut', tIn: 20, tOut: -5, hours: 10, days: 7, species: 'buche', water: 35, stove: 'modern' });
assert.ok(wet.warnings.indexOf('wet') !== -1 && wet.kg > r.kg);

// Kein Temperaturunterschied: 0 kWh, Warnung
var none = C.calc({ area: 25, insulation: 'gut', tIn: 20, tOut: 20, hours: 10, days: 7, species: 'buche', water: 15, stove: 'modern' });
assert.strictEqual(none.heatKwh, 0); assert.ok(none.warnings.indexOf('nodiff') !== -1);

// Ungültige Eingabe
assert.strictEqual(C.calc({ area: NaN, insulation: 'gut' }).ok, false);

console.log('brennholz: alle Tests bestanden (Beispiel: ' + r.heatKwh.toFixed(1) + ' kWh Wärme, ' + r.kg.toFixed(1) + ' kg Buche, ' + r.rm.toFixed(3) + ' Rm)');
