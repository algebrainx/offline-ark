/* Test der Notizen-Logik: node scripts/test-notizen.js */
'use strict';
var assert = require('assert');
var N = require('../js/notizen-core.js');

assert.ok(N.validDate('2026-10-24')); assert.ok(!N.validDate('2026-02-30')); assert.ok(!N.validDate('x'));
assert.strictEqual(N.dateLong('2026-10-24'), 'Samstag, 24.10.2026');
assert.strictEqual(N.dateLong('2024-02-29'), 'Donnerstag, 29.02.2024');
assert.strictEqual(N.stamp(new Date(2026, 9, 24, 9, 5), false), '[09:05] ');
assert.strictEqual(N.stamp(new Date(2026, 9, 24, 9, 5), true), '[24.10.2026 09:05] ');
assert.strictEqual(N.localDate(new Date(2026, 0, 5)), '2026-01-05');
assert.strictEqual(N.dateTime(new Date(2026, 0, 5, 7, 3).getTime()), '05.01.2026 07:03');

// Einfügen: Zeilenanfang vs. mitten in der Zeile
assert.deepStrictEqual(N.insertAt('', 0, '[1] '), { text: '[1] ', pos: 4 });
assert.deepStrictEqual(N.insertAt('Hallo', 5, '[1] '), { text: 'Hallo\n[1] ', pos: 10 });
assert.deepStrictEqual(N.insertAt('Hallo\n', 6, '[1] '), { text: 'Hallo\n[1] ', pos: 10 });
assert.deepStrictEqual(N.insertAt('ab', null, '[1] ').text, 'ab\n[1] ');

// Bereinigen
assert.strictEqual(N.sanitizeNote({ title: '', text: '  ' }), null);
assert.strictEqual(N.sanitizeNote({ title: 'T' }).text, '');
assert.strictEqual(N.sanitizeEntry({ date: '2026-13-01', text: 'x' }), null);
assert.strictEqual(N.sanitizeEntry({ date: '2026-10-24', text: '  ' }), null);
assert.strictEqual(N.sanitizeEntry({ date: '2026-10-24', text: 'ok' }).id, '2026-10-24');

// Zusammenführen: neuere Fassung gewinnt
var m = N.mergeById([{ id: 'a', updated: 5, text: 'alt' }, { id: 'b', updated: 1 }], [{ id: 'a', updated: 9, text: 'neu' }, { id: 'b', updated: 0 }, { id: 'c', updated: 1 }]);
assert.deepStrictEqual(m.map(function (x) { return x.id + x.updated; }), ['a9', 'b1', 'c1']);

// Import
var file = JSON.stringify({ app: 'offline-ark-notizen', version: 1, notizen: [{ id: 'n1', title: 'A', text: 'x', created: 1, updated: 2 }, {}],
  tagebuch: [{ date: '2026-10-24', text: 'Heute' }] });
var r = N.parseImport(file);
assert.strictEqual(r.notizen.length, 1); assert.strictEqual(r.tagebuch.length, 1); assert.strictEqual(r.skipped, 1);
assert.throws(function () { N.parseImport('nope'); });
assert.throws(function () { N.parseImport('{"app":"x"}'); });
assert.throws(function () { N.parseImport('{"app":"offline-ark-notizen"}'); });

// Sortierung und Text-Export
var es = N.sortEntries([{ date: '2026-10-01' }, { date: '2026-10-24' }, { date: '2026-09-30' }]).map(function (x) { return x.date; });
assert.deepStrictEqual(es, ['2026-10-24', '2026-10-01', '2026-09-30']);
var txt = N.toText([{ title: 'Plan', text: 'Zeile1\nZeile2', updated: 0 }], [{ date: '2026-10-24', text: 'Heute war es ruhig' }], '2026-10-24');
assert.ok(txt.indexOf('=== NOTIZEN (1) ===') > 0 && txt.indexOf('Samstag, 24.10.2026') > 0 && txt.indexOf('Heute war es ruhig') > 0);
console.log('Notizen: alle Tests bestanden');
