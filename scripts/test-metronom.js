/* Test der Metronom-Logik: node scripts/test-metronom.js */
'use strict';
var assert = require('assert');
var M = require('../js/tool-metronom.js');

assert.strictEqual(M.clampBpm(50), 100);
assert.strictEqual(M.clampBpm(999), 120);
assert.strictEqual(M.clampBpm(110.4), 110);
assert.strictEqual(M.clampBpm('abc'), 110);

// Nur Drücken: gleichmäßige Abstände, keine Drift auch nach vielen Schlägen
var ev = null, bpm = 110, first = 5;
for (var i = 0; i < 6000; i++) {
  ev = M.nextEvent(ev, { bpm: bpm, mode: 'comp', start: first });
  assert.strictEqual(ev.kind, 'beat');
  assert.strictEqual(ev.comp, i + 1);
}
assert.ok(Math.abs(ev.time - (first + 5999 * 60 / 110)) < 1e-6, 'Drift: ' + ev.time);

// 30:2: nach dem 30. Druck eine Ansage, dann 5 s Pause, dann wieder 1. Druck
ev = null;
var log = [];
for (i = 0; i < 70; i++) { ev = M.nextEvent(ev, { bpm: 120, mode: '30:2', start: 0 }); log.push(ev); }
assert.strictEqual(log[29].kind, 'beat'); assert.strictEqual(log[29].idx, 30);
assert.strictEqual(log[30].kind, 'breath'); assert.strictEqual(log[30].cycles, 1);
assert.ok(Math.abs(log[30].time - log[29].time - 0.5) < 1e-9);
assert.strictEqual(log[31].kind, 'beat'); assert.strictEqual(log[31].idx, 1);
assert.ok(Math.abs(log[31].time - log[30].time - 5) < 1e-9);
assert.strictEqual(log[31].comp, 31);
assert.strictEqual(log[61].kind, 'breath'); assert.strictEqual(log[61].cycles, 2);

// Tempo darf zwischen den Schlägen wechseln
ev = M.nextEvent(null, { bpm: 100, mode: 'comp', start: 0 });
var e2 = M.nextEvent(ev, { bpm: 120, mode: 'comp', start: 0 });
assert.ok(Math.abs(e2.time - 0.5) < 1e-9);

console.log('Metronom: alle Tests bestanden');
