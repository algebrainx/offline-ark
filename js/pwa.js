/* Offline-Ark – App-Installation (PWA): meldet den Service Worker an.
 * Läuft nur bei https:// oder http://localhost – unter file:// (Doppelklick) und im LAN ohne
 * HTTPS tut dieses Skript nichts, die Seiten funktionieren dort trotzdem wie gewohnt.
 * Stellt window.OA_PWA bereit: { supported, cachePdfs() }. */
(function () {
  'use strict';
  if (window.OA_PWA) return;
  var api = window.OA_PWA = { supported: false, cachePdfs: function () { return Promise.reject(new Error('nicht verfügbar')); } };
  var cs = document.currentScript;
  var base = cs && cs.src ? cs.src.replace(/js\/pwa\.js(\?.*)?$/, '') : '';
  if (!base || !/^https?:$/.test(location.protocol) || !('serviceWorker' in navigator)) return;
  api.supported = true;

  api.cachePdfs = function () {
    return navigator.serviceWorker.ready.then(function (reg) {
      return new Promise(function (resolve, reject) {
        var ch = new MessageChannel();
        ch.port1.onmessage = function (e) { if (e.data && e.data.ok) resolve(e.data.count); else reject(new Error('fehlgeschlagen')); };
        (reg.active || navigator.serviceWorker.controller).postMessage({ type: 'cache-pdfs' }, [ch.port2]);
      });
    });
  };

  function offerPdfButton() {
    var box = document.getElementById('oa-pdf-offline'), btn = document.getElementById('oa-pdf-btn'), out = document.getElementById('oa-pdf-status');
    if (!box || !btn) return;
    box.hidden = false;
    btn.addEventListener('click', function () {
      btn.disabled = true; out.textContent = btn.getAttribute('data-busy');
      api.cachePdfs().then(function () { out.textContent = btn.getAttribute('data-done'); })
        .catch(function () { out.textContent = btn.getAttribute('data-fail'); btn.disabled = false; });
    });
  }

  function start() {
    navigator.serviceWorker.register(base + 'sw.js', { scope: base }).catch(function () { /* ohne App-Funktion weiter */ });
    navigator.serviceWorker.ready.then(offerPdfButton);
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
