/* Offline-Ark – Kinderbereich: „Erklärt“ (kurze Karten, Notruf-Rollenspiel) und „Spiele“ (alles offline, ohne Ton). */
(function () {
  'use strict';
  var OA = window.OA, K = window.OA_KINDER, G = window.OA_KINDER_GAMES, $ = OA.$;
  var t = function (k, a) { return OA.t(k, a); };
  var esc = OA.esc;

  var el = { tabs: $('#tabs'), vExplain: $('#vExplain'), vGames: $('#vGames'), vCard: $('#vCard'), vGame: $('#vGame'), kbar: $('#kbar'),
    viewTitle: $('#viewTitle'), explainTiles: $('#explainTiles'), gameTiles: $('#gameTiles') };

  var GAMES = [
    { id: 'memory', icon: 'star', name: 'Memory', sub: 'Finde alle Paare.' },
    { id: 'ttt', icon: 'close', name: 'Tic-Tac-Toe', sub: 'Drei in einer Reihe.' },
    { id: 'wort', icon: 'sign', name: 'Buchstabenraten', sub: 'Errate das Wort.' },
    { id: 'malen', icon: 'note', name: 'Malen', sub: 'Mit dem Finger malen.' },
    { id: 'zahl', icon: 'calc', name: 'Zahl raten', sub: 'Finde meine Zahl.' }
  ];
  var timers = [], view = null, backTo = null;
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /* ---------- Menüs ---------- */
  function tile(id, icon, name, sub) {
    return '<button type="button" class="tile" data-id="' + esc(id) + '">' + OA.icon(icon) + '<span class="name">' + esc(t(name)) +
      (sub ? '<span class="sub">' + esc(t(sub)) + '</span>' : '') + '</span></button>';
  }
  el.explainTiles.innerHTML = K.cards.map(function (c) { return tile(c.id, c.icon, c.title); }).join('');
  el.gameTiles.innerHTML = GAMES.map(function (g) { return tile(g.id, g.icon, g.name, g.sub); }).join('');

  var saved = OA.store.get('kinder', null);
  OA.segSet(el.tabs, saved && saved.tab === 'games' ? 'games' : 'explain');

  function showMenu() {
    clearTimers(); view = null;
    var tab = OA.segVal(el.tabs);
    el.kbar.hidden = true; el.tabs.hidden = false;
    el.vExplain.hidden = tab !== 'explain'; el.vGames.hidden = tab !== 'games'; el.vCard.hidden = true; el.vGame.hidden = true;
    window.scrollTo(0, 0);
  }
  function openSub(target, title, back, box) {
    clearTimers(); view = target; backTo = back;
    el.tabs.hidden = true; el.vExplain.hidden = true; el.vGames.hidden = true;
    el.vCard.hidden = box !== 'card'; el.vGame.hidden = box !== 'game';
    el.kbar.hidden = false; el.viewTitle.textContent = title;
    window.scrollTo(0, 0);
  }
  $('#backBtn').addEventListener('click', function () { if (backTo === 'card:notruf') openCard('notruf'); else showMenu(); });
  el.tabs.addEventListener('input', function () { OA.store.set('kinder', { tab: OA.segVal(el.tabs) }); showMenu(); });
  el.explainTiles.addEventListener('click', function (e) { var b = e.target.closest('.tile'); if (b) openCard(b.getAttribute('data-id')); });
  el.gameTiles.addEventListener('click', function (e) { var b = e.target.closest('.tile'); if (b) openGame(b.getAttribute('data-id')); });

  /* ---------- Erklär-Karten ---------- */
  function sentences(items, icon, cls) {
    return '<ul class="sent ' + (cls || '') + '">' + items.map(function (s) { return '<li>' + (icon ? OA.icon(icon) : OA.icon('sparkle')) + '<span>' + esc(t(s)) + '</span></li>'; }).join('') + '</ul>';
  }
  function openCard(id) {
    var c = K.cards.filter(function (x) { return x.id === id; })[0];
    openSub('card', t(c.title), null, 'card');
    var html = '<h2>' + OA.icon(c.icon) + ' ' + esc(t(c.title)) + '</h2>';
    c.blocks.forEach(function (b) {
      if (b.t === 'list') html += sentences(b.items);
      else if (b.t === 'p') html += '<p class="big">' + esc(t(b.text)) + '</p>';
      else if (b.t === 'ok') html += '<div class="sub-h">' + esc(t(b.head)) + '</div>' + sentences(b.items, 'check');
      else if (b.t === 'no') html += '<div class="sub-h no">' + esc(t(b.head)) + '</div>' + sentences(b.items, 'close', 'no');
      else if (b.t === 'steps') html += '<ol class="steps">' + b.items.map(function (s) { return '<li>' + esc(t(s)) + '</li>'; }).join('') + '</ol>';
      else if (b.t === 'helpers') html += '<ul class="sent">' + b.items.map(function (h) { return '<li>' + OA.icon(h.icon) + '<span>' + esc(t(h.text)) + '</span></li>'; }).join('') + '</ul>';
      else if (b.t === 'game') html += '<div class="actions"><button type="button" class="btn primary" data-game="' + esc(b.game) + '">' + esc(t(b.label)) + '</button></div>';
    });
    el.vCard.innerHTML = html;
  }
  el.vCard.addEventListener('click', function (e) { var b = e.target.closest('[data-game]'); if (b) openGame(b.getAttribute('data-game'), 'card:notruf'); });

  /* ---------- Spiele: Start ---------- */
  function openGame(id, back) {
    var g = GAMES.filter(function (x) { return x.id === id; })[0];
    openSub('game:' + id, t(g ? g.name : 'Notruf-Rollenspiel'), back || 'menu', 'game');
    ({ memory: gameMemory, ttt: gameTtt, wort: gameWort, malen: gameMalen, zahl: gameZahl, notruf: gameNotruf })[id]();
  }
  function seg(id, opts, cur) {
    return '<div class="seg" data-local id="' + id + '" role="group">' + opts.map(function (o) {
      return '<button type="button" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(o[0]) === String(cur)) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
  }
  function goBtn(id, label) { return '<div class="go"><button type="button" class="btn primary" id="' + id + '">' + esc(t(label)) + '</button></div>'; }
  // Segmente werden dynamisch erzeugt (common.js bindet nur vorhandene): Klick -> umschalten und "input" auslösen
  el.vGame.addEventListener('click', function (e) {
    var b = e.target.closest('.seg[data-local] button'); if (!b) return;
    var g = b.parentNode; OA.segSet(g, b.getAttribute('data-v')); g.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /* ---------- Memory ---------- */
  var SYM_NAMES = { star: 'Stern', heart: 'Herz', sun: 'Sonne', moon: 'Mond', leaf: 'Blatt', drop: 'Tropfen', paw: 'Pfote', bulb: 'Glühbirne', flame: 'Flamme', bolt: 'Blitz', tent: 'Zelt', book: 'Buch' };
  function gameMemory() {
    var cfg = { easy: [3, 3], mid: [6, 4], hard: [10, 5] }, level = 'easy', deck, open, matched, moves, lock;
    el.vGame.innerHTML = seg('memLevel', [['easy', t('Leicht')], ['mid', t('Mittel')], ['hard', t('Schwer')]], level) +
      '<div class="status" id="memStatus" aria-live="polite"></div><div class="mem-grid" id="memGrid"></div>' + goBtn('memNew', 'Neues Spiel');
    var grid = $('#memGrid'), status = $('#memStatus');
    function start() {
      clearTimers(); deck = G.memoryDeck(cfg[level][0], K.memoryIcons); open = []; matched = 0; moves = 0; lock = false;
      grid.style.gridTemplateColumns = 'repeat(' + cfg[level][1] + ', 1fr)';
      grid.innerHTML = deck.map(function (c) {
        return '<button type="button" class="mem" data-i="' + c.id + '" aria-label="' + esc(t('Karte {0}', [c.id + 1])) + '"><span class="back">' + OA.icon('sparkle') + '</span><span class="face">' + OA.icon(c.sym) + '</span></button>';
      }).join('');
      status.textContent = t('Züge: {0}', [0]);
    }
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.mem'); if (!b || lock || b.classList.contains('up') || b.classList.contains('done')) return;
      b.classList.add('up'); b.setAttribute('aria-label', t('Karte {0}', [+b.getAttribute('data-i') + 1]) + ': ' + t(SYM_NAMES[deck[+b.getAttribute('data-i')].sym]));
      open.push(b);
      if (open.length < 2) return;
      moves++; status.textContent = t('Züge: {0}', [moves]);
      var a = open[0], c = open[1];
      if (deck[+a.getAttribute('data-i')].sym === deck[+c.getAttribute('data-i')].sym) {
        a.classList.replace('up', 'done'); c.classList.replace('up', 'done'); open = []; matched++;
        if (matched === cfg[level][0]) status.textContent = t('Geschafft! Du hast alle Paare in {0} Zügen gefunden.', [moves]);
      } else {
        lock = true;
        later(function () {
          [a, c].forEach(function (x) { x.classList.remove('up'); x.setAttribute('aria-label', t('Karte {0}', [+x.getAttribute('data-i') + 1])); });
          open = []; lock = false;
        }, 900);
      }
    });
    $('#memLevel').addEventListener('input', function () { level = OA.segVal($('#memLevel')); start(); });
    $('#memNew').addEventListener('click', start);
    start();
  }

  /* ---------- Tic-Tac-Toe ---------- */
  var SVG_X = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M22 22L78 78M78 22L22 78"/></svg>';
  var SVG_O = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="29"/></svg>';
  function gameTtt() {
    var mode = 'cpu', board, turn, over, winLine;
    el.vGame.innerHTML = seg('tttMode', [['cpu', t('Gegen den Computer')], ['two', t('Zu zweit')]], mode) +
      '<div class="status" id="tttStatus" aria-live="polite"></div><div class="ttt" id="tttBoard"></div>' + goBtn('tttNew', 'Neues Spiel');
    var boardEl = $('#tttBoard'), status = $('#tttStatus');
    var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    function render() {
      boardEl.innerHTML = board.map(function (c, i) {
        var cls = (c === 'X' ? 'x' : '') + (winLine && winLine.indexOf(i) >= 0 ? ' win' : '');
        return '<button type="button" class="' + cls + '" data-i="' + i + '" aria-label="' + esc(t('Feld {0}', [i + 1]) + (c ? ': ' + c : '')) + '">' + (c === 'X' ? SVG_X : c === 'O' ? SVG_O : '') + '</button>';
      }).join('');
      var w = G.winner(board);
      if (w === 'draw') status.textContent = t('Unentschieden!');
      else if (w) status.textContent = mode === 'cpu' ? t(w === 'X' ? 'Du hast gewonnen!' : 'Der Computer hat gewonnen.') : t('{0} hat gewonnen!', [w]);
      else status.textContent = mode === 'cpu' ? (turn === 'X' ? t('Du bist dran (X).') : t('Der Computer denkt …')) : t('{0} ist dran.', [turn]);
    }
    function start() {
      clearTimers(); board = Array(9).fill(''); turn = 'X'; over = false; winLine = null; render();
    }
    function place(i) {
      board[i] = turn; var w = G.winner(board);
      if (w && w !== 'draw') { over = true; winLine = LINES.filter(function (l) { return l.every(function (k) { return board[k] === w; }); })[0]; }
      else if (w) over = true;
      turn = turn === 'X' ? 'O' : 'X'; render();
      if (!over && mode === 'cpu' && turn === 'O') later(function () { place(G.aiMove(board, 'O', 'X', Math.random, 0.2)); }, 600);
    }
    boardEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || over) return;
      var i = +b.getAttribute('data-i');
      if (board[i] || (mode === 'cpu' && turn !== 'X')) return;
      place(i);
    });
    $('#tttMode').addEventListener('input', function () { mode = OA.segVal($('#tttMode')); start(); });
    $('#tttNew').addEventListener('click', start);
    start();
  }

  /* ---------- Buchstabenraten ---------- */
  function gameWort() {
    var lang = K.words[OA.lang] ? OA.lang : 'de', list = K.words[lang], keys = K.keyboard[lang], MAX = 6, word, guessed, last = -1;
    el.vGame.innerHTML = '<div class="lives" id="lives" aria-hidden="true"></div><div class="status" id="wStatus" aria-live="polite"></div>' +
      '<div class="slots" id="slots" dir="' + (lang === 'ar' ? 'rtl' : 'ltr') + '"></div><div class="keys" id="keys" dir="' + (lang === 'ar' ? 'rtl' : 'ltr') + '"></div>' + goBtn('wNew', 'Neues Wort');
    function render() {
      var h = G.hangman(word, guessed, lang, MAX), letters = Array.from(word);
      $('#lives').innerHTML = Array.apply(null, Array(MAX)).map(function (_, i) { return OA.icon('heart', i >= MAX - h.wrong ? 'off' : ''); }).join('');
      $('#slots').innerHTML = h.slots.map(function (s, i) { return '<span class="slot">' + esc(s ? letters[i] : (h.lost ? letters[i] : '')) + '</span>'; }).join('');
      $('#wStatus').textContent = h.won ? t('Super! Das Wort ist {0}.', [word]) : h.lost ? t('Schade! Das Wort war {0}.', [word]) : t('Versuche übrig: {0}.', [MAX - h.wrong]);
      var wl = G.wordLetters(word, lang);
      $('#keys').innerHTML = keys.map(function (k) {
        var used = guessed.indexOf(k) >= 0, cls = used ? (wl.indexOf(k) >= 0 ? 'ok' : 'bad') : '';
        return '<button type="button" class="' + cls + '" data-k="' + esc(k) + '"' + (used || h.won || h.lost ? ' aria-disabled="true"' : '') + '>' + esc(k) + '</button>';
      }).join('');
    }
    function start() {
      var i; do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === last);
      last = i; word = list[i]; guessed = []; render();
    }
    $('#keys').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
      guessed.push(b.getAttribute('data-k')); render();
    });
    $('#wNew').addEventListener('click', start);
    start();
  }

  /* ---------- Malen ---------- */
  function gameMalen() {
    var color = K.paint[0].color, size = 8;
    el.vGame.innerHTML = '<div class="swatches" role="group" aria-label="' + esc(t('Farben')) + '">' + K.paint.map(function (p, i) {
      return '<button type="button" class="swatch" data-c="' + p.color + '" style="background:' + p.color + '" aria-pressed="' + (i === 0) + '" aria-label="' + esc(t(p.name)) + '"></button>'; }).join('') + '</div>' +
      seg('penSize', [[4, t('Dünn')], [8, t('Mittel')], [16, t('Dick')]], size) +
      '<div class="canvas-wrap"><canvas id="cv" aria-label="' + esc(t('Malfläche')) + '"></canvas></div>' +
      '<div class="paint-actions"><button type="button" class="btn" id="cvClear">' + esc(t('Löschen')) + '</button><button type="button" class="btn primary" id="cvSave">' + esc(t('Als Bild speichern')) + '</button></div>' +
      '<p class="hint center" id="cvMsg" role="status"></p>';
    var cv = $('#cv'), ctx = cv.getContext('2d'), wrap = cv.parentNode, dpr = window.devicePixelRatio || 1;
    var w = Math.max(240, Math.min(wrap.clientWidth || 320, 700)), h = Math.round(w * 0.75);
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    ctx.scale(dpr, dpr); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var drawing = false, lx = 0, ly = 0;
    function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (w / r.width), (e.clientY - r.top) * (h / r.height)]; }
    cv.addEventListener('pointerdown', function (e) {
      drawing = true; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ältere Browser */ }
      var p = pos(e); lx = p[0]; ly = p[1];
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx, ly, size / 2, 0, Math.PI * 2); ctx.fill(); e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pos(e); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p[0], p[1]); ctx.stroke(); lx = p[0]; ly = p[1]; e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { drawing = false; }); });
    OA.$$('.swatch', el.vGame).forEach(function (s) {
      s.addEventListener('click', function () { color = s.getAttribute('data-c'); OA.$$('.swatch', el.vGame).forEach(function (o) { o.setAttribute('aria-pressed', o === s ? 'true' : 'false'); }); });
    });
    $('#penSize').addEventListener('input', function () { size = Number(OA.segVal($('#penSize'))); });
    $('#cvClear').addEventListener('click', function () { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); $('#cvMsg').textContent = ''; });
    $('#cvSave').addEventListener('click', function () {
      cv.toBlob(function (blob) {
        if (!blob) { $('#cvMsg').textContent = t('Speichern hat nicht geklappt.'); return; }
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'malen-' + OA.today() + '.png';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        $('#cvMsg').textContent = t('Dein Bild wurde gespeichert.');
      }, 'image/png');
    });
  }

  /* ---------- Zahl raten ---------- */
  function gameZahl() {
    var max = 20, secret, tries, done;
    el.vGame.innerHTML = seg('zRange', [[10, '1–10'], [20, '1–20'], [50, '1–50']], max) +
      '<div class="status" id="zStatus" aria-live="polite"></div>' +
      '<div class="guess-row"><button type="button" id="zMinus" aria-label="' + esc(t('Weniger')) + '">−</button><input type="number" id="zIn" inputmode="numeric" min="1" value="1" aria-label="' + esc(t('Deine Zahl')) + '"><button type="button" id="zPlus" aria-label="' + esc(t('Mehr')) + '">+</button></div>' +
      '<div class="go"><button type="button" class="btn primary" id="zGo">' + esc(t('Raten')) + '</button></div>' +
      '<p class="hint center"><button type="button" class="btn sm" id="zNew">' + esc(t('Neue Zahl')) + '</button></p>';
    var inp = $('#zIn'), status = $('#zStatus');
    function start() { secret = 1 + Math.floor(Math.random() * max); tries = 0; done = false; inp.value = Math.ceil(max / 2); status.textContent = t('Ich denke an eine Zahl von {0} bis {1}.', [1, max]); }
    function bump(d) { var v = Math.round(OA.num(inp.value)) || 1; inp.value = Math.min(max, Math.max(1, v + d)); }
    $('#zMinus').addEventListener('click', function () { bump(-1); });
    $('#zPlus').addEventListener('click', function () { bump(1); });
    $('#zGo').addEventListener('click', function () {
      if (done) { start(); return; }
      var g = Math.round(OA.num(inp.value));
      if (!(g >= 1 && g <= max)) { status.textContent = t('Bitte gib eine Zahl von {0} bis {1} ein.', [1, max]); return; }
      tries++; var h = G.numberHint(g, secret);
      if (h === 'ok') { done = true; status.textContent = t('Richtig! Du hast die Zahl {0} gefunden. Versuche: {1}.', [secret, tries]); $('#zGo').textContent = t('Neue Zahl'); }
      else status.textContent = t(h === 'low' ? 'Meine Zahl ist größer.' : 'Meine Zahl ist kleiner.');
    });
    $('#zRange').addEventListener('input', function () { max = Number(OA.segVal($('#zRange'))); $('#zGo').textContent = t('Raten'); start(); });
    $('#zNew').addEventListener('click', function () { $('#zGo').textContent = t('Raten'); start(); });
    start();
  }

  /* ---------- Notruf-Rollenspiel ---------- */
  function gameNotruf() {
    var step = 0;
    function render(fb, rightIdx, tried) {
      if (step >= K.roleplay.length) {
        el.vGame.innerHTML = '<div class="rp-q">' + esc(t('Toll gemacht! Du weißt jetzt, wie man den Notruf ruft.')) + '</div><p class="big">' + esc(t('Wichtig: Ruf die 112 nur bei einem echten Notfall an.')) + '</p>' + goBtn('rpAgain', 'Nochmal spielen');
        $('#rpAgain').addEventListener('click', function () { step = 0; render(); });
        return;
      }
      var q = K.roleplay[step];
      el.vGame.innerHTML = '<div class="rp-prog">' + esc(t('Frage {0} von {1}', [step + 1, K.roleplay.length])) + '</div><div class="rp-q">' + esc(t(q.q)) + '</div><div class="rp-opts">' +
        q.options.map(function (o, i) { return '<button type="button" class="btn' + (tried && tried.indexOf(i) >= 0 ? ' tried' : '') + (rightIdx === i ? ' right' : '') + '" data-i="' + i + '">' + esc(t(o)) + '</button>'; }).join('') + '</div>' +
        '<p class="rp-fb" id="rpFb" role="status">' + esc(fb || '') + '</p>' + (rightIdx === q.a ? '<div class="go"><button type="button" class="btn primary" id="rpNext">' + esc(t('Weiter')) + '</button></div>' : '');
      var nx = $('#rpNext'); if (nx) nx.addEventListener('click', function () { step++; render(); });
      OA.$$('.rp-opts .btn', el.vGame).forEach(function (b) {
        b.addEventListener('click', function () {
          var i = Number(b.getAttribute('data-i'));
          if (rightIdx === q.a) return;
          if (i === q.a) render(t(q.good), i, tried);
          else render(t(q.hint), undefined, (tried || []).concat(i));
        });
      });
    }
    render();
  }

  showMenu();
})();
