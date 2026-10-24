/* Offline-Ark – Einheitenrechner. Rechenlogik: data/einheiten.js */
(function () {
  'use strict';
  var OA = window.OA, E = window.OA_EINHEITEN;

  var el = {
    cats: OA.$('#cats'), val: OA.$('#val'), volt: OA.$('#volt'), voltField: OA.$('#voltField'),
    from: OA.$('#from'), to: OA.$('#to'), swap: OA.$('#swap'),
    resNum: OA.$('#resNum'), resUnit: OA.$('#resUnit'), resCap: OA.$('#resCap'), all: OA.$('#all tbody')
  };

  // Standard: erste Kategorie, sinnvolle Startpaare
  var DEFAULTS = { laenge: ['zoll', 'cm'], gewicht: ['pfund', 'kg'], volumen: ['galus', 'l'], temperatur: ['c', 'f'],
    flaeche: ['acre', 'ha'], tempo: ['kmh', 'mph'], energie: ['kcal', 'kj'], akku: ['mah', 'wh'] };
  var pairs = {};   // zuletzt gewählte Einheiten je Kategorie

  el.cats.innerHTML = E.cats.map(function (c) {
    return '<button type="button" data-v="' + c.id + '" aria-pressed="false">' + OA.esc(OA.t(c.name)) + '</button>';
  }).join('');

  function fillSelects(cat) {
    var opts = cat.units.map(function (u) {
      return '<option value="' + u.id + '">' + OA.esc(OA.t(u.name)) + ' (' + OA.esc(OA.t(u.sym)) + ')</option>';
    }).join('');
    el.from.innerHTML = opts; el.to.innerHTML = opts;
    var p = pairs[cat.id] || DEFAULTS[cat.id];
    el.from.value = p[0]; el.to.value = p[1];
  }

  function showCategory() {
    var cat = E.cat(OA.segVal(el.cats));
    fillSelects(cat);
    el.voltField.hidden = !cat.volt;
    // Temperatur braucht ein Minuszeichen: normale Tastatur statt Ziffernblock
    el.val.setAttribute('inputmode', cat.id === 'temperatur' ? 'text' : 'decimal');
    calc();
  }

  function calc() {
    var cat = E.cat(OA.segVal(el.cats));
    var from = el.from.value, to = el.to.value;
    pairs[cat.id] = [from, to];
    var x = OA.num(el.val.value), volt = OA.num(el.volt.value);
    var uFrom = E.unit(cat, from), uTo = E.unit(cat, to);

    if (isNaN(x) || (cat.volt && !(volt > 0))) {
      el.resNum.textContent = '–'; el.resUnit.textContent = '';
      el.resCap.textContent = cat.volt && !(volt > 0) ? OA.t('Bitte eine Spannung größer als 0 eintragen.') : OA.t('Bitte eine Zahl eingeben.');
      el.all.innerHTML = '';
      return;
    }
    var fmt = function (n) { return E.format(n, OA.fmt); };
    var r = E.convert(cat.id, from, to, x, volt);
    el.resNum.textContent = fmt(r);
    el.resUnit.textContent = OA.t(uTo.sym);
    el.resCap.innerHTML = '<span class="ltr">' + OA.esc(fmt(x) + ' ' + OA.t(uFrom.sym) + ' = ' + fmt(r) + ' ' + OA.t(uTo.sym)) + '</span>' +
      (cat.volt ? ' ' + OA.esc(OA.t('(bei {0} V)', [OA.fmt(volt, 3)])) : '');

    el.all.innerHTML = E.convertAll(cat.id, from, x, volt).map(function (row) {
      return '<tr' + (row.unit.id === to ? ' class="is-target"' : '') +       '><td><span class="ltr">' + OA.esc(fmt(row.value) + ' ' + OA.t(row.unit.sym)) +
              '</span></td><td class="muted">' + OA.esc(OA.t(row.unit.name)) + '</td></tr>';
    }).join('');

    OA.store.set('einheiten', { cat: cat.id, val: el.val.value, volt: el.volt.value, pairs: pairs });
  }

  // Gespeicherte Eingaben wiederherstellen
  var saved = OA.store.get('einheiten', null);
  var startCat = E.cats[0].id;
  el.volt.value = OA.fmt(3.7, 1);   // Standardspannung im Zahlenformat der Sprache
  if (saved && E.cat(saved.cat)) {
    startCat = saved.cat;
    if (saved.val != null) el.val.value = saved.val;
    if (saved.volt != null) el.volt.value = saved.volt;
    if (saved.pairs && typeof saved.pairs === 'object') pairs = saved.pairs;
  }
  // Gespeicherte Paare prüfen, sonst Standard
  Object.keys(pairs).forEach(function (id) {
    var c = E.cat(id), p = pairs[id];
    if (!c || !Array.isArray(p) || !E.unit(c, p[0]) || !E.unit(c, p[1])) delete pairs[id];
  });
  OA.segSet(el.cats, startCat);

  el.cats.addEventListener('input', showCategory);
  [el.val, el.volt].forEach(function (n) { n.addEventListener('input', calc); });
  [el.from, el.to].forEach(function (n) { n.addEventListener('change', calc); });
  el.swap.addEventListener('click', function () {
    var f = el.from.value; el.from.value = el.to.value; el.to.value = f; calc();
  });
  showCategory();
})();
