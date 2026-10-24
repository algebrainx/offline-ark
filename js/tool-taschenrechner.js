/* Offline-Ark – Taschenrechner.
 * Eigener Ausdrucksparser (rekursiver Abstieg), KEIN eval() / new Function.
 *   Ausdruck  := Term (('+'|'−') Term)*          Punkt-vor-Strich
 *   Term      := Unär (('×'|'÷'|implizit) Unär)*
 *   Unär      := ('+'|'−') Unär | Potenz
 *   Potenz    := Postfix ('^' Unär)?             rechtsassoziativ, −2^2 = −4
 *   Postfix   := Primär ('!' | '%')*
 *   Primär    := Zahl | π | e | Ans | '(' Ausdruck ')' | Funktion '(' Ausdruck ')' | '√' Primär
 * Der Parser liegt oben und ist ohne Browser testbar (module.exports am Ende). */
(function () {
  'use strict';

  /* ---------- Fehler & Rundung ---------- */
  function fail(msg) { throw { calc: true, msg: msg }; }

  /** Float-Rauschen entfernen: auf 12 gültige Stellen runden (0,1+0,2 → 0,3). */
  function round12(v) {
    if (!isFinite(v)) fail('Zahl zu groß');
    return Number(v.toPrecision(12));
  }

  /* ---------- Winkelfunktionen (Grad oder Bogenmaß) ---------- */
  var RAD = Math.PI / 180;
  function snap(v) { return Math.abs(v) < 1e-15 ? 0 : v; }

  function sin(x, mode) {
    if (mode === 'deg') {
      var k = x / 90;
      if (Number.isInteger(k)) return [0, 1, 0, -1][((k % 4) + 4) % 4];
      return Math.sin(x * RAD);
    }
    return snap(Math.sin(x));
  }
  function cos(x, mode) {
    if (mode === 'deg') {
      var k = x / 90;
      if (Number.isInteger(k)) return [1, 0, -1, 0][((k % 4) + 4) % 4];
      return Math.cos(x * RAD);
    }
    return snap(Math.cos(x));
  }
  function tan(x, mode) {
    if (mode === 'deg') {
      var k = x / 90;
      if (Number.isInteger(k)) {
        if (Math.abs(k) % 2 === 1) fail('Tangens hier nicht definiert');
        return 0;
      }
      return Math.tan(x * RAD);
    }
    if (Math.abs(Math.cos(x)) < 1e-12) fail('Tangens hier nicht definiert');
    return snap(Math.tan(x));
  }
  function inv(fn, v, mode) {
    if (fn !== 'atan' && (v < -1 || v > 1)) fail('Ungültige Eingabe');
    var r = Math[fn](v);
    return mode === 'deg' ? r / RAD : r;
  }

  function factorial(n) {
    if (n < 0 || Math.abs(n - Math.round(n)) > 1e-9) fail('Fakultät nur für ganze Zahlen ≥ 0');
    n = Math.round(n);
    if (n > 170) fail('Zahl zu groß');
    var r = 1;
    for (var i = 2; i <= n; i++) r *= i;
    return r;
  }

  var FUNCS = {
    sin: function (x, m) { return sin(x, m); },
    cos: function (x, m) { return cos(x, m); },
    tan: function (x, m) { return tan(x, m); },
    asin: function (x, m) { return inv('asin', x, m); },
    acos: function (x, m) { return inv('acos', x, m); },
    atan: function (x, m) { return inv('atan', x, m); },
    ln: function (x) { if (x <= 0) fail('Ungültige Eingabe'); return Math.log(x); },
    log: function (x) { if (x <= 0) fail('Ungültige Eingabe'); return Math.log10(x); },
    sqrt: function (x) { if (x < 0) fail('Wurzel aus negativer Zahl'); return Math.sqrt(x); }
  };

  /* ---------- Tokenizer ---------- */
  // Schreibweisen → interne Funktionsnamen
  var NAMES = [
    ['sin⁻¹', 'asin'], ['cos⁻¹', 'acos'], ['tan⁻¹', 'atan'],
    ['arcsin', 'asin'], ['arccos', 'acos'], ['arctan', 'atan'],
    ['asin', 'asin'], ['acos', 'acos'], ['atan', 'atan'],
    ['sqrt', 'sqrt'], ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['log', 'log'], ['ln', 'ln']
  ];

  function tokenize(src) {
    var t = [], i = 0, m;
    while (i < src.length) {
      var c = src.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^(\d+[.,]?\d*|[.,]\d+)/.exec(src.slice(i)))) {
        t.push({ t: 'num', v: Number(m[1].replace(',', '.')) }); i += m[1].length; continue;
      }
      if (c === '+') { t.push({ t: 'op', v: '+' }); i++; continue; }
      if (c === '−' || c === '-' || c === '–') { t.push({ t: 'op', v: '-' }); i++; continue; }
      if (c === '×' || c === '*' || c === '·') { t.push({ t: 'op', v: '*' }); i++; continue; }
      if (c === '÷' || c === '/' || c === ':') { t.push({ t: 'op', v: '/' }); i++; continue; }
      if (c === '^') { t.push({ t: 'op', v: '^' }); i++; continue; }
      if (c === '!' || c === '%') { t.push({ t: 'post', v: c }); i++; continue; }
      if (c === '(') { t.push({ t: '(' }); i++; continue; }
      if (c === ')') { t.push({ t: ')' }); i++; continue; }
      if (c === '√') { t.push({ t: 'fn', v: 'sqrt' }); i++; continue; }
      if (c === 'π') { t.push({ t: 'const', v: Math.PI }); i++; continue; }
      if (src.substr(i, 2).toLowerCase() === 'pi') { t.push({ t: 'const', v: Math.PI }); i += 2; continue; }
      if (src.substr(i, 3) === 'Ans') { t.push({ t: 'ans' }); i += 3; continue; }
      var hit = null;
      for (var n = 0; n < NAMES.length; n++) {
        if (src.substr(i, NAMES[n][0].length).toLowerCase() === NAMES[n][0].toLowerCase()) { hit = NAMES[n]; break; }
      }
      if (hit) { t.push({ t: 'fn', v: hit[1] }); i += hit[0].length; continue; }
      if (c === 'e' || c === 'E') { t.push({ t: 'const', v: Math.E }); i++; continue; }
      fail('Ungültiger Ausdruck');
    }
    return t;
  }

  /* ---------- Parser + Auswertung in einem Schritt ---------- */
  /** ctx: { mode: 'deg'|'rad', ans: Zahl } */
  function evaluate(src, ctx) {
    ctx = ctx || {};
    var mode = ctx.mode === 'rad' ? 'rad' : 'deg';
    var toks = tokenize(src), p = 0;

    function peek() { return toks[p]; }
    function isOp(tok, v) { return tok && tok.t === 'op' && tok.v === v; }
    function startsPrimary(tok) {
      return tok && (tok.t === 'num' || tok.t === 'const' || tok.t === 'ans' || tok.t === '(' || tok.t === 'fn');
    }

    // Rückgabe jeweils { v: Wert, pct: war direkt ein Prozentwert }
    function parseExpr() {
      var left = parseTerm();
      while (peek() && (isOp(peek(), '+') || isOp(peek(), '-'))) {
        var op = toks[p++].v, right = parseTerm(), rv = right.v;
        if (right.pct) rv = left.v * right.v;     // 200 + 10 % = 220
        var sum = op === '+' ? left.v + rv : left.v - rv;
        // Rundungsrauschen bei fast gleich großen Zahlen (0,3 − 0,1 − 0,2) auf 0 setzen
        if (Math.abs(sum) < 1e-12 * Math.max(Math.abs(left.v), Math.abs(rv))) sum = 0;
        left = { v: sum, pct: false };
      }
      return left;
    }

    function parseTerm() {
      var left = parseUnary();
      for (;;) {
        var tok = peek();
        if (isOp(tok, '*')) {
          p++; left = { v: left.v * parseUnary().v, pct: false };
        } else if (isOp(tok, '/')) {
          p++;
          var d = parseUnary().v;
          if (d === 0) fail('Division durch 0 nicht möglich');
          left = { v: left.v / d, pct: false };
        } else if (startsPrimary(tok)) {         // 2π, 3(4+1), 2sin(30)
          left = { v: left.v * parseUnary().v, pct: false };
        } else break;
      }
      return left;
    }

    function parseUnary() {
      var tok = peek();
      if (isOp(tok, '-')) { p++; var u = parseUnary(); return { v: -u.v, pct: false }; }
      if (isOp(tok, '+')) { p++; return parseUnary(); }
      return parsePower();
    }

    function parsePower() {
      var base = parsePostfix();
      if (isOp(peek(), '^')) {
        p++;
        var ex = parseUnary().v, r = Math.pow(base.v, ex);
        if (base.v === 0 && ex < 0) fail('Division durch 0 nicht möglich');
        if (isNaN(r)) fail('Ungültige Eingabe');
        return { v: r, pct: false };
      }
      return base;
    }

    function parsePostfix() {
      var node = parsePrimary();
      while (peek() && peek().t === 'post') {
        var c = toks[p++].v;
        if (c === '!') node = { v: factorial(node.v), pct: false };
        else node = { v: node.v / 100, pct: true };
      }
      return node;
    }

    function parsePrimary() {
      var tok = toks[p++];
      if (!tok) fail('Ausdruck unvollständig');
      if (tok.t === 'num' || tok.t === 'const') return { v: tok.v, pct: false };
      if (tok.t === 'ans') return { v: ctx.ans || 0, pct: false };
      if (tok.t === '(') {
        var inner = parseExpr();
        if (peek() && peek().t === ')') p++;      // fehlende ")" am Ende wird automatisch geschlossen
        else if (p < toks.length) fail('Ungültiger Ausdruck');
        return { v: inner.v, pct: inner.pct };
      }
      if (tok.t === 'fn') {
        var arg;
        if (peek() && peek().t === '(') { p++; arg = parseExpr(); if (peek() && peek().t === ')') p++; }
        else arg = parsePostfixOnly();
        return { v: FUNCS[tok.v](arg.v, mode), pct: false };
      }
      fail('Ungültiger Ausdruck');
    }

    // √9 ohne Klammer: nur ein Postfix-Ausdruck (Zahl, Konstante …)
    function parsePostfixOnly() { return parsePostfix(); }

    // Abschließende Operatoren (z. B. „5+“) stillschweigend ignorieren
    while (toks.length && toks[toks.length - 1].t === 'op') toks.pop();
    if (!toks.length) fail('Ausdruck unvollständig');
    var res = parseExpr();
    if (p < toks.length) fail('Ungültiger Ausdruck');
    return round12(res.v);
  }

  /* ---------- Zahlen formatieren ---------- */
  var SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function sup(s) {
    return String(s).replace(/\d/g, function (d) { return SUP.charAt(Number(d)); }).replace('-', '⁻');
  }
  function parts(v) {
    var r = Number(v.toPrecision(12)), a = Math.abs(r);
    if (r === 0) return { s: '0' };
    if (a >= 1e15 || a < 1e-6) {
      var e = r.toExponential().split('e');
      return { mant: e[0].replace('.', ','), exp: Number(e[1]) };
    }
    return { s: String(r).replace('.', ',') };
  }
  /** Anzeige: deutsch, mit Tausenderpunkt. */
  function fmtDisplay(v) {
    var x = parts(v);
    if (x.mant !== undefined) return x.mant + ' × 10' + sup(x.exp);
    var seg = x.s.split(',');
    seg[0] = seg[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return seg.join(',');
  }
  /** Für den Eingabe-Ausdruck: ohne Tausenderpunkt, immer vom Parser lesbar. */
  function fmtInput(v) {
    var x = parts(v);
    if (x.mant !== undefined) return '(' + x.mant + '×10^' + (x.exp < 0 ? '−' + (-x.exp) : x.exp) + ')';
    return x.s;
  }

  var api = { evaluate: evaluate, fmtDisplay: fmtDisplay, fmtInput: fmtInput };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined' || typeof window === 'undefined' || !window.OA) return;

  /* ====================================================================
   * Oberfläche
   * ==================================================================== */
  var OA = window.OA;
  var el = {
    expr: OA.$('#calc-expr'), out: OA.$('#calc-out'), angle: OA.$('#angle'), more: OA.$('#more-btn'),
    panel: OA.$('#sci-panel'), mem: OA.$('#mem-chip'), deg: OA.$('#deg-chip'), hist: OA.$('#hist-list'),
    histClear: OA.$('#hist-clear')
  };

  // Dezimalzeichen je Sprache (de/es: Komma, en/ar: Punkt); der Parser versteht beides
  var DEC = (OA.lang === 'en' || OA.lang === 'ar') ? '.' : ',';
  function loc(s) { return s.replace(/[.,]/g, DEC); }
  function show(v) {
    var s = fmtDisplay(v);                       // deutsch: 1.234,5
    return DEC === ',' ? s : s.replace(/[.,]/g, function (c) { return c === '.' ? ',' : '.'; });
  }
  function inp(v) { return fmtInput(v).replace(',', DEC); }

  var saved = OA.store.get('taschenrechner', {}) || {};
  var S = {
    expr: '',                      // aktuelle Eingabe
    result: null,                  // letztes Ergebnis (Zahl)
    fresh: false,                  // true direkt nach „=“
    error: '',
    mode: saved.angle === 'rad' ? 'rad' : 'deg',
    mem: typeof saved.mem === 'number' ? saved.mem : 0,
    hist: Array.isArray(saved.hist) ? saved.hist.slice(0, 10) : []
  };

  function persist() { OA.store.set('taschenrechner', { angle: S.mode, mem: S.mem, hist: S.hist }); }
  function ctx() { return { mode: S.mode, ans: S.result == null ? 0 : S.result }; }

  /** Ergebnis der aktuellen Eingabe, ohne Fehler anzuzeigen. null wenn (noch) ungültig. */
  function tryEval() {
    if (!S.expr) return null;
    try { return evaluate(S.expr, ctx()); } catch (e) { return null; }
  }

  function render() {
    var big, preview = null;
    el.out.classList.toggle('err', !!S.error);
    if (S.error) {
      big = OA.t(S.error);
    } else if (S.fresh && S.result != null) {
      big = show(S.result);
    } else {
      preview = tryEval();
      big = preview != null ? show(preview) : (S.expr ? '' : '0');
    }
    el.expr.textContent = S.expr ? S.expr + (S.fresh && !S.error ? ' =' : '') : '\u00a0';
    el.out.textContent = big || '\u00a0';
    el.out.classList.toggle('long', big.length > 11);
    el.out.classList.toggle('dim', !S.fresh && !S.error);
    el.mem.hidden = S.mem === 0;
    el.deg.textContent = OA.t(S.mode === 'deg' ? 'Grad' : 'Bogenmaß');
    // Tastatur-Leser: Ergebnis ansagen
    el.out.setAttribute('aria-label', OA.t('Ergebnis {0}', [big]));
  }

  function renderHist() {
    el.hist.innerHTML = S.hist.length ? S.hist.map(function (h, i) {
      return '<button type="button" class="hist-item" data-i="' + i + '" data-notranslate><span class="muted ltr">' + OA.esc(loc(h.e)) + ' =</span><strong class="ltr">' + OA.esc(show(h.r)) + '</strong></button>';
    }).join('') : '<p class="muted small" style="margin:0">' + OA.esc(OA.t('Noch keine Rechnungen.')) + '</p>';
    el.histClear.hidden = !S.hist.length;
  }

  /* ---------- Eingabe ---------- */
  var OPS = '+−×÷^';
  function last() { return S.expr.charAt(S.expr.length - 1); }
  function clearError() { S.error = ''; }

  /** Neuer Wert beginnt: nach „=“ wird die Eingabe neu gestartet. */
  function startValue() {
    if (S.fresh || S.error) { S.expr = ''; S.fresh = false; S.error = ''; }
  }
  /** Operator, Prozent … setzt nach „=“ mit dem Ergebnis fort. */
  function continueValue() {
    if (S.error) { S.expr = ''; S.fresh = false; S.error = ''; return; }
    if (S.fresh) { S.expr = S.result < 0 ? '(' + inp(S.result) + ')' : inp(S.result); S.fresh = false; }
  }
  function appendValue(num) {          // MR, Verlauf
    startValue();
    var s = inp(num);
    S.expr += num < 0 ? '(' + s + ')' : s;
  }

  function digit(d) { startValue(); S.expr += d; }

  function comma() {
    startValue();
    var m = /[\d.,]*$/.exec(S.expr)[0];
    if (/[.,]/.test(m)) return;
    S.expr += /\d$/.test(S.expr) ? DEC : '0' + DEC;
  }

  function operator(op) {
    continueValue();
    if (!S.expr) {
      if (op === '−') S.expr = '−';
      else if (S.result != null) S.expr = 'Ans' + op;
      return;
    }
    var l = last();
    if (OPS.indexOf(l) >= 0) {
      // „5×−“ erlaubt ein Vorzeichen, sonst Operator ersetzen
      if (op === '−' && '×÷^'.indexOf(l) >= 0) { S.expr += '−'; return; }
      S.expr = S.expr.replace(/[+−×÷^]+$/, '') + op;
      return;
    }
    if (l === '(') { if (op === '−') S.expr += op; return; }
    S.expr += op;
  }

  function postfix(c) {
    continueValue();
    if (/[\d)!%eπ]$|Ans$/.test(S.expr)) S.expr += c;
  }

  function openParen() { startValue(); S.expr += '('; }
  function closeParen() {
    continueValue();
    var open = (S.expr.match(/\(/g) || []).length, close = (S.expr.match(/\)/g) || []).length;
    if (open > close && last() !== '(' && OPS.indexOf(last()) < 0) S.expr += ')';
  }

  function func(name) { startValue(); S.expr += name + '('; }
  function constant(sym) { startValue(); S.expr += sym; }

  function square() {
    continueValue();
    if (S.expr && OPS.indexOf(last()) < 0 && last() !== '(') S.expr += '^2';
  }
  function reciprocal() {
    continueValue();
    if (S.expr && OPS.indexOf(last()) < 0 && last() !== '(') S.expr = '1÷(' + S.expr + ')';
  }

  function negate() {
    continueValue();
    var m = /(\(−)?(\d+,?\d*|,\d+|π|e|Ans)(\))?$/.exec(S.expr);
    if (!S.expr || OPS.indexOf(last()) >= 0 || last() === '(') {
      if (last() === '−' && S.expr.length === 1) S.expr = '';
      else S.expr += '(−';
      return;
    }
    if (m && m[1] && m[3]) S.expr = S.expr.slice(0, m.index) + m[2];          // (−5) → 5
    else if (m && !m[1] && !m[3]) S.expr = S.expr.slice(0, m.index) + '(−' + m[2] + ')'; // 5 → (−5)
    else S.expr = '−(' + S.expr + ')';
  }

  function backspace() {
    if (S.fresh || S.error) { S.fresh = false; S.error = ''; return; }
    S.expr = S.expr.replace(/(sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|sin\(|cos\(|tan\(|ln\(|log\(|√\(|Ans|[\s\S])$/, '');
  }

  function clearAll() { S.expr = ''; S.result = null; S.fresh = false; S.error = ''; }

  function equals() {
    if (S.fresh || !S.expr) return;
    var openN = (S.expr.match(/\(/g) || []).length, closeN = (S.expr.match(/\)/g) || []).length;
    if (openN > closeN) S.expr += new Array(openN - closeN + 1).join(')');   // fehlende Klammern schließen
    try {
      var r = evaluate(S.expr, ctx());
      S.hist.unshift({ e: S.expr, r: r });
      S.hist = S.hist.slice(0, 10);
      S.result = r; S.fresh = true; S.error = '';
      persist(); renderHist();
    } catch (e) {
      S.error = e && e.calc ? e.msg : 'Ungültiger Ausdruck';
      S.fresh = false;
    }
  }

  /** Wert für Speichertasten: Ergebnis oder gültige aktuelle Eingabe. */
  function currentValue() {
    if (S.fresh && S.result != null) return S.result;
    return tryEval();
  }
  function memory(kind) {
    if (kind === 'mc') { S.mem = 0; }
    else if (kind === 'mr') { appendValue(S.mem); }
    else {
      var v = currentValue();
      if (v == null) { S.error = 'Erst eine gültige Rechnung eingeben'; return; }
      S.mem = round12(kind === 'mplus' ? S.mem + v : S.mem - v);
    }
    persist();
  }

  var ACTIONS = {
    comma: comma, clear: clearAll, back: backspace, eq: equals, neg: negate, sq: square, inv: reciprocal,
    open: openParen, close: closeParen, fact: function () { postfix('!'); }, pct: function () { postfix('%'); },
    pi: function () { constant('π'); }, e: function () { constant('e'); }, ans: function () {
      if (S.result == null) return;
      constant('Ans');
    },
    sqrt: function () { func('√'); }, pow: function () { operator('^'); },
    mc: function () { memory('mc'); }, mplus: function () { memory('mplus'); },
    mminus: function () { memory('mminus'); }, mr: function () { memory('mr'); }
  };

  function press(k) {
    if (/^\d$/.test(k)) digit(k);
    else if (OPS.indexOf(k) >= 0 && k.length === 1) operator(k);
    else if (k.indexOf('fn:') === 0) func(k.slice(3));
    else if (ACTIONS[k]) ACTIONS[k]();
    render();
  }

  /* ---------- Ereignisse ---------- */
  OA.$('#calc-keys').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-k]'); if (b) press(b.getAttribute('data-k'));
  });
  el.panel.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-k]'); if (b) press(b.getAttribute('data-k'));
  });

  el.more.addEventListener('click', function () {
    var open = el.panel.hidden;
    el.panel.hidden = !open;
    el.more.setAttribute('aria-expanded', open ? 'true' : 'false');
    el.more.textContent = OA.t(open ? 'Weniger' : 'Mehr');
  });

  OA.segSet(el.angle, S.mode);
  el.angle.addEventListener('input', function () {
    S.mode = OA.segVal(el.angle) === 'rad' ? 'rad' : 'deg';
    persist(); render();
  });

  el.hist.addEventListener('click', function (e) {
    var b = e.target.closest('.hist-item'); if (!b) return;
    var h = S.hist[Number(b.getAttribute('data-i'))];
    if (h) { appendValue(h.r); render(); }
  });
  el.histClear.addEventListener('click', function () { S.hist = []; persist(); renderHist(); });

  // Tastatur am PC: Ziffern, Rechenzeichen, Klammern, Enter, Rücktaste, Esc
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Enter ist immer „=“ – außer auf „Mehr“, Verlauf-Einträgen, Zusammenfassungen und Links
    if (e.key === 'Enter' && t.closest && t.closest('#more-btn, #hist-clear, .hist-item, summary, a')) return;
    var k = e.key, map = {
      '+': '+', '-': '−', '*': '×', 'x': '×', '/': '÷', ':': '÷', '^': '^', ',': 'comma', '.': 'comma',
      '(': 'open', ')': 'close', '%': 'pct', '!': 'fact', 'p': 'pi', '=': 'eq', 'Enter': 'eq',
      'Backspace': 'back', 'Delete': 'clear', 'Escape': 'clear'
    }, action = null;
    if (/^\d$/.test(k)) action = k; else if (map[k]) action = map[k];
    if (!action) return;
    e.preventDefault();
    press(action);
  });

  OA.$('[data-k="comma"]').textContent = DEC;
  renderHist();
  render();
})();
