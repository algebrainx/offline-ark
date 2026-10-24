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
const VERSION = 'bb1f7877f9';
const ASSETS = [
"bibliothek/ar/index.html",
"bibliothek/bilder/knoten/mastwurf-abok11.jpg",
"bibliothek/bilder/knoten/palstek-aussen.jpg",
"bibliothek/bilder/knoten/palstek-innen.jpg",
"bibliothek/bilder/knoten/webeleinenstek.jpg",
"bibliothek/bilder/knoten/zimmermannsstek.jpg",
"bibliothek/bilder/pflanzen/aronstab.jpg",
"bibliothek/bilder/pflanzen/attich.jpg",
"bibliothek/bilder/pflanzen/baerenklau.jpg",
"bibliothek/bilder/pflanzen/baerlauch.jpg",
"bibliothek/bilder/pflanzen/eibe.jpg",
"bibliothek/bilder/pflanzen/eisenhut.jpg",
"bibliothek/bilder/pflanzen/engelstrompete.jpg",
"bibliothek/bilder/pflanzen/falscher-pfifferling.jpg",
"bibliothek/bilder/pflanzen/fingerhut.jpg",
"bibliothek/bilder/pflanzen/gallenroehrling.jpg",
"bibliothek/bilder/pflanzen/giersch.jpg",
"bibliothek/bilder/pflanzen/goldregen.jpg",
"bibliothek/bilder/pflanzen/gruener-knollenblaetterpilz.jpg",
"bibliothek/bilder/pflanzen/heidelbeere.jpg",
"bibliothek/bilder/pflanzen/herbstzeitlose.jpg",
"bibliothek/bilder/pflanzen/holunder.jpg",
"bibliothek/bilder/pflanzen/hundspetersilie.jpg",
"bibliothek/bilder/pflanzen/maigloeckchen.jpg",
"bibliothek/bilder/pflanzen/oelbaumpilz.jpg",
"bibliothek/bilder/pflanzen/pfaffenhuetchen.jpg",
"bibliothek/bilder/pflanzen/pfifferling.jpg",
"bibliothek/bilder/pflanzen/sauerampfer.jpg",
"bibliothek/bilder/pflanzen/schierling.jpg",
"bibliothek/bilder/pflanzen/seidelbast.jpg",
"bibliothek/bilder/pflanzen/stechapfel.jpg",
"bibliothek/bilder/pflanzen/steinpilz.jpg",
"bibliothek/bilder/pflanzen/tollkirsche.jpg",
"bibliothek/bilder/pflanzen/wasserschierling.jpg",
"bibliothek/bilder/pflanzen/weisser-knollenblaetterpilz.jpg",
"bibliothek/bilder/pflanzen/wiesenchampignon.jpg",
"bibliothek/bilder/pflanzen/wilde-moehre.jpg",
"bibliothek/bilder/wolken/altocumulus.jpg",
"bibliothek/bilder/wolken/altostratus.jpg",
"bibliothek/bilder/wolken/cirrocumulus.jpg",
"bibliothek/bilder/wolken/cirrostratus.jpg",
"bibliothek/bilder/wolken/cirrus.jpg",
"bibliothek/bilder/wolken/cumulonimbus.jpg",
"bibliothek/bilder/wolken/cumulus.jpg",
"bibliothek/bilder/wolken/nimbostratus.jpg",
"bibliothek/bilder/wolken/stratocumulus.jpg",
"bibliothek/bilder/wolken/stratus.jpg",
"bibliothek/en/index.html",
"bibliothek/es/index.html",
"bibliothek/index.html",
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
"tools/zeit.html",
"wissen/ar/erste-hilfe.html",
"wissen/ar/feuer-waerme.html",
"wissen/ar/hygiene.html",
"wissen/ar/kommunikation.html",
"wissen/ar/nahrung.html",
"wissen/ar/navigation.html",
"wissen/ar/quellen.html",
"wissen/ar/reparatur.html",
"wissen/ar/strom-energie.html",
"wissen/ar/stromausfall.html",
"wissen/ar/wasser.html",
"wissen/en/erste-hilfe.html",
"wissen/en/feuer-waerme.html",
"wissen/en/hygiene.html",
"wissen/en/kommunikation.html",
"wissen/en/nahrung.html",
"wissen/en/navigation.html",
"wissen/en/quellen.html",
"wissen/en/reparatur.html",
"wissen/en/strom-energie.html",
"wissen/en/stromausfall.html",
"wissen/en/wasser.html",
"wissen/erste-hilfe.html",
"wissen/es/erste-hilfe.html",
"wissen/es/feuer-waerme.html",
"wissen/es/hygiene.html",
"wissen/es/kommunikation.html",
"wissen/es/nahrung.html",
"wissen/es/navigation.html",
"wissen/es/quellen.html",
"wissen/es/reparatur.html",
"wissen/es/strom-energie.html",
"wissen/es/stromausfall.html",
"wissen/es/wasser.html",
"wissen/feuer-waerme.html",
"wissen/hygiene.html",
"wissen/kommunikation.html",
"wissen/nahrung.html",
"wissen/navigation.html",
"wissen/quellen.html",
"wissen/reparatur.html",
"wissen/strom-energie.html",
"wissen/stromausfall.html",
"wissen/wasser.html"
];
const PDFS = ["bibliothek/atp-3-50-21-survival.pdf","bibliothek/fema-are-you-ready.pdf","bibliothek/fema-hazard-info-sheets.pdf","bibliothek/fm-21-10-field-hygiene-sanitation.pdf","bibliothek/fm-24-18-radio-techniques.pdf","bibliothek/fm-4-25-11-first-aid.pdf"];
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
