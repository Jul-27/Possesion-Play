import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HEAT_CENTER, HEAT_CELLS, HEAT_ADJ, comboPoints, buildHeatSerial, heatMove, applyHeat,
  heatFilled, heatDone, heatDensity, heatPaint, heatMoveText, heatShareGrid, HEAT_MAX,
} from "./heatmap.js";
import { ADJP, POSITIONS, hydrateBoard, lookupDef } from "./gameData.js";
import { mulberry32 } from "./dailyChallenge.js";

/* Testboard: jedes Feld ein Verein, damit sich über clubs[] exakt steuern lässt,
   wer was trifft. Die Mittelzelle bleibt leer wie im Spiel. */
const KEYS = ["FCB", "BVB", "RBL", "B04", "SGE", "VFB", "WOB", "SVW", "S04", "HSV",
  "M05", "SCF", "TSG", "MCI", "MUN", "LIV", "CHE", "ARS", "TOT", "NEW",
  "EVE", "AVL", "BAR", "RMA", "ATM", "SEV", "VAL", "VIL", "JUV", "MIL"];
function testBoard() {
  let k = 0;
  return hydrateBoard(POSITIONS.map((p) => (p.idx === HEAT_CENTER ? null : { t: "club", k: KEYS[k++] })));
}
const keyAt = (board, i) => board[i].def.key;
const spieler = (clubs) => ({ n: "Test Spieler", ln: "Spieler", by: 1990, nat: [], clubs, sl: 50 });

test("das Brett hat 30 Spielfelder, die Mitte trägt keins", () => {
  assert.equal(HEAT_CELLS.length, 30);
  assert.ok(!HEAT_CELLS.includes(HEAT_CENTER));
  assert.equal(POSITIONS.length, 31, "die Geometrie des Duell-Bretts bleibt unangetastet");
});

/* Die Mitte ist kein Feld und darf auch keine Brücke sein: sonst wären die sechs
   Zellen ringsum über ein nicht existierendes Feld benachbart. */
test("die Mittelzelle taucht in keiner Nachbarschaft auf", () => {
  for (const i of HEAT_CELLS) assert.ok(!HEAT_ADJ[i].includes(HEAT_CENTER), `Feld ${i}`);
  const ringsum = ADJP[HEAT_CENTER];
  for (const i of ringsum) {
    assert.equal(HEAT_ADJ[i].length, ADJP[i].length - 1, `Feld ${i} verliert genau die Mitte`);
  }
});

test("die Combo-Reihe sind die Dreieckszahlen", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(comboPoints), [1, 3, 6, 10, 15, 21, 28]);
  assert.equal(comboPoints(0), 0, "ein Zug ohne neue Zelle wäre 0 — kommt im Spiel nicht vor");
});

test("buildHeatSerial zieht 30 Felder und lässt die Mitte frei", () => {
  const s = buildHeatSerial(mulberry32(1));
  assert.equal(s.length, 31);
  assert.equal(s[HEAT_CENTER], null);
  assert.equal(s.filter(Boolean).length, 30);
  for (const f of s.filter(Boolean)) assert.ok(lookupDef(f.t, f.k), `${f.t}/${f.k} muss auflösbar sein`);
});

test("gleicher Zufall ⇒ gleiches Board (Tagesaufgabe)", () => {
  assert.deepEqual(buildHeatSerial(mulberry32(7)), buildHeatSerial(mulberry32(7)));
});

test("ein Zug ohne passende Nachbarn ist genau ein Punkt", () => {
  const board = testBoard();
  const zug = heatMove(board, {}, 0, spieler([keyAt(board, 0)]));
  assert.deepEqual(zug.neu, [0]);
  assert.deepEqual(zug.reheat, []);
  assert.equal(zug.punkte, 1);
});

test("passende Nachbarn fallen mit und werden als Combo gewertet", () => {
  const board = testBoard();
  const nb = HEAT_ADJ[0];
  const zug = heatMove(board, {}, 0, spieler([keyAt(board, 0), keyAt(board, nb[0]), keyAt(board, nb[1])]));
  assert.equal(zug.neu.length, 3);
  assert.equal(zug.punkte, 6, "3 Felder = 6, nicht 3");
});

/* Der Kern der Reheat-Regel: schon eroberte Nachbarn zählen weiter, aber nur mit
   +1 — sie dürfen die Combo-Reihe der neuen Zellen nicht verlängern. */
test("Reheat gibt +1 je Feld und verlängert die Combo nicht", () => {
  const board = testBoard();
  const nb = HEAT_ADJ[0];
  const p = spieler([keyAt(board, 0), keyAt(board, nb[0]), keyAt(board, nb[1])]);
  const heat = { [nb[0]]: 1, [nb[1]]: 1 };
  const zug = heatMove(board, heat, 0, p);
  assert.deepEqual(zug.neu, [0]);
  assert.equal(zug.reheat.length, 2);
  assert.equal(zug.punkte, 3, "1 neues Feld (=1) + zwei Reheats (=2)");
});

test("belegte Felder, die Mitte und unpassende Spieler sind kein Zug", () => {
  const board = testBoard();
  assert.equal(heatMove(board, { 0: 1 }, 0, spieler([keyAt(board, 0)])), null, "Feld schon erobert");
  assert.equal(heatMove(board, {}, HEAT_CENTER, spieler(["FCB"])), null, "Mittelzelle");
  assert.equal(heatMove(board, {}, 0, spieler(["___"])), null, "Spieler passt nicht");
});

test("jeder Treffer erhöht die Hitze um eins", () => {
  const board = testBoard();
  const nb = HEAT_ADJ[0];
  let heat = applyHeat({}, heatMove(board, {}, 0, spieler([keyAt(board, 0), keyAt(board, nb[0])])));
  assert.deepEqual([heat[0], heat[nb[0]]], [1, 1]);
  // zweiter Zug auf ein freies Feld, der Feld 0 mit reheatet
  const zwei = HEAT_ADJ[0].find((i) => !heat[i] && HEAT_ADJ[i].includes(0));
  heat = applyHeat(heat, heatMove(board, heat, zwei, spieler([keyAt(board, zwei), keyAt(board, 0)])));
  assert.equal(heat[0], 2, "Feld 0 wurde nachgeheizt");
});

test("Dichte und Fortschritt zählen über alle 30 Felder", () => {
  assert.equal(heatDensity({}), 0);
  assert.equal(heatFilled({}), 0);
  assert.equal(heatDone({}), false);
  const voll = Object.fromEntries(HEAT_CELLS.map((i) => [i, 1]));
  assert.equal(heatDone(voll), true);
  assert.equal(heatDensity(voll), 1, "jedes Feld genau einmal getroffen = 1,0");
  assert.equal(heatDensity({ ...voll, [HEAT_CELLS[0]]: 31 }), 2, "30 Extra-Treffer auf 30 Felder = +1,0");
});

test("die Mittelzelle zählt nicht in die Dichte", () => {
  const voll = Object.fromEntries(HEAT_CELLS.map((i) => [i, 1]));
  assert.equal(heatDensity({ ...voll, [HEAT_CENTER]: 99 }), 1);
  assert.equal(heatFilled({ ...voll, [HEAT_CENTER]: 99 }), 30);
});

test("die Farbrampe deckelt und lässt unerobert ungefärbt", () => {
  assert.equal(heatPaint(0), null);
  assert.equal(heatPaint(), null);
  assert.deepEqual(heatPaint(HEAT_MAX), heatPaint(HEAT_MAX + 4), "über der Grenze bleibt es weißglühend");
  assert.notDeepEqual(heatPaint(1), heatPaint(2));
});

test("das Teil-Raster hat Brettform und markiert die Mitte", () => {
  const zeilen = heatShareGrid({ 0: 1, 4: 3, 30: 9 }).split("\n");
  assert.equal(zeilen.length, 7);
  assert.deepEqual(zeilen.map((z) => [...z.trim()].length), [4, 5, 4, 5, 4, 5, 4]);
  assert.ok(zeilen[0].startsWith(" 🟩"), "Feld 0 ist einmal getroffen");
  assert.ok(zeilen[1].startsWith("🟧"), "Feld 4 ist dreimal getroffen");
  assert.ok(zeilen[6].endsWith("🔥"), "Feld 30 ist über der Rampe — weißglühend");
  assert.ok(zeilen[3].includes("⬛"), "die Mittelzelle ist ein Loch, kein Feld");
});

test("der Zugtext erklärt, wie die Punkte zustande kommen", () => {
  const t = heatMoveText({ neu: [1, 2, 3], reheat: [4], punkte: 7 }, "FC Bayern München");
  assert.equal(t, "✓ FC Bayern München · 3 Felder = 6 · 1× Reheat +1 → +7");
  assert.equal(heatMoveText({ neu: [1], reheat: [], punkte: 1 }, "Ajax"), "✓ Ajax · 1 Feld = 1 → +1");
});
