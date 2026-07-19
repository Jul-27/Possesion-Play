import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupDef, playerMatchesHex } from "./gameData.js";
import { ODD_SL_MIN, oddCandidates, oddRuleLabel, ambiguousWith, buildOddRound } from "./oddOneOut.js";

const P = (n, clubs, nat, t = []) => ({ n, ln: n, by: 1990, clubs, nat, t, sl: 99 });

test("oddRuleLabel formuliert je Attribut-Typ", () => {
  assert.equal(oddRuleLabel(lookupDef("club", "FCB")), "spielten alle für FC Bayern München");
  assert.equal(oddRuleLabel(lookupDef("league", "BL")), "spielten alle in der Bundesliga");
  assert.equal(oddRuleLabel(lookupDef("nat", "GER")), "kommen alle aus Deutschland");
  assert.equal(oddRuleLabel(lookupDef("honour", "WM")), "sind alle Weltmeister");
});

test("ambiguousWith: erkennt zweite 3:1-Regel mit anderem Außenseiter", () => {
  const fcb = lookupDef("club", "FCB");
  // Eindeutig: alle vier Deutsche, nur der Verein trennt
  const clean = [P("A", ["FCB"], ["GER"]), P("B", ["FCB"], ["GER"]), P("C", ["FCB"], ["GER"]), P("D", ["BVB"], ["GER"])];
  assert.equal(ambiguousWith(clean, 3, fcb), null);
  // Mehrdeutig: C ist Spanier -> „alle Deutschen" macht C zum Außenseiter
  const messy = [P("A", ["FCB"], ["GER"]), P("B", ["FCB"], ["GER"]), P("C", ["FCB"], ["ESP"]), P("D", ["BVB"], ["GER"])];
  const clash = ambiguousWith(messy, 3, fcb);
  assert.ok(clash, "zweite Regel muss gefunden werden");
  assert.equal(clash.key, "GER");
});

test("oddCandidates: nur Spieler ab Bekanntheitsschwelle", () => {
  const players = [{ n: "Bekannt", sl: ODD_SL_MIN }, { n: "Unbekannt", sl: ODD_SL_MIN - 1 }, { n: "Ohne sl" }];
  assert.deepEqual(oddCandidates(players), [0]);
});

test("Echtdaten: 50 Runden sind gültig und eindeutig", async () => {
  const { PLAYERS } = await import("./players.js");
  for (let i = 0; i < 50; i++) {
    const r = buildOddRound(PLAYERS);
    assert.ok(r, "Runde konnte nicht erzeugt werden");
    assert.equal(r.options.length, 4);
    const matching = r.options.filter((p) => playerMatchesHex(p, r.def));
    assert.equal(matching.length, 3, `genau 3 müssen die Regel erfüllen (${r.def.key})`);
    assert.equal(playerMatchesHex(r.options[r.oddIndex], r.def), false, "Außenseiter erfüllt die Regel nicht");
    assert.equal(ambiguousWith(r.options, r.oddIndex, r.def), null, "Runde ist mehrdeutig");
  }
});
