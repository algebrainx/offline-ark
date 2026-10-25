/* Offline-Ark – Service Worker (nur bei https:// oder http://localhost, nie unter file://).
 *
 * Strategie: Cache zuerst, dann Netz. Alle lokalen Dateien werden beim Installieren
 * in einen Cache gelegt, dessen Name die Version enthält. Eine neue Version wartet,
 * bis alle Fenster der App geschlossen sind, und gilt dann ab dem nächsten Start
 * (kein Neuladen mitten in der Benutzung). PDFs liegen in einem eigenen Cache und
 * werden nur auf Wunsch gespeichert (Knopf auf der Bibliothek-Seite).
 *
 * Der Block zwischen den Markierungen wird von scripts/build-pwa.js erzeugt. */
'use strict';

/* <generated> */
const VERSION = '7c0014ede7';
const ASSETS = [
"css/style.css",
"data/ablaufplan.js",
"data/assistent.js",
"data/aushaenge.js",
"data/brennholz.js",
"data/checklisten.js",
"data/einheiten.js",
"data/einkochen.js",
"data/funk-alphabet.js",
"data/garten.js",
"data/i18n/core.js",
"data/i18n/tool-ablaufplan.js",
"data/i18n/tool-assistent.js",
"data/i18n/tool-ausdruck.js",
"data/i18n/tool-aushaenge.js",
"data/i18n/tool-brennholz.js",
"data/i18n/tool-chat.js",
"data/i18n/tool-checklisten.js",
"data/i18n/tool-einheiten.js",
"data/i18n/tool-einkochen.js",
"data/i18n/tool-entkeimung.js",
"data/i18n/tool-funk.js",
"data/i18n/tool-garten.js",
"data/i18n/tool-inventar.js",
"data/i18n/tool-karte.js",
"data/i18n/tool-kinder.js",
"data/i18n/tool-knoten.js",
"data/i18n/tool-kompass.js",
"data/i18n/tool-kontakte.js",
"data/i18n/tool-koordinaten.js",
"data/i18n/tool-metronom.js",
"data/i18n/tool-morse.js",
"data/i18n/tool-morsetrainer.js",
"data/i18n/tool-notfallpass.js",
"data/i18n/tool-notizen.js",
"data/i18n/tool-notvorrat.js",
"data/i18n/tool-pflanzen.js",
"data/i18n/tool-qrcode.js",
"data/i18n/tool-quiz.js",
"data/i18n/tool-sonne.js",
"data/i18n/tool-sos.js",
"data/i18n/tool-sternbilder.js",
"data/i18n/tool-strom.js",
"data/i18n/tool-taschenrechner.js",
"data/i18n/tool-tierspuren.js",
"data/i18n/tool-wasserbedarf.js",
"data/i18n/tool-wolken.js",
"data/i18n/tool-zeit.js",
"data/karte-base.js",
"data/karte-config.js",
"data/karte-gemeinden-bw.js",
"data/karte-geo-bw.js",
"data/karte-poi-bw-defib.js",
"data/karte-poi-bw-fire.js",
"data/karte-poi-bw-hospital.js",
"data/karte-poi-bw-pharmacy.js",
"data/karte-poi-bw-water.js",
"data/karte-regions.js",
"data/kinder.js",
"data/knoten-szenen.js",
"data/knoten.js",
"data/morse-table.js",
"data/pflanzen.js",
"data/print-pages.js",
"data/quiz-fragen.js",
"data/search-index.js",
"data/sternbilder.js",
"data/tierspuren.js",
"data/tools.js",
"data/wolken.js",
"icons/apple-touch-icon.png",
"icons/icon-192.png",
"icons/icon-512.png",
"icons/icon-maskable-512.png",
"icons/icon-maskable.svg",
"icons/icon.svg",
"index.html",
"js/brennholz-core.js",
"js/common.js",
"js/einkochen-core.js",
"js/garten-core.js",
"js/home.js",
"js/i18n.js",
"js/icons.js",
"js/inventar-core.js",
"js/karte-core.js",
"js/kinder-core.js",
"js/knoten-core.js",
"js/kontakte-core.js",
"js/notfallpass-core.js",
"js/notizen-core.js",
"js/pwa.js",
"js/qr-encoder.js",
"js/theme.js",
"js/tool-ablaufplan.js",
"js/tool-assistent.js",
"js/tool-ausdruck.js",
"js/tool-aushaenge.js",
"js/tool-brennholz.js",
"js/tool-chat.js",
"js/tool-checklisten.js",
"js/tool-einheiten.js",
"js/tool-einkochen.js",
"js/tool-entkeimung.js",
"js/tool-funk.js",
"js/tool-garten.js",
"js/tool-inventar.js",
"js/tool-karte.js",
"js/tool-kinder.js",
"js/tool-knoten.js",
"js/tool-kompass.js",
"js/tool-kontakte.js",
"js/tool-koordinaten.js",
"js/tool-metronom.js",
"js/tool-morse.js",
"js/tool-morsetrainer.js",
"js/tool-notfallpass.js",
"js/tool-notizen.js",
"js/tool-notvorrat.js",
"js/tool-pflanzen.js",
"js/tool-qrcode.js",
"js/tool-quiz.js",
"js/tool-sonne.js",
"js/tool-sos.js",
"js/tool-sternbilder.js",
"js/tool-strom.js",
"js/tool-taschenrechner.js",
"js/tool-tierspuren.js",
"js/tool-wasserbedarf.js",
"js/tool-wolken.js",
"js/tool-zeit.js",
"knowledge/ar/erste-hilfe.html",
"knowledge/ar/feuer-waerme.html",
"knowledge/ar/hygiene.html",
"knowledge/ar/kommunikation.html",
"knowledge/ar/nahrung.html",
"knowledge/ar/navigation.html",
"knowledge/ar/quellen.html",
"knowledge/ar/reparatur.html",
"knowledge/ar/strom-energie.html",
"knowledge/ar/stromausfall.html",
"knowledge/ar/wasser.html",
"knowledge/en/erste-hilfe.html",
"knowledge/en/feuer-waerme.html",
"knowledge/en/hygiene.html",
"knowledge/en/kommunikation.html",
"knowledge/en/nahrung.html",
"knowledge/en/navigation.html",
"knowledge/en/quellen.html",
"knowledge/en/reparatur.html",
"knowledge/en/strom-energie.html",
"knowledge/en/stromausfall.html",
"knowledge/en/wasser.html",
"knowledge/erste-hilfe.html",
"knowledge/es/erste-hilfe.html",
"knowledge/es/feuer-waerme.html",
"knowledge/es/hygiene.html",
"knowledge/es/kommunikation.html",
"knowledge/es/nahrung.html",
"knowledge/es/navigation.html",
"knowledge/es/quellen.html",
"knowledge/es/reparatur.html",
"knowledge/es/strom-energie.html",
"knowledge/es/stromausfall.html",
"knowledge/es/wasser.html",
"knowledge/feuer-waerme.html",
"knowledge/hygiene.html",
"knowledge/kommunikation.html",
"knowledge/nahrung.html",
"knowledge/navigation.html",
"knowledge/quellen.html",
"knowledge/reparatur.html",
"knowledge/strom-energie.html",
"knowledge/stromausfall.html",
"knowledge/wasser.html",
"library/ar/index.html",
"library/en/index.html",
"library/es/index.html",
"library/images/knoten/mastwurf-abok11.jpg",
"library/images/knoten/palstek-aussen.jpg",
"library/images/knoten/palstek-innen.jpg",
"library/images/knoten/webeleinenstek.jpg",
"library/images/knoten/zimmermannsstek.jpg",
"library/images/pflanzen/aronstab.jpg",
"library/images/pflanzen/attich.jpg",
"library/images/pflanzen/baerenklau.jpg",
"library/images/pflanzen/baerlauch.jpg",
"library/images/pflanzen/eibe.jpg",
"library/images/pflanzen/eisenhut.jpg",
"library/images/pflanzen/engelstrompete.jpg",
"library/images/pflanzen/falscher-pfifferling.jpg",
"library/images/pflanzen/fingerhut.jpg",
"library/images/pflanzen/gallenroehrling.jpg",
"library/images/pflanzen/giersch.jpg",
"library/images/pflanzen/goldregen.jpg",
"library/images/pflanzen/gruener-knollenblaetterpilz.jpg",
"library/images/pflanzen/heidelbeere.jpg",
"library/images/pflanzen/herbstzeitlose.jpg",
"library/images/pflanzen/holunder.jpg",
"library/images/pflanzen/hundspetersilie.jpg",
"library/images/pflanzen/maigloeckchen.jpg",
"library/images/pflanzen/oelbaumpilz.jpg",
"library/images/pflanzen/pfaffenhuetchen.jpg",
"library/images/pflanzen/pfifferling.jpg",
"library/images/pflanzen/sauerampfer.jpg",
"library/images/pflanzen/schierling.jpg",
"library/images/pflanzen/seidelbast.jpg",
"library/images/pflanzen/stechapfel.jpg",
"library/images/pflanzen/steinpilz.jpg",
"library/images/pflanzen/tollkirsche.jpg",
"library/images/pflanzen/wasserschierling.jpg",
"library/images/pflanzen/weisser-knollenblaetterpilz.jpg",
"library/images/pflanzen/wiesenchampignon.jpg",
"library/images/pflanzen/wilde-moehre.jpg",
"library/images/wolken/altocumulus.jpg",
"library/images/wolken/altostratus.jpg",
"library/images/wolken/cirrocumulus.jpg",
"library/images/wolken/cirrostratus.jpg",
"library/images/wolken/cirrus.jpg",
"library/images/wolken/cumulonimbus.jpg",
"library/images/wolken/cumulus.jpg",
"library/images/wolken/nimbostratus.jpg",
"library/images/wolken/stratocumulus.jpg",
"library/images/wolken/stratus.jpg",
"library/index.html",
"manifest.webmanifest",
"tools/ablaufplan.html",
"tools/assistent.html",
"tools/ausdruck.html",
"tools/aushaenge.html",
"tools/brennholz.html",
"tools/chat.html",
"tools/checklisten.html",
"tools/einheiten.html",
"tools/einkochen.html",
"tools/entkeimung.html",
"tools/funk.html",
"tools/garten.html",
"tools/inventar.html",
"tools/karte.html",
"tools/kinder.html",
"tools/knoten.html",
"tools/kompass.html",
"tools/kontakte.html",
"tools/koordinaten.html",
"tools/metronom.html",
"tools/morse.html",
"tools/morsetrainer.html",
"tools/notfallpass.html",
"tools/notizen.html",
"tools/notvorrat.html",
"tools/pflanzen.html",
"tools/qrcode.html",
"tools/quiz.html",
"tools/sonne.html",
"tools/sos.html",
"tools/sternbilder.html",
"tools/strom.html",
"tools/taschenrechner.html",
"tools/tierspuren.html",
"tools/wasserbedarf.html",
"tools/wolken.html",
"tools/zeit.html"
];
const PDFS = ["library/atp-3-50-21-survival.pdf","library/fema-are-you-ready.pdf","library/fema-hazard-info-sheets.pdf","library/fm-21-10-field-hygiene-sanitation.pdf","library/fm-24-18-radio-techniques.pdf","library/fm-4-25-11-first-aid.pdf"];
/* </generated> */

const CACHE = 'oa-static-' + VERSION;
const PDF_CACHE = 'oa-pdf';
const SCOPE = self.registration.scope;
const abs = (p) => new URL(p, SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(ASSETS.map((p) => new Request(abs(p), { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('oa-static-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin || !u.href.startsWith(SCOPE)) return;
  event.respondWith(answer(req, u));
});

async function answer(req, u) {
  const key = (u.pathname.endsWith('/') ? u.origin + u.pathname + 'index.html' : u.origin + u.pathname);
  const hit = await caches.match(key);
  if (hit) return req.headers.get('range') ? partial(hit, req.headers.get('range')) : hit;
  try {
    return await fetch(req);
  } catch (err) {
    if (req.mode === 'navigate') {
      const home = await caches.match(abs('index.html'));
      if (home) return home;
    }
    throw err;
  }
}

/** Der PDF-Betrachter fragt Teile einer Datei an (Range); aus dem Cache liefern wir sie selbst. */
async function partial(res, range) {
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = (m[1] === '' || m[2] === '') ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1)
    }
  });
}

/* Nachricht von js/pwa.js: PDFs zusätzlich speichern. Antwort über den mitgesendeten Port. */
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'cache-pdfs') return;
  const port = event.ports && event.ports[0];
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(PDF_CACHE);
      for (const p of PDFS) {
        const url = abs(p);
        if (!(await cache.match(url))) await cache.add(new Request(url, { cache: 'reload' }));
      }
      if (port) port.postMessage({ ok: true, count: PDFS.length });
    } catch (err) {
      if (port) port.postMessage({ ok: false });
    }
  })());
});
