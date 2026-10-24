/* Test der Vorrats-Logik: node scripts/test-inventar.js */
'use strict';
var assert = require('assert');
var I = require('../js/inventar-core.js');

// Datum
assert.ok(isNaN(I.parseDate('2026-02-30')));
assert.ok(isNaN(I.parseDate('2026-13-01')));
assert.ok(isNaN(I.parseDate('')));
assert.ok(!isNaN(I.parseDate('2024-02-29')));
assert.ok(isNaN(I.parseDate('2025-02-29')));
assert.strictEqual(I.daysUntil('2026-03-01', '2026-02-28'), 1);
assert.strictEqual(I.daysUntil('2024-03-01', '2024-02-28'), 2);          // Schaltjahr
assert.strictEqual(I.daysUntil('2026-03-29', '2026-03-28'), 1);          // Sommerzeit-Umstellung
assert.strictEqual(I.daysUntil('2026-10-25', '2026-10-24'), 1);
assert.strictEqual(I.daysUntil('2026-12-31', '2027-01-01'), -1);
assert.strictEqual(I.daysUntil('2026-05-05', '2026-05-05'), 0);
assert.ok(isNaN(I.daysUntil('', '2026-05-05')));

// Status
var T = '2026-10-24';
assert.strictEqual(I.status({ exp: '' }, T, 30), 'none');
assert.strictEqual(I.status({ exp: '2026-10-23' }, T, 30), 'bad');
assert.strictEqual(I.status({ exp: '2026-10-24' }, T, 30), 'warn');      // heute = noch nicht abgelaufen
assert.strictEqual(I.status({ exp: '2026-11-23' }, T, 30), 'warn');      // genau 30 Tage
assert.strictEqual(I.status({ exp: '2026-11-24' }, T, 30), 'ok');        // 31 Tage
assert.strictEqual(I.status({ exp: '2026-11-24' }, T, 90), 'warn');
assert.strictEqual(I.status({ exp: '2026-10-31' }, T, 7), 'warn');
assert.strictEqual(I.status({ exp: '2026-11-01' }, T, 7), 'ok');
assert.strictEqual(I.dueText(-3), 'seit 3 Tagen abgelaufen');
assert.strictEqual(I.dueText(-1), 'seit gestern abgelaufen');
assert.strictEqual(I.dueText(0), 'läuft heute ab');
assert.strictEqual(I.dueText(1), 'läuft morgen ab');
assert.strictEqual(I.dueText(12), 'läuft in 12 Tagen ab');
assert.strictEqual(I.dateDE('2026-03-09'), '09.03.2026');

// Zusammenfassung
var items = [
  { name: 'A', exp: '2026-10-01' }, { name: 'B', exp: '2026-10-20' }, { name: 'C', exp: '2026-11-01' },
  { name: 'D', exp: '2026-12-01' }, { name: 'E', exp: '2027-06-01' }, { name: 'F', exp: '' }
];
assert.deepStrictEqual(I.summary(items, T, 30), { total: 6, bad: 2, warn: 1 });
assert.deepStrictEqual(I.summary(items, T, 90), { total: 6, bad: 2, warn: 2 });

// Bereinigen
assert.strictEqual(I.sanitize({ name: '  ' }), null);
assert.strictEqual(I.sanitize(null), null);
var s = I.sanitize({ name: ' Reis ', qty: '2,5', unit: 'kg', cat: 'Unbekannt', exp: '2026-99-99', note: 5 });
assert.strictEqual(s.name, 'Reis'); assert.strictEqual(s.qty, 2.5); assert.strictEqual(s.cat, 'Sonstiges');
assert.strictEqual(s.exp, ''); assert.strictEqual(s.note, ''); assert.ok(s.id);
assert.strictEqual(I.sanitize({ name: 'X', qty: -3 }).qty, 0);

// Sortierung
var list = [
  { id: '1', name: 'Zucker', cat: 'Lebensmittel', exp: '' },
  { id: '2', name: 'Äpfel', cat: 'Lebensmittel', exp: '2026-12-01' },
  { id: '3', name: 'Wasser', cat: 'Getränke', exp: '2026-11-01' },
  { id: '4', name: 'Akku', cat: 'Technik', exp: '2026-11-01' }
];
assert.deepStrictEqual(I.sortItems(list, 'exp').map(function (x) { return x.id; }), ['4', '3', '2', '1']);
assert.deepStrictEqual(I.sortItems(list, 'name').map(function (x) { return x.id; }), ['4', '2', '3', '1']);
assert.deepStrictEqual(I.sortItems(list, 'cat').map(function (x) { return x.id; }), ['2', '1', '3', '4']);

// Import
var good = JSON.stringify({ app: 'offline-ark-inventar', version: 1, items: [{ id: 'a', name: 'Tee', qty: 1 }, { name: '' }] });
var r = I.parseImport(good);
assert.strictEqual(r.items.length, 1); assert.strictEqual(r.skipped, 1);
assert.strictEqual(I.parseImport('[{"name":"Salz","qty":1}]').items.length, 1);
assert.throws(function () { I.parseImport('kein json'); });
assert.throws(function () { I.parseImport('{"app":"anderes","items":[]}'); });
assert.throws(function () { I.parseImport('{"app":"offline-ark-inventar","items":[{"x":1}]}'); });

// Zusammenführen
var m = I.merge([{ id: 'a', name: 'Alt', qty: 1 }, { id: 'b', name: 'B', qty: 1 }], [{ id: 'a', name: 'Neu', qty: 2 }, { id: 'c', name: 'C', qty: 1 }]);
assert.deepStrictEqual(m.map(function (x) { return x.id + x.name; }), ['aNeu', 'bB', 'cC']);

console.log('Vorrat: alle Tests bestanden');
