#!/usr/bin/env node
/*
 * refresh_all.mjs — kompletter Wikidata-Refresh in der EINZIG korrekten
 * Reihenfolge (honours setzt t neu, honours_extra ergänzt danach BDO/EM/CA/EL).
 * Bricht beim ersten Fehler ab. Dauer: ~15–40 min (Rate-Limits).
 *   npm run data:refresh
 */
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHAIN = [
  "wikidata_roster.mjs",        // 1) Spieler/Vereine/sl
  "wikidata_national.mjs",      // 1b) Nationalteam-Kader (nat auch für Vereinlose)
  "wikidata_honours.mjs",       // 2) t: 11 Basis-Wettbewerbe (setzt neu)
  "wikidata_honours_extra.mjs", // 3) t += BDO/EM/CA/EL (additiv, NACH 2!)
  "wikidata_positions.mjs",     // 4) pos
  "wikidata_careers.mjs",       // 5) cp
];

for (const script of CHAIN) {
  console.log(`\n════════ ${script} ════════`);
  const r = spawnSync(process.execPath, [join(HERE, script)], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nAbbruch: ${script} endete mit Exit-Code ${r.status}`);
    process.exit(r.status || 1);
  }
}
console.log("\nRefresh komplett — players.js + dataInfo.js aktualisiert.");
