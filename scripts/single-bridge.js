/* Offline-Ark Einzeldatei – Brücke in jeder Seite (wird von scripts/build-single.js eingebettet).
 * Läuft als ERSTES Skript im <head> jeder Seite, noch vor js/i18n.js. Die Seiten selbst bleiben
 * unverändert; diese Brücke ersetzt, was in einem eingebetteten Fenster (about:srcdoc) nicht geht:
 *   - Links und location.* -> der Router der Hülle (parent.OA_ROUTER) öffnet die richtige Seite
 *   - OA.setLang -> Seite in der neuen Sprache neu öffnen (i18n.js bleibt unverändert, siehe setter unten)
 *   - Bilder mit relativem Pfad -> eingebettete data:-Adressen
 *   - Strg+P -> druckt diese Seite statt der Hülle
 * Zugriffe auf location.hash/pathname/href/replace/assign in den Seitenskripten schreibt der Build
 * auf OA_LOC um (nur in der Einzeldatei). window.OA_SINGLE = { path, hash } setzt der Router davor. */
(function () {
  'use strict';
  var R = parent.OA_ROUTER, S = window.OA_SINGLE;

  function nav(v, replace) { R.go(String(v), S.path, replace); }

  function scrollToHash(h) {
    if (!h) return;
    var id = h.slice(1);
    try { id = decodeURIComponent(id); } catch (e) { /* unverändert lassen */ }
    var el = document.getElementById(id) || document.getElementsByName(id)[0];
    if (el) el.scrollIntoView();
  }
  function setHash(h) {
    h = String(h || '');
    if (h && h.charAt(0) !== '#') h = '#' + h;
    if (h === '#') h = '';
    var changed = h !== S.hash;
    S.hash = h;
    scrollToHash(h);
    if (changed) { try { window.dispatchEvent(new Event('hashchange')); } catch (e) { /* ignorieren */ } }
  }

  window.OA_LOC = {
    get href() { return 'offline-ark.html#/' + S.path + S.hash; },
    set href(v) { nav(v); },
    get hash() { return S.hash; },
    set hash(v) { setHash(v); },
    get pathname() { return '/' + S.path; },
    get search() { return ''; },
    replace: function (v) { nav(v, true); },
    assign: function (v) { nav(v); }
  };

  /* i18n.js setzt OA.setLang später selbst; der leere Setter lässt diese Fassung bestehen. */
  var OA = window.OA = window.OA || {};
  Object.defineProperty(OA, 'setLang', {
    configurable: true, enumerable: true,
    get: function () {
      return function (l) {
        if (R.langs.indexOf(l) === -1) return;
        try { localStorage.setItem('oa.lang', JSON.stringify(l)); } catch (e) { /* ignorieren */ }
        R.go('/' + S.path + S.hash, S.path, true);
      };
    },
    set: function () { /* ignorieren */ }
  });

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.hasAttribute('download')) return;
    var h = a.getAttribute('href');
    if (/^(blob:|data:|javascript:)/i.test(h)) return;
    if (/^(https?:|mailto:|tel:|sms:|geo:)/i.test(h)) {
      if (/^https?:/i.test(h) && !a.target) { a.target = '_blank'; a.rel = 'noopener'; }
      return;
    }
    e.preventDefault();
    if (h.charAt(0) === '#') setHash(h); else nav(h);
  }, true);

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 'p') { e.preventDefault(); window.print(); }
  });

  /* Bilder, die erst per Skript entstehen (img.src = OA.root + 'bilder/x.jpg'), nachträglich auf data: umstellen */
  var ATTR = { IMG: 'src', SOURCE: 'src', VIDEO: 'poster', AUDIO: 'src' };
  function fix(el) {
    var k = ATTR[el.tagName];
    var v = k && el.getAttribute(k);
    if (!v || /^(data:|blob:|https?:|oa-asset:)/i.test(v)) return;
    var uri = R.asset(v, S.path);
    if (uri) el.setAttribute(k, uri);
  }
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type === 'attributes') { fix(m.target); return; }
      Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        fix(n);
        Array.prototype.forEach.call(n.querySelectorAll('img,source,video,audio'), fix);
      });
    });
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'poster'] });

  window.addEventListener('load', function () { scrollToHash(S.hash); });
})();
