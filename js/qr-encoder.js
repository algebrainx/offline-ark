/* Offline-Ark – QR-Code-Encoder (ISO/IEC 18004), reines JavaScript ohne Abhängigkeiten.
 * - Versionen 1–20 (21×21 bis 97×97), automatische Wahl der kleinsten passenden Version
 * - Fehlerkorrektur L / M / Q / H, Reed-Solomon über GF(256) (Polynom 0x11D)
 * - Modi: Numerisch, Alphanumerisch, Byte (UTF-8) – der günstigste Einzelmodus wird automatisch gewählt
 * - 8 Masken mit Straf-Score (Regeln N1–N4), Format- und Versionsinformation (BCH)
 * Aufruf:  var qr = OA_QR.encode('Text', { ec: 'M' });   // qr.size, qr.modules[y][x] (true = dunkel)
 *          OA_QR.toSvg(qr, { border: 4 });                 // SVG-Text (skalierbar, mit Ruhezone)
 * Läuft im Browser (window.OA_QR) und in Node (module.exports). */
(function () {
  'use strict';

  var MAX_VERSION = 20;
  var EC_LEVELS = ['L', 'M', 'Q', 'H'];
  var EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };      // Formatinformation
  var EC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };

  // Fehlerkorrektur-Codewörter je Block und Anzahl der Blöcke (Index = Version; Index 0 unbenutzt)
  var ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28]
  ];
  var NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25]
  ];

  var ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }

  /* ---------- Text -> Bytes ---------- */
  function utf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function pickMode(text) {
    if (/^[0-9]*$/.test(text)) return 'numeric';
    var ok = true;
    for (var i = 0; i < text.length; i++) if (ALNUM.indexOf(text.charAt(i)) < 0) { ok = false; break; }
    return ok ? 'alnum' : 'byte';
  }

  function countBits(mode, version) {
    var tier = version <= 9 ? 0 : version <= 26 ? 1 : 2;
    return { numeric: [10, 12, 14], alnum: [9, 11, 13], byte: [8, 16, 16] }[mode][tier];
  }

  /** Länge der Nutzdaten in Bits (ohne Terminator) für Modus und Version; null, wenn Zähler zu klein. */
  function dataBits(mode, count, version) {
    var n = count, bits = 4 + countBits(mode, version);
    if (n >= (1 << countBits(mode, version))) return null;
    if (mode === 'numeric') bits += Math.floor(n / 3) * 10 + (n % 3 === 0 ? 0 : n % 3 === 1 ? 4 : 7);
    else if (mode === 'alnum') bits += Math.floor(n / 2) * 11 + (n % 2) * 6;
    else bits += n * 8;
    return bits;
  }

  /* ---------- Kapazitäten ---------- */
  function numRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var na = Math.floor(ver / 7) + 2;
      result -= (25 * na - 10) * na - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }
  function numDataCodewords(ver, ec) {
    var i = EC_INDEX[ec];
    return Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[i][ver] * NUM_BLOCKS[i][ver];
  }

  /** Größter möglicher Inhalt (in Zeichen bzw. Bytes) im gegebenen Modus bei Version v und Stufe ec. */
  function capacity(mode, ver, ec) {
    var avail = numDataCodewords(ver, ec) * 8 - 4 - countBits(mode, ver);
    if (avail < 0) return 0;
    if (mode === 'numeric') { var g = Math.floor(avail / 10); var r = avail - g * 10; return g * 3 + (r >= 7 ? 2 : r >= 4 ? 1 : 0); }
    if (mode === 'alnum') return Math.floor(avail / 11) * 2 + (avail % 11 >= 6 ? 1 : 0);
    return Math.floor(avail / 8);
  }

  /* ---------- Reed-Solomon ---------- */
  var EXP = [], LOG = [];
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = [];
      for (var k = 0; k <= poly.length; k++) next[k] = 0;
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;   // höchster Koeffizient zuerst (führende 1)
  }
  function rsRemainder(data, gen) {
    var degree = gen.length - 1, rem = [];
    for (var i = 0; i < degree; i++) rem.push(0);
    data.forEach(function (b) {
      var factor = b ^ rem.shift();
      rem.push(0);
      for (var i = 0; i < degree; i++) rem[i] ^= gmul(gen[i + 1], factor);
    });
    return rem;
  }

  /* ---------- Datenbits ---------- */
  function BitBuffer() { this.bits = []; }
  BitBuffer.prototype.put = function (val, len) { for (var i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1); };

  function buildData(mode, text, bytes, version, ec) {
    var bb = new BitBuffer(), count = mode === 'byte' ? bytes.length : text.length, i;
    bb.put({ numeric: 1, alnum: 2, byte: 4 }[mode], 4);
    bb.put(count, countBits(mode, version));
    if (mode === 'numeric') {
      for (i = 0; i < text.length; i += 3) { var g = text.substr(i, 3); bb.put(parseInt(g, 10), g.length * 3 + 1); }
    } else if (mode === 'alnum') {
      for (i = 0; i + 1 < text.length; i += 2) bb.put(ALNUM.indexOf(text.charAt(i)) * 45 + ALNUM.indexOf(text.charAt(i + 1)), 11);
      if (text.length % 2) bb.put(ALNUM.indexOf(text.charAt(text.length - 1)), 6);
    } else {
      bytes.forEach(function (b) { bb.put(b, 8); });
    }
    var cap = numDataCodewords(version, ec) * 8;
    bb.put(0, Math.min(4, cap - bb.bits.length));
    while (bb.bits.length % 8) bb.bits.push(0);
    for (var pad = 0xEC; bb.bits.length < cap; pad ^= 0xEC ^ 0x11) bb.put(pad, 8);
    var out = [];
    for (i = 0; i < bb.bits.length; i += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bb.bits[i + k];
      out.push(v);
    }
    return out;
  }

  function addEccAndInterleave(data, version, ec) {
    var ei = EC_INDEX[ec], nb = NUM_BLOCKS[ei][version], eccLen = ECC_PER_BLOCK[ei][version];
    var raw = Math.floor(numRawDataModules(version) / 8);
    var numShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var gen = rsGenerator(eccLen), blocks = [], k = 0;
    for (var i = 0; i < nb; i++) {
      var len = shortLen - eccLen + (i < numShort ? 0 : 1);
      var dat = data.slice(k, k + len); k += len;
      var e = rsRemainder(dat, gen);
      if (i < numShort) dat.push(0);                 // Platzhalter, wird beim Verschachteln übersprungen
      blocks.push(dat.concat(e));
    }
    var out = [];
    for (var col = 0; col < blocks[0].length; col++) {
      for (var b = 0; b < nb; b++) {
        if (col !== shortLen - eccLen || b >= numShort) out.push(blocks[b][col]);
      }
    }
    return out;
  }

  /* ---------- Matrix ---------- */
  function alignPositions(version) {
    if (version === 1) return [];
    var na = Math.floor(version / 7) + 2, size = version * 4 + 17;
    var step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (na * 2 - 2)) * 2;
    var res = [6];
    for (var pos = size - 7; res.length < na; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function Matrix(version) {
    this.version = version;
    this.size = version * 4 + 17;
    this.m = []; this.fn = [];
    for (var y = 0; y < this.size; y++) {
      var r = [], f = [];
      for (var x = 0; x < this.size; x++) { r.push(false); f.push(false); }
      this.m.push(r); this.fn.push(f);
    }
  }
  Matrix.prototype.setFn = function (x, y, dark) { this.m[y][x] = !!dark; this.fn[y][x] = true; };
  Matrix.prototype.drawFunctionPatterns = function () {
    var size = this.size, i, j;
    for (i = 0; i < size; i++) { this.setFn(6, i, i % 2 === 0); this.setFn(i, 6, i % 2 === 0); }
    this.finder(3, 3); this.finder(size - 4, 3); this.finder(3, size - 4);
    var ap = alignPositions(this.version), n = ap.length;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      this.align(ap[i], ap[j]);
    }
    this.drawFormat(0);   // Platz reservieren, wird nach der Maskenwahl überschrieben
    this.drawVersion();
  };
  Matrix.prototype.finder = function (cx, cy) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.setFn(x, y, d !== 2 && d !== 4);
    }
  };
  Matrix.prototype.align = function (cx, cy) {
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) this.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  };
  function bit(v, i) { return ((v >>> i) & 1) !== 0; }
  Matrix.prototype.drawFormat = function (maskNo, ec) {
    var data = ((ec ? EC_BITS[ec] : 0) << 3) | maskNo, rem = data, i;
    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412, size = this.size;
    for (i = 0; i <= 5; i++) this.setFn(8, i, bit(bits, i));
    this.setFn(8, 7, bit(bits, 6));
    this.setFn(8, 8, bit(bits, 7));
    this.setFn(7, 8, bit(bits, 8));
    for (i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(bits, i));
    for (i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, bit(bits, i));
    for (i = 8; i < 15; i++) this.setFn(8, size - 15 + i, bit(bits, i));
    this.setFn(8, size - 8, true);   // immer dunkles Modul
  };
  Matrix.prototype.drawVersion = function () {
    if (this.version < 7) return;
    var rem = this.version, i;
    for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (this.version << 12) | rem;
    for (i = 0; i < 18; i++) {
      var c = bit(bits, i), a = this.size - 11 + (i % 3), b = Math.floor(i / 3);
      this.setFn(a, b, c); this.setFn(b, a, c);
    }
  };
  Matrix.prototype.drawCodewords = function (data) {
    var size = this.size, i = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
          if (!this.fn[y][x] && i < data.length * 8) { this.m[y][x] = bit(data[i >>> 3], 7 - (i & 7)); i++; }
        }
      }
    }
  };
  Matrix.prototype.applyMask = function (mask) {
    for (var y = 0; y < this.size; y++) for (var x = 0; x < this.size; x++) {
      var inv;
      switch (mask) {
        case 0: inv = (x + y) % 2 === 0; break;
        case 1: inv = y % 2 === 0; break;
        case 2: inv = x % 3 === 0; break;
        case 3: inv = (x + y) % 3 === 0; break;
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: inv = (x * y) % 2 + (x * y) % 3 === 0; break;
        case 6: inv = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
        default: inv = ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      }
      if (inv && !this.fn[y][x]) this.m[y][x] = !this.m[y][x];
    }
  };

  /** Straf-Score nach ISO 18004 (Regeln N1–N4); kleiner ist besser. */
  function penalty(m, size) {
    var score = 0, x, y;
    function line(get) {
      var s = 0, r = 1, prev = get(0);
      for (var k = 1; k < size; k++) {
        var c = get(k);
        if (c === prev) r++; else { if (r >= 5) s += 3 + (r - 5); r = 1; prev = c; }
      }
      if (r >= 5) s += 3 + (r - 5);
      // Muster 1:1:3:1:1 mit vier hellen Modulen davor oder danach
      var str = '';
      for (var q = 0; q < size; q++) str += get(q) ? '1' : '0';
      var re = /(?=(10111010000|00001011101))/g, mm;
      while ((mm = re.exec(str))) { s += 40; re.lastIndex = mm.index + 1; }
      return s;
    }
    for (y = 0; y < size; y++) score += line(function (k) { return m[y][k]; });
    for (x = 0; x < size; x++) score += line(function (k) { return m[k][x]; });
    for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
      if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
    var total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }

  /* ---------- Öffentliche Funktionen ---------- */
  /** Prüft Text und liefert Modus, Bytezahl und kleinste passende Version (oder null, wenn zu lang). */
  function analyze(text, ec, minVersion) {
    text = String(text == null ? '' : text);
    ec = EC_BITS.hasOwnProperty(ec) ? ec : 'M';
    var mode = pickMode(text), bytes = mode === 'byte' ? utf8(text) : null;
    var count = mode === 'byte' ? bytes.length : text.length;
    var version = null;
    for (var v = Math.max(1, minVersion || 1); v <= MAX_VERSION; v++) {
      var bits = dataBits(mode, count, v);
      if (bits !== null && bits <= numDataCodewords(v, ec) * 8) { version = v; break; }
    }
    return {
      text: text, ec: ec, mode: mode, bytes: bytes, count: count, version: version,
      maxCount: capacity(mode, MAX_VERSION, ec),
      usedCodewords: version ? Math.ceil(dataBits(mode, count, version) / 8) : null,
      dataCodewords: version ? numDataCodewords(version, ec) : null
    };
  }

  function encode(text, opts) {
    opts = opts || {};
    var info = analyze(text, opts.ec, opts.minVersion);
    if (info.version === null) throw err('TOO_LONG', 'Der Text ist zu lang für einen QR-Code (Version 1–' + MAX_VERSION + ').');
    var version = info.version, ec = info.ec;
    var data = buildData(info.mode, info.text, info.bytes, version, ec);
    var all = addEccAndInterleave(data, version, ec);
    var mx = new Matrix(version);
    mx.drawFunctionPatterns();
    mx.drawCodewords(all);
    var best = -1, bestScore = Infinity, mask;
    var forced = typeof opts.mask === 'number' && opts.mask >= 0 && opts.mask <= 7 ? opts.mask : -1;
    for (mask = 0; mask < 8; mask++) {
      if (forced >= 0 && mask !== forced) continue;
      mx.applyMask(mask);
      mx.drawFormat(mask, ec);
      var p = penalty(mx.m, mx.size);
      if (p < bestScore) { bestScore = p; best = mask; }
      mx.applyMask(mask);   // Maske wieder entfernen (XOR)
    }
    mx.applyMask(best);
    mx.drawFormat(best, ec);
    return { version: version, size: mx.size, ec: ec, mode: info.mode, mask: best, count: info.count,
      usedCodewords: info.usedCodewords, dataCodewords: info.dataCodewords, modules: mx.m };
  }

  /** SVG als Text: ein einziger Pfad, Ruhezone (border Module), skalierbar. */
  function toSvg(qr, opts) {
    opts = opts || {};
    var border = opts.border == null ? 4 : opts.border, dark = opts.dark || '#000', light = opts.light || '#fff';
    var n = qr.size + border * 2, d = [];
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (!qr.modules[y][x]) continue;
        var x0 = x; while (x + 1 < qr.size && qr.modules[y][x + 1]) x++;
        d.push('M' + (x0 + border) + ',' + (y + border) + 'h' + (x - x0 + 1) + 'v1h-' + (x - x0 + 1) + 'z');
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"' +
      (opts.attrs ? ' ' + opts.attrs : '') + '>' +
      (opts.title ? '<title>' + String(opts.title).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }) + '</title>' : '') +
      '<rect width="' + n + '" height="' + n + '" fill="' + light + '"/><path d="' + d.join('') + '" fill="' + dark + '"/></svg>';
  }

  /** Zeichnet den Code auf ein Canvas (ganzzahlige Pixelgröße je Modul, scharf). */
  function toCanvas(qr, canvas, opts) {
    opts = opts || {};
    var border = opts.border == null ? 4 : opts.border, scale = opts.scale || 8;
    var n = qr.size + border * 2;
    canvas.width = canvas.height = n * scale;
    var c = canvas.getContext('2d');
    c.fillStyle = opts.light || '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = opts.dark || '#000';
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) c.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
    }
    return canvas;
  }

  var api = { encode: encode, analyze: analyze, toSvg: toSvg, toCanvas: toCanvas, utf8: utf8, capacity: capacity,
    MAX_VERSION: MAX_VERSION, EC_LEVELS: EC_LEVELS, numDataCodewords: numDataCodewords };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (window.OA_QR = api);
})();
