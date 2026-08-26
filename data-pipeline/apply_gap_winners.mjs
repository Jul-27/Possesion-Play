#!/usr/bin/env node
/* Wendet GAP_WINNERS aus wikidata_honours.mjs sofort auf src/players.js an
   (cp-Überlappung, additiv). Kein Netz nötig. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { applyGapWinners } from "./wikidata_honours.mjs";
import { stampFixes } from "./stamp.mjs";
import { recToString } from "./player_record.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
const players = mod.PLAYERS.map((p) => ({ ...p }));
const added = applyGapWinners(players);
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampFixes(); // rein kuratiert — DATA_ASOF bleibt unberührt
console.log(`Fertig: ${added} Titel-Zuordnungen ergänzt.`);
