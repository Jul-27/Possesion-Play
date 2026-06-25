import { test } from "node:test";
import assert from "node:assert/strict";

test("players.js: t-Honours sind gültige Keys + Stichproben", async () => {
  const players = (await import("../src/players.js")).PLAYERS;
  const game = await import("../src/gameData.js");
  const H = new Set(game.HONOURS.map((h) => h.key));
  let withT = 0;
  for (const p of players) {
    if (!p.t) continue;
    withT++;
    for (const k of p.t) assert.ok(H.has(k), "ungültiger Honour-Key " + k);
  }
  assert.ok(withT > 1266, "mehr Spieler mit Honours erwartet, ist: " + withT);
  const has = (name, key) => {
    const p = players.find((x) => x.n === name);
    return p && p.t && p.t.includes(key);
  };
  assert.ok(has("Andrés Iniesta", "CL"), "Iniesta sollte CL haben");
  assert.ok(has("Andrés Iniesta", "WM"), "Iniesta sollte WM haben");
});
