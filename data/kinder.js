/* Offline-Ark – Inhalte für den Kinderbereich (window.OA_KINDER).
 * Einfache Sprache für Kinder von ca. 6–10 Jahren. Der deutsche Text ist zugleich der Schlüssel für das Wörterbuch (data/i18n/tool-kinder.js).
 * Wortlisten für das Buchstabenraten liegen je Sprache hier (keine Übersetzung nötig – sie sind direkt in der Sprache geschrieben). */
(function () {
  'use strict';

  var CARDS = [
    { id: 'stromausfall', icon: 'boltoff', title: 'Was ist ein Stromausfall?', blocks: [
      { t: 'list', items: [
        'Bei einem Stromausfall kommt kein Strom mehr aus der Steckdose.',
        'Dann gehen Licht, Fernseher und Herd nicht mehr an.',
        'Oft ist der Strom nach kurzer Zeit wieder da.',
        'Manchmal dauert es länger. Dann helfen uns die Erwachsenen.'
      ] }
    ] },
    { id: 'dunkel', icon: 'moon', title: 'Warum ist es dunkel und kalt?', blocks: [
      { t: 'list', items: [
        'Lampen brauchen Strom. Ohne Strom werden sie dunkel.',
        'Viele Heizungen brauchen auch Strom. Darum wird es nach und nach kühler.',
        'Wir ziehen uns warm an und kuscheln uns in Decken.',
        'Dunkel ist nicht schlimm. Mit einer Taschenlampe kannst du gut sehen.',
        'Wenn du Angst hast, sag es einem Erwachsenen. Das ist völlig in Ordnung.'
      ] }
    ] },
    { id: 'regeln', icon: 'shield', title: 'Was darf ich tun – und was nicht?', blocks: [
      { t: 'ok', head: 'Das darf ich:', items: [
        'Eine Taschenlampe benutzen.',
        'Mich in eine warme Decke kuscheln.',
        'Erwachsene fragen, wenn ich etwas nicht weiß.',
        'Spielen, malen, vorlesen lassen und singen.'
      ] },
      { t: 'no', head: 'Das mache ich nicht:', items: [
        'Kerzen anzünden oder allein brennen lassen.',
        'An den Ofen, den Herd oder ein Heizgerät gehen.',
        'Streichhölzer oder ein Feuerzeug anfassen.',
        'Allein nach draußen gehen.'
      ] }
    ] },
    { id: 'notruf', icon: 'aid', title: 'So rufe ich den Notruf 112', blocks: [
      { t: 'p', text: 'Die 112 rufst du nur an, wenn jemand dringend Hilfe braucht: bei Feuer, bei einem Unfall oder wenn jemand verletzt ist.' },
      { t: 'steps', items: [
        'Wähle die 112.',
        'Sag deinen Namen.',
        'Sag, wo du bist: Straße und Hausnummer.',
        'Sag, was passiert ist.',
        'Bleib am Telefon und warte. Lege erst auf, wenn man es dir sagt.'
      ] },
      { t: 'game', game: 'notruf', label: 'Notruf-Rollenspiel starten' }
    ] },
    { id: 'wasser', icon: 'drop', title: 'Wasser sparen', blocks: [
      { t: 'list', items: [
        'Wasser ist wertvoll, besonders wenn es weniger davon gibt.',
        'Zuerst trinken wir. Dann kommt das Waschen.',
        'Beim Zähneputzen bleibt der Hahn zu. Du nimmst einen Becher.',
        'Frag deine Eltern, wie viel Wasser wir haben.'
      ] }
    ] },
    { id: 'helfer', icon: 'users', title: 'Wer kann mir helfen?', blocks: [
      { t: 'p', text: 'Du bist nie allein. Diese Menschen helfen dir:' },
      { t: 'helpers', items: [
        { icon: 'users', text: 'Mama, Papa und die Familie' },
        { icon: 'home', text: 'Die Nachbarn' },
        { icon: 'book', text: 'Lehrerinnen, Lehrer und Erzieherinnen' },
        { icon: 'shield', text: 'Die Polizei (110)' },
        { icon: 'flame', text: 'Die Feuerwehr und der Rettungsdienst (112)' }
      ] },
      { t: 'p', text: 'Wenn du nicht weiterweißt: Sprich mit einem Erwachsenen.' }
    ] }
  ];

  /* Notruf-Rollenspiel: Die Leitstelle fragt, das Kind wählt die beste Antwort (a = richtige Antwort, Index). */
  var ROLEPLAY = [
    { q: 'Du hast die 112 gewählt. Die Frau am Telefon fragt: „Notruf 112. Wie heißt du?“',
      options: ['Ich heiße Mia.', 'Das sage ich nicht.', 'Hallo? Hallo?'], a: 0,
      good: 'Super! Du sagst deinen Namen.', hint: 'Fast. Sag deinen Namen, damit man dir gut helfen kann.' },
    { q: 'Sie fragt: „Wo bist du?“',
      options: ['Bei mir.', 'Ich bin in der Rosenstraße 5.', 'Das weiß ich nicht.'], a: 1,
      good: 'Prima! Straße und Hausnummer helfen den Helfern.', hint: 'Sag möglichst genau, wo du bist: Straße und Hausnummer.' },
    { q: 'Sie fragt: „Was ist passiert?“',
      options: ['Nichts.', 'Mir ist langweilig.', 'Mein Opa ist hingefallen und kann nicht aufstehen.'], a: 2,
      good: 'Genau! So wissen die Helfer, was los ist.', hint: 'Sag kurz, was passiert ist, zum Beispiel: Jemand ist verletzt.' },
    { q: 'Sie sagt: „Bleib bitte am Telefon.“ Was machst du?',
      options: ['Ich lege sofort auf.', 'Ich renne weg.', 'Ich bleibe dran und warte.'], a: 2,
      good: 'Richtig! Du wartest, bis man dir sagt, dass du auflegen darfst.', hint: 'Bleib am Telefon. Die Helfer haben vielleicht noch Fragen.' }
  ];

  /* Wörter ohne Sonderzeichen (keine Umlaute, ß, Akzente, Hamza), damit jedes Kind sie mit der Tastatur erraten kann. */
  var WORDS = {
    de: ['KATZE', 'HUND', 'SONNE', 'MOND', 'APFEL', 'BAUM', 'HAUS', 'WASSER', 'LICHT', 'DECKE', 'BUCH', 'BALL', 'FISCH', 'VOGEL', 'BLUME', 'STERN', 'BROT', 'MILCH', 'TISCH', 'KERZE', 'WOLKE', 'REGEN'],
    en: ['CAT', 'DOG', 'SUN', 'MOON', 'APPLE', 'TREE', 'HOUSE', 'WATER', 'LIGHT', 'BLANKET', 'BOOK', 'BALL', 'FISH', 'BIRD', 'FLOWER', 'STAR', 'BREAD', 'MILK', 'TABLE', 'CLOUD', 'RAIN', 'SNOW'],
    es: ['GATO', 'PERRO', 'SOL', 'LUNA', 'MANZANA', 'CASA', 'AGUA', 'LUZ', 'MANTA', 'LIBRO', 'PELOTA', 'PEZ', 'FLOR', 'PAN', 'LECHE', 'MESA', 'NUBE', 'LLUVIA', 'NIEVE', 'VELA', 'BOSQUE', 'ESTRELLA'],
    ar: ['شمس', 'قمر', 'بيت', 'كتاب', 'كلب', 'سمك', 'ورد', 'نجم', 'خبز', 'حليب', 'باب', 'شجر', 'طير', 'بحر', 'جبل', 'نهر', 'قلم', 'نور', 'ليل', 'ثلج', 'مطر', 'عنب']
  };
  var KEYBOARD = {
    de: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    es: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split(''),
    ar: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('')
  };

  /* Farben für das Malen (fest, auf weißem Blatt in allen Designs gut sichtbar) */
  var PAINT = [
    { id: 'black', name: 'Schwarz', color: '#1d1d1f' }, { id: 'red', name: 'Rot', color: '#e03131' }, { id: 'orange', name: 'Orange', color: '#f08c00' },
    { id: 'green', name: 'Grün', color: '#2f9e44' }, { id: 'blue', name: 'Blau', color: '#1c7ed6' }, { id: 'purple', name: 'Lila', color: '#9c36b5' }
  ];

  var MEMORY_ICONS = ['star', 'heart', 'sun', 'moon', 'leaf', 'drop', 'paw', 'bulb', 'flame', 'bolt', 'tent', 'book'];

  var api = { cards: CARDS, roleplay: ROLEPLAY, words: WORDS, keyboard: KEYBOARD, paint: PAINT, memoryIcons: MEMORY_ICONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OA_KINDER = api;
})();
