/* Offline-Ark – Theme-Steuerung.
 * Wird im <head> synchron geladen, damit die Seite nicht kurz im falschen
 * Design aufblitzt. Gespeichert wird in localStorage (mit try/catch, weil
 * manche Browser das unter file:// verweigern). */
(function () {
  'use strict';
  var root = document.documentElement;

  function read(key, fallback) {
    try { var v = localStorage.getItem('oa.' + key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }

  /** "auto" folgt dem System, sonst light | dark | night */
  function resolve(pref) {
    if (pref === 'light' || pref === 'dark' || pref === 'night') return pref;
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return dark ? 'dark' : 'light';
  }

  function apply() {
    root.setAttribute('data-theme', resolve(read('theme', 'auto')));
    var fs = read('fontsize', 'normal');
    if (fs === 'large' || fs === 'xlarge') root.setAttribute('data-fs', fs); else root.removeAttribute('data-fs');
  }

  apply();
  window.OA_applyTheme = apply;
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', apply);
  }
})();
