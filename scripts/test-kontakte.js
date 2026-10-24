/* Test der Kontakte-Logik: node scripts/test-kontakte.js */
'use strict';
var assert = require('assert');
var K = require('../js/kontakte-core.js');

assert.strictEqual(K.telHref('0151 123 45-67'), 'tel:01511234567');
assert.strictEqual(K.telHref('+49 (0) 151 1234'), 'tel:+4901511234');
assert.strictEqual(K.telHref('116 117'), 'tel:116117');
assert.strictEqual(K.telHref('keine'), '');
assert.strictEqual(K.telHref('javascript:alert(1)'), 'tel:1');
assert.strictEqual(K.telHref('1+2'), 'tel:12');

assert.strictEqual(K.sanitize.kontakte({ name: ' ' }), null);
var c = K.sanitize.kontakte({ name: ' Anna ', phone: '123', star: 'ja' });
assert.strictEqual(c.name, 'Anna'); assert.strictEqual(c.star, false);
assert.strictEqual(K.sanitize.treffpunkte({ name: 'X', type: 'mond' }).type, 'nah');
assert.strictEqual(K.sanitize.adressen({ name: 'X', cat: 'Foo' }).cat, 'Sonstiges');
assert.strictEqual(K.sanitize.adressen({ name: 'X', cat: 'Apotheke' }).cat, 'Apotheke');

// Reihenfolge: Wichtige zuerst, Verschieben nur innerhalb der Gruppe
var list = [{ id: 'a', star: false }, { id: 'b', star: true }, { id: 'c', star: false }, { id: 'd', star: true }];
assert.deepStrictEqual(K.displayContacts(list).map(function (x) { return x.id; }), ['b', 'd', 'a', 'c']);
assert.deepStrictEqual(K.moveContact(list, 'd', -1).map(function (x) { return x.id; }), ['a', 'd', 'c', 'b']);
assert.strictEqual(K.moveContact(list, 'b', -1), list);                       // schon oben
assert.strictEqual(K.moveContact(list, 'd', 1), list);                        // Gruppengrenze
assert.deepStrictEqual(K.moveContact(list, 'a', 1).map(function (x) { return x.id; }), ['c', 'b', 'a', 'd']);

var mt = K.sortMeetings([{ id: '1', type: 'aussen' }, { id: '2', type: 'nah' }, { id: '3', type: 'viertel' }, { id: '4', type: 'nah' }]);
assert.deepStrictEqual(mt.map(function (x) { return x.id; }), ['2', '4', '3', '1']);
var ad = K.sortAddresses([{ id: '1', cat: 'Sonstiges' }, { id: '2', cat: 'Arzt' }]);
assert.deepStrictEqual(ad.map(function (x) { return x.id; }), ['2', '1']);

var file = JSON.stringify({ app: 'offline-ark-kontakte', kontakte: [{ name: 'A' }, { phone: '1' }], treffpunkte: [{ name: 'T', type: 'viertel' }] });
var r = K.parseImport(file);
assert.strictEqual(r.kontakte.length, 1); assert.strictEqual(r.treffpunkte.length, 1); assert.strictEqual(r.adressen.length, 0); assert.strictEqual(r.skipped, 1);
assert.throws(function () { K.parseImport('{'); });
assert.throws(function () { K.parseImport('{"app":"offline-ark-kontakte"}'); });
assert.throws(function () { K.parseImport('[]'); });

var m = K.merge([{ id: 'a', name: 'alt' }], [{ id: 'a', name: 'neu' }, { id: 'b', name: 'B' }]);
assert.deepStrictEqual(m.map(function (x) { return x.name; }), ['neu', 'B']);
console.log('Kontakte: alle Tests bestanden');
