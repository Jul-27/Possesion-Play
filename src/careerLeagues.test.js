import { test } from "node:test";
import assert from "node:assert/strict";
import { leaguesOf, activeInRange, playerMatchesHex, lookupDef, answerGuessQuestion } from "./gameData.js";

test("leaguesOf: vereinigt lg mit den Ligen der Spielvereine", () => {
  // MIL = Serie A (Spielverein), lg trägt zusätzlich La Liga (z. B. von Betis)
  assert.deepEqual([...leaguesOf({ clubs: ["MIL"], lg: ["LL"] })].sort(), ["LL", "SA"]);
  // nur Spielvereine, kein lg
  assert.deepEqual([...leaguesOf({ clubs: ["FCB"] })], ["BL"]);
  // nur lg, keine Spielvereine
  assert.deepEqual([...leaguesOf({ clubs: [], lg: ["LL"] })], ["LL"]);
  // gar nichts
  assert.deepEqual([...leaguesOf({})], []);
});

test("Liga-Hexfeld: lg zählt auch ohne passenden Spielverein", () => {
  const LL = lookupDef("league", "LL");
  // Rodríguez-Fall: kein La-Liga-Spielverein, aber lg via Betis
  assert.equal(playerMatchesHex({ clubs: ["MIL", "WOB"], lg: ["LL"] }, LL), true);
  // Fallback: ohne lg über den Spielverein
  assert.equal(playerMatchesHex({ clubs: ["BAR"] }, LL), true);
  // kein Treffer
  assert.equal(playerMatchesHex({ clubs: ["FCB"] }, LL), false);
});

test("activeInRange: nutzt span, sonst cp", () => {
  // Sommer-Fall: span deckt die 2000er (Basel 2005–2014), cp begänne erst 2014
  const sommer = { span: [2005, 0], cp: [["BMG", 2014, 2023]] };
  assert.equal(activeInRange(sommer, 2000, 2009), true, "span deckt 2000er");
  assert.equal(activeInRange(sommer, 2010, 2019), true);
  // laufende Karriere (bis 0) reicht bis heute
  assert.equal(activeInRange({ span: [2018, 0] }, 2020, 2029), true);
  // span deckt Bereich nicht
  assert.equal(activeInRange({ span: [2015, 2020] }, 2000, 2009), false);
  // ohne span: Fallback auf cp
  assert.equal(activeInRange({ cp: [["FCB", 2005, 2008]] }, 2000, 2009), true);
  // weder span noch cp
  assert.equal(activeInRange({}, 2000, 2009), false);
});

test("T5L: zählt Top-5-Ligen aus lg (nicht nur Spielvereine)", () => {
  const T5L = lookupDef("spec", "T5L");
  // ein Spielverein (SA) + zwei Ligen nur über lg
  assert.equal(playerMatchesHex({ clubs: ["MIL"], lg: ["PL", "LL"] }, T5L), true);
  // nur zwei Top-5 -> nicht erfüllt
  assert.equal(playerMatchesHex({ clubs: ["MIL"], lg: ["PL"] }, T5L), false);
});

test("Guess-Spiel: Liga-Frage nutzt dieselbe Logik", () => {
  assert.equal(answerGuessQuestion({ clubs: ["WOB"], lg: ["LL"] }, { dim: "league", val: "LL" }), true);
  assert.equal(answerGuessQuestion({ clubs: ["FCB"] }, { dim: "league", val: "LL" }), false);
});

test("Echtdaten: die gemeldeten Fälle zählen jetzt", async () => {
  const { PLAYERS } = await import("./players.js");
  const f = (n) => PLAYERS.find((p) => p.n === n);
  // #3 Sommer war in den 2000ern bei Basel aktiv
  assert.equal(playerMatchesHex(f("Yann Sommer"), lookupDef("spec", "A00")), true);
  // #2 Rodríguez spielte La Liga (bei Real Betis, kein Spielverein)
  assert.equal(playerMatchesHex(f("Ricardo Rodríguez"), lookupDef("league", "LL")), true);
  // Regressionsschutz: RB-Salzburg-Ära bleibt erhalten (cp speist span)
  assert.equal(playerMatchesHex(f("Erling Haaland"), lookupDef("spec", "A10")), true);
});

test("Echtdaten: kein span macht Minderjährige aktiv (Akademie-Klemme)", async () => {
  const { PLAYERS } = await import("./players.js");
  // Messi (geb. 1987) darf nicht als „aktiv in den 90ern" gelten
  assert.equal(playerMatchesHex(PLAYERS.find((p) => p.n === "Lionel Messi"), lookupDef("spec", "A90")), false);
});

test("Echtdaten: lg-Codes und span sind wohlgeformt", async () => {
  const { PLAYERS } = await import("./players.js");
  const ok = new Set(["BL", "PL", "LL", "SA", "L1", "PT", "NL"]);
  for (const p of PLAYERS) {
    if (p.lg) for (const c of p.lg) assert.ok(ok.has(c), `ungültiger lg-Code ${c} bei ${p.n}`);
    if (p.span) {
      assert.equal(p.span.length, 2);
      assert.ok(p.span[1] === 0 || p.span[1] >= p.span[0], `kaputte span bei ${p.n}`);
    }
  }
});
