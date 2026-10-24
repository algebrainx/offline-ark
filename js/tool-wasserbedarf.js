/* Offline-Ark – Wasserbedarf-Rechner.
 * Grundwert: BBK-Empfehlung 2 l/Person/Tag (davon 0,5 l zum Kochen).
 * Zuschläge für Klima/Aktivität sind vorsichtige Richtwerte. */
(function () {
  'use strict';
  var OA = window.OA;

  var BASE = 2.0;                                     // l pro Person und Tag (BBK)
  var CLIMATE = { mild: 0, warm: 0.5, hot: 1.5 };     // Zuschlag l/Tag
  var ACTIVITY = { rest: 0, normal: 0.5, hard: 1.5 };
  var HYGIENE = 3;                                    // l/Tag: Hände, Zähne, kurzes Waschen (Notbetrieb)

  var el = {
    persons: OA.$('#persons'), days: OA.$('#days'), climate: OA.$('#climate'), activity: OA.$('#activity'),
    hygiene: OA.$('#hygiene'), total: OA.$('#total'), perday: OA.$('#perday'), containers: OA.$('#containers')
  };

  // Letzte Eingaben merken
  var saved = OA.store.get('wasserbedarf', null);
  if (saved) {
    el.persons.value = saved.persons; el.days.value = saved.days; el.hygiene.checked = !!saved.hygiene;
    OA.segSet(el.climate, saved.climate); OA.segSet(el.activity, saved.activity);
  }

  function calc() {
    var persons = Math.max(1, Math.round(OA.num(el.persons.value)) || 1);
    var days = Math.max(1, Math.round(OA.num(el.days.value)) || 1);
    var climate = OA.segVal(el.climate), activity = OA.segVal(el.activity);

    var perPerson = BASE + CLIMATE[climate] + ACTIVITY[activity] + (el.hygiene.checked ? HYGIENE : 0);
    var total = perPerson * persons * days;

    el.total.textContent = OA.fmt(total, 1);
    el.perday.textContent = OA.fmt(perPerson, 1) + ' Liter pro Person und Tag · ' + OA.fmt(perPerson * persons, 1) + ' Liter pro Tag für alle';
    el.containers.innerHTML = [
      [Math.ceil(total / 1.5), 'Flaschen à 1,5 Liter'],
      [Math.ceil(total / 5), 'Kanister à 5 Liter'],
      [Math.ceil(total / 10), 'Kanister à 10 Liter'],
      [Math.ceil(total / 20), 'Kanister à 20 Liter']
    ].map(function (c) { return '<div class="stat"><div class="num">' + OA.fmt(c[0], 0) + '</div><div class="cap">' + c[1] + '</div></div>'; }).join('');

    OA.store.set('wasserbedarf', { persons: persons, days: days, climate: climate, activity: activity, hygiene: el.hygiene.checked });
  }

  ['input', 'change'].forEach(function (ev) {
    [el.persons, el.days, el.climate, el.activity, el.hygiene].forEach(function (n) { n.addEventListener(ev, calc); });
  });
  calc();
})();
