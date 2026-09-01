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
  /* Vandalismus, der beim Ligakader-Lauf am 01.09.2026 durchkam: Diese drei QIDs
     trugen zu dem Zeitpunkt manipulierte ENGLISCHE Labels, während die deutschen
     sauber waren. Sie wurden dadurch als drei zusätzliche Spieler angelegt und
     verschmelzen hier mit dem echten Datensatz. */
  { from: "El Perrito de la C",        by: 1985, to: "Wayne Rooney",              src: "Q266613", note: "de-Label/dewiki" },
  { from: "Juan Mata Pata",            by: 1988, to: "Juan Mata",                 src: "Q168740", note: "de-Label/dewiki" },
  { from: "Pierre Cardin picha grande", by: 1989, to: "Pierre-Emerick Aubameyang", src: "Q44977",  note: "de-Label/dewiki" },

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

  /* ── 4) Doppelte Datensätze derselben Person ──────────────────────────────
     769 Namenspaare mit gleichem Nachnamen und Jahrgang gegen Wikidata geprüft;
     die hier gelisteten teilen sich nachweislich EINE QID (siehe src). Sie sind
     entstanden, weil derselbe Spieler über die Jahre unter verschiedenen
     Wikidata-Labels eingesammelt wurde — mit GETEILTEN Daten: Dani Alves hatte
     Sevilla nur auf einer der beiden Karten, Choupo-Moting HSV/Mainz/Schalke.

     Regel (Owner-Entscheid): die kürzere Schreibweise gewinnt. Zwei Präzisierungen,
     weil sie sonst nachweislich danebengreift:
       · Griechische/kyrillische Homoglyphen verlieren immer — „Αrda Güler“ beginnt
         mit einem griechischen Alpha und ist genauso lang wie die richtige Form.
       · Bei gleicher Länge gewinnen die Latin-Diakritika („Éric Maxim Choupo-Moting“).
     Eine Ausnahme: André-Frank Zambo Anguissa behält den langen Namen — als
     „Frank Anguissa“ wäre er nicht wiedererkennbar. */
  { from: "Ahmadou Bamba Dieng",                 by: 2000, to: "Bamba Dieng",                       src: "Q105426667", note: "Dublette, gleiche QID" },
  { from: "Alejandro Gálvez",                    by: 1989, to: "Álex Gálvez",                       src: "Q667687", note: "Dublette, gleiche QID" },
  { from: "Alejandro Grimaldo",                  by: 1995, to: "Álex Grimaldo",                     src: "Q921324", note: "Dublette, gleiche QID" },
  { from: "Michael Amir Murillo",                by: 1996, to: "Amir Murillo",                      src: "Q27805413", note: "Dublette, gleiche QID" },
  { from: "Anastasios Donis",                    by: 1996, to: "Tasos Donis",                       src: "Q19957563", note: "Dublette, gleiche QID" },
  { from: "Anatoliy Tymoshchuk",                 by: 1979, to: "Anatolii Tymoshchuk",               src: "Q44181", note: "Dublette, gleiche QID" },
  { from: "Frank Anguissa",                      by: 1995, to: "André-Frank Zambo Anguissa",        src: "Q21039587", note: "Dublette, gleiche QID" },
  { from: "Andrew Robertson",                    by: 1994, to: "Andy Robertson",                    src: "Q15915040", note: "Dublette, gleiche QID" },
  { from: "Αrda Güler",                          by: 2005, to: "Arda Güler",                        src: "Q108159340", note: "Dublette, gleiche QID" },
  { from: "Bruno Pereirinha",                    by: 1988, to: "Pereirinha",                        src: "Q2448009", note: "Dublette, gleiche QID" },
  { from: "Juan Camilo Zúñiga",                  by: 1985, to: "Camilo Zúñiga",                     src: "Q456797", note: "Dublette, gleiche QID" },
  { from: "José Antonio Dorado",                 by: 1982, to: "Chechu Dorado",                     src: "Q609637", note: "Dublette, gleiche QID" },
  { from: "Cheick Tioté",                        by: 1986, to: "Cheik Tioté",                       src: "Q310668", note: "Dublette, gleiche QID" },
  { from: "Cristian Daniel Ledesma",             by: 1982, to: "Cristian Ledesma",                  src: "Q316457", note: "Dublette, gleiche QID" },
  { from: "Daniel Alves",                        by: 1983, to: "Dani Alves",                        src: "Q172720", note: "Dublette, gleiche QID" },
  { from: "Daniel Aranzubia",                    by: 1979, to: "Dani Aranzubia",                    src: "Q311938", note: "Dublette, gleiche QID" },
  { from: "Daniel Carvajal",                     by: 1992, to: "Dani Carvajal",                     src: "Q127452", note: "Dublette, gleiche QID" },
  { from: "Daniel Osvaldo",                      by: 1986, to: "Dani Osvaldo",                      src: "Q313927", note: "Dublette, gleiche QID" },
  { from: "Marco Davide Faraoni",                by: 1991, to: "Davide Faraoni",                    src: "Q551892", note: "Dublette, gleiche QID" },
  { from: "Djamel Eddine Benlamri",              by: 1989, to: "Djameleddine Benlamri",             src: "Q5285221", note: "Dublette, gleiche QID" },
  { from: "Enzo Nicolás Pérez",                  by: 1986, to: "Enzo Pérez",                        src: "Q926353", note: "Dublette, gleiche QID" },
  { from: "Eric-Maxim Choupo-Moting",            by: 1989, to: "Éric Maxim Choupo-Moting",          src: "Q309532", note: "Dublette, gleiche QID" },
  { from: "Luciano Fabián Monzón",               by: 1987, to: "Fabián Monzón",                     src: "Q440097", note: "Dublette, gleiche QID" },
  { from: "Faris Pemi Moumbagna",                by: 2000, to: "Faris Moumbagna",                   src: "Q55820199", note: "Dublette, gleiche QID" },
  { from: "Fiodor Smolov",                       by: 1990, to: "Fedor Smolov",                      src: "Q1883203", note: "Dublette, gleiche QID" },
  { from: "Fernando Niño",                       by: 2000, to: "Fer Niño",                          src: "Q85760768", note: "Dublette, gleiche QID" },
  { from: "François Régis Mughe",                by: 2004, to: "François Mughe",                    src: "Q116952830", note: "Dublette, gleiche QID" },
  { from: "Paulo Henrique Ganso",                by: 1989, to: "Ganso",                             src: "Q313835", note: "Dublette, gleiche QID" },
  { from: "Gian-Luca Itter",                     by: 1999, to: "Luca Itter",                        src: "Q28851316", note: "Dublette, gleiche QID" },
  { from: "Gil Bastião Dias",                    by: 1996, to: "Gil Dias",                          src: "Q17501954", note: "Dublette, gleiche QID" },
  { from: "Joan Román",                          by: 1993, to: "Goku Román",                        src: "Q516254", note: "Dublette, gleiche QID" },
  { from: "Hans Nunoo Sarpei",                   by: 1998, to: "Nunoo Sarpei",                      src: "Q27096618", note: "Dublette, gleiche QID" },
  { from: "Illya Zabarnyi",                      by: 2002, to: "Ilya Zabarnyi",                     src: "Q99360090", note: "Dublette, gleiche QID" },
  { from: "Jan-Niklas Beste",                    by: 1999, to: "Niklas Beste",                      src: "Q36391177", note: "Dublette, gleiche QID" },
  { from: "Javier Hervás",                       by: 1989, to: "Javi Hervás",                       src: "Q1029913", note: "Dublette, gleiche QID" },
  { from: "Jean Manuel Mbom",                    by: 2000, to: "Jean-Manuel Mbom",                  src: "Q57580407", note: "Dublette, gleiche QID" },
  { from: "Jesús Manuel Corona",                 by: 1993, to: "Jesús Corona",                      src: "Q607790", note: "Dublette, gleiche QID" },
  { from: "Johnny Heitinga",                     by: 1983, to: "John Heitinga",                     src: "Q946457", note: "Dublette, gleiche QID" },
  { from: "Jorge Luis Gabrich",                  by: 1963, to: "Jorge Gabrich",                     src: "Q3810064", note: "Dublette, gleiche QID" },
  { from: "José Ángel Pozo",                     by: 1996, to: "José Pozo",                         src: "Q18122940", note: "Dublette, gleiche QID" },
  { from: "José Manuel Arnáiz",                  by: 1995, to: "José Arnaiz",                       src: "Q21621620", note: "Dublette, gleiche QID" },
  { from: "José Luis Gayà",                      by: 1995, to: "José Gayà",                         src: "Q15396247", note: "Dublette, gleiche QID" },
  { from: "José Ignacio Peleteiro",              by: 1991, to: "Jota Peleteiro",                    src: "Q3391399", note: "Dublette, gleiche QID" },
  { from: "Pepín Machín",                        by: 1996, to: "José Machín",                       src: "Q21482821", note: "Dublette, gleiche QID" },
  { from: "Juan Manuel Iturbe",                  by: 1993, to: "Juan Iturbe",                       src: "Q968361", note: "Dublette, gleiche QID" },
  { from: "Koba Leïn Koindredi",                 by: 2001, to: "Koba Koindredi",                    src: "Q104587845", note: "Dublette, gleiche QID" },
  { from: "Konstantinos Mitroglou",              by: 1988, to: "Kostas Mitroglou",                  src: "Q312534", note: "Dublette, gleiche QID" },
  { from: "Konstantinos Stafylidis",             by: 1993, to: "Kostas Stafylidis",                 src: "Q3080534", note: "Dublette, gleiche QID" },
  { from: "Konstantinos Tsimikas",               by: 1996, to: "Kostas Tsimikas",                   src: "Q22005877", note: "Dublette, gleiche QID" },
  { from: "Kwasi Okyere Wriedt",                 by: 1994, to: "Kwasi Wriedt",                      src: "Q27047920", note: "Dublette, gleiche QID" },
  { from: "Lars Lukas Mai",                      by: 2000, to: "Lukas Mai",                         src: "Q52084009", note: "Dublette, gleiche QID" },
  { from: "Luca-Milan Zander",                   by: 1995, to: "Luca Zander",                       src: "Q21023187", note: "Dublette, gleiche QID" },
  { from: "M'Baye Niang",                        by: 1994, to: "Mbaye Niang",                       src: "Q26522", note: "Dublette, gleiche QID" },
  { from: "Manuel del Moral",                    by: 1984, to: "Manu del Moral",                    src: "Q359056", note: "Dublette, gleiche QID" },
  { from: "Marc Hagit Cucurella",                by: 1998, to: "Marc Cucurella",                    src: "Q22082505", note: "Dublette, gleiche QID" },
  { from: "Marcos Lopes",                        by: 1995, to: "Rony Lopes",                        src: "Q2811689", note: "Dublette, gleiche QID" },
  { from: "Miguel Alfonso Herrero",              by: 1988, to: "Míchel Herrero",                    src: "Q2075500", note: "Dublette, gleiche QID" },
  { from: "Miguel Juan Llambrich",               by: 1996, to: "Miguel Llambrich",                  src: "Q22006870", note: "Dublette, gleiche QID" },
  { from: "Mykhaylo Mudryk",                     by: 2001, to: "Mykhailo Mudryk",                   src: "Q58494476", note: "Dublette, gleiche QID" },
  { from: "Nathaniel Phillips",                  by: 1997, to: "Nat Phillips",                      src: "Q66385776", note: "Dublette, gleiche QID" },
  { from: "Nicolás González",                    by: 1998, to: "Nico González",                     src: "Q43381082", note: "Dublette, gleiche QID" },
  { from: "Nicolás Federico Spolli",             by: 1983, to: "Nicolás Spolli",                    src: "Q1279846", note: "Dublette, gleiche QID" },
  { from: "Olivier Deman",                       by: 2000, to: "Oliver Deman",                      src: "Q69496466", note: "Dublette, gleiche QID" },
  { from: "Osame Sahraoui",                      by: 2001, to: "Osama Sahraoui",                    src: "Q96679651", note: "Dublette, gleiche QID" },
  { from: "Phillipp Mwene",                      by: 1994, to: "Philipp Mwene",                     src: "Q11634138", note: "Dublette, gleiche QID" },
  { from: "Rafael Santos Borré",                 by: 1995, to: "Rafael Borré",                      src: "Q18719633", note: "Dublette, gleiche QID" },
  { from: "Srdjan Lakic",                        by: 1983, to: "Srđan Lakić",                       src: "Q531253", note: "Dublette, gleiche QID" },
  { from: "Sven Norman Botman",                  by: 2000, to: "Sven Botman",                       src: "Q56183905", note: "Dublette, gleiche QID" },
  { from: "Tay Abed",                            by: 2004, to: "Tai Abed",                          src: "Q112869138", note: "Dublette, gleiche QID" },
  { from: "Thierry Alberto Correia",             by: 1999, to: "Thierry Correia",                   src: "Q59306442", note: "Dublette, gleiche QID" },
  { from: "Thomas Cannon",                       by: 2002, to: "Tom Cannon",                        src: "Q115208158", note: "Dublette, gleiche QID" },
  { from: "Vasilios Torosidis",                  by: 1985, to: "Vasilis Torosidis",                 src: "Q201776", note: "Dublette, gleiche QID" },
  { from: "Viktor Klonaridis",                   by: 1992, to: "Victor Klonaridis",                 src: "Q2778464", note: "Dublette, gleiche QID" },
  { from: "Vinicius Souza",                      by: 1999, to: "Vini Souza",                        src: "Q69968896", note: "Dublette, gleiche QID" },
  { from: "Yann Aurel Bisseck",                  by: 2000, to: "Yann Bisseck",                      src: "Q43769705", note: "Dublette, gleiche QID" },
  { from: "Yevhen Konoplyanka",                  by: 1989, to: "Yevgen Konoplyanka",                src: "Q284078", note: "Dublette, gleiche QID" },
];

// Records, die aus dem Datensatz verschwinden. `aliases` fängt Schreibweisen ab,
// unter denen derselbe Record nach einem Pipeline-Lauf wieder auftauchen kann.
export const EXCLUDED_PLAYERS = [
  /* Trainer, die über die Wikipedia-Kadertabelle als Spieler ihres Vereins gelandet
     sind. Beide sind Ex-Profis (P106 „Fußballspieler"), haben aber für Valencia bzw.
     Villarreal nie gespielt — sie trainieren sie. wikipedia_squads.mjs filtert das
     seither über P6087 („Trainer von"); diese beiden Karteileichen sind vom Lauf
     davor. */
  { n: "Carlos Corberán", by: 1983, aliases: ["Q27983031"],
    reason: "Trainer des FC Valencia; als Spieler nie dort (P6087, nicht P54)" },
  { n: "Marcelino García Toral", by: 1965, aliases: ["Q1339589"],
    reason: "Trainer des FC Villarreal; als Spieler nie dort (P6087, nicht P54)" },

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
