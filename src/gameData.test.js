import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAGUES, playerMatchesHex, lookupDef } from "./gameData.js";

test("LEAGUES enthält die 5 Top-Ligen als type 'league'", () => {
  assert.equal(LEAGUES.length, 5);
  assert.deepEqual(LEAGUES.map((l) => l.key).sort(), ["BL", "L1", "LL", "PL", "SA"]);
  for (const l of LEAGUES) {
    assert.equal(l.type, "league");
    assert.ok(l.name && l.label && l.c1 && l.c2);
  }
});

test("lookupDef löst Liga-Keys auf", () => {
  assert.equal(lookupDef("league", "BL").name, "Bundesliga");
  assert.equal(lookupDef("league", "SA").name, "Serie A");
});

test("playerMatchesHex: league matcht über die Liga der Vereine", () => {
  const bl = lookupDef("league", "BL");
  const pl = lookupDef("league", "PL");
  const ll = lookupDef("league", "LL");
  assert.equal(playerMatchesHex({ clubs: ["FCB"] }, bl), true);
  assert.equal(playerMatchesHex({ clubs: ["FCB"] }, pl), false);
  assert.equal(playerMatchesHex({ clubs: ["BAR"] }, ll), true);
  assert.equal(playerMatchesHex({ clubs: [] }, bl), false);
  assert.equal(playerMatchesHex({ clubs: ["UNBEKANNT"] }, bl), false);
});
