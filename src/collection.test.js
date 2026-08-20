import { test } from "node:test";
import assert from "node:assert/strict";
import {
  spielerSchluessel, merkeSpieler, STUFEN, stufeVon, karten, sammlungStand,
} from "./collection.js";

const P = (n, by, sl, nat = ["GER"]) => ({ n, ln: n.split(" ").pop(), by, nat, clubs: [], sl });
/** Speicher im Arbeitsspeicher statt localStorage — die Logik kennt den Unterschied nicht. */
const speicher = (start = []) => {
  let liste = [...start];
  return { lesen: () => liste, schreiben: (l) => { liste = l; }, alles: () => liste };
};

test("der Schlüssel ist derselbe wie überall sonst im Projekt", () => {
  assert.equal(spielerSchluessel(P("Fábio Vieira", 2000, 30)), "fabio vieira|2000");
  assert.equal(spielerSchluessel(null), "");
});

test("ein neuer Spieler wird gemerkt und meldet sich als neu", () => {
  const s = speicher();
  assert.equal(merkeSpieler(P("Ada Bee", 1990, 50), s), true);
  assert.deepEqual(s.alles(), ["ada bee|1990"]);
});

/* Ohne diese Prüfung meldete jeder zweite Zug „Neue Karte!" — die Rückmeldung
   verlöre sofort ihren Wert. */
test("derselbe Spieler zweimal ist keine neue Karte", () => {
  const s = speicher();
  merkeSpieler(P("Ada Bee", 1990, 50), s);
  assert.equal(merkeSpieler(P("Ada Bee", 1990, 50), s), false);
  assert.equal(s.alles().length, 1, "und wird nicht doppelt gespeichert");
});

test("Namensvettern werden über das Geburtsjahr getrennt", () => {
  const s = speicher();
  merkeSpieler(P("Michael Owen", 1979, 60), s);
  assert.equal(merkeSpieler(P("Michael Owen", 1976, 20), s), true, "anderer Jahrgang, andere Karte");
  assert.equal(s.alles().length, 2);
});

test("ohne Spieler passiert nichts", () => {
  const s = speicher();
  assert.equal(merkeSpieler(null, s), false);
  assert.deepEqual(s.alles(), []);
});

/* Die Seltenheit läuft UMGEKEHRT zur Bekanntheit: Wer einen unbekannten Spieler
   nennt, hat mehr geleistet als jemand, der Messi tippt. Eine Verwechslung der
   Richtung wäre in der Anzeige nicht sofort sichtbar, aber inhaltlich falsch. */
test("Seltenheitsstufen greifen an ihren Grenzen", () => {
  assert.equal(stufeVon(P("A", 1990, 85)).key, "weltstar");
  assert.equal(stufeVon(P("A", 1990, 70)).key, "weltstar");
  assert.equal(stufeVon(P("A", 1990, 69)).key, "star");
  assert.equal(stufeVon(P("A", 1990, 30)).key, "profi");
  assert.equal(stufeVon(P("A", 1990, 5)).key, "geheimtipp");
  assert.equal(stufeVon(P("A", 1990, 0)).key, "geheimtipp");
  assert.equal(stufeVon({}).key, "geheimtipp", "ohne sl die unterste Stufe");
});

test("die Stufen sind absteigend sortiert, sonst greift die erste immer", () => {
  for (let i = 1; i < STUFEN.length; i++) assert.ok(STUFEN[i].ab < STUFEN[i - 1].ab, STUFEN[i].key);
});

const KADER = [
  P("Zora Alt", 1988, 90, ["GER"]), P("Bea Berg", 1995, 60, ["ESP"]),
  P("Cem Cirak", 1999, 35, ["GER", "TUR"]), P("Dan Dorn", 2001, 8, ["ESP"]),
];
const meine = new Set(["zora alt|1988", "cem cirak|1999", "dan dorn|2001"]);

test("Karten zeigen nur Gesammeltes, bekannteste zuerst", () => {
  const k = karten(KADER, meine);
  assert.deepEqual(k.map((p) => p.n), ["Zora Alt", "Cem Cirak", "Dan Dorn"]);
  assert.ok(!k.some((p) => p.n === "Bea Berg"), "nicht gesammelt");
});

test("Filter nach Nation, Stufe und Name", () => {
  assert.deepEqual(karten(KADER, meine, { nation: "GER" }).map((p) => p.n), ["Zora Alt", "Cem Cirak"]);
  assert.deepEqual(karten(KADER, meine, { stufe: "geheimtipp" }).map((p) => p.n), ["Dan Dorn"]);
  assert.deepEqual(karten(KADER, meine, { suche: "cir" }).map((p) => p.n), ["Cem Cirak"]);
  assert.deepEqual(karten(KADER, meine, { suche: "CIRAK" }).map((p) => p.n), ["Cem Cirak"], "Groß/klein egal");
  assert.deepEqual(karten(KADER, meine, { nation: "ESP", stufe: "weltstar" }), [], "Filter greifen zusammen");
});

test("der Stand zählt gesamt, je Stufe und je Nation", () => {
  const s = sammlungStand(KADER, meine);
  assert.equal(s.anzahl, 3);
  assert.equal(s.gesamt, 4);
  assert.deepEqual(s.jeStufe, { weltstar: 1, star: 0, profi: 1, geheimtipp: 1 });
  assert.deepEqual(s.nationen, [["GER", 2], ["ESP", 1], ["TUR", 1]]);
  assert.equal(s.anteil, 0.75);
});

test("eine leere Sammlung ist leer, nicht kaputt", () => {
  const s = sammlungStand(KADER, new Set());
  assert.equal(s.anzahl, 0);
  assert.equal(s.anteil, 0);
  assert.deepEqual(s.nationen, []);
  assert.deepEqual(karten(KADER, new Set()), []);
});
