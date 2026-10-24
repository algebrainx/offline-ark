/* Offline-Ark – Daten und Suchlogik für "Tierspuren" (data/tierspuren.js).
 *
 * Maße (Länge x Breite eines Trittsiegels, in cm) und Merkmale stammen NUR aus geprüften Quellen und sind als "ca." zu lesen.
 * Wo eine Zahl nicht belegt ist, steht sie nicht in den Daten (null). Die Quelle jeder Maßangabe steht bei "src".
 *  - trittsiegel: Wikipedia "Trittsiegel", Tabelle "Auswahl von Trittsiegeln mit ihren Merkmalen" (CC BY-SA 4.0),
 *    die sich auf Haseder/Stinglwagner, Knaurs Großes Jagdlexikon (2000) stützt. Länge: Spitze der längsten Zehe bis hinterer
 *    Rand des Sohlenballens; Breite: breiteste Stelle. VP = Vorderpfote, HP = Hinterpfote.
 *  - wolf: Wikipedia "Wolf" (Trittsiegel 8-10 cm lang, 7-9 cm breit, Schnürspur 1,1-1,4 m Schrittlänge) und DBBW "Wolf, Portrait"
 *    (4 Zehen und Ballen abgedrückt, geschnürter Trab). Das Jagdlexikon gibt für den Wolf etwas größere Werte an (bis 12 cm);
 *    hier steht die vorsichtigere Angabe, die Suche lässt aber 1 cm Spielraum.
 *  - rotfuchs: Wikipedia "Rotfuchs" (Schnüren, Abstand etwa 30 cm). reh: Wikipedia "Reh" (Schrittlänge 35-45 cm).
 *  - faehrte: Wikipedia "Fährte" (Schnürfährte bei Luchs, Wolf, Fuchs; Haushunde traben meist versetzt, manche Hunde schnüren aber auch).
 *  - Wikipedia "Europäischer Biber" (fünf Finger vorn, Schwimmhäute hinten) und "Eurasisches Eichhörnchen" (vorn vier Finger, hinten fünf Zehen).
 * Sicherheitshinweise: DBBW-FAQ (Wolf), BfN "Wolfsverhalten", DJV-Tiersteckbriefe (Wildschwein, Waschbär). */
(function () {
  'use strict';

  var TOL = 1;   // cm Spielraum bei der Längensuche (Boden, Schnee, Gangart verändern Abdrücke)

  /* sizes: Maße je Pfote. part: 'any' | 'front' | 'hind' | 'hind-heel'.  claws: 'yes' | 'rare' | 'no' | null (unbekannt).
   * toes: sichtbare Zehen im Abdruck (2 = Hufhälften/Schalen) oder null (unbekannt). */
  var ANIMALS = [
    { id: 'reh', name: 'Reh', la: 'Capreolus capreolus', group: 'Paarhufer', shape: 'deer', toes: [2], claws: 'no',
      sizes: [{ part: 'any', len: [4, 5], wid: null, src: 'trittsiegel' }],
      features: ['Zwei schmale, spitze Hufhälften (Schalen). Vorn stehen sie dicht beieinander, hinten sind sie deutlich getrennt.',
        'Die kleinste Huftierspur.',
        'Die Afterklauen (kleine Zehen hinter den Schalen) drücken sich nur bei der Flucht oder im tiefen Boden ab.'],
      gait: 'Im Schritt ist ein Schritt etwa 35 bis 45 cm lang. Der Hinterlauf tritt ungefähr in die Spur des Vorderlaufs.' },
    { id: 'wildschwein', name: 'Wildschwein', la: 'Sus scrofa', group: 'Paarhufer', shape: 'boar', toes: [2], claws: 'no',
      sizes: [{ part: 'any', len: [3, 8], wid: [2.5, 7.6], src: 'trittsiegel' }],
      features: ['Zwei Hufhälften (Schalen). Dahinter sieht man in deutlichen Abdrücken oft zwei Afterklauen.',
        'Die Afterklauen (das „Geäfter“) stehen weiter außen und sind breiter als die Schalen.',
        'Die zusammenlaufenden Schalen ergeben vorn oft eine Kerbe.'] },
    { id: 'rothirsch', name: 'Rothirsch', la: 'Cervus elaphus', group: 'Paarhufer', shape: 'stag', toes: [2], claws: 'no',
      sizes: [],
      features: ['Zwei Hufhälften (Schalen). Der abgedrückte Ballen macht etwa 25 bis 30 Prozent der Gesamtlänge aus. Beim Damwild sind es etwa 50 bis 60 Prozent.',
        'Größer als die Rehspur (die Rehspur ist die kleinste Huftierspur). Genaue Maße sind hier nicht angegeben, weil sie in unseren Quellen fehlen.'],
      biggerThan: 'reh' },
    { id: 'fuchs', name: 'Fuchs', la: 'Vulpes vulpes', group: 'Hundeartige', shape: 'fox', toes: [4], claws: 'yes',
      sizes: [{ part: 'any', len: [5, 5], wid: [4.5, 4.5], src: 'trittsiegel' }],
      features: ['Schmaler, ovaler Abdruck mit vier Zehen und kleinen Fußballen. Die beiden mittleren Zehen liegen etwas weiter vorn.',
        'Scharfe Krallenspuren.',
        'Kreuz-Test: Beim Fuchs lässt sich zwischen die Zehenballen ein Kreuz einzeichnen.'],
      gait: 'Schnürspur: Beim schnellen Trab tritt die Hinterpfote in den Abdruck der Vorderpfote. Die Abdrücke liegen wie an einer Schnur, etwa 30 cm auseinander.' },
    { id: 'feldhase', name: 'Feldhase', la: 'Lepus europaeus', group: 'Hasenartige', shape: 'hare', toes: [4, 5], claws: 'yes',
      sizes: [{ part: 'front', len: [5, 5], wid: [3, 3], src: 'trittsiegel' }, { part: 'hind', len: [6, 6], wid: [3.5, 3.5], src: 'trittsiegel' }],
      features: ['Am Vorderfuß sind es 5 Zehen, im Abdruck sind aber meist nur 4 zu sehen.',
        'Die Abdrücke der spitzen Krallen sind meist sichtbar. Die Sohle ist dicht behaart.',
        'Im Schnee oder bei gespreizten Zehen können die Abdrücke viel größer sein.'] },
    { id: 'dachs', name: 'Dachs', la: 'Meles meles', group: 'Marderartige', shape: 'badger', toes: [5], claws: 'yes',
      sizes: [{ part: 'any', len: [5, 5], wid: [5, 5.5], src: 'trittsiegel' }],
      features: ['Breiter Abdruck mit breitem, nierenförmigem Ballen.',
        'Fünf Zehen, die in einem leichten Bogen über dem Ballen liegen.',
        'Große, gut erkennbare Krallenspuren.'] },
    { id: 'waschbaer', name: 'Waschbär', la: 'Procyon lotor', group: 'Kleinbären', shape: 'raccoon', toes: [5], claws: null,
      sizes: [{ part: 'front', len: [4, 6], wid: [7, 7], src: 'trittsiegel' }, { part: 'hind', len: [4, 5], wid: [6, 7], src: 'trittsiegel' }, { part: 'hind-heel', len: [9, 10], wid: null, src: 'trittsiegel' }],
      features: ['Fünf lange Zehen. Der Abdruck sieht aus wie eine Kinderhand.',
        'Der Hauptballen ist gut sichtbar. Der Fersenballen drückt sich selten ab, zum Beispiel beim Sitzen.',
        'Die Hinterpfote steht oft neben der Vorderpfote.'] },
    { id: 'wolf', name: 'Wolf', la: 'Canis lupus', group: 'Hundeartige', shape: 'wolf', toes: [4], claws: 'yes',
      sizes: [{ part: 'any', len: [8, 10], wid: [7, 9], src: 'wolf' }],
      features: ['Länglich-oval, etwa 1 cm länger als breit. Die Vorderpfote ist etwas größer als die Hinterpfote.',
        'Es werden 4 Zehen und der Ballen abgedrückt.',
        'Kräftige, gerade ausgerichtete Krallenabdrücke.'],
      gait: 'Schnürspur: Beim geschnürten Trab tritt die Hinterpfote genau in den Abdruck der Vorderpfote. Ein Schritt ist dabei etwa 1,1 bis 1,4 m lang.' },
    { id: 'marder', name: 'Marder (Baum- und Steinmarder)', la: 'Martes martes, Martes foina', group: 'Marderartige', shape: 'marten', toes: [5], claws: 'yes',
      sizes: [{ part: 'any', len: [3.5, 4], wid: [3, 3], src: 'trittsiegel' }],
      features: ['Fünf Zehenballen, die nicht immer gut zu sehen sind. Sie sind kommaförmig um den Hauptballen angeordnet.',
        'Kurze Krallen.',
        'Beim Baummarder wirkt die Spur verwischt, weil die Pfoten unten stark behaart sind.'] },
    { id: 'eichhoernchen', name: 'Eichhörnchen', la: 'Sciurus vulgaris', group: 'Nagetiere', shape: 'squirrel', toes: [4, 5], claws: null,
      sizes: [],
      features: ['Vorderfuß: 4 sichtbare, schlanke Zehen (die fünfte ist stark zurückgebildet und nicht zu sehen).',
        'Hinterfuß: 5 schlanke Zehen.'] },
    { id: 'biber', name: 'Biber', la: 'Castor fiber', group: 'Nagetiere', shape: 'beaver', toes: [5], claws: 'rare',
      sizes: [{ part: 'front', len: [5, 7], wid: [4.5, 4.5], src: 'trittsiegel' }, { part: 'hind', len: [12, 17], wid: [10, 10], src: 'trittsiegel' }],
      features: ['Die große Hinterpfote hat Schwimmhäute, die man auf weichem Boden gut sieht.',
        'Zehen und Krallen hinterlassen keine klaren Abdrücke.',
        'Der Abdruck der Hauptballen ist manchmal gut sichtbar.'] },
    { id: 'hund', name: 'Hund', la: 'Canis lupus familiaris', group: 'Hundeartige', shape: 'dog', toes: [4], claws: 'yes',
      sizes: [],
      features: ['Relativ runder Abdruck mit großen Fußkissen und vier Zehenkissen nahe am Fußkissen.',
        'Die Krallenspitzen liegen näher an den Ballen als beim Wolf.',
        'Länge und Breite sind je nach Rasse sehr verschieden.',
        'Kreuz-Test: Beim Hund lässt sich zwischen die Zehenballen kein Kreuz einzeichnen.'],
      gait: 'Beim Trab setzen Hunde die Pfoten meist versetzt. Einige Hunde schnüren aber auch. Schau daher immer genau auf den einzelnen Abdruck.' },
    { id: 'katze', name: 'Hauskatze', la: 'Felis catus', group: 'Katzen', shape: 'cat', toes: [4], claws: 'rare',
      sizes: [{ part: 'any', len: [2.5, 4.5], wid: [2.5, 4.5], src: 'trittsiegel' }],
      features: ['Fast runder Abdruck (Kreis von etwa 2,5 bis 4,5 cm Durchmesser) mit vier gut sichtbaren Zehenballen.',
        'Der Hauptballen ist dreieckig oder nierenförmig.',
        'Die Krallen sind einziehbar und drücken sich selten ab.'] }
  ];

  var SAFETY = {
    title: 'Sicherheit bei Wildtieren',
    items: [
      { id: 'wolf', title: 'Wolf', items: [
        'Wölfe meiden Menschen meist. Wenn du einen Wolf siehst: ruhig bleiben, stehen bleiben und Abstand halten.',
        'Wenn die Situation unheimlich ist: nicht weglaufen, sondern langsam rückwärts gehen und dabei laut sprechen.',
        'Kommt der Wolf näher: anhalten, ihn anschreien, in die Hände klatschen und dich groß machen.',
        'In Wolfsgebieten den Hund anleinen und nahe bei dir führen.',
        'Wölfe nie füttern und nie anlocken. Gefütterte Wölfe verbinden Menschen mit Futter und können aufdringlich werden.'] },
      { id: 'wildschwein', title: 'Wildschwein', items: [
        'Keiler haben starke Eckzähne, die zu schweren Verletzungen führen können. Halte Abstand.',
        'Eine Bache (Mutter) mit neugeborenen Frischlingen verliert die Furcht vor Menschen und greift an, wenn man sich ihrem Nest nähert.',
        'Schnaufen oder Blasen ist eine Warnung: Das Tier ist beunruhigt. Halte dann Abstand.'] },
      { id: 'waschbaer', title: 'Waschbär', items: [
        'Waschbären können Krankheiten übertragen, zum Beispiel Staupe auf Haustiere und in manchen Regionen den Waschbärspulwurm auf Menschen. Fasse sie nicht an.'] }
    ]
  };

  var COMPARE = {
    title: 'Wolf oder Hund?',
    intro: 'Eine sichere Bestimmung ist schwer. Achte auf mehrere Merkmale zugleich. Im Zweifel bleibt die Frage offen.',
    cols: ['Merkmal', 'Wolf', 'Hund'],
    rows: [
      ['Form', 'länglich-oval, etwa 1 cm länger als breit', 'relativ rund'],
      ['Krallen', 'kräftig, gerade ausgerichtet, weiter von den Ballen entfernt', 'Spitzen näher an den Ballen'],
      ['Größe', 'ca. 8 bis 10 cm lang, 7 bis 9 cm breit', 'sehr unterschiedlich je nach Rasse'],
      ['Spurbild', 'meist Schnürspur: Hinterpfote genau im Abdruck der Vorderpfote', 'meist versetzte Abdrücke, aber manche Hunde schnüren auch']
    ],
    note: 'Wenn du eine Wolfsspur vermutest: Melde die Beobachtung der zuständigen Stelle deines Bundeslandes. Die Ansprechpartner stehen bei der Dokumentations- und Beratungsstelle des Bundes zum Thema Wolf (DBBW).'
  };

  var SOURCES = [
    { name: 'Wikipedia – Trittsiegel (Tabelle nach Knaurs Großes Jagdlexikon)', url: 'https://de.wikipedia.org/wiki/Trittsiegel', license: 'CC BY-SA 4.0', note: 'Maße (Länge x Breite) und Merkmale der Trittsiegel' },
    { name: 'Wikipedia – Fährte', url: 'https://de.wikipedia.org/wiki/F%C3%A4hrte', license: 'CC BY-SA 4.0', note: 'Schnürspur, Spuren von Hund und Fuchs' },
    { name: 'Wikipedia – Wolf', url: 'https://de.wikipedia.org/wiki/Wolf', license: 'CC BY-SA 4.0', note: 'Größe der Wolfsspur, Schrittlänge beim Schnüren' },
    { name: 'Wikipedia – Rotfuchs', url: 'https://de.wikipedia.org/wiki/Rotfuchs', license: 'CC BY-SA 4.0', note: 'Schnürspur des Fuchses' },
    { name: 'Wikipedia – Reh', url: 'https://de.wikipedia.org/wiki/Reh', license: 'CC BY-SA 4.0', note: 'Schrittlänge des Rehs' },
    { name: 'Wikipedia – Europäischer Biber', url: 'https://de.wikipedia.org/wiki/Europ%C3%A4ischer_Biber', license: 'CC BY-SA 4.0', note: 'Finger und Schwimmhäute des Bibers' },
    { name: 'Wikipedia – Eurasisches Eichhörnchen', url: 'https://de.wikipedia.org/wiki/Eurasisches_Eichh%C3%B6rnchen', license: 'CC BY-SA 4.0', note: 'Finger und Zehen des Eichhörnchens' },
    { name: 'DBBW – Der Wolf: Portrait', url: 'https://www.dbb-wolf.de/Wolf_Steckbrief/portrait', license: '© DBBW – nur in eigenen Worten zusammengefasst', note: 'Zehen, Abdruck und Gangart des Wolfes' },
    { name: 'DBBW – FAQ: Wie soll ich mich verhalten, wenn ich einem Wolf begegne?', url: 'https://www.dbb-wolf.de/mehr/faq/wie-soll-ich-mich-verhalten-wenn-ich-einem-wolf-begegne', license: '© DBBW – nur in eigenen Worten zusammengefasst', note: 'Verhalten bei einer Wolfsbegegnung' },
    { name: 'DBBW – FAQ: Was ist, wenn ich bei einem Hundespaziergang einen Wolf treffe?', url: 'https://www.dbb-wolf.de/mehr/faq/was-ist-wenn-ich-bei-einem-hundespaziergang-einen-wolf-treffe', license: '© DBBW – nur in eigenen Worten zusammengefasst', note: 'Hund anleinen und nahe bei sich führen' },
    { name: 'DBBW – FAQ: Dürfen/sollen Wölfe gefüttert werden?', url: 'https://www.dbb-wolf.de/mehr/faq/duerfen-sollen-woelfe-gefuettert-werden', license: '© DBBW – nur in eigenen Worten zusammengefasst', note: 'Wölfe nicht füttern oder anlocken' },
    { name: 'BfN – Wolfsverhalten: Einschätzung und Handlungsempfehlungen (PDF)', url: 'https://www.bfn.de/sites/default/files/BfN/artenschutz/Dokumente/wolfsverhalten.pdf', license: '© BfN – nur in eigenen Worten zusammengefasst', note: 'Gefahr durch angefütterte Wölfe' },
    { name: 'DJV – Tiersteckbrief Wildschwein', url: 'https://www.jagdverband.de/zahlen-fakten/tiersteckbriefe/wildschwein-sus-scrofa', license: '© DJV – nur in eigenen Worten zusammengefasst', note: 'Eckzähne der Keiler, Verhalten der Bache, Warnlaute' },
    { name: 'DJV – Tiersteckbrief Waschbär', url: 'https://www.jagdverband.de/zahlen-fakten/tiersteckbriefe/waschbaer-procyon-lotor', license: '© DJV – nur in eigenen Worten zusammengefasst', note: 'Krankheiten, die der Waschbär übertragen kann' }
  ];
  var SRC_IDS = ['trittsiegel', 'wolf'];

  /* ---------- Suche (Mini-Bestimmer) ---------- */
  function inRanges(sizes, len) {
    return sizes.some(function (s) { return len >= s.len[0] - TOL && len <= s.len[1] + TOL; });
  }

  /**
   * criteria: { len: Zahl in cm | null, claws: 'yes' | 'no' | null, toes: 2 | 4 | 5 | null }
   * Ergebnis: { any, fit: [Einträge], maybe: [Einträge] }; Eintrag = { animal, notes: [Schlüssel] }.
   * fit = alle angegebenen Merkmale passen; maybe = nichts widerspricht, aber ein Merkmal ist unbekannt oder nur schwach.
   * Ein hartes "passt nicht" gibt es bei der Länge (außerhalb der Maße +- 1 cm), der Zehenzahl und bei Krallen an Huftieren.
   */
  function identify(criteria, animals) {
    animals = animals || ANIMALS;
    var c = criteria || {};
    var hasLen = c.len != null && isFinite(c.len) && c.len > 0, hasClaws = c.claws === 'yes' || c.claws === 'no', hasToes = c.toes != null;
    var res = { any: hasLen || hasClaws || hasToes, fit: [], maybe: [] };
    if (!res.any) return res;
    animals.forEach(function (a) {
      var weak = [], bad = false;
      if (hasLen) {
        if (a.sizes.length) { if (!inRanges(a.sizes, c.len)) bad = true; }
        else if (a.biggerThan) {
          var ref = animals.filter(function (x) { return x.id === a.biggerThan; })[0];
          if (ref && ref.sizes.length) { var m = Math.max.apply(null, ref.sizes.map(function (s) { return s.len[1]; })); if (c.len < m - TOL) bad = true; else weak.push('len'); }
          else weak.push('len');
        } else weak.push('len');
      }
      if (hasToes) {
        if (a.toes == null) weak.push('toes');
        else if (a.toes.indexOf(Number(c.toes)) < 0) bad = true;
      }
      if (hasClaws) {
        if (a.claws == null) weak.push('claws');
        else if (c.claws === 'yes') { if (a.claws === 'no') bad = true; else if (a.claws === 'rare') weak.push('claws'); }
        else if (a.claws === 'yes') weak.push('claws');
      }
      if (bad) return;
      (weak.length ? res.maybe : res.fit).push({ animal: a, notes: weak });
    });
    return res;
  }

  /** Bereichstext aus [a, b]: "4" oder "4–5" (Zahlen nach Sprache über fmt). */
  function range(r, fmt) { return r[0] === r[1] ? fmt(r[0]) : fmt(r[0]) + '–' + fmt(r[1]); }

  var API = { TOL: TOL, animals: ANIMALS, safety: SAFETY, compare: COMPARE, sources: SOURCES, srcIds: SRC_IDS, identify: identify, range: range };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.OA_TIERSPUREN = API;
})();
