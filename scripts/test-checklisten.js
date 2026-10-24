/* Test der Checklisten-Daten: node scripts/test-checklisten.js */
'use strict';
var assert = require('assert');
var L = require('../data/checklisten.js');

assert.deepStrictEqual(L.map(function (l) { return l.id; }), ['notgepaeck', 'hausapotheke', 'stromausfall', 'evakuierung', 'winter']);
var all = {};
L.forEach(function (l) {
  assert.ok(l.title && l.intro && l.sections.length >= 3, l.id);
  l.sections.forEach(function (s) {
    assert.ok(s.title && s.items.length >= 3 && s.items.length <= 8, l.id + '/' + s.title + ' hat ' + s.items.length + ' Punkte');
    s.items.forEach(function (it) {
      assert.ok(it.id && it.text, l.id);
      assert.ok(!all[it.id], 'doppelte ID ' + it.id);
      assert.ok(/^[a-z0-9:-]+$/.test(it.id), 'ID ' + it.id);
      all[it.id] = 1;
      // keine Dosierungsangaben
      assert.ok(!/\b\d+\s?(mg|µg|ml|tabletten|tropfen)\b/i.test(it.text), 'Dosierung? ' + it.text);
    });
  });
  console.log(l.id, l.sections.reduce(function (n, s) { return n + s.items.length; }, 0), 'Punkte');
});
console.log('Checklisten: alle Tests bestanden');
