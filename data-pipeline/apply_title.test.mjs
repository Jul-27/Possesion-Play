import { test } from "node:test";
import assert from "node:assert/strict";
import { windows } from "./apply_title.mjs";
import { WINDOWS, COMP_QID } from "./wikidata_honours.mjs";

test("windows deckt den Zeitraum lückenlos und überschneidungsfrei ab", () => {
  const w = windows(1903, 4, 1923);
  assert.deepEqual(w, [[1903, 1907], [1907, 1911], [1911, 1915], [1915, 1919], [1919, 1923]]);
});

test("windows reicht über das Endjahr hinaus, nie darunter", () => {
  const w = windows(1900, 4, 1910);
  assert.equal(w.at(-1)[1] >= 1910, true, "das letzte Fenster muss das Endjahr einschließen");
});

/* Der Kern der Korrektur: breite Fenster laufen bei WDQS ins Timeout. Am 03.08.2026
   scheiterten vier von fünf Wettbewerben mit 10-Jahres-Blöcken, dieselbe Abfrage in
   4-Jahres-Schritten kam durch. Diese Grenze hält der Test fest. */
test("kein Honours-Fenster ist breiter als 4 Jahre", () => {
  for (const [from, to] of WINDOWS) {
    assert.ok(to - from <= 4, `Fenster ${from}-${to} ist ${to - from} Jahre breit — WDQS kippt darüber ins Timeout`);
  }
});

test("die Honours-Fenster sind lückenlos und decken die Fußballgeschichte ab", () => {
  assert.ok(WINDOWS[0][0] <= 1890, "muss vor der ersten Meisterschaft beginnen");
  assert.ok(WINDOWS.at(-1)[1] >= new Date().getFullYear() + 1, "muss die laufende Saison einschließen");
  for (let i = 1; i < WINDOWS.length; i++) {
    assert.equal(WINDOWS[i][0], WINDOWS[i - 1][1], `Lücke oder Überlappung bei ${WINDOWS[i - 1]} -> ${WINDOWS[i]}`);
  }
});

test("jeder Honour-Key im Spiel hat einen Wettbewerb oder wird separat geholt", () => {
  // BDO/EM/CA/EL kommen aus wikidata_honours_extra.mjs, nicht aus COMP_QID.
  const extra = new Set(["BDO", "EM", "CA", "EL"]);
  for (const k of Object.keys(COMP_QID)) assert.match(COMP_QID[k], /^Q\d+$/, `${k} hat keine QID`);
  assert.equal(Object.keys(COMP_QID).some((k) => extra.has(k)), false, "Extra-Wettbewerbe gehören nicht in COMP_QID");
});
