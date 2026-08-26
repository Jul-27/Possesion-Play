import { test } from "node:test";
import assert from "node:assert/strict";
import { VEREINS_ALIASE, clubKeyFuer, kanonischerVereinsname } from "./clubNames.js";
import { CLUBS, norm } from "./gameData.js";

/* Jede Zeile der Tabelle muss auf einen echten Spielverein zeigen — ein Tippfehler
   im Kürzel wäre sonst eine stille Nicht-Auflösung. */
test("jeder Alias zeigt auf einen der 47 Spielvereine", () => {
  const keys = new Set(CLUBS.map((c) => c.key));
  for (const [alias, key] of Object.entries(VEREINS_ALIASE)) {
    assert.ok(keys.has(key), `${alias} zeigt auf „${key}“, das es nicht gibt`);
    assert.notEqual(norm(alias), norm(CLUBS.find((c) => c.key === key).name),
      `${alias} ist bereits der Spielname — der Eintrag ist überflüssig`);
  }
});

test("clubKeyFuer kennt Spielnamen und Alternativschreibweisen", () => {
  assert.equal(clubKeyFuer("Liverpool"), "LIV");
  assert.equal(clubKeyFuer("FC Liverpool"), "LIV");
  assert.equal(clubKeyFuer("AC Mailand"), "MIL");
  assert.equal(clubKeyFuer("AC Milan"), "MIL");
  assert.equal(clubKeyFuer("Juventus Turin"), "JUV");
});

test("clubKeyFuer erfindet nichts", () => {
  assert.equal(clubKeyFuer("Brescia Calcio"), null);
  assert.equal(clubKeyFuer("Salzburg"), null, "bewusst nicht aufgelöst — sieben Salzburger Vereine");
  assert.equal(clubKeyFuer(""), null);
  assert.equal(clubKeyFuer(null), null);
});

test("kanonischerVereinsname führt auf den Spielnamen, lässt Fremdes in Ruhe", () => {
  assert.equal(kanonischerVereinsname("FC Arsenal"), "Arsenal");
  assert.equal(kanonischerVereinsname("A.S. Roma"), "AS Rom");
  assert.equal(kanonischerVereinsname("Arsenal"), "Arsenal", "schon kanonisch");
  assert.equal(kanonischerVereinsname("Brescia Calcio"), "Brescia Calcio");
});

/* Der eigentliche Schaden: 4.119 Spieler trugen zwei Formen desselben Vereins.
   Nach der Auflösung darf kein Spieler mehr denselben Verein doppelt führen. */
test("Echtdaten: kein Spieler führt einen Verein mehr doppelt", async () => {
  const { PLAYERS } = await import("./players.js");
  const { CAREER_CLUBS, CAREER_BY_KEY } = await import("./careerClubs.js");
  const { createCareerIndex } = await import("./careerIndex.js");
  const idx = createCareerIndex(PLAYERS, CAREER_CLUBS, CAREER_BY_KEY);

  let doppelt = 0;
  for (const p of PLAYERS.slice(0, 4000)) {
    const namen = idx.clubsOf(p);
    if (new Set(namen).size !== namen.length) doppelt++;
    // und keine zwei Namen, die auf denselben Spielverein zeigen
    const keys = namen.map(clubKeyFuer).filter(Boolean);
    if (new Set(keys).size !== keys.length) doppelt++;
  }
  assert.equal(doppelt, 0, `${doppelt} Spieler führen einen Verein doppelt`);
});
