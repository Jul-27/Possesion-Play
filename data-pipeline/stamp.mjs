/* Schreibt src/dataInfo.js mit zwei getrennten Daten:
 *
 *   DATA_ASOF  — letzter echter Wikidata-Abruf. Das ist der Stand, der die Spieler
 *                interessiert: Kader, Transfers, Titel, Positionen, Karrieren.
 *                Setzen ihn: wikidata_*.mjs, add_salzburg.mjs, apply_msa.mjs.
 *   FIXES_ASOF — letzte kuratierte Korrektur (Namen, Titel-Lücken, Einzelspieler).
 *                Diese Skripte holen nichts aus Wikidata und dürfen DATA_ASOF daher
 *                NICHT anfassen — sonst sähe der Datenstand frischer aus, als er ist.
 *                Setzen ihn: apply_name_overrides/-honour_overrides/-extra_players/-gap_winners.
 *
 * Beide Funktionen erhalten den jeweils anderen Wert.
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "..", "src", "dataInfo.js");

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function read(name) {
  if (!existsSync(FILE)) return null;
  const m = readFileSync(FILE, "utf8").match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : null;
}

function write(dataAsof, fixesAsof) {
  writeFileSync(FILE,
    `// GENERIERT von data-pipeline/stamp.mjs. Nicht von Hand editieren.\n` +
    `// DATA_ASOF = letzter Wikidata-Abruf, FIXES_ASOF = letzte kuratierte Korrektur.\n` +
    `export const DATA_ASOF = "${dataAsof}";\n` +
    `export const FIXES_ASOF = "${fixesAsof}";\n`);
}

// Nach einem echten Wikidata-Abruf aufrufen.
export function stampDataInfo() {
  const s = today();
  write(s, read("FIXES_ASOF") || s);
  return s;
}

// Nach einer rein kuratierten Korrektur aufrufen — lässt DATA_ASOF unberührt.
export function stampFixes() {
  const s = today();
  write(read("DATA_ASOF") || s, s);
  return s;
}
