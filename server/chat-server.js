#!/usr/bin/env node
/* Offline-Ark – Mini-Server für den Chat im lokalen Netz.
 * Reines Node.js (>= 16), KEINE npm-Pakete.
 *   node server/chat-server.js [--port 8080] [--host 0.0.0.0] [--pin CODE] [--log [datei]] [--no-qr] [--allow-host name]
 *
 * Der Server macht zwei Dinge:
 *   1. liefert das Offline-Ark-Projekt statisch aus (nur lesend, nur GET/HEAD),
 *   2. bietet eine kleine Chat-API unter /api/chat/…
 * Er ist für das EIGENE WLAN / einen Hotspot gedacht. Es gibt keine Verschlüsselung (HTTP).
 * Sicherheit: siehe server/README.md. */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');
var crypto = require('crypto');

var ROOT = path.resolve(__dirname, '..');
var DEFAULT_ROOM = 'Nachbarschaft';
var LIMITS = {
  name: 30, text: 1000, room: 30,
  perRoom: 500, rooms: 20,
  body: 8 * 1024,             // Byte, Obergrenze für POST-Körper
  sendsPerMin: 20,            // Nachrichten je IP und Minute
  requestsPerMin: 600,        // alle API-Aufrufe je IP und Minute
  badPinPerMin: 10,           // falsche PIN je IP und Minute
  waitersTotal: 200, waitersPerIp: 10,
  maxWait: 25                 // Sekunden Long-Polling
};

/* ---------- Statische Dateien ---------- */
var MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav'
};
// Ordner im Projektstamm, die nie ausgeliefert werden (Server-Code, Log, Skripte, Arbeitsdateien)
var HIDDEN_TOP = { server: 1, scripts: 1, scratch: 1, node_modules: 1 };
var CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'; object-src 'self'; " +
  "base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

var REAL_ROOT = (function () { try { return fs.realpathSync(ROOT); } catch (e) { return ROOT; } })();

/** URL-Pfad -> sicherer Dateipfad innerhalb von ROOT oder { status } bei Ablehnung. */
function resolveStatic(urlPath) {
  var p;
  try { p = decodeURIComponent(urlPath); } catch (e) { return { status: 400 }; }
  if (p.indexOf('\0') >= 0 || p.indexOf('\\') >= 0) return { status: 400 };
  if (p.charAt(0) !== '/') return { status: 400 };
  var parts = p.split('/').filter(function (s) { return s !== ''; });
  for (var i = 0; i < parts.length; i++) {
    var s = parts[i];
    if (s === '..') return { status: 403 };
    if (s === '.') continue;
    // Dotfiles (.git, .env …), Windows-Datenströme (a:b), Namen mit Punkt/Leerzeichen am Ende
    if (s.charAt(0) === '.' || s.indexOf(':') >= 0 || /[. ]$/.test(s)) return { status: 404 };
  }
  parts = parts.filter(function (s) { return s !== '.'; });
  if (parts.length && HIDDEN_TOP[parts[0].toLowerCase()]) return { status: 404 };
  var full = path.join(ROOT, parts.join(path.sep));
  if (full !== ROOT && full.indexOf(ROOT + path.sep) !== 0) return { status: 403 };
  return { file: full, trailingSlash: p.slice(-1) === '/' };
}

var BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' };

function send(res, status, body, headers) {
  var h = Object.assign({}, BASE_HEADERS, headers || {});
  var buf = Buffer.from(body || '', 'utf8');
  h['Content-Length'] = buf.length;
  res.writeHead(status, h);
  res.end(buf);
}
function sendJson(res, status, obj, extra) {
  send(res, status, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {}));
}
function plain(res, status, text) { send(res, status, text, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); }

function serveStatic(req, res, urlPath) {
  var r = resolveStatic(urlPath);
  if (r.status) return plain(res, r.status, r.status === 403 ? 'Verboten' : r.status === 400 ? 'Ungültige Adresse' : 'Nicht gefunden');
  fs.stat(r.file, function (err, st) {
    if (err && urlPath === '/favicon.ico') { res.writeHead(204, Object.assign({ 'Cache-Control': 'public, max-age=86400' }, BASE_HEADERS)); return res.end(); }   // Browser fragen immer danach
    if (err) return plain(res, 404, 'Nicht gefunden');
    var file = r.file;
    if (st.isDirectory()) {
      if (!r.trailingSlash && file !== ROOT) {
        res.writeHead(301, { Location: urlPath.replace(/^\/+/, '/') + '/', 'Content-Length': 0 }); return res.end();
      }
      file = path.join(file, 'index.html');
      try { st = fs.statSync(file); } catch (e) { return plain(res, 404, 'Nicht gefunden'); }
    }
    if (!st.isFile()) return plain(res, 404, 'Nicht gefunden');
    // Symbolische Links dürfen nicht aus dem Projektordner herausführen
    var real;
    try { real = fs.realpathSync(file); } catch (e) { return plain(res, 404, 'Nicht gefunden'); }
    if (real !== REAL_ROOT && real.indexOf(REAL_ROOT + path.sep) !== 0) return plain(res, 403, 'Verboten');

    var ext = path.extname(file).toLowerCase();
    var type = MIME[ext] || 'application/octet-stream';
    var etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    var isHtml = ext === '.html' || ext === '.htm';
    var maxAge = isHtml || ext === '.js' || ext === '.css' || ext === '.json' ? 60 : 3600;
    var headers = Object.assign({}, BASE_HEADERS, { 'Content-Type': type, 'Content-Length': st.size, ETag: etag,
      'Last-Modified': st.mtime.toUTCString(), 'Cache-Control': 'public, max-age=' + maxAge });
    if (isHtml) headers['Content-Security-Policy'] = CSP;
    if (req.headers['if-none-match'] === etag) { delete headers['Content-Length']; res.writeHead(304, headers); return res.end(); }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    var stream = fs.createReadStream(file);
    stream.on('error', function () { res.destroy(); });
    stream.pipe(res);
  });
}

/* ---------- Texte säubern ---------- */
/** Steuerzeichen und Richtungs-Überschreibungen entfernen; Zeilenumbruch und Tab bleiben nur bei mehrzeiligem Text. */
function stripCtl(s, keepNewline) {
  var re = keepNewline
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFEFF]/g
    : /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
  return s.replace(re, keepNewline ? '' : ' ');
}
/** Einzeiliger Text (Name, Raum); zu lang -> '' (wird abgelehnt statt still gekürzt). */
function cleanLine(v, max) {
  if (typeof v !== 'string') return '';
  var s = stripCtl(v, false).replace(/\s+/g, ' ').trim();
  return s.length > max ? '' : s;
}
function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  var s = stripCtl(v.replace(/\r\n?/g, '\n'), true).trim();
  return s.length > max ? '' : s;
}

/* ---------- Chat-Zustand ---------- */
function ChatStore(logFile, L) {
  this.L = L || LIMITS;
  this.rooms = Object.create(null);   // Raumname -> [Nachrichten]
  this.nextId = 1;
  this.logFile = logFile || null;
  this.saveTimer = null;
  this.waiters = [];
  if (this.logFile) this.load();
}
ChatStore.prototype.load = function () {
  try {
    var o = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
    var self = this, max = 0;
    Object.keys(o.rooms || {}).slice(0, this.L.rooms).forEach(function (name) {
      var key = cleanLine(name, self.L.room);
      if (!key || !Array.isArray(o.rooms[name])) return;
      self.rooms[key] = o.rooms[name].slice(-self.L.perRoom).map(function (m) {
        var id = Number(m && m.id), text = cleanText(m && m.text, self.L.text), nm = cleanLine(m && m.name, self.L.name);
        if (!(id > 0) || !text || !nm) return null;
        max = Math.max(max, id);
        return { id: id, room: key, name: nm, text: text, ts: Number(m.ts) || 0 };
      }).filter(Boolean);
    });
    this.nextId = Math.max(max + 1, Number(o.nextId) || 1);
  } catch (e) { /* keine oder ungültige Log-Datei: leer starten */ }
};
ChatStore.prototype.save = function () {
  if (!this.logFile || this.saveTimer) return;
  var self = this;
  this.saveTimer = setTimeout(function () { self.saveTimer = null; self.saveNow(); }, 1000);
  if (this.saveTimer.unref) this.saveTimer.unref();
};
ChatStore.prototype.saveNow = function () {
  if (!this.logFile) return;
  var tmp = this.logFile + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, nextId: this.nextId, rooms: this.rooms }), { mode: 384 });
    fs.renameSync(tmp, this.logFile);
  } catch (e) { console.error('Log konnte nicht geschrieben werden: ' + e.message); }
};
ChatStore.prototype.add = function (room, name, text) {
  if (!this.rooms[room]) {
    if (Object.keys(this.rooms).length >= this.L.rooms) return null;
    this.rooms[room] = [];
  }
  var msg = { id: this.nextId++, room: room, name: name, text: text, ts: Date.now() };
  var list = this.rooms[room];
  list.push(msg);
  while (list.length > this.L.perRoom) list.shift();
  this.save();
  this.flush(room);
  return msg;
};
ChatStore.prototype.since = function (room, since, limit) {
  var list = this.rooms[room] || [];
  var out = list.filter(function (m) { return m.id > since; });
  return out.length > limit ? out.slice(-limit) : out;
};
/** Wartende Long-Polling-Anfragen dieses Raums beantworten. */
ChatStore.prototype.flush = function (room) {
  var self = this, rest = [];
  this.waiters.forEach(function (w) {
    if (w.room !== room) { rest.push(w); return; }
    var msgs = self.since(room, w.since, 200);
    if (!msgs.length) { rest.push(w); return; }
    clearTimeout(w.timer); w.done(msgs);
  });
  this.waiters = rest;
};
ChatStore.prototype.listRooms = function () {
  var self = this, names = Object.keys(this.rooms);
  if (names.indexOf(DEFAULT_ROOM) < 0) names.unshift(DEFAULT_ROOM);
  return names.map(function (n) { return { name: n, count: (self.rooms[n] || []).length }; });
};

/* ---------- Rate-Limits und Prüfungen ---------- */
function Limiter() { this.map = new Map(); }
/** true, wenn noch Platz ist (und zählt den Aufruf). */
Limiter.prototype.hit = function (key, max, windowMs) {
  var now = Date.now(), arr = this.map.get(key) || [];
  while (arr.length && now - arr[0] > windowMs) arr.shift();
  var ok = arr.length < max;
  if (ok) arr.push(now);
  this.map.set(key, arr);
  return ok;
};
Limiter.prototype.sweep = function (windowMs) {
  var now = Date.now(), self = this;
  this.map.forEach(function (arr, k) { if (!arr.length || now - arr[arr.length - 1] > windowMs) self.map.delete(k); });
};

function clientIp(req) { return String(req.socket.remoteAddress || '').replace(/^::ffff:/, ''); }

/** Host-Header prüfen (Schutz vor DNS-Rebinding): IP-Adressen, localhost, Namen ohne Punkt, .local/.lan/… */
function hostAllowed(hostHeader, extra) {
  if (!hostHeader) return false;
  var h = String(hostHeader).toLowerCase();
  if (/^\[[0-9a-f:.]+\](?::\d+)?$/.test(h)) return true;   // IPv6-Adresse
  h = h.replace(/:\d+$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;     // IPv4-Adresse
  if (h.indexOf('.') < 0) return /^[a-z0-9_-]+$/.test(h);  // localhost, raspberrypi …
  if (/^[a-z0-9.-]+\.(local|lan|home\.arpa|fritz\.box|internal)$/.test(h)) return true;
  return (extra || []).indexOf(h) >= 0;
}

function pinMatches(given, pin) {
  var a = crypto.createHash('sha256').update(String(given || '')).digest();
  var b = crypto.createHash('sha256').update(String(pin)).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------- Server ---------- */
function createChatServer(opts) {
  opts = opts || {};
  var pin = opts.pin ? String(opts.pin) : '';
  var L = Object.assign({}, LIMITS, opts.limits || {});   // Grenzen (nur Tests überschreiben sie)
  var store = new ChatStore(opts.log || null, L);
  var sends = new Limiter(), calls = new Limiter(), badPins = new Limiter();
  var extraHosts = (opts.allowHosts || []).map(function (h) { return String(h).toLowerCase(); }).filter(Boolean);
  var waitersByIp = Object.create(null);

  var sweeper = setInterval(function () { sends.sweep(60000); calls.sweep(60000); badPins.sweep(60000); }, 60000);
  sweeper.unref();

  function readBody(req, res, cb) {
    var len = Number(req.headers['content-length']);
    if (len > L.body) return sendJson(res, 413, { error: 'body_too_large' }, { Connection: 'close' });
    var chunks = [], size = 0, finished = false;
    var timer = setTimeout(function () {
      if (finished) return;
      finished = true; sendJson(res, 408, { error: 'timeout' }, { Connection: 'close' });
    }, 10000);
    req.on('data', function (c) {
      if (finished) return;
      size += c.length;
      if (size > L.body) {
        finished = true; clearTimeout(timer);
        sendJson(res, 413, { error: 'body_too_large' }, { Connection: 'close' });
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () { if (finished) return; finished = true; clearTimeout(timer); cb(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', function () { finished = true; clearTimeout(timer); });
  }

  function api(req, res, url) {
    var ip = clientIp(req), route = url.pathname.replace(/\/+$/, '');
    if (!calls.hit(ip, L.requestsPerMin, 60000)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '30' });

    if (route === '/api/chat/info' && req.method === 'GET') {
      return sendJson(res, 200, { app: 'offline-ark-chat', pinRequired: !!pin, defaultRoom: DEFAULT_ROOM,
        limits: { name: L.name, text: L.text, room: L.room }, serverTime: Date.now() });
    }
    if (pin && !pinMatches(req.headers['x-chat-pin'], pin)) {
      if (!badPins.hit(ip, L.badPinPerMin, 60000)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
      return sendJson(res, 401, { error: 'pin_required' });
    }

    if (route === '/api/chat/rooms' && req.method === 'GET') return sendJson(res, 200, { rooms: store.listRooms() });

    if (route === '/api/chat/messages' && req.method === 'GET') {
      var room = cleanLine(url.searchParams.get('room') || DEFAULT_ROOM, L.room);
      if (!room) return sendJson(res, 400, { error: 'bad_room' });
      var sinceRaw = url.searchParams.get('since'), hasSince = sinceRaw !== null && sinceRaw !== '';
      var since = hasSince ? Number(sinceRaw) : 0;
      if (hasSince && !(Number.isInteger(since) && since >= 0)) return sendJson(res, 400, { error: 'bad_since' });
      var wait = Math.min(L.maxWait, Math.max(0, parseInt(url.searchParams.get('wait'), 10) || 0));
      var limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 100));
      var msgs = store.since(room, since, limit);
      var reply = function (list) { sendJson(res, 200, { room: room, messages: list, last: list.length ? list[list.length - 1].id : since, serverTime: Date.now() }); };
      if (msgs.length || !hasSince || !wait || store.waiters.length >= L.waitersTotal || (waitersByIp[ip] || 0) >= L.waitersPerIp) return reply(msgs);
      // Long-Polling: Antwort halten, bis eine neue Nachricht kommt oder die Zeit abläuft
      var w = { room: room, since: since, done: null, timer: null }, closed = false;
      waitersByIp[ip] = (waitersByIp[ip] || 0) + 1;
      var drop = function () { store.waiters = store.waiters.filter(function (x) { return x !== w; }); };
      w.done = function (list) { if (closed) return; closed = true; waitersByIp[ip]--; reply(list); };
      w.timer = setTimeout(function () { drop(); w.done([]); }, wait * 1000);
      res.on('close', function () {
        if (closed) return;
        closed = true; waitersByIp[ip]--; clearTimeout(w.timer); drop();
      });
      store.waiters.push(w);
      return;
    }

    if (route === '/api/chat/send') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
      if (String(req.headers['content-type'] || '').toLowerCase().indexOf('application/json') !== 0) return sendJson(res, 415, { error: 'json_required' });
      if (req.headers.origin) {
        var oh; try { oh = new URL(req.headers.origin).host; } catch (e) { oh = ''; }
        if (oh !== req.headers.host) return sendJson(res, 403, { error: 'bad_origin' });
      }
      return readBody(req, res, function (raw) {
        var data;
        try { data = JSON.parse(raw); } catch (e) { return sendJson(res, 400, { error: 'bad_json' }); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return sendJson(res, 400, { error: 'bad_json' });
        var name = cleanLine(data.name, L.name), text = cleanText(data.text, L.text);
        var rm = data.room === undefined || data.room === '' ? DEFAULT_ROOM : cleanLine(data.room, L.room);
        if (!name) return sendJson(res, 400, { error: typeof data.name === 'string' && data.name.trim() ? 'name_too_long' : 'name_required' });
        if (!text) return sendJson(res, 400, { error: typeof data.text === 'string' && data.text.trim() ? 'text_too_long' : 'text_required' });
        if (!rm) return sendJson(res, 400, { error: 'bad_room' });
        if (!sends.hit(ip, L.sendsPerMin, 60000)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '30' });
        var msg = store.add(rm, name, text);
        if (!msg) return sendJson(res, 409, { error: 'too_many_rooms' });
        sendJson(res, 201, { ok: true, message: msg });
      });
    }
    return sendJson(res, 404, { error: 'not_found' });
  }

  var server = http.createServer(function (req, res) {
    try {
      if (!hostAllowed(req.headers.host, extraHosts)) return plain(res, 403, 'Ungültiger Host');
      // rohen Pfad nehmen (URL() würde ".." schon auflösen und so Angriffe verschleiern)
      var rawPath = String(req.url).split('?')[0].split('#')[0];
      if (rawPath.charAt(0) !== '/') return plain(res, 400, 'Ungültige Adresse');
      if (rawPath.indexOf('/api/chat') === 0) {
        var url; try { url = new URL(req.url, 'http://x'); } catch (e) { return plain(res, 400, 'Ungültige Adresse'); }
        return api(req, res, url);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Nur Lesen erlaubt');
      return serveStatic(req, res, rawPath);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) plain(res, 500, 'Fehler'); else res.destroy();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 50;
  server.on('clientError', function (err, socket) { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  server.chatStore = store;
  server.on('close', function () {
    clearInterval(sweeper);
    if (store.saveTimer) { clearTimeout(store.saveTimer); store.saveTimer = null; }
    store.saveNow();
  });
  return server;
}

/* ---------- Start über die Kommandozeile ---------- */
function parseArgs(argv) {
  var o = { port: Number(process.env.PORT) || 8080, host: '0.0.0.0', pin: '', log: null, qr: true, allowHosts: [] };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--port') o.port = Number(argv[++i]);
    else if (a === '--host') o.host = argv[++i];
    else if (a === '--pin') o.pin = argv[++i] || '';
    else if (a === '--log') { var nxt = argv[i + 1]; o.log = nxt && nxt.indexOf('--') !== 0 ? path.resolve(argv[++i]) : path.join(__dirname, 'chat-log.json'); }
    else if (a === '--no-qr') o.qr = false;
    else if (a === '--allow-host') o.allowHosts.push(argv[++i] || '');
    else if (a === '--help' || a === '-h') o.help = true;
    else o.error = 'Unbekannte Option: ' + a;
  }
  if (!Number.isInteger(o.port) || o.port < 0 || o.port > 65535) o.error = 'Ungültiger Port.';
  return o;
}

function lanAddresses() {
  var out = [], nets = os.networkInterfaces();
  Object.keys(nets).forEach(function (n) {
    (nets[n] || []).forEach(function (a) { if (a.family === 'IPv4' && !a.internal) out.push({ iface: n, address: a.address }); });
  });
  return out;
}

/** QR-Code als Terminal-Text (schwarz auf weiß mit Halbblöcken). */
function terminalQr(text) {
  var QR, q;
  try { QR = require(path.join(ROOT, 'js', 'qr-encoder.js')); q = QR.encode(text, { ec: 'L' }); } catch (e) { return ''; }
  var b = 2, n = q.size + 2 * b, lines = [];
  function dark(x, y) { x -= b; y -= b; return x >= 0 && y >= 0 && x < q.size && y < q.size && q.modules[y][x]; }
  for (var y = 0; y < n; y += 2) {
    var line = '\x1b[30;47m';
    for (var x = 0; x < n; x++) {
      var t = dark(x, y), bt = dark(x, y + 1);
      line += t && bt ? '█' : t ? '▀' : bt ? '▄' : ' ';
    }
    lines.push('  ' + line + '\x1b[0m');
  }
  return lines.join('\n');
}

function main() {
  var o = parseArgs(process.argv.slice(2));
  if (o.help || o.error) {
    if (o.error) console.error(o.error + '\n');
    console.log('Offline-Ark Chat-Server\n\n' +
      '  node server/chat-server.js [Optionen]\n\n' +
      '  --port 8080        Port (Standard 8080)\n' +
      '  --host 0.0.0.0     Adresse; 127.0.0.1 = nur dieser Rechner\n' +
      '  --pin CODE         Chat nur mit diesem Code (Raumpasswort)\n' +
      '  --log [Datei]      Nachrichten in Datei sichern (Standard: server/chat-log.json)\n' +
      '  --no-qr            keinen QR-Code im Terminal zeigen\n' +
      '  --allow-host NAME  zusätzlicher erlaubter Host-Name (Schutz vor DNS-Rebinding)\n');
    process.exit(o.error ? 1 : 0);
  }
  var server = createChatServer({ pin: o.pin, log: o.log, allowHosts: o.allowHosts });
  server.on('error', function (e) {
    if (e.code === 'EADDRINUSE') console.error('Der Port ' + o.port + ' ist schon belegt. Starte mit --port 8081 (oder einer anderen Zahl).');
    else if (e.code === 'EACCES') console.error('Keine Berechtigung für Port ' + o.port + '. Nimm eine Zahl über 1024, z. B. --port 8080.');
    else console.error(e.message);
    process.exit(1);
  });
  server.listen(o.port, o.host, function () {
    var port = server.address().port, local = o.host === '127.0.0.1' || o.host === 'localhost';
    console.log('\nOffline-Ark Chat-Server läuft.\n');
    console.log('  Auf diesem Rechner:  http://localhost:' + port + '/tools/chat.html');
    var addrs = local ? [] : lanAddresses();
    addrs.forEach(function (a) { console.log('  Öffne am Handy:      http://' + a.address + ':' + port + '/tools/chat.html   (' + a.iface + ')'); });
    if (!local && !addrs.length) console.log('  Keine Netzwerk-Adresse gefunden. Verbinde den Rechner mit dem WLAN oder starte einen Hotspot.');
    if (o.qr && addrs.length && process.stdout.isTTY) {
      var qr = terminalQr('http://' + addrs[0].address + ':' + port + '/tools/chat.html');
      if (qr) console.log('\n' + qr + '\n');
    }
    console.log('\n  WICHTIG: Nur im eigenen WLAN oder Hotspot verwenden. Es gibt keine Verschlüsselung (HTTP):');
    console.log('  Wer im selben Netz ist, kann mitlesen. Nie ins Internet freigeben (kein Port-Forwarding).');
    console.log(o.pin ? '  Chat-Code (PIN) ist gesetzt.' : '  Kein Chat-Code gesetzt. Mit --pin CODE kann man einen Code verlangen.');
    console.log(o.log ? '  Nachrichten werden gesichert in: ' + o.log : '  Nachrichten liegen nur im Arbeitsspeicher (mit --log dauerhaft sichern).');
    console.log('  Beenden: Strg+C\n');
  });
  function stop() { server.close(); setTimeout(function () { process.exit(0); }, 300).unref(); }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createChatServer: createChatServer, resolveStatic: resolveStatic, hostAllowed: hostAllowed, LIMITS: LIMITS, DEFAULT_ROOM: DEFAULT_ROOM, ROOT: ROOT };
if (require.main === module) main();
