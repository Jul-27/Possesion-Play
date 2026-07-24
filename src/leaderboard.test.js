import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
const { scoreFor, MODES } = await import("./leaderboardScore.js");

test("Punkte: höher ist immer besser, auch wo im Spiel weniger besser ist", () => {
  // Karriere: früher gelöst schlägt später gelöst
  assert.ok(scoreFor("career", { solved: true, stations: 2, wrong: 0 })
          > scoreFor("career", { solved: true, stations: 5, wrong: 0 }));
  // Fehlversuche kosten
  assert.ok(scoreFor("career", { solved: true, stations: 3, wrong: 0 })
          > scoreFor("career", { solved: true, stations: 3, wrong: 2 }));
  // Hex: weniger Züge schlägt mehr Züge
  assert.ok(scoreFor("hex", { moves: 9, misses: 0 }) > scoreFor("hex", { moves: 20, misses: 0 }));
  // Kette: länger ist besser
  assert.ok(scoreFor("chain", { length: 14 }) > scoreFor("chain", { length: 3 }));
});

test("Nicht gelöst ergibt 0 Punkte — kein Rang für Aufgeben", () => {
  assert.equal(scoreFor("career", { solved: false, stations: 1, wrong: 0 }), 0);
  assert.equal(scoreFor("eleven", { solved: false, wrong: 0 }), 0);
  assert.equal(scoreFor("odd", { correct: false }), 0);
});

test("Punkte werden nie negativ, egal wie schlecht das Ergebnis", () => {
  assert.ok(scoreFor("career", { solved: true, stations: 99, wrong: 99 }) >= 0);
  assert.ok(scoreFor("hex", { moves: 999, misses: 999 }) >= 0);
  assert.ok(scoreFor("eleven", { solved: true, wrong: 999 }) >= 0);
});

test("Unbekannter Modus wirft nicht", () => {
  assert.equal(scoreFor("gibtsnicht", {}), 0);
});

test("Jeder Modus hat Name, Symbol und lesbare Beschriftung", () => {
  for (const [k, m] of Object.entries(MODES)) {
    assert.ok(m.name && m.icon, `${k} unvollständig`);
    assert.equal(typeof m.label(5, { stations: 3, moves: 9, wrong: 1, solved: true }), "string");
  }
});
