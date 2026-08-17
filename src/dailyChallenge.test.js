import { test } from "node:test";
import assert from "node:assert/strict";

// localStorage-Ersatz, damit die reine Logik ohne Browser prüfbar ist.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const { dailyRnd, recordChallenge, challengeState, challengeStats, challengeBadge, CHALLENGE_MODES } =
  await import("./dailyChallenge.js");

test("dailyRnd: gleicher Tag und Modus ⇒ gleiche Folge", () => {
  const a = dailyRnd("career", "2026-07-25");
  const b = dailyRnd("career", "2026-07-25");
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("dailyRnd: anderer Tag oder Modus ⇒ andere Folge", () => {
  const base = dailyRnd("career", "2026-07-25")();
  assert.notEqual(base, dailyRnd("career", "2026-07-26")(), "anderer Tag");
  assert.notEqual(base, dailyRnd("chain", "2026-07-25")(), "anderer Modus");
});

test("dailyRnd liefert Werte in [0,1)", () => {
  const r = dailyRnd("odd", "2026-07-25");
  for (let i = 0; i < 200; i++) { const v = r(); assert.ok(v >= 0 && v < 1, `Wert außerhalb: ${v}`); }
});

test("recordChallenge: Serie wächst an aufeinanderfolgenden Tagen", () => {
  localStorage.clear();
  recordChallenge("career", true, "2026-07-25");
  const s = recordChallenge("career", true, "2026-07-26");
  assert.equal(s.streak, 2);
  assert.equal(s.wins, 2);
});

test("recordChallenge: Lücke bricht die Serie, Rekord bleibt", () => {
  localStorage.clear();
  recordChallenge("chain", true, "2026-07-20");
  recordChallenge("chain", true, "2026-07-21");
  const s = recordChallenge("chain", true, "2026-07-25"); // Lücke
  assert.equal(s.streak, 1, "Serie startet neu");
  assert.equal(s.maxStreak, 2, "Bestwert bleibt erhalten");
});

test("recordChallenge zählt am selben Tag nicht doppelt", () => {
  localStorage.clear();
  recordChallenge("odd", true, "2026-07-25");
  const zweit = recordChallenge("odd", false, "2026-07-25");
  assert.equal(zweit.played, 1, "zweiter Aufruf darf nicht zählen");
  assert.equal(challengeState("odd", "2026-07-25").won, true, "Ergebnis bleibt das erste");
});

test("challengeBadge spiegelt den Tagesstand", () => {
  localStorage.clear();
  assert.equal(challengeBadge("hex", "2026-07-25").text, "heute offen");
  recordChallenge("hex", true, "2026-07-25");
  assert.equal(challengeBadge("hex", "2026-07-25").tone, "won");
  recordChallenge("hex", false, "2026-07-26");
  assert.equal(challengeBadge("hex", "2026-07-26").tone, "lost");
});

test("Modi haben getrennte Serien", () => {
  localStorage.clear();
  recordChallenge("career", true, "2026-07-25");
  assert.equal(challengeStats("career").streak, 1);
  assert.equal(challengeStats("chain"), null, "andere Modi bleiben unberührt");
  assert.deepEqual(CHALLENGE_MODES, ["career", "odd", "chain", "hex", "heat"]);
});

test("Echtdaten: dieselbe Tagesaufgabe für alle — über alle Generatoren", async () => {
  const { PLAYERS } = await import("./players.js");
  const { pickCareerIndex } = await import("./careerPath.js");
  const { buildOddRound } = await import("./oddOneOut.js");
  const { pickChainStart } = await import("./chain.js");
  const { buildBoardSerial } = await import("./gameData.js");
  const D = "2026-08-01";

  assert.equal(pickCareerIndex(PLAYERS, dailyRnd("career", D)), pickCareerIndex(PLAYERS, dailyRnd("career", D)));
  assert.equal(pickChainStart(PLAYERS, dailyRnd("chain", D)), pickChainStart(PLAYERS, dailyRnd("chain", D)));

  const key = (r) => r.options.map((p) => p.n).join("|") + "#" + r.oddIndex;
  assert.equal(key(buildOddRound(PLAYERS, dailyRnd("odd", D))), key(buildOddRound(PLAYERS, dailyRnd("odd", D))));

  const ser = (r) => JSON.stringify(buildBoardSerial(r));
  assert.equal(ser(dailyRnd("hex", D)), ser(dailyRnd("hex", D)));
  assert.equal(JSON.parse(ser(dailyRnd("hex", D))).length, 31, "Board behält 31 Felder");

  const { buildHeatSerial, HEAT_CENTER } = await import("./heatmap.js");
  const heat = (r) => JSON.stringify(buildHeatSerial(r));
  assert.equal(heat(dailyRnd("heat", D)), heat(dailyRnd("heat", D)));
  const felder = JSON.parse(heat(dailyRnd("heat", D)));
  assert.equal(felder.filter(Boolean).length, 30, "Heatmap spielt auf 30 Feldern");
  assert.equal(felder[HEAT_CENTER], null, "die Mitte trägt die Punkteanzeige");
  assert.notEqual(heat(dailyRnd("heat", D)), ser(dailyRnd("hex", D)), "eigener Seed je Modus");
});

test("Echtdaten: andere Tage ergeben andere Aufgaben", async () => {
  const { PLAYERS } = await import("./players.js");
  const { pickCareerIndex } = await import("./careerPath.js");
  const tage = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"];
  const ziele = new Set(tage.map((d) => pickCareerIndex(PLAYERS, dailyRnd("career", d))));
  assert.ok(ziele.size >= 4, `nur ${ziele.size} verschiedene Ziele in 5 Tagen`);
});
