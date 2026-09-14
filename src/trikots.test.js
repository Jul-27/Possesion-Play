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

/* DER FEHLER, DEN DAS FÄNGT: Dreizehn Spielvereine tragen dreistellige Farbwerte
   („#fff", „#111"). Wer stur je zwei Zeichen abschneidet, liest aus „#fff" die
   Werte 255/15/NaN — und setzt weisse Schrift auf Real Madrids weisse Scheibe. */
test("istHell versteht auch dreistellige Farbwerte", async () => {
  const { istHell } = await import("./trikots.js");
  assert.equal(istHell("#fff"), true, "Weiss muss hell sein");
  assert.equal(istHell("#FFFFFF"), true);
  assert.equal(istHell("#111"), false, "fast Schwarz muss dunkel sein");
  assert.equal(istHell("#034694"), false, "Chelsea-Blau ist dunkel");
  assert.equal(istHell(""), false, "leerer Wert darf nicht abstürzen");
  assert.equal(istHell(undefined), false);
  assert.equal(istHell("kein hex"), false);
});

test("jeder Spielverein hat einen auswertbaren Farbwert", async () => {
  const { istHell } = await import("./trikots.js");
  const { CLUBS } = await import("./gameData.js");
  for (const c of CLUBS) {
    assert.match(String(c.c1), /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, `${c.name}: ${c.c1}`);
    assert.equal(typeof istHell(c.c1), "boolean", `${c.name}: ${c.c1}`);
  }
});
