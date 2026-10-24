/* Test der Einheiten-Umrechnung: node scripts/test-einheiten.js */
'use strict';
var assert = require('assert');
var E = require('../data/einheiten.js');
var fmt = function (n, d) { return n.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: 0 }); };
function close(a, b, msg) { assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), msg + ': ' + a + ' != ' + b); }

close(E.convert('laenge', 'zoll', 'mm', 1), 25.4, 'Zoll->mm');
close(E.convert('laenge', 'meile', 'm', 1), 1609.344, 'Meile');
close(E.convert('laenge', 'seemeile', 'm', 1), 1852, 'Seemeile');
close(E.convert('laenge', 'km', 'meile', 1.609344), 1, 'km->Meile');
close(E.convert('gewicht', 'pfund', 'g', 1), 453.59237, 'Pfund');
close(E.convert('gewicht', 'kg', 'unze', 1), 35.27396195, 'kg->oz');
close(E.convert('volumen', 'galus', 'l', 1), 3.785411784, 'Gallone US');
close(E.convert('volumen', 'galuk', 'l', 1), 4.54609, 'Gallone UK');
close(E.convert('volumen', 'm3', 'l', 1), 1000, 'm3');
close(E.convert('volumen', 'tasse', 'ml', 1), 236.5882365, 'Tasse');
close(E.convert('temperatur', 'c', 'f', 100), 212, '100 C');
close(E.convert('temperatur', 'c', 'f', 0), 32, '0 C');
close(E.convert('temperatur', 'f', 'c', -40), -40, '-40 F');
close(E.convert('temperatur', 'c', 'k', 0), 273.15, '0 C in K');
close(E.convert('temperatur', 'k', 'c', 0), -273.15, '0 K');
close(E.convert('temperatur', 'f', 'k', 32), 273.15, '32 F');
close(E.convert('flaeche', 'ha', 'm2', 1), 10000, 'ha');
close(E.convert('flaeche', 'acre', 'm2', 1), 4046.8564224, 'acre');
close(E.convert('tempo', 'kmh', 'ms', 36), 10, 'km/h');
close(E.convert('tempo', 'kn', 'kmh', 1), 1.852, 'Knoten');
close(E.convert('tempo', 'mph', 'kmh', 1), 1.609344, 'mph');
close(E.convert('energie', 'kcal', 'j', 1), 4184, 'kcal');
close(E.convert('energie', 'kwh', 'wh', 1), 1000, 'kWh');
close(E.convert('energie', 'kj', 'kcal', 4.184), 1, 'kJ->kcal');
close(E.convert('akku', 'mah', 'wh', 5000, 3.7), 18.5, 'mAh->Wh');
close(E.convert('akku', 'wh', 'mah', 18.5, 3.7), 5000, 'Wh->mAh');
close(E.convert('akku', 'ah', 'wh', 2, 12), 24, 'Ah->Wh');
close(E.convert('akku', 'ah', 'mah', 1, 3.7), 1000, 'Ah->mAh');
close(E.convert('akku', 'wh', 'ah', 24, 12), 2, 'Wh->Ah');

// Umkehrbarkeit für alle Paare
E.cats.forEach(function (c) {
  c.units.forEach(function (a) { c.units.forEach(function (b) {
    var r = E.convert(c.id, a.id, b.id, 12.5, 3.7);
    close(E.convert(c.id, b.id, a.id, r, 3.7), 12.5, c.id + ' ' + a.id + '<->' + b.id);
  }); });
});

assert.strictEqual(E.format(25.4, fmt), '25,4');
assert.strictEqual(E.format(E.convert('laenge', 'zoll', 'mm', 1), fmt), '25,4');
assert.strictEqual(E.format(1609.344, fmt), '1.609,344');
assert.strictEqual(E.format(1 / 3, fmt), '0,3333333');
assert.strictEqual(E.format(0, fmt), '0');
assert.strictEqual(E.format(NaN, fmt), '–');
assert.strictEqual(E.format(E.convert('temperatur', 'c', 'k', 0), fmt), '273,15');
assert.ok(isNaN(E.convert('laenge', 'xx', 'm', 1)));
console.log('Einheiten: alle Tests bestanden');
