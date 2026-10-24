/* Offline-Ark – Funk-Spickzettel.
 * Kanaltabellen und Funkalphabete werden aus Daten erzeugt (weniger Tippfehler);
 * die Frequenzen stammen aus den Allgemeinzuteilungen der Bundesnetzagentur und
 * wurden mit den Wikipedia-Kanaltabellen abgeglichen (siehe „Quellen“ auf der Seite). */
(function () {
  'use strict';

  /* ---------- Daten ---------- */
  // Hz → deutsch formatierte MHz-Angabe, z. B. 446006250 → "446,00625"
  function mhz(hz, digits) { return (hz / 1e6).toFixed(digits).replace('.', ','); }

  var PMR = [], DPMR = [];
  for (var i = 0; i < 16; i++) PMR.push([i + 1, mhz(446006250 + i * 12500, 5)]);        // 12,5-kHz-Raster
  for (var j = 0; j < 32; j++) DPMR.push([j + 1, mhz(446003125 + j * 6250, 6)]);        // 6,25-kHz-Raster

  // Freenet: die sechs 12,5-kHz-Kanäle (übliche Zählung 1–6)
  var FREENET = [[1, '149,0250'], [2, '149,0375'], [3, '149,0500'], [4, '149,0875'], [5, '149,1000'], [6, '149,1125']];

  // CB-Funk Kanäle 1–40: Mittenfrequenzen laut Allgemeinzuteilung (Kanäle 23–25 sind nicht aufsteigend!)
  var CB_LOW = ['26,965', '26,975', '26,985', '27,005', '27,015', '27,025', '27,035', '27,055', '27,065', '27,075',
    '27,085', '27,105', '27,115', '27,125', '27,135', '27,155', '27,165', '27,175', '27,185', '27,205',
    '27,215', '27,225', '27,255', '27,235', '27,245', '27,265', '27,275', '27,285', '27,295', '27,305',
    '27,315', '27,325', '27,335', '27,345', '27,355', '27,365', '27,375', '27,385', '27,395', '27,405'];
  var CB = CB_LOW.map(function (f, k) { return [k + 1, f]; });
  for (var c = 41; c <= 80; c++) CB.push([c, mhz(26565000 + (c - 41) * 10000, 3)]);     // 26,565 … 26,955 MHz

  // Buchstabiertafeln: Deutsch (klassisch, DIN 5009 Ausgaben 1983/1996) und NATO/ICAO mit englische Aussprachehilfe (nach Wikipedia)
  var ALPHA = [
    ['A', 'Anton', 'Alfa', 'AL-FAH'], ['B', 'Berta', 'Bravo', 'BRAH-VOH'], ['C', 'Cäsar', 'Charlie', 'CHAR-LEE'],
    ['D', 'Dora', 'Delta', 'DELL-TAH'], ['E', 'Emil', 'Echo', 'ECK-OH'], ['F', 'Friedrich', 'Foxtrot', 'FOKS-TROT'],
    ['G', 'Gustav', 'Golf', 'GOLF'], ['H', 'Heinrich', 'Hotel', 'HO-TELL'], ['I', 'Ida', 'India', 'IN-DEE-AH'],
    ['J', 'Julius', 'Juliett', 'JEW-LEE-ETT'], ['K', 'Kaufmann', 'Kilo', 'KEY-LOH'], ['L', 'Ludwig', 'Lima', 'LEE-MAH'],
    ['M', 'Martha', 'Mike', 'MIKE'], ['N', 'Nordpol', 'November', 'NO-VEM-BER'], ['O', 'Otto', 'Oscar', 'OSS-CAH'],
    ['P', 'Paula', 'Papa', 'PAH-PAH'], ['Q', 'Quelle', 'Quebec', 'KEH-BECK'], ['R', 'Richard', 'Romeo', 'ROW-ME-OH'],
    ['S', 'Samuel', 'Sierra', 'SEE-AIR-RAH'], ['T', 'Theodor', 'Tango', 'TANG-GO'], ['U', 'Ulrich', 'Uniform', 'YOU-NEE-FORM'],
    ['V', 'Viktor', 'Victor', 'VIK-TAH'], ['W', 'Wilhelm', 'Whiskey', 'WISS-KEY'], ['X', 'Xanthippe', 'X-ray', 'ECKS-RAY'],
    ['Y', 'Ypsilon', 'Yankee', 'YANG-KEY'], ['Z', 'Zacharias', 'Zulu', 'ZOO-LOO'],
    ['Ä', 'Ärger', null, ''], ['Ö', 'Ökonom', null, ''], ['Ü', 'Übermut', null, ''],
    ['ß', 'Eszett', null, ''], ['Ch', 'Charlotte', null, ''], ['Sch', 'Schule', null, '']
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = { PMR: PMR, DPMR: DPMR, FREENET: FREENET, CB: CB, ALPHA: ALPHA };
if (typeof document === 'undefined') return;

/* ---------- Rendering ---------- */
  function table(rows, head, extraCls) {
    return '<div class="table-wrap"><table' + (extraCls ? ' class="' + extraCls + '"' : '') + '><thead><tr>' +
      head.map(function (h, k) { return '<th' + (k === head.length - 1 ? ' class="num"' : '') + '>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function chRows(list, mark) {
    return list.map(function (r) {
      return '<tr><td><strong>' + r[0] + '</strong>' + (mark && mark[r[0]] ? ' <span class="chip">' + mark[r[0]] + '</span>' : '') + '</td><td class="num">' + r[1] + '</td></tr>';
    }).join('');
  }
  function split(list, at, mark) {
    return '<div class="split">' + table(chRows(list.slice(0, at), mark), ['Kanal', 'MHz']) + table(chRows(list.slice(at), mark), ['Kanal', 'MHz']) + '</div>';
  }
  function put(id, html) { var n = document.getElementById(id); if (n) n.innerHTML = html; }

  put('pmr-table', split(PMR, 8));
  put('dpmr-table', split(DPMR, 16));
  put('freenet-table', table(chRows(FREENET), ['Kanal', 'MHz']));
  put('cb-table', split(CB, 40, { 9: 'Notruf (üblich)' }));
  put('abc-rows', ALPHA.map(function (a) {
    var nato = a[2] ? a[2] + ' <small class="muted">' + a[3] + '</small>' : '<span class="muted">–</span>';
    return '<tr data-s="' + (a[0] + ' ' + a[1] + ' ' + (a[2] || '') + ' ' + a[3]).toLowerCase() + '"><th scope="row" class="letter">' + a[0] + '</th><td>' + a[1] + '</td><td>' + nato + '</td></tr>';
  }).join(''));

  /* ---------- Suche im Funkalphabet ---------- */
  var search = document.getElementById('abc-search'), empty = document.getElementById('abc-empty');
  if (search) {
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase(), shown = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#abc-rows tr'), function (tr) {
        var hit = !q || tr.getAttribute('data-s').indexOf(q) >= 0;
        tr.hidden = !hit; if (hit) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ---------- Sprungmarken öffnen den Abschnitt ---------- */
  function openFromHash() {
    var id = location.hash.slice(1), d = id && document.getElementById(id);
    if (d && d.tagName === 'DETAILS') d.open = true;
  }
  window.addEventListener('hashchange', openFromHash);
  Array.prototype.forEach.call(document.querySelectorAll('.toc a'), function (a) {
    a.addEventListener('click', function () {
      var d = document.getElementById(a.getAttribute('href').slice(1));
      if (d && d.tagName === 'DETAILS') d.open = true;
    });
  });
  openFromHash();

  /* ---------- Drucken: alle Abschnitte aufklappen, danach Zustand wiederherstellen ---------- */
  var wasOpen = [];
  window.addEventListener('beforeprint', function () {
    wasOpen = Array.prototype.map.call(document.querySelectorAll('details'), function (d) { var o = d.open; d.open = true; return o; });
  });
  window.addEventListener('afterprint', function () {
    Array.prototype.forEach.call(document.querySelectorAll('details'), function (d, k) { if (wasOpen[k] !== undefined) d.open = wasOpen[k]; });
  });

})();
