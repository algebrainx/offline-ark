/* Test für "Wolken & Wetter": node scripts/test-wolken.js
 * Prüft den Blitz-Rechner, die Daten (Bilder, Bildnachweis, Quellen) und die Übersetzungen. */
'use strict';
var fs = require('fs'), path = require('path'), assert = require('assert');
var root = path.join(__dirname, '..');
var W = require('../data/wolken.js');
function close(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= tol, msg + ': ' + a + ' vs ' + b); }

/* ---------- Blitz-Entfernung ---------- */
// DWD: Schallgeschwindigkeit 330 m/s, 3 Sekunden = etwa 1 km. Wir rechnen mit 343 m/s (20 °C), Faustregel Sekunden / 3.
close(W.lightning(3).km, 1.029, 1e-9, '3 s');
close(W.lightning(3).ruleKm, 1, 1e-12, 'Faustregel 3 s');
close(W.lightning(10).km, 3.43, 1e-9, '10 s');
close(W.lightning(0).km, 0, 1e-12, '0 s');
close(W.lightning(30).meters, 10290, 1e-6, '30 s in Metern');
// Abweichung zwischen exakter Rechnung und Faustregel höchstens etwa 3 Prozent
[1, 5, 9, 20, 45, 60].forEach(function (s) { var r = W.lightning(s); assert.ok(Math.abs(r.km - r.ruleKm) / r.km < 0.03, 'Faustregel nahe an exakter Rechnung bei ' + s + ' s'); });
// Stufen: unter 9 s (DWD) = nah; ab etwa 18 km (52,5 s) kein Donner mehr hörbar
assert.strictEqual(W.lightning(8.9).level, 'near');
assert.strictEqual(W.lightning(9).level, 'mid');
assert.strictEqual(W.lightning(52).level, 'mid');
assert.strictEqual(W.lightning(53).level, 'far');
assert.strictEqual(W.lightning(-1), null);
assert.strictEqual(W.lightning('abc'), null);
assert.strictEqual(W.lightning(NaN), null);
assert.strictEqual(W.NEAR_S, 9);
// Es gibt keine unbelegte "10-Kilometer"-Regel in den Texten
assert.ok(!/10 ?(km|Kilometer)/.test(JSON.stringify([W.signs, W.behavior, W.genera])), 'keine unbelegte 10-km-Regel');

/* ---------- Daten ---------- */
assert.strictEqual(W.genera.length, 10, 'zehn Wolkengattungen');
var names = ['Cirrus', 'Cirrocumulus', 'Cirrostratus', 'Altocumulus', 'Altostratus', 'Nimbostratus', 'Stratocumulus', 'Stratus', 'Cumulus', 'Cumulonimbus'];
assert.deepStrictEqual(W.genera.map(function (g) { return g.la; }), names);
// Höhenstufen nach WMO: hoch Ci/Cc/Cs, mittel Ac/As/Ns, tief St/Sc/Cu/Cb
var lvl = { Cirrus: 'high', Cirrocumulus: 'high', Cirrostratus: 'high', Altocumulus: 'mid', Altostratus: 'mid', Nimbostratus: 'mid', Stratocumulus: 'low', Stratus: 'low', Cumulus: 'low', Cumulonimbus: 'low' };
W.genera.forEach(function (g) {
  assert.strictEqual(g.level, lvl[g.la], g.la + ': Höhenstufe');
  ['name', 'alt', 'look', 'meaning'].forEach(function (f) { assert.ok(g[f] && g[f].length > 20 || f === 'name', g.la + ': ' + f); });
  assert.ok(W.levels.some(function (l) { return l.id === g.level; }));
  assert.ok(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(g.photo.url), g.la + ': Commons-Link');
  assert.ok(/^CC BY(-SA)? \d\.\d$/.test(g.photo.license), g.la + ': freie Lizenz (kein NC/ND)');
});

// Bilder: vorhanden, JPEG 640x480, höchstens 120 KB, zusammen höchstens 3 MB
function jpegSize(buf) {
  var i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    var m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xC3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}
var total = 0;
W.genera.forEach(function (g) {
  var p = path.join(root, 'library', 'images', 'wolken', g.img), b = fs.readFileSync(p);
  assert.ok(b[0] === 0xFF && b[1] === 0xD8, g.img + ': JPEG');
  assert.ok(b.length <= 120 * 1024, g.img + ': höchstens 120 KB (' + b.length + ')');
  var s = jpegSize(b); assert.ok(s && s.w <= 800 && s.w === 640 && s.h === 480, g.img + ': 640x480 (Breite höchstens 800)');
  total += b.length;
});
assert.ok(total <= 3 * 1024 * 1024, 'Bilder zusammen höchstens 3 MB: ' + total);

// Bildnachweis: jede Datei, jeder Urheber und jede Lizenz stehen in ATTRIBUTION.md
var attr = fs.readFileSync(path.join(root, 'library', 'images', 'ATTRIBUTION.md'), 'utf8');
W.genera.forEach(function (g) {
  assert.ok(attr.indexOf('library/images/wolken/' + g.img) >= 0, g.img + ' fehlt in ATTRIBUTION.md');
  var row = attr.split('\n').filter(function (l) { return l.indexOf('library/images/wolken/' + g.img) >= 0; })[0];
  assert.ok(row.indexOf(g.photo.author) >= 0, g.img + ': Urheber im Bildnachweis');
  assert.ok(row.indexOf(g.photo.license.replace('CC BY-SA ', 'CC BY-SA ')) >= 0, g.img + ': Lizenz im Bildnachweis');
  assert.ok(row.indexOf(g.photo.url) >= 0, g.img + ': Commons-Link im Bildnachweis');
});

// Wetterzeichen: Warmfront-Folge in der richtigen Reihenfolge
var wf = W.signs.filter(function (s) { return s.id === 'warmfront'; })[0];
assert.deepStrictEqual(wf.steps.map(function (s) { return s.split(':')[0]; }), ['Cirrus', 'Cirrostratus', 'Altostratus', 'Nimbostratus']);
assert.deepStrictEqual(W.signs.map(function (s) { return s.id; }), ['warmfront', 'gewitter', 'kaltfront', 'foehn', 'nebel', 'baro']);
// Gewitterverhalten nach DWD: Gebäude/Auto, Bäume/Masten meiden, Mulde, unter 9 Sekunden
var beh = W.behavior.items.join(' ');
['Gebäude', 'Auto', 'Bäume', 'mulde', '9 Sekunden'].forEach(function (w) { assert.ok(beh.indexOf(w) >= 0, 'Verhalten nennt ' + w); });

// Quellen: https, eindeutig, mit Lizenz
var seen = {};
W.sources.forEach(function (s) {
  assert.ok(/^https:\/\//.test(s.url) && !seen[s.url], 'Quelle: ' + s.url); seen[s.url] = 1;
  assert.ok(s.name && s.license && s.note);
});

/* ---------- Übersetzungen ---------- */
require('./lib/tool-i18n-check.js')({
  id: 'wolken',
  data: [W.genera.map(function (g) { return { name: g.name, alt: g.alt, look: g.look, meaning: g.meaning }; }), W.signs, W.behavior, W.levels,
    W.sources.map(function (s) { return { license: s.license, note: s.note }; })],
  dataFields: ['name', 'alt', 'look', 'meaning', 'title', 'intro', 'steps', 'items', 'height', 'label', 'license', 'note'],
  jsIgnore: [], htmlIgnore: ['−', '+']
});
console.log('Wolken: alle Tests bestanden');
