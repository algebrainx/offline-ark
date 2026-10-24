/* Offline-Ark – Einheiten und Umrechnung.
 * Jede Kategorie hat eine Basiseinheit; "f" ist der exakte Faktor Einheit -> Basis.
 * Temperatur ist nicht linear: dort stehen to/from (Basis = Kelvin).
 * Akku: Basis = Wh; die Faktoren hängen von der Spannung ab (f ist dann eine Funktion).
 * Läuft im Browser (window.OA_EINHEITEN) und in Node (module.exports) für Tests. */
(function () {
  'use strict';

  var CATS = [
    { id: 'laenge', name: 'Länge', base: 'm', units: [
      { id: 'mm', name: 'Millimeter', sym: 'mm', f: 0.001 },
      { id: 'cm', name: 'Zentimeter', sym: 'cm', f: 0.01 },
      { id: 'm', name: 'Meter', sym: 'm', f: 1 },
      { id: 'km', name: 'Kilometer', sym: 'km', f: 1000 },
      { id: 'zoll', name: 'Zoll', sym: 'in', f: 0.0254 },
      { id: 'fuss', name: 'Fuß', sym: 'ft', f: 0.3048 },
      { id: 'yard', name: 'Yard', sym: 'yd', f: 0.9144 },
      { id: 'meile', name: 'Meile', sym: 'mi', f: 1609.344 },
      { id: 'seemeile', name: 'Seemeile', sym: 'sm', f: 1852 }
    ] },
    { id: 'gewicht', name: 'Gewicht', base: 'g', units: [
      { id: 'g', name: 'Gramm', sym: 'g', f: 1 },
      { id: 'kg', name: 'Kilogramm', sym: 'kg', f: 1000 },
      { id: 't', name: 'Tonne', sym: 't', f: 1000000 },
      { id: 'unze', name: 'Unze', sym: 'oz', f: 28.349523125 },
      { id: 'pfund', name: 'Pfund (englisch)', sym: 'lb', f: 453.59237 }
    ] },
    { id: 'volumen', name: 'Volumen', base: 'l', units: [
      { id: 'ml', name: 'Milliliter', sym: 'ml', f: 0.001 },
      { id: 'l', name: 'Liter', sym: 'l', f: 1 },
      { id: 'm3', name: 'Kubikmeter', sym: 'm³', f: 1000 },
      { id: 'galus', name: 'Gallone (US)', sym: 'gal US', f: 3.785411784 },
      { id: 'galuk', name: 'Gallone (UK)', sym: 'gal UK', f: 4.54609 },
      { id: 'floz', name: 'Flüssigunze (US)', sym: 'fl oz', f: 0.0295735295625 },
      { id: 'tasse', name: 'Tasse (US)', sym: 'Tasse', f: 0.2365882365 }
    ] },
    { id: 'temperatur', name: 'Temperatur', base: 'K', units: [
      { id: 'c', name: 'Grad Celsius', sym: '°C',
        to: function (x) { return x + 273.15; }, from: function (k) { return k - 273.15; } },
      { id: 'f', name: 'Grad Fahrenheit', sym: '°F',
        to: function (x) { return (x - 32) * 5 / 9 + 273.15; }, from: function (k) { return (k - 273.15) * 9 / 5 + 32; } },
      { id: 'k', name: 'Kelvin', sym: 'K',
        to: function (x) { return x; }, from: function (k) { return k; } }
    ] },
    { id: 'flaeche', name: 'Fläche', base: 'm²', units: [
      { id: 'cm2', name: 'Quadratzentimeter', sym: 'cm²', f: 0.0001 },
      { id: 'm2', name: 'Quadratmeter', sym: 'm²', f: 1 },
      { id: 'ha', name: 'Hektar', sym: 'ha', f: 10000 },
      { id: 'km2', name: 'Quadratkilometer', sym: 'km²', f: 1000000 },
      { id: 'ft2', name: 'Quadratfuß', sym: 'ft²', f: 0.09290304 },
      { id: 'acre', name: 'Acre', sym: 'ac', f: 4046.8564224 }
    ] },
    { id: 'tempo', name: 'Geschwindigkeit', base: 'm/s', units: [
      { id: 'ms', name: 'Meter pro Sekunde', sym: 'm/s', f: 1 },
      { id: 'kmh', name: 'Kilometer pro Stunde', sym: 'km/h', f: 1 / 3.6 },
      { id: 'mph', name: 'Meilen pro Stunde', sym: 'mph', f: 0.44704 },
      { id: 'kn', name: 'Knoten', sym: 'kn', f: 1852 / 3600 }
    ] },
    { id: 'energie', name: 'Energie', base: 'J', units: [
      { id: 'j', name: 'Joule', sym: 'J', f: 1 },
      { id: 'kj', name: 'Kilojoule', sym: 'kJ', f: 1000 },
      { id: 'kcal', name: 'Kilokalorie', sym: 'kcal', f: 4184 },
      { id: 'wh', name: 'Wattstunde', sym: 'Wh', f: 3600 },
      { id: 'kwh', name: 'Kilowattstunde', sym: 'kWh', f: 3600000 }
    ] },
    { id: 'akku', name: 'Akku: mAh ↔ Wh', base: 'Wh', volt: true, units: [
      { id: 'mah', name: 'Milliamperestunde', sym: 'mAh', f: function (v) { return v / 1000; } },
      { id: 'ah', name: 'Amperestunde', sym: 'Ah', f: function (v) { return v; } },
      { id: 'wh', name: 'Wattstunde', sym: 'Wh', f: function () { return 1; } }
    ] }
  ];

  function cat(id) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i]; return null; }
  function unit(c, id) { for (var i = 0; i < c.units.length; i++) if (c.units[i].id === id) return c.units[i]; return null; }

  function toBase(c, u, x, volt) {
    if (u.to) return u.to(x);
    return x * (typeof u.f === 'function' ? u.f(volt) : u.f);
  }
  function fromBase(c, u, b, volt) {
    if (u.from) return u.from(b);
    return b / (typeof u.f === 'function' ? u.f(volt) : u.f);
  }

  /** Wert x von Einheit fromId nach toId umrechnen (Kategorie catId). volt nur für "akku". */
  function convert(catId, fromId, toId, x, volt) {
    var c = cat(catId), a = c && unit(c, fromId), b = c && unit(c, toId);
    if (!c || !a || !b) return NaN;
    if (fromId === toId) return x;
    return fromBase(c, b, toBase(c, a, x, volt), volt);
  }

  /** Alle Einheiten einer Kategorie für den Wert x in Einheit fromId. */
  function convertAll(catId, fromId, x, volt) {
    var c = cat(catId);
    return c.units.map(function (u) { return { unit: u, value: convert(catId, fromId, u.id, x, volt) }; });
  }

  /** Anzeige: ca. 7 gültige Stellen, Rundungsrauschen entfernt. fmt = OA.fmt (deutsch). */
  function format(n, fmt) {
    if (!isFinite(n)) return '–';
    n = Number(n.toPrecision(12));
    if (n === 0) return '0';
    var a = Math.abs(n);
    if (a >= 1e15 || a < 1e-9) return n.toExponential(4).replace('.', ',').replace('e+', ' · 10^').replace('e', ' · 10^');
    var digits = Math.max(0, Math.min(12, 6 - Math.floor(Math.log10(a))));
    return fmt(n, digits);
  }

  var api = { cats: CATS, cat: cat, unit: unit, convert: convert, convertAll: convertAll, format: format };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_EINHEITEN = api;
})();
