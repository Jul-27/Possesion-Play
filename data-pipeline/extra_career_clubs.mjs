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
];
