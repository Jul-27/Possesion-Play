import { test } from "node:test";
import assert from "node:assert/strict";
import { BADGES, badgeStand, stand, alleBadges, erreichteAnzahl, badgeXp } from "./badges.js";
import { readFileSync } from "node:fs";

/* Die Icon-Namen werden aus der QUELLE gelesen, nicht importiert: Icons.jsx enthält
   JSX, das `node --test` nicht parsen kann. Ein Regex über die Schlüssel reicht, um
   Tippfehler zu fangen — genau darum geht es hier. */
const ICON_NAMEN = [...readFileSync(new URL("./Icons.jsx", import.meta.url), "utf8")
  .matchAll(/^  ([a-z]+):/gm)].map((m) => m[1]);

const leer = () => badgeStand(() => null, []);
const mit = (speicher, entries = []) => badgeStand((k) => speicher[k] || null, entries);
const E = (key, played, streak = 0) => ({ key, played, streak, lines: [] });

test("ohne Spielstand ist nichts erreicht und nichts wirft", () => {
  const s = leer();
  assert.equal(erreichteAnzahl(s), 0);
  assert.equal(badgeXp(s), 0);
  for (const b of BADGES) assert.equal(stand(b, s).jetzt, 0, b.id);
});

test("jedes Abzeichen ist vollständig und eindeutig", () => {
  const ids = BADGES.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, "doppelte id");
  for (const b of BADGES) {
    assert.ok(b.name && b.text, `${b.id}: Name und Text nötig`);
    assert.ok(b.ziel > 0 && b.xp > 0, `${b.id}: Ziel und XP nötig`);
    assert.equal(typeof b.wert(leer()), "number", `${b.id}: wert() muss eine Zahl liefern`);
  }
});

/* Ein Abzeichen mit einem Icon, das es nicht gibt, würde in der Übersicht als
   Leerstelle erscheinen — sichtbar erst im Browser. */
test("jedes Abzeichen benutzt ein vorhandenes Icon", () => {
  for (const b of BADGES) assert.ok(ICON_NAMEN.includes(b.icon), `${b.id}: Icon „${b.icon}“ fehlt`);
});

test("der Fortschritt deckelt beim Ziel und rechnet den Anteil", () => {
  const b = BADGES.find((x) => x.id === "stamm");            // 50 Rätsel
  assert.deepEqual(stand(b, { raetsel: 25 }), { jetzt: 25, ziel: 50, fertig: false, anteil: .5 });
  const voll = stand(b, { raetsel: 900 });
  assert.deepEqual([voll.jetzt, voll.fertig, voll.anteil], [50, true, 1]);
});

test("gestaffelte Abzeichen greifen nacheinander", () => {
  const s = { raetsel: 60 };
  assert.equal(stand(BADGES.find((b) => b.id === "erste"), s).fertig, true);
  assert.equal(stand(BADGES.find((b) => b.id === "stamm"), s).fertig, true);
  assert.equal(stand(BADGES.find((b) => b.id === "dauerlaeufer"), s).fertig, false);
});

/* Die Dichte ist eine Kommazahl, der Fortschrittsbalken rechnet ganzzahlig —
   deshalb wird sie mit 100 multipliziert. Ein Vorzeichenfehler dort ergäbe ein
   Abzeichen, das entweder sofort oder nie sitzt. */
test("die Heat-Density wird korrekt hochgerechnet", () => {
  const b = BADGES.find((x) => x.id === "gluehend");
  assert.equal(stand(b, mit({ "pp:heatBest": { density: 1.83 } })).jetzt, 183);
  assert.equal(stand(b, mit({ "pp:heatBest": { density: 1.83 } })).fertig, false);
  assert.equal(stand(b, mit({ "pp:heatBest": { density: 2.0 } })).fertig, true);
});

test("„Spurleser“ verlangt WENIGE Stationen, nicht viele", () => {
  const b = BADGES.find((x) => x.id === "spurleser");
  assert.equal(stand(b, mit({ "pp:careerStats": { best: 2 } })).fertig, true);
  assert.equal(stand(b, mit({ "pp:careerStats": { best: 5 } })).fertig, false);
  assert.equal(stand(b, mit({})).fertig, false, "ohne Wert nicht erreicht");
});

test("alte Spielstände zählen rückwirkend", () => {
  const s = mit({ "pp:dailyStats": { wins: 40 }, "pp:soloStats": { perfect: 7 } },
    [E("daily", 90, 3), E("hex", 40)]);
  const ids = alleBadges(s).filter((b) => b.fertig).map((b) => b.id);
  assert.ok(ids.includes("detektiv"), "25 Daily-Siege");
  assert.ok(ids.includes("perfekt5"), "fünf perfekte Boards");
  assert.ok(ids.includes("stamm"), "50 Rätsel");
});

test("erreichte Abzeichen stehen vorn, danach die nächstliegenden", () => {
  const liste = alleBadges(mit({ "pp:soloStats": { perfect: 1 } }, [E("hex", 3)]));
  const ersteOffen = liste.findIndex((b) => !b.fertig);
  assert.ok(liste.slice(0, ersteOffen).every((b) => b.fertig), "erreichte zuerst");
  const offen = liste.slice(ersteOffen);
  for (let i = 1; i < offen.length; i++) {
    assert.ok(offen[i - 1].anteil >= offen[i].anteil, "offene nach Nähe sortiert");
  }
});

test("XP gibt es nur für erreichte Abzeichen", () => {
  const s = mit({}, [E("daily", 1)]);
  const erste = BADGES.find((b) => b.id === "erste");
  assert.equal(badgeXp(s), erste.xp, "nur „Erster Treffer“ sitzt");
});

test("alle acht Solo-Modi kommen in der Sammlung vor", () => {
  // klein geschrieben vergleichen: „Karussell" steckt in „Transferkarussell"
  const text = BADGES.map((b) => b.id + b.name + b.text).join(" ").toLowerCase();
  for (const wort of ["daily", "elf", "karriere", "passt nicht", "kette", "hex", "heat", "karussell"]) {
    assert.ok(text.includes(wort), `kein Abzeichen für ${wort}`);
  }
});
