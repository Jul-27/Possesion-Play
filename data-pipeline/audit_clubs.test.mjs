import { test } from "node:test";
import assert from "node:assert/strict";
import { clubsQuery } from "./audit_clubs.mjs";

/* Diese eine Zeile entscheidet über die Brauchbarkeit des ganzen Werkzeugs. `wdt:P54`
   liefert nur Aussagen mit dem besten Rang — steht der aktuelle Verein auf „bevorzugt",
   ist die komplette Vereinshistorie unsichtbar. Gemessen am 04.08.2026: mit `wdt:`
   meldete der Lauf 4 von 25 Spielern als fehlerhaft (Hakimi „verliert" BVB/INT/RMA,
   Rabiot alles außer Milan), mit `p:/ps:` waren es 0. */
test("die Vereinsabfrage liest ALLE P54-Aussagen, nicht nur den bevorzugten Rang", () => {
  const q = clubsQuery(["Q1", "Q2"]);
  assert.match(q, /p:P54\/ps:P54/, "muss p:P54/ps:P54 verwenden");
  assert.doesNotMatch(q, /wdt:P54/, "wdt:P54 blendet die Vereinshistorie aus — nie hier verwenden");
});

test("die Vereinsabfrage filtert auf Fußballspieler mit Geburtsjahr", () => {
  const q = clubsQuery(["Q1"]);
  assert.match(q, /wdt:P106 wd:Q937857/, "ohne Berufsfilter kommen Namensvettern durch");
  assert.match(q, /wdt:P569/, "das Geburtsjahr ist der halbe Abgleichschlüssel");
});

test("die Vereinsabfrage bindet alle übergebenen QIDs ein", () => {
  const q = clubsQuery(["Q42", "Q1337"]);
  assert.match(q, /wd:Q42/);
  assert.match(q, /wd:Q1337/);
});

/* OPTIONAL, nicht Pflicht: ein Spieler ohne jeden Verein muss trotzdem mit seinem
   Geburtsjahr zurückkommen. Sonst landet er unter „nicht auflösbar" statt unter
   „nicht vergleichbar" — und genau diese Unterscheidung ist der Kern der Auswertung. */
test("Spieler ohne Verein fallen nicht aus dem Ergebnis", () => {
  assert.match(clubsQuery(["Q1"]), /OPTIONAL \{ \?p p:P54\/ps:P54 \?c \}/);
});
