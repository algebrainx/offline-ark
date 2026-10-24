/* Offline-Ark – Daten für den Gartenkalender (data/garten.js).
 * Zeiten sind Bereiche in Monaten: [Anfang, Ende] mit 0 = 1. Januar, 3 = 1. April, 3,5 = Mitte April, 12 = Ende Dezember.
 * Quelle der Termine: Bayerische Gartenakademie / LWG Veitshöchheim, "Sä- und Pflanztermine auf einen Blick" (Balken auf
 * halbe Monate gerundet), ergänzt durch die Infoschriften 2101, 2102, 2110, 2153, 2166 und 3182/3183 (Kräuter, Kartoffel,
 * Vorkultur, Erdbeere). Die Termine gelten für mittlere Lagen in Bayern; Baden-Württemberg liegt im ähnlichen Klima.
 * Keys: pre = Vorkultur (Frühbeet oder drinnen), sow = Aussaat ins Freiland, plant = Pflanzung/Stecken/Legen draußen,
 * plantFoil/harvestFoil = früher mit Folie oder Vlies, harvest = Ernte.
 */
(function (root, data) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = data; else root.OA_GARTEN = data;
})(typeof window !== 'undefined' ? window : this, {
  crops: [
    { id:"kartoffel_frueh", name:"Kartoffel (früh)", group:"gemuese", plant:[[3.5,4.5]], harvest:[[5.5,7.5]] },
    { id:"kartoffel", name:"Kartoffel (Lager)", group:"gemuese", plant:[[4.0,4.5]], harvest:[[7.0,8.5]], store:true },
    { id:"moehre", name:"Möhre", group:"gemuese", sow:[[2.0,5.5]], harvest:[[6.0,9.5]], harvestFoil:[[5.5,6.0]], store:true },
    { id:"zwiebel_steck", name:"Zwiebel (Steckzwiebeln)", group:"gemuese", plant:[[2.0,3.0]], harvest:[[7.0,9.0]], store:true },
    { id:"zwiebel_saat", name:"Zwiebel (Aussaat)", group:"gemuese", sow:[[2.0,3.0]], harvest:[[7.0,8.0]], store:true },
    { id:"lauch", name:"Lauch", group:"gemuese", pre:[[2.5,3.5]], sow:[[5.0,5.5]], plant:[[5.0,5.5],[7.0,7.5]], harvest:[[0.0,2.0],[8.0,12.0]], winter:true },
    { id:"weisskohl", name:"Weißkohl", group:"gemuese", pre:[[1,1.25],[3.0,4.5]], plant:[[3.0,5.5]], harvest:[[5.5,10.5]], store:true },
    { id:"rotkohl", name:"Rotkohl", group:"gemuese", pre:[[1,1.25],[3.0,4.5]], plant:[[3.0,5.5]], harvest:[[6.0,10.5]] },
    { id:"wirsing", name:"Wirsing", group:"gemuese", pre:[[1,1.25],[3.0,4.5]], plant:[[3.0,5.5]], harvest:[[5.5,10.5]], store:true },
    { id:"gruenkohl", name:"Grünkohl", group:"gemuese", sow:[[4.5,5.5]], plant:[[5.5,6.0]], harvest:[[0,2],[9.5,12.0]], winter:true },
    { id:"rosenkohl", name:"Rosenkohl", group:"gemuese", pre:[[4.0,5.0]], plant:[[5.0,6.0]], harvest:[[0.0,1.5],[9.5,12.0]], winter:true },
    { id:"blumenkohl", name:"Blumenkohl", group:"gemuese", pre:[[1,1.25],[4.0,4.5]], sow:[[4.5,5.5]], plant:[[3.0,7.0]], harvest:[[6.0,10.0]] },
    { id:"brokkoli", name:"Brokkoli", group:"gemuese", pre:[[4.0,5.0]], sow:[[5.0,6.0]], plant:[[4.5,7.0]], harvest:[[6.0,10.0]] },
    { id:"kohlrabi", name:"Kohlrabi", group:"gemuese", pre:[[1,1.25],[4.0,5.0]], sow:[[5.0,6.5]], plant:[[4.0,7.5]], plantFoil:[[3.0,4.0]], harvest:[[6.5,8.0]], harvestFoil:[[5.0,6.0]] },
    { id:"kopfsalat", name:"Kopfsalat", group:"gemuese", pre:[[0.75,1],[3.0,4.0]], sow:[[4.0,6.5]], plant:[[2.5,7.5]], harvest:[[5.0,9.0]], harvestFoil:[[4.0,5.0]], emergency:true },
    { id:"feldsalat", name:"Feldsalat", group:"gemuese", sow:[[7.0,8.5]], plant:[[7.0,9.0]], harvest:[[0.0,3.0],[10.5,12.0]], winter:true },
    { id:"spinat", name:"Spinat", group:"gemuese", sow:[[2.0,3.5],[7.0,8.5]], harvest:[[2.5,4.0],[9.0,10.5]] },
    { id:"mangold", name:"Mangold", group:"gemuese", pre:[[3.0,3.5]], sow:[[3.5,6.0]], plant:[[3.5,6.5]], harvest:[[5.0,9.0]] },
    { id:"erbse_schal", name:"Erbse (Schalerbse)", group:"gemuese", sow:[[2.5,3.5]], harvest:[[4.5,7.0]] },
    { id:"erbse_zucker", name:"Erbse (Zucker- und Markerbse)", group:"gemuese", sow:[[3.0,3.5]], harvest:[[5.5,7.5]] },
    { id:"buschbohne", name:"Bohne (Buschbohne)", group:"gemuese", pre:[[3,4]], sow:[[4.5,6.3]], harvest:[[6.5,9.0]] },
    { id:"stangenbohne", name:"Bohne (Stangenbohne)", group:"gemuese", pre:[[3,4]], sow:[[4.5,6.0]], harvest:[[6.5,10.0]] },
    { id:"radieschen", name:"Radieschen", group:"gemuese", sow:[[2.5,8.5]], harvest:[[3.5,9.5]], harvestFoil:[[3.0,3.5]], emergency:true },
    { id:"rettich", name:"Rettich", group:"gemuese", sow:[[2.5,7.5]], harvest:[[4.5,10.0]], harvestFoil:[[4.0,4.5]] },
    { id:"rote_bete", name:"Rote Bete", group:"gemuese", sow:[[4.0,5.5]], harvest:[[7.0,10.0]], store:true },
    { id:"pastinake", name:"Pastinake", group:"gemuese", sow:[[2.0,5.0]], harvest:[[0.0,2.0],[8.0,12.0]], store:true },
    { id:"sellerie", name:"Knollensellerie", group:"gemuese", pre:[[1.75,2]], plant:[[4.5,6.0]], harvest:[[7.5,10.5]], store:true },
    { id:"zucchini", name:"Zucchini", group:"gemuese", plant:[[4.5,5.0]], plantFoil:[[4.0,4.5]], harvest:[[6.5,9.0]] },
    { id:"tomate", name:"Tomate", group:"gemuese", pre:[[2.35,2.65]], plant:[[4.5,5.5]], harvest:[[6.5,9.5]] },
    { id:"gurke", name:"Gurke", group:"gemuese", pre:[[3.75,4]], sow:[[4.5,5.5]], plant:[[4.5,6.0]], harvest:[[6.5,8.0]] },
    { id:"paprika", name:"Paprika", group:"gemuese", pre:[[2,2.25]], plant:[[4.5,5.5]], harvest:[[7.5,9.0]] },
    { id:"fenchel", name:"Fenchel", group:"gemuese", sow:[[4.5,6.0]], plant:[[5.5,6.0]], harvest:[[7.5,9.5]] },
    { id:"petersilie", name:"Petersilie", group:"kraut", sow:[[3,3.5]], harvest:[[4,10]] },
    { id:"schnittlauch", name:"Schnittlauch", group:"kraut", sow:[[3,3.5]], harvest:[[3,11]], regrow:true },
    { id:"kresse", name:"Gartenkresse", group:"kraut", sow:[[3,3.5]], harvest:[[3,10]], emergency:true, regrow:true },
    { id:"rucola", name:"Rucola", group:"kraut", sow:[[3,3.5]], harvest:[[4,10]], regrow:true },
    { id:"erdbeere", name:"Erdbeere (Gartenerdbeere)", group:"beere", plant:[[6.5,7.5]], harvest:[[4.5,6.5]] }
  ],
  // Lagerhinweise (nur mit Beleg)
  storage: [
    { id: 'kartoffel', name: 'Kartoffel', text: 'Kühl, aber frostfrei (etwa 5 °C), dunkel und bei hoher Luftfeuchte lagern, zum Beispiel in luftdurchlässigen Obstkisten. Frühkartoffeln lassen sich nicht lagern.' },
    { id: 'zwiebel', name: 'Zwiebel', text: 'Späte Sorten mit fester Zwiebel sind bis in den März des Folgejahres lagerfähig. Die milderen Winterzwiebeln halten nur kurze Zeit.' },
    { id: 'kuerbis', name: 'Kürbis', text: 'Ganze Kürbisse halten sich kühl und trocken mehrere Wochen bis Monate. Ausgereifte Winterkürbisse hält man bei etwa 7 bis 10 °C und rund 90 % Luftfeuchte bis zu sechs Monate. Saat- und Erntetermine fehlen hier, weil keine geprüfte Angabe vorlag.' },
    { id: 'kohl', name: 'Kohl', text: 'Weißkohl und Wirsing halten sich nach dem BZfE in einem kühlen Raum bis zu drei Wochen. Grünkohl, Rosenkohl, Lauch und Feldsalat bleiben im Beet stehen und werden im Winter geerntet.' },
    { id: 'wurzel', name: 'Wurzelgemüse', text: 'Möhren, Rote Bete, Pastinaken und Knollensellerie erntet man im Oktober und lagert sie ein. Im Gemüsefach des Kühlschranks halten sie nach dem BZfE etwa ein bis zwei Wochen. Bedingungen für längere Lagerung sind hier nicht belegt.' }
  ],
  // Schnell wachsende Kulturen für den Notfall-Garten (nur mit Beleg)
  emergency: [
    { id: 'kresse', name: 'Gartenkresse', text: 'Keimt in 2 bis 3 Tagen. Die jungen Sprossen werden etwa eine Woche nach der Aussaat geerntet. Wächst nach dem Schnitt nach.' },
    { id: 'radieschen', name: 'Radieschen', text: 'Mitte März gesät und mit Vlies abgedeckt, sind sie Ende April bis Anfang Mai erntereif, also nach etwa 6 bis 7 Wochen. Aussaat im Freiland bis etwa Ende August, Ernte bis Oktober.' },
    { id: 'spinat', name: 'Spinat', text: 'Herbstspinat: Aussaat Anfang August bis Mitte September, Ernte von September bis November. Im Frühjahr Aussaat ab Anfang März möglich.' },
    { id: 'kraeuter', name: 'Schnittlauch, Petersilie, Rucola', text: 'Wachsen nach dem Schnitt nach und lassen sich mehrmals ernten. Aussaat Anfang bis Mitte April.' }
  ],
  // Frost (nur mit Beleg)
  frost: [
    { text: 'Frostempfindliche Kulturen (Tomate, Gurke, Zucchini, Paprika, Bohnen) erst ab Mitte Mai nach draußen bringen. Frühe Aussaaten und Pflanzungen im März und April schützt ein Vlies vor Frostschäden.' },
    { text: 'Die Eisheiligen (11. bis 15. Mai) sind eine alte, regional sehr unterschiedliche Bauernregel und nicht zuverlässig. Frost im Mai ist heute seltener als früher, aber weiterhin möglich. Beobachte die Wettervorhersage.' },
    { text: 'In milden Lagen (Weinbauklima) kann man meist früher aussäen, in klimatisch benachteiligten Gegenden wie Höhenlagen oft erst später. Rechne dort mit einigen Wochen Verschiebung (Schätzung).' }
  ],
  sources: [
    { name: 'LWG Bayern – Sä- und Pflanztermine auf einen Blick (PDF)', url: 'https://www.lwg.bayern.de/mam/cms06/gartenakademie/dateien/sae_und_pflanztermine.pdf', license: '© LWG Bayern – nur Fakten in eigenen Worten wiedergegeben', note: 'Termine für Aussaat, Pflanzung, Ernte' },
    { name: 'LWG Bayern – Infoschrift 2101: Gemüse im Gartenjahr', url: 'https://www.lwg.bayern.de/cms06/gartenakademie/gartendokumente/infoschriften/071661/index.php', license: '© LWG Bayern – nur Fakten in eigenen Worten wiedergegeben', note: 'Frost, Vlies, Radieschen, Bohnen' },
    { name: 'LWG Bayern – Infoschrift 2102: Gemüsearten zur Nachkultur', url: 'https://www.lwg.bayern.de/cms06/gartenakademie/gartendokumente/infoschriften/148345/index.php', license: '© LWG Bayern – nur Fakten in eigenen Worten wiedergegeben', note: 'Spinat, Feldsalat, Grünkohl' },
    { name: 'LWG Bayern – Infoschrift 2110: Jungpflanzen selbst anziehen (PDF)', url: 'https://www.lwg.bayern.de/mam/cms06/gartenakademie/dateien/2110-2020.pdf', license: '© LWG Bayern – nur Fakten in eigenen Worten wiedergegeben', note: 'Termine der Vorkultur' },
    { name: 'LWG Bayern – Infoschrift 2153: Die Kartoffel', url: 'https://www.lwg.bayern.de/cms06/gartenakademie/gartendokumente/infoschriften/247666/index.php', license: '© LWG Bayern – nur Fakten in eigenen Worten wiedergegeben', note: 'Pflanzung, Ernte, Lagerung' },
    { name: 'LWG Bayern – Infoschrift 2166: Kräuter zum Frischverzehr', url: 'https://www.lwg.bayern.de/cms06/gartenakademie/gartendokumente/infoschriften/157754/index.php', license: '© LWG Bayern – nur Fakten in eigenen Worten wiedergegeben', note: 'Aussaat und Ernte von Kräutern' },
    { name: 'LWG Bayern – Infoschrift 3182: Erdbeeren', url: 'https://www.lwg.bayern.de/cms06/gartenakademie/gartendokumente/infoschriften/085637/index.php', license: '© LWG Bayern – nur Fakten in eigenen Worten wiedergegeben', note: 'Pflanzzeit' },
    { name: 'LWG Bayern – Infoschrift 3183: Fahrplan für den Erdbeeranbau', url: 'https://www.lwg.bayern.de/cms06/gartenakademie/gartendokumente/infoschriften/085977/index.php', license: '© LWG Bayern – nur Fakten in eigenen Worten wiedergegeben', note: 'Erntezeit' },
    { name: 'BZfE – How-to: Weißkohl und Spitzkohl', url: 'https://www.bzfe.de/kueche-und-alltag/kochen/how-to-obst-und-gemuese/how-to-weisskohl-und-spitzkohl', license: '© BZfE/BLE – nur in eigenen Worten zusammengefasst', note: 'Lagerung von Kohl' },
    { name: 'BZfE – How-to: Kürbis', url: 'https://www.bzfe.de/kueche-und-alltag/kochen/how-to-obst-und-gemuese/how-to-kuerbis', license: '© BZfE/BLE – nur in eigenen Worten zusammengefasst', note: 'Lagerung von Kürbis' },
    { name: 'BZfE – How-to: Möhren', url: 'https://www.bzfe.de/kueche-und-alltag/kochen/how-to-obst-und-gemuese/how-to-moehren', license: '© BZfE/BLE – nur in eigenen Worten zusammengefasst', note: 'Lagerung von Wurzelgemüse' },
    { name: 'Wikipedia – Eisheilige', url: 'https://de.wikipedia.org/wiki/Eisheilige', license: 'CC BY-SA 4.0', note: 'Eisheilige und Frost im Mai' },
    { name: 'Wikipedia – Gartenkresse', url: 'https://de.wikipedia.org/wiki/Gartenkresse', license: 'CC BY-SA 4.0', note: 'Keimung und Sprossen' },
    { name: 'Wikipedia – Gartenkürbis', url: 'https://de.wikipedia.org/wiki/Gartenk%C3%BCrbis', license: 'CC BY-SA 4.0', note: 'Lagerung von Kürbis' },
    { name: 'Wikipedia – Küchenzwiebel', url: 'https://de.wikipedia.org/wiki/K%C3%BCchenzwiebel', license: 'CC BY-SA 4.0', note: 'Lagerfähigkeit von Zwiebeln' }
  ]
});
