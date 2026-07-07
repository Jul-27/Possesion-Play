#!/usr/bin/env node
/* Wendet GAP_WINNERS aus wikidata_honours.mjs sofort auf src/players.js an
   (cp-Überlappung, additiv). Kein Netz nötig. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { applyGapWinners } from "./wikidata_honours.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
const players = mod.PLAYERS.map((p) => ({ ...p }));
const added = applyGapWinners(players);
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampDataInfo();
console.log(`Fertig: ${added} Titel-Zuordnungen ergänzt.`);
