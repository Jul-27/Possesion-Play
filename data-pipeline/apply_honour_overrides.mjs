#!/usr/bin/env node
/* Wendet HONOUR_OVERRIDES aus wikidata_honours.mjs sofort auf src/players.js an
   (additiv, alle übrigen Felder unverändert). Kein Netz nötig. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { HONOUR_OVERRIDES, FALSCHE_TITEL, norm } from "./wikidata_honours.mjs";
import { stampFixes } from "./stamp.mjs";
import { recToString } from "./player_record.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
const players = mod.PLAYERS.map((p) => ({ ...p }));
let hits = 0, weg = 0;
for (const p of players) {
  const key = norm(p.n) + "|" + p.by;
  const extra = HONOUR_OVERRIDES[key];
  const falsch = FALSCHE_TITEL[key];
  if (!extra && !falsch) continue;
  const before = (p.t || []).join(",");
  let t = [...new Set([...(p.t || []), ...(extra || [])])];
  /* Streichen NACH dem Ergänzen: Stünde ein Titel in beiden Tabellen, gewönne die
     Widerlegung — und das ist die richtige Rangfolge. */
  if (falsch) t = t.filter((x) => !falsch.weg.includes(x));
  p.t = t.sort();
  if (p.t.join(",") === before) continue;
  if (falsch) { weg++; console.log(`  - ${p.n}: ${falsch.weg.join(", ")} (${falsch.grund})`); }
  else { hits++; console.log(`  + ${p.n}: t = [${p.t}]`); }
}
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampFixes(); // rein kuratiert — DATA_ASOF bleibt unberührt
console.log(`Fertig: ${hits} Spieler ergänzt, ${weg} Titel gestrichen.`);
