#!/usr/bin/env node
/* Kuratierte Spieler, die Wikidata nicht/kaum kennt, additiv in src/players.js.
   Anlegen oder Felder ergänzen (clubs/nat/cp union; sl/pos/by setzen falls leer).
   Kein Netz. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

// Bestätigte Fakten (vom Owner gemeldet), die Wikidata nicht sauber liefert.
export const EXTRA_PLAYERS = [
  { n: "Gernot Trauner", by: 1992, nat: ["AUT"], clubs: ["FEY"], sl: 35, pos: "ABW", cp: [["FEY", 2021, 0]] },
];

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
const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
let added = 0, merged = 0;
for (const x of EXTRA_PLAYERS) {
  const cur = byKey.get(norm(x.n) + "|" + x.by);
  if (cur) {
    if (x.nat && !(cur.nat || []).length) cur.nat = [...x.nat];
    if (x.clubs) cur.clubs = [...new Set([...(cur.clubs || []), ...x.clubs])].sort();
    if (x.cp) cur.cp = [...(cur.cp || []).filter((c) => !x.cp.some((y) => y[0] === c[0])), ...x.cp].sort((a, b) => a[1] - b[1]);
    if (x.pos && !cur.pos) cur.pos = x.pos;
    if (x.sl && !cur.sl) cur.sl = x.sl;
    merged++;
  } else {
    players.push({ n: x.n, ln: deriveLastName(x.n), by: x.by, nat: x.nat || [], clubs: x.clubs || [], sl: x.sl || 0, pos: x.pos, cp: x.cp });
    added++;
  }
}
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampDataInfo();
console.log(`Fertig: ${added} neu, ${merged} ergänzt.`);
