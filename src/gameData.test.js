import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAGUES, playerMatchesHex, lookupDef, buildBoardSerial, hydrateBoard } from "./gameData.js";

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

test("buildBoardSerial: 31 Felder mit 1–3 Liga-Feldern", () => {
  for (let i = 0; i < 200; i++) {
    const board = buildBoardSerial();
    assert.equal(board.length, 31);
    const leagues = board.filter((c) => c.t === "league").length;
    assert.ok(leagues >= 1 && leagues <= 3, `unerwartete Liga-Anzahl: ${leagues}`);
    for (const c of board) assert.ok(lookupDef(c.t, c.k), `kein def für ${c.t}/${c.k}`);
  }
});
