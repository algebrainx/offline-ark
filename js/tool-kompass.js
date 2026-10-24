/* Offline-Ark – Kompass über den Orientierungssensor des Geräts.
 * Android/Chrome: "deviceorientationabsolute"; iPhone: webkitCompassHeading (Erlaubnis per Klick).
 * Läuft komplett lokal, ohne Netz. */
(function () {
  'use strict';

  var DIRS = [['N', 'Norden'], ['NO', 'Nordosten'], ['O', 'Osten'], ['SO', 'Südosten'],
              ['S', 'Süden'], ['SW', 'Südwesten'], ['W', 'Westen'], ['NW', 'Nordwesten']];

  function norm(d) { return ((d % 360) + 360) % 360; }
  function dirIndex(deg) { return Math.round(norm(deg) / 45) % 8; }
  /** Himmelsrichtung (8 Sektoren, deutsch) für eine Gradzahl: [Kürzel, Name]. */
  function dirName(deg) { return DIRS[dirIndex(deg)]; }

  /* Kürzel je Sprache (gleiche Reihenfolge wie DIRS); Arabisch zeigt nur den ausgeschriebenen Namen */
  var SHORT = {
    de: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
    en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    es: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
    ar: ['', '', '', '', '', '', '', '']
  };
  var ROSE = { de: ['N', 'O', 'S', 'W'], en: ['N', 'E', 'S', 'W'], es: ['N', 'E', 'S', 'O'], ar: ['ش', 'ق', 'ج', 'غ'] };

  /* Kompasskurs aus Alpha/Beta/Gamma. Liegt das Gerät eher flach, zeigt die Oberkante des Geräts die Richtung;
   * steht es eher aufrecht, die Rückseite (Kamera). So bleibt die Anzeige in beiden Haltungen stabil. */
  function headingFromEuler(alpha, beta, gamma) {
    var r = Math.PI / 180;
    var a = alpha * r, b = beta * r, g = gamma * r;
    var flat = Math.cos(b) * Math.cos(g);                // Neigung der Bildschirmnormalen gegen die Senkrechte
    var east, north;
    if (Math.abs(flat) > 0.7) {
      east = -Math.sin(a) * Math.cos(b); north = Math.cos(a) * Math.cos(b);
    } else {                                              // Rückseite = Gegenrichtung der Geräte-z-Achse
      east = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
      north = -(Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g));
    }
    return norm(Math.atan2(east, north) / r);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { dirName: dirName, dirIndex: dirIndex, headingFromEuler: headingFromEuler, norm: norm };
  if (typeof document === 'undefined') return;

  var OA = window.OA;
  var el = {
    go: OA.$('#go'), deg: OA.$('#deg'), dir: OA.$('#dir'), name: OA.$('#dirName'),
    rose: OA.$('#rose'), ticks: OA.$('#ticks'), msg: OA.$('#msg')
  };

  // Skala einmalig zeichnen: Striche alle 10°, lange alle 30°, Buchstaben N/O/S/W
  (function drawScale() {
    var svg = '';
    for (var a = 0; a < 360; a += 10) {
      var major = a % 30 === 0;
      svg += '<line class="tick' + (major ? ' major' : '') + '" x1="120" y1="' + (major ? 20 : 24) + '" x2="120" y2="30" transform="rotate(' + a + ' 120 120)"/>';
    }
    var letters = ROSE[OA.lang] || ROSE.de;
    [[letters[0], 0, 'n'], [letters[1], 90, ''], [letters[2], 180, ''], [letters[3], 270, '']].forEach(function (l) {
      var rad = l[1] * Math.PI / 180, x = 120 + 76 * Math.sin(rad), y = 120 - 76 * Math.cos(rad);
      svg += '<text data-notranslate class="' + l[2] + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" transform="rotate(' + l[1] + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')">' + l[0] + '</text>';
    });
    el.ticks.innerHTML = svg;
  })();

  var active = false, gotAbs = false, smooth = null, raf = 0, timeout = 0, accuracy = null;

  function showMsg(text) { el.msg.hidden = !text; if (text) el.msg.innerHTML = '<strong>' + OA.esc(OA.t('Hinweis')) + '</strong>' + text; }
  function para(key) { return '<p style="margin:2px 0 0">' + OA.esc(OA.t(key)) + '</p>'; }

  function screenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    return typeof window.orientation === 'number' ? window.orientation : 0;
  }

  function render() {
    raf = 0;
    if (smooth === null) return;
    el.rose.setAttribute('transform', 'rotate(' + (-smooth).toFixed(1) + ' 120 120)');
    var d = Math.round(smooth) % 360, i = dirIndex(smooth), short = (SHORT[OA.lang] || SHORT.de)[i];
    el.deg.textContent = d;
    el.dir.textContent = short ? '° ' + short : '°';
    el.name.textContent = OA.t(DIRS[i][1]) + (accuracy !== null && (accuracy < 0 || accuracy > 25) ? ' ' + OA.t('· ungenau – bitte kalibrieren (Acht schwenken)') : '');
  }

  function onHeading(h, acc) {
    clearTimeout(timeout);
    showMsg('');
    accuracy = typeof acc === 'number' && !isNaN(acc) ? acc : null;
    h = norm(h + screenAngle());
    if (smooth === null) smooth = h;
    else smooth = norm(smooth + (((h - smooth + 540) % 360) - 180) * 0.25);   // glätten, ohne bei 0°/360° zu springen
    if (!raf) raf = requestAnimationFrame(render);
  }

  function onAbs(e) {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    gotAbs = true;
    onHeading(headingFromEuler(e.alpha, e.beta, e.gamma));
  }
  function onOri(e) {
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      onHeading(e.webkitCompassHeading, e.webkitCompassAccuracy);
    } else if (!gotAbs && e.absolute === true && e.alpha != null && e.beta != null && e.gamma != null) {
      onHeading(headingFromEuler(e.alpha, e.beta, e.gamma));
    }
  }

  function listen() {
    window.addEventListener('deviceorientationabsolute', onAbs, true);
    window.addEventListener('deviceorientation', onOri, true);
    active = true;
    el.go.textContent = OA.t('Kompass stoppen');
    el.go.classList.remove('primary');
    el.name.textContent = OA.t('Warte auf Sensor …');
    // Kommt nach einigen Sekunden nichts an, gibt es keinen Sensor (z. B. Laptop)
    timeout = setTimeout(function () {
      stop();
      showMsg(para('Auf diesem Gerät kommen keine Kompassdaten an. Das ist z. B. bei Laptops und PCs normal. Manche Browser sperren den Sensor bei lokalen Dateien oder fragen nach einer Erlaubnis. Nutze am Handy einen anderen Browser oder die Anleitungen ohne Kompass unten.'));
      el.name.textContent = OA.t('Kein Sensor verfügbar.');
    }, 3500);
  }

  function stop() {
    window.removeEventListener('deviceorientationabsolute', onAbs, true);
    window.removeEventListener('deviceorientation', onOri, true);
    clearTimeout(timeout);
    active = false; gotAbs = false;
    el.go.textContent = OA.t('Kompass starten');
    el.go.classList.add('primary');
  }

  el.go.addEventListener('click', function () {
    if (active) { stop(); el.name.textContent = OA.t('Kompass gestoppt.'); return; }
    showMsg('');
    smooth = null;
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      showMsg(para('Dieser Browser unterstützt keine Orientierungssensoren. Nutze die Anleitungen ohne Kompass unten.'));
      el.name.textContent = OA.t('Kein Sensor verfügbar.');
      return;
    }
    var DOE = window.DeviceOrientationEvent;
    if (typeof DOE.requestPermission === 'function') {      // iPhone/iPad: Erlaubnis nötig, nur per Klick
      DOE.requestPermission().then(function (state) {
        if (state === 'granted') listen();
        else {
          showMsg(para('Zugriff auf Bewegungssensoren wurde abgelehnt. In den Browser-Einstellungen „Bewegung und Ausrichtung“ erlauben, dann die Seite neu laden.'));
          el.name.textContent = OA.t('Zugriff abgelehnt.');
        }
      }).catch(function () {
        showMsg(para('Der Sensor konnte nicht freigeschaltet werden. Seite neu laden und erneut versuchen.'));
      });
    } else {
      listen();
    }
  });
})();
