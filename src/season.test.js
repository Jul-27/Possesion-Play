import { test } from "node:test";
import assert from "node:assert/strict";
import { SAISON_START, SAISON_TAGE, saisonNummer, saisonSpanne, LIGEN, ligaFuer, tabelle } from "./season.js";

test("die erste Saison beginnt am Starttag mit Nummer 1", () => {
  assert.equal(saisonNummer(SAISON_START), 1);
  assert.equal(saisonNummer("2026-08-30"), 1, "Tag 28 gehört noch dazu");
  assert.equal(saisonNummer("2026-08-31"), 2, "Tag 29 beginnt die zweite");
});

test("die Spanne umfasst genau 28 Tage und schließt beide Ränder ein", () => {
  const s = saisonSpanne("2026-08-19");
  assert.equal(s.nummer, 1);
  assert.equal(s.von, SAISON_START);
  assert.equal(s.bis, "2026-08-30");
  assert.equal(s.tagImZeitraum, 17);
  assert.equal(s.resttage, 12);
  const tage = (Date.parse(s.bis) - Date.parse(s.von)) / 86400000 + 1;
  assert.equal(tage, SAISON_TAGE);
});

/* Der letzte Tag darf nicht schon zur nächsten Saison zählen — sonst verschwände
   die Tabelle einen Tag zu früh, mitten im Endspurt. */
test("am letzten Tag bleibt genau ein Tag übrig", () => {
  const s = saisonSpanne("2026-08-30");
  assert.equal(s.nummer, 1);
  assert.equal(s.resttage, 1);
  assert.equal(s.tagImZeitraum, SAISON_TAGE);
});

test("Saisons schließen lückenlos aneinander an", () => {
  for (const n of [1, 2, 3, 7]) {
    const a = saisonSpanne(new Date(Date.parse(SAISON_START) + (n - 1) * 28 * 86400000).toISOString().slice(0, 10));
    const b = saisonSpanne(new Date(Date.parse(a.bis) + 86400000).toISOString().slice(0, 10));
    assert.equal(b.nummer, a.nummer + 1);
    assert.equal(Date.parse(b.von) - Date.parse(a.bis), 86400000, `Lücke nach Saison ${a.nummer}`);
  }
});

test("Ligen greifen an ihren Schwellen", () => {
  assert.equal(ligaFuer(0).name, "Kreisliga");
  assert.equal(ligaFuer(399).name, "Kreisliga");
  assert.equal(ligaFuer(400).name, "Landesliga");
  assert.equal(ligaFuer(99999).name, "Champions League");
  assert.equal(ligaFuer(99999).naechste, null, "oben ist Schluss");
  assert.equal(ligaFuer(99999).anteil, 1);
});

test("der Fortschritt zur nächsten Liga rechnet innerhalb der Spanne", () => {
  const l = ligaFuer(650);                       // zwischen 400 und 900
  assert.equal(l.name, "Landesliga");
  assert.equal(l.bisNaechste, 250);
  assert.equal(l.anteil, 0.5);
});

test("die Ligaschwellen steigen streng monoton", () => {
  for (let i = 1; i < LIGEN.length; i++) assert.ok(LIGEN[i].ab > LIGEN[i - 1].ab, LIGEN[i].name);
});

const Z = (client_id, name, punkte, tage) => ({ client_id, name, punkte, tage });

test("die Tabelle sortiert nach Punkten und vergibt Plätze", () => {
  const t = tabelle([Z("b", "Bea", 300, 5), Z("a", "Ali", 900, 7), Z("c", "Cem", 500, 4)], "c");
  assert.deepEqual(t.map((r) => r.name), ["Ali", "Cem", "Bea"]);
  assert.deepEqual(t.map((r) => r.platz), [1, 2, 3]);
  assert.equal(t.find((r) => r.name === "Cem").ichSelbst, true);
  assert.equal(t.find((r) => r.name === "Ali").liga.name, "Regionalliga");
});

/* Bei Punktgleichstand gewinnt, wer an MEHR TAGEN gespielt hat — Beständigkeit
   soll mehr zählen als ein einzelner Glückstag. */
test("bei Gleichstand entscheidet die Zahl der Spieltage", () => {
  const t = tabelle([Z("a", "Ali", 500, 2), Z("b", "Bea", 500, 9)], "a");
  assert.deepEqual(t.map((r) => r.name), ["Bea", "Ali"]);
});

test("bei Gleichstand in beidem entscheidet der Name, damit die Reihenfolge stabil ist", () => {
  const eins = tabelle([Z("a", "Zoe", 100, 3), Z("b", "Ada", 100, 3)], "a").map((r) => r.name);
  const zwei = tabelle([Z("b", "Ada", 100, 3), Z("a", "Zoe", 100, 3)], "a").map((r) => r.name);
  assert.deepEqual(eins, ["Ada", "Zoe"]);
  assert.deepEqual(eins, zwei, "gleiche Eingabe in anderer Reihenfolge ⇒ gleiche Tabelle");
});

test("eine leere Tabelle ist leer, nicht kaputt", () => {
  assert.deepEqual(tabelle([], "a"), []);
});
