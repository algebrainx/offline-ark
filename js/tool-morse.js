/* Offline-Ark – Morse-Code.
 * Text ↔ Morse, Ton (Web Audio, exakt im Voraus eingeplant) und Bildschirm-Blinker.
 * Timing nach Standard: Punkt = 1 Einheit, Strich = 3, Pause im Zeichen = 1,
 * Zeichenabstand = 3, Wortabstand = 7. Eine Einheit = 1200 ms / WPM (Wort „PARIS“).
 * Die Umwandlung steht oben und ist ohne Browser testbar (module.exports am Ende). */
(function () {
  'use strict';

  /* ---------- Morsealphabet ---------- */
  var GROUPS = [
    ['Buchstaben', [
      ['A', '.-'], ['B', '-...'], ['C', '-.-.'], ['D', '-..'], ['E', '.'], ['F', '..-.'], ['G', '--.'], ['H', '....'],
      ['I', '..'], ['J', '.---'], ['K', '-.-'], ['L', '.-..'], ['M', '--'], ['N', '-.'], ['O', '---'], ['P', '.--.'],
      ['Q', '--.-'], ['R', '.-.'], ['S', '...'], ['T', '-'], ['U', '..-'], ['V', '...-'], ['W', '.--'], ['X', '-..-'],
      ['Y', '-.--'], ['Z', '--..']]],
    ['Umlaute', [['Ä', '.-.-'], ['Ö', '---.'], ['Ü', '..--'], ['ß', '...--..']]],
    ['Ziffern', [
      ['0', '-----'], ['1', '.----'], ['2', '..---'], ['3', '...--'], ['4', '....-'],
      ['5', '.....'], ['6', '-....'], ['7', '--...'], ['8', '---..'], ['9', '----.']]],
    ['Satzzeichen', [
      ['.', '.-.-.-'], [',', '--..--'], ['?', '..--..'], ['!', '-.-.--'], ['\'', '.----.'], ['"', '.-..-.'],
      [':', '---...'], [';', '-.-.-.'], ['-', '-....-'], ['/', '-..-.'], ['(', '-.--.'], [')', '-.--.-'],
      ['=', '-...-'], ['+', '.-.-.'], ['@', '.--.-.'], ['&', '.-...'], ['_', '..--.-'], ['$', '...-..-']]]
  ];
  var CODE = {}, CHAR = {};
  GROUPS.forEach(function (g) {
    g[1].forEach(function (p) { CODE[p[0].toLowerCase()] = p[1]; CHAR[p[1]] = p[0]; });
  });
  var SOS_RUN = '...---...';        // Notzeichen SOS: ohne Pausen zwischen den Buchstaben
  CHAR[SOS_RUN] = 'SOS';

  // Arabisches Morsealphabet nach Wikipedia „Morse code for non-Latin alphabets“ (Abschnitt Arabic)
  var ARABIC = [
    ['ا', '.-'], ['ب', '-...'], ['ت', '-'], ['ث', '-.-.'], ['ج', '.---'], ['ح', '....'], ['خ', '---'],
    ['د', '-..'], ['ذ', '--..'], ['ر', '.-.'], ['ز', '---.'], ['س', '...'], ['ش', '----'], ['ص', '-..-'],
    ['ض', '...-'], ['ط', '..-'], ['ظ', '-.--'], ['ع', '.-.-'], ['غ', '--.'], ['ف', '..-.'], ['ق', '--.-'],
    ['ك', '-.-'], ['ل', '.-..'], ['م', '--'], ['ن', '-.'], ['ه', '..-..'], ['و', '.--'], ['ي', '..'], ['ء', '.']
  ];
  var CHAR_AR = {};
  ARABIC.forEach(function (p) { CODE[p[0]] = p[1]; CHAR_AR[p[1]] = p[0]; });
  CHAR_AR[SOS_RUN] = 'SOS';

  /** Typografische Zeichen auf Tastaturzeichen abbilden; arabische Zusatzzeichen vereinheitlichen. */
  function clean(text) {
    return String(text == null ? '' : text)
      .replace(/[’‘´`]/g, '\'').replace(/[„“”«»]/g, '"').replace(/[–—−]/g, '-')
      .replace(/[\u064B-\u0652\u0640]/g, '')                       // Vokalzeichen, Dehnungsstrich
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
      .replace(/،/g, ',').replace(/؟/g, '?').replace(/؛/g, ';')
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x660); })
      .toLowerCase();
  }
  /** Text → { words:[{codes, shown}], morse:'... --- ...', unknown:[Zeichen] }
   *  codes = so wird gesendet (SOS als Block), shown = so wird angezeigt. */
  function encode(text) {
    var words = [], unknown = [];
    clean(text).split(/\s+/).forEach(function (w) {
      if (!w) return;
      if (w === 'sos' || w === '<sos>') {
        words.push({ codes: [SOS_RUN], shown: ['...', '---', '...'] });
        return;
      }
      var codes = [];
      w.split('').forEach(function (ch) {
        if (CODE[ch]) codes.push(CODE[ch]);
        else if (unknown.indexOf(ch) < 0) unknown.push(ch);
      });
      if (codes.length) words.push({ codes: codes, shown: codes });
    });
    return {
      words: words,
      morse: words.map(function (w) { return w.shown.join(' '); }).join(' / '),
      unknown: unknown
    };
  }

  /** Morse → { words:[{codes}], text, bad:Anzahl unbekannter Zeichen }.
   *  Erlaubt: Punkt, Strich (auch · • − –), Leerzeichen zwischen Zeichen, „/“, „|“ oder 3 Leerzeichen zwischen Wörtern. */
  function decode(morse, script) {
    var map = script === 'ar' ? CHAR_AR : CHAR;
    var s = String(morse == null ? '' : morse)
      .replace(/[·•∙]/g, '.').replace(/[−–—_]/g, '-')
      .replace(/[\r\n]+/g, ' / ').replace(/\s*[\/|]\s*/g, ' / ').replace(/ {3,}/g, ' / ')
      .replace(/[^.\- \/]/g, '');
    var words = [], out = [], bad = 0;
    s.split('/').forEach(function (part) {
      var codes = part.split(/\s+/).filter(Boolean);
      if (!codes.length) return;
      words.push({ codes: codes, shown: codes });
      out.push(codes.map(function (c) { if (map[c]) return map[c]; bad++; return '?'; }).join(''));
    });
    return { words: words, text: out.join(' '), bad: bad };
  }

  /** Zeitplan: Liste { on, start, end } in Millisekunden. */
  function buildTimeline(words, unitMs) {
    var segs = [], t = 0;
    function add(on, units) { segs.push({ on: on, start: t, end: t + units * unitMs }); t += units * unitMs; }
    words.forEach(function (w, wi) {
      if (wi > 0) add(false, 7);
      w.codes.forEach(function (code, ci) {
        if (ci > 0) add(false, 3);
        code.split('').forEach(function (el, ei) {
          if (ei > 0) add(false, 1);
          add(true, el === '.' ? 1 : 3);
        });
      });
    });
    return { segs: segs, total: t };
  }

  var api = { encode: encode, decode: decode, buildTimeline: buildTimeline, GROUPS: GROUPS, ARABIC: ARABIC };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined' || typeof window === 'undefined' || !window.OA) return;

  /* ====================================================================
   * Oberfläche
   * ==================================================================== */
  var OA = window.OA;
  var el = {
    dir: OA.$('#dir'), input: OA.$('#input'), inLabel: OA.$('#in-label'), out: OA.$('#out'), outLabel: OA.$('#out-label'),
    note: OA.$('#note'), wpm: OA.$('#wpm'), hz: OA.$('#hz'), wpmVal: OA.$('#wpm-val'), hzVal: OA.$('#hz-val'),
    loop: OA.$('#loop'), flashTone: OA.$('#flash-tone'), tone: OA.$('#btn-tone'), flash: OA.$('#btn-flash'),
    scriptField: OA.$('#script-field'), script: OA.$('#script'),
    stop: OA.$('#btn-stop'), lamp: OA.$('#lamp'), time: OA.$('#duration'), table: OA.$('#table-body'), presets: OA.$('#presets')
  };

  var saved = OA.store.get('morse', {}) || {};
  var model = { words: [] };       // aktuell zu sendende Wörter

  /** Anzeige mit gut erkennbaren Zeichen: Punkt •, Strich —. */
  function pretty(m) { return m.replace(/-/g, '—').replace(/\./g, '•'); }

  /* ---------- Tabelle ---------- */
  var tableGroups = GROUPS.slice();
  if (OA.lang === 'ar') tableGroups.push(['Arabische Buchstaben', ARABIC]);   // nur in der arabischen Oberfläche
  el.table.innerHTML = tableGroups.map(function (g) {
    return '<h3>' + OA.esc(OA.t(g[0])) + '</h3><div class="morse-grid">' + g[1].map(function (p) {
      return '<div class="morse-cell"><span class="ch" dir="auto">' + OA.esc(p[0]) + '</span><span class="cd ltr" aria-label="' +
        OA.esc(p[1].replace(/\./g, OA.t('kurz') + ' ').replace(/-/g, OA.t('lang') + ' ')) + '">' + OA.esc(pretty(p[1])) + '</span></div>';
    }).join('') + '</div>';
  }).join('') +
    '<p class="small muted" style="margin:14px 0 0">' + OA.t('Notzeichen SOS: {0} ohne Pausen zwischen den Buchstaben. Nicht alle Satzzeichen sind international genormt.', ['<strong class="ltr">•••———•••</strong>']) + '</p>';

  /* ---------- Einstellungen ---------- */
  el.wpm.value = saved.wpm || 12;
  el.hz.value = saved.hz || 700;
  OA.segSet(el.dir, saved.dir === 'decode' ? 'decode' : 'encode');
  OA.segSet(el.script, saved.script === 'ar' ? 'ar' : 'latin');
  el.scriptField.hidden = OA.lang !== 'ar';
  el.loop.checked = !!saved.loop;
  el.flashTone.checked = !!saved.flashTone;
  el.input.value = typeof saved.text === 'string' ? saved.text : 'SOS';

  function unitMs() { return 1200 / Number(el.wpm.value); }
  function scriptVal() { return OA.lang === 'ar' && OA.segVal(el.script) === 'ar' ? 'ar' : 'latin'; }
  function direction() { return OA.segVal(el.dir) === 'decode' ? 'decode' : 'encode'; }

  function save() {
    OA.store.set('morse', {
      text: el.input.value, dir: direction(), wpm: Number(el.wpm.value), hz: Number(el.hz.value),
      loop: el.loop.checked, flashTone: el.flashTone.checked, script: OA.segVal(el.script)
    });
  }

  /** Ergebnis anzeigen; die Eingabe des Nutzers darf nie übersetzt werden. */
  function setOut(text) { el.out.innerHTML = text ? '<span data-notranslate dir="auto">' + OA.esc(text) + '</span>' : ''; }

  /* ---------- Umwandlung anzeigen ---------- */
  function update() {
    var dec = direction() === 'decode', r, note = '';
    el.inLabel.textContent = OA.t(dec ? 'Morsezeichen (Punkt und Strich)' : 'Text');
    el.outLabel.textContent = OA.t(dec ? 'Text' : 'Morsezeichen');
    el.input.setAttribute('placeholder', OA.t(dec ? '... --- ...   (Leerzeichen zwischen Zeichen, / zwischen Wörtern)' : 'Hier Text eingeben, z. B. SOS'));
    el.input.setAttribute('dir', 'auto');
    el.input.setAttribute('inputmode', 'text');
    if (dec) {
      r = decode(el.input.value, scriptVal());
      setOut(r.text);
      if (r.bad) note = OA.t('{0} Zeichen nicht erkannt (mit ? markiert).', [r.bad]);
    } else {
      r = encode(el.input.value);
      setOut(pretty(r.morse));
      if (r.unknown.length) note = OA.t('Nicht übersetzbar und übersprungen: {0}', [r.unknown.join(' ')]);
      if (r.words.length === 1 && r.words[0].codes[0] === SOS_RUN) note = OA.t('SOS wird als Notzeichen ohne Pausen zwischen den Buchstaben gesendet.');
    }
    el.out.classList.toggle('empty', !el.out.textContent);
    el.out.setAttribute('data-empty', OA.t('Hier erscheint die Übersetzung'));
    el.note.textContent = note;
    model.words = r.words;
    var tl = buildTimeline(model.words, unitMs());
    el.time.textContent = tl.total ? OA.t('Dauer: {0} Sekunden', [OA.fmt(tl.total / 1000, 1)]) : OA.t('Noch nichts zum Senden.');
    el.tone.disabled = el.flash.disabled = !tl.total;
    el.wpmVal.textContent = OA.t('{0} WPM', [el.wpm.value]);
    el.hzVal.textContent = OA.t('{0} Hz', [el.hz.value]);
    save();
  }

  /* ---------- Wiedergabe ---------- */
  var run = null;                  // laufende Wiedergabe

  function setSignal(on) {
    el.lamp.classList.toggle('on', on);
    if (run && run.surface) run.surface.style.background = on ? '#fff' : '#000';
  }

  function scheduleAudio(c, tl, startAt, freq) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0;
    o.connect(g); g.connect(c.destination);
    tl.segs.forEach(function (s) {
      if (!s.on) return;
      var a = startAt + s.start / 1000, b = startAt + s.end / 1000;
      g.gain.setValueAtTime(0, a);
      g.gain.linearRampToValueAtTime(0.3, a + 0.005);   // weiche Flanken: kein Knacken
      g.gain.setValueAtTime(0.3, b - 0.005);
      g.gain.linearRampToValueAtTime(0, b);
    });
    o.start(startAt);
    o.stop(startAt + tl.total / 1000 + 0.2);
    return { o: o, g: g };
  }

  function stop() {
    if (!run) return;
    var r = run; run = null;
    clearTimeout(r.timer);
    r.nodes.forEach(function (n) {
      try { n.g.gain.cancelScheduledValues(0); n.g.gain.value = 0; n.o.stop(); n.o.disconnect(); n.g.disconnect(); } catch (e) { /* schon beendet */ }
    });
    if (r.surface) { r.surface.remove(); document.removeEventListener('keydown', r.onKey); }
    el.lamp.classList.remove('on');
    el.stop.disabled = true;
    OA.wake(false);
    if (OA.store.get('wake', false)) OA.wake(true);   // globale Einstellung „Bildschirm anlassen“ beibehalten
  }

  function start(withLight) {
    stop();
    var tl = buildTimeline(model.words, unitMs());
    if (!tl.total) return;
    var withTone = withLight ? el.flashTone.checked : true;
    var c = withTone ? OA.audio() : null;
    var lead = 0.08;                                   // kleiner Vorlauf, damit Ton und Licht gleichzeitig starten
    var round = tl.total + 7 * unitMs();               // bei Wiederholung: Wortabstand zwischen den Durchläufen
    var freq = Number(el.hz.value);
    run = { nodes: [], rounds: 0, surface: null, timer: 0 };

    if (withLight) {
      var s = document.createElement('div');
      s.className = 'fullscreen-surface morse-flash';
      s.style.background = '#000';
      s.setAttribute('role', 'button');
      s.setAttribute('aria-label', OA.t('Blinker beenden – tippen'));
      s.innerHTML = '<span class="flash-hint">' + OA.esc(OA.t('Zum Beenden tippen oder Esc drücken')) + '</span>';
      s.addEventListener('click', stop);
      document.body.appendChild(s);
      run.surface = s;
      run.onKey = function (e) { if (e.key === 'Escape') stop(); };
      document.addEventListener('keydown', run.onKey);
    }
    el.stop.disabled = false;
    OA.wake(true);

    var t0 = performance.now() + lead * 1000, audioT0 = c ? c.currentTime + lead : 0;
    var me = run;

    function ensureAudio(upToRound) {
      if (!c) return;
      while (me.rounds <= upToRound) {
        me.nodes.push(scheduleAudio(c, tl, audioT0 + me.rounds * round / 1000, freq));
        me.rounds++;
        if (!el.loop.checked) break;
      }
    }
    ensureAudio(0);

    var last = null;
    (function tick() {
      if (run !== me) return;
      var elapsed = performance.now() - t0, on = false;
      if (elapsed >= 0) {
        var loop = el.loop.checked;
        if (!loop && elapsed >= tl.total) { stop(); return; }
        var pos = loop ? elapsed % round : elapsed;
        if (loop) ensureAudio(Math.floor(elapsed / round) + 1);   // nächsten Durchlauf rechtzeitig einplanen
        for (var i = 0; i < tl.segs.length; i++) {
          if (pos >= tl.segs[i].start && pos < tl.segs[i].end) { on = tl.segs[i].on; break; }
        }
      }
      if (on !== last) { last = on; setSignal(on); }
      me.timer = setTimeout(tick, 15);
    })();
  }

  /* ---------- Ereignisse ---------- */
  el.input.addEventListener('input', update);
  [el.wpm, el.hz].forEach(function (r) { r.addEventListener('input', update); });
  [el.loop, el.flashTone].forEach(function (c) { c.addEventListener('change', save); });

  el.script.addEventListener('input', update);
  el.dir.addEventListener('input', function () {
    // Beim Umschalten das bisherige Ergebnis als neue Eingabe übernehmen
    var dec = direction() === 'decode';
    var cur = dec ? encode(el.input.value).morse : decode(el.input.value, scriptVal()).text;
    el.input.value = dec ? cur.replace(/ \/ /g, '   ') : cur;
    update();
  });

  el.tone.addEventListener('click', function () { start(false); });
  el.flash.addEventListener('click', function () { start(true); });
  el.stop.addEventListener('click', stop);

  el.presets.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-text]'); if (!b) return;
    OA.segSet(el.dir, 'encode');
    var txt = b.getAttribute('data-text');
    // „HILFE“ in der gewählten Sprache (Morse kennt hier nur lateinische Buchstaben)
    if (txt === 'HILFE') txt = { en: 'HELP', es: 'AYUDA', ar: 'HELP' }[OA.lang] || txt;
    el.input.value = txt;
    update();
  });

  window.addEventListener('pagehide', stop);

  el.stop.disabled = true;
  update();
})();
