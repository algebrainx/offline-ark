/* Offline-Ark – Funk-Buchstabieralphabete für das Quiz (window.OA_ALPHA).
 * Identisch mit ALPHA in js/tool-funk.js (scripts/test-quiz.js prüft das).
 * [Buchstabe, Deutsch (klassisch, DIN 5009 Ausgaben 1983/1996), NATO/ICAO oder null, Aussprachehilfe] */
(function (root) {
  'use strict';
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
  root.OA_ALPHA = ALPHA;
  if (typeof module !== 'undefined' && module.exports) module.exports = ALPHA;
})(typeof window !== 'undefined' ? window : this);
