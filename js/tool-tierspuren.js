/* Offline-Ark – Tierspuren (Oberfläche): Mini-Bestimmer, Tierkarten mit selbst gezeichneten Trittsiegeln, Wolf-oder-Hund-Vergleich, Sicherheit.
 * Daten und Suchlogik: data/tierspuren.js. Alle Texte laufen über OA.t. */
(function () {
  'use strict';
  var OA = window.OA, t = OA.t, esc = OA.esc, $ = OA.$;
  var D = window.OA_TIERSPUREN;
  var el = { len: $('#len'), claws: $('#claws'), toes: $('#toes'), reset: $('#reset'), result: $('#result'), animals: $('#animals'),
    cmpTitle: $('#cmpTitle'), cmpIntro: $('#cmpIntro'), cmpHead: $('#cmpHead'), cmpBody: $('#cmpBody'), cmpNote: $('#cmpNote'), safety: $('#safety'), sources: $('#sources') };
  var PARTS = { any: 'Maße', front: 'Vorderpfote', hind: 'Hinterpfote', 'hind-heel': 'Hinterpfote mit Fersenballen' };

  /* ---------- Zeichnungen (stark vereinfacht, 100 x 100) ---------- */
  function E(cx, cy, rx, ry, rot, cls) {
    return '<ellipse class="' + (cls || 'pad') + '" cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"' + (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + '/>';
  }
  function P(d, cls) { return '<path class="' + (cls || 'pad') + '" d="' + d + '"/>'; }
  function L(x1, y1, x2, y2) { return '<line class="cl" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>'; }
  var SHAPES = {
    deer: function () {
      return P('M47 10 Q32 36 30 82 Q44 86 49 60 Q50 34 47 10Z') + P('M53 10 Q68 36 70 82 Q56 86 51 60 Q50 34 53 10Z') + E(38, 93, 3.5, 3.5, 0, 'dim') + E(62, 93, 3.5, 3.5, 0, 'dim');
    },
    boar: function () {
      return P('M47 22 Q27 34 27 64 Q28 80 43 80 Q50 54 47 22Z') + P('M53 22 Q73 34 73 64 Q72 80 57 80 Q50 54 53 22Z') + E(21, 90, 6, 5) + E(79, 90, 6, 5);
    },
    stag: function () {
      return P('M46 12 Q26 34 25 74 Q26 86 44 86 Q50 58 46 12Z') + P('M54 12 Q74 34 75 74 Q74 86 56 86 Q50 58 54 12Z');
    },
    fox: function () {
      return P('M41 62 Q50 56 59 62 Q62 76 50 82 Q38 76 41 62Z') + E(34, 44, 5.5, 8, -14) + E(44, 32, 5.5, 9, -3) + E(56, 32, 5.5, 9, 3) + E(66, 44, 5.5, 8, 14) +
        L(33, 36, 31, 27) + L(43, 23, 42, 14) + L(57, 23, 58, 14) + L(67, 36, 69, 27);
    },
    hare: function () {
      return E(50, 68, 10, 17) + E(38, 36, 3.6, 8, -8) + E(46, 29, 3.6, 9) + E(54, 29, 3.6, 9) + E(62, 36, 3.6, 8, 8) +
        L(37, 28, 35, 19) + L(46, 20, 45, 11) + L(54, 20, 55, 11) + L(63, 28, 65, 19);
    },
    badger: function () {
      return P('M26 70 Q50 56 74 70 Q70 90 50 90 Q30 90 26 70Z') + E(24, 52, 5, 7, -30) + E(35, 42, 5, 7.5, -15) + E(50, 38, 5, 8) + E(65, 42, 5, 7.5, 15) + E(76, 52, 5, 7, 30) +
        L(22, 46, 15, 32) + L(33, 35, 28, 20) + L(50, 30, 50, 14) + L(67, 35, 72, 20) + L(78, 46, 85, 32);
    },
    raccoon: function () {
      return E(50, 74, 15, 11) + E(24, 52, 4.2, 12, -28) + E(36, 40, 4.2, 13, -12) + E(50, 36, 4.2, 14) + E(64, 40, 4.2, 13, 12) + E(76, 52, 4.2, 12, 28);
    },
    wolf: function () {
      return P('M33 62 Q50 52 67 62 Q72 82 50 90 Q28 82 33 62Z') + E(31, 44, 7, 10, -14) + E(44, 31, 7, 11, -4) + E(56, 31, 7, 11, 4) + E(69, 44, 7, 10, 14) +
        L(29, 35, 26, 22) + L(43, 21, 42, 8) + L(57, 21, 58, 8) + L(71, 35, 74, 22);
    },
    marten: function () {
      return E(50, 72, 10, 8) + E(27, 60, 3.8, 5.5, -35) + E(33, 48, 3.8, 6, -18) + E(44, 40, 3.8, 6.5, -5) + E(56, 40, 3.8, 6.5, 5) + E(67, 48, 3.8, 6, 18) +
        L(25, 54, 21, 49) + L(31, 41, 28, 35) + L(43, 33, 42, 27) + L(57, 33, 58, 27) + L(68, 41, 71, 35);
    },
    squirrel: function () {
      return E(50, 72, 9, 7) + E(34, 46, 2.8, 14, -10) + E(44, 38, 2.8, 16, -3) + E(56, 38, 2.8, 16, 3) + E(66, 46, 2.8, 14, 10);
    },
    beaver: function () {
      return P('M18 56 Q50 8 82 56 L74 90 Q50 96 26 90Z', 'web') + E(50, 78, 16, 11) +
        E(19, 52, 4.5, 7, -50) + E(32, 33, 4.5, 7, -25) + E(50, 25, 4.5, 7) + E(68, 33, 4.5, 7, 25) + E(81, 52, 4.5, 7, 50);
    },
    dog: function () {
      return P('M36 62 Q50 54 64 62 Q68 82 50 88 Q32 82 36 62Z') + E(30, 45, 7.5, 9, -16) + E(43, 34, 7.5, 10, -4) + E(57, 34, 7.5, 10, 4) + E(70, 45, 7.5, 9, 16) +
        L(28, 37, 26, 29) + L(42, 25, 41, 17) + L(58, 25, 59, 17) + L(72, 37, 74, 29);
    },
    cat: function () {
      return P('M35 64 Q50 56 65 64 Q67 82 50 86 Q33 82 35 64Z') + E(30, 46, 7, 7.5) + E(42, 36, 7, 8) + E(58, 36, 7, 8) + E(70, 46, 7, 7.5);
    }
  };
  function svg(a, cls) {
    return '<svg class="trk ' + (cls || '') + '" viewBox="0 0 100 100" role="img" aria-label="' + esc(t('Trittsiegel: {0}', [t(a.name)])) + '">' + SHAPES[a.shape]() + '</svg>';
  }

  /* ---------- Texte ---------- */
  function num(r) { return '<bdi class="ltr">' + D.range(r, function (n) { return OA.fmt(n, 1); }) + '</bdi>'; }
  function toesText(a) {
    if (!a.toes) return t('nicht angegeben');
    if (a.toes[0] === 2) return t('2 (Hufhälften)');
    return a.toes.length === 1 ? '<bdi class="ltr">' + a.toes[0] + '</bdi>' : t('{0} bis {1}', ['<bdi class="ltr">' + a.toes[0] + '</bdi>', '<bdi class="ltr">' + a.toes[1] + '</bdi>']);
  }
  function clawsText(a) { return t({ yes: 'ja', rare: 'selten sichtbar', no: 'nein' }[a.claws] || 'nicht angegeben'); }
  function sizeRows(a) {
    if (!a.sizes.length) return [[t('Maße'), t('nicht angegeben')]];
    return a.sizes.map(function (s) {
      var v = t('Länge ca. {0} cm', [num(s.len)]) + (s.wid ? ' · ' + t('Breite ca. {0} cm', [num(s.wid)]) : '');
      return [t(PARTS[s.part]), v];
    });
  }
  function sizeShort(a) {
    return a.sizes.length ? a.sizes.map(function (s) { return t('Länge ca. {0} cm', [num(s.len)]); }).join(' · ') : '';
  }

  /* ---------- Tierkarten ---------- */
  el.animals.innerHTML = D.animals.map(function (a) {
    var rows = sizeRows(a).concat([[t('Zehen im Abdruck'), toesText(a)], [t('Krallenspuren'), clawsText(a)]]);
    return '<article class="card animal" id="tier-' + a.id + '">' +
      '<div class="head">' + svg(a) + '<div><h3>' + esc(t(a.name)) + '</h3><p class="la ltr">' + esc(a.la) + '</p><span class="chip">' + esc(t(a.group)) + '</span></div></div>' +
      '<ul class="facts">' + rows.map(function (r) { return '<li><span class="k">' + esc(r[0]) + '</span><span class="v">' + r[1] + '</span></li>'; }).join('') + '</ul>' +
      '<ul class="plain">' + a.features.map(function (f) { return '<li>' + esc(t(f)) + '</li>'; }).join('') + '</ul>' +
      (a.gait ? '<p class="gait"><strong>' + esc(t('Spurbild')) + ':</strong> ' + esc(t(a.gait)) + '</p>' : '') + '</article>';
  }).join('');

  /* ---------- Mini-Bestimmer ---------- */
  var NOTES = { len: 'Maße hier nicht angegeben', toes: 'Zehenzahl hier nicht angegeben', claws: 'Krallenspuren nicht sicher' };
  function items(list) {
    return '<ul class="result-list">' + list.map(function (r) {
      var why = r.notes.length ? r.notes.map(function (n) { return t(NOTES[n]); }).join(' · ') : sizeShort(r.animal);
      return '<li><a href="#tier-' + r.animal.id + '">' + svg(r.animal) + '<span><span class="name">' + esc(t(r.animal.name)) + '</span>' + (why ? '<span class="why">' + why + '</span>' : '') + '</span></a></li>';
    }).join('') + '</ul>';
  }
  function find() {
    var len = OA.num(el.len.value), claws = OA.segVal(el.claws), toes = OA.segVal(el.toes);
    var r = D.identify({ len: isFinite(len) ? len : null, claws: claws === 'any' ? null : claws, toes: toes === 'any' ? null : Number(toes) });
    var html;
    if (!r.any) html = '<p class="hint">' + esc(t('Gib mindestens ein Merkmal an: Länge, Krallenspuren oder Zehen.')) + '</p>';
    else if (!r.fit.length && !r.maybe.length) html = '<p class="hint">' + esc(t('Kein Tier der Liste passt dazu. Prüfe die Maße oder wähle „Weiß nicht“.')) + '</p>';
    else html = (r.fit.length ? '<div class="res-title">' + esc(t('Passt')) + '</div>' + items(r.fit) : '') +
      (r.maybe.length ? '<div class="res-title">' + esc(t('Möglich, aber nicht sicher')) + '</div>' + items(r.maybe) : '');
    el.result.innerHTML = html;
  }
  ['input', 'change'].forEach(function (ev) { [el.len, el.claws, el.toes].forEach(function (n) { n.addEventListener(ev, find); }); });
  el.reset.addEventListener('click', function () { el.len.value = ''; OA.segSet(el.claws, 'any'); OA.segSet(el.toes, 'any'); find(); });

  /* ---------- Wolf oder Hund, Sicherheit, Quellen ---------- */
  var C = D.compare;
  el.cmpTitle.textContent = t(C.title);
  el.cmpIntro.textContent = t(C.intro);
  el.cmpHead.innerHTML = '<tr>' + C.cols.map(function (c) { return '<th>' + esc(t(c)) + '</th>'; }).join('') + '</tr>';
  el.cmpBody.innerHTML = C.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(t(c)) + '</td>'; }).join('') + '</tr>'; }).join('');
  el.cmpNote.textContent = t(C.note);

  el.safety.innerHTML = '<h2 class="flush">' + esc(t(D.safety.title)) + '</h2>' + D.safety.items.map(function (g) {
    return '<h3>' + esc(t(g.title)) + '</h3><ul class="plain">' + g.items.map(function (x) { return '<li>' + esc(t(x)) + '</li>'; }).join('') + '</ul>';
  }).join('');

  el.sources.innerHTML = D.sources.map(function (x) {
    return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.name) + '</a> – ' +
      esc(t('Lizenz')) + ': ' + esc(t(x.license)) + ' · ' + esc(t(x.note)) + '</li>';
  }).join('');

  find();
})();
