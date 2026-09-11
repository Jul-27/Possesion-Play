import test from "node:test";
import assert from "node:assert/strict";
import { trikotVon, NEUTRAL, gefuehrteLaender, kontrast, helligkeit } from "./trikots.js";
import { alleLaender } from "./laender.js";

test("jede geführte Nation ist auch wählbar", () => {
  const waehlbar = new Set(alleLaender().map((l) => l.key));
  const fremd = gefuehrteLaender().filter((k) => !waehlbar.has(k));
  assert.deepEqual(fremd, [], "Trikot für ein Land, das in der Auswahl nicht vorkommt");
});

test("alle Farben sind gültige Sechsstellen", () => {
  for (const key of gefuehrteLaender()) {
    const t = trikotVon(key);
    for (const [feld, wert] of Object.entries(t)) {
      if (wert === null || feld === "muster") continue;
      assert.match(wert, /^#[0-9A-F]{6}$/, `${key}.${feld} = ${wert}`);
    }
  }
});

/* Der eigentliche Zweck der Prüfung: Weiss auf Gelb sieht man erst im Spiel. */
test("Schrift hebt sich vom Grund ab", () => {
  const zuFlau = gefuehrteLaender()
    .map((key) => ({ key, v: kontrast(trikotVon(key).grund, trikotVon(key).schrift) }))
    .filter((x) => x.v < 3)
    .map((x) => `${x.key} (${x.v.toFixed(1)}:1)`);
  assert.deepEqual(zuFlau, [], "Nummer wäre auf dem Trikot kaum zu lesen");
});

test("der Besatz hebt sich vom Grund ab", () => {
  const zuFlau = gefuehrteLaender()
    .map((key) => ({ key, v: kontrast(trikotVon(key).grund, trikotVon(key).besatz) }))
    .filter((x) => x.v < 1.6)
    .map((x) => `${x.key} (${x.v.toFixed(1)}:1)`);
  assert.deepEqual(zuFlau, [], "Kragen und Ärmelabschluss wären unsichtbar");
});

test("ein gemustertes Trikot hat eine zweite Farbe", () => {
  for (const key of gefuehrteLaender()) {
    const t = trikotVon(key);
    if (t.muster) assert.ok(t.zweit, `${key} hat Muster ${t.muster}, aber keine zweite Farbe`);
    assert.ok(["streifen", "karo", "schraeg", null].includes(t.muster), `${key}: unbekanntes Muster ${t.muster}`);
  }
});

test("unbekannte Länder bekommen das neutrale Trikot", () => {
  assert.equal(trikotVon("ZZ"), NEUTRAL);
  assert.equal(trikotVon(undefined), NEUTRAL);
});

test("die Helligkeitsrechnung stimmt an den Enden", () => {
  assert.equal(helligkeit("#000000"), 0);
  assert.equal(helligkeit("#FFFFFF"), 1);
  assert.equal(Math.round(kontrast("#000000", "#FFFFFF")), 21);
});
