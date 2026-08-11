import { test } from "node:test";
import assert from "node:assert/strict";
import { istZweitteam, ordneZu, baueDatei } from "./wikidata_career_clubs.mjs";

/* Zweitmannschaften müssen raus, sonst ist der Modus auszuhebeln: fast jeder
   Akademie-Spieler hat ein „II"-Team, und „Bayern II" wäre eine billige Antwort.
   Der Wikidata-Typ Q2412834 allein reicht nicht — Borussia Dortmund II trägt nur
   „Fußballmannschaft", Real Madrid Castilla und Valencia Mestalla tragen gar keine
   Ziffer. Deshalb zusätzlich dieses Muster. */
test("Zweit- und Jugendmannschaften werden erkannt", () => {
  for (const n of ["Borussia Dortmund II", "FC Barcelona B", "Real Madrid Castilla",
                   "FC Valencia Mestalla", "Johor Darul Ta'zim II FC", "Chelsea U-21",
                   "Ajax Youth Academy", "Juventus Next Gen", "Milan Futuro"]) {
    assert.equal(istZweitteam(n), true, `nicht erkannt: ${n}`);
  }
});

/* Das Muster muss eng bleiben: Willem II Tilburg, Athletic Bilbao und Bishop
   Auckland sind echte Vereine und dürfen nicht mitgerissen werden. */
test("echte Vereine bleiben unangetastet", () => {
  for (const n of ["Willem II Tilburg", "Athletic Bilbao", "Bishop Auckland F.C.",
                   "Atletico Roma", "1. FC Nürnberg", "Stoke City", "Bayer 04 Leverkusen",
                   "Inter Mailand", "Galatasaray Istanbul", "1. FC Kaiserslautern"]) {
    assert.equal(istZweitteam(n), false, `fälschlich aussortiert: ${n}`);
  }
});

const zeile = (name, by, club) => ({
  pLabel: { value: name }, by: { value: String(by) }, cLabel: { value: club },
});

test("ordneZu ordnet nur Spieler zu, die wir kennen", () => {
  const index = new Map([["marko arnautovic|1989", {}]]);
  const t = ordneZu([zeile("Marko Arnautović", 1989, "Stoke City"),
                     zeile("Irgendwer Anders", 1990, "FC Bayern München")], index);
  assert.deepEqual([...t.keys()], ["marko arnautovic|1989"]);
  assert.deepEqual([...t.get("marko arnautovic|1989")], ["Stoke City"]);
});

/* Genau der gemeldete Fall: unsere Karteikarte heißt „Marko Arnautovic" ohne ć,
   Wikidata liefert „Marko Arnautović". norm() gleicht das auf der Ergebnisseite aus. */
test("Diakritika im Wikidata-Label brechen die Zuordnung nicht", () => {
  const index = new Map([["ilkay gundogan|1990", {}]]);
  const t = ordneZu([zeile("İlkay Gündoğan", 1990, "1. FC Nürnberg")], index);
  assert.deepEqual([...t.get("ilkay gundogan|1990")], ["1. FC Nürnberg"]);
});

test("ordneZu trennt Namensvettern über das Geburtsjahr", () => {
  const index = new Map([["adriano|1982", {}]]);
  const t = ordneZu([zeile("Adriano", 1982, "Inter Mailand"),
                     zeile("Adriano", 1984, "FC Barcelona")], index);
  assert.deepEqual([...t.get("adriano|1982")], ["Inter Mailand"], "nur der Jahrgang 1982");
});

test("ordneZu verwirft Zweitmannschaften und QID-Rückfälle", () => {
  const index = new Map([["test spieler|1990", {}]]);
  const t = ordneZu([zeile("Test Spieler", 1990, "Borussia Dortmund II"),
                     zeile("Test Spieler", 1990, "Q12345"),
                     zeile("Test Spieler", 1990, "Stoke City")], index);
  assert.deepEqual([...t.get("test spieler|1990")], ["Stoke City"]);
});

test("baueDatei erzeugt gültiges, ladbares JavaScript", async () => {
  const inhalt = baueDatei(["1. FC Nürnberg", "Stoke City"],
    new Map([["a b|1990", new Set(["Stoke City"])], ["c d|1991", new Set(["1. FC Nürnberg", "Stoke City"])]]));
  const mod = await import("data:text/javascript," + encodeURIComponent(inhalt));
  assert.deepEqual(mod.CAREER_CLUBS, ["1. FC Nürnberg", "Stoke City"]);
  assert.deepEqual(mod.CAREER_BY_KEY["a b|1990"], [1]);
  assert.deepEqual(mod.CAREER_BY_KEY["c d|1991"], [0, 1], "Indizes aufsteigend sortiert");
});
