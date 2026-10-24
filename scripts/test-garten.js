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

// Petersilie: Pflanzung Ende April bis Anfang Mai (LTZ Augustenberg, Baden-Württemberg)
var pp = crop('petersilie');
assert.ok(C.flags(pp, 3).plant && C.flags(pp, 4).plant && !C.flags(pp, 2).plant && !C.flags(pp, 5).plant, 'Petersilie: Pflanzung April/Mai');
var pd = C.describe(pp.plant)[0];
assert.strictEqual(MON[pd.a.m] + ' ' + pd.a.pos + ' – ' + MON[pd.b.m] + ' ' + pd.b.pos, 'Apr end – Mai start');
assert.ok(C.flags(pp, 3).sow && !C.flags(pp, 5).sow, 'Petersilie: Aussaat bleibt im April');

// Hinweise aus Baden-Württemberg
assert.ok(D.bw.length >= 4, 'BW-Hinweise vorhanden');
D.bw.forEach(function (x) { assert.ok(x.name && x.text.length > 40, 'BW-Hinweis unvollständig: ' + x.name); });
assert.ok(D.sources.some(function (s) { return /^https:\/\/ltz\.landwirtschaft-bw\.de\//.test(s.url) && /LTZ Augustenberg/.test(s.name); }), 'LTZ-Quelle fehlt');
assert.ok(D.sources.some(function (s) { return /Klima in Baden/.test(s.name); }), 'Klima-Quelle fehlt');
D.frost.forEach(function (x) { assert.ok(!/Schätzung/.test(x.text), 'Frost-Text ohne Beleg: ' + x.text); });
assert.ok(D.frost.some(function (x) { return /Oberrheingraben/.test(x.text) && /Schwäbischer Alb/.test(x.text); }), 'BW-Klimahinweis fehlt');

// Wörterbuch: alle Texte der Seite und Daten (auch die neuen BW-Texte) in en/es/ar vorhanden
(function () {
  var fs = require('fs'), path = require('path'), vm = require('vm');
  var norm = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };
  var tool = {}, core = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'i18n', 'tool-garten.js'), 'utf8'), { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { tool[norm(k)] = o[k]; }); } } } });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'i18n', 'core.js'), 'utf8'), { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { core[norm(k)] = o[k]; }); } } } });
  function need(key) {
    var e = tool[norm(key)] || core[norm(key)];
    assert.ok(e, 'Übersetzung fehlt: ' + key);
    ['en', 'es', 'ar'].forEach(function (l) { assert.ok(e[l] && e[l].trim(), l + ' fehlt: ' + key); });
  }
  D.bw.forEach(function (x) { need(x.name); need(x.text); });
  D.frost.forEach(function (x) { need(x.text); });
  D.sources.forEach(function (s) { need(s.license); need(s.note); });
  var html = fs.readFileSync(path.join(__dirname, '..', 'tools', 'garten.html'), 'utf8').replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  html = html.slice(html.indexOf('<body')).replace(/<li data-t>[\s\S]*?<\/li>/g, '');
  var m, re = />([^<>]+)</g, n = 0;
  while ((m = re.exec(html))) if (/[A-Za-zÄÖÜäöü]{2,}/.test(m[1])) { need(m[1]); n++; }
  re = /\s(?:placeholder|aria-label|title|alt)="([^"]+)"/g;
  while ((m = re.exec(html))) need(m[1]);
  assert.ok(!/nicht gefunden|ähnlichen Klima/.test(html), 'veralteter Hinweis auf der Seite');
  console.log('garten: ' + n + ' Seitentexte und Daten-Texte übersetzt');
})();

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
