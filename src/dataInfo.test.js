import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DATA_ASOF, FIXES_ASOF } from "./dataInfo.js";

test("Beide Daten sind gültiges YYYY-MM-DD", () => {
  for (const [name, v] of [["DATA_ASOF", DATA_ASOF], ["FIXES_ASOF", FIXES_ASOF]]) {
    assert.match(v, /^\d{4}-\d{2}-\d{2}$/, `${name} hat kein gültiges Format`);
    assert.ok(!Number.isNaN(Date.parse(v)), `${name} ist kein gültiges Datum`);
  }
});

test("Korrekturen liegen nie vor dem Wikidata-Abruf", () => {
  assert.ok(Date.parse(FIXES_ASOF) >= Date.parse(DATA_ASOF),
    `FIXES_ASOF (${FIXES_ASOF}) darf nicht vor DATA_ASOF (${DATA_ASOF}) liegen`);
});

/* Der Kern der Trennung: Ein rein kuratiertes Skript darf DATA_ASOF nicht anfassen,
   sonst sieht der Datenstand frischer aus, als er ist — genau der Fehler, der die
   Live-Seite „22.07." zeigen ließ, obwohl die Kaderdaten vom 15.07. stammten. */
test("Kuratierte Skripte stempeln FIXES_ASOF, Wikidata-Skripte DATA_ASOF", () => {
  const dir = new URL("../data-pipeline/", import.meta.url);
  const kuratiert = ["apply_name_overrides", "apply_gap_winners", "apply_honour_overrides", "apply_extra_players"];
  const ausWikidata = ["wikidata_roster", "wikidata_national", "wikidata_honours", "wikidata_honours_extra",
    "wikidata_positions", "wikidata_careers", "add_salzburg", "apply_msa"];

  const vorhanden = new Set(readdirSync(dir));
  for (const n of kuratiert) {
    if (!vorhanden.has(`${n}.mjs`)) continue;
    const src = readFileSync(new URL(`${n}.mjs`, dir), "utf8");
    assert.ok(src.includes("stampFixes("), `${n}.mjs muss stampFixes() aufrufen`);
    assert.ok(!src.includes("stampDataInfo("), `${n}.mjs darf DATA_ASOF nicht setzen — es holt nichts aus Wikidata`);
  }
  for (const n of ausWikidata) {
    if (!vorhanden.has(`${n}.mjs`)) continue;
    const src = readFileSync(new URL(`${n}.mjs`, dir), "utf8");
    assert.ok(src.includes("stampDataInfo("), `${n}.mjs muss stampDataInfo() aufrufen`);
  }
});
