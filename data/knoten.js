/* Offline-Ark – Knoten: Inhalte. Alle Texte sind deutsche Schlüssel für data/i18n/tool-knoten.js.
 * scene: Name einer Zeichnung aus data/knoten-szenen.js (animierte Schritte) – sonst Fotos + Textschritte.
 * Fachangaben: Wikipedia (de) zu den jeweiligen Knoten, frei zusammengefasst; Quellenlinks stehen je Knoten.
 * Fotos: Wikimedia Commons (gemeinfrei bzw. CC0), lokal in bibliothek/bilder/knoten/, Nachweis in bibliothek/bilder/ATTRIBUTION.md.
 * Das Foto „Schotstek links.jpg“ fehlt mit Absicht: Die Commons-Beschreibung nennt es „falscher Schotstek“ (Enden auf verschiedenen Seiten). */
(function () {
  'use strict';

  var CATS = [
    { id: 'festmachen', label: 'Festmachen' },
    { id: 'verbinden', label: 'Verbinden' },
    { id: 'schlinge', label: 'Schlinge' },
    { id: 'zelt', label: 'Zelt / Abspannen' },
    { id: 'stopper', label: 'Stopper' }
  ];

  var WP = 'https://de.wikipedia.org/wiki/';
  var CM = 'https://commons.wikimedia.org/wiki/File:';
  var KNOTS = [
    { id: 'kreuzknoten', title: 'Kreuzknoten', sub: 'Zwei Seile verbinden', cats: ['verbinden'], scene: 'reef',
      kw: 'kreuzknoten reffknoten rifknoten verbinden verband tuch bündel paket',
      purpose: 'Zwei Seile oder Tuchenden von gleicher Dicke verbinden, zum Beispiel einen Verband, ein Dreiecktuch oder ein Bündel.',
      avoid: 'Nicht zum Verbinden belasteter Seile (Klettern, Sichern, Abschleppen, Lasten heben): Unter Zug oder bei glatten oder ungleich dicken Seilen kann er sich lösen. Nicht mit dem Altweiberknoten verwechseln, der rutscht und sich festzieht.',
      steps: [
        { t: 'Seil A (dunkel) bildet eine offene Schlaufe. Beide Enden von A zeigen nach links.', reveal: { a: 99, b: 0 }, marks: [{ k: 'text', x: 20, y: 150, s: 'A' }] },
        { t: 'Seil B (blau, gestreift) kommt von rechts. Seine Mitte geht von rechts durch die Schlaufe von A.', reveal: { a: 99, b: 10 }, marks: [] },
        { t: 'Auch B bildet eine Schlaufe: Beide Enden von B zeigen nach rechts. Die Schlaufen haken ineinander wie zwei Kettenglieder.', reveal: { a: 99, b: 99 }, marks: [{ k: 'text', x: 480, y: 150, s: 'B' }] },
        { t: 'Probe: Jedes Seil hat beide Enden auf derselben Seite. Liegen die Enden eines Seils auf verschiedenen Seiten, ist es ein Altweiberknoten. Dann noch einmal von vorn.', reveal: { a: 99, b: 99 }, marks: [{ k: 'text', x: 20, y: 150, s: 'A' }, { k: 'text', x: 480, y: 150, s: 'B' }] },
        { t: 'Ziehe an allen vier Enden gleichmäßig, bis der Knoten fest sitzt. Für wichtige Verbindungen sicherst du beide Enden mit je einem Halbschlag.', reveal: { a: 99, b: 99 }, marks: [{ k: 'arrow', x: 8, y: 95, a: 180 }, { k: 'arrow', x: -58, y: 190, a: 180 }, { k: 'arrow', x: 492, y: 95, a: 0 }, { k: 'arrow', x: 558, y: 190, a: 0 }] }
      ],
      src: [{ l: 'Wikipedia (de): Kreuzknoten', u: WP + 'Kreuzknoten' }],
      credit: 'Aufbau der Zeichnung nach dem Diagramm „Square knot.svg“ (Wikimedia Commons, gemeinfrei); Kreuzungen rechnerisch geprüft.' },

    { id: 'achterknoten', title: 'Achterknoten', sub: 'Stopper am Seilende', cats: ['stopper'], scene: null,
      kw: 'achterknoten achtknoten stopper endknoten seilende figure eight',
      purpose: 'Stoppknoten am Seilende: Das Seil rutscht nicht durch Öse, Ring, Umlenkrolle oder Bremse. Er sitzt fest, lässt sich aber auch nach Belastung noch lösen.',
      avoid: 'Nicht als Ersatz für eine Ausbildung zum Sichern von Menschen. Als Stopper trägt er nichts, wenn das Seil viel dünner als das Loch ist, durch das es laufen soll.',
      steps: [
        { t: 'Das Ende, mit dem du knüpfst, ist das Arbeitsende (kurz). Das lange Seilstück ist das Standende.' },
        { t: 'Lege eine Schlaufe: Das Arbeitsende läuft über das Standende.' },
        { t: 'Führe das Arbeitsende hinter dem Standende herum.' },
        { t: 'Stecke das Arbeitsende von vorn durch die erste Schlaufe.' },
        { t: 'Ziehe Standende und Arbeitsende fest. Es entsteht eine liegende Acht. Lass das Arbeitsende mindestens eine Handbreit lang.' }
      ],
      src: [{ l: 'Wikipedia (de): Achterknoten', u: WP + 'Achterknoten' }] },

    { id: 'palstek', title: 'Palstek', sub: 'Feste Schlinge, die nicht zuzieht', cats: ['schlinge', 'festmachen'], scene: null,
      kw: 'palstek bulin bowline schlinge rettungsschlinge festmachen ring',
      purpose: 'Eine feste Schlinge ins Seilende knüpfen, die sich nicht zuzieht. Zum Festmachen an Ring, Pfosten oder Baum und als Rettungsschlinge für Menschen im Wasser. Er lässt sich auch nach Belastung noch öffnen.',
      avoid: 'Nicht allein zum Sichern von Menschen (Absturzgefahr) ohne Ausbildung. Bei wechselnder oder ruckartiger Last und bei steifen oder glatten Seilen kann er aufgehen: Sichere das Ende mit einem zusätzlichen Knoten.',
      warn: 'Der Palstek ist ein gängiger Festmacher- und Rettungsknoten. Für Rettung und Sicherung von Menschen nur mit Ausbildung benutzen.',
      steps: [
        { t: 'Lege eine kleine Schlaufe in das Seil, weit genug vom Ende entfernt: Das Standende liegt unten, das Arbeitsende oben. Die Schlaufe ist das „Loch“.' },
        { t: 'Führe das Arbeitsende von unten durch das Loch („der Hase kommt aus dem Loch“).' },
        { t: 'Führe es hinter dem Standende herum („um den Baum“).' },
        { t: 'Führe es wieder von oben in das Loch zurück („der Hase geht ins Loch“).' },
        { t: 'Halte das Arbeitsende und ziehe am Standende, bis der Knoten fest sitzt. Das Arbeitsende soll innen liegen und mindestens eine Handbreit überstehen.' }
      ],
      photos: [
        { f: 'palstek-innen.jpg', c: 'Palstek, Arbeitsende innen', by: 'Markus Bärlocher', lic: 'Public Domain', u: CM + 'Palstek_innen.jpg' },
        { f: 'palstek-aussen.jpg', c: 'Palstek, Arbeitsende außen', by: 'Markus Bärlocher', lic: 'Public Domain', u: CM + 'Palstek_aussen.jpg' }
      ],
      src: [{ l: 'Wikipedia (de): Palstek', u: WP + 'Palstek' }] },

    { id: 'mastwurf', title: 'Mastwurf (Webeleinenstek)', sub: 'Seil schnell an Pfahl oder Stange', cats: ['festmachen', 'zelt'], scene: null,
      kw: 'mastwurf webeleinenstek pfahl stange ast geländer festmachen zeltleine abspannen',
      purpose: 'Ein Seil schnell an einem Pfahl, Ast, Geländer oder einer Stange festmachen, auch in der Mitte eines Seils. Das Seil lässt sich leicht verschieben. Gut zum Anfang einer Zeltleine oder Plane.',
      avoid: 'Bei einseitiger Last oder wenn der Zug wechselt, kann er abrollen oder sich lockern. Sichere das lose Ende deshalb mit einem halben Schlag. Nicht zum Sichern von Menschen.',
      steps: [
        { t: 'Lege das Seil einmal um den Pfahl. Das Arbeitsende liegt vorn.' },
        { t: 'Führe das Arbeitsende noch einmal um den Pfahl und kreuze dabei über die erste Windung. Vorn entsteht ein X.' },
        { t: 'Schiebe das Arbeitsende unter die zweite Windung, zwischen Pfahl und Kreuzung.' },
        { t: 'Ziehe an beiden Seilenden: Der Knoten zieht sich um den Pfahl zusammen.' },
        { t: 'Sichere das lose Ende mit einem halben Schlag um das Standende, damit der Knoten nicht abrollt.' }
      ],
      photos: [
        { f: 'mastwurf-abok11.jpg', c: 'Mastwurf an einer Stange', by: 'USCG PTC Developer', lic: 'CC0', u: CM + 'Clove_Hitch_-_ABoK_11_-_USCG.jpg' },
        { f: 'webeleinenstek.jpg', c: 'Webeleinenstek (Mastwurf) an einem Baumstamm', by: 'Markus Bärlocher', lic: 'Public Domain', u: CM + 'Webeleinenstek.jpg' }
      ],
      src: [{ l: 'Wikipedia (de): Webeleinenstek', u: WP + 'Webeleinenstek' }] },

    { id: 'schotstek', title: 'Schotstek', sub: 'Zwei Seile verbinden', cats: ['verbinden'], scene: null,
      kw: 'schotstek schotenstich weberknoten sheet bend zwei seile verbinden ungleich dick',
      purpose: 'Zwei Seile von unterschiedlicher Dicke miteinander verbinden. Das dicke Seil bildet die Bucht.',
      avoid: 'Nicht bei sehr unterschiedlich dicken oder glatten, synthetischen Seilen, nicht bei ruckartigem Zug oder wenn das Seil zeitweise ganz ohne Zug ist: Er kann aufgehen und halbiert die Belastbarkeit. Nur für ständigen Zug; als Verbindung für Menschen nur mit Ausbildung.',
      steps: [
        { t: 'Das dicke Seil: Lege am Ende eine Bucht (U-Form).' },
        { t: 'Das dünne Seil: Führe das Ende von hinten durch die Bucht.' },
        { t: 'Führe es hinter beiden Seiten der Bucht herum.' },
        { t: 'Stecke das Ende unter dem eigenen Seil hindurch: unter dem Seilstück, das zur Bucht läuft.' },
        { t: 'Ziehe beide Seile fest. Zum Üben gut; für wichtige Verbindungen den „doppelten Schotstek“ (eine zweite Runde) nehmen.' }
      ],
      src: [{ l: 'Wikipedia (de): Schotstek', u: WP + 'Schotstek' }] },

    { id: 'zimmermannsstek', title: 'Zimmermannsstek', sub: 'Balken ziehen und anheben', cats: ['festmachen'], scene: null,
      kw: 'zimmermannsstek zimmermannsschlag zimmermannsknoten timber hitch balken holz ziehen heben',
      purpose: 'Ein Seil an einem Balken, Brett oder Rundholz befestigen, um es zu ziehen oder anzuheben. Unter Zug zieht er sich zu und hält durch Reibung.',
      avoid: 'Er hält nur auf Zug und löst sich, wenn die Last abgelegt wird. Bei langen Objekten zusätzlich einen halben Schlag in Zugrichtung legen. Nicht zum Sichern von Menschen.',
      steps: [
        { t: 'Lege das Seil einmal um das Holz.' },
        { t: 'Führe das lose Ende um das feste Seilstück (das Standende) herum.' },
        { t: 'Wickle das lose Ende danach mindestens zwei- bis dreimal um sich selbst (um den eigenen Seilteil).' },
        { t: 'Ziehe am Standende: Der Knoten zieht sich zu. Bei langem Holz setze noch einen halben Schlag in Zugrichtung.' }
      ],
      photos: [{ f: 'zimmermannsstek.jpg', c: 'Zimmermannsstek um einen Baumstamm', by: 'Markus Bärlocher', lic: 'Public Domain', u: CM + 'Zimmermannsknoten.jpg' }],
      src: [{ l: 'Wikipedia (de): Zimmermannsstek', u: WP + 'Zimmermannsstek' }] },

    { id: 'halbeschlaege', title: 'Rundtörn mit zwei halben Schlägen', sub: 'Sicher festmachen und abspannen', cats: ['festmachen', 'zelt'], scene: null,
      kw: 'rundtörn zwei halbe schläge halbschlag zelt abspannen plane tarp ring pfahl festmachen round turn',
      purpose: 'Ein Seil sicher an Pfahl, Stange, Ring oder Baum festmachen, zum Beispiel für Zeltleinen, Planen und Tarps. Er hält auch unter Zug und lässt sich unter Spannung binden und lösen.',
      avoid: 'Nicht zum Sichern von Menschen. Die beiden halben Schläge müssen dieselbe Drehrichtung haben, sonst entsteht ein anderer Knoten (Ankerstich).',
      steps: [
        { t: 'Lege das Seil zweimal um Pfahl oder Ring (ein Rundtörn: zwei Windungen). Dabei hält die Reibung schon einen Teil der Last.' },
        { t: 'Führe das Arbeitsende um das Standende herum und stecke es durch die Schlaufe, die entsteht: der erste halbe Schlag.' },
        { t: 'Mache einen zweiten halben Schlag direkt daneben, in derselben Drehrichtung.' },
        { t: 'Ziehe beide halben Schläge fest an das Standende. Das Arbeitsende soll nicht zu kurz sein.' }
      ],
      src: [{ l: 'Wikipedia (de): Rundtörn mit zwei halben Schlägen', u: WP + 'Rundt%C3%B6rn_mit_zwei_halben_Schl%C3%A4gen' }] }
  ];

  var api = { CATS: CATS, KNOTS: KNOTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_KNOTEN_DATA = api;
})();
