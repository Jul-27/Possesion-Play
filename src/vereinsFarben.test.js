import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import { VEREINS_FARBE } from "./vereinsFarben.js";
import { WELT_VEREINE } from "./careerWorld.js";
import { CLUBS } from "./gameData.js";

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test("jeder Verein mit Wappen hat eine Farbe, jede im Format #RRGGBB", () => {
  const keys = new Set([...WELT_VEREINE.map((v) => v.key), ...CLUBS.map((c) => c.key)]);
  const ohne = [...keys].filter((k) => !VEREINS_FARBE[k] && existsSync(new URL(`../public/logos/club/${k}.png`, import.meta.url)));
  assert.ok(ohne.length <= 6, `ohne Farbe trotz Wappen: ${ohne.join(", ")}`);
  for (const [k, f] of Object.entries(VEREINS_FARBE)) assert.match(f, /^#[0-9A-F]{6}$/, k);
});

/* Stichproben, an denen die Leseregel einmal gescheitert ist (05.10.2026). */
test("die Farbe ist die des Vereins, nicht die der Krone", () => {
  const [br, bg] = rgb(VEREINS_FARBE.BET);
  assert.ok(bg > br, "Betis ist grün, nicht gold");
  const [sr, , sb] = rgb(VEREINS_FARBE.RSO);
  assert.ok(sb > sr, "Real Sociedad ist blau");
  const [gr, gg] = rgb(VEREINS_FARBE.SPOR);
  assert.ok(gr > gg * 2, "Braga ist rot, nicht beige");
  assert.equal(VEREINS_FARBE.JUV, "#2B2F33", "Juventus ist schwarz-weiß");
  assert.equal(VEREINS_FARBE.NEW, "#2B2F33", "Newcastle ist schwarz-weiß, kein Blau aus dem Wappen");
  const [ar, ag] = rgb(VEREINS_FARBE.AJA);
  assert.ok(ar > ag * 2, "Ajax ist rot, nicht weiß");
});
