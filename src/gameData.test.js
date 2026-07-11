import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAGUES, playerMatchesHex, lookupDef, buildBoardSerial, hydrateBoard } from "./gameData.js";

test("LEAGUES enthält 7 Ligen als type 'league'", () => {
  assert.equal(LEAGUES.length, 7);
  assert.deepEqual(LEAGUES.map((l) => l.key).sort(), ["BL", "L1", "LL", "NL", "PL", "PT", "SA"]);
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
  const pt = lookupDef("league", "PT");
  const nl = lookupDef("league", "NL");
  assert.equal(playerMatchesHex({ clubs: ["POR"] }, pt), true);
  assert.equal(playerMatchesHex({ clubs: ["AJA"] }, nl), true);
  assert.equal(playerMatchesHex({ clubs: ["FCB"] }, pt), false);
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

test("HONOURS enthält 15 Honours als type 'honour'", () => {
  assert.equal(HONOURS.length, 15);
  assert.deepEqual(
    HONOURS.map((h) => h.key).sort(),
    ["BDO", "CA", "CDR", "CIT", "CL", "DFB", "EL", "EM", "FAC", "MBL", "ML1", "MLL", "MPL", "MSA", "WM"]
  );
  for (const h of HONOURS) {
    assert.equal(h.type, "honour");
    assert.ok(h.name && h.label && h.icon && h.c1 && h.c2);
  }
});

test("lookupDef löst Honour-Keys auf", () => {
  assert.equal(lookupDef("honour", "CL").name, "Champions-League-Sieger");
  assert.equal(lookupDef("honour", "WM").name, "Weltmeister");
  assert.equal(lookupDef("honour", "BDO").name, "Ballon-d'Or-Sieger");
  assert.equal(lookupDef("honour", "EM").name, "Europameister");
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
    const nats = board.filter((c) => c.t === "nat").length;
    assert.ok(leagues >= 1 && leagues <= 3, `Liga-Anzahl: ${leagues}`);
    assert.ok(honours >= 2 && honours <= 4, `Honour-Anzahl: ${honours}`);
    assert.ok(nats >= 3 && nats <= 4, `Nationen-Anzahl: ${nats}`);
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

test("suggestPlayers: Vorname, Wortanfang, Sonderzeichen, Vollnamen-Präfix", () => {
  const players = [
    { n: "Lionel Messi", ln: "Messi", sl: 99 },
    { n: "Alexander Sørloth", ln: "Sørloth", sl: 40 },
    { n: "Łukasz Piszczek", ln: "Piszczek", sl: 30 },
    { n: "Mohamed Salah", ln: "Salah", sl: 90 },
  ];
  assert.deepEqual(suggestPlayers(players, "lionel", 8).map((p) => p.ln), ["Messi"]);     // Vorname
  assert.deepEqual(suggestPlayers(players, "sorloth", 8).map((p) => p.ln), ["Sørloth"]);  // ø -> o
  assert.deepEqual(suggestPlayers(players, "lukasz", 8).map((p) => p.ln), ["Piszczek"]);  // Ł -> l
  assert.deepEqual(suggestPlayers(players, "mohamed sa", 8).map((p) => p.ln), ["Salah"]); // Vollnamen-Präfix
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

import { guessEligibleIndices, wereTeammates, activeInRange, SPECIALS } from "./gameData.js";

const XAVI = { n: "Xavi", cp: [["BAR", 1998, 2015]] };
const INIESTA = { n: "Andrés Iniesta", cp: [["BAR", 2002, 2018]] };
const KAHN = { n: "Oliver Kahn", cp: [["FCB", 1994, 2008]] };
const ACTIVE = { n: "Aktiv", cp: [["RMA", 2021, 0]] };           // offenes Ende
const RETURNER = { n: "Rückkehrer", cp: [["FCB", 1990, 1992], ["FCB", 2005, 2007]] };

test("wereTeammates: Überlappung, disjunkt, offenes Ende, Mehrfach-Engagement, fehlendes cp", () => {
  assert.equal(wereTeammates(XAVI, INIESTA), true);              // BAR 2002–2015
  assert.equal(wereTeammates(XAVI, KAHN), false);                // andere Vereine
  assert.equal(wereTeammates(ACTIVE, { cp: [["RMA", 2023, 0]] }), true);  // beide offen
  assert.equal(wereTeammates(RETURNER, { cp: [["FCB", 1991, 1991]] }), true); // 1. Engagement
  assert.equal(wereTeammates(RETURNER, { cp: [["FCB", 1995, 2004]] }), false); // Lücke
  assert.equal(wereTeammates(RETURNER, { cp: [["FCB", 2007, 2010]] }), true);  // Grenzjahr inkl.
  assert.equal(wereTeammates(XAVI, { n: "ohne" }), false);       // fehlendes cp
  assert.equal(wereTeammates({}, INIESTA), false);
});

test("activeInRange: innerhalb, außerhalb, übergreifend, offen, ohne cp", () => {
  assert.equal(activeInRange(XAVI, 1990, 1999), true);           // ab 1998
  assert.equal(activeInRange(XAVI, 2016, 2019), false);
  assert.equal(activeInRange(KAHN, 2000, 2009), true);           // übergreifend
  assert.equal(activeInRange(ACTIVE, 2030, 2039), true);         // offenes Ende
  assert.equal(activeInRange({}, 1990, 1999), false);
});

test("answerGuessQuestion: mate über cp-Snapshot", () => {
  assert.equal(answerGuessQuestion(XAVI, { dim: "mate", val: { n: "Iniesta", cp: INIESTA.cp } }), true);
  assert.equal(answerGuessQuestion(XAVI, { dim: "mate", val: { n: "Kahn", cp: KAHN.cp } }), false);
  assert.equal(answerGuessQuestion(XAVI, { dim: "mate", val: { n: "ohne", cp: [] } }), false);
});

test("guessQuestionLabel: mate", () => {
  assert.equal(guessQuestionLabel({ dim: "mate", val: { n: "Xavi", cp: [] } }), "Teamkollege von Xavi?");
});

test("SPECIALS: 10 Felder inkl. Ära/Dekaden/T5L", () => {
  assert.equal(SPECIALS.length, 10);
  assert.deepEqual(SPECIALS.map((s) => s.key).sort(),
    ["A00", "A10", "A90", "B00", "B70", "B80", "N90", "OLD", "T5L", "Y2K"]);
  const a90 = lookupDef("spec", "A90"), a00 = lookupDef("spec", "A00");
  assert.equal(playerMatchesHex(XAVI, a90), true);
  assert.equal(playerMatchesHex(XAVI, a00), true);
  assert.equal(playerMatchesHex({ by: 1995 }, a90), false);      // ohne cp kein Match
});

test("T5L: 3+ verschiedene Top-5-Ligen über clubs", () => {
  const t5l = lookupDef("spec", "T5L");
  assert.equal(playerMatchesHex({ clubs: ["FCB", "MCI", "BAR"] }, t5l), true);   // BL+PL+LL
  assert.equal(playerMatchesHex({ clubs: ["FCB", "BVB", "MCI"] }, t5l), false);  // BL doppelt + PL = 2
  assert.equal(playerMatchesHex({ clubs: ["FCB", "MCI", "POR"] }, t5l), false);  // PT zählt nicht
  assert.equal(playerMatchesHex({ clubs: ["JUV", "PSG", "RMA", "MUN"] }, t5l), true); // SA+L1+LL+PL
  assert.equal(playerMatchesHex({}, t5l), false);
});

test("Geburts-Dekaden: Grenzjahre inklusiv", () => {
  const b70 = lookupDef("spec", "B70"), b80 = lookupDef("spec", "B80"), b00 = lookupDef("spec", "B00");
  assert.equal(playerMatchesHex({ by: 1970 }, b70), true);
  assert.equal(playerMatchesHex({ by: 1979 }, b70), true);
  assert.equal(playerMatchesHex({ by: 1980 }, b70), false);
  assert.equal(playerMatchesHex({ by: 1980 }, b80), true);
  assert.equal(playerMatchesHex({ by: 1989 }, b80), true);
  assert.equal(playerMatchesHex({ by: 1999 }, b00), false);
  assert.equal(playerMatchesHex({ by: 2000 }, b00), true);
  assert.equal(playerMatchesHex({ by: 2009 }, b00), true);
  assert.equal(playerMatchesHex({ by: 2010 }, b00), false);
});

test("guessEligibleIndices filtert auf pos+nat+clubs+sl>=GUESS_SL_MIN", () => {
  const list = [
    { pos: "ST", nat: ["GER"], clubs: ["FCB"], sl: 50 },  // ok
    { pos: null, nat: ["GER"], clubs: ["FCB"], sl: 50 },  // keine Position
    { pos: "MF", nat: [], clubs: ["FCB"], sl: 50 },       // keine Nation
    { pos: "MF", nat: ["GER"], clubs: [], sl: 50 },       // kein Verein
    { pos: "MF", nat: ["GER"], clubs: ["FCB"], sl: 10 },  // zu unbekannt
    { pos: "TW", nat: ["ESP"], clubs: ["BAR"], sl: 40 },  // ok (Grenze)
  ];
  assert.deepEqual(guessEligibleIndices(list), [0, 5]);
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

import { NATIONS } from "./gameData.js";
test("NATIONS enthält Österreich (19 Nationen)", () => {
  assert.equal(NATIONS.length, 19);
  assert.equal(lookupDef("nat", "AUT").name, "Österreich");
});
