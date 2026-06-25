import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLastName } from "./wikidata_roster.mjs";

test("deriveLastName", () => {
  assert.equal(deriveLastName("Zinedine Zidane"), "Zidane");
  assert.equal(deriveLastName("Thierry Henry"), "Henry");
  assert.equal(deriveLastName("Robin van Persie"), "van Persie");
  assert.equal(deriveLastName("Ronaldinho"), "Ronaldinho");
  assert.equal(deriveLastName("Rafael van der Vaart"), "van der Vaart");
});

test("players.js: gültige Struktur (Keys, Pflichtfelder, gewachsen)", async () => {
  const players = (await import("../src/players.js")).PLAYERS;
  const game = await import("../src/gameData.js");
  const C = new Set(game.CLUBS.map((c) => c.key));
  const N = new Set(game.NATIONS.map((n) => n.key));
  assert.ok(players.length > 10000, "Pool sollte stark gewachsen sein, ist: " + players.length);
  for (const p of players) {
    assert.ok(p.n && p.ln && typeof p.by === "number", "Pflichtfelder fehlen: " + JSON.stringify(p));
    for (const c of p.clubs || []) assert.ok(C.has(c), "ungültiger club " + c);
    for (const n of p.nat || []) assert.ok(N.has(n), "ungültige nat " + n);
  }
});
