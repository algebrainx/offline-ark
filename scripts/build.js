#!/usr/bin/env node
/* Offline-Ark – Seitengenerator (nur zum ERSTELLEN der Inhalte nötig).
 *
 * Wer die fertigen Seiten nur benutzt, braucht dieses Skript NICHT:
 * index.html funktioniert ohne Build-Schritt direkt per Doppelklick.
 *
 * Was es tut (Node.js ≥ 16, keine Pakete nötig):
 *   1. liest content/*.md (eigene Texte mit Quellenangaben im Kopfbereich)
 *   2. erzeugt wissen/<id>.html  (reines HTML, druckfreundlich)
 *   3. erzeugt wissen/quellen.html (zentrale Seite "Quellen & Lizenzen")
 *   4. erzeugt data/search-index.js (Volltext für die Offline-Suche)
 *   5. erzeugt bibliothek/index.html aus scripts/library.json
 *
 * Aufruf:  node scripts/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'wissen');

/* ---------- Register der Wissensseiten (Reihenfolge, Titel) aus data/tools.js ---------- */
function loadRegistry() {
  const src = fs.readFileSync(path.join(ROOT, 'data', 'tools.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  return sandbox.window.OA_WISSEN;
}

/* ---------- HTML-Helfer ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Inline-Markdown: **fett**, *kursiv*, `code`, [text](url) */
function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    const ext = /^https?:/.test(u);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`;
  });
  return s;
}

/** Block-Markdown: Überschriften, Listen, Tabellen, :::-Boxen, Absätze */
function markdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const headings = [];

  function slug(t) {
    return t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function parseBlocks(stop) {
    const html = [];
    while (i < lines.length) {
      const line = lines[i];
      if (stop && line.trim() === stop) { i++; return html.join('\n'); }
      if (!line.trim()) { i++; continue; }

      // Box: ":::warn Titel" ... ":::"   (warn | danger | info | original)
      let m = line.match(/^:::(warn|danger|info|original)\s*(.*)$/);
      if (m) {
        i++;
        const inner = parseBlocks(':::');
        if (m[1] === 'original') {
          html.push(`<details><summary>${inline(m[2] || 'Original anzeigen')}</summary><div lang="en">${inner}</div></details>`);
        } else {
          html.push(`<div class="callout ${m[1]}">${m[2] ? `<strong>${inline(m[2])}</strong>` : ''}${inner}</div>`);
        }
        continue;
      }
      // Überschriften
      m = line.match(/^(#{2,3})\s+(.*)$/);
      if (m) {
        const level = m[1].length, text = m[2].trim(), id = slug(text);
        if (level === 2) headings.push({ id, text });
        html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
        i++; continue;
      }
      // Tabelle
      if (line.trim().startsWith('|') && lines[i + 1] && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = cells(line); i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
        html.push('<div class="table-wrap"><table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }
      // Listen (- oder 1.) – nummerierte Listen werden zu "Schritt für Schritt"
      if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          let t = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
          i++;
          while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i])) { t += ' ' + lines[i].trim(); i++; }
          items.push(t);
        }
        html.push(`<${ordered ? 'ol class="steps"' : 'ul'}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${ordered ? 'ol' : 'ul'}>`);
        continue;
      }
      // Absatz
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|:::|\s*([-*]|\d+\.)\s+|\|)/.test(lines[i])) { para.push(lines[i].trim()); i++; }
      html.push(`<p>${inline(para.join(' '))}</p>`);
    }
    return html.join('\n');
  }

  const body = parseBlocks(null);
  return { html: body, headings };
}

/** Kopfbereich (--- ... ---) lesen: einfache Schlüssel + Quellenliste */
function frontMatter(raw, file) {
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: Kopfbereich (---) fehlt`);
  const meta = { sources: [] };
  let inSources = false;
  m[1].split('\n').forEach((line) => {
    if (/^sources:\s*$/.test(line)) { inSources = true; return; }
    if (inSources && /^\s*-\s+/.test(line)) {
      const parts = line.replace(/^\s*-\s+/, '').split('|').map((s) => s.trim());
      if (parts.length < 3) throw new Error(`${file}: Quelle braucht "Name | URL | Lizenz": ${line}`);
      meta.sources.push({ name: parts[0], url: parts[1], license: parts[2], note: parts[3] || '' });
      return;
    }
    inSources = false;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  });
  return { meta, body: m[2] };
}

/* ---------- Seitenvorlage ---------- */
function page({ title, lead, bodyHtml, toc, sourcesHtml, plant, disclaimer, depth = '../' }) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)} – Offline-Ark</title>
  <meta name="color-scheme" content="light dark">
  <script src="${depth}js/theme.js"></script>
  <link rel="stylesheet" href="${depth}css/style.css">
</head>
<body data-root="${depth}" data-page="wissen">
<!-- Diese Datei wird von scripts/build.js erzeugt. Bitte Texte in content/*.md ändern. -->
<main class="container">
  <header class="page-head">
    <h1>${esc(title)}</h1>
    ${lead ? `<p class="lead">${inline(lead)}</p>` : ''}
  </header>
  <article class="prose">
${disclaimer ? `    <div class="callout warn disclaimer"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg><div><strong>Ersetzt keine Ausbildung.</strong> Im Notfall zuerst <strong>112</strong> anrufen bzw. immer wieder versuchen. Diese Seite nennt bewusst keine Medikamenten-Dosierungen – dafür Ärztin, Arzt oder Apotheke fragen.</div></div>` : ''}
${plant ? `    <div class="plant-warning" role="alert">⚠ Nur essen, wenn 100&nbsp;% sicher bestimmt. Viele giftige Pflanzen sehen essbaren zum Verwechseln ähnlich. Im Zweifel stehen lassen. Bei Verdacht auf Vergiftung: 112 bzw. Giftnotruf.</div>` : ''}
${toc.length > 2 ? `    <nav class="toc no-print" aria-label="Inhalt">${toc.map((h) => `<a href="#${h.id}">${esc(h.text)}</a>`).join('')}</nav>` : ''}
${bodyHtml}
${sourcesHtml}
  </article>
</main>
<script src="${depth}js/icons.js"></script>
<script src="${depth}js/common.js"></script>
</body>
</html>
`;
}

function sourcesBlock(sources) {
  if (!sources.length) return '';
  return '<section class="sources"><h2>Quellen</h2><ul>' + sources.map((s) =>
    `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a> – Lizenz: ${esc(s.license)}${s.note ? ` · ${esc(s.note)}` : ''}</li>`).join('') +
    '</ul><p class="small muted">Links öffnen sich nur mit Internet. Alle Inhalte dieser Seite sind eigene, zusammengefasste Texte nach den genannten Quellen.</p></section>';
}

/* ---------- Hauptlauf ---------- */
function main() {
  const registry = loadRegistry();
  const search = [];
  const allSources = new Map();   // url -> { ..., pages: [] }

  fs.mkdirSync(OUT, { recursive: true });

  registry.forEach((w) => {
    const file = path.join(CONTENT, `${w.id}.md`);
    if (!fs.existsSync(file)) { console.warn(`! content/${w.id}.md fehlt – Seite wird übersprungen`); return; }
    const { meta, body } = frontMatter(fs.readFileSync(file, 'utf8'), file);
    const { html, headings } = markdown(body);
    fs.writeFileSync(path.join(OUT, `${w.id}.html`), page({
      title: meta.title || w.title, lead: meta.lead, bodyHtml: html, toc: headings,
      sourcesHtml: sourcesBlock(meta.sources), plant: meta.plant === 'true', disclaimer: true
    }));
    const plain = body.replace(/[#*`>|:\[\]()_-]/g, ' ').replace(/\s+/g, ' ');
    search.push({ id: w.id, headings: headings.map((h) => h.text).join(' · '), text: plain });
    meta.sources.forEach((s) => {
      const e = allSources.get(s.url) || Object.assign({}, s, { pages: [] });
      e.pages.push({ id: w.id, title: meta.title || w.title });
      allSources.set(s.url, e);
    });
    console.log(`✓ wissen/${w.id}.html`);
  });

  fs.writeFileSync(path.join(ROOT, 'data', 'search-index.js'),
    '/* Erzeugt von scripts/build.js – nicht von Hand bearbeiten. */\nwindow.OA_SEARCH = ' + JSON.stringify(search) + ';\n');
  console.log('✓ data/search-index.js');

  /* Zentrale Seite: Quellen & Lizenzen */
  const introFile = path.join(CONTENT, '_quellen.md');
  let intro = '', introHeadings = [];
  if (fs.existsSync(introFile)) {
    const parsed = frontMatter(fs.readFileSync(introFile, 'utf8'), introFile);
    const r = markdown(parsed.body); intro = r.html; introHeadings = r.headings;
  }
  const list = Array.from(allSources.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const table = '<h2 id="verwendete-quellen">Alle verwendeten Quellen</h2><div class="table-wrap"><table><thead><tr><th>Quelle</th><th>Lizenz</th><th>Verwendet auf</th></tr></thead><tbody>' +
    list.map((s) => `<tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>${s.note ? `<br><span class="small muted">${esc(s.note)}</span>` : ''}</td><td>${esc(s.license)}</td><td>${s.pages.map((p) => `<a href="${p.id}.html">${esc(p.title)}</a>`).join(', ')}</td></tr>`).join('') +
    '</tbody></table></div>';
  fs.writeFileSync(path.join(OUT, 'quellen.html'), page({
    title: 'Quellen & Lizenzen', lead: 'Woher die Inhalte stammen und unter welcher Lizenz sie stehen.',
    bodyHtml: intro + table, toc: introHeadings.concat([{ id: 'verwendete-quellen', text: 'Alle Quellen' }]), sourcesHtml: '', disclaimer: false
  }));
  console.log('✓ wissen/quellen.html');

  /* Bibliothek aus scripts/library.json */
  const libFile = path.join(__dirname, 'library.json');
  const lib = fs.existsSync(libFile) ? JSON.parse(fs.readFileSync(libFile, 'utf8')) : [];
  const present = lib.filter((l) => fs.existsSync(path.join(ROOT, 'bibliothek', l.file)));
  const libHtml = present.length
    ? '<div class="list">' + present.map((l) => {
        const kb = fs.statSync(path.join(ROOT, 'bibliothek', l.file)).size;
        const size = kb > 1048576 ? (kb / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.round(kb / 1024) + ' KB';
        return `<a href="${esc(l.file)}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/></svg><span class="name">${esc(l.title)}<span class="sub">${esc(l.desc)} · ${esc(l.lang)} · ${size} · Lizenz: ${esc(l.license)}</span></span></a>`;
      }).join('') + '</div>'
    : '<p>Noch keine PDFs vorhanden. Mit <code>update-content.sh</code> laden (Internet nötig).</p>';
  const libPage = page({
    title: 'Bibliothek', lead: 'Gemeinfreie Handbücher als PDF – komplett offline lesbar.',
    bodyHtml: libHtml + '<p class="small muted" style="margin-top:16px">Quellen und Lizenzen: siehe <a href="../wissen/quellen.html">Quellen &amp; Lizenzen</a>. Die Originale sind englisch.</p>',
    toc: [], sourcesHtml: '', disclaimer: false, depth: '../'
  });
  fs.mkdirSync(path.join(ROOT, 'bibliothek'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'bibliothek', 'index.html'), libPage);
  console.log('✓ bibliothek/index.html (' + present.length + ' PDFs)');
}

main();
