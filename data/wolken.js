/* Offline-Ark – Daten für "Wolken & Wetter" (data/wolken.js).
 * Alle Aussagen sind eigene, vorsichtig formulierte Zusammenfassungen nach:
 *  - DWD Wetter- und Klimalexikon: Cirrus, Cirrostratus, Cirrocumulus, Altostratus, Altocumulus, Stratus, Stratocumulus,
 *    Nimbostratus, Cumulus, Cumulonimbus, Schönwetterwolken, Warmfront, Kaltfront, Böenfront, Böenwalze, Föhn, Föhnfische,
 *    Nebel, Hochnebel, Luftdruck, Luftdrucktendenz, Gewitternase, Wetterleuchten, Donner.
 *  - DWD-Broschüre "Vorsicht Lebensgefahr! Wie ein Gewitter entsteht und wie man sich schützt" (10. Aufl. 2024):
 *    Sekunden zwischen Blitz und Donner geteilt durch 3 = Kilometer; unter 9 Sekunden dringend Schutz suchen; Verhalten im Freien;
 *    Wetterleuchten bei Blitzen über etwa 18 km. (Der DWD-Text nennt keine "10-km-Grenze"; sie steht deshalb nicht in der App.)
 *  - WMO International Cloud Atlas (useful-concepts): Höhenstufen für gemäßigte Breiten: hoch 5-13 km, mittel 2-7 km, tief ab dem Boden bis 2 km.
 *  - Wikipedia (CC BY-SA 4.0): Warmfront (Wolkenfolge, Luftdruck), Cumulus (congestus), Stratus, Stratocumulus, Cirrocumulus, Altocumulus (Fingerbreite).
 * Fotos: Wikimedia Commons, Lizenz und Urheber stehen unter jedem Foto und in bibliothek/bilder/ATTRIBUTION.md. */
(function () {
  'use strict';

  var SOUND = 343;                 // m/s bei etwa 20 °C
  var NEAR_S = 9;                  // DWD: weniger als 9 Sekunden = dringend Schutz suchen
  var AUDIBLE_KM = 18;             // DWD: weiter entfernte Blitze sind nicht mehr zu hören (Wetterleuchten)

  /** Entfernung eines Blitzes aus der Zeit bis zum Donner. */
  function lightning(seconds) {
    var s = Number(seconds);
    if (!isFinite(s) || s < 0) return null;
    var km = s * SOUND / 1000;
    var level = s < NEAR_S ? 'near' : km > AUDIBLE_KM ? 'far' : 'mid';
    return { seconds: s, km: km, ruleKm: s / 3, meters: s * SOUND, level: level };
  }

  var LEVELS = [
    { id: 'high', label: 'Hoch', height: 'hoch, etwa 5 bis 13 km' },
    { id: 'mid', label: 'Mittel', height: 'mittelhoch, etwa 2 bis 7 km' },
    { id: 'low', label: 'Tief', height: 'tief, vom Boden bis etwa 2 km' }
  ];

  var CC = 'CC BY-SA 4.0', CC3 = 'CC BY-SA 3.0';
  var C = 'https://commons.wikimedia.org/wiki/File:';

  var GENERA = [
    { id: 'cirrus', la: 'Cirrus', name: 'Federwolke', level: 'high', img: 'cirrus.jpg',
      alt: 'Zarte weiße Fäden und Haken am blauen Himmel',
      photo: { author: 'ADARSHluck', license: CC, url: C + 'Cirrus_uncinus_clouds_in_the_morning_sky.jpg' },
      look: 'Zarte weiße Fäden oder Streifen mit seidigem Schimmer. Sie bestehen aus Eiskristallen.',
      meaning: 'Einzeln und unverändert sind sie meist harmlos. Werden sie mehr und verdichten sie sich zu einem Schleier, kann sich eine Warmfront nähern.' },
    { id: 'cirrocumulus', la: 'Cirrocumulus', name: 'Kleine Schäfchenwolke', level: 'high', img: 'cirrocumulus.jpg',
      alt: 'Viele sehr kleine weiße Flöckchen in Reihen am Himmel',
      photo: { author: 'LivingShadow', license: CC3, url: C + 'Cirrocumulus_20040830.jpg' },
      look: 'Sehr kleine weiße Flöckchen in Feldern oder Reihen, ohne Eigenschatten. Jedes Flöckchen ist kleiner als ein Finger (Arm ausgestreckt).',
      meaning: 'Allein sagt sie wenig über das Wetter. Achte darauf, ob später ein dichter Schleier oder mittelhohe Wolken folgen.' },
    { id: 'cirrostratus', la: 'Cirrostratus', name: 'Schleierwolke', level: 'high', img: 'cirrostratus.jpg',
      alt: 'Heller Ring (Halo) um die Sonne in einem dünnen Wolkenschleier',
      photo: { author: 'GerritR', license: CC, url: C + '22%C2%B0-Halo_in_Cirrostratus_fibratus_bei_Limburg_II.jpg' },
      look: 'Dünner, milchiger Schleier. Sonne oder Mond bleiben sichtbar, oft mit einem hellen Ring (Halo).',
      meaning: 'Ein Zeichen für eine nahende Warmfront. Der Schleier wird oft schnell dichter und kann in kurzer Zeit den ganzen Himmel überziehen. Danach folgen meist Regenwolken.' },
    { id: 'altocumulus', la: 'Altocumulus', name: 'Schäfchenwolke', level: 'mid', img: 'altocumulus.jpg',
      alt: 'Weiße und graue Wolkenballen in Feldern am Himmel',
      photo: { author: 'Bidgee', license: CC3, url: C + 'Altocumulus.jpg' },
      look: 'Weiße oder graue Ballen oder Walzen, meist mit grauer Unterseite. Jedes Stück ist etwa 1 bis 3 Finger breit (Arm ausgestreckt).',
      meaning: 'Allein sagt sie wenig. Folgt sie auf Cirrus und wird dichter, kann sie zur Wolkenfolge einer Warmfront gehören.' },
    { id: 'altostratus', la: 'Altostratus', name: 'Mittelhohe Schichtwolke', level: 'mid', img: 'altostratus.jpg',
      alt: 'Graue, streifige Wolkenschicht über einer Ebene',
      photo: { author: 'Famartin', license: CC, url: C + '2020-12-31_16_06_58_Altostratus_with_a_wavy_undulating_base_above_the_Dulles_section_of_Sterling,_Loudoun_County,_Virginia.jpg' },
      look: 'Graue oder bläuliche Schicht. Die Sonne scheint nur schwach, wie durch Mattglas. Einen Halo gibt es nicht.',
      meaning: 'Sie gehört zur Wolkenfolge einer Warmfront. Verschwindet die Sonne ganz, beginnt oft bald länger anhaltender Regen.' },
    { id: 'nimbostratus', la: 'Nimbostratus', name: 'Regenwolke', level: 'mid', img: 'nimbostratus.jpg',
      alt: 'Dunkelgraue, gleichmäßige Wolkenschicht über Bäumen und Hügeln',
      photo: { author: 'Simon Eugster', license: CC3, url: C + 'Nimbostratus_praecipitatio.JPG' },
      look: 'Dichte, graue bis dunkle Schicht ohne klare Kanten. Die Sonne ist nicht mehr zu sehen. Darunter hängen oft Wolkenfetzen.',
      meaning: 'Hier regnet oder schneit es gleichmäßig und oft länger. Das ist das typische Wetter hinter einer Warmfront.' },
    { id: 'stratocumulus', la: 'Stratocumulus', name: 'Haufenschichtwolke', level: 'low', img: 'stratocumulus.jpg',
      alt: 'Graue und weiße Wolkenschollen mit dunklen Stellen und Lücken',
      photo: { author: 'W.carter', license: CC, url: C + 'Stratocumulus_and_cumulus_over_G%C3%A5seberg.jpg' },
      look: 'Graue oder weißliche Schollen, Ballen oder Walzen, fast immer mit dunklen Stellen. Jedes Stück ist breiter als etwa 3 Finger (Arm ausgestreckt).',
      meaning: 'Die häufigste Wolke in Mitteleuropa. Sie zeigt eine ziemlich stabile Luftschichtung an und ist für sich allein kein Zeichen für einen Wetterumschwung.' },
    { id: 'stratus', la: 'Stratus', name: 'Tiefe Schichtwolke', level: 'low', img: 'stratus.jpg',
      alt: 'Dichte Wolkenschicht über einer Berglandschaft mit Schnee',
      photo: { author: 'kallerna', license: CC, url: C + 'Stratus_clouds_Vodno_4.jpg' },
      look: 'Gleichmäßig graue Schicht mit flacher Untergrenze. Liegt sie nicht am Boden, nennt man sie Hochnebel.',
      meaning: 'Trübes, ruhiges Wetter. Es fällt höchstens Sprühregen oder Schneegriesel. Dünner Hochnebel löst sich oft im Lauf des Tages auf.' },
    { id: 'cumulus', la: 'Cumulus', name: 'Haufenwolke', level: 'low', img: 'cumulus.jpg',
      alt: 'Weiße Haufenwolken mit flacher Unterseite am blauen Himmel',
      photo: { author: 'Uoaei1', license: CC, url: C + 'Cumulus_humilis_Sch%C3%B6nwald_im_Schwarzwald_20180810.jpg' },
      look: 'Dichte weiße Wolken mit scharfen Rändern, wie Blumenkohl. Die Unterseite ist flach und etwas dunkler.',
      meaning: 'Flache Cumulus bringen meist keinen Regen und lösen sich abends oft auf. Wachsen sie stark in die Höhe, können Schauer und Gewitter folgen.' },
    { id: 'cumulonimbus', la: 'Cumulonimbus', name: 'Gewitterwolke', level: 'low', tall: true, img: 'cumulonimbus.jpg',
      alt: 'Mächtige Gewitterwolke mit ausgebreitetem Amboss über einer Stadt',
      photo: { author: 'Kamil Nowacki', license: CC, url: C + 'Cumulonimbus_incus_over_Warsaw,_Poland.jpg' },
      look: 'Riesige, hoch aufgetürmte Wolke. Oben breitet sie sich oft wie ein Amboss aus. Die Unterseite ist meist sehr dunkel. Sie reicht vom unteren bis in den hohen Bereich (bis etwa 12 km).',
      meaning: 'Hier sind Gewitter, Starkregen, Hagel und Sturmböen möglich. Suche rechtzeitig Schutz (siehe unten).' }
  ];

  var SIGNS = [
    { id: 'warmfront', title: 'Warmfront: Diese Wolken kommen nacheinander',
      intro: 'Bei einer Warmfront gleitet warme Luft auf kältere Luft auf. Am Himmel sieht man dann oft diese Folge:',
      steps: ['Cirrus: zarte Fäden hoch am Himmel.', 'Cirrostratus: ein milchiger Schleier, oft mit Halo um Sonne oder Mond.', 'Altostratus: die Sonne scheint nur noch wie durch Mattglas.', 'Nimbostratus: die Sonne ist verschwunden, es regnet oder schneit gleichmäßig und länger.'],
      items: ['Der Luftdruck fällt dabei meist leicht.', 'Nach dem Durchgang lässt der Regen nach und die Wolken lockern auf. Die Sicht bleibt aber oft mäßig bis schlecht.', 'Nicht jede Warmfront zeigt alle vier Stufen. Die Zeitabstände sind unterschiedlich. Beobachte, ob die Wolken dichter werden.'] },
    { id: 'gewitter', title: 'Gewitter kündigt sich an',
      items: ['Haufenwolken (Cumulus) wachsen stark in die Höhe. Oben bildet sich ein Amboss: Das ist eine Gewitterwolke (Cumulonimbus).',
        'Kommen hohe Haufenwolken (Cumulus congestus) aus Südwest heran, sind in Mitteleuropa binnen weniger Stunden Schauer und Böen zu erwarten.',
        'Vorne an einer dunklen Gewitterwolke kann eine Böenwalze hängen: eine lange, walzenförmige Wolke. Mit der Gewitterfront kommen oft Windböen.',
        'Bei kräftigen Gewittern fällt der Luftdruck vorher stark. Beim Durchzug springt der Wind nicht selten um und wird kurz sehr stark. Es wird deutlich kühler, und der Luftdruck steigt schnell wieder.',
        'Wetterleuchten ohne Donner: Das Gewitter ist weit weg (über etwa 18 Kilometer). Es kann aber näher kommen.',
        'Bei feuchtwarmem Wetter entstehen Gewitter oft innerhalb weniger Minuten auf engem Raum. Man kann sie schlecht vorhersagen.'] },
    { id: 'kaltfront', title: 'Kaltfront: Davor und danach',
      items: ['Davor: starke Quellbewölkung, Schauer, Gewitter und teils heftige Böen deuten auf eine Kaltfront hin.',
        'Danach: Der Wind dreht deutlich, der Luftdruck steigt und es wird kühler. Die Wolken lockern schnell auf, und die Sicht ist meist gut.'] },
    { id: 'foehn', title: 'Föhn',
      items: ['Föhn ist ein warmer, trockener Fallwind auf der windabgewandten Seite (Lee) eines Gebirges, zum Beispiel nördlich der Alpen.',
        'Dort steigt die Temperatur deutlich, und die Wolken lösen sich oft auf.',
        'Auf der Seite, von der der Wind kommt (Luv), stauen sich Wolken, und es regnet.',
        'Schmale, linsenförmige Wolken parallel zum Gebirgskamm („Föhnfische“, Altocumulus lenticularis) können ein Zeichen für Föhn sein.'] },
    { id: 'nebel', title: 'Nebel und Hochnebel',
      items: ['Nebel entsteht, wenn sich die Luft am Boden unter den Taupunkt abkühlt, zum Beispiel durch die nächtliche Abkühlung des Bodens. Bei Nebel beträgt die Sicht unter 1 Kilometer.',
        'Hochnebel ist eine tiefe, gleichmäßige Wolkenschicht, die nicht am Boden liegt. Darunter ist die Sicht größer als 1 Kilometer. Es kann leichter Sprühregen fallen.',
        'Dünner Hochnebel löst sich oft im Lauf des Tages auf. Bei Hochdruckwetter im Winter kann er mehrere Tage bleiben.'] },
    { id: 'baro', title: 'Luftdruck (Barometer)',
      items: ['Wichtig ist die Änderung über einige Stunden, nicht der Zahlenwert. Wetterdienste vergleichen meist den Druck von vor 3 Stunden.',
        'Fällt der Luftdruck über Stunden, kann sich eine Front nähern, zum Beispiel eine Warmfront.',
        'Steigt der Luftdruck deutlich, folgt oft das Rückseitenwetter nach einer Kaltfront: Die Wolken lockern auf.',
        'Der Luftdruck sinkt mit der Höhe, in Bodennähe um etwa 1 hPa je 8 Meter. Vergleiche Messungen daher nur am selben Ort.',
        'Ein kurzer, plötzlicher Druckanstieg kann den Durchzug eines Gewitters anzeigen („Gewitternase“).',
        'Ein Barometer sagt das Wetter nicht allein voraus. Nutze es zusammen mit dem Blick zum Himmel.'] }
  ];

  var BEHAVIOR = {
    title: 'Bei Gewitter: So schützt du dich',
    items: ['Suche ein festes Gebäude. Auch ein Auto schützt (Faradayscher Käfig).',
      'Im Freien: Meide einzeln stehende Bäume, hohe Türme und Masten, Metallzäune und Gewässer. Sei nicht der höchste Punkt in der Umgebung.',
      'Wenn nichts anderes bleibt: Geh in einer Bodenmulde in die Hocke, stelle die Füße eng zusammen und schlinge die Arme um die Beine.',
      'Weniger als 9 Sekunden zwischen Blitz und Donner (etwa 3 Kilometer): Suche sofort Schutz.']
  };

  var SOURCES = [
    { name: 'DWD – Vorsicht Lebensgefahr! Wie ein Gewitter entsteht und wie man sich schützt (PDF)', url: 'https://www.dwd.de/SharedDocs/broschueren/DE/presse/gewitter_pdf.pdf?__blob=publicationFile&v=13', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Verhalten bei Gewitter, Sekunden geteilt durch 3, Wetterleuchten' },
    { name: 'DWD – Wetter- und Klimalexikon: Wolkengattungen', url: 'https://www.dwd.de/DE/service/lexikon/begriffe/W/Wolkengattungen.html', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Beschreibung der zehn Gattungen (Cirrus bis Cumulonimbus)' },
    { name: 'DWD – Wetter- und Klimalexikon: Warmfront', url: 'https://www.dwd.de/DE/service/lexikon/begriffe/W/Warmfront.html', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Aufgleitbewölkung, Wetter nach der Warmfront' },
    { name: 'DWD – Wetter- und Klimalexikon: Kaltfront', url: 'https://www.dwd.de/DE/service/lexikon/begriffe/K/Kaltfront.html', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Wetter vor und nach der Kaltfront' },
    { name: 'DWD – Wetter- und Klimalexikon: Böenfront', url: 'https://www.dwd.de/DE/service/lexikon/begriffe/B/Boeenfront.html', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Druckfall, Winddrehung und Temperatursturz bei Gewitterfronten' },
    { name: 'DWD – Wetter- und Klimalexikon: Donner', url: 'https://www.dwd.de/DE/service/lexikon/begriffe/D/Donner.html', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Schallgeschwindigkeit, Entfernung des Gewitters' },
    { name: 'DWD – Wetter- und Klimalexikon: Föhn', url: 'https://www.dwd.de/DE/service/lexikon/begriffe/F/Foehn.html', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Föhn, Luv und Lee' },
    { name: 'DWD – Wetter- und Klimalexikon: Nebel', url: 'https://www.dwd.de/DE/service/lexikon/begriffe/N/Nebel.html', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Nebel und Hochnebel' },
    { name: 'DWD – Wetter- und Klimalexikon: Luftdruck', url: 'https://www.dwd.de/DE/service/lexikon/begriffe/L/Luftdruck.html', license: '© DWD – nur in eigenen Worten zusammengefasst', note: 'Luftdruck und Höhe' },
    { name: 'WMO International Cloud Atlas – Useful concepts', url: 'https://cloudatlas.wmo.int/en/useful-concepts.html', license: '© WMO – nur in eigenen Worten zusammengefasst', note: 'Höhenstufen der Wolken' },
    { name: 'Wikipedia – Warmfront', url: 'https://de.wikipedia.org/wiki/Warmfront', license: 'CC BY-SA 4.0', note: 'Wolkenfolge und Luftdruck vor der Warmfront' },
    { name: 'Wikipedia – Cumulus', url: 'https://de.wikipedia.org/wiki/Cumulus', license: 'CC BY-SA 4.0', note: 'Cumulus humilis und congestus' },
    { name: 'Wikipedia – Stratus', url: 'https://de.wikipedia.org/wiki/Stratus', license: 'CC BY-SA 4.0', note: 'Hochnebel und Niederschlag aus Stratus' },
    { name: 'Wikipedia – Stratocumulus', url: 'https://de.wikipedia.org/wiki/Stratocumulus', license: 'CC BY-SA 4.0', note: 'Häufigkeit und Luftschichtung' },
    { name: 'Wikipedia – Cirrocumulus', url: 'https://de.wikipedia.org/wiki/Cirrocumulus', license: 'CC BY-SA 4.0', note: 'Größe der Wolkenteile' },
    { name: 'Wikipedia – Altocumulus', url: 'https://de.wikipedia.org/wiki/Altocumulus', license: 'CC BY-SA 4.0', note: 'Größe der Wolkenteile' }
  ];

  var API = { SOUND: SOUND, NEAR_S: NEAR_S, AUDIBLE_KM: AUDIBLE_KM, lightning: lightning, levels: LEVELS, genera: GENERA, signs: SIGNS, behavior: BEHAVIOR, sources: SOURCES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.OA_WOLKEN = API;
})();
