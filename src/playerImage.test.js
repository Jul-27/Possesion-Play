import { test } from "node:test";
import assert from "node:assert/strict";
import { imageKey, imageFor, imageUrlFor, initialsOf, avatarHue } from "./playerImage.js";
import { PLAYER_IMAGES } from "./playerImages.js";

test("imageKey: normalisiert wie die App (Akzente, Sonderzeichen)", () => {
  assert.equal(imageKey({ n: "João Félix", by: 1999 }), "joao felix|1999");
  assert.equal(imageKey({ n: "Hakan Çalhanoğlu", by: 1994 }), "hakan calhanoglu|1994");
  assert.equal(imageKey({ n: "Erling Håland", by: 2000 }), "erling haland|2000");
});

test("imageKey: ohne Name oder Geburtsjahr kein Schlüssel", () => {
  assert.equal(imageKey({ n: "Ohne Jahr" }), null);
  assert.equal(imageKey({ by: 1990 }), null);
  assert.equal(imageKey(null), null);
});

test("imageFor: unbekannter Spieler liefert null statt kaputtem Pfad", () => {
  assert.equal(imageFor({ n: "Diesen Spieler Gibt Es Nicht", by: 1234 }), null);
  assert.equal(imageUrlFor({ n: "Diesen Spieler Gibt Es Nicht", by: 1234 }), null);
});

test("initialsOf: Vor- und Nachname, Einzelname, leer", () => {
  assert.equal(initialsOf({ n: "Lionel Messi" }), "LM");
  assert.equal(initialsOf({ n: "Ronaldo de Assis Moreira" }), "RM");
  assert.equal(initialsOf({ n: "Pelé" }), "PE");
  assert.equal(initialsOf({ n: "" }), "?");
});

test("avatarHue: deterministisch und im gültigen Bereich", () => {
  const p = { n: "Lionel Messi", by: 1987 };
  assert.equal(avatarHue(p), avatarHue(p));
  assert.ok(avatarHue(p) >= 0 && avatarHue(p) < 360);
  assert.notEqual(avatarHue(p), avatarHue({ n: "Cristiano Ronaldo", by: 1985 }));
});

test("Index: Schlüssel und Dateinamen haben das erwartete Format", () => {
  const keys = Object.keys(PLAYER_IMAGES);
  for (const k of keys.slice(0, 50)) {
    assert.match(k, /^[^|]+\|\d{4}$/, `Schlüssel „${k}" passt nicht zu norm(name)|jahr`);
    assert.match(PLAYER_IMAGES[k], /^Q\d+\.[a-z0-9]+$/, `Dateiname „${PLAYER_IMAGES[k]}" unerwartet`);
  }
});

/* Bewusst keine Abdeckungsschwelle: wie viele Fotos vorliegen, hängt vom Pipeline-Lauf ab
   (Wikimedia drosselt, der Lauf ist fortsetzbar) — das ist eine Daten-, keine Code-Eigenschaft.
   Getestet wird stattdessen, dass jeder Index-Eintrag zu einem echten Record gehört und
   sauber auflösbar ist. Ein verwaister Schlüssel hieße: die Abbildung ist kaputt. */
test("Echtdaten: jeder Index-Eintrag gehört zu einem echten Spieler", async (t) => {
  const keys = Object.keys(PLAYER_IMAGES);
  if (!keys.length) return t.skip("Index noch leer (Pipeline nicht gelaufen)");
  const { PLAYERS } = await import("./players.js");
  const real = new Set(PLAYERS.map((p) => imageKey(p)).filter(Boolean));
  const orphans = keys.filter((k) => !real.has(k));
  assert.deepEqual(orphans, [], `verwaiste Schlüssel ohne Record: ${orphans.slice(0, 5).join(", ")}`);
});

test("Echtdaten: indizierte Spieler lösen ihr Foto auf", async (t) => {
  const keys = Object.keys(PLAYER_IMAGES);
  if (!keys.length) return t.skip("Index noch leer (Pipeline nicht gelaufen)");
  const { PLAYERS } = await import("./players.js");
  const indexed = PLAYERS.filter((p) => PLAYER_IMAGES[imageKey(p) ?? ""]);
  assert.ok(indexed.length > 0, "kein Record trifft den Index");
  for (const p of indexed.slice(0, 100)) {
    assert.equal(imageFor(p), PLAYER_IMAGES[imageKey(p)]);
    assert.match(imageUrlFor(p), /^\/players\/Q\d+\.[a-z0-9]+$/);
  }
});
