#!/usr/bin/env node
/* Kuratierte Spieler, die Wikidata nicht/kaum kennt, additiv in src/players.js.
   Anlegen oder Felder ergänzen (clubs/nat/cp union; sl/pos/by setzen falls leer).
   Kein Netz. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampFixes } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

// Bestätigte Fakten (vom Owner gemeldet), die Wikidata nicht sauber liefert.
export const EXTRA_PLAYERS = [
  { n: "Gernot Trauner", by: 1992, nat: ["AUT"], clubs: ["FEY"], sl: 35, pos: "ABW", cp: [["FEY", 2021, 0]] },
  { n: "Oscar Gloukh",   by: 2004, clubs: ["AJA"], cp: [["AJA", 2025, 0]] },     // Ajax seit 2025
  { n: "Diego",          by: 1985, clubs: ["SVW"], cp: [["SVW", 2006, 2009]] },  // Werder Bremen
  { n: "Arturo Vidal",   by: 1987, clubs: ["B04"], cp: [["B04", 2007, 2011]] },  // Bayer Leverkusen
  { n: "Adam Daghim",    by: 2005, clubs: ["RBS"], cp: [["RBS", 2023, 2024]] },  // RB Salzburg
  { n: "Sergio Agüero",  by: 1988, clubs: ["ATM"], cp: [["ATM", 2006, 2011]] },  // Atlético Madrid

  // RB Salzburg: Wikidata führt bei diesen fünf gar keinen Salzburg-Eintrag (P54),
  // obwohl alle dort spielten. Nur der Vereins-Bezug wird gesetzt (das HEX-Club-Feld
  // prüft clubs[], keine Jahre); cp bleibt weg, weil sich die Spielzeiträume nicht
  // aus Wikidata belegen lassen — fehlend ist besser als geraten.
  { n: "Janis Blaswich",    by: 1991, clubs: ["RBS"] },
  { n: "Brenden Aaronson",  by: 2000, clubs: ["RBS"] },
  { n: "Noah Okafor",       by: 2000, clubs: ["RBS"] },
  { n: "Rasmus Kristensen", by: 1997, clubs: ["RBS"] },
  { n: "Maximilian Wöber",  by: 1998, clubs: ["RBS"] },

  // Lothar Matthäus fehlte komplett: sein Wikidata-Eintrag führt als Beruf nur
  // „Fußballtrainer", nicht „Fußballspieler" (P106=Q937857) — der Roster-Filter
  // schließt ihn dadurch aus. Vereine/Titel/cp sind aus Wikidata belegt (P54 + die
  // Wettbewerbssieger seiner Spells; UEFA-Cup zählt nicht, da das Spiel nur die
  // moderne Europa League ab 2009 kennt, ebenso keine CL — die hat er nie gewonnen).
  { n: "Lothar Matthäus", by: 1961, nat: ["GER"], clubs: ["BMG", "FCB", "INT"],
    t: ["BDO", "DFB", "EM", "MBL", "MSA", "WM"], sl: 85, pos: "MF",
    cp: [["BMG", 1979, 1984], ["FCB", 1984, 1988], ["INT", 1988, 1992], ["FCB", 1992, 2000]] },
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
    if (x.t) cur.t = [...new Set([...(cur.t || []), ...x.t])].sort();
    if (x.cp) cur.cp = [...(cur.cp || []).filter((c) => !x.cp.some((y) => y[0] === c[0])), ...x.cp].sort((a, b) => a[1] - b[1]);
    if (x.pos && !cur.pos) cur.pos = x.pos;
    if (x.sl && !cur.sl) cur.sl = x.sl;
    merged++;
  } else {
    players.push({ n: x.n, ln: deriveLastName(x.n), by: x.by, nat: x.nat || [], clubs: x.clubs || [], t: x.t, sl: x.sl || 0, pos: x.pos, cp: x.cp });
    added++;
  }
}
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampFixes(); // rein kuratiert — DATA_ASOF bleibt unberührt
console.log(`Fertig: ${added} neu, ${merged} ergänzt.`);
