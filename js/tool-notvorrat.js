/* Offline-Ark – Notvorrat-Rechner.
 * Wasser: BBK-Empfehlung 2 l/Person/Tag (davon 0,5 l zum Kochen).
 * Essen: eigene Näherung. Tagesbedarf als Richtwert 2.200 kcal je Erwachsenem,
 * verteilt nach Energieanteil auf Lebensmittelgruppen (kcal je 100 g haltbarer Ware). */
(function () {
  'use strict';
  var OA = window.OA;

  var KCAL_PER_DAY = 2200;
  var WATER_PER_DAY = 2;
  var COOK_WATER = 0.5;

  // share = Anteil an der Tagesenergie, kcal = Energie je 100 g haltbarer Ware
  var GROUPS = [
    { name: 'Getreide, Reis, Nudeln, Brot', share: 0.40, kcal: 350 },
    { name: 'Gemüse und Hülsenfrüchte', share: 0.12, kcal: 90 },
    { name: 'Obst und Nüsse', share: 0.10, kcal: 150 },
    { name: 'Milch und Milchprodukte', share: 0.12, kcal: 100 },
    { name: 'Fisch, Fleisch, Ei', share: 0.12, kcal: 200 },
    { name: 'Fette und Öle', share: 0.14, kcal: 800 }
  ];

  var persons = OA.$('#persons'), days = OA.$('#days'), preset = OA.$('#preset');

  function mass(g) { return g >= 1000 ? OA.fmt(g / 1000, 1) + ' kg' : OA.fmt(Math.round(g / 10) * 10, 0) + ' g'; }

  function calc() {
    var p = Math.max(1, Math.round(OA.num(persons.value)) || 1);
    var d = Math.max(1, Math.round(OA.num(days.value)) || 1);
    var pd = p * d;

    var water = WATER_PER_DAY * pd;
    var kcal = KCAL_PER_DAY * pd;
    var foodGrams = 0;

    OA.$('#groups').innerHTML = GROUPS.map(function (g) {
      var perDay = KCAL_PER_DAY * g.share / g.kcal * 100;   // g pro Person und Tag
      foodGrams += perDay * pd;
      return '<tr><td>' + OA.esc(OA.t(g.name)) + '</td><td class="num">' + mass(perDay * pd) + '</td><td class="num">' + OA.fmt(Math.round(perDay / 5) * 5, 0) + ' g</td></tr>';
    }).join('');

    OA.$('#main-stats').innerHTML = [
      [OA.fmt(water, 0) + ' l', OA.t('Wasser (davon {0} l zum Kochen)', [OA.fmt(COOK_WATER * pd, 1)])],
      [OA.fmt(kcal, 0), OA.t('Kilokalorien (kcal) insgesamt')],
      [mass(foodGrams), OA.t('Lebensmittel insgesamt (ca.)')],
      [OA.fmt(Math.ceil(water / 1.5), 0), OA.t('Flaschen à 1,5 Liter')]
    ].map(function (s) { return '<div class="stat"><div class="num ltr">' + s[0] + '</div><div class="cap">' + s[1] + '</div></div>'; }).join('');

    OA.segSet(preset, ['3', '10', '14'].indexOf(String(d)) !== -1 ? d : '');
    OA.store.set('notvorrat', { persons: p, days: d });
  }

  var saved = OA.store.get('notvorrat', null);
  if (saved) { persons.value = saved.persons; days.value = saved.days; }
  preset.addEventListener('input', function () { days.value = OA.segVal(preset); calc(); });
  persons.addEventListener('input', calc);
  days.addEventListener('input', calc);
  calc();
})();
