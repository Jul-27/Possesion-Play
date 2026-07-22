#!/usr/bin/env node
/* Wendet HONOUR_OVERRIDES aus wikidata_honours.mjs sofort auf src/players.js an
   (additiv, alle übrigen Felder unverändert). Kein Netz nötig. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { HONOUR_OVERRIDES, norm } from "./wikidata_honours.mjs";
import { stampFixes } from "./stamp.mjs";

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
let hits = 0;
for (const p of players) {
  const extra = HONOUR_OVERRIDES[norm(p.n) + "|" + p.by];
  if (!extra) continue;
  const before = (p.t || []).join(",");
  p.t = [...new Set([...(p.t || []), ...extra])].sort();
  if (p.t.join(",") !== before) { hits++; console.log(`  ${p.n}: t = [${p.t}]`); }
}
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampFixes(); // rein kuratiert — DATA_ASOF bleibt unberührt
console.log(`Fertig: ${hits} Spieler ergänzt.`);
