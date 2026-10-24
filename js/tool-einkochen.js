/* Offline-Ark – "Haltbar machen" (Oberfläche). Rechenkern: js/einkochen-core.js, Daten: data/einkochen.js.
 * Sicherheitsregeln stammen vom BfR (siehe Quellen auf der Seite). Alle Zahlen sind Richtwerte. */
(function () {
  'use strict';
  var OA = window.OA, D = window.OA_EINKOCHEN, C = window.OA_EINKOCHEN_CORE;

  var el = {
    tab: OA.$('#tab'), grp: OA.$('#grp'),
    panes: { kochen: OA.$('#paneKochen'), ferment: OA.$('#paneFerment'), trocknen: OA.$('#paneTrocknen') },
    rules: { sauer: OA.$('#rSauer'), jam: OA.$('#rJam'), gemuese: OA.$('#rGemuese'), fleisch: OA.$('#rFleisch'), oel: OA.$('#rOel') },
    fruit: OA.$('#fruit'), ratio: OA.$('#ratio'), sugar: OA.$('#sugar'),
    d1: OA.$('#d1'), t1: OA.$('#t1'), second: OA.$('#second'),
    veg: OA.$('#veg'), salt: OA.$('#salt'), saltOut: OA.$('#saltOut'), saltCap: OA.$('#saltCap'), sources: OA.$('#sources')
  };

  var saved = OA.store.get('einkochen', {}) || {};
  if (saved.tab) OA.segSet(el.tab, saved.tab);
  if (saved.grp) el.grp.value = saved.grp;
  if (saved.ratio) OA.segSet(el.ratio, saved.ratio);
  if (saved.salt) OA.segSet(el.salt, saved.salt);
  if (saved.fruit != null) el.fruit.value = OA.fmt(saved.fruit, 0);
  if (saved.veg != null) el.veg.value = OA.fmt(saved.veg, 0);
  var now = new Date();
  el.d1.value = saved.d1 || (now.getFullYear() + '-' + OA.pad(now.getMonth() + 1) + '-' + OA.pad(now.getDate()));
  el.t1.value = saved.t1 || (OA.pad(now.getHours()) + ':' + OA.pad(now.getMinutes()));

  function when(ms) {
    return new Date(ms).toLocaleString(OA.locale || 'de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function update() {
    var tab = OA.segVal(el.tab), grp = el.grp.value;
    Object.keys(el.panes).forEach(function (k) { el.panes[k].hidden = k !== tab; });
    Object.keys(el.rules).forEach(function (k) { el.rules[k].hidden = k !== grp; });

    var sugar = C.jamSugar(OA.num(el.fruit.value), Number(OA.segVal(el.ratio)));
    el.sugar.textContent = isFinite(sugar) ? OA.fmt(sugar, 0) : '–';

    var win = C.secondHeat(C.localMs(el.d1.value, el.t1.value));
    el.second.textContent = win ? when(win.from) + ' – ' + when(win.to) : '–';

    var pct = Number(OA.segVal(el.salt));
    var s = C.saltGrams(OA.num(el.veg.value), pct);
    el.saltOut.textContent = isFinite(s) ? OA.fmt(s, 1) : '–';
    el.saltCap.textContent = isFinite(s)
      ? OA.t('{0} % vom Gemüsegewicht · Richtwert, nach Rezept prüfen', [OA.fmt(pct, 1)])
      : OA.t('Bitte das Gewicht des Gemüses eingeben.');

    OA.store.set('einkochen', {
      tab: tab, grp: grp, ratio: OA.segVal(el.ratio), salt: OA.segVal(el.salt), fruit: OA.num(el.fruit.value), veg: OA.num(el.veg.value),
      d1: el.d1.value, t1: el.t1.value
    });
  }

  el.sources.innerHTML = D.sources.map(function (x) {
    return '<li><a href="' + OA.esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + OA.esc(x.name) + '</a> – ' +
      OA.esc(OA.t('Lizenz')) + ': ' + OA.esc(OA.t(x.license)) + ' · ' + OA.esc(OA.t(x.note)) + '</li>';
  }).join('');

  ['input', 'change'].forEach(function (ev) {
    [el.tab, el.grp, el.fruit, el.ratio, el.d1, el.t1, el.veg, el.salt].forEach(function (n) { n.addEventListener(ev, update); });
  });
  update();
})();
