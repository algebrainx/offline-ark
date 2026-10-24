/* Gemeinsame Prüfung der Wörterbücher für die Werkzeuge wolken, sternbilder, tierspuren.
 * Genutzt von scripts/test-<id>.js. Prüft für tools/<id>.html, js/tool-<id>.js, data/<id>.js:
 *  - jeder sichtbare deutsche Text (HTML-Textknoten, aria-label/title/alt/placeholder, OA.t-Texte im Skript,
 *    Textfelder der Datendatei) steht im Wörterbuch der Seite (oder in data/i18n/core.js);
 *  - en/es/ar vorhanden, gleiche Platzhalter {0}, gleiche Tags;
 *  - keine deutschen Reste in en/es (ä ö ü ß, typische Wörter) und kein deutsches Wort in ar. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var root = path.join(__dirname, '..', '..');

function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
function loadDict(file) {
  var store = {};
  var ctx = { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { var key = norm(k); assert.ok(!store[key], file + ': doppelter Schlüssel ' + k); store[key] = o[k]; }); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  return store;
}
function ph(s) { return (s.match(/\{\d+\}/g) || []).sort().join(','); }
function tags(s) { return (s.match(/<\/?[a-z]+[^>]*>/g) || []).map(function (t) { return t.replace(/\s+/g, ' '); }).sort().join(''); }
var DE_WORDS = /\b(und|oder|der|die|das|nicht|mit|für|ist|wird|bei|nach|ein|eine|im|zu|von|auf|aus|dem|den)\b/;
var ALLOWED_DE_CHARS = /Offline-Ark|Föhn/;   // Eigennamen

/** Alle Texte aus einem Objektbaum einsammeln, dessen Schlüssel in `fields` genannt sind. */
function collect(obj, fields, out) {
  out = out || [];
  if (Array.isArray(obj)) { obj.forEach(function (x) { collect(x, fields, out); }); return out; }
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (fields.indexOf(k) >= 0) {
        if (typeof v === 'string') out.push(v);
        else if (Array.isArray(v)) v.forEach(function (x) { if (typeof x === 'string') out.push(x); else collect(x, fields, out); });
      } else collect(v, fields, out);
    });
  }
  return out;
}

/** Sichtbare Texte einer HTML-Seite (ohne script/style). */
function htmlTexts(html) {
  var out = [];
  var body = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  var t = body.match(/<title>([\s\S]*?)<\/title>/); if (t) out.push(decode(t[1]).split(' – ')[0]);
  body = body.replace(/<title>[\s\S]*?<\/title>/, ' ');
  body.replace(/(?:aria-label|title|alt|placeholder)="([^"]*)"/g, function (m, v) { out.push(decode(v)); return m; });
  body.replace(/<!--[\s\S]*?-->/g, ' ').replace(/>([^<]+)</g, function (m, v) { out.push(decode(v)); return m; });
  return out.map(norm).filter(function (s) { return /[A-Za-zÄÖÜäöüß]{2,}/.test(s); });
}
function decode(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }

/** Einfach angeführte Texte im Skript, die wie deutsche Sätze/Wörter mit Großbuchstaben am Anfang aussehen. */
function scriptTexts(js) {
  var out = [], re = /'((?:[^'\\]|\\.)*)'/g, m;
  while ((m = re.exec(js))) {
    var s = m[1].replace(/\\'/g, "'");
    if (/^[A-ZÄÖÜ][^<>=\/#{}]*[a-zäöüß]/.test(s) && /[a-zäöüß]{2,}/.test(s) && s.length > 2) out.push(norm(s));
  }
  return out;
}

/**
 * opts: id, dataFields (Feldnamen der Datendatei mit Text), data (Modul), jsIgnore (Texte im Skript, die keine Übersetzung brauchen),
 *       htmlIgnore (Texte im HTML ohne Übersetzung), extra (weitere Texte, die vorhanden sein müssen)
 */
module.exports = function check(opts) {
  var id = opts.id, dict = loadDict('data/i18n/tool-' + id + '.js'), core = loadDict('data/i18n/core.js');
  var n = 0;
  Object.keys(dict).forEach(function (k) {
    ['en', 'es', 'ar'].forEach(function (l) {
      var v = dict[k][l];
      assert.ok(typeof v === 'string' && v.trim(), id + ': ' + l + ' fehlt für "' + k + '"');
      assert.strictEqual(ph(v), ph(k), id + ': Platzhalter in ' + l + ' für "' + k + '"');
      assert.strictEqual(tags(v), tags(k), id + ': Tags in ' + l + ' für "' + k + '"');
      if (l !== 'ar') {
        assert.ok(!/[äöüß]/i.test(v) || ALLOWED_DE_CHARS.test(v), id + ': deutsche Reste in ' + l + ': ' + v);
        if (l === 'en') assert.ok(!DE_WORDS.test(v), id + ': Deutsch in en: ' + v);
      } else {
        assert.ok(!/[A-Za-z]{4,}.*\s(und|oder)\s/.test(v) && !/(?:^|\s)(?:und|oder|der|die|das)(?:\s|$)/.test(v), id + ': Deutsch in ar: ' + v);
      }
    });
    n++;
  });
  function need(text, where) {
    var k = norm(text);
    assert.ok(dict[k] || core[k], id + ': Übersetzung fehlt (' + where + '): "' + k + '"');
  }
  var html = fs.readFileSync(path.join(root, 'tools', id + '.html'), 'utf8');
  var htmlIgnore = opts.htmlIgnore || [];
  htmlTexts(html).forEach(function (s) { if (htmlIgnore.indexOf(s) < 0) need(s, 'HTML'); });
  var js = fs.readFileSync(path.join(root, 'js', 'tool-' + id + '.js'), 'utf8');
  var jsIgnore = opts.jsIgnore || [];
  scriptTexts(js).forEach(function (s) { if (jsIgnore.indexOf(s) < 0) need(s, 'Skript'); });
  collect(opts.data, opts.dataFields, []).forEach(function (s) { need(s, 'Daten'); });
  (opts.extra || []).forEach(function (s) { need(s, 'extra'); });
  // Kein Wörterbucheintrag ohne Verwendung (Tippfehler-Schutz)
  var used = {};
  htmlTexts(html).forEach(function (s) { used[s] = 1; });
  scriptTexts(js).forEach(function (s) { used[s] = 1; });
  collect(opts.data, opts.dataFields, []).forEach(function (s) { used[norm(s)] = 1; });
  (opts.extra || []).forEach(function (s) { used[norm(s)] = 1; });
  var unused = Object.keys(dict).filter(function (k) { return !used[k]; });
  assert.deepStrictEqual(unused, [], id + ': Wörterbucheinträge ohne Verwendung: ' + unused.join(' | '));
  console.log(id + ': ' + n + ' Wörterbuch-Schlüssel, alle Texte übersetzt (en/es/ar)');
  return { dict: dict, core: core };
};
