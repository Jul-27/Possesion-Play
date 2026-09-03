import { test } from "node:test";
import assert from "node:assert/strict";
import { norm } from "./wikidata_honours.mjs";

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

/* ── Die Namensnormalisierung ────────────────────────────────────────────────
   Sie ist der einzige Anker zwischen Wikidata und unserem Bestand — Spieler haben
   bei uns keine QID. Jede Schreibweise, die sie nicht auflöst, kostet einem Spieler
   ALLE Titel des betroffenen Wettbewerbs. */

/* GEMESSEN AM 03.09.2026: Arda Gülers englisches Wikidata-Label begann mit einem
   griechischen Alpha (U+0391) statt einem lateinischen A. Auf dem Bildschirm nicht
   zu unterscheiden, für jeden Vergleich ein anderer Name — er verlor Meisterschaft
   und Champions League. */
test("Buchstaben, die nur lateinisch aussehen, werden aufgelöst", () => {
  assert.equal(norm("\u0391rda Güler"), norm("Arda Güler"), "griechisches Alpha");
  assert.equal(norm("\u041Alose"), norm("Klose"), "kyrillisches Ka");
  assert.equal(norm("M\u0430rtinez"), norm("Martinez"), "kyrillisches a");
  assert.equal(norm("\u041Ersic"), norm("Orsic"), "kyrillisches O");
});

/* Zwei unserer eigenen Namen tragen geschützte Leerzeichen. Ohne Auflösung ist
   „Ezequiel\u00A0Fernández" ein anderer Name als der mit gewöhnlichem Leerzeichen. */
test("unsichtbare Leerzeichen werden vereinheitlicht", () => {
  assert.equal(norm("Ezequiel\u00A0Fernández"), norm("Ezequiel Fernández"));
  assert.equal(norm("Valentin\u200BGendrey"), norm("Valentin Gendrey"));
  assert.equal(norm("  Doppel   Leer  "), "doppel leer");
});

test("gewöhnliche Namen bleiben unangetastet", () => {
  assert.equal(norm("Antonio Rüdiger"), "antonio rudiger");
  assert.equal(norm("André Onana"), "andre onana");
  assert.equal(norm("Lionel Messi"), "lionel messi");
  assert.equal(norm("Xherdan Shaqiri"), "xherdan shaqiri");
});

/* ── Die Titel selbst ────────────────────────────────────────────────────────
   DER FEHLER, DEN DIESE PRÜFUNG FÄNGT: Ein Enddatum vom Typ „unbekannter Wert"
   kommt als anonymer Knoten zurück. Die Variable ist damit GEBUNDEN, aber YEAR()
   scheitert daran, der Zeitfilter wird falsch und die ganze Zeile fällt weg — der
   Spieler verliert JEDEN Titel dieses Vereins. 50 Stationen waren betroffen. */
test("Titel, die an einem unbekannten Vertragsende hingen, sind da", async () => {
  const { PLAYERS } = await import("../src/players.js");
  const von = (n) => new Set(PLAYERS.find((p) => p.n === n)?.t || []);
  /* Gemeldet vom Eigentümer: La Liga zählte bei Rüdiger im Hex-Duell nicht. */
  assert.ok(von("Antonio Rüdiger").has("MLL"), "Rüdiger: La Liga 2023/24 mit Real");
  assert.ok(von("Antonio Rüdiger").has("CDR"), "Rüdiger: Copa del Rey 2022/23");
  /* Beim Nachgehen aufgefallen — derselbe Fehler, größerer Schaden. */
  assert.ok(von("Serge Gnabry").has("CL"), "Gnabry: Champions League 2020 mit Bayern");
  assert.ok(von("Serge Gnabry").has("MBL"), "Gnabry: Meisterschaft mit Bayern");
  assert.ok(von("Robert Andrich").has("MBL"), "Andrich: Meisterschaft 2023/24 mit Leverkusen");
  /* Homoglyph im Namen. */
  assert.ok(von("Arda Güler").has("MLL"), "Güler: La Liga mit Real");
  /* Und die Gegenprobe: Wer nichts gewonnen hat, bekommt auch nichts. */
  assert.equal(von("Rüdiger Ziehl").size, 0);
});
