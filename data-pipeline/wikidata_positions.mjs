#!/usr/bin/env node
/*
 * wikidata_positions.mjs — Ergänzt das Feld `pos` (TW/ABW/MF/ST) je Spieler in
 * src/players.js aus Wikidata P413. Lässt clubs/nat/t/sl unverändert. Internet
 * nötig. Idempotent.   node data-pipeline/wikidata_positions.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { CLUB_QID, norm } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Stichwort-Mapping eines englischen P413-Labels auf eine Gruppe.
export function posBucket(label) {
  const s = String(label).toLowerCase();
  if (s.includes("goalkeeper")) return "TW";
  if (s.includes("midfield")) return "MF"; // vor "attack", da "attacking midfield" -> MF
  if (s.includes("forward") || s.includes("striker") || s.includes("wing") || s.includes("attack")) return "ST";
  if (s.includes("back") || s.includes("defender") || s.includes("defence") || s.includes("sweeper")) return "ABW";
  return null;
}

// Eindeutige Gruppe bei mehreren Positionen: Priorität TW > ST > MF > ABW.
export function pickBucket(buckets) {
  for (const b of ["TW", "ST", "MF", "ABW"]) if (buckets.has(b)) return b;
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } }); }
    catch (e) { await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch (e) { await sleep(5000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

async function fetchClubPositions(qid) {
  const q = `SELECT ?pLabel ?by ?posLabel WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wdt:P413 ?pos .
    BIND(YEAR(?d) AS ?by)
    ?pos rdfs:label ?posLabel . FILTER(LANG(?posLabel) = "en")
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({
    name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null, pos: b.posLabel?.value,
  }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

async function main() {
  // 1) Positionen aus Wikidata: key "norm|by" -> Set(buckets)
  const idx = new Map();
  for (const [key, qid] of Object.entries(CLUB_QID)) {
    let rows;
    try { rows = await fetchClubPositions(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    let c = 0;
    for (const r of rows) {
      const bucket = posBucket(r.pos || "");
      if (!r.name || !r.by || !bucket) continue;
      const k = norm(r.name) + "|" + r.by;
      if (!idx.has(k)) idx.set(k, new Set());
      idx.get(k).add(bucket); c++;
    }
    console.log(`  ${key} (${qid}): ${rows.length} Zeilen, ${c} Positions-Treffer`);
    await sleep(1000);
  }

  // 2) players.js laden, pos setzen
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  let withPos = 0;
  for (const p of players) {
    const buckets = idx.get(norm(p.n) + "|" + p.by);
    const b = buckets ? pickBucket(buckets) : null;
    if (b) { p.pos = b; withPos++; } else delete p.pos;
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${withPos} Spieler mit Position -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
