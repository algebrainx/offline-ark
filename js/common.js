/* Offline-Ark – gemeinsame Funktionen für ALLE Seiten.
 * - OA.store: localStorage mit try/catch (fällt auf Speicher im RAM zurück)
 * - OA.beep / OA.vibrate / OA.wake: Ton, Vibration, Bildschirm wachhalten
 * - Kopfleiste, Einstellungen und Fußzeile werden hier einmal definiert,
 *   damit jede Seite gleich aussieht und bedient wird.
 * Läuft ohne Internet und ohne fetch() – funktioniert direkt über file://. */
(function () {
  'use strict';
  var OA = window.OA = window.OA || {};
  OA.root = (document.body && document.body.getAttribute('data-root')) || '';

  // Optional: Service Worker für die Installation als App (nur über http/https, nie unter file://)
  if (/^https?:$/.test(location.protocol)) {
    var pw = document.createElement('script'); pw.src = OA.root + 'js/pwa.js'; document.head.appendChild(pw);
  }

  /* ---------- Speicher ---------- */
  var mem = {};          // Notlösung, falls localStorage gesperrt ist
  var PREFIX = 'oa.';
  OA.store = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem(PREFIX + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback;
      }
    },
    set: function (key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) { mem[key] = value; return false; }
    },
    remove: function (key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignorieren */ }
      delete mem[key];
    },
    /** Alle Offline-Ark-Daten als Objekt (für Export). */
    all: function () {
      var out = {};
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
        }
      } catch (e) { /* ignorieren */ }
      return out;
    }
  };

  /* ---------- Hilfsfunktionen ---------- */
  OA.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  /** Zahl aus Eingabe lesen; akzeptiert Komma und Punkt. NaN bei leerer/ungültiger Eingabe. */
  OA.num = function (v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).trim().replace(/\s/g, '')
      // arabisch-indische Ziffern (٠-٩, ۰-۹) und arabisches Komma/Minus zulassen
      .replace(/[\u0660-\u0669]/g, function (c) { return c.charCodeAt(0) - 0x0660; })
      .replace(/[\u06F0-\u06F9]/g, function (c) { return c.charCodeAt(0) - 0x06F0; })
      .replace(/[\u066B\u060C]/g, '.').replace(/\u2212/g, '-').replace(',', '.');
    return s === '' ? NaN : Number(s);
  };
  /** Zahl deutsch formatieren (Komma, Tausenderpunkt). */
  OA.fmt = function (n, digits) {
    if (!isFinite(n)) return '–';
    var d = digits == null ? 2 : digits;
    return n.toLocaleString(OA.locale || 'de-DE', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  };
  OA.pad = function (n, len) { n = String(n); while (n.length < (len || 2)) n = '0' + n; return n; };
  OA.$ = function (sel, el) { return (el || document).querySelector(sel); };
  OA.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  OA.today = function () { var d = new Date(); return d.getFullYear() + '-' + OA.pad(d.getMonth() + 1) + '-' + OA.pad(d.getDate()); };

  /** Datei erzeugen und herunterladen (Export) – ohne Server. */
  OA.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  /** Textdatei vom Gerät lesen (Import). cb(text) */
  OA.pickFile = function (accept, cb) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept || '.json,application/json';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var r = new FileReader(); r.onload = function () { cb(String(r.result)); }; r.readAsText(f);
    };
    inp.click();
  };

  /* ---------- Ton, Vibration, Wachhalten ---------- */
  var ctx = null;
  OA.audio = function () {
    if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  /** Einen Ton abspielen. Gibt Stopp-Funktion zurück. */
  OA.beep = function (freq, ms, vol) {
    var c = OA.audio(); if (!c) return function () {};
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq || 800;
    g.gain.value = vol == null ? 0.25 : vol;
    o.connect(g); g.connect(c.destination); o.start();
    var stop = function () { try { o.stop(); o.disconnect(); g.disconnect(); } catch (e) { /* schon gestoppt */ } };
    if (ms) setTimeout(stop, ms);
    return stop;
  };
  OA.vibrate = function (pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* nicht unterstützt */ } };

  var wakeLock = null;
  OA.wake = function (on) {
    try {
      if (on && navigator.wakeLock) {
        navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
      } else if (wakeLock) { wakeLock.release(); wakeLock = null; }
    } catch (e) { /* nicht unterstützt */ }
  };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && OA.store.get('wake', false)) OA.wake(true);
  });

  /* ---------- Wiederverwendbare Bedienelemente ---------- */
  /* Zähler:  <div class="stepper" data-min="1" data-max="99" data-step="1">
   *            <button type="button">−</button><input type="number"><button type="button">+</button></div>
   * Segment: <div class="seg" data-local> <button data-v="a">A</button> … </div>
   *          liefert OA.segVal(el) und löst bei Änderung ein "input"-Ereignis auf dem Segment aus. */
  OA.segVal = function (el) { var b = el.querySelector('button[aria-pressed="true"]'); return b ? b.getAttribute('data-v') : null; };
  OA.segSet = function (el, v) {
    OA.$$('button', el).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === String(v) ? 'true' : 'false'); });
  };
  function initControls() {
    OA.$$('.stepper').forEach(function (st) {
      var inp = st.querySelector('input'), btns = st.querySelectorAll('button');
      var min = st.hasAttribute('data-min') ? Number(st.getAttribute('data-min')) : 0;
      var max = st.hasAttribute('data-max') ? Number(st.getAttribute('data-max')) : 9999;
      var step = Number(st.getAttribute('data-step') || 1);
      function bump(d) {
        var v = OA.num(inp.value); if (isNaN(v)) v = min;
        v = Math.min(max, Math.max(min, Math.round((v + d) * 1000) / 1000));
        inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      btns[0].addEventListener('click', function () { bump(-step); });
      btns[1].addEventListener('click', function () { bump(step); });
    });
    OA.$$('.seg[data-local]').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        OA.segSet(g, b.getAttribute('data-v'));
        g.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initControls); else initControls();

  /* ---------- Kopfleiste, Einstellungen, Fußzeile ---------- */
  function seg(name, options, current) {
    return '<div class="seg" data-seg="' + name + '" role="group">' + options.map(function (o) {
      return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (o[0] === current ? 'true' : 'false') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function buildChrome() {
    var r = OA.root;
    var isHome = document.body.getAttribute('data-page') === 'home';

    var bar = document.createElement('header');
    bar.className = 'appbar no-print';
    bar.innerHTML =
      '<div class="container">' +
        '<a class="brand" href="' + r + 'index.html" aria-label="Zur Startseite">' + (isHome ? OA.icon('ark') : OA.icon('back', 'flip')) + '<span>Offline-Ark</span></a>' +
        '<div class="appbar-actions">' +
          '<button class="iconbtn" type="button" id="oa-lang-btn" aria-label="Sprache / Language" aria-haspopup="dialog" aria-expanded="false">' + OA.icon('globe') + '</button>' +
          '<a class="iconbtn" href="' + r + 'index.html#suche" aria-label="Suche">' + OA.icon('search') + '</a>' +
          '<button class="iconbtn" type="button" id="oa-settings-btn" aria-label="Einstellungen" aria-haspopup="dialog" aria-expanded="false">' + OA.icon('settings') + '</button>' +
        '</div>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);

    var theme = OA.store.get('theme', 'auto'), fs = OA.store.get('fontsize', 'normal');
    var backdrop = document.createElement('div'); backdrop.className = 'sheet-backdrop';
    var sheet = document.createElement('div'); sheet.className = 'sheet no-print';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Einstellungen');
    sheet.innerHTML =
      '<section><h3>Darstellung</h3>' + seg('theme', [['auto', 'Auto'], ['light', 'Hell'], ['dark', 'Dunkel'], ['night', 'Nacht']], theme) +
      '<p class="small muted" style="margin:8px 2px 0">Nacht: rot auf schwarz, schont Augen und Akku.</p></section>' +
      '<section><h3>Schriftgröße</h3>' + seg('fontsize', [['normal', 'Normal'], ['large', 'Groß'], ['xlarge', 'Sehr groß']], fs) + '</section>' +
      '<section><div class="switch-row"><span>Bildschirm anlassen</span><label class="switch"><input type="checkbox" id="oa-wake"' + (OA.store.get('wake', false) ? ' checked' : '') + '><span></span></label></div>' +
      '<button class="sheet-link" type="button" id="oa-print">' + OA.icon('print') + 'Seite drucken</button></section>' +
      '<section><h3>Meine Daten</h3>' +
      '<button class="sheet-link" type="button" id="oa-export">' + OA.icon('download') + 'Alle Daten sichern</button>' +
      '<button class="sheet-link" type="button" id="oa-import">' + OA.icon('upload') + 'Daten wiederherstellen</button></section>' +
      '<section><h3>Mehr</h3>' +
      '<a class="sheet-link" href="' + OA.genUrl('bibliothek/index.html') + '">' + OA.icon('book') + 'Bibliothek (PDFs)</a>' +
      '<a class="sheet-link" href="' + OA.genUrl('wissen/quellen.html') + '">' + OA.icon('info') + 'Quellen &amp; Lizenzen</a></section>';

    // Sprachwahl: eigenes kleines Menü, Namen immer in der jeweiligen Sprache (auch ohne Deutsch lesbar)
    var langSheet = document.createElement('div'); langSheet.className = 'sheet langsheet no-print';
    langSheet.setAttribute('role', 'dialog'); langSheet.setAttribute('aria-label', 'Sprache / Language');
    langSheet.innerHTML = OA.LANGS.map(function (l) {
      return '<button class="sheet-link" type="button" data-lang="' + l + '" lang="' + l + '" data-notranslate' + (l === OA.lang ? ' aria-current="true"' : '') + '>' +
        '<span>' + OA.langNames[l] + '</span>' + (l === OA.lang ? OA.icon('check') : '') + '</button>';
    }).join('');
    document.body.appendChild(backdrop); document.body.appendChild(sheet); document.body.appendChild(langSheet);

    var btn = document.getElementById('oa-settings-btn'), langBtn = document.getElementById('oa-lang-btn');
    function toggle(open, which) {
      var target = which || sheet;
      [sheet, langSheet].forEach(function (s) { s.classList.toggle('open', open && s === target); });
      backdrop.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open && target === sheet ? 'true' : 'false');
      langBtn.setAttribute('aria-expanded', open && target === langSheet ? 'true' : 'false');
    }
    btn.addEventListener('click', function () { toggle(!sheet.classList.contains('open'), sheet); });
    langBtn.addEventListener('click', function () { toggle(!langSheet.classList.contains('open'), langSheet); });
    backdrop.addEventListener('click', function () { toggle(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
    langSheet.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lang]'); if (b) OA.setLang(b.getAttribute('data-lang'));
    });

    OA.$$('[data-seg]', sheet).forEach(function (group) {
      group.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        OA.store.set(group.getAttribute('data-seg'), b.getAttribute('data-v'));
        OA.$$('button', group).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (window.OA_applyTheme) window.OA_applyTheme();
      });
    });
    document.getElementById('oa-wake').addEventListener('change', function (e) { OA.store.set('wake', e.target.checked); OA.wake(e.target.checked); });
    if (OA.store.get('wake', false)) OA.wake(true);
    document.getElementById('oa-print').addEventListener('click', function () { toggle(false); window.print(); });
    document.getElementById('oa-export').addEventListener('click', function () {
      OA.download('offline-ark-daten-' + OA.today() + '.json', JSON.stringify({ app: 'offline-ark', version: 1, data: OA.store.all() }, null, 2));
    });
    document.getElementById('oa-import').addEventListener('click', function () {
      OA.pickFile('.json,application/json', function (text) {
        try {
          var obj = JSON.parse(text);
          if (!obj || obj.app !== 'offline-ark' || !obj.data) throw new Error('Format');
          Object.keys(obj.data).forEach(function (k) { OA.store.set(k, obj.data[k]); });
          alert(OA.t('Daten wiederhergestellt. Die Seite wird neu geladen.'));
          location.reload();
        } catch (e) { alert(OA.t('Diese Datei ist keine gültige Offline-Ark-Sicherung.')); }
      });
    });

    var foot = document.createElement('footer');
    foot.className = 'footer no-print';
    foot.innerHTML =
      '<div class="container"><span>Offline-Ark · läuft komplett ohne Internet</span>' +
      '<nav><a href="' + OA.genUrl('wissen/quellen.html') + '">Quellen &amp; Lizenzen</a><a href="' + OA.genUrl('bibliothek/index.html') + '">Bibliothek</a></nav></div>';
    document.body.appendChild(foot);

    // Druckfuß: zeigt auf Papier, woher die Seite stammt
    var pf = document.createElement('p');
    pf.className = 'print-only small'; pf.textContent = OA.t('Offline-Ark – Notfallwissen ohne Internet. Ersetzt keine Ausbildung. Notruf 112.');
    document.body.appendChild(pf);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildChrome); else buildChrome();
})();
