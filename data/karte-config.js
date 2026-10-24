/* Offline-Ark – Einstellungen der Offline-Karte (kann von Hand angepasst werden).
 *
 * tiles: Optionale Raster-Kacheln, die du selbst in bibliothek/karten/{z}/{x}/{y}.png (oder .jpg/.webp) ablegst.
 *   path        Muster relativ zur Seite tools/karte.html; {z}/{x}/{y} werden ersetzt (Dateiendung kommt von exts)
 *   exts        Dateiendungen, die der Reihe nach probiert werden
 *   minZoom/maxZoom  Zoomstufen, für die Kacheln vorhanden sind
 *   enabled     true = Kacheln beim Start verwenden (sonst per Schalter auf der Seite zuschaltbar)
 *   attribution Text der Quellenangabe, die bei Kacheln eingeblendet wird – bitte an deine Kachelquelle anpassen!
 * Fehlen Kacheln, fällt die Karte leise auf die Vektorkarte zurück. */
window.OA_KARTE_CONFIG = {
  view: { lat: 48.83, lon: 9.32, zoom: 10 },          // Standardansicht: Waiblingen / Stuttgart
  minZoom: 4,
  maxZoom: 19,
  tiles: {
    enabled: false,
    path: '../bibliothek/karten/{z}/{x}/{y}',
    exts: ['png', 'jpg', 'webp'],
    minZoom: 0,
    maxZoom: 17,
    attribution: '© OpenStreetMap-Mitwirkende'
  },
  attribution: '© OpenStreetMap-Mitwirkende (ODbL) · Natural Earth (gemeinfrei)'
};
