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
    const cells = hydrateBoard(board);
    assert.equal(cells.length, 31);
    for (const cell of cells) assert.ok(cell.def, "hydratisierte Zelle ohne def");
  }
});

import { HONOURS } from "./gameData.js";

test("HONOURS enthält 11 Honours als type 'honour'", () => {
  assert.equal(HONOURS.length, 11);
  assert.deepEqual(
    HONOURS.map((h) => h.key).sort(),
    ["CDR", "CIT", "CL", "DFB", "FAC", "MBL", "ML1", "MLL", "MPL", "MSA", "WM"]
  );
  for (const h of HONOURS) {
    assert.equal(h.type, "honour");
    assert.ok(h.name && h.label && h.icon && h.c1 && h.c2);
  }
});

test("lookupDef löst Honour-Keys auf", () => {
  assert.equal(lookupDef("honour", "CL").name, "Champions-League-Sieger");
  assert.equal(lookupDef("honour", "WM").name, "Weltmeister");
});

test("playerMatchesHex: honour matcht über player.t", () => {
  const cl = lookupDef("honour", "CL");
  const wm = lookupDef("honour", "WM");
  assert.equal(playerMatchesHex({ t: ["CL", "MBL"] }, cl), true);
  assert.equal(playerMatchesHex({ t: ["MBL"] }, cl), false);
  assert.equal(playerMatchesHex({ t: [] }, wm), false);
  assert.equal(playerMatchesHex({}, cl), false);
});

test("buildBoardSerial: 31 Felder mit 1–3 Liga- und 2–4 Honour-Feldern", () => {
  for (let i = 0; i < 300; i++) {
    const board = buildBoardSerial();
    assert.equal(board.length, 31);
    const leagues = board.filter((c) => c.t === "league").length;
    const honours = board.filter((c) => c.t === "honour").length;
    assert.ok(leagues >= 1 && leagues <= 3, `Liga-Anzahl: ${leagues}`);
    assert.ok(honours >= 2 && honours <= 4, `Honour-Anzahl: ${honours}`);
    for (const c of board) assert.ok(lookupDef(c.t, c.k), `kein def für ${c.t}/${c.k}`);
  }
});

import { suggestPlayers } from "./gameData.js";

test("suggestPlayers: Nachname-Präfix, Bekanntheit zuerst, dann alphabetisch", () => {
  const players = [
    { n: "Mohamed Salah", ln: "Salah", sl: 90 },
    { n: "Saúl Ñíguez", ln: "Saúl", sl: 30 },
    { n: "Unbekannt Sava", ln: "Sava" },
    { n: "Andrea Pirlo", ln: "Pirlo", sl: 80 },
  ];
  assert.deepEqual(suggestPlayers(players, "sa", 8).map((p) => p.ln), ["Salah", "Saúl", "Sava"]);
  assert.deepEqual(suggestPlayers(players, "s", 8), []);
  assert.equal(suggestPlayers(players, "sa", 2).length, 2);
});
