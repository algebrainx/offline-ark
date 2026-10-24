/* Offline-Ark – Brennholz-Rechner (Oberfläche). Rechenkern: js/brennholz-core.js, Daten: data/brennholz.js.
 * Alle Ergebnisse sind Näherungen. */
(function () {
  'use strict';
  var OA = window.OA, D = window.OA_BRENNHOLZ, C = window.OA_BRENNHOLZ_CORE;

  var el = {
    mode: OA.$('#mode'), area: OA.$('#area'), vol: OA.$('#vol'), height: OA.$('#height'), ins: OA.$('#ins'), insHint: OA.$('#insHint'),
    tin: OA.$('#tin'), tout: OA.$('#tout'), hours: OA.$('#hours'), days: OA.$('#days'),
    species: OA.$('#species'), stove: OA.$('#stove'), water: OA.$('#water'), len: OA.$('#len'),
    warns: OA.$('#warns'), rm: OA.$('#rm'), rmCap: OA.$('#rmCap'), stats: OA.$('#stats'), sources: OA.$('#sources'),
    boxArea: OA.$('#boxArea'), boxVol: OA.$('#boxVol')
  };

  function opt(list, selected) {
    return list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === selected ? ' selected' : '') + '>' + OA.esc(OA.t(x.name)) + '</option>'; }).join('');
  }
  var saved = OA.store.get('brennholz', {}) || {};
  el.species.innerHTML = opt(D.species, saved.species || 'buche');
  el.stove.innerHTML = opt(D.stoves, saved.stove || 'normal');
  el.area.value = OA.fmt(saved.area != null ? saved.area : 25, 2);
  el.vol.value = OA.fmt(saved.vol != null ? saved.vol : 62.5, 2);
  el.height.value = OA.fmt(saved.height != null ? saved.height : 2.5, 2);
  if (saved.mode) OA.segSet(el.mode, saved.mode);
  if (saved.ins) OA.segSet(el.ins, saved.ins);
  if (saved.len) OA.segSet(el.len, saved.len);
  ['tin', 'tout', 'hours', 'days', 'water'].forEach(function (k) { if (saved[k] != null) el[k].value = saved[k]; });

  function stat(num, cap) { return '<div class="stat"><div class="num ltr">' + num + '</div><div class="cap">' + cap + '</div></div>'; }

  function update() {
    var mode = OA.segVal(el.mode), ins = OA.segVal(el.ins), len = OA.segVal(el.len);
    el.boxArea.hidden = mode !== 'area'; el.boxVol.hidden = mode !== 'vol';
    var insObj = C.byId(D.insulation, ins);
    el.insHint.textContent = OA.t('Entspricht Energieeffizienzklasse {0} (bis {1} kWh pro m² und Jahr).', [insObj.klass, insObj.kwhM2a]);

    var input = {
      insulation: ins, tIn: OA.num(el.tin.value), tOut: OA.num(el.tout.value), hours: OA.num(el.hours.value), days: OA.num(el.days.value),
      species: el.species.value, water: OA.num(el.water.value), stove: el.stove.value, len: len, height: OA.num(el.height.value)
    };
    if (mode === 'area') input.area = OA.num(el.area.value); else input.volume = OA.num(el.vol.value);
    var r = C.calc(input);

    var w = [];
    if (r.ok) {
      if (r.warnings.indexOf('wet') !== -1) w.push(['warn', 'Zu feucht!', 'Mehr als 20 % Wassergehalt: Das Holz verbrennt schlecht, rußt stark und belastet den Schornstein. Trockne es länger.']);
      if (r.warnings.indexOf('nodiff') !== -1) w.push(['info', 'Kein Temperaturunterschied', 'Die Außentemperatur ist nicht niedriger als die Raumtemperatur. Dann ist kein Heizbedarf berechenbar.']);
      if (r.warnings.indexOf('open') !== -1) w.push(['info', 'Offener Kamin', 'Ein offener Kamin gibt nur etwa ein Drittel der Wärme an den Raum ab und zieht warme Raumluft ab. Er ist kein gutes Heizgerät.']);
    }
    el.warns.innerHTML = w.map(function (x) {
      return '<div class="callout ' + x[0] + '"><strong>' + OA.esc(OA.t(x[1])) + '</strong>' + OA.esc(OA.t(x[2])) + '</div>';
    }).join('');

    if (!r.ok) {
      el.rm.textContent = '–'; el.rmCap.textContent = OA.t('Bitte eine Fläche oder ein Volumen eingeben.'); el.stats.innerHTML = '';
    } else {
      el.rm.textContent = OA.fmt(r.rm, r.rm < 1 ? 2 : 1);
      el.rmCap.textContent = OA.t('{0} kg Holz · {1} kWh Wärme · Richtwert', [OA.fmt(r.kg, 0), OA.fmt(r.heatKwh, 0)]);
      el.stats.innerHTML = [
        stat(OA.fmt(r.heatKwh, 0), OA.esc(OA.t('Wärmebedarf (kWh)'))),
        stat(OA.fmt(r.powerKw, 2), OA.esc(OA.t('Mittlere Heizleistung (kW)'))),
        stat(OA.fmt(r.kg, 0), OA.esc(OA.t('Holz (kg)'))),
        stat(OA.fmt(r.kgPerDay, 1), OA.esc(OA.t('Holz pro Tag (kg)'))),
        stat(OA.fmt(r.srm, r.srm < 1 ? 2 : 1), OA.esc(OA.t('Schüttraummeter (Srm)'))),
        stat(OA.fmt(r.fm, r.fm < 1 ? 2 : 1), OA.esc(OA.t('Festmeter (Fm)'))),
        stat(OA.fmt(r.stackDepth, 2), OA.esc(OA.t('Stapel 1 m hoch × 2 m breit × so viele m tief')))
      ].join('');
    }

    OA.store.set('brennholz', {
      mode: mode, ins: ins, len: len, species: el.species.value, stove: el.stove.value,
      area: OA.num(el.area.value), vol: OA.num(el.vol.value), height: OA.num(el.height.value),
      tin: el.tin.value, tout: el.tout.value, hours: el.hours.value, days: el.days.value, water: el.water.value
    });
  }

  el.sources.innerHTML = D.sources.map(function (s) {
    return '<li><a href="' + OA.esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + OA.esc(s.name) + '</a> – ' +
      OA.esc(OA.t('Lizenz')) + ': ' + OA.esc(OA.t(s.license)) + ' · ' + OA.esc(OA.t(s.note)) + '</li>';
  }).join('');

  ['input', 'change'].forEach(function (ev) {
    [el.mode, el.area, el.vol, el.height, el.ins, el.tin, el.tout, el.hours, el.days, el.species, el.stove, el.water, el.len].forEach(function (n) { n.addEventListener(ev, update); });
  });
  update();
})();
