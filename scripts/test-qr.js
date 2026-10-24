/* Test des QR-Encoders: node scripts/test-qr.js
 * 1. Erzeugt viele Codes (alle Versionen 1–20 × L/M/Q/H, alle Masken, Texte in UTF-8/Arabisch, vCard, geo, WLAN …),
 * 2. schreibt sie als PNG in scripts/qr-tmp/ und lässt sie von Python dekodieren (zxing-cpp, zusätzlich OpenCV),
 * 3. vergleicht Byte für Byte mit dem Original und löscht die Test-Dateien wieder.
 * Voraussetzung für Schritt 2: python mit "pip install zxing-cpp opencv-python-headless numpy pillow".
 * Ohne Python laufen nur die Struktur-Tests (mit Hinweis). */
'use strict';
var fs = require('fs'), path = require('path'), zlib = require('zlib'), assert = require('assert'), cp = require('child_process');
var QR = require(path.join(__dirname, '..', 'js', 'qr-encoder.js'));
var tmp = path.join(__dirname, 'qr-tmp');

/* ---------- minimaler PNG-Schreiber (Graustufen, 8 Bit) ---------- */
var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { var c = 0xFFFFFFFF; for (var i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  var td = Buffer.concat([Buffer.from(type, 'ascii'), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(qr, scale, border) {
  var n = (qr.size + 2 * border) * scale, raw = Buffer.alloc((n + 1) * n, 255);
  for (var y = 0; y < n; y++) {
    raw[y * (n + 1)] = 0;
    for (var x = 0; x < n; x++) {
      var mx = Math.floor(x / scale) - border, my = Math.floor(y / scale) - border;
      if (mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.modules[my][mx]) raw[y * (n + 1) + 1 + x] = 0;
    }
  }
  var ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- Testfälle ---------- */
var cases = [];
function add(name, text, opts) { cases.push({ name: name, text: text, opts: opts || {} }); }

var long200 = 'Offline-Ark: Treffpunkt ist die alte Eiche am Spielplatz in der Hauptstraße. Wasser gibt es am Brunnen hinter der Kirche. Bitte Decken, Taschenlampen und Medikamente mitbringen. Wir warten bis 18 Uhr. Familie Müller, Tel. 0711 1234567.';
long200 = long200.slice(0, 200);
['L', 'M', 'Q', 'H'].forEach(function (ec) {
  add('kurz-' + ec, 'Hallo', { ec: ec });
  add('200-' + ec, long200, { ec: ec });
  add('utf8-' + ec, 'Grüße aus Köln – ÄÖÜ äöü ß € ñ é', { ec: ec });
  add('arabisch-' + ec, 'مرحبا بالعالم — نحن بخير، العنوان: شارع الحرية ٥', { ec: ec });
  add('vcard-' + ec, 'BEGIN:VCARD\nVERSION:3.0\nFN:Max Mustermann\nN:Mustermann;Max;;;\nTEL;TYPE=CELL:+491701234567\nEND:VCARD', { ec: ec });
  add('geo-' + ec, 'geo:48.83100,9.31600', { ec: ec });
  add('wlan-' + ec, 'WIFI:T:WPA;S:Mein Netz;P:geheim;;', { ec: ec });
});
add('emoji', 'Wir sind in Sicherheit 🙂👍', { ec: 'M' });
add('numerisch', '0123456789012345678901234567890123456789012', { ec: 'M' });
add('numerisch-lang', '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679', { ec: 'L' });
add('alnum', 'HTTPS://EXAMPLE.ORG/ABC-123 $%*+-./:', { ec: 'Q' });
add('url', 'https://www.bbk.bund.de/DE/Warnung-Vorsorge/warnung-vorsorge_node.html', { ec: 'M' });
for (var mk = 0; mk < 8; mk++) add('maske-' + mk, 'Maske ' + mk + ' – Offline-Ark Notfallpass: Blutgruppe 0 neg., Allergie Penicillin', { ec: 'Q', mask: mk });
// Jede Version an der Kapazitätsgrenze: erzwingt genau diese Version, prüft Blockaufteilung/Tabellen
var seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; }
['L', 'M', 'Q', 'H'].forEach(function (ec) {
  for (var v = 1; v <= 20; v++) {
    var n = QR.capacity('byte', v, ec), s = 'x';       // 'x' (klein) erzwingt den Byte-Modus
    while (s.length < n) s += String.fromCharCode(97 + rnd() % 26);
    add('v' + v + '-' + ec + '-voll', s.slice(0, n), { ec: ec, expectVersion: v });
    var shorter = n > 8 ? s.slice(0, Math.max(1, QR.capacity('byte', v - 1 || 1, ec) + 1)) : s;
    if (v > 1) add('v' + v + '-' + ec + '-min', shorter, { ec: ec, expectVersion: v });
  }
});

/* ---------- Struktur-Tests ---------- */
cases.forEach(function (c) {
  var qr = QR.encode(c.text, c.opts);
  c.qr = qr;
  if (c.opts.expectVersion) assert.strictEqual(qr.version, c.opts.expectVersion, c.name + ': Version');
  assert.strictEqual(qr.size, qr.version * 4 + 17);
  // Finder-Muster und Dunkelmodul
  assert.ok(qr.modules[3][3] && qr.modules[3][qr.size - 4] && qr.modules[qr.size - 4][3], c.name + ': Finder');
  assert.ok(qr.modules[qr.size - 8][8], c.name + ': Dunkelmodul');
  if (typeof c.opts.mask === 'number') assert.strictEqual(qr.mask, c.opts.mask);
});
assert.strictEqual(QR.encode('Hallo', { ec: 'M' }).version, 1);
assert.strictEqual(QR.analyze('12345', 'L').mode, 'numeric');
assert.strictEqual(QR.analyze('ABC 123', 'L').mode, 'alnum');
assert.strictEqual(QR.analyze('abc', 'L').mode, 'byte');
// Bekannte Kapazitäten (Tabelle ISO 18004): Version 1-L 17 Byte, 10-M 213, 20-H 382, 20-L 858
assert.strictEqual(QR.capacity('byte', 1, 'L'), 17);
assert.strictEqual(QR.capacity('byte', 10, 'M'), 213);
assert.strictEqual(QR.capacity('byte', 20, 'H'), 382);
assert.strictEqual(QR.capacity('byte', 20, 'L'), 858);
assert.strictEqual(QR.capacity('numeric', 1, 'L'), 41);
assert.strictEqual(QR.capacity('alnum', 1, 'L'), 25);
assert.throws(function () { QR.encode(new Array(900).join('a'), { ec: 'L' }); }, function (e) { return e.code === 'TOO_LONG'; });
var svg = QR.toSvg(QR.encode('Test'), { border: 4 });
assert.ok(/^<svg[^>]+viewBox="0 0 29 29"/.test(svg), 'SVG viewBox (21 + 2*4 Ruhezone)');
console.log('QR-Struktur: ' + cases.length + ' Fälle erzeugt, Tabellen und Grenzen ok');

/* ---------- Dekodierung per Python ---------- */
function haveDecoder() {
  var r = cp.spawnSync('python', ['-c', 'import zxingcpp, cv2, numpy'], { encoding: 'utf8' });
  return r.status === 0;
}
if (!haveDecoder()) {
  console.log('HINWEIS: Python-Dekodierung übersprungen (pip install zxing-cpp opencv-python-headless numpy pillow).');
  process.exit(process.env.QR_REQUIRE_DECODER ? 1 : 0);
}
fs.mkdirSync(tmp, { recursive: true });
try {
  var manifest = cases.map(function (c, i) {
    var f = 'c' + i + '.png';
    fs.writeFileSync(path.join(tmp, f), png(c.qr, 6, 4));
    return { file: f, name: c.name, text: Buffer.from(c.text, 'utf8').toString('base64') };
  });
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(manifest));
  var r = cp.spawnSync('python', [path.join(__dirname, 'test-qr-decode.py'), tmp], { encoding: 'utf8', maxBuffer: 1 << 26 });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  assert.strictEqual(r.status, 0, 'Python-Dekodierung fehlgeschlagen');
} finally {
  fs.readdirSync(tmp).forEach(function (f) { fs.unlinkSync(path.join(tmp, f)); });
  fs.rmdirSync(tmp);
}
console.log('QR: alle Tests bestanden');
