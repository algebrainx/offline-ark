/* Verfügbare Regionen der Offline-Karte – wird von scripts/fetch-pois.js gepflegt. */
window.OA_KARTE_REGIONS = [
 {
  "id": "bw",
  "name": "Baden-Württemberg",
  "bbox": [
   47.537,
   7.52,
   49.805,
   10.453
  ],
  "stand": "2026-10-23",
  "source": "OpenStreetMap-Auszug (Geofabrik), ODbL",
  "files": {
   "hospital": "data/karte-poi-bw-hospital.js",
   "pharmacy": "data/karte-poi-bw-pharmacy.js",
   "defib": "data/karte-poi-bw-defib.js",
   "fire": "data/karte-poi-bw-fire.js",
   "water": "data/karte-poi-bw-water.js"
  },
  "counts": {
   "hospital": 369,
   "pharmacy": 2165,
   "defib": 4168,
   "fire": 6451,
   "water": 6684
  },
  "geo": "data/karte-geo-bw.js",
  "gemeinden": "data/karte-gemeinden-bw.js"
 }
];
