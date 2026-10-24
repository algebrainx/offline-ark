/* Prüft die Knoten-Zeichnung rechnerisch: node scripts/test-knoten.js
 * Kreuzknoten (geschlossen) = Kleeblattknoten × Spiegel-Kleeblattknoten. */
'use strict';
var path = require('path'), assert = require('assert');
var K = require(path.join(__dirname, '..', 'js', 'knoten-core.js'));
var S = require(path.join(__dirname, '..', 'data', 'knoten-szenen.js'));

function show(p) { return Object.keys(p).filter(function (e) { return p[e]; }).sort(function (a, b) { return a - b; }).map(function (e) { return p[e] + 't^' + e; }).join(' + '); }
function mul(p, q) { var r = {}; Object.keys(p).forEach(function (a) { Object.keys(q).forEach(function (b) { var e = Number(a) + Number(b); r[e] = (r[e] || 0) + p[a] * q[b]; }); }); return r; }
function eq(p, q) { var ks = {}; Object.keys(p).concat(Object.keys(q)).forEach(function (k) { ks[k] = 1; }); return Object.keys(ks).every(function (k) { return (p[k] || 0) === (q[k] || 0); }); }

var tre = { 1: 1, 3: 1, 4: -1 }, mir = { '-1': 1, '-3': 1, '-4': -1 };
var reef = K.build(S.reef);
var r = K.jones(reef, S.reef.closure);
assert.strictEqual(r.crossings, 6, 'Kreuzknoten: 6 Kreuzungen');
assert.ok(eq(r.poly, mul(tre, mir)), 'Kreuzknoten: Jones-Polynom ' + show(r.poly));
console.log('Kreuzknoten:', r.crossings, 'Kreuzungen, V =', show(r.poly));
console.log('knoten: Zeichnung geprüft');
