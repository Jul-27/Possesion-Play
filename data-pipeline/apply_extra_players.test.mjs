import { test } from "node:test";
import assert from "node:assert/strict";
import { applyExtras, stripWrongClubs, EXTRA_PLAYERS, WRONG_CLUBS } from "./apply_extra_players.mjs";

test("applyExtras ergänzt einen Verein, ohne vorhandene zu verlieren", () => {
  const players = [{ n: "Fábio Vieira", ln: "Vieira", by: 2000, nat: ["PRT"], clubs: ["ARS", "POR"] }];
  const res = applyExtras(players, [{ n: "Fábio Vieira", by: 2000, clubs: ["HSV"] }], {});
  assert.deepEqual(res, { added: 0, merged: 1, removed: 0 });
  assert.deepEqual(players[0].clubs, ["ARS", "HSV", "POR"]);
});

test("applyExtras legt einen unbekannten Spieler an", () => {
  const players = [];
  const res = applyExtras(players, [{ n: "Merlin Röhl", by: 2002, nat: ["GER"], clubs: ["SCF"] }], {});
  assert.equal(res.added, 1);
  assert.equal(players[0].ln, "Röhl");
  assert.deepEqual(players[0].clubs, ["SCF"]);
});

/* Gegenstück zum Ergänzen: Everton stand bei Merlin Röhl, obwohl er nie dort war.
   Solche Einträge stammen aus vandalierten Wikidata-Zwischenständen. */
test("stripWrongClubs entfernt den falschen Verein samt cp", () => {
  const players = [{ n: "Merlin Röhl", ln: "Röhl", by: 2002, nat: ["GER"], clubs: ["EVE", "SCF"], cp: [["EVE", 2023, 0], ["SCF", 2021, 0]] }];
  assert.equal(stripWrongClubs(players, { "merlin rohl|2002": ["EVE"] }), 1);
  assert.deepEqual(players[0].clubs, ["SCF"]);
  assert.deepEqual(players[0].cp, [["SCF", 2021, 0]]);
});

test("stripWrongClubs lässt namensgleiche Spieler mit anderem Geburtsjahr in Ruhe", () => {
  const players = [{ n: "Merlin Röhl", ln: "Röhl", by: 1990, nat: [], clubs: ["EVE"] }];
  assert.equal(stripWrongClubs(players, { "merlin rohl|2002": ["EVE"] }), 0);
  assert.deepEqual(players[0].clubs, ["EVE"]);
});

/* Reihenfolge zählt: erst ergänzen, dann entfernen. Stünde es andersherum, könnte
   ein EXTRA_PLAYERS-Eintrag einen soeben entfernten Verein wieder hereinholen. */
test("applyExtras entfernt nach dem Ergänzen", () => {
  const players = [{ n: "Merlin Röhl", ln: "Röhl", by: 2002, nat: [], clubs: ["EVE"] }];
  const res = applyExtras(players, [{ n: "Merlin Röhl", by: 2002, clubs: ["SCF"] }], { "merlin rohl|2002": ["EVE"] });
  assert.deepEqual(res, { added: 0, merged: 1, removed: 1 });
  assert.deepEqual(players[0].clubs, ["SCF"]);
});

test("die kuratierten Tabellen sind wohlgeformt", () => {
  for (const x of EXTRA_PLAYERS) {
    assert.ok(x.n && Number.isInteger(x.by), `Eintrag ohne Name/Geburtsjahr: ${JSON.stringify(x)}`);
    assert.ok(!x.pos || ["TW", "ABW", "MF", "ST"].includes(x.pos), `unbekannte Position: ${x.n}`);
  }
  for (const [k, v] of Object.entries(WRONG_CLUBS)) {
    assert.match(k, /^[^|]+\|\d{4}$/, `Schlüssel muss "name|jahr" sein: ${k}`);
    assert.ok(Array.isArray(v) && v.length, `leere Vereinsliste bei ${k}`);
  }
});

/* Ein Tippfehler im Vereinsschlüssel würde nichts entfernen und nichts melden — der
   Eintrag liefe still ins Leere. Deshalb gegen die echten Vereine prüfen. */
test("die kuratierten Tabellen nennen nur existierende Vereine", async () => {
  const { CLUBS } = await import("../src/gameData.js");
  const keys = new Set(CLUBS.map((c) => c.key));
  for (const x of EXTRA_PLAYERS) {
    for (const c of x.clubs || []) assert.ok(keys.has(c), `EXTRA_PLAYERS: ${x.n} nennt unbekannten Verein ${c}`);
    for (const [c] of x.cp || []) assert.ok(keys.has(c), `EXTRA_PLAYERS: ${x.n} hat cp für unbekannten Verein ${c}`);
  }
  for (const [k, v] of Object.entries(WRONG_CLUBS)) {
    for (const c of v) assert.ok(keys.has(c), `WRONG_CLUBS: ${k} nennt unbekannten Verein ${c}`);
  }
});

/* Die Tabellen dürfen sich nicht widersprechen: was WRONG_CLUBS entfernt, darf
   EXTRA_PLAYERS nicht gleichzeitig eintragen — das Ergebnis hinge sonst allein an der
   Reihenfolge und wäre bei der nächsten Umstellung still weg. */
test("EXTRA_PLAYERS und WRONG_CLUBS widersprechen sich nicht", async () => {
  const { norm } = await import("./wikidata_roster.mjs");
  for (const x of EXTRA_PLAYERS) {
    const weg = WRONG_CLUBS[norm(x.n) + "|" + x.by];
    if (!weg) continue;
    const kollision = (x.clubs || []).filter((c) => weg.includes(c));
    assert.deepEqual(kollision, [], `${x.n}: ${kollision.join(", ")} wird ergänzt und gleichzeitig entfernt`);
  }
});
