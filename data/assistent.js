/* Offline-Ark – Notfall-Assistent: Entscheidungsbaum (window.OA_ASSISTENT).
 *
 * Alle Anweisungen stammen aus unseren geprüften Wissensseiten (content/erste-hilfe.md, content/stromausfall.md)
 * und sind dort nachzulesen. Wo die Seiten vorsichtiger formulieren (Verbrennungen kühlen, Abbinden,
 * Seitenlage nach schwerem Unfall), gilt hier die vorsichtigere Fassung. Keine Medikamente, keine Dosierungen,
 * keine Diagnosen. Wer erweitert: neuen Text zuerst in data/i18n/tool-assistent.js übersetzen
 * und dann `node scripts/test-assistent.js` laufen lassen.
 *
 * Aufbau (der deutsche Text ist zugleich der Übersetzungsschlüssel; **fett** ist erlaubt):
 *   nodes[id] = {
 *     type:    'menu' | 'question' | 'result'
 *     e:       true  -> roter Notruf-Streifen (112) bleibt sichtbar (Lebensgefahr)
 *     title:   kurze Überschrift
 *     lead:    (result) ein Satz zur Lage
 *     text:    (menu/question) die Frage
 *     steps:   Liste von Imperativ-Sätzen (bei question: "Tu jetzt", bei result: Schritt für Schritt)
 *     notes:   [{ k: 'info'|'warn'|'danger', t: 'Titel', x: 'Text' }]
 *     answers: [{ t: 'Ja', to: 'nächsteId', icon: 'alert' }]      (menu/question)
 *     next:    [{ t: 'Weiter, wenn …', to: 'nächsteId' }]          (result: Anschluss, z. B. "Atmung hat aufgehört")
 *     links:   [{ tool: 'metronom', t: 'Beschriftung' }]           (Werkzeug in tools/)
 *     more:    [['erste-hilfe', 'hlw']]                            (Wissensseite + Ankerschlüssel aus `anchors`)
 *   }
 * Ein Ergebnis ohne `next` ist ein Ende. Jeder Pfad endet nach höchstens ~7 Fragen in einem Ergebnis. */
(function () {
  'use strict';

  var YES = 'Ja', NO = 'Nein', DK = 'Weiß nicht';
  function a(t, to, icon) { var o = { t: t, to: to }; if (icon) o.icon = icon; return o; }

  /* Anker (Überschriften-IDs der erzeugten Wissensseiten) je Sprache.
     scripts/test-assistent.js prüft, dass jede ID in knowledge/<sprache>/<seite>.html wirklich existiert. */
  var ANCHORS = {
    'erste-hilfe': {
      title: 'Erste Hilfe',
      first:        { de: 'die-ersten-schritte-bei-jedem-notfall', en: 'first-steps-in-every-emergency', es: 'los-primeros-pasos-en-cualquier-emergencia', ar: 'الخطوات-الاولى-في-كل-حالة-طواري' },
      seitenlage:   { de: 'bewusstlos-aber-normale-atmung-stabile-seitenlage', en: 'unconscious-but-breathing-normally-recovery-position', es: 'inconsciente-pero-respira-con-normalidad-posicion-lateral-de-seguridad', ar: 'فاقد-الوعي-لكنه-يتنفس-بشكل-طبيعي-الوضعية-الجانبية-الثابتة' },
      hlw:          { de: 'wiederbelebung-erwachsene', en: 'resuscitation-adults', es: 'reanimacion-adultos', ar: 'الانعاش-القلبي-الريوي-للبالغين' },
      blutung:      { de: 'starke-blutung', en: 'severe-bleeding', es: 'hemorragia-grave', ar: 'النزيف-الشديد' },
      schock:       { de: 'schock', en: 'shock', es: 'shock', ar: 'الصدمة' },
      verbrennung:  { de: 'verbrennungen-und-verbruehungen', en: 'burns-and-scalds', es: 'quemaduras-y-escaldaduras', ar: 'الحروق-والسلق' },
      kaelte:       { de: 'unterkuehlung', en: 'hypothermia', es: 'hipotermia', ar: 'انخفاض-حرارة-الجسم' },
      hitze:        { de: 'hitzschlag-und-sonnenstich', en: 'heat-stroke-and-sunstroke', es: 'golpe-de-calor-e-insolacion', ar: 'ضربة-الحرارة-وضربة-الشمس' },
      ersticken:    { de: 'verschlucken-und-ersticken', en: 'swallowing-and-choking', es: 'atragantamiento-y-asfixia', ar: 'الاختناق-وابتلاع-جسم-غريب' },
      knochenbruch: { de: 'knochenbruch', en: 'broken-bone', es: 'fractura-osea', ar: 'كسر-العظم' },
      vergiftung:   { de: 'vergiftung', en: 'poisoning', es: 'intoxicacion', ar: 'التسمم' },
      co:           { de: 'kohlenmonoxid-co', en: 'carbon-monoxide-co', es: 'monoxido-de-carbono-co', ar: 'اول-اكسيد-الكربون-co' }
    },
    'stromausfall': {
      title: 'Stromausfall-Leitfaden',
      first: { de: 'die-ersten-minuten', en: 'the-first-minutes', es: 'los-primeros-minutos', ar: 'الدقايق-الاولى' }
    }
  };

  var NOTE_NOT = { k: 'warn', t: 'Das nicht tun', x: 'Brandblasen nicht öffnen. Keine Salben oder Hausmittel. Festgeklebte Kleidung nicht abreißen.' };
  var STILL_BREATHING = 'Die Atmung hat aufgehört';

  var NODES = {
    /* ---------- Start ---------- */
    start: {
      type: 'menu', title: 'Start', text: 'Was ist passiert?',
      answers: [
        a('Person bewusstlos, reagiert nicht', 'u1', 'alert'),
        a('Starke Blutung', 'b1', 'drop'),
        a('Verbrennung, Verbrühung', 'v1', 'flame'),
        a('Verschlucken, Ersticken', 'e1', 'aid'),
        a('Kälte, Unterkühlung', 'k1', 'cloud'),
        a('Hitze, Hitzschlag', 'h1', 'sun'),
        a('Vergiftung, Kohlenmonoxid', 'g1', 'jar'),
        a('Knochenbruch, Sturz', 'f1', 'steps'),
        a('Stromausfall', 's1', 'boltoff'),
        a('Etwas anderes, unsicher', 'o1', 'question')
      ]
    },

    /* ---------- Person reagiert nicht ---------- */
    u1: {
      type: 'question', e: true, title: 'Schritt 1: Eigenschutz',
      text: 'Ist die Umgebung sicher? Denke an Verkehr, Feuer, Strom und Gas.',
      answers: [a('Ja, sicher', 'u2'), a('Nein, es droht Gefahr', 'u_danger'), a(DK, 'u_danger')]
    },
    u_danger: {
      type: 'result', e: true, title: 'Zuerst die Gefahr abwenden',
      steps: [
        'Bring dich nicht selbst in Gefahr.',
        'Bei Strom: Schalte zuerst den Strom ab. Fass die Person nie direkt an.',
        'Bei Gasen oder Rauch: Rette nicht selbst, wenn du dich damit gefährdest.',
        'Ruf **112** an und sag, was du vermutest.',
        'Ist die Gefahr vorbei, kümmere dich um die Person.'
      ],
      next: [a('Die Gefahr ist vorbei', 'u2')],
      more: [['erste-hilfe', 'first']]
    },
    u2: {
      type: 'question', e: true, title: 'Schritt 2: Ansprechen',
      text: 'Sprich die Person laut an und rüttle vorsichtig an den Schultern. Reagiert sie?',
      answers: [a('Ja, sie reagiert', 'u_ok'), a('Nein, keine Reaktion', 'u3'), a(DK, 'u3')]
    },
    u_ok: {
      type: 'result', title: 'Die Person reagiert',
      steps: [
        'Bleib bei der Person. Prüfe immer wieder Atmung und Bewusstsein.',
        'Wähle jetzt, was passiert ist, zum Beispiel eine starke Blutung.',
        'Ruf im Zweifel **112**.'
      ],
      next: [a('Zur Auswahl: Was ist passiert?', 'start'), a('Die Person reagiert nicht mehr', 'u3')],
      more: [['erste-hilfe', 'first']]
    },
    u3: {
      type: 'question', e: true, title: 'Schritt 3: Hilfe holen, Atmung prüfen',
      steps: [
        'Ruf laut um Hilfe.',
        'Wähle **112** und schalte den Lautsprecher ein. Sag: Wo ist es? Was ist passiert? Wie viele Verletzte?',
        'Warte auf Rückfragen. Leg erst auf, wenn die Leitstelle das Gespräch beendet.',
        'Neige den Kopf sanft nach hinten und hebe das Kinn an. Sieh, hör und fühl höchstens **10 Sekunden** lang nach Atem.'
      ],
      text: 'Atmet die Person normal? Schnappen oder Röcheln ist **keine** normale Atmung.',
      notes: [{ k: 'info', t: 'Kein Netz, 112 geht nicht?', x: 'Schick jemanden los oder ruf laut um Hilfe. Wenn die Notrufnummern nicht mehr funktionieren, geh möglichst zur nächsten Polizeiwache oder ins Krankenhaus (Rat des BBK).' }],
      answers: [a('Ja, normal', 'u4'), a('Nein, nicht normal oder gar nicht', 'u5'), a(DK, 'u5')]
    },
    u4: {
      type: 'question', e: true, title: 'Schritt 4: Unfall?',
      text: 'Gab es einen schweren Unfall, zum Beispiel einen Sturz aus großer Höhe oder einen Verkehrsunfall?',
      answers: [a(YES, 'u_trauma'), a(NO, 'u_seite'), a(DK, 'u_trauma')]
    },
    u_seite: {
      type: 'result', e: true, title: 'Stabile Seitenlage',
      lead: 'Bewusstlos, aber normale Atmung: Die Seitenlage hält die Atemwege frei. Erbrochenes kann abfließen.',
      steps: [
        'Knie dich seitlich neben die Person. Strecke ihre Beine. Lege den nahen Arm angewinkelt nach oben.',
        'Greife den fernen Arm am Handgelenk. Lege den Handrücken an ihre Wange. Lass die Hand nicht los.',
        'Beuge das ferne Bein am Oberschenkel.',
        'Ziehe die Person zu dir herüber. Richte das obere Bein im rechten Winkel aus.',
        'Überstrecke den Hals leicht. Öffne den Mund ein Stück. Die Hand an der Wange hält den Kopf in dieser Lage.',
        'Ist **112** schon gerufen? Wenn nicht, ruf jetzt an.',
        'Prüfe immer wieder Atmung und Bewusstsein. Hört die Atmung auf: auf den Rücken drehen und wiederbeleben.'
      ],
      next: [a(STILL_BREATHING, 'u5')],
      more: [['erste-hilfe', 'seitenlage']]
    },
    u_trauma: {
      type: 'result', e: true, title: 'Nach schwerem Unfall: Hals schützen',
      lead: 'Nach einem Sturz aus großer Höhe oder einem Verkehrsunfall kann der Hals verletzt sein. Die Leitlinien raten dann von der Seitenlage ab.',
      steps: [
        'Ist **112** schon gerufen? Wenn nicht, ruf jetzt an.',
        'Dreh die Person nur, wenn es für die Atmung nötig ist.',
        'Dreh sie mit Hilfe als Einheit: Kopf und Körper bleiben in einer Linie.',
        'Prüfe immer wieder Atmung und Bewusstsein.',
        'Hört die Atmung auf: Beginne mit der Wiederbelebung.'
      ],
      notes: [{ k: 'info', t: 'Warum anders als sonst?', x: 'Das DRK nennt die Seitenlage allgemein. Hier gilt die vorsichtigere Angabe der Leitlinien.' }],
      next: [a(STILL_BREATHING, 'u5')],
      more: [['erste-hilfe', 'seitenlage']]
    },
    u5: {
      type: 'question', e: true, title: 'Schritt 4: Alter',
      text: 'Ist die Person ein Säugling oder ein Kind?',
      answers: [a('Ja, Säugling oder Kind', 'u_hlw_kind'), a('Nein, Erwachsene oder Erwachsener', 'u_hlw'), a(DK, 'u_hlw')]
    },
    u_hlw: {
      type: 'result', e: true, title: 'Wiederbelebung: Erwachsene',
      lead: 'Die Person reagiert nicht und atmet nicht normal. Im Zweifel: drücken.',
      steps: [
        'Ruf **112** (Lautsprecher an), falls noch nicht geschehen. Lass einen **AED (Defibrillator)** holen, wenn einer da ist.',
        'Knie dich neben die Person. Sie liegt auf dem Rücken, am besten auf festem Boden.',
        'Lege den Handballen in die Mitte des Brustkorbs, die zweite Hand darauf. Die Arme bleiben gestreckt, die Schultern senkrecht darüber.',
        'Drücke **5 bis 6 cm** tief, **100 bis 120 Mal pro Minute**. Lass den Brustkorb nach jedem Druck ganz zurückfedern.',
        'Ohne Übung oder wenn du nicht beatmen willst: **nur durchgehend drücken.** Mit Übung: nach 30 Mal Drücken 2 Mal beatmen (30:2).',
        'Kommt ein AED: Schalte ihn ein und folge den Sprachansagen. Drück weiter, bis das Gerät analysiert.',
        'Hör nicht auf. Wechselt euch etwa alle 2 Minuten ab, wenn ihr mehrere seid.'
      ],
      notes: [{ k: 'info', t: 'Keine Angst vor Rippenbrüchen', x: 'Leben retten ist wichtiger.' }],
      links: [{ tool: 'metronom', t: 'Takt zum Mitdrücken öffnen' }],
      next: [a('Die Person atmet wieder normal', 'u4')],
      more: [['erste-hilfe', 'hlw']]
    },
    u_hlw_kind: {
      type: 'result', e: true, title: 'Wiederbelebung: Kinder und Säuglinge',
      lead: 'Die Person reagiert nicht und atmet nicht normal. Folge der Leitstelle.',
      steps: [
        'Ruf **112** und folge den Anweisungen der Leitstelle. Lass einen AED holen, wenn einer da ist.',
        'Drücke bei Kindern etwa **ein Drittel der Brusttiefe**. Bei Säuglingen drücke mit zwei Daumen.',
        'Das Tempo ist wie bei Erwachsenen: **100 bis 120 Mal pro Minute**.',
        'Nach den Leitlinien 2025 sollen Ungeübte bei Kindern zuerst 5 Mal beatmen, dann **30:2** weitermachen (30 Mal drücken, 2 Mal beatmen).',
        'Kannst oder willst du nicht beatmen: nur drücken.',
        'Ein AED hat oft einen Kindermodus. Folge den Sprachansagen.',
        'Bist du allein und ohne Telefon: Wiederbelebe zuerst 1 Minute, dann hol Hilfe.'
      ],
      links: [{ tool: 'metronom', t: 'Takt zum Mitdrücken öffnen' }],
      next: [a('Die Person atmet wieder normal', 'u4')],
      more: [['erste-hilfe', 'hlw']]
    },

    /* ---------- Starke Blutung ---------- */
    b1: {
      type: 'question', e: true, title: 'Starke Blutung stoppen',
      steps: [
        'Drücke mit einem sauberen Tuch fest auf die Wunde. Bleib dran und lass nicht nach.',
        'Lege die Person hin. Halte verletzte Arme oder Beine hoch, wenn kein Bruch vermutet wird.',
        'Ruf **112**.'
      ],
      text: 'Blutet es an einem Arm oder Bein trotz festem Druck lebensgefährlich weiter?',
      answers: [a(YES, 'b_tourniquet'), a('Nein, der Druck reicht', 'b_verband'), a(DK, 'b_verband')]
    },
    b_verband: {
      type: 'result', e: true, title: 'Druckverband anlegen',
      steps: [
        'Lege eine Kompresse auf die Wunde.',
        'Wickle eine Mullbinde 2- bis 3-mal darum.',
        'Lege ein Druckpolster darauf, zum Beispiel ein Verbandpäckchen.',
        'Wickle mehrfach darüber und klebe die Binde fest.',
        'Decke die Person zu und halte sie warm.'
      ],
      notes: [{ k: 'info', t: 'Fremdkörper in der Wunde', x: 'Sie bleiben stecken. Polstere sie nur ringsum ab.' }],
      next: [a('Blass, kalte feuchte Haut, Zittern?', 'sh1')],
      more: [['erste-hilfe', 'blutung']]
    },
    b_tourniquet: {
      type: 'result', e: true, title: 'Abbinden: nur als letzte Möglichkeit',
      lead: 'Nur bei lebensgefährlicher Blutung an Arm oder Bein, wenn Druck nicht reicht.',
      steps: [
        'Nimm ein Tourniquet oder ein Tuch, mindestens **5 cm** breit. Nimm nie Draht oder Schnürsenkel.',
        'Lege es zwischen Wunde und Herz, nie auf ein Gelenk.',
        'Schreib die Uhrzeit auf.',
        'Ist **112** schon gerufen? Wenn nicht, ruf jetzt an. Die Person gehört sofort in den Rettungsdienst.',
        'Decke die Person zu und halte sie warm.'
      ],
      next: [a('Blass, kalte feuchte Haut, Zittern?', 'sh1')],
      more: [['erste-hilfe', 'blutung']]
    },
    sh1: {
      type: 'result', e: true, title: 'Schock',
      lead: 'Schock heißt: Der Körper bekommt zu wenig Blut. Anzeichen: blass, kalte feuchte Haut, Zittern, Unruhe, später Teilnahmslosigkeit.',
      steps: [
        'Ruf **112**.',
        'Lege die Person hin, die Beine hoch, wenn sie bei Bewusstsein ist.',
        'Decke sie zu und beruhige sie. Bleib bei ihr.',
        'Bewusstlos mit normaler Atmung: stabile Seitenlage. Ohne Atmung: Wiederbelebung.'
      ],
      next: [a('Die Person reagiert nicht mehr', 'u2')],
      more: [['erste-hilfe', 'schock']]
    },

    /* ---------- Verbrennung, Verbrühung ---------- */
    v1: {
      type: 'question', e: true, title: 'Verbrennung: Gefahr beenden',
      steps: [
        'Bring die Person aus der Gefahr.',
        'Brennt die Kleidung: Ersticke die Flammen mit einer Decke, lösche mit Wasser oder wälze die Person am Boden.',
        'Bei Strom: Schalte zuerst den Strom ab. Fass die Person nie direkt an.'
      ],
      text: 'Ist die Verbrennung groß (mehr als etwa zwei DIN-A4-Seiten), im Gesicht, oder ist die Person ein Kind oder Säugling?',
      answers: [a(YES, 'v_gross'), a(NO, 'v_klein'), a(DK, 'v_gross')]
    },
    v_klein: {
      type: 'result', title: 'Kleine Verbrennung kühlen',
      steps: [
        'Bei Verbrühung: Zieh nasse, heiße Kleidung rasch, aber vorsichtig aus.',
        'Kühle die Stelle mit kühlem, **nicht eisigem** Wasser. Kein Eis.',
        'Brich ab, sobald die Person friert.',
        'Decke die Wunde locker mit einem sterilen Verband oder Frischhaltefolie ab.',
        'Halte die Person warm.'
      ],
      notes: [
        { k: 'warn', t: 'Fachleute sind sich bei der Kühlung nicht einig', x: 'Das DRK nennt mindestens 20 Minuten, andere Angaben etwa 2 bis 20 Minuten. Hier gilt die vorsichtigere Regel: Kühle nur kleine Flächen und brich ab, sobald die Person friert.' },
        NOTE_NOT
      ],
      more: [['erste-hilfe', 'verbrennung']]
    },
    v_gross: {
      type: 'result', e: true, title: 'Große Verbrennung, Gesicht oder Kind',
      steps: [
        'Ruf **112**.',
        'Kühle **nichts Großes**. Bei großen Flächen und bei Säuglingen und Kleinkindern droht Unterkühlung.',
        'Im Gesicht kühle nur mit feuchten Tüchern. Die Atemwege bleiben frei.',
        'Decke die Wunde locker mit einem sterilen Verband oder Frischhaltefolie ab.',
        'Halte die Person warm.'
      ],
      notes: [NOTE_NOT],
      more: [['erste-hilfe', 'verbrennung']]
    },

    /* ---------- Verschlucken, Ersticken ---------- */
    e1: {
      type: 'question', e: true, title: 'Verschlucken oder Ersticken',
      text: 'Kann die Person nicht sprechen, nicht atmen oder hustet sie nur pfeifend?',
      answers: [a(YES, 'e2'), a(NO, 'e_other'), a(DK, 'e_other')]
    },
    e2: {
      type: 'question', e: true, title: 'Alter',
      text: 'Ist die Person ein Säugling?',
      answers: [a(YES, 'e_saeugling'), a(NO, 'e_erw')]
    },
    e_erw: {
      type: 'result', e: true, title: 'Verschluckt: Erwachsene und Kinder',
      steps: [
        'Fordere die Person zum Husten auf.',
        'Hilft das nicht: Beuge sie nach vorn. Gib bis zu **5 kräftige Schläge zwischen die Schulterblätter**.',
        'Dann bis zu **5 Bauchstöße**: Stell dich dahinter, Faust zwischen Nabel und Brustbeinende, andere Hand darum, kräftig nach hinten oben ziehen.',
        'Wechsle ab, bis der Fremdkörper frei ist. Ruf **112**.',
        'Wird die Person bewusstlos: Beginne mit der Wiederbelebung.'
      ],
      notes: [{ k: 'warn', t: 'Das nicht tun', x: 'Greif nicht blind in den Mund. Lass jeden, der Bauchstöße bekam, später ärztlich untersuchen.' }],
      next: [a('Die Person ist bewusstlos', 'u5')],
      more: [['erste-hilfe', 'ersticken']]
    },
    e_saeugling: {
      type: 'result', e: true, title: 'Verschluckt: Säugling',
      steps: [
        'Ruf **112**.',
        'Gib bis zu **5 Schläge auf den Rücken**. Der Kopf liegt tiefer als der Körper.',
        'Dann bis zu **5 Stöße auf das Brustbein**. **Keine** Bauchstöße.',
        'Wird das Kind bewusstlos: Beginne mit der Wiederbelebung.'
      ],
      notes: [{ k: 'warn', t: 'Das nicht tun', x: 'Greif nicht blind in den Mund.' }],
      next: [a('Das Kind ist bewusstlos', 'u_hlw_kind')],
      more: [['erste-hilfe', 'ersticken']]
    },
    e_other: {
      type: 'result', e: true, title: 'Atemnot ohne Verschlucken',
      lead: 'Dafür enthält Offline-Ark keine eigene Anleitung.',
      steps: [
        'Ruf **112**.',
        'Bleib bei der Person und beruhige sie.',
        'Sag der Leitstelle, was du siehst. Warte auf Rückfragen und folge den Anweisungen.'
      ],
      next: [a('Die Person reagiert nicht mehr', 'u2'), a('Verdacht auf Kohlenmonoxid', 'g_co')],
      more: [['erste-hilfe', 'first']]
    },

    /* ---------- Kälte ---------- */
    k1: {
      type: 'question', title: 'Kälte',
      text: 'Was trifft zu?',
      answers: [
        a('Die Person zittert vor Kälte', 'k_leicht'),
        a('Kaum Reaktion, steife Muskeln, langsame Atmung', 'k_schwer'),
        a('Haut weiß oder bläulich und gefühllos', 'k_erfrierung'),
        a(DK, 'k_schwer')
      ]
    },
    k_leicht: {
      type: 'result', e: true, title: 'Unterkühlung: zittert vor Kälte',
      steps: [
        'Ruf **112**. Bring die Person an einen warmen, windgeschützten Ort.',
        'Zieh nasse Kleidung vorsichtig aus. Wickle die Person in trockene Decken. Isoliere sie auch gegen den kalten Boden.',
        'Ist sie bei Bewusstsein: Gib warme, gezuckerte Getränke. **Kein Alkohol.**',
        'Nicht reiben, keine Wärmflasche.'
      ],
      next: [a('Die Person reagiert kaum noch', 'k_schwer')],
      more: [['erste-hilfe', 'kaelte']]
    },
    k_schwer: {
      type: 'result', e: true, title: 'Starke Unterkühlung',
      lead: 'Kaum Reaktion, steife Muskeln, langsame Atmung.',
      steps: [
        'Ruf **112**.',
        'Mach **keine Aufwärmversuche** mehr. Behandle die Person vorsichtig.',
        'Zieh nasse Kleidung vorsichtig aus. Decke die Person zu und isoliere sie gegen den kalten Boden.',
        'Prüfe immer wieder die Atmung.'
      ],
      next: [a('Die Person ist bewusstlos', 'u2')],
      more: [['erste-hilfe', 'kaelte']]
    },
    k_erfrierung: {
      type: 'result', title: 'Erfrierung',
      lead: 'Weiße oder bläuliche, gefühllose Haut.',
      steps: [
        'Reibe die Stelle nicht und bewege sie nicht.',
        'Decke sie locker und steril ab.',
        'Öffne Blasen nicht.'
      ],
      next: [a('Die Person ist auch unterkühlt', 'k1')],
      more: [['erste-hilfe', 'kaelte']]
    },

    /* ---------- Hitze ---------- */
    h1: {
      type: 'question', title: 'Hitze',
      text: 'Was trifft zu?',
      answers: [
        a('Heiße, trockene Haut, Verwirrtheit, Krämpfe, Erbrechen oder Bewusstseinsstörung', 'h_schlag'),
        a('Kopfschmerz, Schwindel, heißer roter Kopf, Übelkeit', 'h_sonne'),
        a(DK, 'h_schlag')
      ]
    },
    h_schlag: {
      type: 'result', e: true, title: 'Hitzschlag',
      lead: 'Hitzschlag ist lebensgefährlich.',
      steps: [
        'Ruf **112**.',
        'Bring die Person in den Schatten. Oberkörper hoch. Überflüssige Kleidung aus.',
        'Kühle sofort: feuchte Tücher auf Kopf, Nacken und Körper. Fächle Luft zu. **Kein Eis** direkt auf die Haut.',
        'Gib nur zu trinken, wenn die Person ganz klar bei Bewusstsein ist.',
        'Bewusstlos mit normaler Atmung: stabile Seitenlage.'
      ],
      next: [a('Die Person ist bewusstlos', 'u2')],
      more: [['erste-hilfe', 'hitze']]
    },
    h_sonne: {
      type: 'result', title: 'Sonnenstich',
      steps: [
        'Bring die Person aus der Sonne.',
        'Lagere den Oberkörper hoch.',
        'Kühle den Kopf mit feuchten Tüchern.'
      ],
      next: [a('Verwirrt, Krämpfe oder Erbrechen', 'h_schlag')],
      more: [['erste-hilfe', 'hitze']]
    },

    /* ---------- Vergiftung, Kohlenmonoxid ---------- */
    g1: {
      type: 'question', e: true, title: 'Vergiftung oder Kohlenmonoxid',
      text: 'Gibt es Hinweise auf Kohlenmonoxid, etwa Ofen, Gasheizer, Grill oder Aggregat im Haus und dazu Kopfschmerz, Schwindel oder Übelkeit?',
      answers: [a(YES, 'g_co'), a(NO, 'g_gift'), a(DK, 'g_co')]
    },
    g_co: {
      type: 'result', e: true, title: 'Kohlenmonoxid (CO)',
      lead: 'Kohlenmonoxid ist unsichtbar und geruchlos. Im Schlaf droht Bewusstlosigkeit.',
      steps: [
        'Bring alle sofort ins Freie. Öffne vorher Fenster und Türen, wenn das schnell geht.',
        'Bleib nicht im Raum. Hol niemanden heraus, wenn du dabei selbst bewusstlos werden könntest.',
        'Ruf **112** von draußen.',
        'Bewusstlos mit normaler Atmung: stabile Seitenlage. Ohne Atmung: Wiederbelebung.',
        'Auch wer sich wieder besser fühlt, gehört in ärztliche Behandlung.'
      ],
      notes: [{ k: 'info', t: 'Vorbeugen', x: 'CO-Melder aufstellen. Nie Grill oder Aggregat in Innenräumen benutzen.' }],
      next: [a('Die Person ist bewusstlos', 'u2')],
      more: [['erste-hilfe', 'co'], ['stromausfall', 'first']]
    },
    g_gift: {
      type: 'result', e: true, title: 'Vergiftung',
      steps: [
        'Schütze dich zuerst. Bring die Person aus dem Gefahrenbereich.',
        'Prüfe Bewusstsein und Atmung. Bewusstlos: Ruf **112**. Atmet sie normal: stabile Seitenlage.',
        'Sichere Verpackungen, Reste und Erbrochenes. Das hilft den Ärzten.',
        'Ruf die **Giftinformationszentrale** an. Sie berät rund um die Uhr per Telefon.',
        'Löse kein Erbrechen aus und gib keine Hausmittel, solange dir das niemand empfiehlt.'
      ],
      notes: [
        { k: 'warn', t: 'Kontaktgifte und Gase', x: 'Rette nicht selbst, wenn du dich gefährdest. Ruf 112 und sag, was du vermutest.' },
        { k: 'info', t: 'Vorsorgen', x: 'Trag die Nummer der regionalen Giftinformationszentrale in deine Notfallkontakte ein, bevor du sie brauchst.' }
      ],
      links: [{ tool: 'kontakte', t: 'Notfallkontakte öffnen' }],
      next: [a('Die Person ist bewusstlos', 'u2')],
      more: [['erste-hilfe', 'vergiftung']]
    },

    /* ---------- Knochenbruch, Sturz ---------- */
    f1: {
      type: 'question', title: 'Knochenbruch',
      text: 'Ist die Haut an der Bruchstelle offen (Wunde, sichtbarer Knochen)?',
      answers: [a(YES, 'f_offen'), a(NO, 'f_zu'), a(DK, 'f_offen')]
    },
    f_zu: {
      type: 'result', e: true, title: 'Geschlossener Bruch',
      steps: [
        'Bewege die Bruchstelle nicht. Renke nichts ein.',
        'Stelle die Stelle ruhig, in der Haltung, die für die Person am bequemsten ist.',
        'Kühle einen geschlossenen Bruch mit nassen Tüchern.',
        'Achte auf Schock und ruf **112**.'
      ],
      notes: [{ k: 'warn', t: 'Nach schwerem Unfall', x: 'Nach einem Sturz aus großer Höhe oder einem Verkehrsunfall kann auch der Hals verletzt sein.' }],
      next: [a('Blass, kalte feuchte Haut, Zittern?', 'sh1'), a('Die Person reagiert nicht', 'u2')],
      more: [['erste-hilfe', 'knochenbruch']]
    },
    f_offen: {
      type: 'result', e: true, title: 'Offener Bruch',
      steps: [
        'Bewege die Bruchstelle nicht. Renke nichts ein.',
        'Decke die offene Wunde steril ab.',
        'Stelle die Stelle ruhig, in der Haltung, die für die Person am bequemsten ist.',
        'Achte auf Schock und ruf **112**.'
      ],
      notes: [
        { k: 'info', t: 'Fremdkörper in der Wunde', x: 'Sie bleiben stecken. Polstere sie nur ringsum ab.' },
        { k: 'warn', t: 'Nach schwerem Unfall', x: 'Nach einem Sturz aus großer Höhe oder einem Verkehrsunfall kann auch der Hals verletzt sein.' }
      ],
      next: [a('Blass, kalte feuchte Haut, Zittern?', 'sh1'), a('Die Person reagiert nicht', 'u2')],
      more: [['erste-hilfe', 'knochenbruch']]
    },

    /* ---------- Stromausfall ---------- */
    s1: {
      type: 'result', title: 'Stromausfall: die ersten Minuten',
      steps: [
        'Schau nach, wer betroffen ist. Prüfe die Sicherungen. Frag die Nachbarn: Ist nur dein Haus ohne Strom?',
        'Schalte Wärmegeräte aus: Herd, Ofen, Bügeleisen, Kaffeemaschine, Wasserkocher, Heizlüfter. Ziehe empfindliche Geräte aus der Steckdose.',
        'Mach das Radio an. Ein Batterie- oder Kurbelradio funktioniert ohne Steckdose, ebenso das Autoradio.',
        'Schließ Kühlschrank und Gefriertruhe. Öffne sie nur, wenn es sein muss.',
        'Nimm Taschenlampen, keine Kerzen.',
        'Sprich mit den Nachbarn. Vielleicht braucht jemand Hilfe.'
      ],
      notes: [
        { k: 'danger', t: 'Kohlenmonoxid: Lebensgefahr', x: 'Benutze nie Grill, Campingkocher oder Aggregat in der Wohnung, im Keller oder in der Garage. Heize nicht mit Backofen oder Gasherd.' },
        { k: 'info', t: 'Kein Notfall, kein Notruf', x: 'Ein Stromausfall allein ist kein Notfall. Wähle 112 nur bei echter Not.' }
      ],
      links: [{ tool: 'ablaufplan', t: 'Stromausfall-Plan zum Abhaken öffnen' }],
      more: [['stromausfall', 'first']]
    },

    /* ---------- Etwas anderes ---------- */
    o1: {
      type: 'result', e: true, title: 'Etwas anderes oder unsicher',
      lead: 'Dafür enthält Offline-Ark keine eigene Anleitung, zum Beispiel bei Brustschmerz, Verdacht auf Herzinfarkt oder Schlaganfall. Hole Hilfe.',
      steps: [
        'Sieh dich um. Bring dich nicht selbst in Gefahr.',
        'Sprich die Person laut an. Rüttle vorsichtig an den Schultern.',
        'Ruf **112**. Sag: Wo ist es? Was ist passiert? Wie viele Verletzte?',
        'Warte auf Rückfragen. Leg erst auf, wenn die Leitstelle das Gespräch beendet.',
        'Bleib bei der Person und beruhige sie.'
      ],
      next: [a('Die Person reagiert nicht', 'u2')],
      more: [['erste-hilfe', 'first']]
    }
  };

  var DATA = { start: 'start', anchors: ANCHORS, nodes: NODES };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else window.OA_ASSISTENT = DATA;
})();
