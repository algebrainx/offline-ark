/* Test für "Pflanzen & Pilze": node scripts/test-pflanzen.js
 * Prüft: jedes Bild existiert und hat einen freien Attributionseintrag (Urheber, Lizenz, Commons-Link),
 * jede Pflanze hat Merkmale und Gefahrenhinweis, jedes Paar 3-5 Unterscheidungsmerkmale, und jeder
 * sichtbare Text (Seite, Skript, Daten) hat en/es/ar ohne deutsche Reste. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var root = path.join(__dirname, '..');
var LANGS = ['en', 'es', 'ar'];
var D = require(path.join(root, 'data', 'pflanzen.js'));

function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

/* ---------- Bilder und Attribution ---------- */
var md = read('bibliothek/bilder/ATTRIBUTION.md');
var attr = {};
md.split('\n').forEach(function (l) {
  var m = l.match(/^\| `bibliothek\/bilder\/pflanzen\/([^`]+)\.jpg` \| (.*?) \| (.*?) \| \[(.*?)\]\((.*?)\) \| \[Link\]\((.*?)\) \|/);
  if (m) attr[m[1]] = { by: m[3], lic: m[4], url: m[6] };
});
var FREE = /^(CC0|PD|CC BY(-SA)? \d\.\d( de)?)$/;
var files = fs.readdirSync(path.join(root, 'bibliothek', 'bilder', 'pflanzen')).filter(function (f) { return /\.jpg$/.test(f); });
files.forEach(function (f) {
  var id = f.replace(/\.jpg$/, '');
  assert.ok(attr[id], 'Kein Attributionseintrag für ' + f);
  assert.ok(FREE.test(attr[id].lic), 'Keine freie Lizenz für ' + f + ': ' + attr[id].lic);
  assert.ok(!/NC|ND/.test(attr[id].lic), 'NC/ND-Lizenz: ' + f);
  assert.ok(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(attr[id].url), 'Commons-Link fehlt für ' + f);
  assert.ok(fs.statSync(path.join(root, 'bibliothek', 'bilder', 'pflanzen', f)).size > 5000, 'Bild zu klein: ' + f);
});
var ids = {};
D.items.forEach(function (it) {
  assert.ok(!ids[it.id], 'doppelte ID ' + it.id); ids[it.id] = it;
  assert.ok(files.indexOf(it.id + '.jpg') >= 0, 'Bild fehlt: ' + it.id);
  var c = D.credits[it.id];
  assert.ok(c && c.by && c.lic && c.url, 'Credit fehlt: ' + it.id);
  assert.ok(FREE.test(c.lic), 'Lizenz nicht frei: ' + it.id);
  assert.strictEqual(c.lic, attr[it.id].lic, 'Lizenz weicht von ATTRIBUTION.md ab: ' + it.id);
  assert.strictEqual(c.url, attr[it.id].url, 'Commons-Link weicht von ATTRIBUTION.md ab: ' + it.id);
  attr[it.id].by.split(/,| \(/)[0].split(',').forEach(function (n) { assert.ok(c.by.indexOf(n.trim()) >= 0, 'Urheber weicht ab: ' + it.id); });
  assert.ok(['plant', 'mushroom'].indexOf(it.type) >= 0, 'Typ: ' + it.id);
  assert.ok(['edible', 'toxic', 'inedible', 'avoid'].indexOf(it.st) >= 0, 'Status: ' + it.id);
  assert.ok(it.name && it.latin && it.kw, 'Name/Latein/Suchwörter fehlen: ' + it.id);
  assert.ok(it.look && it.look.length >= 2, 'Merkmale fehlen: ' + it.id);
  assert.ok(it.danger && it.danger.length > 20, 'Gefahrenhinweis fehlt: ' + it.id);
  assert.ok(D.refs[it.id] && /^https:\/\//.test(D.refs[it.id].url), 'Quelle fehlt: ' + it.id);
});
Object.keys(D.credits).forEach(function (id) { assert.ok(ids[id], 'Credit ohne Eintrag: ' + id); });
files.forEach(function (f) { assert.ok(ids[f.replace(/\.jpg$/, '')], 'Bild ohne Eintrag in data/pflanzen.js: ' + f); });

/* ---------- Paare ---------- */
var REQUIRED = ['baerlauch', 'champignon', 'pfifferling', 'steinpilz', 'giersch', 'moehre', 'holunder', 'heidelbeere', 'sauerampfer'];
REQUIRED.forEach(function (p) { assert.ok(D.pairs.some(function (x) { return x.id === p; }), 'Paar fehlt: ' + p); });
D.pairs.forEach(function (p) {
  assert.ok(p.ok.length >= 1 && p.bad.length >= 1, 'Paar unvollständig: ' + p.id);
  p.ok.concat(p.bad).forEach(function (id) { assert.ok(ids[id], p.id + ': unbekannte ID ' + id); });
  p.ok.forEach(function (id) { assert.strictEqual(ids[id].st, 'edible', p.id + ': ' + id + ' ist nicht essbar'); });
  p.bad.forEach(function (id) { assert.notStrictEqual(ids[id].st, 'edible', p.id + ': ' + id + ' darf nicht essbar sein'); });
  assert.ok(p.diff.length >= 3 && p.diff.length <= 5, p.id + ': 3 bis 5 Unterscheidungsmerkmale');
  assert.ok(p.risk && p.risk.length > 20, p.id + ': Risiko fehlt');
  (p.refs || []).forEach(function (r) { assert.ok(D.refs[r], p.id + ': unbekannte Quelle ' + r); });
  if (['champignon', 'pfifferling', 'steinpilz'].indexOf(p.id) >= 0) assert.ok(p.fungi, p.id + ': Pilz-Hinweis fehlt');
});
['maigloeckchen', 'herbstzeitlose', 'aronstab', 'eibe', 'eisenhut', 'fingerhut', 'goldregen', 'pfaffenhuetchen', 'seidelbast', 'wasserschierling', 'stechapfel', 'engelstrompete', 'baerenklau']
  .forEach(function (id) { assert.ok(ids[id], 'Pflanze fehlt: ' + id); });
D.sources.forEach(function (k) {
  assert.ok(D.refs[k] && /^https:\/\//.test(D.refs[k].url), 'Quelle ohne https-Link: ' + k);
});

/* ---------- Wörterbuch ---------- */
var dict = {};
var ctx = { OA: { i18n: { add: function (o) { Object.keys(o).forEach(function (k) { var n = norm(k); assert.ok(!dict[n], 'doppelter Schlüssel: ' + n); dict[n] = o[k]; }); } } } };
vm.runInNewContext(read('data/i18n/tool-pflanzen.js'), ctx);

function ph(s) { return (s.match(/\{\d+\}/g) || []).sort().join(','); }
function tags(s) { return (s.match(/<\/?[a-z]+[^>]*>/g) || []).map(function (t) { return t.replace(/\s+/g, ' '); }).sort().join(''); }
var DE_WORDS = /\b(und|oder|der|die|das|nicht|mit|für|ist|wird|bei|nach|ein|eine|im|zu|von|auch|nur)\b/;
var ALLOWED_LATIN_AR = /^(DGfM|PSV|GIZ|Nord|CC|BY|SA|Allium|ursinum|Arum|maculatum|Wikipedia|Wikimedia|Commons)$/;
var nKeys = 0;
Object.keys(dict).forEach(function (k) {
  LANGS.forEach(function (l) {
    var v = dict[k][l];
    assert.ok(typeof v === 'string' && v.trim(), l + ' fehlt für "' + k + '"');
    assert.strictEqual(ph(v), ph(k), 'Platzhalter in ' + l + ' für "' + k + '"');
    assert.strictEqual(tags(v), tags(k), 'Tags in ' + l + ' für "' + k + '"');
    if (l !== 'ar') {
      assert.ok(!/[äöüß]/i.test(v), 'deutsche Zeichen in ' + l + ': ' + v);
      assert.ok(!DE_WORDS.test(v), 'deutsches Wort in ' + l + ': ' + v);
    } else {
      (v.match(/[A-Za-z]{4,}/g) || []).forEach(function (w) { assert.ok(ALLOWED_LATIN_AR.test(w), 'lateinisches Wort in ar: ' + w + ' (' + k + ')'); });
    }
  });
  nKeys++;
});

function need(key) { assert.ok(dict[norm(key)], 'Übersetzung fehlt für "' + key + '"'); }
var used = {};
function use(key) { need(key); used[norm(key)] = true; }

/* Texte aus den Daten */
D.items.forEach(function (it) {
  use(it.name); if (it.cond) use(it.cond); use(it.danger); it.look.forEach(use);
});
D.pairs.forEach(function (p) { p.diff.forEach(use); use(p.risk); });
use(D.wikiLic);
Object.keys(D.refs).forEach(function (k) { var r = D.refs[k]; if (r.name) use(r.name); if (r.lic) use(r.lic); });
['essbar', 'giftig', 'ungenießbar', 'nicht empfohlen', 'Wikipedia – {0}'].forEach(use);

/* Texte aus dem Skript: t('…'), OA.t('…') und die Status-Bezeichnungen */
var js = read('js/tool-pflanzen.js');
var re = /\bt\(\s*'((?:[^'\\]|\\.)*)'/g, m;
while ((m = re.exec(js))) use(m[1].replace(/\\'/g, "'"));
['Vorsicht', 'Gefahr'].forEach(use);
assert.ok(/label: 'ungenießbar'/.test(js) && /label: 'essbar'/.test(js), 'Status-Bezeichnungen nicht gefunden');

/* Texte aus der Seite: Textknoten und Attribute */
var html = read('tools/pflanzen.html');
var body = html.slice(html.indexOf('<body'));
body = body.replace(/<script[\s\S]*?<\/script>/g, '');
(body.match(/(?:placeholder|aria-label|title|alt)="[^"]+"/g) || []).forEach(function (a) { use(a.replace(/^[a-z-]+="|"$/g, '')); });
body.replace(/<[^>]+>/g, '\u0001').split('\u0001').map(norm).filter(function (s) { return s && !/^[\u0001\s]*$/.test(s); }).forEach(function (s) {
  s = s.replace(/&amp;/g, '&');
  if (s === 'Pflanzen & Pilze') { assert.ok(true); return; }                 // Titel steht in data/i18n/core.js
  if (s === 'Bestimmungshilfe mit Fotos: giftige Doppelgänger essbarer Pflanzen und Pilze.') return;   // dito
  use(s);
});

/* Seitenregeln */
assert.ok(/<img[^>]*src="'? ?\+? ?IMG/.test(js) || /IMG = '\.\.\/bibliothek\/bilder\/pflanzen\/'/.test(js), 'Bilder müssen lokal (relativ) geladen werden');
assert.ok(/loading="lazy"/.test(js) && /width="640" height="480"/.test(js), 'img braucht loading=lazy sowie width/height');
assert.ok(!/https?:\/\/[^'"\s]*\.(jpg|png|js|css)/.test(html + js), 'keine externen Laufzeit-Abhängigkeiten');
assert.ok(/Nur essen, wenn 100 % sicher bestimmt\. Fotos ersetzen keine Bestimmung durch Fachleute\. Bei Vergiftungsverdacht: 112 \/ Giftinformationszentrum\./.test(html), 'Warnhinweis fehlt');
assert.strictEqual((html.match(/btn primary/g) || []).length, 1, 'genau ein blauer Hauptknopf');
assert.ok(/genUrl\('wissen\/nahrung\.html'\)/.test(js), 'Link zur Wissensseite Nahrung fehlt');
assert.ok(/Foto: \{0\} · \{1\}/.test(js) && /ggf\. verkleinert/.test(js), 'Namensnennung unter dem Foto fehlt');
assert.ok(/Anfänger sammeln keine Pilze/.test(js), 'Pilz-Hinweis fehlt');

Object.keys(dict).forEach(function (k) { assert.ok(used[k], 'Wörterbuch-Schlüssel wird nicht benutzt: ' + k); });

console.log('Bilder:', files.length, '· Einträge:', D.items.length, '· Paare:', D.pairs.length, '· Wörterbuch-Schlüssel:', nKeys);
console.log('Daten-, Skript- und Seitentexte übersetzt (en/es/ar): OK');
