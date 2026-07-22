import { test } from "node:test";
import assert from "node:assert/strict";
import { imageKey, imageFor, imageUrlFor, commonsUrl, initialsOf, avatarHue } from "./playerImage.js";
import { PLAYER_IMG_LOCAL, PLAYER_IMG_COMMONS } from "./playerImages.js";

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

test("imageUrlFor: unbekannter Spieler liefert null statt kaputtem Pfad", () => {
  assert.equal(imageFor({ n: "Diesen Spieler Gibt Es Nicht", by: 1234 }), null);
  assert.equal(imageUrlFor({ n: "Diesen Spieler Gibt Es Nicht", by: 1234 }), null);
});

test("commonsUrl: baut die Thumbnail-URL mit doppeltem Dateinamen", () => {
  assert.equal(
    commonsUrl("b/b4/Lionel_Messi.jpg", 120),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lionel_Messi.jpg/120px-Lionel_Messi.jpg",
  );
  // Sonderzeichen müssen kodiert werden, sonst 404
  assert.ok(commonsUrl("a/ab/Felipão_(cropped).jpg").includes("Felip%C3%A3o_(cropped).jpg/120px-"));
});

test("imageUrlFor: lokal hat Vorrang vor Commons", () => {
  const localKey = Object.keys(PLAYER_IMG_LOCAL)[0];
  if (!localKey) return;
  const [n, by] = [localKey.slice(0, localKey.lastIndexOf("|")), Number(localKey.slice(localKey.lastIndexOf("|") + 1))];
  const url = imageUrlFor({ n, by });
  assert.ok(url.startsWith("/players/"), `lokaler Treffer muss lokal ausgeliefert werden, war: ${url}`);
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

test("Index: kein Schlüssel steht in beiden Karten, Formate stimmen", () => {
  const both = Object.keys(PLAYER_IMG_LOCAL).filter((k) => k in PLAYER_IMG_COMMONS);
  assert.deepEqual(both, [], `Schlüssel doppelt vergeben: ${both.slice(0, 3).join(", ")}`);
  for (const [k, v] of Object.entries(PLAYER_IMG_LOCAL).slice(0, 50)) {
    assert.match(k, /^[^|]+\|\d{4}$/);
    assert.match(v, /^Q\d+\.[a-z0-9]+$/);
  }
  for (const [k, v] of Object.entries(PLAYER_IMG_COMMONS).slice(0, 50)) {
    assert.match(k, /^[^|]+\|\d{4}$/);
    assert.match(v, /^[0-9a-f]\/[0-9a-f]{2}\/.+$/, `Commons-Pfad „${v}" unerwartet`);
  }
});

/* Bewusst keine Abdeckungsschwelle: Wie viele Fotos lokal liegen, hängt vom Pipeline-Lauf ab.
   Getestet wird, dass jeder Index-Eintrag zu einem echten Record gehört — ein verwaister
   Schlüssel hieße, die Abbildung Name+Jahrgang ist kaputt. */
test("Echtdaten: jeder Index-Eintrag gehört zu einem echten Spieler", async (t) => {
  const keys = [...Object.keys(PLAYER_IMG_LOCAL), ...Object.keys(PLAYER_IMG_COMMONS)];
  if (!keys.length) return t.skip("Index noch leer (Pipeline nicht gelaufen)");
  const { PLAYERS } = await import("./players.js");
  const real = new Set(PLAYERS.map((p) => imageKey(p)).filter(Boolean));
  const orphans = keys.filter((k) => !real.has(k));
  assert.deepEqual(orphans, [], `verwaiste Schlüssel ohne Record: ${orphans.slice(0, 5).join(", ")}`);
});

test("Echtdaten: indizierte Spieler lösen eine gültige URL auf", async (t) => {
  if (!Object.keys(PLAYER_IMG_COMMONS).length) return t.skip("Index noch leer");
  const { PLAYERS } = await import("./players.js");
  const indexed = PLAYERS.filter((p) => {
    const k = imageKey(p);
    return k && (PLAYER_IMG_LOCAL[k] || PLAYER_IMG_COMMONS[k]);
  });
  assert.ok(indexed.length > 1000, `nur ${indexed.length} Records mit Bild`);
  for (const p of indexed.slice(0, 200)) {
    const url = imageUrlFor(p);
    assert.match(url, /^(\/players\/Q\d+\.[a-z0-9]+|https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+)$/);
  }
});
