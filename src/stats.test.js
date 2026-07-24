import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const { collectStats, totals, hasAnyStats } = await import("./stats.js");

test("Ohne Spielstand: alles leer, nichts wirft", () => {
  localStorage.clear();
  const e = collectStats();
  assert.equal(e.length, 6, "alle sechs Modi erscheinen, auch ungespielt");
  assert.equal(hasAnyStats(e), false);
  assert.deepEqual(totals(e), { played: 0, modes: 0, bestStreak: 0 });
});

test("Kaputter Speicherstand wirft nicht", () => {
  localStorage.clear();
  localStorage.setItem("pp:careerStats", "{kaputt");
  const e = collectStats();
  assert.equal(e.find((x) => x.key === "career").played, 0);
});

test("Zahlen aus den verschiedenen Formaten werden richtig übersetzt", () => {
  localStorage.clear();
  put("pp:careerStats", { played: 4, solved: 3, best: 2 });
  put("pp:chainStats", { played: 2, best: 14, total: 20 });
  put("pp:soloStats", { played: 5, bestMoves: 9, perfect: 2 });
  put("pp:dailyStats", { played: 7, wins: 5, streak: 3, maxStreak: 4 });
  const e = collectStats();
  const by = Object.fromEntries(e.map((x) => [x.key, x]));

  assert.equal(by.career.played, 4);
  assert.ok(by.career.lines.some((l) => l.value === "2 Stat."), "beste Lösung als Stationen");
  assert.ok(by.chain.lines.some((l) => l.label === "längste Kette" && l.value === 14));
  assert.ok(by.hex.lines.some((l) => l.value === "9 Züge"));
  assert.equal(by.daily.streak, 3);

  const t = totals(e);
  assert.equal(t.played, 4 + 2 + 5 + 7);
  assert.equal(t.modes, 4, "nur gespielte Modi zählen");
  assert.equal(t.bestStreak, 3);
});

test("Tagesserien fließen in die Übersicht ein", () => {
  localStorage.clear();
  put("pp:oddStats", { played: 3, solved: 2, streak: 1, best: 4 });
  put("pp:chStats:odd", { played: 2, wins: 2, streak: 2, maxStreak: 2, last: "2026-07-25" });
  const odd = collectStats().find((e) => e.key === "odd");
  assert.equal(odd.streak, 2, "Serie kommt aus der Tagesaufgabe, nicht aus der freien Runde");
});

test("Nur belegte Kennzahlen erscheinen — keine Nullwerte", () => {
  localStorage.clear();
  put("pp:chainStats", { played: 1, best: 0, total: 0 });
  const chain = collectStats().find((e) => e.key === "chain");
  assert.deepEqual(chain.lines, [], "0 ist keine berichtenswerte Kennzahl");
});
