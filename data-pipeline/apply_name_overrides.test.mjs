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
