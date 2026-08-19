import { test } from "node:test";
import assert from "node:assert/strict";
import { applyExtraCareerClubs, baueDatei } from "./apply_extra_career_clubs.mjs";

const clubs = ["1. FC Köln", "FC Bayern München", "SV Elversberg"];
const byKey = { "paul wanner|2005": [1], "luca waldschmidt|1996": [1] };

test("eine kuratierte Station kommt dazu, ohne die vorhandenen zu verlieren", () => {
  const r = applyExtraCareerClubs(clubs, byKey,
    [{ n: "Paul Wanner", by: 2005, clubs: ["SV Elversberg"] }]);
  assert.deepEqual(r.byKey["paul wanner|2005"], [1, 2]);
  assert.deepEqual(r.byKey["luca waldschmidt|1996"], [1], "andere Spieler bleiben unberührt");
  assert.equal(r.bericht.ergaenzt, 1);
});

test("Diakritika im Namen treffen denselben Schlüssel wie im Datensatz", () => {
  const r = applyExtraCareerClubs(["Hertha BSC"], { "marc oliver kempf|1995": [] },
    [{ n: "Marc Oliver Kempf", by: 1995, clubs: ["Hertha BSC"] }]);
  assert.deepEqual(r.byKey["marc oliver kempf|1995"], [0]);
});

/* Zweimal anwenden darf nichts verdoppeln — das Skript läuft bei jedem Refresh. */
test("mehrfaches Anwenden ändert nichts", () => {
  const extras = [{ n: "Paul Wanner", by: 2005, clubs: ["SV Elversberg"] }];
  const eins = applyExtraCareerClubs(clubs, byKey, extras);
  const zwei = applyExtraCareerClubs(eins.clubs, eins.byKey, extras);
  assert.deepEqual(zwei.byKey, eins.byKey);
  assert.deepEqual(zwei.clubs, eins.clubs);
  assert.equal(zwei.bericht.ergaenzt, 0);
  assert.equal(zwei.bericht.schonDa, 1);
});

test("ein Spieler ohne bisherige Stationen bekommt einen neuen Eintrag", () => {
  const r = applyExtraCareerClubs(clubs, byKey,
    [{ n: "Neuer Spieler", by: 1990, clubs: ["1. FC Köln"] }]);
  assert.deepEqual(r.byKey["neuer spieler|1990"], [0]);
});

/* Ein unbekannter Vereinsname wird angehängt UND gemeldet: meist ist er nur anders
   geschrieben, und ein stiller Zweiteintrag desselben Vereins wäre schlimmer als
   eine Warnung. */
test("ein unbekannter Verein wird angehängt und gemeldet", () => {
  const r = applyExtraCareerClubs(clubs, byKey,
    [{ n: "Paul Wanner", by: 2005, clubs: ["FC Neuerfunden"] }]);
  assert.equal(r.clubs.length, 4);
  assert.equal(r.clubs[3], "FC Neuerfunden");
  assert.deepEqual(r.bericht.neueVereine, ["FC Neuerfunden"]);
  assert.deepEqual(r.byKey["paul wanner|2005"], [1, 3]);
});

test("eine leere Tabelle lässt alles unverändert", () => {
  const r = applyExtraCareerClubs(clubs, byKey, []);
  assert.deepEqual(r.clubs, clubs);
  assert.deepEqual(r.byKey, byKey);
  assert.equal(r.bericht.ergaenzt, 0);
});

/* Die geschriebene Datei muss wieder einlesbar sein — sie ist ein ES-Modul, das der
   Browser lädt. Ein Tippfehler in der Erzeugung fiele sonst erst beim Spielen auf. */
test("die erzeugte Datei ist gültiges, wieder ladbares JavaScript", async () => {
  const r = applyExtraCareerClubs(clubs, byKey,
    [{ n: "Paul Wanner", by: 2005, clubs: ["SV Elversberg"] }]);
  const quelle = baueDatei(r.clubs, r.byKey);
  const mod = await import("data:text/javascript;base64," + Buffer.from(quelle).toString("base64"));
  assert.deepEqual(mod.CAREER_CLUBS, r.clubs);
  assert.deepEqual(mod.CAREER_BY_KEY["paul wanner|2005"], [1, 2]);
  assert.match(quelle, /GENERIERT von data-pipeline/, "der Warnhinweis im Kopf bleibt stehen");
});
