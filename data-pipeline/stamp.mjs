/* Schreibt src/dataInfo.js mit dem Datum des letzten Pipeline-Laufs.
   Wird von JEDEM Skript nach dem players.js-Write aufgerufen. */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));

export function stampDataInfo() {
  const d = new Date();
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  writeFileSync(join(HERE, "..", "src", "dataInfo.js"),
    `// GENERIERT von data-pipeline/stamp.mjs — Datum des letzten Wikidata-Laufs. Nicht von Hand editieren.\nexport const DATA_ASOF = "${s}";\n`);
  return s;
}
