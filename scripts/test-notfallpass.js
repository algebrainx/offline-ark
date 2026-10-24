/* Test der Notfallpass-Logik: node scripts/test-notfallpass.js */
'use strict';
var assert = require('assert');
var P = require('../js/notfallpass-core.js');

var b = P.blank();
assert.strictEqual(b.contacts.length, 3);
assert.strictEqual(P.bloodText(b), '');
assert.strictEqual(P.bloodText({ abo: 'A', rh: '+' }), 'A Rh+');
assert.strictEqual(P.bloodText({ abo: '0', rh: '-' }), '0 Rh−');
assert.strictEqual(P.bloodText({ abo: 'AB', rh: '?' }), 'AB Rh?');
assert.strictEqual(P.bloodText({ abo: '?', rh: '+' }), '? Rh+');

assert.ok(P.validDate('2024-02-29')); assert.ok(!P.validDate('2025-02-29')); assert.ok(!P.validDate(''));
assert.strictEqual(P.dateLocal('1980-02-01', 'de-DE'), '01.02.1980');
assert.strictEqual(P.dateLocal('1980-02-01', 'en-GB'), '01/02/1980');
assert.strictEqual(P.dateLocal('1980-02-01', 'ar-u-nu-latn'), '01/02/1980');
assert.strictEqual(P.dateLocal('x'), '');

var p = P.sanitize({ name: '  Max  ', birth: '1980-13-01', abo: 'X', rh: '+', organ: 'vielleicht', pv: 'ja', contacts: [{ name: 'Anna', phone: '123' }], allergies: 'Nüsse', meds: 5 });
assert.strictEqual(p.name, 'Max'); assert.strictEqual(p.birth, ''); assert.strictEqual(p.abo, '?'); assert.strictEqual(p.rh, '+');
assert.strictEqual(p.organ, ''); assert.strictEqual(p.pv, 'ja'); assert.strictEqual(p.contacts.length, 3); assert.strictEqual(p.meds, '');
assert.strictEqual(P.sanitize(null), null); assert.ok(P.sanitize({}).id);

var full = P.sanitize({ name: 'Max Muster', birth: '1980-02-01', abo: 'A', rh: '+', allergies: 'Penicillin', conditions: 'Asthma', meds: 'laut Plan', implants: 'Schrittmacher',
  tetanus: '2022-03-04', organ: 'ja', organPlace: 'Portemonnaie', pv: 'nein', gpName: 'Dr. X', gpPhone: '030 1', contacts: [{ name: 'Anna', rel: 'Schwester', phone: '0151' }, {}, { name: 'Bob', phone: '2' }], langs: 'Deutsch', note: 'Bitte anrufen' });
var txt = P.toText(full);
assert.ok(txt.indexOf('Notfallpass: Max Muster, geboren 01.02.1980') === 0);
assert.ok(txt.indexOf('Blutgruppe: A Rh+') > 0 && txt.indexOf('Organspendeausweis: ja (Portemonnaie)') > 0 && txt.indexOf('Patientenverfügung: nein') > 0);
assert.ok(txt.indexOf('Notfallkontakt 1: Anna (Schwester), 0151') > 0 && txt.indexOf('Notfallkontakt 3: Bob, 2') > 0 && txt.indexOf('Notfallkontakt 2') < 0);
var txt2 = P.toText(full, { second: function (k) { return { Blutgruppe: 'Blood group' }[k] || k; } });
assert.ok(txt2.indexOf('Blutgruppe / Blood group: A Rh+') > 0 && txt2.indexOf('Allergien: ') > 0);
assert.strictEqual(P.toText(P.blank()), 'Notfallpass: –');

var imp = P.parseImport(JSON.stringify({ app: 'offline-ark-notfallpass', people: [{ name: 'A' }, null, { name: 'B' }] }));
assert.strictEqual(imp.people.length, 2); assert.strictEqual(imp.skipped, 1);
assert.throws(function () { P.parseImport('nope'); }); assert.throws(function () { P.parseImport('{"app":"x","people":[]}'); });
assert.throws(function () { P.parseImport('{"app":"offline-ark-notfallpass","people":[null]}'); });
var m = P.merge([{ id: 'a', name: 'alt' }], [{ id: 'a', name: 'neu' }, { id: 'b', name: 'B' }]);
assert.deepStrictEqual(m.map(function (x) { return x.name; }), ['neu', 'B']);
console.log('Notfallpass: alle Tests bestanden');
