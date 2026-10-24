/* Test des Gartenkalenders: node scripts/test-garten.js */
'use strict';
var assert = require('assert');
var D = require('../data/garten.js');
var C = require('../js/garten-core.js');
var MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Datenintegrität
var ids = {}, names = {};
D.crops.forEach(function (c) {
  assert.ok(!ids[c.id] && !names[c.name], 'doppelt: ' + c.id); ids[c.id] = names[c.name] = true;
  ['pre', 'sow', 'plant', 'plantFoil', 'harvest', 'harvestFoil'].forEach(function (k) {
    (c[k] || []).forEach(function (r) { assert.ok(r[0] >= 0 && r[1] <= 12 && r[0] < r[1], c.id + '.' + k + ' ungültig: ' + r); });
  });
  assert.ok(c.harvest && c.harvest.length, c.id + ' ohne Ernte');
  assert.ok((c.sow || []).length + (c.plant || []).length > 0, c.id + ' ohne Aussaat oder Pflanzung');
});
assert.ok(D.crops.length >= 35, 'mindestens 35 Kulturen');
D.sources.forEach(function (s) { assert.ok(s.name && /^https:\/\//.test(s.url) && s.license && s.note); });
var crop = function (id) { return D.crops.filter(function (c) { return c.id === id; })[0]; };

// Beispiele aus der LWG-Tabelle
assert.ok(C.flags(crop('tomate'), 2).pre, 'Tomate: Vorkultur im März');
assert.ok(!C.flags(crop('tomate'), 3).plant && C.flags(crop('tomate'), 4).plant, 'Tomate: Pflanzung erst im Mai');
assert.ok(C.flags(crop('tomate'), 7).harvest && !C.flags(crop('tomate'), 2).harvest);
assert.ok(C.flags(crop('radieschen'), 3).sow && C.flags(crop('radieschen'), 7).sow && !C.flags(crop('radieschen'), 10).sow);
assert.ok(C.flags(crop('kartoffel'), 4).plant && !C.flags(crop('kartoffel'), 3).plant, 'Kartoffel (Lager) im Mai legen');
assert.ok(C.flags(crop('feldsalat'), 0).harvest && C.flags(crop('feldsalat'), 11).harvest && !C.flags(crop('feldsalat'), 5).harvest);
assert.ok(C.flags(crop('gruenkohl'), 0).harvest && C.flags(crop('gruenkohl'), 10).harvest, 'Grünkohl: Ernte bis Februar');
assert.ok(C.flags(crop('erdbeere'), 6).plant && C.flags(crop('erdbeere'), 5).harvest);
assert.ok(C.flags(crop('kresse'), 3).sow && C.flags(crop('kresse'), 8).harvest);

// Filter
function listNames(m, f) { return D.crops.filter(function (c) { return C.matches(c, m, f); }).map(function (c) { return c.id; }); }
assert.strictEqual(listNames(5, 'all').length, D.crops.length);
assert.ok(listNames(5, 'harvest').indexOf('erdbeere') !== -1 && listNames(5, 'harvest').indexOf('feldsalat') === -1);
assert.ok(listNames(3, 'sow').indexOf('moehre') !== -1);
assert.ok(listNames(11, 'sow').length === 0, 'Dezember: nichts zu säen');
assert.ok(listNames(11, 'harvest').indexOf('gruenkohl') !== -1);

// Textpunkte
assert.deepStrictEqual(C.point(2, false), { m: 2, pos: 'start' });
assert.deepStrictEqual(C.point(3.5, false), { m: 3, pos: 'mid' });
assert.deepStrictEqual(C.point(5, true), { m: 4, pos: 'end' });
assert.deepStrictEqual(C.point(6.5, true), { m: 6, pos: 'mid' });
assert.deepStrictEqual(C.point(12, true), { m: 11, pos: 'end' });
assert.deepStrictEqual(C.point(0.75, false), { m: 0, pos: 'end' });
var d = C.describe(crop('radieschen').sow)[0];
assert.strictEqual(MON[d.a.m] + ' ' + d.a.pos + ' – ' + MON[d.b.m] + ' ' + d.b.pos, 'Mär mid – Sep mid');
console.log('garten: alle Tests bestanden (' + D.crops.length + ' Kulturen)');
