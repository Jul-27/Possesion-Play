/*
 * name_overrides.mjs — kuratierte Namenskorrekturen und Ausschlüsse.
 *
 * Analog zu EXTRA_PLAYERS / HONOUR_OVERRIDES / GAP_WINNERS: die Tabellen leben
 * im Repo, damit ein erneuter Pipeline-Lauf die Korrekturen nicht überschreibt
 * (apply_name_overrides.mjs läuft am Ende von refresh_all.mjs).
 *
 * Drei Ursachen stecken hinter den falschen Namen in src/players.js:
 *   1) QID statt Name — der Label-Service fiel mangels englischem Label auf die
 *      QID zurück (jetzt zusätzlich durch wikidata_label.mjs abgesichert).
 *   2) Vandalismus in Wikidata — zum Zeitpunkt des Laufs war das englische
 *      Label manipuliert ("Divock Origi kolman", "João Moutinh0", …). Inzwischen
 *      ist es in vielen Fällen zurückgesetzt; die alten Records blieben liegen.
 *   3) Falsche Entitäten — Personen mit P106 "Fußballspieler" und einer
 *      P54-Zuordnung, die nie Profifußball gespielt haben.
 *
 * REGEL: keine Namen erfinden. Jedes `to` ist per `src` (Wikidata-QID) belegt —
 * Quelle ist das Label bzw. der Wikipedia-Artikeltitel dieser Entität. Wo sich
 * kein lateinschriftlicher Name aus Wikidata belegen ließ, wird der Record
 * ausgeschlossen statt geraten (siehe EXCLUDED_PLAYERS).
 */

// { from, by, to, src, note? } — `from` ist der aktuelle Name in players.js,
// `by` das Geburtsjahr (Schlüssel zusammen mit dem Namen), `src` die belegende QID.
export const NAME_OVERRIDES = [
  // ── 1) QID statt Name ────────────────────────────────────────────────────
  { from: "Q106948344", by: 2001, to: "Marcel Lotka",            src: "Q106948344", note: "enwiki/dewiki-Titel" },
  { from: "Q113704154", by: 2007, to: "Lamine Yamal",            src: "Q113704154", note: "en/de-Label" },
  { from: "Q118211483", by: 2001, to: "Iñigo San Clemente",      src: "Q118211483", note: "es/eu-Label" },
  { from: "Q118954958", by: 1928, to: "Falín",                   src: "Q118954958", note: "es-Label (Spielername)" },
  { from: "Q118955322", by: 1918, to: "Pedro Mori Cuartas",      src: "Q118955322", note: "es-Label" },
  { from: "Q119562",    by: 1988, to: "Sergio Agüero",           src: "Q119562",    note: "en/de/es-Label" },
  { from: "Q134317716", by: 1895, to: "Gé Bosch",                src: "Q134317716", note: "nl-Label" },
  { from: "Q136226153", by: 2005, to: "Bruno Pérez",             src: "Q136226153", note: "es/eu-Label" },
  { from: "Q137848843", by: 2004, to: "Josh Robinson",           src: "Q137848843", note: "ms-Label + mswiki-Titel" },
  { from: "Q138840467", by: 2007, to: "Paulo Da Silva",          src: "Q138840467", note: "nl-Label" },
  { from: "Q138949849", by: 1942, to: "Rafael Echarri",          src: "Q138949849", note: "es-Label + eswiki-Titel" },
  { from: "Q139250941", by: 1909, to: "Kandido Urretabizkaia",   src: "Q139250941", note: "eu-Label + euwiki-Titel" },
  { from: "Q139541180", by: 1953, to: "Wolfgang Rischker",       src: "Q139541180", note: "de-Label + dewiki-Titel" },
  { from: "Q139666071", by: 1936, to: "Jan van der Meer",        src: "Q139666071", note: "nl-Label" },
  { from: "Q140254991", by: 2003, to: "Lander Emery",            src: "Q140254991", note: "eu-Label + euwiki-Titel" },
  { from: "Q140310125", by: 1904, to: "Joaquín Ortiz de la Torre", src: "Q140310125", note: "eu-Label + euwiki-Titel" },
  { from: "Q151025",    by: 1985, to: "Jakub Błaszczykowski",    src: "Q151025",    note: "P1559 + enwiki-Titel" },
  { from: "Q15358470",  by: 1996, to: "Moussa Dembélé",          src: "Q15358470",  note: "P1559 + de/fr/es-Label" },
  { from: "Q155049",    by: 1989, to: "Ron-Robert Zieler",       src: "Q155049",    note: "P1559 + enwiki-Titel" },
  { from: "Q197697",    by: 1977, to: "Alexander Manninger",     src: "Q197697",    note: "P1559 + de/it/es-Label" },
  { from: "Q22919592",  by: 1918, to: "Louis Fraenkel",          src: "Q22919592",  note: "nl-Label + nlwiki-Titel" },
  { from: "Q26996185",  by: 1957, to: "Cecilio Zunzunegui",      src: "Q26996185",  note: "eswiki/itwiki-Titel" },
  { from: "Q4712099",   by: 1888, to: "Alberto Machimbarrena",   src: "Q4712099",   note: "enwiki/eswiki-Titel" },
  { from: "Q56309509",  by: 1890, to: "Teun den Hartigh",        src: "Q56309509",  note: "nlwiki-Titel" },
  { from: "Q56310124",  by: 1920, to: "Maurits Boonstoppel",     src: "Q56310124",  note: "P1559 + nl-Label" },
  { from: "Q576614",    by: 1938, to: "Luis Aragonés",           src: "Q576614",    note: "en/de/es-Label" },
  { from: "Q577010",    by: 1945, to: "Martin Chivers",          src: "Q577010",    note: "P1559 + enwiki-Titel" },

  // ── 2) Wikidata-Vandalismus (Stand des jeweiligen Laufs) ────────────────
  { from: "Antonio Mirante el flecheiro", by: 1983, to: "Antonio Mirante", src: "Q603681" },
  { from: "davo puerro",                  by: 2002, to: "Amad Diallo",     src: "Q72603655" },
  { from: "don panini",                   by: 1921, to: "Carlo Parola",    src: "Q1042372" },
  { from: "EL KÁISER ESPAÑOL",            by: 1991, to: "Iñigo Martínez",  src: "Q1028020" },
  { from: "elpisha",                      by: 1981, to: "Joaquín Sánchez", src: "Q294204", note: "nl/pt-Label; enwiki 'Joaquín (footballer, born 1981)'" },
  { from: "Fabián Rinaudo papá de Almafria de Las Rosas", by: 1987, to: "Fabián Rinaudo", src: "Q2557773" },
  { from: "Guido Carrillo EL GOAT",       by: 1991, to: "Guido Carrillo",  src: "Q3779221" },
  { from: "João Moutinh0",                by: 1986, to: "João Moutinho",   src: "Q222151" },
  { from: "nisola gaitani",               by: 1988, to: "Nicolás Gaitán",  src: "Q372605" },
  { from: "Javier Hernánde",              by: 1988, to: "Javier Hernández", src: "Q165125" },
  { from: "𝑝𝑢𝑡𝑜 𝑡𝑟𝑜𝑛𝑐𝑜",                by: 1988, to: "Javier Hernández", src: "Q165125", note: "zweiter Altrecord desselben Spielers" },
  { from: "Rafael Márquez El piojo",      by: 1979, to: "Rafael Márquez",  src: "Q186330" },
  { from: "Romelu Lukaku LA CAKA",        by: 1993, to: "Romelu Lukaku",   src: "Q313316" },
  { from: "Takuma ano",                   by: 1994, to: "Takuma Asano",    src: "Q11557367" },
  { from: "Divock Origi kolman",          by: 1995, to: "Divock Origi",    src: "Q4254043" },
  { from: "João pelix",                   by: 1999, to: "João Félix",      src: "Q27049064" },
  { from: "Pável Perro",                  by: 1976, to: "Pável Pardo",     src: "Q316222" },
  { from: "CHIQUILIN",                    by: 1983, to: "Jorge Iván Estrada", src: "Q2339708", note: "enwiki/dewiki-Titel" },
  { from: "CARLOS JAVIER TORRES BERMUDEZ", by: 1972, to: "Édison Maldonado", src: "Q23907340", note: "nl-Label + eswiki-Titel" },
  { from: "Federico Revuelto rodriguez",  by: 1883, to: "Federico Revuelto", src: "Q5857826" },
  { from: "Lautaro leguizamon",           by: 1994, to: "Lucas Ontivero",  src: "Q5981923", note: "enwiki/eswiki-Titel" },
  { from: "Eyad salah",                   by: 1981, to: "Robert Akaruye",  src: "Q7341392", note: "de/es/fr/nl-Label + enwiki-Titel" },
  { from: "carlitos",                     by: 1986, to: "Carlos Bacca",    src: "Q74681" },
  { from: "Walter Ivan alexis Montoya",   by: 1993, to: "Walter Montoya",  src: "Q20681039" },
  { from: "Guido nahuel Vadalá",          by: 1997, to: "Guido Vadalá",    src: "Q16302370" },
  { from: "Aldo leao Ramírez",            by: 1981, to: "Aldo Leão Ramírez", src: "Q1996365", note: "es-Label + enwiki-Titel" },
  { from: "Calvin Ramsey",                by: 2003, to: "Calvin Ramsay",   src: "Q94696146", note: "de/es/fr/it-Label + enwiki-Titel" },

  // ── 3) Schreibweisen, damit korrigierte Records zusammenfallen ──────────
  { from: "Jakub Blaszczykowski", by: 1985, to: "Jakub Błaszczykowski", src: "Q151025",  note: "diakritikfreie Altfassung" },
  { from: "Nico Gaitán",          by: 1988, to: "Nicolás Gaitán",       src: "Q372605",  note: "Kurzform, fällt mit dem korrigierten Record zusammen" },
];

// Records, die aus dem Datensatz verschwinden. `aliases` fängt Schreibweisen ab,
// unter denen derselbe Record nach einem Pipeline-Lauf wieder auftauchen kann.
export const EXCLUDED_PLAYERS = [
  // Nicht-Fußballer
  { n: "Jason Statham", by: 1967, aliases: ["Q169963"],
    reason: "Schauspieler; P54 zu Manchester United in Wikidata ist falsch, er hat nie Profifußball gespielt" },
  { n: "Julio Iglesias", by: 1943, aliases: ["Q122003"],
    reason: "Sänger; stand als Jugendtorwart bei Real Madrid Castilla, nie im Profikader von Real Madrid (P54 zu Q8682 fragwürdig)" },

  // Vandalismus-Record, dessen Identität sich nicht belegen ließ
  { n: "Áfricano promedio", by: 2000,
    reason: "rassistische Wikidata-Manipulation; die Entität ließ sich nicht zweifelsfrei zuordnen, Record trägt nur clubs:[MCI]" },

  // QID-Records ohne lateinschriftliches Label in Wikidata — lieber fehlend als geraten.
  // Transliteration aus kyrillisch/georgisch/arabisch/chinesisch wäre erfunden.
  { n: "Q109932421", by: 1985, reason: "nur ka-Label; Record ist ein Dublett zu einem bereits vorhandenen Spieler (VIL, 1985)" },
  { n: "Q12252161",  by: 1979, reason: "nur ar-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q24008038",  by: 1996, reason: "nur ka-Label; Dublett (MIL, 1996)" },
  { n: "Q32172600",  by: 1991, reason: "nur zh/yue-Label; Dublett (FCB, 1991)" },
  { n: "Q48963405",  by: 1891, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q56356943",  by: 1993, reason: "nur fa-Label; Dublett (WOB, 1993)" },
  { n: "Q60830623",  by: 1887, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q60830950",  by: 1895, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q60831701",  by: 1919, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q60834701",  by: 1914, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q60838430",  by: 1919, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q67934899",  by: 1996, reason: "nur zh-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q70251175",  by: 1915, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q70251621",  by: 1922, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
  { n: "Q70254224",  by: 1908, reason: "nur ru-Label, kein lateinschriftlicher Name in Wikidata belegt" },
];
