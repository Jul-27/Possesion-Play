/* Kuratierte KARRIEREVEREINE — das Gegenstück zu EXTRA_PLAYERS für Vereine, die
   keine der 47 Spielvereine sind.

   WOZU: `EXTRA_PLAYERS.clubs` nimmt nur die 47 Vereine mit Wappen und Hexfeld.
   Das Transferkarussell und der Karriere-Pfad prüfen aber gegen careerClubs.js mit
   über 8000 Vereinen — und genau dort schlugen die ersten Fehlermeldungen aus dem
   Spiel auf: Paul Wanner ohne Elversberg, Prass ohne Sturm Graz, Waldschmidt ohne
   Köln. Für solche Stationen gab es bis dahin keinen Korrekturweg.

   WARUM NICHT EINFACH WIKIDATA NACHZIEHEN: Bei allen gemeldeten Fällen wurde live
   nachgeprüft (auch über die QID, nicht nur über den Namen) — Wikidata führt diese
   Stationen schlicht nicht. Leihen und jüngere Wechsel fehlen dort oft jahrelang.
   Ein Voll-Refresh bringt sie also nicht; sie müssen kuratiert werden.

   REGEL WIE BEI EXTRA_PLAYERS: Hier steht nur, was der Owner bestätigt hat. Eine
   schweigende Quelle belegt nichts — weder dafür noch dagegen (siehe den Röhl-Fall
   im Kommentar von apply_extra_players.mjs).

   Der Vereinsname muss exakt so geschrieben sein, wie ihn careerClubs.js führt,
   sonst entsteht ein zweiter Eintrag für denselben Verein. `apply_extra_career_clubs.mjs`
   warnt, wenn ein Name noch gar nicht vorkommt. */
export const EXTRA_CAREER_CLUBS = [
  /* Erste Ladung aus „Fehler melden" (Transferkarussell-Duell, 18.08.2026).
     Jede Station wurde doppelt gegengeprüft:
       · Wikidata über NAME und über QID — führt keine einzige davon.
       · de.wikipedia — alle sechs stehen dort in der Infobox-Karrieretabelle
         ({{Team-Station}}), also als Station, nicht als Erwähnung im Fließtext.
     Wikidata hinkt bei Leihen und jüngeren Wechseln oft Jahre hinterher; ein
     Voll-Refresh holt diese Stationen deshalb NICHT nach. */
  { n: "Paul Wanner",       by: 2005, clubs: ["SV Elversberg"] },    // 2023–2024, Leihe
  { n: "Alexander Prass",   by: 2001, clubs: ["SK Sturm Graz"] },    // 2021–2024
  { n: "Hannes Wolf",       by: 1999, clubs: ["New York City FC"] }, // 2024–
  { n: "Luca Waldschmidt",  by: 1996, clubs: ["1. FC Köln"] },       // 2023–
  { n: "Marc Oliver Kempf", by: 1995, clubs: ["Hertha BSC"] },       // 2022–2024

  /* Nachgezogen mit wikipedia_career.mjs (19.08.2026): Wer einmal gemeldet wurde,
     hat meist mehrere Lücken — es sind dieselben Leihen und jüngeren Wechsel, die
     Wikidata verschweigt. Damit erübrigen sich Folgemeldungen zu denselben Namen.
     Vereinsnamen exakt in der Schreibweise von careerClubs.js. */
  { n: "Paul Wanner",       by: 2005, clubs: ["1. FC Heidenheim 1846"] },      // 2024–2025, Leihe
  { n: "Hannes Wolf",       by: 1999, clubs: ["Swansea City"] },               // 2022, Leihe
  { n: "Junior Adamu",      by: 2001, clubs: ["FC St. Gallen", "Celtic Glasgow"] }, // 2021 (Leihe) · 2026
  { n: "Marc Oliver Kempf", by: 1995, clubs: ["Como 1907"] },                  // 2024–

  /* Zweite Ladung aus „Fehler melden" (26.08.2026), 15 Meldungen. Gemeldet wurde
     jeweils EINE Station; eingetragen ist die ganze fehlende Karriere aus der
     Infobox-Tabelle, weil eine Meldung fast nie allein kommt.

     VIER Namen sind bewusst NICHT übernommen, obwohl Wikipedia sie nennt — sie
     stehen bei uns schon unter anderer Schreibweise, und ein zweiter Eintrag wäre
     ein zweiter Verein:
       „FC Admira Wacker Mödling" → haben wir als „Admira Wacker"
       „FC Parma"                 → „Parma Calcio 1913"
       „AS Livorno"               → „US Livorno 1915"
       „FC Magna Wiener Neustadt" → „SC Wiener Neustadt"
       „Al-Gharafa"               → „Al-Gharafa Sports Club"
     Die deutsche Wikipedia verlinkt diese Vereine unter Kurzformen, careerClubs.js
     führt sie unter dem deutschen Wikidata-Label. Nur „FK IMT" ist wirklich neu.
     Ebenso draußen bleibt Stefan Schwabs „Red Bull Juniors": eine Nachwuchsmannschaft,
     und die führt careerClubs.js grundsätzlich nicht.

     NICHT übernommen wurde außerdem die Meldung „Raheem Sterling → PSV Eindhoven":
     seine Karrieretabelle nennt Liverpool, Manchester City, Chelsea, Arsenal und
     Feyenoord Rotterdam — kein PSV. Vermutlich wurden die beiden niederländischen
     Vereine verwechselt. Eine Meldung ist eine Behauptung, kein Beleg. */
  { n: "Fisnik Asllani",    by: 2002, clubs: ["FK Austria Wien", "SV Elversberg"] },   // 2023–2024 · 2024–2025
  { n: "Stefan Schwab",     by: 1990, clubs: ["PAOK Thessaloniki", "Holstein Kiel", "SV Ried"] }, // 2020–2025 · 2025–2026 · 2026–
  { n: "Ishak Belfodil",    by: 1992, clubs: ["Standard Lüttich", "Hertha BSC", "Al-Gharafa Sports Club", "Sabah FK", "FK IMT"] }, // 2016–2018 · 2021–2022 · 2022–2023 · 2023–2024 · 2025
  { n: "Davinson Sánchez",  by: 1996, clubs: ["Galatasaray Istanbul"] },               // 2023–
  { n: "Carlos Espí",       by: 2005, clubs: ["Levante UD"] },                         // 2024–2026
  { n: "Oscar Bobb",        by: 2003, clubs: ["FC Fulham"] },                          // 2026–
  { n: "Patrick Farkas",    by: 1992, clubs: ["FC Luzern", "TSV Hartberg", "SV Oberwart"] }, // 2021 · 2022–2023 · 2023–
  { n: "Michaël Cuisance",  by: 1999, clubs: ["FC Venedig", "Sampdoria Genua", "VfL Osnabrück", "Hertha BSC", "RC Lens"] }, // 2022–2024 · 2023 (Leihe) · 2023–2024 (Leihe) · 2024–2026 · 2026–
  { n: "Sepp van den Berg", by: 2001, clubs: ["PEC Zwolle", "Preston North End", "FC Brentford"] }, // 2018–2019 · 2021–2022 (Leihe) · 2024–
  { n: "Alexander Schwolow", by: 1992, clubs: ["1. FC Union Berlin", "Heart of Midlothian"] }, // 2023–2025 · 2025–2026
  { n: "Jannik Vestergaard", by: 1992, clubs: ["FC Southampton", "Leicester City"] },  // 2018–2021 · 2021–
  { n: "Eren Dinkçi",       by: 2001, clubs: ["1. FC Heidenheim 1846"] },              // 2023–2024
  { n: "Guido Burgstaller", by: 1989, clubs: ["FC St. Pauli"] },                       // 2020–2022

  /* ── Aus „Fehler melden", Durchsicht vom 13.09.2026 ────────────────────────
     Wer einmal gemeldet wird, hat meist mehrere Lücken — es sind dieselben Leihen
     und jüngeren Wechsel, die Wikidata verschweigt. Alle Stationen stehen in der
     Infobox-Karrieretabelle der deutschen Wikipedia; die Schreibweise ist die aus
     careerClubs.js.

     NICHT übernommen wurden Schreibvarianten von Vereinen, die wir bereits führen —
     „FC Parma" zu unserem „Parma Calcio 1913", „UD Levante" zu „Levante UD",
     „1. FC Heidenheim" zu „1. FC Heidenheim 1846", „FC Magna Wiener Neustadt" zu
     „SC Wiener Neustadt", „Deportivo La Coruña" zu „Deportivo A Coruña",
     „Al-Gharafa" zu „Al-Gharafa Sports Club", „FK IMT Belgrad" zu „FK IMT". Sie
     ergäben je einen zweiten Eintrag für denselben Verein. Ebenso weggelassen sind
     Zweitmannschaften (Real Madrid Castilla, Red Bull Juniors). */
  /* Die Spielvereine stehen doppelt — in EXTRA_PLAYERS als Kürzel für Hexfeld und
     Wappen, hier unter ihrem vollen Namen fürs Karussell. Der Karussell-Bestand wird
     von wikidata_career_clubs.mjs gebaut und kennt die kuratierten Nachträge nicht;
     ohne diese Zeilen fehlte Capaldo dort Salzburg, obwohl es im Hexspiel zählt. */
  { n: "Jacob Bruun Larsen", by: 1998, clubs: ["RSC Anderlecht", "FC Burnley", "TSG 1899 Hoffenheim"] },  // 2021, Leihe · 2023–2024, Leihe · 2020–2025
  { n: "Gonçalo Paciência",  by: 1994, clubs: ["Rio Ave FC", "Vitória Setúbal", "Celta Vigo",
                                               "VfL Bochum", "Sanfrecce Hiroshima", "Sport Recife",
                                               "CD Santa Clara", "FC Schalke 04"] },                     // 2017 bis 2026– · S04 2020–2021
  { n: "Sejad Salihović",    by: 1984, clubs: ["DJK SC Schwarz-Weiß Frankenthal", "Hamburger SV"] },     // 2019–2020 · 2017–2018
  { n: "Mads Bidstrup",      by: 2001, clubs: ["FC Brentford", "FC Nordsjælland",
                                               "FC Red Bull Salzburg"] },                                // 2020–2023 · 2022–2023 · 2023–2026
  { n: "Robert Glatzel",     by: 1994, clubs: ["SV Heimstetten", "Wacker Burghausen", "Cardiff City",
                                               "1. FC Heidenheim 1846", "1. FSV Mainz 05",
                                               "Hamburger SV"] },                                        // 2013 bis 2021–2026
  /* Capaldo: Boca Juniors und Salzburg stehen in beiden Wikipedias, im Karussell
     fehlte beides — er hatte dort nur den HSV. Schlüssel ist das im Bestand geführte
     Jahr 1997, siehe die Anmerkung in apply_extra_players.mjs. */
  /* Auch hier auf 1998 umgestellt. „Hamburger SV" steht mit dabei, weil der
     Karussell-Bestand diese Station unter dem alten Schlüssel 1997 führt und sie
     beim Umschlüsseln sonst verlorenginge; beim nächsten Voll-Refresh baut sich die
     Datei ohnehin aus dem korrigierten players.js neu auf. */
  { n: "Nicolás Capaldo",    by: 1998, clubs: ["Boca Juniors", "FC Red Bull Salzburg",
                                               "Hamburger SV"] },                                        // 2015–2021 · 2021–2025 · 2025–
  /* „Fehler melden", 16.–23.09.2026, geprüft an der Infobox der englischen Wikipedia
     (25.09.2026). Samassékou stand im Karussell ganz ohne Station. */
  { n: "Diadié Samassékou",  by: 1996, clubs: ["FC Liefering", "FC Red Bull Salzburg", "TSG 1899 Hoffenheim",
                                               "Olympiakos Piräus", "FC Cádiz", "Houston Dynamo"] },    // 2015–16 · 2016–19 · 2019–25 · 2022–23 L · 2024 L · 2025–
  { n: "Amadou Haidara",     by: 1998, clubs: ["RC Lens"] },                                             // 2025–
  { n: "Noah Okafor",        by: 2000, clubs: ["Leeds United"] },                                        // 2025–
  { n: "Amin Younes",        by: 1993, clubs: ["FC Schalke 04"] },                                       // 2024–2026
  { n: "Kerim Alajbegović",  by: 2007, clubs: ["Bayer 04 Leverkusen"] },                                 // 2026
];

/* ── Das Gegenstück: Stationen, die wir zu Unrecht führen ────────────────────
   WRONG_CLUBS in apply_extra_players.mjs streicht einen der 47 Spielvereine aus
   `clubs`. Fürs Karussell gab es das nicht — Sejad Salihović stand dort weiter bei
   Inter Mailand, wo er nie gespielt hat, obwohl der Eintrag im Hexspiel längst
   entfernt war. Zwei Korrekturwege für dieselbe Falschangabe, und einer fehlte.

   Wie überall gilt: Hier steht nur, was belegt widerlegt ist, mit dem Grund. */
export const FALSCHE_CAREER_CLUBS = [
  { n: "Sejad Salihović", by: 1984, clubs: ["Inter Mailand"],
    grund: "Karrieretabelle auf de- und en.wikipedia nennt Hertha BSC, Hoffenheim, "
      + "Guizhou/Beijing Renhe, St. Gallen, HSV und Frankenthal — kein Inter." },
];

