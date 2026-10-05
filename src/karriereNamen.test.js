import { test } from "node:test";
import assert from "node:assert/strict";
import { NAMEN, VERGEBEN, nameFuer } from "./karriereNamen.js";
import { TAGES_LAENDER, tagesStart, rng } from "./karriere.js";
import { PLAYERS } from "./players.js";
import { norm } from "./gameData.js";

test("jedes Land der Karriere des Tages hat Vor- und Nachnamen", () => {
  for (const land of TAGES_LAENDER) {
    assert.ok(NAMEN[land], `${land}: keine Namen`);
    assert.ok(NAMEN[land].vor.length >= 20 && NAMEN[land].nach.length >= 20, `${land}: zu wenige Namen`);
    assert.equal(new Set(NAMEN[land].vor).size, NAMEN[land].vor.length, `${land}: doppelter Vorname`);
    assert.equal(new Set(NAMEN[land].nach).size, NAMEN[land].nach.length, `${land}: doppelter Nachname`);
  }
});

/* Keine Kombination darf ein bekannter echter Spieler sein. VERGEBEN muss genau die
   Kombinationen enthalten, die als Spieler im Bestand stehen — ändert sich
   der Bestand, zeigt der Test, was nachzutragen oder zu streichen ist. */
test("VERGEBEN deckt genau die Kombinationen ab, die echte Spieler im Bestand sind", () => {
  const bekannt = new Set(PLAYERS.map((p) => norm(p.n)));
  const treffer = new Set();
  for (const l of Object.values(NAMEN)) for (const v of l.vor) for (const n of l.nach) {
    if (bekannt.has(norm(`${v} ${n}`))) treffer.add(`${v} ${n}`);
  }
  assert.deepEqual([...treffer].filter((s) => !VERGEBEN.has(s)).sort(), [], "fehlt in VERGEBEN");
  assert.deepEqual([...VERGEBEN].filter((s) => !treffer.has(s)).sort(), [], "steht unnötig in VERGEBEN");
});

test("nameFuer zieht nie einen vergebenen Namen und kennt nur die Tagesländer", () => {
  for (const land of TAGES_LAENDER) {
    const z = rng(7);
    for (let i = 0; i < 2000; i++) {
      const n = nameFuer(land, z);
      assert.ok(n && !VERGEBEN.has(n), `${land}: ${n}`);
    }
  }
  assert.equal(nameFuer("XX", rng(1)), null);
});

test("der Tagesstart bringt einen Namen zur Nation mit — für alle derselbe", () => {
  for (let t = 0; t < 120; t++) {
    const d = new Date(Date.UTC(2026, 9, 1 + t)).toISOString().slice(0, 10);
    const st = tagesStart(d);
    assert.equal(st.name, tagesStart(d).name);
    const [vor, ...rest] = st.name.split(" ");
    assert.ok(NAMEN[st.land].vor.includes(vor), `${d}: ${st.name} passt nicht zu ${st.land}`);
    assert.ok(NAMEN[st.land].nach.includes(rest.join(" ")), `${d}: ${st.name} passt nicht zu ${st.land}`);
  }
});
