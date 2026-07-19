import { test } from "node:test";
import assert from "node:assert/strict";
import { playerAttrs, openAttrs, linkBetween, attrLabel, chainHint, pickChainStart, CHAIN_START_SL_MIN, CHAIN_START_MIN_ATTRS } from "./chain.js";

const P = (n, clubs, nat, t = []) => ({ n, ln: n, by: 1990, clubs, nat, t, sl: 99 });

test("playerAttrs: Verein, Nation, Liga und Titel", () => {
  const a = playerAttrs(P("A", ["FCB"], ["GER"], ["WM"]));
  assert.ok(a.includes("club:FCB"));
  assert.ok(a.includes("nat:GER"));
  assert.ok(a.includes("honour:WM"));
  assert.ok(a.some((k) => k.startsWith("league:")), "Liga wird aus dem Verein abgeleitet");
});

test("linkBetween: spezifischste Verbindung gewinnt (Verein vor Nation)", () => {
  const a = P("A", ["FCB"], ["GER"]);
  const b = P("B", ["FCB"], ["GER"]);
  assert.equal(linkBetween(a, b, new Set()), "club:FCB");
});

test("linkBetween: verbrannte Verbindung fällt auf die nächste zurück", () => {
  const a = P("A", ["FCB"], ["GER"]);
  const b = P("B", ["FCB"], ["GER"]);
  assert.equal(linkBetween(a, b, new Set(["club:FCB"])), "league:BL");
  assert.equal(linkBetween(a, b, new Set(["club:FCB", "league:BL"])), "nat:GER");
  assert.equal(linkBetween(a, b, new Set(["club:FCB", "league:BL", "nat:GER"])), null);
});

test("linkBetween: ohne Gemeinsamkeit kein Zug", () => {
  assert.equal(linkBetween(P("A", ["FCB"], ["GER"]), P("B", ["RMA"], ["ESP"]), new Set()), null);
});

test("openAttrs: verbrannte Attribute verschwinden", () => {
  const a = P("A", ["FCB"], ["GER"]);
  const all = openAttrs(a, new Set());
  assert.ok(all.length >= 3);
  assert.equal(openAttrs(a, new Set(all)).length, 0);
});

test("attrLabel: lesbarer Text je Typ", () => {
  assert.equal(attrLabel("club:FCB"), "FC Bayern München");
  assert.equal(attrLabel("nat:GER"), "Deutschland");
});

test("Echtdaten: aus einem Startspieler lässt sich eine lange Kette bauen", async () => {
  const { PLAYERS } = await import("./players.js");
  const pool = PLAYERS.filter((p) => (p.sl || 0) >= CHAIN_START_SL_MIN);
  const burned = new Set();
  const used = new Set();
  let cur = pool[0];
  used.add(cur.n);
  let len = 1;
  while (len < 20) {
    const hint = chainHint(PLAYERS, cur, burned, used);
    if (!hint) break;
    burned.add(hint.via);
    used.add(hint.player.n);
    cur = hint.player;
    len++;
  }
  assert.ok(len >= 20, `Kette blieb bei ${len} stehen`);
});

test("Echtdaten: jeder mögliche Startspieler hat genug Anschlüsse", async () => {
  const { PLAYERS } = await import("./players.js");
  const rnd = () => 0.5;
  const i = pickChainStart(PLAYERS, rnd);
  assert.ok(i >= 0);
  const p = PLAYERS[i];
  assert.ok(playerAttrs(p).length >= CHAIN_START_MIN_ATTRS, `${p.n} hat zu wenige Attribute`);
  assert.ok((p.sl || 0) >= CHAIN_START_SL_MIN);
});

test("chainHint: null, wenn der Spieler keine freien Attribute mehr hat", () => {
  const a = P("A", ["FCB"], ["GER"]);
  assert.equal(chainHint([a, P("B", ["FCB"], ["GER"])], a, new Set(playerAttrs(a)), new Set(["A"])), null);
});
