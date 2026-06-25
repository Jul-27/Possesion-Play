#!/usr/bin/env node
/*
 * wikidata_honours.mjs — Setzt das Feld `t` (Honours) je Spieler in src/players.js
 * komplett aus Wikidata: Saison-Sieger je Wettbewerb (P1346) × Spieler-Vereins-
 * zeitraum (P54 mit P580/P582). Internet nötig. Idempotent. Läuft NACH dem Roster.
 *   node data-pipeline/wikidata_honours.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Honour-Key -> Wikidata-Wettbewerb (verifiziert: Label + vorhandene Saison-Sieger)
const COMP_QID = {
  CL:"Q18756", WM:"Q19317",
  MBL:"Q82595", MPL:"Q9448", MLL:"Q324867", MSA:"Q15804", ML1:"Q13394",
  DFB:"Q150880", FAC:"Q11151", CDR:"Q483794", CIT:"Q169918",
};

export function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    if (res.status === 429) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return (await res.json()).results.bindings;
  }
  throw new Error("429 wiederholt");
}

// Spieler, die im Titel-Saison-Zeitraum beim Sieger des Wettbewerbs waren.
async function fetchHonourPlayers(qid) {
  const q = `SELECT DISTINCT ?pLabel ?by WHERE {
    ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; wdt:P580 ?ss .
    OPTIONAL { ?season wdt:P582 ?se. }
    ?p p:P54 ?st . ?st ps:P54 ?winner ; pq:P580 ?cs .
    OPTIONAL { ?st pq:P582 ?ce. }
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
    FILTER( YEAR(?cs) <= YEAR(COALESCE(?se, ?ss)) && (!BOUND(?ce) || YEAR(?ce) >= YEAR(?ss)) )
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({ name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  return s + "}";
}

async function main() {
  // 1) Honours pro Spieler aus Wikidata: key "norm|by" -> Set(honourKeys)
  const hon = new Map();
  for (const [key, qid] of Object.entries(COMP_QID)) {
    let rows;
    try { rows = await fetchHonourPlayers(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    let c = 0;
    for (const r of rows) {
      if (!r.name || !r.by) continue;
      const k = norm(r.name) + "|" + r.by;
      if (!hon.has(k)) hon.set(k, new Set());
      hon.get(k).add(key); c++;
    }
    console.log(`  ${key} (${qid}): ${rows.length} Zeilen, ${c} Zuordnungen`);
    await sleep(1300);
  }

  // 2) players.js laden, t neu setzen
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  let withT = 0;
  for (const p of players) {
    const keys = hon.get(norm(p.n) + "|" + p.by);
    if (keys && keys.size) { p.t = [...keys].sort(); withT++; }
    else delete p.t;
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  console.log(`\nFertig: ${withT} Spieler mit Honours -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
