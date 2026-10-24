/* Test des Chat-Servers: node scripts/test-chat.js
 * Startet den Server auf einem zufälligen Port, prüft Chat-API, Grenzen, PIN, Long-Polling,
 * statische Auslieferung (MIME, Pfad-Traversal, versteckte Ordner), Host-/Origin-Schutz und Log-Datei.
 * Beendet danach alle Server und löscht Test-Log und Test-Dateien. */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
var chat = require(path.join(__dirname, '..', 'server', 'chat-server.js'));
var logFile = path.join(__dirname, 'chat-test-log.json');
var mimeDir = path.join(chat.ROOT, 'docs', 'mime-test-tmp');

function req(port, opt, body) {
  return new Promise(function (resolve, reject) {
    var headers = Object.assign({ Host: '127.0.0.1:' + port }, opt.headers || {});
    var data = body === undefined ? null : (typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    if (data !== null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (data !== null) headers['Content-Length'] = Buffer.byteLength(data);
    var r = http.request({ host: '127.0.0.1', port: port, method: opt.method || 'GET', path: opt.path, headers: headers, agent: false }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8'), json = null;
        try { json = JSON.parse(text); } catch (e) { /* kein JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, text: text, json: json });
      });
    });
    r.on('error', reject);
    if (data !== null) r.write(data);
    r.end();
  });
}
function start(opts) {
  return new Promise(function (resolve) {
    var s = chat.createChatServer(opts);
    s.listen(0, '127.0.0.1', function () { resolve({ server: s, port: s.address().port }); });
  });
}
function stop(s) {
  return new Promise(function (resolve) {
    s.close(function () { resolve(); });
    if (s.closeAllConnections) s.closeAllConnections();
  });
}
var passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; }
function eq(a, b, msg) { assert.strictEqual(a, b, msg); passed++; }
function send(port, body, extra) { return req(port, Object.assign({ method: 'POST', path: '/api/chat/send' }, extra || {}), body); }
function sleep(ms) { return new Promise(function (x) { setTimeout(x, ms); }); }

async function main() {
  try { fs.unlinkSync(logFile); } catch (e) { /* nicht vorhanden */ }
  var A = await start({ log: logFile }), p = A.port, r;

  /* --- Chat-API --- */
  r = await req(p, { path: '/api/chat/info' });
  eq(r.status, 200); eq(r.json.pinRequired, false); eq(r.json.defaultRoom, 'Nachbarschaft');
  r = await send(p, { name: 'Anna', text: 'Hallo zusammen', room: 'Nachbarschaft' });
  eq(r.status, 201); ok(r.json.message.id > 0, 'id'); eq(r.json.message.name, 'Anna'); ok(Math.abs(r.json.message.ts - Date.now()) < 5000, 'ts');
  var firstId = r.json.message.id;
  r = await send(p, { name: 'Ben', text: 'Wir brauchen Wasser' });                 // ohne Raum -> Standardraum
  eq(r.status, 201); eq(r.json.message.room, 'Nachbarschaft');
  r = await req(p, { path: '/api/chat/messages?room=' + encodeURIComponent('Nachbarschaft') });
  eq(r.status, 200); eq(r.json.messages.length, 2); eq(r.json.messages[1].text, 'Wir brauchen Wasser');
  eq(r.headers['content-type'], 'application/json; charset=utf-8'); eq(r.headers['x-content-type-options'], 'nosniff');
  r = await req(p, { path: '/api/chat/messages?since=' + firstId });
  eq(r.json.messages.length, 1); eq(r.json.messages[0].name, 'Ben'); eq(r.json.last, r.json.messages[0].id);
  r = await req(p, { path: '/api/chat/messages?room=Keller' });
  eq(r.json.messages.length, 0);
  eq((await req(p, { path: '/api/chat/messages?since=abc' })).status, 400);
  eq((await req(p, { path: '/api/chat/messages?since=-1' })).status, 400);
  eq((await send(p, { name: 'Cem', text: 'Raumtest', room: 'Keller' })).status, 201);
  r = await req(p, { path: '/api/chat/rooms' });
  ok(r.json.rooms.some(function (x) { return x.name === 'Keller' && x.count === 1; }), 'Raum Keller');
  ok(r.json.rooms.some(function (x) { return x.name === 'Nachbarschaft'; }), 'Standardraum');

  /* --- XSS bleibt Text, Steuerzeichen/Bidi werden entfernt --- */
  var xss = '<img src=x onerror=alert(1)><script>alert("x")</script>';
  r = await send(p, { name: '<b>Eve</b>', text: xss, room: '<i>Raum</i>' });
  eq(r.status, 201); eq(r.json.message.text, xss); eq(r.json.message.name, '<b>Eve</b>');
  r = await req(p, { path: '/api/chat/messages?room=' + encodeURIComponent('<i>Raum</i>') });
  eq(r.json.messages[0].text, xss, 'XSS-String unverändert als Text');
  ok(/^application\/json/.test(r.headers['content-type']), 'JSON statt HTML');
  r = await send(p, { name: 'Zed\u202E', text: 'a\u0000b\u202Ec\r\nd\ne' });
  eq(r.json.message.name, 'Zed'); eq(r.json.message.text, 'abc\nd\ne');

  /* --- Grenzen --- */
  eq((await send(p, { name: 'x'.repeat(31), text: 'ok' })).status, 400);
  eq((await send(p, { name: 'x'.repeat(30), text: 'ok' })).status, 201);
  eq((await send(p, { name: 'A', text: 'y'.repeat(1001) })).json.error, 'text_too_long');
  eq((await send(p, { name: 'A', text: 'y'.repeat(1000) })).status, 201);
  eq((await send(p, { name: '', text: 'ok' })).status, 400);
  eq((await send(p, { name: 'A', text: '   ' })).status, 400);
  eq((await send(p, { name: 'A', text: 5 })).status, 400);
  eq((await send(p, { name: 'A', text: 'ok', room: 'r'.repeat(31) })).status, 400);
  eq((await send(p, '{kaputt')).status, 400);
  eq((await send(p, '[1,2]')).status, 400);
  eq((await send(p, 'x'.repeat(9000))).status, 413);
  eq((await send(p, { name: 'A', text: 'ok' }, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  eq((await req(p, { path: '/api/chat/send' })).status, 405);
  eq((await send(p, { name: 'A', text: 'ok' }, { headers: { Origin: 'http://evil.example' } })).status, 403);
  eq((await send(p, { name: 'A', text: 'ok' }, { headers: { Origin: 'http://127.0.0.1:' + p } })).status, 201);
  eq((await req(p, { path: '/api/chat/unbekannt' })).status, 404);

  /* --- Host-Header (DNS-Rebinding) --- */
  eq((await req(p, { path: '/api/chat/info', headers: { Host: 'evil.example.com' } })).status, 403);
  eq((await req(p, { path: '/index.html', headers: { Host: 'evil.example.com:8080' } })).status, 403);
  eq((await req(p, { path: '/api/chat/info', headers: { Host: 'raspberrypi.local:8080' } })).status, 200);
  eq((await req(p, { path: '/api/chat/info', headers: { Host: 'raspberrypi' } })).status, 200);
  ok(chat.hostAllowed('192.168.1.5:8080') && chat.hostAllowed('[::1]:8080') && !chat.hostAllowed('a.b.c') && !chat.hostAllowed(''), 'hostAllowed');

  /* --- Long-Polling --- */
  var cur = (await req(p, { path: '/api/chat/messages?room=Poll' })).json.last;
  var t0 = Date.now();
  var waiting = req(p, { path: '/api/chat/messages?room=Poll&since=' + cur + '&wait=10' });
  await sleep(300);
  await send(p, { name: 'Dora', text: 'Wecker', room: 'Poll' });
  r = await waiting;
  ok(Date.now() - t0 < 3000, 'Long-Polling antwortet sofort bei neuer Nachricht'); eq(r.json.messages.length, 1); eq(r.json.messages[0].text, 'Wecker');
  t0 = Date.now();
  r = await req(p, { path: '/api/chat/messages?room=Poll&since=' + r.json.last + '&wait=1' });
  ok(Date.now() - t0 >= 900 && r.json.messages.length === 0, 'Long-Polling läuft ohne Nachricht aus');

  /* --- statische Dateien --- */
  r = await req(p, { path: '/' }); eq(r.status, 200); ok(/text\/html/.test(r.headers['content-type']), 'index.html');
  var mimes = { '/css/style.css': 'text/css', '/js/common.js': 'text/javascript', '/data/tools.js': 'text/javascript', '/js/qr-encoder.js': 'text/javascript' };
  for (var f in mimes) {
    r = await req(p, { path: f }); eq(r.status, 200, f);
    ok(r.headers['content-type'].indexOf(mimes[f]) === 0, 'MIME ' + f + ' ' + r.headers['content-type']); ok(!!r.headers.etag, 'ETag');
  }
  r = await req(p, { path: '/css/style.css' });
  r = await req(p, { path: '/css/style.css', headers: { 'If-None-Match': r.headers.etag } }); eq(r.status, 304);
  r = await req(p, { path: '/css/style.css', method: 'HEAD' }); eq(r.status, 200); eq(r.text, '');
  ok(r.headers['cache-control'].indexOf('max-age') > 0, 'Cache-Control');
  r = await req(p, { path: '/index.html' }); ok(!!r.headers['content-security-policy'], 'CSP für HTML');
  eq((await req(p, { path: '/index.html', method: 'POST' }, 'x')).status, 405);
  eq((await req(p, { path: '/css' })).status, 301);
  var mimeFiles = [['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.webp', 'image/webp'], ['.pdf', 'application/pdf'],
    ['.webmanifest', 'application/manifest+json'], ['.json', 'application/json'], ['.html', 'text/html']];
  fs.mkdirSync(mimeDir, { recursive: true });
  try {
    mimeFiles.forEach(function (m) { fs.writeFileSync(path.join(mimeDir, 'm' + m[0]), 'x'); });
    for (var i = 0; i < mimeFiles.length; i++) {
      r = await req(p, { path: '/docs/mime-test-tmp/m' + mimeFiles[i][0] }); eq(r.status, 200, mimeFiles[i][0]);
      ok(r.headers['content-type'].indexOf(mimeFiles[i][1]) === 0, 'MIME ' + mimeFiles[i][0] + ' = ' + r.headers['content-type']);
    }
  } finally {
    await sleep(300);   // Windows löscht Dateien erst, wenn der Server sie freigegeben hat
    fs.readdirSync(mimeDir).forEach(function (fn) { fs.unlinkSync(path.join(mimeDir, fn)); });
    fs.rmdirSync(mimeDir);
  }

  /* --- Pfad-Traversal und versteckte Dateien: nie 200 --- */
  var bad = [
    '/../package.json', '/../../../../Windows/win.ini', '/..%2f..%2fserver/chat-server.js', '/%2e%2e/%2e%2e/etc/passwd',
    '/css/../../x', '/css/%2e%2e/%2e%2e/x', '/%2e%2e%2fserver%2fchat-server.js', '/css/..%5c..%5cserver', '/..\\server\\chat-server.js',
    '/index.html%00.png', '/%00', '/.git/config', '/.git/', '/.gitattributes', '/.env', '/css/.hidden', '/server/chat-server.js', '/server/', '/server',
    '/SERVER/chat-server.js', '/Server/README.md', '/scripts/test-chat.js', '/scratch/', '/node_modules/x', '/index.html::$DATA', '/index.html.', '/index.html%20',
    '/%', '/%zz', '//server/chat-server.js', '/./server/chat-server.js', '/css/./../server/chat-server.js', '/server/chat-log.json'
  ];
  for (var k = 0; k < bad.length; k++) {
    r = await req(p, { path: bad[k] });
    ok(r.status === 400 || r.status === 403 || r.status === 404, 'Traversal ' + bad[k] + ' -> ' + r.status);
    ok(r.text.indexOf('createChatServer') < 0 && r.text.indexOf('[extensions]') < 0, 'kein Quelltext ausgeliefert: ' + bad[k]);
  }
  eq((await req(p, { path: '/../package.json' })).status, 403);
  var rs = chat.resolveStatic('/css/style.css'); ok(rs.file && rs.file.indexOf(chat.ROOT) === 0, 'resolveStatic');
  eq(chat.resolveStatic('/a/../../b').status, 403);

  /* --- Persistenz: Log schreiben und wieder lesen --- */
  await stop(A.server);
  ok(fs.existsSync(logFile), 'Log-Datei geschrieben');
  var saved = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  ok(saved.rooms['Nachbarschaft'].length >= 2 && saved.nextId > 5, 'Log-Inhalt');
  var B = await start({ log: logFile });
  r = await req(B.port, { path: '/api/chat/messages?room=Nachbarschaft' });
  ok(r.json.messages.some(function (m) { return m.text === 'Hallo zusammen'; }), 'Nachrichten nach Neustart da');
  r = await send(B.port, { name: 'Neu', text: 'nach Neustart' });
  ok(r.json.message.id >= saved.nextId, 'IDs laufen weiter');
  await stop(B.server);
  try { fs.unlinkSync(logFile); } catch (e) { /* weg */ }

  /* --- Rate-Limit (20 Nachrichten/Minute) --- */
  var C = await start({}), codes = [];
  for (var n = 0; n < 22; n++) codes.push((await send(C.port, { name: 'Spam', text: 'm' + n })).status);
  eq(codes.filter(function (c) { return c === 201; }).length, 20, '20 erlaubt');
  eq(codes[20], 429); eq(codes[21], 429);
  ok(!!(await send(C.port, { name: 'Spam', text: 'x' })).headers['retry-after'], 'Retry-After');
  await stop(C.server);

  /* --- 500 Nachrichten je Raum, höchstens 20 Räume (Limits für den Test gelockert) --- */
  var D = await start({ limits: { sendsPerMin: 100000, requestsPerMin: 100000 } });
  for (var q = 0; q < 520; q++) await send(D.port, { name: 'N', text: 'Nachricht ' + q, room: 'Voll' });
  r = await req(D.port, { path: '/api/chat/messages?room=Voll&limit=200' });
  eq(r.json.messages.length, 200); eq(r.json.messages[199].text, 'Nachricht 519');
  eq(D.server.chatStore.rooms['Voll'].length, 500); eq(D.server.chatStore.rooms['Voll'][0].text, 'Nachricht 20');
  for (var rr = 0; rr < 25; rr++) await send(D.port, { name: 'N', text: 'x', room: 'Raum' + rr });
  ok(Object.keys(D.server.chatStore.rooms).length <= 20, 'höchstens 20 Räume');
  eq((await send(D.port, { name: 'N', text: 'x', room: 'NochEiner' })).status, 409);
  await stop(D.server);

  /* --- PIN --- */
  var E = await start({ pin: 'geheim42' });
  eq((await req(E.port, { path: '/api/chat/info' })).json.pinRequired, true);
  eq((await req(E.port, { path: '/api/chat/messages' })).status, 401);
  eq((await send(E.port, { name: 'A', text: 'ohne PIN' })).status, 401);
  eq((await req(E.port, { path: '/api/chat/messages', headers: { 'X-Chat-Pin': 'falsch' } })).status, 401);
  eq((await send(E.port, { name: 'A', text: 'mit PIN' }, { headers: { 'X-Chat-Pin': 'geheim42' } })).status, 201);
  eq((await req(E.port, { path: '/api/chat/messages', headers: { 'X-Chat-Pin': 'geheim42' } })).json.messages.length, 1);
  var last = 0;
  for (var z = 0; z < 12; z++) last = (await req(E.port, { path: '/api/chat/messages', headers: { 'X-Chat-Pin': 'g' + z } })).status;
  eq(last, 429, 'PIN-Raten wird gebremst');
  eq((await req(E.port, { path: '/api/chat/messages', headers: { 'X-Chat-Pin': 'geheim42' } })).status, 200, 'richtige PIN geht weiter');
  eq((await req(E.port, { path: '/index.html' })).status, 200, 'statische Seiten bleiben ohne PIN erreichbar');
  await stop(E.server);

  console.log('Chat-Server: alle Tests bestanden (' + passed + ' Prüfungen)');
}
main().then(function () { process.exit(0); }, function (e) {
  console.error(e);
  try { fs.unlinkSync(logFile); } catch (x) { /* ok */ }
  process.exit(1);
});
