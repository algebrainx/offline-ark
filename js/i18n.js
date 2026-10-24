/* Offline-Ark – Mehrsprachigkeit (de, en, es, ar).
 *
 * Prinzip: Der deutsche Text IST der Schlüssel. Fehlt eine Übersetzung,
 * erscheint einfach der deutsche Text – nichts bricht.
 *   OA.t('Personen')                        -> "Persons" (wenn Sprache en)
 *   OA.t('Wasser ({0} l)', [12])            -> "Water (12 l)"
 * Statische Seitentexte (Textknoten, placeholder, aria-label, title, alt)
 * werden automatisch übersetzt; Blöcke mit eingebetteten Tags über
 * data-t="" (Schlüssel = deutsches innerHTML). Bereiche mit data-notranslate
 * (z. B. Nutzereingaben) bleiben unberührt.
 *
 * Wörterbücher liegen in data/i18n/*.js und werden nur für Nicht-Deutsch
 * geladen. Das Laden geschieht synchron per document.write, damit es unter
 * file:// ohne fetch() funktioniert und vor den Seitenskripten fertig ist.
 *
 * Wörterbuch-Format (eine Datei je Werkzeug: data/i18n/tool-<id>.js):
 *   OA.i18n.add({ "Personen": { en: "Persons", es: "Personas", ar: "الأشخاص" } });
 */
(function () {
  'use strict';
  var OA = window.OA = window.OA || {};
  var LANGS = ['de', 'en', 'es', 'ar'];
  var root = document.documentElement;

  /* ---------- Sprache bestimmen ---------- */
  function stored() {
    try { var v = JSON.parse(localStorage.getItem('oa.lang')); return LANGS.indexOf(v) !== -1 ? v : null; } catch (e) { return null; }
  }
  function detect() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'de'];
    for (var i = 0; i < list.length; i++) {
      var l = String(list[i]).toLowerCase().slice(0, 2);
      if (LANGS.indexOf(l) !== -1) return l;
    }
    return 'de';
  }
  var lang = stored() || detect();

  OA.LANGS = LANGS;
  OA.lang = lang;
  OA.dir = lang === 'ar' ? 'rtl' : 'ltr';
  // Zahlen- und Datumsformat; Arabisch bewusst mit lateinischen Ziffern (gut lesbar, überall gleich)
  OA.locale = { de: 'de-DE', en: 'en-GB', es: 'es-ES', ar: 'ar-u-nu-latn' }[lang];
  OA.langNames = { de: 'Deutsch', en: 'English', es: 'Español', ar: 'العربية' };
  root.setAttribute('lang', lang);
  root.setAttribute('dir', OA.dir);

  /* ---------- Wörterbuch und Übersetzen ---------- */
  var dict = {};
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  OA.i18n = {
    dict: dict,
    add: function (obj) {
      Object.keys(obj).forEach(function (k) {
        var key = norm(k);
        dict[key] = Object.assign(dict[key] || {}, obj[k]);
      });
    }
  };
  /** Übersetzt einen deutschen Text; {0}, {1} … werden durch args ersetzt. */
  OA.t = function (de, args) {
    var e = lang !== 'de' ? dict[norm(de)] : null;
    var r = (e && e[lang]) ? e[lang] : de;
    if (args) r = r.replace(/\{(\d+)\}/g, function (m, i) { return args[i] == null ? m : args[i]; });
    return r;
  };

  /* ---------- Wörterbücher laden (nur Nicht-Deutsch) ---------- */
  var cs = document.currentScript;
  var base = cs && cs.src ? cs.src.replace(/js\/i18n\.js(\?.*)?$/, '') : '';
  OA.base = base;
  if (lang !== 'de' && base) {
    var files = ['core'];
    var m = location.pathname.match(/\/tools\/([\w-]+)\.html$/);
    if (m) files.push('tool-' + m[1]);
    files.forEach(function (f) { document.write('<script src="' + base + 'data/i18n/' + f + '.js"><\/script>'); });
  }

  /* ---------- Erzeugte Seiten (Wissen, Quellen, Bibliothek) in der Sprache öffnen ---------- */
  /** 'wissen/x.html' -> 'wissen/en/x.html' (Deutsch bleibt ohne Unterordner) */
  OA.genPath = function (path, l) {
    l = l || lang;
    if (l === 'de') return path;
    var i = path.lastIndexOf('/');
    return path.slice(0, i + 1) + l + '/' + path.slice(i + 1);
  };
  OA.genUrl = function (path, l) { return (OA.root || '') + OA.genPath(path, l); };

  var metaGen = document.querySelector('meta[name="oa-gen"]');
  var metaLang = document.querySelector('meta[name="oa-lang"]');
  if (metaGen && metaLang && metaLang.content !== lang && base) {
    // Die Seite existiert in der gewählten Sprache: dorthin wechseln
    location.replace(base + OA.genPath(metaGen.content, lang) + location.hash);
  }

  /** Sprache umstellen: erzeugte Seiten wechseln die Adresse, alles andere lädt neu. */
  OA.setLang = function (l) {
    if (LANGS.indexOf(l) === -1) return;
    try { localStorage.setItem('oa.lang', JSON.stringify(l)); } catch (e) { /* ignorieren */ }
    if (metaGen && base) location.href = base + OA.genPath(metaGen.content, l);
    else location.reload();
  };

  /* ---------- Automatische Übersetzung des DOM ---------- */
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };

  function translateNode(node) {
    if (node.nodeType === 3) {
      var raw = node.nodeValue, key = norm(raw);
      if (!key) return;
      var e = dict[key];
      if (e && e[lang]) {
        var lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
        node.nodeValue = lead + e[lang] + trail;
      }
      return;
    }
    if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'NOSCRIPT') return;
    if (node.hasAttribute('data-notranslate') || node.isContentEditable) return;
    ATTRS.forEach(function (a) {
      if (node.hasAttribute(a)) {
        var e = dict[norm(node.getAttribute(a))];
        if (e && e[lang]) node.setAttribute(a, e[lang]);
      }
    });
    if (node.tagName === 'TEXTAREA') return;   // Inhalt gehört dem Nutzer, nur Platzhalter wird übersetzt
    if (node.hasAttribute('data-t')) {
      var blk = dict[norm(node.innerHTML)];
      if (blk && blk[lang]) { node.innerHTML = blk[lang]; node.removeAttribute('data-t'); return; }
    }
    for (var c = node.firstChild; c; c = c.nextSibling) translateNode(c);
  }
  OA.translateDom = function (el) { if (lang !== 'de') translateNode(el || document.body); };

  if (lang !== 'de') {
    var busy = false;
    var observer = new MutationObserver(function (muts) {
      if (busy) return;
      busy = true;
      muts.forEach(function (mu) { for (var i = 0; i < mu.addedNodes.length; i++) translateNode(mu.addedNodes[i]); });
      busy = false;
    });
    document.addEventListener('DOMContentLoaded', function () {
      // <title>: ganzer Titel, sonst "Seitenname – Offline-Ark" (nur der Seitenname wird übersetzt)
      var whole = OA.t(document.title);
      if (whole !== document.title) document.title = whole;
      else { var parts = document.title.split(' – '); document.title = OA.t(parts[0]) + (parts[1] ? ' – ' + parts[1] : ''); }
      translateNode(document.body);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
