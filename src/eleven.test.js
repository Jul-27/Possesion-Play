import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupDef } from "./gameData.js";
import {
  FORMATIONS, formationPositions, slotLayout, formationFor, elevenPool, slotCandidates,
  hasPerfectMatching, buildEleven, elevenAccepts, ELEVEN_MIN_CANDIDATES,
} from "./eleven.js";

test("Jede Formation hat elf Positionen und genau einen Torwart", () => {
  assert.ok(FORMATIONS.length >= 3);
  for (const f of FORMATIONS) {
    const pos = formationPositions(f);
    assert.equal(pos.length, 11, `${f.name} hat ${pos.length} statt 11 Positionen`);
    assert.equal(pos.filter((p) => p === "TW").length, 1, `${f.name} braucht genau einen Torwart`);
    // Der Name muss zur Linienfolge passen (ohne Torwart), sonst ist die Tabelle inkonsistent
    const feld = f.lines.slice(1).map(([, n]) => n).join("-");
    assert.equal(feld, f.name, `Linien von ${f.name} ergeben ${feld}`);
  }
});

test("slotLayout: elf Koordinaten im Feld, keine Überlappung je Linie", () => {
  for (const f of FORMATIONS) {
    const lay = slotLayout(f);
    assert.equal(lay.length, 11);
    for (const s of lay) {
      assert.ok(s.x > 0 && s.x < 100, `${f.name}: x=${s.x} außerhalb`);
      assert.ok(s.y > 0 && s.y < 100, `${f.name}: y=${s.y} außerhalb`);
    }
    // innerhalb einer Linie strikt aufsteigend und gleichmäßig verteilt
    const byY = new Map();
    for (const s of lay) { const a = byY.get(s.y) || []; a.push(s.x); byY.set(s.y, a); }
    for (const [y, xs] of byY) {
      const sorted = [...xs].sort((a, b) => a - b);
      assert.deepEqual(xs, sorted, `${f.name}: Linie y=${y} nicht sortiert`);
      assert.equal(new Set(xs).size, xs.length, `${f.name}: doppelte x in Linie y=${y}`);
    }
    // Torwart hinten, vorderste Linie vorne
    assert.ok(lay[0].y > lay[lay.length - 1].y, `${f.name}: Torwart muss hinten stehen`);
  }
});

test("formationFor: deterministisch, wechselt über die Tage", () => {
  assert.equal(formationFor("2026-07-24").name, formationFor("2026-07-24").name);
  const namen = new Set();
  for (let d = 1; d <= 20; d++) namen.add(formationFor(`2026-08-${String(d).padStart(2, "0")}`).name);
  assert.ok(namen.size >= 3, `in 20 Tagen nur ${namen.size} verschiedene Formationen`);
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
  assert.deepEqual(slots.map((s) => s.pos), formationPositions(formationFor("2026-07-19")));

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
