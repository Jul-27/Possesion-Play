import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOverrides, mergeInto, isExcluded } from "./apply_name_overrides.mjs";

const OV = [{ from: "João pelix", by: 1999, to: "João Félix", src: "Q27049064" }];
const EX = [{ n: "Jason Statham", by: 1967, aliases: ["Q169963"], reason: "Schauspieler, kein Fußballer" }];

test("applyOverrides benennt um und leitet den Nachnamen neu ab", () => {
  const { players, stats } = applyOverrides(
    [{ n: "João pelix", ln: "pelix", by: 1999, nat: ["PRT"], clubs: [], sl: 60 }], OV, EX);
  assert.equal(players.length, 1);
  assert.equal(players[0].n, "João Félix");
  assert.equal(players[0].ln, "Félix");
  assert.equal(stats.renamed, 1);
});

test("applyOverrides verschmilzt den umbenannten Record mit dem vorhandenen", () => {
  const { players, stats } = applyOverrides([
    { n: "João Félix", ln: "Félix", by: 1999, nat: ["PRT"], clubs: ["ATM", "SLB"], t: ["MLL"], sl: 0, pos: "ST", cp: [["ATM", 2019, 2023]] },
    { n: "João pelix", ln: "pelix", by: 1999, nat: [], clubs: ["CHE"], t: ["CDR"], sl: 60 },
  ], OV, EX);
  assert.equal(players.length, 1);
  assert.equal(stats.merged, 1);
  const p = players[0];
  assert.deepEqual(p.clubs, ["ATM", "CHE", "SLB"]);
  assert.deepEqual(p.t, ["CDR", "MLL"]);
  assert.equal(p.sl, 60, "höchster sl-Wert gewinnt");
  assert.equal(p.pos, "ST", "pos darf nicht verloren gehen");
  assert.deepEqual(p.cp, [["ATM", 2019, 2023]], "cp darf nicht verloren gehen");
});

test("applyOverrides entfernt Ausschlüsse — auch unter ihrem Alias", () => {
  const { players, stats } = applyOverrides([
    { n: "Jason Statham", ln: "Statham", by: 1967, nat: [], clubs: ["MUN"], sl: 97 },
    { n: "Q169963", ln: "Q169963", by: 1967, nat: [], clubs: ["MUN"], sl: 97 },
    { n: "Brian Statham", ln: "Statham", by: 1969, nat: [], clubs: ["TOT"], sl: 4 },
  ], OV, EX);
  assert.deepEqual(players.map((p) => p.n), ["Brian Statham"]);
  assert.equal(stats.removed, 2);
});

test("applyOverrides ist idempotent", () => {
  const input = [{ n: "João pelix", ln: "pelix", by: 1999, nat: [], clubs: ["CHE"], sl: 60 }];
  const first = applyOverrides(input, OV, EX).players;
  const second = applyOverrides(first.map((p) => ({ ...p })), OV, EX);
  assert.deepEqual(second.players, first);
  assert.equal(second.stats.renamed, 0);
});

test("applyOverrides greift nur beim passenden Geburtsjahr", () => {
  const { players } = applyOverrides([{ n: "João pelix", ln: "pelix", by: 1988, nat: [], clubs: [], sl: 1 }], OV, EX);
  assert.equal(players[0].n, "João pelix");
});

test("mergeInto behält eine schon gesetzte Nationalität", () => {
  const a = mergeInto({ nat: ["MEX"], clubs: [] }, { nat: ["ESP"], clubs: [] });
  assert.deepEqual(a.nat, ["MEX"]);
});

test("isExcluded prüft Name und Geburtsjahr gemeinsam", () => {
  assert.equal(isExcluded({ n: "Jason Statham", by: 1967 }, EX), true);
  assert.equal(isExcluded({ n: "Jason Statham", by: 1980 }, EX), false);
  assert.equal(isExcluded({ n: "Brian Statham", by: 1967 }, EX), false);
});

/* Zwei Schreibweisen desselben Spielers entstanden, weil Pipeline und App
   unterschiedlich normalisierten: die Pipeline ließ ł/ø/ð/æ/þ stehen, die App räumt
   sie ab. So lagen 12 Spieler doppelt im Datensatz — mit GETEILTEN Vereinen
   (Przemysław Tytoń hatte Ajax nur auf einer der beiden Karten). */
test("besserGeschrieben behält die Schreibweise mit Sonderzeichen", async () => {
  const { besserGeschrieben } = await import("./apply_name_overrides.mjs");
  assert.equal(besserGeschrieben("Lukasz Fabianski", "Łukasz Fabiański"), "Łukasz Fabiański");
  assert.equal(besserGeschrieben("Łukasz Fabiański", "Lukasz Fabianski"), "Łukasz Fabiański");
  assert.equal(besserGeschrieben("Marcin Bulka", "Marcin Bułka"), "Marcin Bułka");
  assert.equal(besserGeschrieben("Harry Kane", "Harry Kane"), "Harry Kane");
});

test("besserGeschrieben bleibt bei Gleichstand beim ersten", async () => {
  const { besserGeschrieben } = await import("./apply_name_overrides.mjs");
  assert.equal(besserGeschrieben("Filip Jörgensen", "Filip Jørgensen"), "Filip Jörgensen");
});

test("mergeInto übernimmt die bessere Schreibweise samt Nachnamen", async () => {
  const { mergeInto } = await import("./apply_name_overrides.mjs");
  const a = { n: "Lukasz Fabianski", ln: "Fabianski", by: 1985, nat: [], clubs: ["ARS"] };
  mergeInto(a, { n: "Łukasz Fabiański", ln: "Fabiański", by: 1985, nat: ["POL"], clubs: ["ARS"] });
  assert.equal(a.n, "Łukasz Fabiański");
  assert.equal(a.ln, "Fabiański", "der Nachname muss neu abgeleitet werden");
});

/* Der eigentliche Gewinn der Verschmelzung: die Vereine der beiden Karten. */
test("mergeInto vereinigt geteilte Vereine und Titel", async () => {
  const { mergeInto } = await import("./apply_name_overrides.mjs");
  const a = { n: "Przemyslaw Tyton", ln: "Tyton", by: 1987, nat: [], clubs: ["PSV", "VFB"], t: ["MPL"] };
  mergeInto(a, { n: "Przemysław Tytoń", ln: "Tytoń", by: 1987, nat: ["POL"], clubs: ["AJA", "PSV", "VFB"], t: ["EL"] });
  assert.deepEqual(a.clubs, ["AJA", "PSV", "VFB"]);
  assert.deepEqual(a.t, ["EL", "MPL"]);
  assert.deepEqual(a.nat, ["POL"], "eine fehlende Nation wird ergänzt");
});
