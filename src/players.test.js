import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYERS } from "./players.js";
import { NAME_OVERRIDES, EXCLUDED_PLAYERS } from "../data-pipeline/name_overrides.mjs";
import { endziele } from "../data-pipeline/apply_name_overrides.mjs";

const names = new Set(PLAYERS.map((p) => p.n));

test("players.js: kein Name ist eine rohe Wikidata-QID", () => {
  const qids = PLAYERS.filter((p) => /^Q\d+$/.test(p.n));
  assert.deepEqual(qids.map((p) => p.n), [], "QID statt Name im Datensatz");
});

test("players.js: auch ln enthält keine rohe QID", () => {
  const qids = PLAYERS.filter((p) => /^Q\d+$/.test(p.ln));
  assert.deepEqual(qids.map((p) => p.ln), []);
});

test("players.js: die gemeldeten Namen sind korrekt geschrieben", () => {
  for (const n of ["Divock Origi", "Javier Hernández", "João Félix", "Lamine Yamal"]) {
    assert.ok(names.has(n), "fehlt: " + n);
  }
  for (const n of ["Divock Origi kolman", "Javier Hernánde", "João pelix"]) {
    assert.ok(!names.has(n), "verstümmelter Name noch da: " + n);
  }
});

test("players.js: keine verstümmelte Variante aus NAME_OVERRIDES überlebt", () => {
  const leftover = NAME_OVERRIDES.filter((o) => PLAYERS.some((p) => p.n === o.from && p.by === o.by));
  assert.deepEqual(leftover.map((o) => `${o.from} (${o.by})`), []);
});

test("players.js: jeder korrigierte Name ist im Datensatz angekommen", () => {
  /* `byTo` schlüsselt zusätzlich das Geburtsjahr um (Pepe, Quaresma — dort ist das
     Datum in Wikidata selbst kaputt). Der Zieldatensatz steht dann unter dem
     KORRIGIERTEN Jahr; unter dem alten zu suchen ginge zwangsläufig ins Leere. */
  /* Verkettete Zeilen („Mykhaylo" → „Mykhailo" → „Mychajlo Mudryk") zählen mit ihrem
     ENDziel — das Zwischenziel verschwindet beim Verschmelzen bestimmungsgemäß. */
  const zielJahr = (o) => o.byTo ?? o.by;
  const missing = [...endziele(NAME_OVERRIDES).values()]
    .filter((o) => !PLAYERS.some((p) => p.n === o.to && p.by === zielJahr(o)));
  assert.deepEqual(missing.map((o) => `${o.to} (${zielJahr(o)})`), []);
});

test("players.js: kuratierte Ausschlüsse sind entfernt (inkl. Aliasse)", () => {
  const leftover = [];
  for (const x of EXCLUDED_PLAYERS) {
    for (const n of [x.n, ...(x.aliases || [])]) {
      if (PLAYERS.some((p) => p.n === n && p.by === x.by)) leftover.push(`${n} (${x.by})`);
    }
  }
  assert.deepEqual(leftover, []);
});

test("players.js: Jason Statham (Schauspieler) ist raus", () => {
  assert.ok(!names.has("Jason Statham"));
});
