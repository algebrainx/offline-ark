#!/usr/bin/env node
/* Offline-Ark – Einzeldatei-Export: alles in EINER HTML-Datei (dist/offline-ark.html).
 *
 * Die Datei enthält alle Seiten (Start, Werkzeuge, Wissen und Bibliothek in allen Sprachen) samt Stilen,
 * Skripten, Wörterbüchern, Daten und Bildern (als data:-Adressen) und einen kleinen Router. Sie läuft per
 * Doppelklick – auch als Kopie über Messenger, Bluetooth oder USB-Stick, ohne Server und ohne weitere Dateien.
 *
 * Voraussetzung: erst  node scripts/build.js  (erzeugt wissen/, data/print-pages.js …).
 * Aufruf:  node scripts/build-single.js [--lang de,en,es,ar] [--no-pdf] [--out dist/offline-ark.html]
 *   --lang    nur diese Sprachen einbetten (kleinere Datei; "de" allein spart am meisten)
 *   --no-pdf  PDFs aus bibliothek/ weglassen (sonst werden sie mit eingebettet)
 * Aufbau und Grenzen: siehe README, Abschnitt "Alles in einer Datei". Die Seitenskripte werden dafür nur im
 * Export (nicht im Projekt) angepasst: location.* -> OA_LOC (scripts/single-bridge.js). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ALL_LANGS = ['de', 'en', 'es', 'ar'];

/* ---------- Aufruf ---------- */
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };
const LANGS = (opt('--lang') || ALL_LANGS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
LANGS.forEach((l) => { if (!ALL_LANGS.includes(l)) { console.error('Unbekannte Sprache: ' + l); process.exit(1); } });
const WITH_PDF = !argv.includes('--no-pdf');
const OUT = path.resolve(ROOT, opt('--out') || 'dist/offline-ark.html');
const TRIM = ALL_LANGS.some((l) => !LANGS.includes(l));

/* ---------- Hilfen ---------- */
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const posix = path.posix;
const kb = (n) => (n / 1024).toFixed(0) + ' KB';

/** Pfad einer Verweis-Adresse (relativ zur Seite) als Pfad ab Projektordner */
function refPath(fromPage, ref) {
  return posix.normalize(posix.join(posix.dirname(fromPage), ref.split('#')[0].split('?')[0]));
}
const isLocal = (ref) => ref && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);

/** location.* der Seitenskripte auf die Brücke umleiten (nur im Export) */
function patchJs(src) {
  return src
    .replace(/(?<![\w$.])(?:(?:window|document)\.)?location\.(hash|pathname|search|href|replace|assign)\b/g, 'OA_LOC.$1')
    .replace(/(?<![\w$.])window\.location\s*=(?!=)/g, 'OA_LOC.href =');
}
/** Zeichenfolgen, die den umgebenden <script>-Block beenden würden, unschädlich machen */
const safeScript = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

/** Beim Kürzen auf einzelne Sprachen: Wörterbuch, Suchindex und Druckseiten nur für diese Sprachen */
function trimByLang(rel, src) {
  if (!TRIM) return src;
  if (/^data\/i18n\//.test(rel)) {
    const store = {};
    vm.runInNewContext(src, { OA: { i18n: { add: (o) => Object.assign(store, o) } } });
    const out = {};
    Object.keys(store).forEach((k) => {
      const e = {};
      LANGS.forEach((l) => { if (l !== 'de' && store[k][l]) e[l] = store[k][l]; });
      if (Object.keys(e).length) out[k] = e;
    });
    return LANGS.some((l) => l !== 'de') ? 'OA.i18n.add(' + JSON.stringify(out) + ');\n' : '';
  }
  const m = /^window\.(OA_SEARCH|OA_PRINT_PAGES)\s*=/m.exec(src);
  if (m && /^data\/(search-index|print-pages)\.js$/.test(rel)) {
    const w = {};
    vm.runInNewContext(src, { window: w });
    const out = {};
    LANGS.forEach((l) => { if (w[m[1]][l]) out[l] = w[m[1]][l]; });
    return 'window.' + m[1] + ' = ' + JSON.stringify(out) + ';\n';
  }
  return src;
}

/* ---------- Dateien (Skripte, Stile, Wörterbücher) ---------- */
const FILES = {};
const ASSETS = {};
const PDFS = {};
const stats = { pages: 0, js: 0, css: 0, i18n: 0, data: 0, images: 0, pdf: 0 };

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' };
const dataUri = (rel) => 'data:' + (MIME[posix.extname(rel).slice(1).toLowerCase()] || 'application/octet-stream') + ';base64,' + fs.readFileSync(path.join(ROOT, rel)).toString('base64');

function cssText(rel) {
  return read(rel).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, ref) => {
    if (!isLocal(ref)) return m;
    const p = refPath(rel, ref);
    if (!exists(p)) return m;
    stats.images += fs.statSync(path.join(ROOT, p)).size;
    return 'url(' + dataUri(p) + ')';
  });
}

function addFile(rel) {
  if (FILES[rel] != null) return true;
  if (!exists(rel)) { console.warn('! fehlt, wird ausgelassen: ' + rel); return false; }
  if (rel.endsWith('.css')) {
    FILES[rel] = cssText(rel); stats.css += FILES[rel].length;
  } else {
    const trimmed = trimByLang(rel, read(rel));
    FILES[rel] = safeScript(patchJs(trimmed));
    stats[/^data\/i18n\//.test(rel) ? 'i18n' : /^data\//.test(rel) ? 'data' : 'js'] += FILES[rel].length;
  }
  return true;
}

/* ---------- Seiten ---------- */
function listPages() {
  const out = ['index.html'];
  const add = (dir, rec) => {
    if (!exists(dir)) return;
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach((e) => {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (rec && !e.name.startsWith('.') && !e.name.startsWith('_')) add(rel, rec); }
      else if (e.name.endsWith('.html')) out.push(rel);
    });
  };
  add('tools', false);
  add('wissen', true);
  if (exists('bibliothek/index.html')) out.push('bibliothek/index.html');
  ALL_LANGS.filter((l) => l !== 'de').forEach((l) => { if (exists(`bibliothek/${l}/index.html`)) out.push(`bibliothek/${l}/index.html`); });
  return out;
}
/** Sprache einer Seite: wissen/en/x.html -> en, sonst de */
function pageLang(rel) { const m = /^(?:wissen|bibliothek)\/(en|es|ar)\//.exec(rel); return m ? m[1] : 'de'; }
const isGen = (rel) => /^(wissen|bibliothek)\//.test(rel);

function tokenize(rel, html) {
  const dicts = [];
  const addDict = (n) => { if (!dicts.includes(n) && exists(`data/i18n/${n}.js`)) { dicts.push(n); addFile(`data/i18n/${n}.js`); } };

  // Hinweise für die App-Installation entfallen: die Einzeldatei braucht keinen Service Worker
  html = html
    .replace(/[ \t]*<link\b[^>]*rel="(?:manifest|apple-touch-icon)"[^>]*>\r?\n?/g, '')
    .replace(/[ \t]*<meta\b[^>]*name="theme-color"[^>]*>\r?\n?/g, '');

  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) => {
    const src = /\bsrc="([^"]+)"/.exec(attrs);
    if (!src) return `<script${attrs}>${safeScript(patchJs(body))}</script>`;   // eingebettetes Skript
    if (!isLocal(src[1])) return m;
    const p = refPath(rel, src[1]);
    if (p === 'js/pwa.js') return '';
    if (!addFile(p)) return '';
    let tag = `<script data-oa="${p}"></script>`;
    if (p === 'js/i18n.js') {
      addDict('core');
      const t = /^tools\/([\w-]+)\.html$/.exec(rel);
      if (t) addDict('tool-' + t[1]);
      const meta = /<meta\s+name="oa-dicts"\s+content="([^"]*)"/.exec(html);
      if (meta) meta[1].split(',').map((s) => s.trim()).filter(Boolean).forEach(addDict);
      dicts.forEach((d) => { tag += `<script data-oa-dict="${d}"></script>`; });
    }
    return tag;
  });
  // Wörterbücher, die erst nach i18n.js dazukommen (Meta-Angabe steht vor dem Skript, daher oben schon gesammelt)

  html = html.replace(/<link\b[^>]*>/g, (m) => {
    if (!/rel="stylesheet"/.test(m)) return m;
    const href = /\bhref="([^"]+)"/.exec(m);
    if (!href || !isLocal(href[1])) return m;
    const p = refPath(rel, href[1]);
    return addFile(p) ? `<link data-oa-css="${p}">` : '';
  });

  // Bilder in der Seite -> Platzhalter, den der Router durch die data:-Adresse ersetzt
  html = html.replace(/(<(?:img|source|video|audio)\b[^>]*?\b(?:src|poster)=")([^"]+)(")/g, (m, a, ref, c) => {
    if (!isLocal(ref)) return m;
    const p = refPath(rel, ref);
    return exists(p) && MIME[posix.extname(p).slice(1).toLowerCase()] ? a + 'oa-asset:' + p + c : m;
  });
  return html;
}

/* ---------- Bilder und PDFs ---------- */
function collectAssets() {
  const skip = new Set(['docs', 'icons', 'scratch', 'dist', 'node_modules', 'scripts', 'content', 'server']);
  (function walk(dir) {
    fs.readdirSync(path.join(ROOT, dir || '.'), { withFileTypes: true }).forEach((e) => {
      if (e.name.startsWith('.') || e.name.startsWith('_')) return;
      const rel = dir ? dir + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!(dir === '' && skip.has(e.name))) walk(rel); return; }
      const ext = posix.extname(rel).slice(1).toLowerCase();
      if (MIME[ext]) { ASSETS[rel] = dataUri(rel); stats.images += fs.statSync(path.join(ROOT, rel)).size; }
      else if (ext === 'pdf' && WITH_PDF) { PDFS[rel] = fs.readFileSync(path.join(ROOT, rel)).toString('base64'); stats.pdf += fs.statSync(path.join(ROOT, rel)).size; }
    });
  })('');
}

/* ---------- Zusammenbau ---------- */
function main() {
  if (!exists('wissen/erste-hilfe.html')) { console.error('Bitte zuerst  node scripts/build.js  ausführen.'); process.exit(1); }
  const pages = {};
  listPages().forEach((rel) => {
    if (isGen(rel) && !LANGS.includes(pageLang(rel))) return;
    pages[rel] = tokenize(rel, read(rel));
    stats.pages += pages[rel].length;
  });
  ['js/theme.js', 'css/style.css'].forEach(addFile);   // für die Hinweisseite "nicht enthalten"
  collectAssets();

  const bridge = fs.readFileSync(path.join(__dirname, 'single-bridge.js'), 'utf8');
  const router = fs.readFileSync(path.join(__dirname, 'single-router.js'), 'utf8');
  const icon = /<link rel="icon" href="([^"]+)">/.exec(read('index.html'));
  const data = JSON.stringify({ langs: LANGS, pages, files: FILES, assets: ASSETS, pdfs: PDFS, bridge })
    .replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\u0021--');

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Offline-Ark</title>
<meta name="color-scheme" content="light dark">
${icon ? `<link rel="icon" href="${icon[1]}">` : ''}
<!-- Offline-Ark als Einzeldatei, erzeugt von scripts/build-single.js (${new Date().toISOString().slice(0, 10)}; Sprachen: ${LANGS.join(', ')}; PDFs: ${WITH_PDF ? 'ja' : 'nein'}). Nichts nachladen, nichts bearbeiten. -->
<style>
html, body { margin: 0; height: 100%; overflow: hidden; background: #f5f5f7; }
@media (prefers-color-scheme: dark) { html, body { background: #000; } }
iframe.oa { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; }
</style>
</head>
<body>
<noscript>Offline-Ark braucht JavaScript. / Offline-Ark needs JavaScript.</noscript>
<script id="oa-data" type="application/json">${data}</script>
<script>
${safeScript(router)}
</script>
</body>
</html>
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);

  const size = fs.statSync(OUT).size;
  console.log(`✓ ${path.relative(ROOT, OUT)}: ${(size / 1048576).toFixed(2)} MB (${Object.keys(pages).length} Seiten; Sprachen ${LANGS.join(', ')}; PDFs ${WITH_PDF ? Object.keys(PDFS).length : 'ohne'})`);
  console.log(`  Seiten ${kb(stats.pages)} · Skripte ${kb(stats.js)} · Daten ${kb(stats.data)} · Wörterbücher ${kb(stats.i18n)} · Stile ${kb(stats.css)} · Bilder ${kb(stats.images)}${WITH_PDF ? ' · PDFs ' + kb(stats.pdf) + ' (Base64 +33 %)' : ''}`);
  if (size - (WITH_PDF ? stats.pdf * 1.34 : 0) > 12 * 1048576) console.warn('! Größer als 12 MB (ohne PDFs). Mit --lang kürzen.');
}

main();
