/* Offline-Ark Einzeldatei – Router der Hülle (wird von scripts/build-single.js in dist/offline-ark.html eingebettet).
 * Die Datei enthält alle Seiten als Text (#oa-data). Der Router setzt die gewünschte Seite zusammen
 * (Skripte, Stile, Wörterbücher und Bilder werden dabei eingefügt) und zeigt sie in einem <iframe srcdoc> an.
 * Dieselbe Herkunft wie die Hülle -> localStorage ist für alle Seiten gemeinsam. Adresse: Datei.html#/tools/zeit.html */
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('oa-data').textContent);
  var PAGES = D.pages, FILES = D.files, ASSETS = D.assets, PDFS = D.pdfs, LANGS = D.langs;
  var ALL = ['de', 'en', 'es', 'ar'];
  var frame = null, current = '';

  /* ---------- Sprache (gleiche Regeln wie js/i18n.js) ---------- */
  function stored() {
    try { var v = JSON.parse(localStorage.getItem('oa.lang')); return ALL.indexOf(v) !== -1 ? v : null; } catch (e) { return null; }
  }
  function detect() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'de'];
    for (var i = 0; i < list.length; i++) {
      var l = String(list[i]).toLowerCase().slice(0, 2);
      if (ALL.indexOf(l) !== -1) return l;
    }
    return 'de';
  }
  function lang() { var l = stored() || detect(); return LANGS.indexOf(l) !== -1 ? l : LANGS[0]; }
  // Nur enthaltene Sprachen zulassen, damit Seite und Wörterbuch zusammenpassen
  if ((stored() || detect()) !== lang()) { try { localStorage.setItem('oa.lang', JSON.stringify(lang())); } catch (e) { /* ignorieren */ } }

  /* ---------- Adressen ---------- */
  function resolve(href, from) {
    var u = new URL(href, 'http://oa.invalid/' + from);
    var p;
    try { p = decodeURIComponent(u.pathname.slice(1)); } catch (e) { p = u.pathname.slice(1); }
    if (!p || p.charAt(p.length - 1) === '/') p += 'index.html';
    return { path: p, hash: u.hash };
  }
  /** Erzeugte Seiten (knowledge/, library/) gibt es je Sprache: knowledge/x.html -> knowledge/en/x.html */
  function localize(path, l) {
    var m = /^(knowledge|library)\/(?:(?:en|es|ar)\/)?([^\/]+\.html)$/.exec(path);
    if (!m) return path;
    return l === 'de' ? m[1] + '/' + m[2] : m[1] + '/' + l + '/' + m[2];
  }

  /* ---------- Seite zusammensetzen ---------- */
  function assemble(html, key, hash) {
    var l = lang();
    var pre = '<script>window.OA_SINGLE=' + JSON.stringify({ path: key, hash: hash || '' }).replace(/</g, '\\u003c') + ';</script><script>' + D.bridge + '</script>';
    return html
      .replace(/<script data-oa="([^"]+)"><\/script>/g, function (m, p) { return FILES[p] == null ? '' : '<script>' + FILES[p] + '</script>'; })
      .replace(/<script data-oa-dict="([^"]+)"><\/script>/g, function (m, n) {
        var f = FILES['data/i18n/' + n + '.js'];
        return l === 'de' || f == null ? '' : '<script>' + f + '</script>';
      })
      .replace(/<link data-oa-css="([^"]+)">/g, function (m, p) { return FILES[p] == null ? '' : '<style>' + FILES[p] + '</style>'; })
      .replace(/oa-asset:([^"'\s)<>]+)/g, function (m, p) { return ASSETS[p] || m; })
      .replace(/<head>/i, function () { return '<head>' + pre; });
  }

  var MSG = {
    de: ['Nicht in der Einzeldatei', 'Dieser Teil (zum Beispiel ein PDF oder eine andere Sprache) ist in dieser Datei nicht enthalten. Er steckt im vollständigen Offline-Ark-Ordner.', 'Zur Startseite'],
    en: ['Not in the single file', 'This part (for example a PDF or another language) is not included in this file. It is in the complete Offline-Ark folder.', 'Go to start page'],
    es: ['No está en el archivo único', 'Esta parte (por ejemplo un PDF u otro idioma) no está incluida en este archivo. Está en la carpeta completa de Offline-Ark.', 'Ir al inicio'],
    ar: ['غير موجود في الملف الواحد', 'هذا الجزء (مثل ملف PDF أو لغة أخرى) غير مضمّن في هذا الملف. وهو موجود في مجلد Offline-Ark الكامل.', 'إلى الصفحة الرئيسية']
  };
  function missingPage() {
    var l = lang(), m = MSG[l] || MSG.de;
    return '<!DOCTYPE html><html lang="' + l + '" dir="' + (l === 'ar' ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + m[0] + ' – Offline-Ark</title><script data-oa="js/theme.js"></script><link data-oa-css="css/style.css"></head>' +
      '<body class="container" style="padding-top:48px"><main><h1>' + m[0] + '</h1><p>' + m[1] + '</p><p><a class="btn primary" href="index.html">' + m[2] + '</a></p></main></body></html>';
  }

  /* ---------- Anzeigen ---------- */
  function show(key, hash) {
    var html = key ? PAGES[key] : missingPage();
    var f = document.createElement('iframe');
    f.className = 'oa';
    f.setAttribute('allow', 'fullscreen; geolocation; clipboard-write; clipboard-read; camera; microphone; autoplay; screen-wake-lock; accelerometer; gyroscope; magnetometer');
    f.title = 'Offline-Ark';
    f.style.visibility = 'hidden';
    f.addEventListener('load', function () {
      f.style.visibility = '';
      var old = frame;
      frame = f;
      if (old && old !== f) old.remove();
      try { document.title = f.contentDocument.title || 'Offline-Ark'; f.contentWindow.focus(); } catch (e) { /* ignorieren */ }
    });
    f.srcdoc = assemble(html, key || 'index.html', hash);
    document.body.appendChild(f);
  }

  function openPdf(path) {
    var b64 = PDFS[path];
    if (!b64) { show(null, ''); return; }
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), '_blank');
  }

  /** mode: 'push' (neuer Verlaufseintrag), 'replace' oder 'silent' (Zurück-Knopf des Browsers) */
  function open(path, hash, mode) {
    if (/\.pdf$/i.test(path)) { openPdf(path); return; }
    var target = localize(path, lang());
    if (!PAGES[target]) target = PAGES[path] ? path : null;
    var shown = target || path;
    if (mode === 'push' && shown === current && !hash) mode = 'replace';
    if (mode === 'push') history.pushState(null, '', '#/' + shown);
    else if (mode === 'replace') history.replaceState(null, '', '#/' + shown);
    current = shown;
    show(target, hash);
  }

  function go(href, from, replace) {
    var r = resolve(href, from || current || 'index.html');
    open(r.path, r.hash, replace ? 'replace' : 'push');
  }

  window.OA_ROUTER = {
    langs: LANGS,
    go: go,
    asset: function (v, from) { var r = resolve(v, from); return ASSETS[r.path] || null; }
  };

  function fromAddress(mode) {
    var h = location.hash;
    var path = /^#\//.test(h) ? h.slice(2) : 'index.html';
    var r = resolve(path, 'index.html');
    open(r.path, '', mode);
  }
  window.addEventListener('popstate', function () { fromAddress('silent'); });
  // Strg+P in der Hülle druckt die Seite im Fenster
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'p' && frame) { e.preventDefault(); frame.contentWindow.print(); }
  });
  fromAddress('replace');
})();
