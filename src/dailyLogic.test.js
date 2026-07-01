import { test } from "node:test";
import assert from "node:assert/strict";
import { GUESS_SL_MIN } from "./gameData.js";
import {
  DAILY_EPOCH, DAILY_MAX_Q, DAILY_MAX_G,
  dailyDateStr, dailyNumber, dailyStarIndex, updateStreak, buildShareText,
} from "./dailyLogic.js";

test("Konstanten & dailyNumber", () => {
  assert.equal(DAILY_MAX_Q, 8);
  assert.equal(DAILY_MAX_G, 2);
  assert.equal(dailyNumber(DAILY_EPOCH), 0);
  assert.equal(dailyNumber("2026-07-01"), 1);
  assert.equal(dailyNumber("2026-07-31"), 31);
});

test("dailyDateStr formatiert lokal als YYYY-MM-DD", () => {
  assert.equal(dailyDateStr(new Date(2026, 6, 1)), "2026-07-01");
  assert.equal(dailyDateStr(new Date(2026, 0, 5)), "2026-01-05");
});

test("dailyStarIndex: deterministisch, variiert über Tage, erfüllt Filter", async () => {
  const { PLAYERS } = await import("./players.js");
  const a = dailyStarIndex("2026-07-01", PLAYERS);
  const b = dailyStarIndex("2026-07-01", PLAYERS);
  assert.equal(a, b);
  const days = Array.from({ length: 10 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
  const idxs = new Set(days.map((d) => dailyStarIndex(d, PLAYERS)));
  assert.ok(idxs.size > 3, "zu wenig Variation über 10 Tage");
  const p = PLAYERS[a];
  assert.ok(p.pos && p.nat.length && p.clubs.length && (p.sl || 0) >= GUESS_SL_MIN);
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

test("buildShareText: gewonnen und verloren", () => {
  const wonLog = [{ dim: "nat" }, { dim: "club" }, { guess: "X", wrong: true }, { dim: "pos" }, { guess: "Y", correct: true }];
  assert.equal(
    buildShareText(12, wonLog, true, "https://x.y?daily=1"),
    "Daily-Star #12 ⭐\n🟦🟦❌🟦⭐\nhttps://x.y?daily=1"
  );
  const lostLog = [{ dim: "nat" }, { guess: "X", wrong: true }, { guess: "Z", wrong: true }];
  assert.equal(
    buildShareText(3, lostLog, false, "https://x.y?daily=1"),
    "Daily-Star #3 💀\n🟦❌❌💀\nhttps://x.y?daily=1"
  );
});
