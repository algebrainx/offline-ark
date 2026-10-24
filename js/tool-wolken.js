/* Offline-Ark – Wolken & Wetter (Oberfläche): Wolkenarten mit Foto, Wetterzeichen, Gewitterverhalten, Blitz-Entfernung.
 * Daten und Rechnung stehen in data/wolken.js. Alle Texte laufen über OA.t. */
(function () {
  'use strict';
  var OA = window.OA, t = OA.t, esc = OA.esc, $ = OA.$;
  var D = window.OA_WOLKEN;
  var el = { level: $('#level'), clouds: $('#clouds'), signs: $('#signs'), behavior: $('#behavior'), sources: $('#sources'),
    timer: $('#timer'), reset: $('#reset'), sec: $('#sec'), km: $('#km'), kmCap: $('#kmCap'), verdict: $('#verdict') };

  function levelOf(id) { return D.levels.filter(function (l) { return l.id === id; })[0]; }
  function list(items, cls) { return '<ul class="plain' + (cls ? ' ' + cls : '') + '">' + items.map(function (x) { return '<li>' + esc(t(x)) + '</li>'; }).join('') + '</ul>'; }

  /* ---------- Wolkenarten ---------- */
  function renderClouds() {
    var f = OA.segVal(el.level) || 'all';
    el.clouds.innerHTML = D.genera.filter(function (g) { return f === 'all' || g.level === f; }).map(function (g) {
      var credit = t('Foto: {0} · {1}', ['<bdi>' + esc(g.photo.author) + '</bdi>', '<bdi>' + esc(g.photo.license) + '</bdi>']);
      return '<article class="card cloud">' +
        '<img src="../bibliothek/bilder/wolken/' + g.img + '" width="640" height="480" loading="lazy" alt="' + esc(t(g.alt)) + '">' +
        '<div class="credit"><a href="' + esc(g.photo.url) + '" target="_blank" rel="noopener noreferrer">' + credit + '</a></div>' +
        '<div class="body"><h3>' + esc(t(g.name)) + '</h3><p class="la ltr">' + esc(g.la) + '</p>' +
        '<div class="chips"><span class="chip">' + esc(t(levelOf(g.level).height)) + '</span></div>' +
        '<p><span class="lab">' + esc(t('So sieht sie aus')) + '</span>' + esc(t(g.look)) + '</p>' +
        '<p><span class="lab">' + esc(t('Das bedeutet sie')) + '</span>' + esc(t(g.meaning)) + '</p></div></article>';
    }).join('');
  }
  el.level.addEventListener('input', renderClouds);

  /* ---------- Wetterzeichen und Gewitter ---------- */
  el.signs.innerHTML = D.signs.map(function (s) {
    return '<div class="card sign"><h3>' + esc(t(s.title)) + '</h3>' +
      (s.intro ? '<p>' + esc(t(s.intro)) + '</p>' : '') +
      (s.steps ? '<ol class="steps-line">' + s.steps.map(function (x) { return '<li>' + esc(t(x)) + '</li>'; }).join('') + '</ol>' : '') +
      list(s.items) + '</div>';
  }).join('');
  el.behavior.innerHTML = '<strong>' + esc(t(D.behavior.title)) + '</strong>' + list(D.behavior.items);

  el.sources.innerHTML = D.sources.map(function (x) {
    return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.name) + '</a> – ' +
      esc(t('Lizenz')) + ': ' + esc(t(x.license)) + ' · ' + esc(t(x.note)) + '</li>';
  }).join('');

  /* ---------- Blitz-Entfernung ---------- */
  var t0 = 0, tick = 0;
  function running() { return t0 > 0; }
  function stopTimer() {
    if (tick) { clearInterval(tick); tick = 0; }
    t0 = 0;
    el.timer.textContent = t('Blitz gesehen: Zeit starten');
  }
  function calc() {
    var s = OA.num(el.sec.value), info = isFinite(s) ? D.lightning(s) : null;
    if (!info) {
      el.km.textContent = '–';
      el.kmCap.textContent = t('Starte die Zeitmessung oder gib die Sekunden ein.');
      el.verdict.hidden = true;
      return;
    }
    el.km.textContent = OA.fmt(info.km, 1);
    el.kmCap.textContent = t('Das sind etwa {0} Meter. Faustregel: {1} Sekunden geteilt durch 3 = {2} km.',
      [OA.fmt(Math.round(info.meters / 10) * 10, 0), OA.fmt(info.seconds, 1), OA.fmt(info.ruleKm, 1)]);
    var msg = { near: ['danger', 'Sehr nah: Suche sofort Schutz in einem Gebäude oder im Auto.', 'Weniger als 9 Sekunden: Der DWD rät, dringend Schutz zu suchen.'],
      mid: ['warn', 'Das Gewitter ist in der Nähe. Suche jetzt einen sicheren Ort, bevor es näher kommt.', 'Werden die Abstände kürzer, kommt das Gewitter auf dich zu.'],
      far: ['info', 'Weit weg. Über etwa 18 Kilometer ist der Donner nach dem DWD nicht mehr zu hören.', 'Beobachte weiter: Werden die Abstände kürzer, kommt das Gewitter näher.'] }[info.level];
    el.verdict.className = 'callout ' + msg[0];
    el.verdict.innerHTML = '<strong>' + esc(t(msg[1])) + '</strong>' + esc(t(msg[2]));
    el.verdict.hidden = false;
  }

  el.timer.addEventListener('click', function () {
    if (!running()) {
      t0 = Date.now();
      el.timer.textContent = t('Donner gehört: Zeit stoppen');
      tick = setInterval(function () { el.sec.value = (Math.round((Date.now() - t0) / 100) / 10).toString(); calc(); }, 100);
    } else {
      el.sec.value = (Math.round((Date.now() - t0) / 100) / 10).toString();
      stopTimer();
      calc();
    }
  });
  el.reset.addEventListener('click', function () { stopTimer(); el.sec.value = ''; calc(); });
  el.sec.addEventListener('input', function () { if (running()) stopTimer(); calc(); });

  renderClouds();
  calc();
})();
