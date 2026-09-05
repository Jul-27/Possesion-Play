import { test } from "node:test";
import assert from "node:assert/strict";
import { norm, imZeitraum, applyGapWinners } from "./wikidata_honours.mjs";

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

/* ── Wer war in dieser Saison wirklich da? ───────────────────────────────────
   DER FEHLER, DEN DIESE PRÜFUNGEN FANGEN: Saison und Vereinsstation sind in Wikidata
   beide nur jahresgenau. Gefragt wurde, ob sie sich IRGENDWIE überschneiden — ein
   gemeinsames Kalenderjahr reichte. Damit zählte jeder Sommerwechsel doppelt: wer im
   Juli kam, bekam den Titel vom Mai davor, wer im Juli ging, den der Saison danach.

   Gemeldet vom Eigentümer: Ibrahimović und Mbappé standen als Champions-League-Sieger
   in den Daten. Beide haben sie nie gewonnen. */
test("wer nach dem Finale kommt, hat den Titel nicht gewonnen", () => {
  /* Ibrahimović kam 2009 zu Barcelona. Barça gewann die Champions League 2008/09 —
     das Finale war im Mai 2009, sechs Wochen vor seinem Wechsel. */
  assert.equal(imZeitraum(2009, 2010, 2008), false, "Barça 2008/09 gehört ihm nicht");
  /* Die Saison, die er wirklich mitspielte. */
  assert.equal(imZeitraum(2009, 2010, 2009), true, "La Liga 2009/10 dagegen schon");
});

test("wer im Sommer davor geht, hat den Titel nicht gewonnen", () => {
  /* Mbappé verließ PSG 2024. PSG gewann die Champions League 2024/25. */
  assert.equal(imZeitraum(2018, 2024, 2024), false, "PSG 2024/25 gehört ihm nicht");
  /* Sein letztes Jahr dort. */
  assert.equal(imZeitraum(2018, 2024, 2023), true, "Ligue 1 2023/24 dagegen schon");
  /* Und der Normalfall: Wer im Sommer NACH dem Titel geht, hat ihn gewonnen. */
  assert.equal(imZeitraum(2020, 2025, 2024), true);
});

/* Turniere ohne Enddatum finden IM Startjahr statt. Ohne den Sonderfall verlöre jeder
   seinen Titel, der danach zurücktritt — Lahm beendete seine Länderspiellaufbahn 2014
   direkt nach dem Weltmeistertitel. */
test("ein Turnier im selben Jahr zählt auch beim Abschied danach", () => {
  assert.equal(imZeitraum(2004, 2014, 2014, 2014), true, "WM 2014, Rücktritt 2014");
  assert.equal(imZeitraum(2015, 0, 2014, 2014), false, "wer erst 2015 anfing, war nicht dabei");
});

test("ein offenes Vertragsende reicht bis heute", () => {
  assert.equal(imZeitraum(2020, 0, 2025), true);
  assert.equal(imZeitraum(2026, 0, 2025), false, "aber nicht rückwärts");
});

/* Die kuratierten Lücken ahmten die Query nach und erbten damit denselben Fehler. */
test("auch die kuratierten Sieger folgen der Regel", () => {
  /* Dortmund steht mit genau einem Pokalsieg in der Liste: 2011/12, Finale Mai 2012.
     Bayern taugt hier nicht als Beispiel — die stehen viermal drin. */
  const bei = (von, bis) => [{ n: "X", by: 1990, cp: [["BVB", von, bis]] }];
  const dabei = bei(2011, 2015); applyGapWinners(dabei);
  assert.deepEqual(dabei[0].t, ["DFB"]);
  const zuSpaet = bei(2012, 2015); applyGapWinners(zuSpaet);
  assert.equal(zuSpaet[0].t, undefined, "wer 2012 kam, war im Finale nicht dabei");
  const zuFrueh = bei(2008, 2011); applyGapWinners(zuFrueh);
  assert.equal(zuFrueh[0].t, undefined, "wer 2011 ging, auch nicht");
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
