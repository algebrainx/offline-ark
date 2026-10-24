/* Offline-Ark – Ausdruck-Paket.
 * Setzt gewählte Teile (Karten, Wissensseiten, Listen) zu einem A4-Ausdruck zusammen:
 * Inhaltsverzeichnis, ein Teil je Seitenanfang, Kopf-/Fußzeile, schwarz auf weiß.
 * Die Texte werden je Teil in der Druck-Sprache gesetzt (T), nicht nur in der Anzeigesprache –
 * so lässt sich ein Teil zusätzlich auf Deutsch drucken. Wissensseiten kommen fertig
 * gesetzt aus data/print-pages.js (erzeugt von scripts/build.js). */
(function () {
  'use strict';
  var OA = window.OA, $ = OA.$, esc = OA.esc;
  var LOCALES = { de: 'de-DE', en: 'en-GB', es: 'es-ES', ar: 'ar-u-nu-latn' };
  /** Platz für den Inhalt je Seite in px: 297 mm minus Ränder (siehe @page), Kopf- und Fußzeile (je Sprache eine Zeile) */
  function pagePx(nLangs) { return (273 - 2 * (5 + 3.6 * nLangs)) * 96 / 25.4; }

  /* ---------- Übersetzen in eine beliebige Druck-Sprache ---------- */
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function T(l, de, args) {
    var e = l !== 'de' ? OA.i18n.dict[norm(de)] : null;
    var r = e && e[l] ? e[l] : de;
    return args ? r.replace(/\{(\d+)\}/g, function (m, i) { return args[i] == null ? m : args[i]; }) : r;
  }
  function num(l, n, d) { return n.toLocaleString(LOCALES[l], { maximumFractionDigits: d == null ? 0 : d }); }
  function dateLong(l) { return new Date().toLocaleDateString(LOCALES[l], { day: 'numeric', month: 'long', year: 'numeric' }).replace(/[\u200e\u200f]/g, ''); }
  function dateShort(l, iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString(LOCALES[l], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).replace(/[\u200e\u200f]/g, '');
  }
  function text(v) { return esc(v == null ? '' : String(v)).replace(/\n/g, '<br>'); }
  function arr(v) { return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : []; }

  /* ---------- Bausteine ---------- */
  /** Tabelle; blank = Anzahl leerer Zeilen zum Ausfüllen von Hand */
  function table(l, heads, rows, blank) {
    var out = '<table><thead><tr>' + heads.map(function (h) { return '<th>' + esc(T(l, h)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { out += '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; });
    for (var i = 0; i < blank; i++) out += '<tr class="pp-blank">' + heads.map(function () { return '<td></td>'; }).join('') + '</tr>';
    return out + '</tbody></table>';
  }

  /* ---------- Teil: Notruf-Karte ---------- */
  function renderNotruf(l) {
    var t = function (de) { return esc(T(l, de)); };
    var out = '<div class="nr-grid">' +
      '<div class="nr big"><b>112</b><span>' + t('Notruf: Feuerwehr und Rettungsdienst') + '</span></div>' +
      '<div class="nr"><b>110</b><span>' + t('Polizei') + '</span></div>' +
      '<div class="nr"><b>116 117</b><span>' + t('Ärztlicher Bereitschaftsdienst (nicht lebensbedrohlich)') + '</span></div>' +
      '<div class="nr" style="grid-column:1/-1"><span>' + t('Giftinformationszentrale (Nummer hier eintragen)') + '</span><span class="fill"></span></div>' +
      '</div><p>' + t('Bei Netzproblemen mehrfach versuchen, auch ohne Empfang im eigenen Netz.') + '</p>';
    out += '<h3>' + t('Die fünf W-Fragen am Telefon') + '</h3><ol class="nr-ask"><li>' +
      ['Wo ist der Notfallort?', 'Was ist passiert?', 'Wie viele Betroffene gibt es?', 'Welche Verletzungen oder Erkrankungen?', 'Warten auf Rückfragen – erst auflegen, wenn die Leitstelle es sagt.']
        .map(t).join('</li><li>') + '</li></ol>';
    var A = window.OA_ALPHA;
    if (A && A.length) {
      var main = A.filter(function (a) { return a[2]; }), extra = A.filter(function (a) { return !a[2]; });
      var half = Math.ceil(main.length / 2);
      var tbl = function (list) {
        return '<table><thead><tr><th></th><th>' + t('Deutsch') + '</th><th>' + t('International (NATO)') + '</th></tr></thead><tbody>' +
          list.map(function (a) { return '<tr><td>' + esc(a[0]) + '</td><td dir="ltr">' + esc(a[1]) + '</td><td dir="ltr">' + esc(a[2]) + '</td></tr>'; }).join('') + '</tbody></table>';
      };
      out += '<h3>' + t('Buchstabieren (Funkalphabet)') + '</h3><div class="al-wrap">' + tbl(main.slice(0, half)) + tbl(main.slice(half)) + '</div>' +
        '<p class="pp-small ltr" style="margin-top:2mm">' + extra.map(function (a) { return esc(a[0]) + ' = ' + esc(a[1]); }).join(' · ') + '</p>';
    }
    return out;
  }

  /* ---------- Teil: Morse-Tabelle ---------- */
  function renderMorse(l) {
    var M = window.OA_MORSE;
    if (!M) return '';
    var groups = M.GROUPS.slice();
    if (l === 'ar') groups.push(['Arabische Buchstaben', M.ARABIC]);
    var cell = function (c) { return '<span class="mo"><b>' + esc(c[0]) + '</b><i>' + M.pretty(c[1]) + '</i></span>'; };
    return '<div class="mo-sos"><b>SOS</b><i>• • • — — — • • •</i></div>' +
      '<p>' + esc(T(l, 'Notsignal: dreimal kurz, dreimal lang, dreimal kurz – mit Licht, Pfeife oder Klopfen. Dann kurz warten und wiederholen.')) + '</p>' +
      '<p class="pp-small">' + esc(T(l, 'Ein Strich ist so lang wie drei Punkte. Pause zwischen Zeichen: 1 Punkt, zwischen Buchstaben: 3 Punkte, zwischen Wörtern: 7 Punkte.')) + '</p>' +
      groups.map(function (g) { return '<h3>' + esc(T(l, g[0])) + '</h3><div class="mo-grid">' + g[1].map(cell).join('') + '</div>'; }).join('');
  }

  /* ---------- Teil: Kontakte & Treffpunkte (Nutzerdaten) ---------- */
  var TYPE_LABEL = { nah: 'Nah (z. B. Haus/Straße)', viertel: 'Im Viertel', aussen: 'Außerhalb der Stadt' };
  function renderKontakte(l) {
    var t = function (de) { return esc(T(l, de)); };
    var c = arr(OA.store.get('kontakte', []));
    c = c.filter(function (x) { return x.star; }).concat(c.filter(function (x) { return !x.star; }));
    var m = arr(OA.store.get('treffpunkte', []));
    var a = arr(OA.store.get('adressen', []));
    return '<h3>' + t('Kontakte') + '</h3>' +
      table(l, ['Name', 'Telefon', 'Beziehung', 'Hinweis'], c.map(function (x) {
        return [(x.star ? '★ ' : '') + text(x.name), '<span class="ltr">' + text(x.phone) + '</span>', text(x.rel), text(x.note)];
      }), Math.max(0, 7 - c.length)) +
      '<h3>' + t('Treffpunkte') + '</h3>' +
      table(l, ['Name', 'Ort', 'Koordinaten', 'Art', 'Hinweis'], m.map(function (x) {
        return [text(x.name), text(x.place), '<span class="ltr">' + text(x.coords) + '</span>', esc(T(l, TYPE_LABEL[x.type] || TYPE_LABEL.nah)), text(x.note)];
      }), Math.max(0, 3 - m.length)) +
      '<h3>' + t('Wichtige Adressen') + '</h3>' +
      table(l, ['Name', 'Art', 'Adresse', 'Telefon', 'Hinweis'], a.map(function (x) {
        return [text(x.name), esc(T(l, x.cat || 'Sonstiges')), text(x.address), '<span class="ltr">' + text(x.phone) + '</span>', text(x.note)];
      }), Math.max(0, 4 - a.length));
  }
  function hasKontakte() { return !!(arr(OA.store.get('kontakte', [])).length || arr(OA.store.get('treffpunkte', [])).length || arr(OA.store.get('adressen', [])).length); }

  /* ---------- Teil: Notfallpass (Nutzerdaten, defensiv gelesen) ---------- */
  function persons() {
    var raw = OA.store.get('notfallpass', null), list = [];
    if (Array.isArray(raw)) list = raw;
    else if (raw && typeof raw === 'object') list = Array.isArray(raw.persons) ? raw.persons : Array.isArray(raw.people) ? raw.people : Array.isArray(raw.items) ? raw.items : (raw.name ? [raw] : []);
    return arr(list).filter(function (p) {
      var any = ['name', 'allergies', 'conditions', 'meds', 'implants', 'gpName', 'note', 'langs'].some(function (k) { return typeof p[k] === 'string' && p[k].trim(); });
      return any || arr(p.contacts).some(function (c) { return typeof c.name === 'string' && c.name.trim(); });
    });
  }
  function renderPass(l) {
    var t = function (de) { return esc(T(l, de)); };
    return persons().map(function (p) {
      var rows = [], add = function (label, v) { if (v) rows.push('<tr><th>' + t(label) + '</th><td>' + v + '</td></tr>'); };
      var s = function (k) { return typeof p[k] === 'string' ? p[k].trim() : ''; };
      var abo = p.abo && p.abo !== '?' ? p.abo : '', rh = p.rh === '+' ? 'Rh+' : p.rh === '-' ? 'Rh−' : '';
      var blood = (abo || rh) ? '<span class="blood ltr">' + esc((abo || '?') + ' ' + (rh || 'Rh?')) + '</span>' : '';
      var yn = function (v, place) { return v === 'ja' || v === 'nein' ? esc(T(l, v === 'ja' ? 'Ja' : 'Nein')) + (place ? ' – ' + text(place) : '') : ''; };
      add('Blutgruppe', blood);
      add('Allergien', text(s('allergies')));
      add('Vorerkrankungen', text(s('conditions')));
      add('Medikamente', text(s('meds')));
      add('Implantate und Hilfsmittel', text(s('implants')));
      add('Letzte Tetanus-Impfung', esc(dateShort(l, s('tetanus'))));
      add('Organspende', yn(p.organ, s('organPlace')));
      add('Patientenverfügung', yn(p.pv, s('pvPlace')));
      add('Hausarzt', [text(s('gpName')), s('gpPhone') ? '<span class="ltr">' + text(s('gpPhone')) + '</span>' : ''].filter(Boolean).join(' · '));
      var cs = arr(p.contacts).filter(function (c) { return c.name || c.phone; }).map(function (c) {
        return text(c.name) + (c.rel ? ' (' + text(c.rel) + ')' : '') + (c.phone ? ' · <span class="ltr">' + text(c.phone) + '</span>' : '');
      });
      add('Notfallkontakte', cs.join('<br>'));
      add('Sprachen', text(s('langs')));
      add('Hinweise', text(s('note')));
      var born = dateShort(l, s('birth'));
      return '<div class="pp-pass"><div class="pp-pass-head"><b>' + (text(s('name')) || '–') + '</b><span>' + (born ? t('geboren') + ' ' + esc(born) : '') + '</span></div>' +
        '<table><tbody>' + rows.join('') + '</tbody></table></div>';
    }).join('');
  }

  /* ---------- Teile: Checklisten ---------- */
  function renderCheck(list) {
    return function (l) {
      return '<p>' + esc(T(l, list.intro)) + '</p><div class="pp-cols">' + list.sections.map(function (sec) {
        return '<div class="cl-sec"><h3>' + esc(T(l, sec.title)) + '</h3><ul class="cl">' + sec.items.map(function (it) {
          return '<li><span class="box"></span><span>' + esc(T(l, it.text)) + '</span></li>';
        }).join('') + '</ul></div>';
      }).join('') + '</div>';
    };
  }

  /* ---------- Teil: Notvorrat-Tabelle (1 Person, 10 Tage; Werte wie js/tool-notvorrat.js) ---------- */
  var KCAL_PER_DAY = 2200, WATER_PER_DAY = 2, COOK_WATER = 0.5, DAYS = 10;
  var FOOD = [
    ['Getreide, Reis, Nudeln, Brot', 0.40, 350], ['Gemüse und Hülsenfrüchte', 0.12, 90], ['Obst und Nüsse', 0.10, 150],
    ['Milch und Milchprodukte', 0.12, 100], ['Fisch, Fleisch, Ei', 0.12, 200], ['Fette und Öle', 0.14, 800]
  ];
  function renderVorrat(l) {
    var mass = function (g) { return g >= 1000 ? num(l, g / 1000, 1) + ' kg' : num(l, Math.round(g / 10) * 10) + ' g'; };
    var box = '<span class="box"></span>';
    var rows = [[esc(T(l, 'Wasser (davon {0} l zum Kochen)', [num(l, COOK_WATER * DAYS, 1)])), '<span class="ltr">' + num(l, WATER_PER_DAY * DAYS) + ' l</span>', '<span class="ltr">' + num(l, WATER_PER_DAY, 1) + ' l</span>', box]];
    var total = 0;
    FOOD.forEach(function (g) {
      var perDay = KCAL_PER_DAY * g[1] / g[2] * 100;      // Gramm je Person und Tag
      total += perDay * DAYS;
      rows.push([esc(T(l, g[0])), '<span class="ltr">' + mass(perDay * DAYS) + '</span>', '<span class="ltr">' + num(l, Math.round(perDay / 5) * 5) + ' g</span>', box]);
    });
    return '<p>' + esc(T(l, 'Richtwerte für 1 erwachsene Person und 10 Tage. Für mehr Personen entsprechend malnehmen.')) + '</p>' +
      table(l, ['Was', 'Menge für 10 Tage', 'Pro Tag', 'Vorhanden'], rows, 0) +
      '<p style="margin-top:3mm">' + esc(T(l, 'Insgesamt etwa {0} kcal und {1} Lebensmittel (haltbare Ware). Rechenbasis: {2} kcal pro Tag.', [num(l, KCAL_PER_DAY * DAYS), mass(total), num(l, KCAL_PER_DAY)])) + '</p>' +
      '<p class="pp-small">' + esc(T(l, 'Zusätzlich bedenken: Babynahrung, Haustierfutter, persönliche Medikamente, Hygieneartikel. Mehr Wasser bei Hitze, Anstrengung, Krankheit.')) + '</p>';
  }

  /* ---------- Teile zusammenstellen ---------- */
  var GROUPS = [
    { id: 'karten', title: 'Sofort-Karten' },
    { id: 'wissen', title: 'Wissensseiten' },
    { id: 'listen', title: 'Listen & Karten' }
  ];
  var PARTS = [];
  /** Fester deutscher Text, der in der jeweiligen Druck-Sprache ausgegeben wird. */
  function tx(s) { return function (l) { return T(l, s); }; }
  function addPart(p) { PARTS.push(p); }

  addPart({ id: 'notruf', group: 'karten', title: tx('Notruf-Karte'), sub: tx('Nummern, Fragen am Telefon, Funkalphabet'), render: renderNotruf });
  addPart({ id: 'notfallpass', group: 'karten', title: tx('Notfallpass'), sub: tx('Eine Karte pro Person'), render: renderPass,
    available: function () { return persons().length > 0 ? null : 'Noch leer – zuerst im Notfallpass ausfüllen'; } });
  addPart({ id: 'kontakte', group: 'karten', title: tx('Kontakte & Treffpunkte'), sub: function (l) { return T(l, hasKontakte() ? 'Deine Einträge' : 'Noch leer – Vordruck zum Ausfüllen von Hand'); }, render: renderKontakte });
  addPart({ id: 'morse', group: 'karten', title: tx('Morse-Tabelle'), sub: tx('SOS und alle Zeichen'), render: renderMorse });

  var wissen = window.OA_WISSEN || [], pp = window.OA_PRINT_PAGES || null;
  function ppEntry(id, l) { return pp && ((pp[l] && pp[l][id]) || (pp.de && pp.de[id])) || null; }
  wissen.forEach(function (w) {
    if (pp && !ppEntry(w.id, 'de')) return;     // Seite noch nicht geschrieben: nicht anbieten
    addPart({ id: 'wissen:' + w.id, group: 'wissen',
      title: function (l) { var e = ppEntry(w.id, l); return e ? e.title : T(l, w.title); },
      sub: function (l) { return T(l, w.sub); },
      render: function (l) { var e = ppEntry(w.id, l); return '<div class="pp-cols">' + (e ? e.html : '') + '</div>'; },
      available: function () { return ppEntry(w.id, 'de') ? null : 'Fehlt noch – bitte „node scripts/build.js“ ausführen'; } });
  });

  (window.OA_CHECKLISTEN || []).forEach(function (list) {
    addPart({ id: 'check:' + list.id, group: 'listen',
      title: function (l) { return T(l, 'Checkliste: {0}', [T(l, list.title)]); },
      sub: tx('Mit Kästchen zum Abhaken'), render: renderCheck(list) });
  });
  addPart({ id: 'notvorrat', group: 'listen', title: tx('Notvorrat-Tabelle'), sub: tx('1 Person, 10 Tage'), render: renderVorrat });

  var WICHTIG = ['wissen:erste-hilfe', 'wissen:stromausfall', 'wissen:wasser', 'notruf', 'check:notgepaeck', 'check:stromausfall', 'kontakte', 'notfallpass', 'morse', 'notvorrat'];

  var byId = {};
  PARTS.forEach(function (p) { byId[p.id] = p; });
  function note(p) { return p.available ? p.available() : null; }
  function usable(p) { return !note(p); }

  function partHtml(p, l) {
    return '<section class="pp-part" lang="' + l + '" dir="' + (l === 'ar' ? 'rtl' : 'ltr') + '" data-notranslate data-id="' + esc(p.id) + '">' +
      '<h2 class="pp-title">' + esc(p.title(l)) + '</h2>' + p.render(l) + '</section>';
  }

  /* ---------- Seitenzahl schätzen: Teil unsichtbar mit den Druckregeln setzen und messen ---------- */
  var measurer = document.createElement('div');
  measurer.className = 'pp-measure'; measurer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(measurer);
  var heightCache = {};
  function pagesOf(p, l) {
    var k = p.id + '|' + l;
    if (heightCache[k] == null) {
      measurer.innerHTML = partHtml(p, l);
      heightCache[k] = measurer.firstChild.offsetHeight;
      measurer.innerHTML = '';
    }
    return Math.max(1, Math.ceil(heightCache[k] * 1.05 / pagePx(langs().length)));
  }

  /* ---------- Zustand ---------- */
  var saved = OA.store.get('ausdruck', {}) || {};
  var state = {
    sel: Array.isArray(saved.sel) ? saved.sel.filter(function (id) { return byId[id]; }) : WICHTIG.filter(function (id) { return byId[id]; }),
    dual: saved.dual === true && OA.lang !== 'de',
    preview: saved.preview === true
  };
  function persist() { OA.store.set('ausdruck', { sel: state.sel, dual: state.dual, preview: state.preview }); }
  function chosen() { return PARTS.filter(function (p) { return state.sel.indexOf(p.id) !== -1 && usable(p); }); }
  function langs() { return state.dual && OA.lang !== 'de' ? [OA.lang, 'de'] : [OA.lang]; }

  /* ---------- Auswahl anzeigen ---------- */
  var measured = false;
  function pagesText(n) { return n === 1 ? OA.t('ca. 1 Seite') : OA.t('ca. {0} Seiten', [n]); }

  function drawGroups() {
    var html = '';
    GROUPS.forEach(function (g) {
      var items = PARTS.filter(function (p) { return p.group === g.id; });
      if (!items.length) return;
      html += '<h2 class="section-title">' + esc(OA.t(g.title)) + '</h2><section class="card group-card">' + items.map(function (p) {
        var n = note(p), checked = state.sel.indexOf(p.id) !== -1 && !n;
        var sub = n ? OA.t(n) : p.sub(OA.lang);
        return '<label class="pick' + (n ? ' off' : '') + '"><input type="checkbox" data-id="' + esc(p.id) + '"' + (checked ? ' checked' : '') + (n ? ' disabled' : '') + '>' +
          '<span class="t"><b>' + esc(p.title(OA.lang)) + '</b><small>' + esc(sub) + '</small></span>' +
          '<span class="chip" data-pg="' + esc(p.id) + '"></span></label>';
      }).join('') + '</section>';
    });
    $('#groups').innerHTML = html;
  }

  function drawPages() {
    if (!measured) return;
    OA.$$('[data-pg]').forEach(function (c) {
      var p = byId[c.getAttribute('data-pg')];
      c.textContent = usable(p) ? pagesText(pagesOf(p, OA.lang)) : '';
    });
  }

  function totalPages() {
    var sel = chosen(), n = 0;
    langs().forEach(function (l) {
      if (sel.length > 1) n++;
      sel.forEach(function (p) { n += pagesOf(p, l); });
    });
    return n;
  }

  function refresh() {
    var sel = chosen();
    OA.$$('#groups input[data-id]').forEach(function (cb) { cb.checked = state.sel.indexOf(cb.getAttribute('data-id')) !== -1 && usable(byId[cb.getAttribute('data-id')]); });
    var ids = sel.map(function (p) { return p.id; }).sort().join(',');
    var all = PARTS.filter(usable).map(function (p) { return p.id; }).sort().join(',');
    var wichtig = WICHTIG.filter(function (id) { return byId[id] && usable(byId[id]); }).sort().join(',');
    OA.segSet($('#presets'), ids === wichtig ? 'wichtig' : ids === all ? 'alles' : ids === '' ? 'nichts' : '');
    $('#sum').textContent = !sel.length ? OA.t('Nichts gewählt')
      : (sel.length === 1 ? OA.t('1 Teil gewählt') : OA.t('{0} Teile gewählt', [sel.length])) + (measured ? ' · ' + pagesText(totalPages()) : '');
    $('#make').disabled = !sel.length;
    persist();
  }

  function setSel(ids) { state.sel = ids; refresh(); }

  $('#groups').addEventListener('change', function (e) {
    var cb = e.target.closest('input[data-id]');
    if (!cb) return;
    var id = cb.getAttribute('data-id'), i = state.sel.indexOf(id);
    if (cb.checked && i === -1) state.sel.push(id);
    if (!cb.checked && i !== -1) state.sel.splice(i, 1);
    refresh();
  });
  $('#presets').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var v = b.getAttribute('data-v');
    setSel(v === 'wichtig' ? WICHTIG.slice() : v === 'alles' ? PARTS.map(function (p) { return p.id; }) : []);
  });

  var dual = $('#dual'), previewOnly = $('#previewOnly');
  if (OA.lang !== 'de') $('#dualRow').hidden = false;
  dual.checked = state.dual; previewOnly.checked = state.preview;
  dual.addEventListener('change', function () { state.dual = dual.checked; if (state.dual) ensureMeasured('de'); refresh(); });
  previewOnly.addEventListener('change', function () { state.preview = previewOnly.checked; persist(); });

  /* ---------- Paket erstellen ---------- */
  function cover(sel, l) {
    var t = function (de, a) { return esc(T(l, de, a)); };
    var body = '', last = '';
    sel.forEach(function (p) {
      if (p.group !== last) { body += (last ? '</ol>' : '') + '<h3>' + t(GROUPS.filter(function (g) { return g.id === p.group; })[0].title) + '</h3><ol class="pp-toc">'; last = p.group; }
      body += '<li><b>' + esc(p.title(l)) + '</b><span>' + esc(p.sub(l)) + '</span></li>';
    });
    return '<section class="pp-part pp-cover" lang="' + l + '" dir="' + (l === 'ar' ? 'rtl' : 'ltr') + '" data-notranslate>' +
      '<div class="pp-brand">Offline-Ark</div><h1>' + t('Notfallwissen auf Papier') + '</h1><div class="pp-date">' + t('Stand: {0}', [dateLong(l)]) + '</div>' +
      '<h2>' + t('Inhalt') + '</h2>' + body + '</ol>' +
      '<div class="pp-hint">' + t('Bewahre diesen Ausdruck griffbereit auf, zum Beispiel beim Notgepäck.') + ' ' + t('Ersetzt keine Ausbildung. Im Notfall zuerst 112 anrufen.') + '</div></section>';
  }

  function build() {
    var sel = chosen(), ls = langs(), html = '';
    ls.forEach(function (l) {
      if (sel.length > 1) html += cover(sel, l);
      sel.forEach(function (p) { html += partHtml(p, l); });
    });
    $('#ppBody').innerHTML = html;
    var line = function (l, de, a) { return '<div lang="' + l + '" dir="' + (l === 'ar' ? 'rtl' : 'ltr') + '" data-notranslate>' + esc(T(l, de, a)) + '</div>'; };
    $('#ppHead').innerHTML = ls.map(function (l) { return line(l, 'Offline-Ark – Notfallwissen · Stand {0} · Notruf 112', [dateLong(l)]); }).join('');
    $('#ppFoot').innerHTML = ls.map(function (l) { return line(l, 'Offline-Ark – Notfallwissen ohne Internet. Ersetzt keine Ausbildung. Notruf 112.'); }).join('');
    $('#ppInfo').textContent = pagesText(totalPages());
  }

  function show(on) {
    document.body.classList.toggle('pp-on', on);
    $('#pp').hidden = !on;
    $('#picker').hidden = on;
    window.scrollTo(0, 0);
  }

  $('#make').addEventListener('click', function () {
    if (!chosen().length) return;
    build(); show(true);
    if (!state.preview) setTimeout(function () { window.print(); }, 200);
  });
  $('#printNow').addEventListener('click', function () { window.print(); });
  $('#back').addEventListener('click', function () { show(false); $('#ppBody').innerHTML = ''; });

  /* ---------- Start ---------- */
  function ensureMeasured(l) { PARTS.forEach(function (p) { if (usable(p)) pagesOf(p, l); }); }
  drawGroups();
  refresh();
  if (!pp) {
    var warn = document.createElement('div');
    warn.className = 'callout warn';
    warn.textContent = OA.t('Die Wissensseiten fehlen noch. Bitte „node scripts/build.js“ ausführen.');
    $('#picker').insertBefore(warn, $('#picker').firstChild);
  }
  setTimeout(function () {
    ensureMeasured(OA.lang);
    if (state.dual) ensureMeasured('de');
    measured = true;
    drawPages(); refresh();
  }, 30);
})();
