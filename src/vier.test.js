import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYERS } from "./players.js";
import {
  VIER_SEKUNDEN, RUNDEN, VORRAT, BEKANNT_AB, MIN_BESTER_TREFFER, VIER_VEREINE,
  spielerKey, treffer, besterSpieler, spielbar, ziehung, neuesBrett, punkteFuer,
  wertung, spielEnde, rundenTitel, phase, WAHL_TEXT,
} from "./vier.js";

/* Ein fester Zufall, damit die Ziehung reproduzierbar ist. */
function zufall(seed = 7) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

const A = { n: "Anton Alt", ln: "Alt", by: 1990, sl: 50, clubs: ["FCB", "BVB", "RMA"] };
const B = { n: "Berta Bein", ln: "Bein", by: 1995, sl: 80, clubs: ["FCB", "BVB", "RMA"] };
const C = { n: "Carl Club", ln: "Club", by: 2000, sl: 10, clubs: ["FCB", "BVB", "RMA", "JUV"] };
const D = { n: "Dora Dorf", ln: "Dorf", by: 1988, sl: 90, clubs: ["LIV"] };
const KLEIN = [A, B, C, D];
const nachKey = new Map(KLEIN.map((p) => [spielerKey(p), p]));

test("Vereinsauswahl: genau die 47 Spielvereine", () => {
  assert.equal(VIER_VEREINE.length, 47);
  assert.equal(new Set(VIER_VEREINE).size, 47);
});

test("treffer: nur die angezeigten Vereine zählen", () => {
  assert.deepEqual(treffer(C, ["JUV", "LIV", "FCB", "PSG"]), ["JUV", "FCB"]);
  assert.deepEqual(treffer(null, ["FCB"]), []);
});

test("besterSpieler: meiste Treffer, bei Gleichstand der bekanntere; ausgeschlossene übersprungen", () => {
  const vier = ["FCB", "BVB", "RMA", "PSG"];
  assert.equal(besterSpieler(KLEIN, vier).player, B);        // A und B je 3, B bekannter; C auch 3, aber sl 10
  assert.equal(besterSpieler(KLEIN, vier).treffer, 3);
  assert.equal(besterSpieler(KLEIN, ["FCB", "BVB", "RMA", "JUV"]).player, C);
  assert.equal(besterSpieler(KLEIN, vier, new Set([spielerKey(B)])).player, A);
  assert.equal(besterSpieler(KLEIN, ["PSG", "OM", "OL", "LIL"]), null);
});

test("spielbar: braucht einen BEKANNTEN Spieler mit drei Treffern", () => {
  assert.ok(spielbar(KLEIN, ["FCB", "BVB", "RMA", "PSG"]));
  // Nur Carl hätte vier — aber er ist unter der Bekanntheitsschwelle
  assert.ok(!spielbar([C, D], ["FCB", "BVB", "RMA", "JUV"]));
  assert.ok(!spielbar(KLEIN, ["FCB", "BVB", "LIV", "PSG"]));
});

test("ziehung mit dem echten Bestand: zwölf spielbare, verschiedene Vierergruppen", () => {
  const runden = ziehung(PLAYERS, zufall(3));
  assert.equal(runden.length, VORRAT);
  const sigs = new Set(runden.map((r) => [...r].sort().join(",")));
  assert.equal(sigs.size, VORRAT, "keine Gruppe doppelt");
  for (const r of runden) {
    assert.equal(r.length, 4);
    assert.equal(new Set(r).size, 4, "kein Verein doppelt in einer Runde");
    for (const k of r) assert.ok(VIER_VEREINE.includes(k));
    const bester = besterSpieler(PLAYERS.filter((p) => (p.sl || 0) >= BEKANNT_AB), r);
    assert.ok(bester.treffer >= MIN_BESTER_TREFFER, `${r} hat nur ${bester.treffer}`);
  }
});

test("ziehung: viele Seeds, immer voll — die Schleife bricht nie leer ab", () => {
  for (let s = 1; s <= 30; s++) assert.equal(ziehung(PLAYERS, zufall(s * 17)).length, VORRAT);
});

test("neuesBrett: frischer Stand, Runde 0, nichts gewählt", () => {
  const b = neuesBrett(PLAYERS, zufall(5));
  assert.equal(b.kind, "vier");
  assert.equal(b.runden.length, VORRAT);
  assert.deepEqual(b.stand, { runde: 0, start: null, wahl: {}, verlauf: [], ende: false });
});

test("punkteFuer: Treffer der gewählten Person, keine Wahl = 0, unbekannt = 0", () => {
  assert.equal(punkteFuer({ key: spielerKey(C) }, ["FCB", "BVB", "RMA", "JUV"], nachKey), 4);
  assert.equal(punkteFuer(null, ["FCB"], nachKey), 0);
  assert.equal(punkteFuer({ key: "niemand|1900" }, ["FCB"], nachKey), 0);
});

test("wertung: summiert über den Verlauf", () => {
  const brett = {
    runden: [["FCB", "BVB", "RMA", "JUV"], ["LIV", "FCB", "PSG", "OM"]],
    stand: { verlauf: [
      { 1: { key: spielerKey(C) }, 2: { key: spielerKey(A) } },   // 4 : 3
      { 1: null, 2: { key: spielerKey(D) } },                    // 0 : 1
    ] },
  };
  const w = wertung(brett, nachKey);
  assert.deepEqual(w.punkte, [4, 4]);
  assert.deepEqual(w.runden.map((r) => r.punkte), [[4, 3], [0, 1]]);
});

test("spielEnde: nach fünf Runden entschieden, bei Gleichstand weiter, am Vorrat Schluss", () => {
  assert.deepEqual(spielEnde(4, [10, 2]), { ende: false, sieger: 0 });
  assert.deepEqual(spielEnde(RUNDEN, [10, 2]), { ende: true, sieger: 1 });
  assert.deepEqual(spielEnde(RUNDEN, [3, 9]), { ende: true, sieger: 2 });
  assert.deepEqual(spielEnde(RUNDEN, [7, 7]), { ende: false, sieger: 0 });
  assert.deepEqual(spielEnde(RUNDEN + 1, [7, 8]), { ende: true, sieger: 2 });
  assert.deepEqual(spielEnde(VORRAT, [9, 9]), { ende: true, sieger: 0 });
});

test("rundenTitel", () => {
  assert.equal(rundenTitel(0), "Runde 1 von 5");
  assert.equal(rundenTitel(4), "Runde 5 von 5");
  assert.equal(rundenTitel(5), "Entscheidungsrunde");
  assert.equal(rundenTitel(6), "Entscheidungsrunde 2");
});

test("phase: warten → vorlauf → laeuft → aufloesung", () => {
  const start = Date.parse("2026-10-17T12:00:00.000Z");
  const stand = { start: new Date(start).toISOString(), wahl: {} };
  assert.equal(phase({ start: null }, start).name, "warten");
  assert.deepEqual(phase(stand, start - 2500), { name: "vorlauf", rest: 3 });
  const l = phase(stand, start + 10_000);
  assert.equal(l.name, "laeuft");
  assert.equal(l.rest, VIER_SEKUNDEN - 10);
  assert.ok(Math.abs(l.anteil - 20 / 30) < 1e-9);
  assert.deepEqual(phase(stand, start + VIER_SEKUNDEN * 1000), { name: "aufloesung", aufgeloestSeit: start + 30_000 });
});

test("phase: beide gewählt → sofort Auflösung, ab der späteren Wahl", () => {
  const start = Date.parse("2026-10-17T12:00:00.000Z");
  const stand = { start: new Date(start).toISOString(), wahl: {
    1: { key: "a|1", zeit: new Date(start + 4000).toISOString() },
    2: { key: "b|1", zeit: new Date(start + 9000).toISOString() },
  } };
  assert.deepEqual(phase(stand, start + 9500), { name: "aufloesung", aufgeloestSeit: start + 9000 });
  // Nur einer gewählt: läuft weiter
  assert.equal(phase({ ...stand, wahl: { 1: stand.wahl[1] } }, start + 9500).name, "laeuft");
});

test("WAHL_TEXT: jede abgelehnte Antwort der Datenbank hat einen Text", () => {
  for (const k of ["vergeben", "zu_spaet", "noch_nicht", "schon_gewaehlt", "vorbei"]) assert.ok(WAHL_TEXT[k]);
});
