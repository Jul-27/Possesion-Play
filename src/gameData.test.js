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

import { START_SECONDS, fmtClock, liveRemaining } from "./gameData.js";

test("fmtClock formatiert m:ss", () => {
  assert.equal(START_SECONDS, 240);
  assert.equal(fmtClock(240), "4:00");
  assert.equal(fmtClock(65), "1:05");
  assert.equal(fmtClock(5), "0:05");
  assert.equal(fmtClock(-3), "0:00");
});

test("liveRemaining zieht verstrichene Zeit ab, min 0", () => {
  const T = Date.parse("2026-01-01T00:00:00Z");
  const iso = new Date(T).toISOString();
  assert.equal(liveRemaining({ 1: 240, 2: 240, started: null }, 1, T + 99000), 240);
  assert.equal(liveRemaining({ 1: 240, 2: 240, started: iso }, 1, T + 65000), 175);
  assert.equal(liveRemaining({ 1: 5, 2: 240, started: iso }, 1, T + 10000), 0);
  assert.equal(liveRemaining({ 1: 240, 2: 100, started: iso }, 2, T + 10000), 90);
});

import { gridCellMatches, gridWinner, buildGridSerial, lookupDef as lk } from "./gameData.js";

test("gridCellMatches: beide Bedingungen nötig", () => {
  const fcb = lk("club", "FCB"), ger = lk("nat", "GER"), esp = lk("nat", "ESP");
  const p = { clubs: ["FCB"], nat: ["GER"] };
  assert.equal(gridCellMatches(p, fcb, ger), true);
  assert.equal(gridCellMatches(p, fcb, esp), false);
});

test("gridWinner: Reihe/Spalte/Diagonale/None", () => {
  assert.equal(gridWinner({ 0: 1, 1: 1, 2: 1 }), 1);
  assert.equal(gridWinner({ 0: 2, 4: 2, 8: 2 }), 2);
  assert.equal(gridWinner({ 0: 1, 3: 1, 6: 1 }), 1);
  assert.equal(gridWinner({ 0: 1, 1: 2, 2: 1 }), null);
  assert.equal(gridWinner({}), null);
});

test("buildGridSerial: lösbares Raster", async () => {
  const { PLAYERS } = await import("./players.js");
  const g = buildGridSerial(PLAYERS);
  assert.equal(g.kind, "grid");
  assert.equal(g.rows.length, 3);
  assert.equal(g.cols.length, 3);
  const keys = [...g.rows, ...g.cols].map((d) => d.t + ":" + d.k);
  assert.equal(new Set(keys).size, 6);
  for (const rs of g.rows) for (const cs of g.cols) {
    const rd = lk(rs.t, rs.k), cd = lk(cs.t, cs.k);
    assert.ok(PLAYERS.some((p) => gridCellMatches(p, rd, cd)), `unlösbar: ${rs.k}×${cs.k}`);
  }
});

import {
  answerGuessQuestion, guessQuestionLabel, buildGuessSerial,
  encodeTarget, decodeTarget, checkGuess, GUESS_SL_MIN,
} from "./gameData.js";

const STAR = { n: "Lionel Messi", ln: "Messi", by: 1987, nat: ["ARG"], clubs: ["BAR", "PSG"], t: ["CL", "WM"], sl: 219, pos: "ST" };

test("answerGuessQuestion: nat / club / league / pos / title", () => {
  assert.equal(answerGuessQuestion(STAR, { dim: "nat", val: "ARG" }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "nat", val: "ESP" }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "club", val: "BAR" }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "club", val: "MUN" }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "league", val: "LL" }), true); // BAR -> LL
  assert.equal(answerGuessQuestion(STAR, { dim: "league", val: "BL" }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "pos", val: "ST" }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "pos", val: "TW" }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "title", val: "CL" }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "title", val: "FAC" }), false);
});

test("answerGuessQuestion: born vor/ab inkl. Grenzjahr", () => {
  assert.equal(answerGuessQuestion(STAR, { dim: "born", val: { cmp: "before", year: 1990 } }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "born", val: { cmp: "after", year: 1990 } }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "born", val: { cmp: "after", year: 1987 } }), true); // by >= year
  assert.equal(answerGuessQuestion(STAR, { dim: "born", val: { cmp: "before", year: 1987 } }), false);
});

test("answerGuessQuestion: fehlende Felder = false", () => {
  assert.equal(answerGuessQuestion({}, { dim: "title", val: "CL" }), false);
  assert.equal(answerGuessQuestion({}, { dim: "club", val: "BAR" }), false);
});

test("encodeTarget/decodeTarget Roundtrip", () => {
  for (const i of [0, 1, 50, 123, 27450]) assert.equal(decodeTarget(encodeTarget(i)), i);
});

test("checkGuess vergleicht Index", () => {
  const t = encodeTarget(50);
  assert.equal(checkGuess(t, 50), true);
  assert.equal(checkGuess(t, 51), false);
});

test("guessQuestionLabel formatiert lesbar", () => {
  assert.equal(guessQuestionLabel({ dim: "nat", val: "ARG" }), "Aus Argentinien?");
  assert.equal(guessQuestionLabel({ dim: "club", val: "BAR" }), "Spielte für FC Barcelona?");
  assert.equal(guessQuestionLabel({ dim: "league", val: "BL" }), "Spielte in der Bundesliga?");
  assert.equal(guessQuestionLabel({ dim: "pos", val: "ST" }), "Position: Sturm?");
  assert.equal(guessQuestionLabel({ dim: "title", val: "WM" }), "Weltmeister?");
  assert.equal(guessQuestionLabel({ dim: "born", val: { cmp: "before", year: 1990 } }), "Geboren vor 1990?");
  assert.equal(guessQuestionLabel({ dim: "born", val: { cmp: "after", year: 2000 } }), "Geboren ab 2000?");
});

test("buildGuessSerial: gültiger, bekannter Kandidat", async () => {
  const { PLAYERS } = await import("./players.js");
  for (let i = 0; i < 20; i++) {
    const g = buildGuessSerial(PLAYERS);
    assert.equal(g.kind, "guess");
    const p = PLAYERS[decodeTarget(g.tgt)];
    assert.ok(p, "Ziel-Index ungültig");
    assert.ok(p.pos, "Ziel ohne Position");
    assert.ok((p.nat || []).length, "Ziel ohne Nation");
    assert.ok((p.clubs || []).length, "Ziel ohne Verein");
    assert.ok((p.sl || 0) >= GUESS_SL_MIN, "Ziel nicht bekannt genug");
  }
});
