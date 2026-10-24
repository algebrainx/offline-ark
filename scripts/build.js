#!/usr/bin/env node
/* Offline-Ark – Seitengenerator (nur zum ERSTELLEN der Inhalte nötig).
 *
 * Wer die fertigen Seiten nur benutzt, braucht dieses Skript NICHT:
 * index.html funktioniert ohne Build-Schritt direkt per Doppelklick.
 *
 * Was es tut (Node.js ≥ 16, keine Pakete nötig):
 *   1. liest content/*.md (Deutsch) und content/<en|es|ar>/*.md (Übersetzungen)
 *   2. erzeugt wissen/<id>.html und wissen/<sprache>/<id>.html (reines HTML, druckfreundlich)
 *   3. erzeugt die zentrale Seite "Quellen & Lizenzen" (je Sprache)
 *   4. erzeugt data/search-index.js (Volltext je Sprache für die Offline-Suche)
 *   5. erzeugt die Bibliothek-Seiten aus scripts/library.json
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

  const usedIds = {};
  function slug(t) {
    let s = t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/\p{M}/gu, '')            // Akzente weg (á -> a); arabische Zeichen bleiben
      .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'abschnitt';
    usedIds[s] = (usedIds[s] || 0) + 1;
    return usedIds[s] > 1 ? `${s}-${usedIds[s]}` : s;
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
          html.push(`<details><summary>${inline(m[2] || 'Original anzeigen')}</summary><div lang="en" dir="ltr">${inner}</div></details>`);
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

/* ---------- Sprachen und feste Texte der erzeugten Seiten ---------- */
const LANGS = ['de', 'en', 'es', 'ar'];
const STR = {
  de: {
    disclaimer: '<strong>Ersetzt keine Ausbildung.</strong> Im Notfall zuerst <strong>112</strong> anrufen bzw. immer wieder versuchen. Diese Seite nennt bewusst keine Medikamenten-Dosierungen – dafür Ärztin, Arzt oder Apotheke fragen.',
    plant: '⚠ Nur essen, wenn 100&nbsp;% sicher bestimmt. Viele giftige Pflanzen sehen essbaren zum Verwechseln ähnlich. Im Zweifel stehen lassen. Bei Verdacht auf Vergiftung: 112 bzw. Giftnotruf.',
    translation: '',
    toc: 'Inhalt', sources: 'Quellen', license: 'Lizenz',
    sourcesNote: 'Links öffnen sich nur mit Internet. Alle Inhalte dieser Seite sind eigene, zusammengefasste Texte nach den genannten Quellen.',
    quellenTitle: 'Quellen & Lizenzen', quellenLead: 'Woher die Inhalte stammen und unter welcher Lizenz sie stehen.',
    allSources: 'Alle verwendeten Quellen', allSourcesToc: 'Alle Quellen', colSource: 'Quelle', colLicense: 'Lizenz', colUsed: 'Verwendet auf',
    libTitle: 'Bibliothek', libLead: 'Gemeinfreie Handbücher als PDF – komplett offline lesbar.',
    libNone: 'Noch keine PDFs vorhanden. Mit <code>update-content.sh</code> laden (Internet nötig).',
    libFoot: 'Quellen und Lizenzen: siehe <a href="quellen.html">Quellen &amp; Lizenzen</a>. Die Originale sind englisch.', libLang: 'Englisch'
  },
  en: {
    disclaimer: '<strong>Does not replace training.</strong> In an emergency, call <strong>112</strong> first, or keep trying. This page deliberately gives no medication doses – ask a doctor or pharmacist.',
    plant: '⚠ Only eat if you are 100&nbsp;% certain of the identification. Many poisonous plants look confusingly similar to edible ones. When in doubt, leave it. If you suspect poisoning: 112 or the poison information centre.',
    translation: 'Translation of the German page. If anything differs, the German version applies. Emergency numbers and rules refer to Germany.',
    toc: 'Contents', sources: 'Sources', license: 'License',
    sourcesNote: 'Links only open with internet. All content on this page is our own summary based on the sources named.',
    quellenTitle: 'Sources & Licenses', quellenLead: 'Where the content comes from and under which license it is published.',
    allSources: 'All sources used', allSourcesToc: 'All sources', colSource: 'Source', colLicense: 'License', colUsed: 'Used on',
    libTitle: 'Library', libLead: 'Public-domain manuals as PDF – readable completely offline.',
    libNone: 'No PDFs yet. Download them with <code>update-content.sh</code> (internet required).',
    libFoot: 'Sources and licenses: see <a href="quellen.html">Sources &amp; Licenses</a>. The originals are in English.', libLang: 'English'
  },
  es: {
    disclaimer: '<strong>No sustituye a una formación.</strong> En una emergencia, llama primero al <strong>112</strong> o sigue intentándolo. Esta página no indica dosis de medicamentos a propósito: consulta a un médico o a un farmacéutico.',
    plant: '⚠ Come solo si estás 100&nbsp;% seguro de la identificación. Muchas plantas venenosas se parecen mucho a las comestibles. Si tienes dudas, déjala. Si sospechas una intoxicación: 112 o el centro de información toxicológica.',
    translation: 'Traducción de la página alemana. Si hay diferencias, vale la versión alemana. Los números de emergencia y las normas se refieren a Alemania.',
    toc: 'Contenido', sources: 'Fuentes', license: 'Licencia',
    sourcesNote: 'Los enlaces solo se abren con internet. Todo el contenido de esta página es un resumen propio basado en las fuentes indicadas.',
    quellenTitle: 'Fuentes y licencias', quellenLead: 'De dónde proviene el contenido y con qué licencia se publica.',
    allSources: 'Todas las fuentes utilizadas', allSourcesToc: 'Todas las fuentes', colSource: 'Fuente', colLicense: 'Licencia', colUsed: 'Usada en',
    libTitle: 'Biblioteca', libLead: 'Manuales de dominio público en PDF: se leen completamente sin conexión.',
    libNone: 'Todavía no hay PDF. Descárgalos con <code>update-content.sh</code> (se necesita internet).',
    libFoot: 'Fuentes y licencias: consulta <a href="quellen.html">Fuentes y licencias</a>. Los originales están en inglés.', libLang: 'Inglés'
  },
  ar: {
    disclaimer: '<strong>لا يغني عن التدريب.</strong> في حالة الطوارئ اتصل أولاً بالرقم <strong>112</strong> أو واصل المحاولة. لا تذكر هذه الصفحة جرعات الأدوية عمداً – اسأل طبيباً أو صيدلياً.',
    plant: '⚠ لا تأكل إلا إذا كنت متأكداً 100&nbsp;% من التعرف على النبات. كثير من النباتات السامة تشبه الصالحة للأكل بشكل مضلل. عند الشك اتركه. عند الاشتباه بتسمم: 112 أو مركز معلومات السموم.',
    translation: 'ترجمة للصفحة الألمانية. عند أي اختلاف تُعتمد النسخة الألمانية. أرقام الطوارئ والقواعد تخص ألمانيا.',
    toc: 'المحتويات', sources: 'المصادر', license: 'الترخيص',
    sourcesNote: 'الروابط لا تُفتح إلا مع الإنترنت. كل محتوى هذه الصفحة هو تلخيص خاص مبني على المصادر المذكورة.',
    quellenTitle: 'المصادر والتراخيص', quellenLead: 'من أين جاء المحتوى وبأي ترخيص يُنشر.',
    allSources: 'جميع المصادر المستخدمة', allSourcesToc: 'جميع المصادر', colSource: 'المصدر', colLicense: 'الترخيص', colUsed: 'مستخدم في',
    libTitle: 'المكتبة', libLead: 'كتيبات في الملك العام بصيغة PDF – تُقرأ دون إنترنت بالكامل.',
    libNone: 'لا توجد ملفات PDF بعد. حمّلها عبر <code>update-content.sh</code> (يلزم الإنترنت).',
    libFoot: 'المصادر والتراخيص: انظر <a href="quellen.html">المصادر والتراخيص</a>. النسخ الأصلية بالإنجليزية.', libLang: 'الإنجليزية'
  }
};

/* ---------- Seitenvorlage ---------- */
function page({ lang, genPath, title, lead, bodyHtml, toc, sourcesHtml, plant, disclaimer, translated }) {
  const s = STR[lang];
  const depth = lang === 'de' ? '../' : '../../';
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)} – Offline-Ark</title>
  <meta name="color-scheme" content="light dark">
  <meta name="oa-gen" content="${genPath}">
  <meta name="oa-lang" content="${lang}">
  <script src="${depth}js/theme.js"></script>
  <script src="${depth}js/i18n.js"></script>
  <link rel="stylesheet" href="${depth}css/style.css">
</head>
<body data-root="${depth}" data-page="wissen">
<!-- Diese Datei wird von scripts/build.js erzeugt. Bitte Texte in content/ ändern. -->
<main class="container">
  <header class="page-head">
    <h1>${esc(title)}</h1>
    ${lead ? `<p class="lead">${inline(lead)}</p>` : ''}
  </header>
  <article class="prose">
${disclaimer ? `    <div class="callout warn disclaimer"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg><div>${s.disclaimer}</div></div>` : ''}
${plant ? `    <div class="plant-warning" role="alert">${s.plant}</div>` : ''}
${lang !== 'de' && translated !== false && disclaimer ? `    <p class="small muted">${s.translation}</p>` : ''}
${toc.length > 2 ? `    <nav class="toc no-print" aria-label="${esc(s.toc)}">${toc.map((h) => `<a href="#${h.id}">${esc(h.text)}</a>`).join('')}</nav>` : ''}
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

function sourcesBlock(sources, lang) {
  if (!sources.length) return '';
  const s = STR[lang];
  return `<section class="sources"><h2>${s.sources}</h2><ul>` + sources.map((x) =>
    `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" dir="auto">${esc(x.name)}</a> – ${s.license}: ${esc(x.license)}${x.note ? ` · ${esc(x.note)}` : ''}</li>`).join('') +
    `</ul><p class="small muted">${s.sourcesNote}</p></section>`;
}

/** Inhaltsdatei einer Sprache; fehlt sie, wird die deutsche genutzt (und die Seite entsprechend markiert). */
function contentFile(lang, name) {
  const own = path.join(CONTENT, lang === 'de' ? '' : lang, `${name}.md`);
  if (fs.existsSync(own)) return { file: own, translated: true };
  return { file: path.join(CONTENT, `${name}.md`), translated: lang === 'de' };
}
/** Interne Links ../tools/… müssen in Unterordnern eine Ebene weiter hoch. */
function fixLinks(md, lang) { return lang === 'de' ? md : md.replace(/\]\(\.\.\//g, '](../../'); }

function outDir(lang) { return lang === 'de' ? OUT : path.join(OUT, lang); }

/* ---------- Hauptlauf ---------- */
function main() {
  const registry = loadRegistry();
  const search = {};
  const sourcesByLang = {};

  LANGS.forEach((lang) => {
    fs.mkdirSync(outDir(lang), { recursive: true });
    search[lang] = [];
    const allSources = sourcesByLang[lang] = new Map();   // url -> { ..., pages: [] }

    registry.forEach((w) => {
      const { file, translated } = contentFile(lang, w.id);
      if (!fs.existsSync(file)) { console.warn(`! ${path.relative(ROOT, file)} fehlt – Seite wird übersprungen`); return; }
      if (!translated) console.warn(`! ${lang}/${w.id}: keine Übersetzung, deutscher Text wird verwendet`);
      const { meta, body } = frontMatter(fs.readFileSync(file, 'utf8'), file);
      const { html, headings } = markdown(fixLinks(body, lang));
      fs.writeFileSync(path.join(outDir(lang), `${w.id}.html`), page({
        lang, genPath: `wissen/${w.id}.html`, title: meta.title || w.title, lead: meta.lead, bodyHtml: html, toc: headings,
        sourcesHtml: sourcesBlock(meta.sources, lang), plant: meta.plant === 'true', disclaimer: true, translated
      }));
      const plain = body.replace(/[#*`>|:\[\]()_-]/g, ' ').replace(/\s+/g, ' ');
      search[lang].push({ id: w.id, title: meta.title || w.title, headings: headings.map((h) => h.text).join(' · '), text: plain });
      meta.sources.forEach((s) => {
        const e = allSources.get(s.url) || Object.assign({}, s, { pages: [] });
        e.pages.push({ id: w.id, title: meta.title || w.title });
        allSources.set(s.url, e);
      });
    });
    console.log(`✓ wissen/${lang === 'de' ? '' : lang + '/'}*.html`);
  });

  fs.writeFileSync(path.join(ROOT, 'data', 'search-index.js'),
    '/* Erzeugt von scripts/build.js – nicht von Hand bearbeiten. */\nwindow.OA_SEARCH = ' + JSON.stringify(search) + ';\n');
  console.log('✓ data/search-index.js');

  /* Zentrale Seite: Quellen & Lizenzen (je Sprache) */
  LANGS.forEach((lang) => {
    const s = STR[lang];
    const { file: introFile, translated } = contentFile(lang, '_quellen');
    let intro = '', introHeadings = [];
    if (fs.existsSync(introFile)) {
      const parsed = frontMatter(fs.readFileSync(introFile, 'utf8'), introFile);
      const r = markdown(fixLinks(parsed.body, lang)); intro = r.html; introHeadings = r.headings;
    }
    const list = Array.from(sourcesByLang[lang].values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const table = `<h2 id="verwendete-quellen">${s.allSources}</h2><div class="table-wrap"><table><thead><tr><th>${s.colSource}</th><th>${s.colLicense}</th><th>${s.colUsed}</th></tr></thead><tbody>` +
      list.map((x) => `<tr><td><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" dir="auto">${esc(x.name)}</a>${x.note ? `<br><span class="small muted">${esc(x.note)}</span>` : ''}</td><td>${esc(x.license)}</td><td>${x.pages.map((p) => `<a href="${p.id}.html">${esc(p.title)}</a>`).join(', ')}</td></tr>`).join('') +
      '</tbody></table></div>';
    fs.writeFileSync(path.join(outDir(lang), 'quellen.html'), page({
      lang, genPath: 'wissen/quellen.html', title: s.quellenTitle, lead: s.quellenLead,
      bodyHtml: intro + table, toc: introHeadings.concat([{ id: 'verwendete-quellen', text: s.allSourcesToc }]), sourcesHtml: '', disclaimer: false, translated
    }));
  });
  console.log('✓ wissen/**/quellen.html');

  /* Bibliothek aus scripts/library.json (je Sprache; title/desc dürfen Texte oder {de,en,es,ar} sein) */
  const libFile = path.join(__dirname, 'library.json');
  const lib = fs.existsSync(libFile) ? JSON.parse(fs.readFileSync(libFile, 'utf8')) : [];
  const present = lib.filter((l) => fs.existsSync(path.join(ROOT, 'bibliothek', l.file)));
  const pick = (v, lang) => (v && typeof v === 'object') ? (v[lang] || v.de) : v;
  LANGS.forEach((lang) => {
    const s = STR[lang];
    const libHtml = present.length
      ? '<div class="list">' + present.map((l) => {
          const bytes = fs.statSync(path.join(ROOT, 'bibliothek', l.file)).size;
          const size = bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
          const href = (lang === 'de' ? '' : '../') + esc(l.file);
          return `<a href="${href}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/></svg><span class="name">${esc(pick(l.title, lang))}<span class="sub">${esc(pick(l.desc, lang))} · ${s.libLang} · <span class="ltr">${size}</span> · ${s.license}: ${esc(pick(l.license, lang))}</span></span></a>`;
        }).join('') + '</div>'
      : `<p>${s.libNone}</p>`;
    const dir = lang === 'de' ? path.join(ROOT, 'bibliothek') : path.join(ROOT, 'bibliothek', lang);
    fs.mkdirSync(dir, { recursive: true });
    const foot = s.libFoot.replace('href="quellen.html"', `href="${lang === 'de' ? '../wissen/quellen.html' : '../../wissen/' + lang + '/quellen.html'}"`);
    fs.writeFileSync(path.join(dir, 'index.html'), page({
      lang, genPath: 'bibliothek/index.html', title: s.libTitle, lead: s.libLead,
      bodyHtml: libHtml + `<p class="small muted" style="margin-top:16px">${foot}</p>`, toc: [], sourcesHtml: '', disclaimer: false
    }));
  });
  console.log('✓ bibliothek/**/index.html (' + present.length + ' PDFs)');
}

main();
