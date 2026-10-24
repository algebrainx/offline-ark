/* Offline-Ark – Startseite: Kacheln, Suche, Uhr/Datum/Akku. */
(function () {
  'use strict';
  var OA = window.OA;
  var tools = window.OA_TOOLS || [], groups = window.OA_TOOL_GROUPS || [], wissen = window.OA_WISSEN || [];
  var search = (window.OA_SEARCH && (window.OA_SEARCH[OA.lang] || window.OA_SEARCH.de)) || [];

  /* ---------- Icons im Notfallbereich ---------- */
  OA.$('#ic-aid').innerHTML = OA.icon('aid');
  OA.$('#ic-power').innerHTML = OA.icon('boltoff');
  OA.$('#ic-water').innerHTML = OA.icon('drop');
  // Notfall-Kacheln zeigen auf die Wissensseite in der gewählten Sprache
  OA.$$('#emergency a').forEach(function (a) {
    var id = a.getAttribute('href').replace(/^wissen\//, '');
    a.setAttribute('href', OA.genUrl('wissen/' + id));
  });

  /* ---------- Kacheln: Werkzeuge nach Gruppen ---------- */
  var html = '';
  groups.forEach(function (g) {
    var items = tools.filter(function (t) { return t.group === g.id; });
    if (!items.length) return;
    html += '<h2 class="section-title">' + OA.esc(OA.t(g.title)) + '</h2><div class="tiles">' + items.map(function (t) {
      return '<a class="tile" href="tools/' + t.id + '.html">' + OA.icon(t.icon) +
        '<span class="name">' + OA.esc(OA.t(t.title)) + '<span class="sub">' + OA.esc(OA.t(t.sub)) + '</span></span></a>';
    }).join('') + '</div>';
  });
  OA.$('#tool-groups').innerHTML = html;

  /* ---------- Wissensseiten in zwei kleinen Listen ---------- */
  var wissenHtml = '';
  (window.OA_WISSEN_GROUPS || [{ id: '', title: 'Wissen' }]).forEach(function (g) {
    var items = wissen.filter(function (w) { return !g.id || w.group === g.id; });
    if (!items.length) return;
    wissenHtml += '<h2 class="section-title">' + OA.esc(OA.t(g.title)) + '</h2><nav class="list" aria-label="' + OA.esc(OA.t(g.title)) + '">' + items.map(function (w) {
      return '<a href="' + OA.genUrl('wissen/' + w.id + '.html') + '">' + OA.icon(w.icon) +
        '<span class="name">' + OA.esc(OA.t(w.title)) + '<span class="sub">' + OA.esc(OA.t(w.sub)) + '</span></span>' + OA.icon('chev', 'chev') + '</a>';
    }).join('') + '</nav>';
  });
  OA.$('#wissen-groups').innerHTML = wissenHtml;

  /* ---------- Uhr, Datum, Akku ---------- */
  function tick() {
    var d = new Date();
    OA.$('#clock').textContent = OA.pad(d.getHours()) + ':' + OA.pad(d.getMinutes());
    OA.$('#date').textContent = d.toLocaleDateString(OA.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  tick(); setInterval(tick, 1000);

  try {
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        function show() {
          OA.$('#battery').hidden = false;
          OA.$('#batval').textContent = Math.round(b.level * 100) + ' %' + (b.charging ? ' (' + OA.t('lädt') + ')' : '');
        }
        show(); b.addEventListener('levelchange', show); b.addEventListener('chargingchange', show);
      }).catch(function () {});
    }
  } catch (e) { /* Akkuanzeige nicht verfügbar */ }

  /* ---------- Suche ---------- */
  // Vereinfachen: klein, Akzente/Umlaute weg ("waerme" = "wärme", "cómo" = "como"); arabische Vokalzeichen fallen weg
  function fold(s) {
    return String(s).toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  }

  var docs = [];
  tools.forEach(function (t) {
    // Suchbar in der gewählten Sprache UND auf Deutsch (Schlagwörter, Titel)
    docs.push({ kind: OA.t('Werkzeug'), url: 'tools/' + t.id + '.html', icon: t.icon, title: OA.t(t.title), desc: OA.t(t.desc),
      title_f: fold(OA.t(t.title)) + ' ' + fold(t.title), kw_f: fold(OA.t(t.kw || '')) + ' ' + fold(t.kw || '') + ' ' + fold(OA.t(t.sub)), body_f: fold(OA.t(t.desc)) });
  });
  wissen.forEach(function (w) {
    var s = search.filter(function (x) { return x.id === w.id; })[0] || {};
    var title = s.title || OA.t(w.title);
    docs.push({ kind: OA.t('Wissen'), url: OA.genUrl('wissen/' + w.id + '.html'), icon: w.icon, title: title, desc: OA.t(w.sub),
      title_f: fold(title) + ' ' + fold(w.title), kw_f: fold((s.headings || '') + ' ' + OA.t(w.sub)), body_f: fold(s.text || '') });
  });

  function run(query) {
    var words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var out = [];
    docs.forEach(function (d) {
      var score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], s = 0;
        if (d.title_f.indexOf(w) !== -1) s += 10;
        if (d.kw_f.indexOf(w) !== -1) s += 5;
        if (d.body_f.indexOf(w) !== -1) s += 1;
        if (!s) return;           // jedes Wort muss irgendwo vorkommen
        score += s;
      }
      out.push({ d: d, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 8).map(function (x) { return x.d; });
  }

  var input = OA.$('#q'), box = OA.$('#results');
  function render() {
    var q = input.value.trim();
    if (!q) { box.classList.remove('show'); box.innerHTML = ''; return; }
    var res = run(q);
    box.innerHTML = res.length ? res.map(function (d) {
      return '<a href="' + d.url + '" role="option">' + OA.icon(d.icon) +
        '<span><span class="t">' + OA.esc(d.title) + '</span><br><span class="d">' + OA.esc(d.desc) + '</span></span>' +
        '<span class="kind">' + d.kind + '</span></a>';
    }).join('') : '<div class="empty">' + OA.esc(OA.t('Nichts gefunden. Versuche ein kürzeres Wort.')) + '</div>';
    box.classList.add('show');
  }
  input.addEventListener('input', render);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var a = OA.$('a', box); if (a) location.href = a.getAttribute('href'); }
  });
  if (location.hash === '#suche') input.focus();
  window.addEventListener('hashchange', function () { if (location.hash === '#suche') input.focus(); });
})();
