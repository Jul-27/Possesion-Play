import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupDef } from "./gameData.js";
import {
  FORMATION, SLOT_POSITIONS, elevenPool, slotCandidates, hasPerfectMatching,
  buildEleven, elevenAccepts, ELEVEN_MIN_CANDIDATES,
} from "./eleven.js";

test("FORMATION ergibt elf Positionen in 4-4-2", () => {
  assert.equal(SLOT_POSITIONS.length, 11);
  assert.deepEqual(FORMATION.map((f) => f.count), [1, 4, 4, 2]);
  assert.equal(SLOT_POSITIONS.filter((p) => p === "TW").length, 1);
  assert.equal(SLOT_POSITIONS.filter((p) => p === "ST").length, 2);
});

test("hasPerfectMatching: erkennt Hall-Verletzung", () => {
  // Drei Positionen, aber nur zwei verschiedene Spieler -> unmöglich
  assert.equal(hasPerfectMatching([[1, 2], [1, 2], [1, 2]]), false);
  assert.equal(hasPerfectMatching([[1, 2], [1, 2], [1, 2, 3]]), true);
});

test("hasPerfectMatching: leere Kandidatenliste ist unlösbar", () => {
  assert.equal(hasPerfectMatching([[1], []]), false);
});

test("elevenAccepts: Position und Bedingung müssen beide stimmen", () => {
  const slot = { pos: "ST", def: lookupDef("nat", "GER") };
  assert.equal(elevenAccepts({ pos: "ST", nat: ["GER"], clubs: [] }, slot), true);
  assert.equal(elevenAccepts({ pos: "MF", nat: ["GER"], clubs: [] }, slot), false);
  assert.equal(elevenAccepts({ pos: "ST", nat: ["ESP"], clubs: [] }, slot), false);
});

test("Echtdaten: das Tagesrätsel ist gültig und lösbar", async () => {
  const { PLAYERS } = await import("./players.js");
  const pool = elevenPool(PLAYERS);
  const { slots } = buildEleven("2026-07-19", PLAYERS);

  assert.equal(slots.length, 11);
  assert.deepEqual(slots.map((s) => s.pos), SLOT_POSITIONS);

  const keys = slots.map((s) => `${s.def.type}:${s.def.key}`);
  assert.equal(new Set(keys).size, 11, "alle elf Bedingungen müssen verschieden sein");

  const lists = slots.map((s) => slotCandidates(PLAYERS, pool, s.pos, s.def));
  for (let i = 0; i < 11; i++) {
    assert.ok(lists[i].length >= ELEVEN_MIN_CANDIDATES, `Position ${i} hat nur ${lists[i].length} Kandidaten`);
  }
  assert.ok(hasPerfectMatching(lists), "es muss eine Elf aus elf verschiedenen Spielern geben");
});

test("Echtdaten: gleiches Datum ergibt dasselbe Rätsel, anderes Datum ein anderes", async () => {
  const { PLAYERS } = await import("./players.js");
  const key = (r) => r.slots.map((s) => `${s.pos}/${s.def.type}:${s.def.key}`).join(",");
  assert.equal(key(buildEleven("2026-07-19", PLAYERS)), key(buildEleven("2026-07-19", PLAYERS)));
  assert.notEqual(key(buildEleven("2026-07-19", PLAYERS)), key(buildEleven("2026-07-20", PLAYERS)));
});

test("Echtdaten: 30 aufeinanderfolgende Tage sind alle lösbar", async () => {
  const { PLAYERS } = await import("./players.js");
  const pool = elevenPool(PLAYERS);
  for (let d = 1; d <= 30; d++) {
    const dateStr = `2026-08-${String(d).padStart(2, "0")}`;
    const { slots } = buildEleven(dateStr, PLAYERS);
    const lists = slots.map((s) => slotCandidates(PLAYERS, pool, s.pos, s.def));
    assert.ok(hasPerfectMatching(lists), `${dateStr} ist nicht lösbar`);
  }
});
