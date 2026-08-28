import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupDef } from "./gameData.js";
import { POS_BY_KEY, posGruppe } from "./positions.js";
import {
  FORMATIONS, formationPositions, slotLayout, formationFor, elevenPool, slotCandidates,
  hasPerfectMatching, buildEleven, elevenAccepts, elevenReason, ELEVEN_MIN_CANDIDATES,
} from "./eleven.js";

test("Jede Formation hat elf Positionen und genau einen Torwart", () => {
  assert.ok(FORMATIONS.length >= 3);
  for (const f of FORMATIONS) {
    const pos = formationPositions(f);
    assert.equal(pos.length, 11, `${f.name} hat ${pos.length} statt 11 Positionen`);
    assert.equal(pos.filter((p) => p === "TW").length, 1, `${f.name} braucht genau einen Torwart`);
    // Der Name muss zur Linienfolge passen (ohne Torwart), sonst ist die Tabelle inkonsistent
    const feld = f.lines.slice(1).map((l) => l.length).join("-");
    assert.equal(feld, f.name, `Linien von ${f.name} ergeben ${feld}`);
    // Jede Position muss im Vokabular stehen und zur Linie passen
    for (const k of pos) assert.ok(POS_BY_KEY[k], `${f.name}: „${k}" gibt es nicht`);
    assert.equal(posGruppe(pos[0]), "TW", `${f.name}: erste Position ist kein Torwart`);
  }
});

/* Der Sechser und der Zehner sind zwei Bänder voneinander entfernt. Standen sie in
   derselben Zeile, zeichnete das Feld sie auf gleicher Höhe — das sah aus wie eine
   Reihe, nicht wie eine Aufstellung. */
test("kein Sechser steht auf gleicher Höhe wie ein Zehner", () => {
  for (const f of FORMATIONS) {
    for (const linie of f.lines) {
      assert.ok(!(linie.includes("DM") && linie.includes("OM")),
        `${f.name}: DM und OM in derselben Zeile — ${linie.join(", ")}`);
      assert.ok(!(linie.includes("ZM") && linie.includes("OM")),
        `${f.name}: ZM und OM in derselben Zeile — ${linie.join(", ")}`);
    }
  }
});

/* Die Breite eines Slots wird aus der breitesten Zeile berechnet. Stand dort einmal
   `l[1]` statt `l.length`, kam NaN heraus, der Slot bekam keine Breite, und Kürzel
   wie „TW" brachen buchstabenweise senkrecht um. */
test("die breiteste Zeile ist eine Zahl, keine Position", () => {
  for (const f of FORMATIONS) {
    const breit = Math.max(...f.lines.map((l) => l.length));
    assert.ok(Number.isFinite(breit) && breit >= 1, `${f.name}: breiteste Zeile ist ${breit}`);
    assert.ok(breit <= 5, `${f.name}: ${breit} Spieler in einer Zeile passen nicht nebeneinander`);
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
  const slot = { pos: "MS", def: lookupDef("nat", "GER") };
  assert.equal(elevenAccepts({ pos: "ST", pp: ["MS"], nat: ["GER"], clubs: [] }, slot), true);
  assert.equal(elevenAccepts({ pos: "MF", pp: ["ZM"], nat: ["GER"], clubs: [] }, slot), false);
  assert.equal(elevenAccepts({ pos: "ST", pp: ["MS"], nat: ["ESP"], clubs: [] }, slot), false);
});

/* Der Rückfall ist der Grund, warum die Felder überhaupt echte Positionen fordern
   dürfen: nur 46 % des Pools tragen eine belegte Feinposition. Wer keine hat, zählt
   über seine Gruppe mit — wer eine ANDERE hat, nicht. */
test("elevenAccepts: ohne Feinposition zählt die Gruppe, eine falsche schließt aus", () => {
  const slot = { pos: "IV", def: lookupDef("nat", "GER") };
  const basis = { nat: ["GER"], clubs: [] };
  assert.equal(elevenAccepts({ ...basis, pos: "ABW" }, slot), true, "Abwehrspieler ohne Detail");
  assert.equal(elevenAccepts({ ...basis, pos: "ABW", pp: ["IV"] }, slot), true);
  assert.equal(elevenAccepts({ ...basis, pos: "ABW", pp: ["LV"] }, slot), false, "belegt ein anderer");
  assert.equal(elevenAccepts({ ...basis, pos: "MF" }, slot), false);
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

test("elevenReason: Spieler ohne hinterlegte Position bekommt einen eigenen Satz", () => {
  const slot = { pos: "TW", def: { name: "FC Bayern München", type: "club", key: "FCB" } };
  const text = elevenReason({ n: "Merlin Röhl" }, slot);
  assert.ok(!/undefined/.test(text), `„undefined" darf nicht in der Meldung stehen: ${text}`);
  assert.match(text, /keine Position hinterlegt/);
});

test("elevenReason: falsche Position nennt beide Positionen im Klartext", () => {
  const slot = { pos: "TW", def: { name: "FC Bayern München", type: "club", key: "FCB" } };
  assert.equal(elevenReason({ n: "Harry Kane", pos: "ST" }, slot), "Harry Kane ist Sturm, gesucht ist Torwart.");
});

/* Ein Linksverteidiger wird auf einem Innenverteidiger-Feld abgelehnt, ein
   Abwehrspieler ohne Feinposition angenommen. Das wirkt willkürlich, wenn der Satz
   nicht sagt, welche Position wir zu ihm führen. */
test("elevenReason: nennt die belegte Feinposition, nicht die Gruppe", () => {
  const slot = { pos: "IV", def: { name: "Deutschland", type: "nat", key: "GER" } };
  assert.equal(elevenReason({ n: "Marcelo", pos: "ABW", pp: ["LV"] }, slot),
    "Marcelo ist Linksverteidiger, gesucht ist Innenverteidiger.");
  assert.equal(elevenReason({ n: "Philipp Lahm", pos: "ABW", pp: ["RV", "LV"] }, slot),
    "Philipp Lahm ist Rechtsverteidiger und Linksverteidiger, gesucht ist Innenverteidiger.");
});

test("elevenReason: passende Position, aber Bedingung verfehlt", () => {
  const slot = { pos: "MS", def: { name: "FC Bayern München", type: "club", key: "FCB" } };
  const kane = { n: "Harry Kane", pos: "ST", pp: ["MS"], clubs: ["TOT"] };
  assert.equal(elevenReason(kane, slot), `Harry Kane erfüllt „FC Bayern München" nicht.`);
});
