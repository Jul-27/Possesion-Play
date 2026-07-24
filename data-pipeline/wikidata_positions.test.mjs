import { test } from "node:test";
import assert from "node:assert/strict";
import { posBucket } from "./wikidata_positions.mjs";

test("posBucket mappt Positions-Labels auf Gruppen", () => {
  assert.equal(posBucket("goalkeeper"), "TW");
  assert.equal(posBucket("centre-back"), "ABW");
  assert.equal(posBucket("left-back"), "ABW");
  assert.equal(posBucket("defender"), "ABW");
  assert.equal(posBucket("central midfielder"), "MF");
  assert.equal(posBucket("attacking midfield"), "MF");
  assert.equal(posBucket("centre-forward"), "ST");
  assert.equal(posBucket("winger"), "ST");
  assert.equal(posBucket("striker"), "ST");
  assert.equal(posBucket("referee"), null);
});

test("posBucket: feinere Wikidata-Begriffe, die in der Praxis vorkamen", () => {
  // Diese Labels tauchten bei Spielern ohne pos auf
  assert.equal(posBucket("full-back"), "ABW");
  assert.equal(posBucket("playmaker"), "MF");
  assert.equal(posBucket("defensive midfielder"), "MF");
  assert.equal(posBucket("sweeper"), "ABW");
  assert.equal(posBucket("forward"), "ST");
  // Reihenfolge zählt: „attacking midfielder" darf NICHT im Sturm landen
  assert.equal(posBucket("attacking midfielder"), "MF");
});

test("players.js: pos-Werte sind gültige Gruppen", async () => {
  const players = (await import("../src/players.js")).PLAYERS;
  const ok = new Set(["TW", "ABW", "MF", "ST"]);
  let withPos = 0;
  for (const p of players) {
    if (!p.pos) continue;
    withPos++;
    assert.ok(ok.has(p.pos), "ungültige pos " + p.pos);
  }
  assert.ok(withPos > 1000, "es sollten viele Spieler eine pos haben, sind: " + withPos);
});

test("Positionen werden auch für reine Nationalspieler geholt", async () => {
  const src = await import("node:fs").then((fs) => fs.readFileSync(new URL("./wikidata_positions.mjs", import.meta.url), "utf8"));
  // 94 % der Lücke betraf Spieler ohne Spielverein — die Abfrage muss beide Quellen kennen
  assert.match(src, /NAT_TEAM_QID/, "Nationalteams müssen mit abgefragt werden");
  assert.match(src, /CLUB_QID/, "Vereine ebenso");
});
