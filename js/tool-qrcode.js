/* Offline-Ark – QR-Code-Werkzeug.
 * Berechnet QR-Codes lokal mit js/qr-encoder.js (kein Netz, keine Bibliothek).
 * Gespeichert werden nur Vorlage und Fehlerkorrektur – nie Texte, Passwörter oder Gesundheitsdaten. */
(function () {
  'use strict';
  var OA = window.OA, Q = window.OA_QR, t = OA.t, $ = OA.$;

  var el = {
    tpl: $('#tpl'), ec: $('#ec'), ecNote: $('#ec-note'), box: $('#qr-box'), info: $('#qr-info'), warn: $('#qr-warn'),
    png: $('#dl-png'), svg: $('#dl-svg'), print: $('#qr-print'),
    wpWrap: $('#wp-wrap'), wpPick: $('#wp-pick'), ctWrap: $('#ct-wrap'), ctPick: $('#ct-pick'),
    lat: $('#f-lat'), lon: $('#f-lon')
  };
  var EC_TEXT = {
    L: 'Niedrig: stellt bis zu 7 % wieder her. Kleinster Code.',
    M: 'Mittel: stellt bis zu 15 % wieder her. Gute Standardwahl.',
    Q: 'Hoch: stellt bis zu 25 % wieder her.',
    H: 'Sehr hoch: stellt bis zu 30 % wieder her. Größter Code.'
  };
  var current = null;   // letzter erfolgreich erzeugter Code

  /* ---------- Inhalte je Vorlage ---------- */
  function val(id) { return ($('#' + id).value || '').trim(); }

  function vEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  function wEsc(s) { return String(s).replace(/([\\;,:"])/g, '\\$1'); }
  function phoneClean(p) { var c = String(p || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, ''); return /\d/.test(c) ? c : ''; }
  function coord(s) { var n = OA.num(s); return isFinite(n) ? n : NaN; }
  function r5(n) { return (Math.round(n * 1e5) / 1e5).toFixed(5); }

  var BUILD = {
    text: function () { return { text: $('#f-text').value }; },
    note: function () {
      var title = val('n-title'), body = $('#n-text').value.trim();
      return { text: title && body ? title + '\n\n' + body : title || body };
    },
    geo: function () {
      var a = val('f-lat'), o = val('f-lon');
      if (!a && !o) return { text: '' };
      var lat = coord(a), lon = coord(o);
      if (!isFinite(lat) || !isFinite(lon)) return { error: t('Bitte beide Werte als Zahl eingeben, z. B. 48.83100 und 9.31600.') };
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: t('Breitengrad: −90 bis 90, Längengrad: −180 bis 180.') };
      return { text: 'geo:' + r5(lat) + ',' + r5(lon) };
    },
    vcard: function () {
      var name = val('f-name'), phone = phoneClean(val('f-phone')), mail = val('f-mail');
      if (!name && !phone && !mail) return { text: '' };
      if (!name) return { error: t('Bitte einen Namen eingeben.') };
      var parts = name.split(/\s+/), family = parts.length > 1 ? parts.pop() : '', given = parts.join(' ');
      var lines = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + vEsc(family) + ';' + vEsc(given) + ';;;', 'FN:' + vEsc(name)];
      if (phone) lines.push('TEL;TYPE=CELL:' + phone);
      if (mail) lines.push('EMAIL:' + vEsc(mail));
      lines.push('END:VCARD');
      return { text: lines.join('\r\n') };
    },
    tel: function () {
      var raw = val('f-tel');
      if (!raw) return { text: '' };
      var p = phoneClean(raw);
      return p ? { text: 'tel:' + p } : { error: t('Bitte eine gültige Telefonnummer eingeben.') };
    },
    wifi: function () {
      var ssid = val('f-ssid'), pw = $('#f-wpw').value, sec = OA.segVal($('#f-wsec')) || 'WPA';
      if (!ssid && !pw) return { text: '' };
      if (!ssid) return { error: t('Bitte den Namen des WLANs eingeben.') };
      if (sec !== 'nopass' && !pw) return { error: t('Bitte das Passwort eingeben oder „Offen“ wählen.') };
      var s = 'WIFI:T:' + sec + ';S:' + wEsc(ssid) + ';';
      if (sec !== 'nopass') s += 'P:' + wEsc(pw) + ';';
      if ($('#f-whid').checked) s += 'H:true;';
      return { text: s + ';' };
    },
    pass: function () {
      var rows = [['Name', 'p-name'], ['Geburtsdatum', 'p-birth'], ['Blutgruppe', 'p-blood'], ['Allergien', 'p-allergy'],
        ['Medikamente', 'p-meds'], ['Vorerkrankungen', 'p-ill'], ['Notfallkontakt', 'p-contact']], out = [];
      rows.forEach(function (r) { var v = val(r[1]); if (v) out.push(r[0] + ': ' + v); });
      return { text: out.length ? 'NOTFALLPASS\n' + out.join('\n') : '' };
    }
  };

  /* ---------- Anzeige ---------- */
  function showEmpty(msg) {
    current = null;
    el.box.innerHTML = '<div class="qr-empty">' + OA.esc(msg) + '</div>';
    el.info.textContent = '';
    [el.png, el.svg, el.print].forEach(function (b) { b.disabled = true; });
  }
  function showWarn(msg) { el.warn.hidden = !msg; el.warn.textContent = msg || ''; }

  function update() {
    var tpl = el.tpl.value, ec = OA.segVal(el.ec) || 'M';
    el.ecNote.textContent = t(EC_TEXT[ec]);
    OA.$$('.pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== tpl; });
    OA.store.set('qrcode', { tpl: tpl, ec: ec });

    var r = BUILD[tpl]();
    showWarn('');
    if (r.error) { showEmpty(t('Noch kein Code.')); showWarn(r.error); return; }
    if (!r.text) { showEmpty(t('Gib oben etwas ein – der Code erscheint sofort.')); return; }

    var a = Q.analyze(r.text, ec);
    if (a.version === null) {
      showEmpty(t('Zu lang für einen QR-Code.'));
      showWarn(t('Der Text ist zu lang: {0} {1}, möglich sind höchstens {2} bei dieser Fehlerkorrektur. Kürze den Text oder wähle eine niedrigere Fehlerkorrektur (L).',
        [OA.fmt(a.count, 0), a.mode === 'byte' ? t('Bytes') : t('Zeichen'), OA.fmt(a.maxCount, 0)]));
      return;
    }
    var qr = Q.encode(r.text, { ec: ec });
    current = { qr: qr, text: r.text };
    el.box.innerHTML = Q.toSvg(qr, { border: 4, attrs: 'role="img"' });
    var modes = { numeric: 'Ziffern', alnum: 'Großbuchstaben/Ziffern', byte: 'Text (UTF-8)' };
    el.info.innerHTML = OA.esc(t('Version {0} · {1} × {1} Module · {2}', [qr.version, qr.size, t(modes[qr.mode])])) +
      '<br>' + OA.esc(t('{0} von {1} Bytes belegt', [OA.fmt(qr.usedCodewords, 0), OA.fmt(qr.dataCodewords, 0)]));
    [el.png, el.svg, el.print].forEach(function (b) { b.disabled = false; });
    if (qr.version >= 10) showWarn(t('Der Code ist sehr dicht. Zeige oder drucke ihn groß und teste ihn mit einem zweiten Handy.'));
  }

  /* ---------- Gespeicherte Wegpunkte und Kontakte (nur lesen) ---------- */
  function fillPickers() {
    var wps = OA.store.get('wegpunkte', []);
    if (Array.isArray(wps) && wps.length) {
      el.wpWrap.hidden = false;
      el.wpPick.innerHTML = '<option data-notranslate value="">' + OA.esc(t('– Wegpunkt wählen –')) + '</option>' + wps.map(function (w, i) {
        return isFinite(w.lat) && isFinite(w.lon) ? '<option data-notranslate value="' + i + '">' + OA.esc(w.name || ('#' + (i + 1))) + '</option>' : '';
      }).join('');
      el.wpPick.addEventListener('change', function () {
        var w = wps[Number(el.wpPick.value)];
        if (w) { el.lat.value = r5(w.lat); el.lon.value = r5(w.lon); update(); }
      });
    }
    var cts = OA.store.get('kontakte', []);
    if (Array.isArray(cts) && cts.length) {
      el.ctWrap.hidden = false;
      el.ctPick.innerHTML = '<option data-notranslate value="">' + OA.esc(t('– Kontakt wählen –')) + '</option>' + cts.map(function (c, i) {
        return c && c.name ? '<option data-notranslate value="' + i + '">' + OA.esc(c.name) + '</option>' : '';
      }).join('');
      el.ctPick.addEventListener('change', function () {
        var c = cts[Number(el.ctPick.value)];
        if (c) { $('#f-name').value = c.name || ''; $('#f-phone').value = c.phone || ''; update(); }
      });
    }
  }

  /* ---------- Speichern ---------- */
  function fileBase() { return 'qr-code-' + OA.today(); }
  function saveBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  el.svg.addEventListener('click', function () {
    if (current) OA.download(fileBase() + '.svg', Q.toSvg(current.qr, { border: 4 }), 'image/svg+xml');
  });
  el.png.addEventListener('click', function () {
    if (!current) return;
    var scale = Math.max(4, Math.ceil(1024 / (current.qr.size + 8))), cv = document.createElement('canvas');
    Q.toCanvas(current.qr, cv, { border: 4, scale: scale });
    if (cv.toBlob) cv.toBlob(function (b) { if (b) saveBlob(b, fileBase() + '.png'); }, 'image/png');
  });
  el.print.addEventListener('click', function () { window.print(); });

  /* ---------- Scannen (nur wenn der Browser BarcodeDetector kann) ---------- */
  var scanner = { stream: null, timer: null, detector: null };
  var sv = $('#scan-video'), sMsg = $('#scan-msg');
  function msg(text) { sMsg.hidden = !text; sMsg.textContent = text || ''; }
  function stopScan() {
    if (scanner.timer) { clearInterval(scanner.timer); scanner.timer = null; }
    if (scanner.stream) { scanner.stream.getTracks().forEach(function (tr) { tr.stop(); }); scanner.stream = null; }
    sv.srcObject = null; sv.hidden = true;
    $('#scan-start').hidden = false; $('#scan-stop').hidden = true;
  }
  function startScan() {
    msg('');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
      scanner.stream = stream; sv.srcObject = stream; sv.hidden = false;
      $('#scan-start').hidden = true; $('#scan-stop').hidden = false;
      sv.play().catch(function () {});
      msg(t('Halte die Kamera ruhig auf den QR-Code.'));
      scanner.timer = setInterval(function () {
        if (sv.readyState < 2) return;
        scanner.detector.detect(sv).then(function (codes) {
          if (!codes.length) return;
          $('#scan-text').textContent = codes[0].rawValue;
          $('#scan-out').hidden = false;
          msg(t('Gelesen.'));
          OA.vibrate(60);
          stopScan();
        }).catch(function () {});
      }, 250);
    }).catch(function () { msg(t('Kein Zugriff auf die Kamera. Erlaube die Kamera in den Browser-Einstellungen oder nutze die Kamera-App deines Handys.')); });
  }
  function copyText(s, done) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = s; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;inset-inline-start:-9999px;top:0'; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(function () { done(true); }, fallback);
    else fallback();
  }
  if ('BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    var BD = window.BarcodeDetector, ready = BD.getSupportedFormats ? BD.getSupportedFormats() : Promise.resolve(['qr_code']);
    ready.then(function (f) {
      if (f.indexOf('qr_code') < 0) return;
      scanner.detector = new BD({ formats: ['qr_code'] });
      $('#scan-bar').hidden = false;
      $('#scan-hint').textContent = t('Richte die Kamera auf einen QR-Code. Der Inhalt wird als Text angezeigt; nichts wird geöffnet oder gesendet.');
    }).catch(function () {});
  }
  $('#scan-start').addEventListener('click', startScan);
  $('#scan-stop').addEventListener('click', function () { stopScan(); msg(''); });
  $('#scan-copy').addEventListener('click', function () {
    copyText($('#scan-text').textContent, function (ok) { msg(ok ? t('Kopiert.') : t('Kopieren nicht möglich. Markiere den Text und kopiere ihn von Hand.')); });
  });
  window.addEventListener('pagehide', stopScan);

  /* ---------- Start ---------- */
  var saved = OA.store.get('qrcode', null);
  if (saved && BUILD[saved.tpl]) el.tpl.value = saved.tpl;
  if (saved && Q.EC_LEVELS.indexOf(saved.ec) >= 0) OA.segSet(el.ec, saved.ec);
  fillPickers();
  var ev = ['input', 'change'];
  ev.forEach(function (e) {
    OA.$$('input, textarea, select, .seg[data-local]').forEach(function (n) {
      if (n.id !== 'wp-pick' && n.id !== 'ct-pick') n.addEventListener(e, update);
    });
  });
  update();
})();
