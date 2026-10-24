/* Offline-Ark – Notfall-Assistent (Entscheidungsbaum). Inhalte: data/assistent.js
 * Eine Frage nach der anderen. Es wird nichts gespeichert (Gesundheitsdaten bleiben nicht im Browser). */
(function () {
  'use strict';
  var OA = window.OA, D = window.OA_ASSISTENT, $ = OA.$;
  var NODES = D.nodes;

  var el = { view: $('#view'), strip: $('#strip'), back: $('#back'), restart: $('#restart'), bar: $('#bar'), barWrap: $('#barWrap'), step: $('#stepNo'), printView: $('#printView') };

  /* ---------- Hilfen ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NUM = /\d+(?:[–:.,]\d+)*(?:\s?cm)?/g;
  /** Übersetzen, **fett** auswerten, Zahlen als linksläufig markieren (wichtig bei Arabisch). */
  function rich(de, args) {
    return OA.t(de, args).split('**').map(function (p, i) {
      var h = esc(p).replace(NUM, '<span class="ltr">$&</span>');
      return i % 2 ? '<strong>' + h + '</strong>' : h;
    }).join('');
  }
  function plain(de, args) { return OA.t(de, args).replace(/\*\*/g, ''); }

  /** Kürzeste Zahl weiterer Bildschirme bis zu einem Ergebnis (nur über Antworten) – für die Fortschrittsanzeige. */
  var dist = {};
  (function () {
    function d(id, seen) {
      if (dist[id] != null) return dist[id];
      var n = NODES[id];
      if (n.type === 'result') return (dist[id] = 0);
      if (seen[id]) return 99;
      seen[id] = 1;
      var best = 99;
      n.answers.forEach(function (x) { best = Math.min(best, 1 + d(x.to, seen)); });
      delete seen[id];
      return (dist[id] = best);
    }
    Object.keys(NODES).forEach(function (id) { d(id, {}); });
  })();

  /* ---------- Zustand ---------- */
  var cur = D.start;
  var hist = [];     // besuchte Knoten (ohne den aktuellen)
  var trail = [];    // gewählte Antworten: { q: Frage, a: Antwort }

  function go(id, q, label) {
    hist.push(cur);
    if (q) trail.push({ q: q, a: label });
    else trail.push(null);
    cur = id;
    render(true);
  }
  function back() {
    if (!hist.length) return;
    cur = hist.pop(); trail.pop();
    render(true);
  }
  function restart() { cur = D.start; hist = []; trail = []; render(true); }

  /* ---------- Bausteine ---------- */
  function stepsHtml(steps) {
    return '<div class="prose"><ol class="steps">' + steps.map(function (s) { return '<li>' + rich(s) + '</li>'; }).join('') + '</ol></div>';
  }
  function notesHtml(notes) {
    return (notes || []).map(function (n) {
      return '<div class="callout ' + n.k + '"><strong>' + rich(n.t) + '</strong>' + rich(n.x) + '</div>';
    }).join('');
  }
  function toolUrl(id) { return id + '.html'; }
  function anchorUrl(page, key) {
    var base = OA.genUrl('wissen/' + page + '.html');
    var an = D.anchors[page] && D.anchors[page][key];
    return base + (an && an[OA.lang] ? '#' + an[OA.lang] : '');
  }

  function renderMenu(n) {
    return '<h2 class="q" tabindex="-1">' + rich(n.text) + '</h2><p class="muted">' + rich('Wähle, was am besten passt.') + '</p>' +
      '<div class="choices">' + n.answers.map(function (x) {
        return '<button type="button" class="choice" data-to="' + x.to + '">' + (x.icon ? OA.icon(x.icon) : '') + '<span>' + rich(x.t) + '</span></button>';
      }).join('') + '</div>';
  }

  function renderQuestion(n) {
    var h = '<p class="kicker">' + rich(n.title) + '</p>';
    if (n.steps) h += '<section class="card"><h3 class="mini">' + rich('Tu jetzt') + '</h3>' + stepsHtml(n.steps) + '</section>';
    h += '<h2 class="q" tabindex="-1">' + rich(n.text) + '</h2>';
    h += '<div class="answers">' + n.answers.map(function (x, i) {
      return '<button type="button" class="ans" data-i="' + i + '">' + rich(x.t) + '</button>';
    }).join('') + '</div>';
    h += notesHtml(n.notes);
    return h;
  }

  function renderResult(n) {
    var h = '<p class="kicker">' + (n.e ? rich('Das tust du jetzt') : rich('Anleitung')) + '</p>';
    h += '<h2 class="q" tabindex="-1">' + rich(n.title) + '</h2>';
    if (n.lead) h += '<p class="lead-s">' + rich(n.lead) + '</p>';
    h += '<section class="card"><h3 class="mini">' + rich('Schritt für Schritt') + '</h3>' + stepsHtml(n.steps) + '</section>';
    h += notesHtml(n.notes);
    var acts = '';
    (n.links || []).forEach(function (l) { acts += '<a class="btn" href="' + toolUrl(l.tool) + '">' + rich(l.t) + '</a>'; });
    (n.more || []).forEach(function (m, i) {
      var pg = D.anchors[m[0]];
      var label = OA.t('Mehr dazu: {0}', [OA.t(pg.title)]);
      acts += '<a class="btn' + (i === 0 ? ' primary' : '') + '" href="' + esc(anchorUrl(m[0], m[1])) + '">' + esc(label) + '</a>';
    });
    if (acts) h += '<div class="btn-row more">' + acts + '</div>';
    if (n.next && n.next.length) {
      h += '<h3 class="mini nxt">' + rich('Wie geht es weiter?') + '</h3><div class="answers">' + n.next.map(function (x, i) {
        return '<button type="button" class="ans" data-n="' + i + '">' + rich(x.t) + '</button>';
      }).join('') + '</div>';
    }
    h += '<p class="small muted disc">' + rich('Ersetzt keine Erste-Hilfe-Ausbildung – im Zweifel 112.') + '</p>';
    h += '<div class="btn-row"><button type="button" class="btn" id="print">' + OA.icon('print') + '<span>' + rich('Anleitung drucken') + '</span></button></div>';
    return h;
  }

  function renderPrint(n) {
    if (n.type !== 'result') { el.printView.innerHTML = ''; return; }
    var sel = trail.filter(Boolean);
    var h = '<h1>' + esc(OA.t('{0} – Anleitung', [plain(n.title)])) + '</h1>';
    if (n.e) h += '<p class="p112">' + rich('Lebensgefahr? Ruf sofort **112** an.') + '</p>';
    if (n.lead) h += '<p>' + rich(n.lead) + '</p>';
    if (sel.length) h += '<h2>' + rich('Deine Auswahl') + '</h2><ul>' + sel.map(function (s) { return '<li>' + rich(s.q) + ': <strong>' + rich(s.a) + '</strong></li>'; }).join('') + '</ul>';
    h += '<h2>' + rich('Schritt für Schritt') + '</h2><ol>' + n.steps.map(function (s) { return '<li>' + rich(s) + '</li>'; }).join('') + '</ol>';
    h += (n.notes || []).map(function (x) { return '<p class="pnote"><strong>' + rich(x.t) + '.</strong> ' + rich(x.x) + '</p>'; }).join('');
    h += '<p class="src">' + rich('Ersetzt keine Erste-Hilfe-Ausbildung – im Zweifel 112.') + ' ' +
      rich('Quelle: Offline-Ark, Wissensseite „Erste Hilfe“ (nach DRK, Deutschem Rat für Wiederbelebung und BBK, in eigenen Worten zusammengefasst).') + '</p>';
    el.printView.innerHTML = h;
  }

  /* ---------- Anzeige ---------- */
  function render(focus) {
    var n = NODES[cur];
    el.view.setAttribute('data-node', cur);
    el.view.innerHTML = n.type === 'menu' ? renderMenu(n) : n.type === 'question' ? renderQuestion(n) : renderResult(n);

    // Notruf-Streifen: rot bei Lebensgefahr, sonst ruhig, aber immer da
    el.strip.className = 'strip no-print' + (n.e ? ' e' : '');
    el.strip.innerHTML = '<span class="t">' + (n.e ? rich('Lebensgefahr? Ruf sofort **112** an.') : rich('Im Zweifel: Notruf **112**.')) + '</span>' +
      '<a class="call" href="tel:112" aria-label="' + esc(OA.t('Notruf 112 anrufen')) + '"><span class="ltr">112</span></a>';

    // Fortschritt: bisherige Schritte im Verhältnis zu allen (bisher + kürzester Rest)
    var done = hist.length, rest = dist[cur] || 0, pct = n.type === 'result' ? 100 : Math.round(done / (done + rest) * 100);
    el.bar.style.width = pct + '%';
    el.barWrap.setAttribute('aria-valuenow', pct);
    el.step.textContent = n.type === 'result' ? OA.t('Fertig') : OA.t('Schritt {0}', [done + 1]);
    el.back.disabled = !hist.length;
    el.restart.disabled = !hist.length && cur === D.start;

    renderPrint(n);
    if (focus) {
      var h = OA.$('h2.q', el.view);
      if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      el.view.scrollIntoView({ block: 'start' });
    }
  }

  /* ---------- Bedienung ---------- */
  el.view.addEventListener('click', function (e) {
    var n = NODES[cur], b;
    if ((b = e.target.closest('.choice'))) { var x = n.answers.filter(function (o) { return o.to === b.getAttribute('data-to'); })[0]; go(x.to, n.text, x.t); return; }
    if ((b = e.target.closest('button.ans[data-i]'))) { var y = n.answers[+b.getAttribute('data-i')]; go(y.to, n.text, y.t); return; }
    if ((b = e.target.closest('button.ans[data-n]'))) { var z = n.next[+b.getAttribute('data-n')]; go(z.to, n.title, z.t); return; }
    if (e.target.closest('#print')) window.print();
  });
  el.back.addEventListener('click', back);
  el.restart.addEventListener('click', restart);

  render(false);
})();
