import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_EPOCH, dailyDateStr, dailyNumber, updateStreak } from "./dailyLogic.js";

test("Konstanten & dailyNumber", () => {
  assert.equal(dailyNumber(DAILY_EPOCH), 0);
  assert.equal(dailyNumber("2026-07-01"), 1);
  assert.equal(dailyNumber("2026-07-31"), 31);
});

test("dailyDateStr formatiert lokal als YYYY-MM-DD", () => {
  assert.equal(dailyDateStr(new Date(2026, 6, 1)), "2026-07-01");
  assert.equal(dailyDateStr(new Date(2026, 0, 5)), "2026-01-05");
});


test("updateStreak: Folgetag-Sieg, Lücke, Niederlage", () => {
  let s = updateStreak(null, "2026-07-01", true);
  assert.deepEqual(s, { played: 1, wins: 1, streak: 1, maxStreak: 1, last: "2026-07-01" });
  s = updateStreak(s, "2026-07-02", true);          // Folgetag
  assert.equal(s.streak, 2);
  assert.equal(s.maxStreak, 2);
  s = updateStreak(s, "2026-07-05", true);          // Lücke -> reset auf 1
  assert.equal(s.streak, 1);
  assert.equal(s.maxStreak, 2);
  s = updateStreak(s, "2026-07-06", false);         // Niederlage -> 0
  assert.deepEqual([s.streak, s.played, s.wins], [0, 4, 3]);
});


