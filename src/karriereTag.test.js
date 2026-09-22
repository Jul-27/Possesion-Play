import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
const T = await import("./karriereTag.js");
const { challengeState, challengeStats } = await import("./dailyChallenge.js");

const laufbahn = (extra = {}) => ({
  ovr: 78, verlauf: [{ ovr: 70 }, { ovr: 80 }], titel: { DFB: 1, WM: 1 },
  gesamt: { spiele: 400, tore: 90, vorlagen: 60 }, vereine: ["A", "B"], laender: ["GER"], ...extra,
});

test("eine frei gespielte Laufbahn zählt für die Bilanz, nicht als Tagesaufgabe", () => {
  localStorage.clear();
  assert.equal(T.verbucheLaufbahn(laufbahn()), null);
  const st = JSON.parse(localStorage.getItem("pp:karriereStats"));
  assert.equal(st.played, 1);
  assert.equal(st.bestwert, 80);
  assert.equal(st.titelGesamt, 2);
  assert.equal(st.weltmeister, 1);
  assert.equal(challengeState("karriere", "2026-09-23"), null);
});

test("die Karriere des Tages zählt einmal, mit Punkten und Serie", () => {
  localStorage.clear();
  const d = "2026-09-23";
  T.beginneTag(d);
  assert.equal(T.tagesZustand(d).begonnen, true);
  const w = T.verbucheLaufbahn(laufbahn({ tagesDatum: d }));
  assert.ok(w.punkte > 0);
  assert.deepEqual(challengeState("karriere", d), { done: true, won: true });
  assert.equal(challengeStats("karriere").streak, 1);
  /* Ein zweites Verbuchen derselben Karriere ändert nichts an der Wertung. */
  const nochmal = T.verbucheLaufbahn(laufbahn({ tagesDatum: d, ovr: 95, verlauf: [{ ovr: 95 }] }));
  assert.equal(nochmal.punkte, w.punkte);
  assert.equal(challengeStats("karriere").played, 1);
});

test("wer die Karriere des Tages abbricht, kann sie nicht neu beginnen, und die Serie reisst", () => {
  localStorage.clear();
  const d = "2026-09-24";
  T.beginneTag(d);
  assert.equal(T.abbruchVerbuchen(d), true);
  assert.deepEqual(challengeState("karriere", d), { done: true, won: false });
  assert.equal(T.tagesZustand(d).ergebnis.abgebrochen, true);
  /* Nicht doppelt verbucht. */
  assert.equal(T.abbruchVerbuchen(d), false);
  /* Eine nie begonnene bleibt offen. */
  assert.equal(T.abbruchVerbuchen("2026-09-25"), false);
  assert.equal(challengeState("karriere", "2026-09-25"), null);
});
