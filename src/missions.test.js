import { test } from "node:test";
import assert from "node:assert/strict";
import { tagesStand, MISSIONEN, missionenDesTages, fortschritt, missionsXp } from "./missions.js";
import { mulberry32 } from "./dailyChallenge.js";

const D = "2026-08-19";
const leser = (daten) => (k) => (k in daten ? daten[k] : null);

test("der Tagesstand liest nur, was ohnehin gespeichert wird", () => {
  const s = tagesStand(D, leser({
    [`pp:ch:heat:${D}`]: { done: true, won: true },
    [`pp:ch:odd:${D}`]: { done: true, won: true },
    [`pp:daily:${D}`]: { won: true },
    [`pp:eleven:${D}`]: { names: ["a", null, "c"], done: false },
  }));
  assert.deepEqual(s.modi.sort(), ["heat", "odd"]);
  assert.equal(s.dailyGeloest, true);
  assert.equal(s.elfKomplett, false);
  assert.equal(s.elfFelder, 2);
  assert.equal(s.raetsel, 3, "zwei Tagesaufgaben plus der Daily-Star");
});

test("ohne Spielstand ist alles null, nichts wirft", () => {
  const s = tagesStand(D, () => null);
  assert.deepEqual(s.modi, []);
  assert.equal(s.raetsel, 0);
  assert.equal(s.elfFelder, 0);
});

test("Fortschritt deckelt beim Ziel", () => {
  const m = MISSIONEN.find((x) => x.id === "drei-raetsel");
  const f = fortschritt(m, { raetsel: 7 });
  assert.deepEqual([f.jetzt, f.ziel, f.fertig, f.anteil], [3, 3, true, 1]);
  const g = fortschritt(m, { raetsel: 1 });
  assert.deepEqual([g.jetzt, g.fertig], [1, false]);
});

test("jede Mission ist aus dem Tagesstand messbar", () => {
  const s = tagesStand(D, () => null);
  for (const m of MISSIONEN) {
    assert.equal(typeof m.wert(s), "number", `${m.id} liefert keine Zahl`);
    assert.ok(m.ziel > 0 && m.xp > 0, `${m.id} braucht Ziel und XP`);
  }
});

test("gleicher Tag ⇒ gleiche drei Missionen", () => {
  const a = missionenDesTages(mulberry32(42)).map((m) => m.id);
  const b = missionenDesTages(mulberry32(42)).map((m) => m.id);
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3, "keine doppelt");
});

/* „Löse zwei Tagesrätsel" neben „Löse drei Tagesrätsel" wäre eine Mission zu viel
   und eine Aufgabe zu wenig — das eine erledigt das andere mit. */
test("sich überschneidende Missionen kommen nie zusammen vor", () => {
  for (let seed = 0; seed < 60; seed++) {
    const ids = missionenDesTages(mulberry32(seed)).map((m) => m.id);
    assert.ok(!(ids.includes("zwei-raetsel") && ids.includes("drei-raetsel")), `Seed ${seed}`);
    assert.ok(!(ids.includes("elf") && ids.includes("elf-halb")), `Seed ${seed}`);
  }
});

test("verschiedene Tage ergeben verschiedene Missionen", () => {
  const saetze = new Set([1, 2, 3, 4, 5].map((s) => missionenDesTages(mulberry32(s)).map((m) => m.id).join()));
  assert.ok(saetze.size >= 3, `nur ${saetze.size} verschiedene Sätze in fünf Tagen`);
});

test("XP gibt es nur für erledigte Missionen", () => {
  const missionen = [
    MISSIONEN.find((m) => m.id === "daily"),
    MISSIONEN.find((m) => m.id === "drei-modi"),
  ];
  const stand = { dailyGeloest: true, modi: ["heat"] };
  assert.equal(missionsXp(missionen, stand), missionen[0].xp);
  assert.equal(missionsXp(missionen, { dailyGeloest: false, modi: [] }), 0);
});
