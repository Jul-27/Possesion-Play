import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, periodsToCp, mergeClub } from "./add_clubs.mjs";

// Wikidata-Zeile nachbilden (nur die Felder, die aggregate() liest)
const row = (name, by, { sl = 0, f, t, cnat } = {}) => ({
  pLabel: { value: name },
  by: { value: String(by) },
  sl: { value: String(sl) },
  ...(f != null ? { f: { value: String(f) } } : {}),
  ...(t != null ? { t: { value: String(t) } } : {}),
  ...(cnat ? { cnat: { value: `http://www.wikidata.org/entity/${cnat}` } } : {}),
});

test("aggregate fasst Zeilen je Spieler zusammen", () => {
  const agg = aggregate([
    row("Max Muster", 1990, { sl: 12, f: 2010, t: 2012 }),
    row("Max Muster", 1990, { sl: 40, f: 2015, t: 0 }),
  ]);
  assert.equal(agg.size, 1);
  const e = agg.get("max muster|1990");
  assert.equal(e.sl, 40, "sl ist das Maximum aller Zeilen");
  assert.deepEqual(e.periods, [[2010, 2012], [2015, 0]]);
});

/* Der Kern der Korrektur: bei Salzburg führen 76 von 436 Spielern kein Startdatum
   am P54-Statement. Die alte Pflichtangabe hat sie komplett verworfen. */
test("Spieler ohne Startdatum bleibt im Kader, bekommt aber kein cp", () => {
  const agg = aggregate([row("Ohne Datum", 1995, { sl: 30 })]);
  assert.equal(agg.size, 1, "Spieler ohne Startjahr zählt trotzdem");
  assert.deepEqual(agg.get("ohne datum|1995").periods, [], "ohne Startjahr kein Zeitraum");
});

test("aggregate ignoriert Zeilen ohne Name oder Geburtsjahr", () => {
  const agg = aggregate([{ pLabel: { value: "Kein Jahr" } }, { by: { value: "1990" } }]);
  assert.equal(agg.size, 0);
});

test("periodsToCp dedupliziert und sortiert nach Startjahr", () => {
  assert.deepEqual(
    periodsToCp("HSV", [[2015, 0], [2010, 2012], [2010, 2012]]),
    [["HSV", 2010, 2012], ["HSV", 2015, 0]],
  );
});

test("mergeClub ergänzt vorhandene Spieler, ohne andere Vereine zu verlieren", () => {
  const players = [{ n: "Max Muster", ln: "Muster", by: 1990, nat: ["GER"], clubs: ["FCB"], cp: [["FCB", 2005, 2010]] }];
  const res = mergeClub(players, "HSV", aggregate([row("Max Muster", 1990, { f: 2010, t: 2014 })]));
  assert.deepEqual(res, { added: 0, enriched: 1, cpAdded: 1 });
  assert.deepEqual(players[0].clubs, ["FCB", "HSV"]);
  assert.deepEqual(players[0].cp, [["FCB", 2005, 2010], ["HSV", 2010, 2014]], "fremde cp bleiben erhalten");
});

test("mergeClub ersetzt nur die cp DIESES Vereins", () => {
  const players = [{ n: "Max Muster", ln: "Muster", by: 1990, nat: [], clubs: ["HSV", "FCB"], cp: [["FCB", 2000, 2004], ["HSV", 1999, 2000]] }];
  mergeClub(players, "HSV", aggregate([row("Max Muster", 1990, { f: 2005, t: 2009 })]));
  assert.deepEqual(players[0].cp, [["FCB", 2000, 2004], ["HSV", 2005, 2009]]);
});

test("mergeClub legt unbekannte Spieler an", () => {
  const players = [];
  const res = mergeClub(players, "SCF", aggregate([row("Neuer Spieler", 2001, { sl: 7, f: 2020, t: 0, cnat: "Q183" })]));
  assert.deepEqual(res, { added: 1, enriched: 0, cpAdded: 1 });
  assert.deepEqual(players[0], {
    n: "Neuer Spieler", ln: "Spieler", by: 2001, nat: ["GER"], clubs: ["SCF"], sl: 7, cp: [["SCF", 2020, 0]],
  });
});

test("mergeClub zählt einen bereits eingetragenen Verein nicht doppelt", () => {
  const players = [{ n: "Max Muster", ln: "Muster", by: 1990, nat: [], clubs: ["TSG"] }];
  const res = mergeClub(players, "TSG", aggregate([row("Max Muster", 1990)]));
  assert.equal(res.enriched, 0);
  assert.deepEqual(players[0].clubs, ["TSG"]);
});

test("mergeClub überschreibt eine vorhandene Nation nicht", () => {
  const players = [{ n: "Max Muster", ln: "Muster", by: 1990, nat: ["CRO"], clubs: [] }];
  mergeClub(players, "M05", aggregate([row("Max Muster", 1990, { cnat: "Q183" })]));
  assert.deepEqual(players[0].nat, ["CRO"]);
});
