import { test } from "node:test";
import assert from "node:assert/strict";
import { updateSoloStats, soloStatsLine, emptySoloStats } from "./soloStats.js";

test("erstes gelöstes Board setzt den Bestwert", () => {
  const s = updateSoloStats(null, 12, 0);
  assert.deepEqual(s, { played: 1, bestMoves: 12, perfect: 1 });
});

test("weniger Züge ist besser — Bestwert sinkt, steigt aber nie", () => {
  let s = updateSoloStats(null, 12, 1);
  s = updateSoloStats(s, 9, 0);
  assert.equal(s.bestMoves, 9);
  s = updateSoloStats(s, 20, 3);
  assert.equal(s.bestMoves, 9, "ein schlechteres Board darf den Bestwert nicht ersetzen");
  assert.equal(s.played, 3);
  assert.equal(s.perfect, 1, "nur das fehlerfreie Board zählt als perfekt");
});

test("kaputter oder fehlender Speicherstand wirft nicht", () => {
  assert.equal(updateSoloStats(undefined, 5, 0).played, 1);
  assert.equal(updateSoloStats("kaputt", 5, 0).played, 1);
  assert.equal(updateSoloStats({}, 7, 1).bestMoves, 7);
});

test("soloStatsLine: nichts ohne Spiele, Singular/Plural, perfekt optional", () => {
  assert.equal(soloStatsLine(null), null);
  assert.equal(soloStatsLine(emptySoloStats()), null);
  assert.match(soloStatsLine({ played: 1, bestMoves: 9, perfect: 0 }), /^1 Board gelöst · Bestwert 9 Züge$/);
  assert.match(soloStatsLine({ played: 3, bestMoves: 8, perfect: 2 }), /3 Boards gelöst .* 2× perfekt/);
});
