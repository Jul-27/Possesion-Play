#!/usr/bin/env node
/* Zieht den Italienischen Meister (MSA, Serie A Q15804) gezielt nach: feine
   Fenster + geduldige Retries (Serie A ist die größte Liga → sonst Timeout).
   Additiv auf src/players.js (Match über norm(name)|by). Kein anderes Feld angetastet. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const QID = "Q15804"; // Serie A
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 10; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    } catch (e) { await sleep(15000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(65000); continue; } // Outage/Rate-Limit aussitzen
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; }
    catch (e) { await sleep(15000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

// Feine 4-Jahres-Fenster ab 1929 (Serie-A-Beginn im heutigen Format)
const WINDOWS = [];
for (let y = 1929; y < 2028; y += 4) WINDOWS.push([y, y + 4]);

async function fetchWinners() {
  const out = [];
  for (const [from, to] of WINDOWS) {
    const q = `SELECT DISTINCT ?pLabel ?by WHERE {
      ?season wdt:P3450 wd:${QID} ; wdt:P1346 ?winner ; (wdt:P580|wdt:P585) ?ss .
      FILTER( YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
      OPTIONAL { ?season wdt:P582 ?se. }
      ?p p:P54 ?st . ?st ps:P54 ?winner ; pq:P580 ?cs .
      OPTIONAL { ?st pq:P582 ?ce. }
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
      FILTER( YEAR(?cs) <= YEAR(COALESCE(?se, ?ss)) && (!BOUND(?ce) || YEAR(?ce) >= YEAR(?ss)) )
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
    const rows = await sparql(q);
    for (const b of rows) if (b.pLabel?.value && b.by?.value) out.push(norm(b.pLabel.value) + "|" + b.by.value);
    console.log(`  ${from}-${to}: ${rows.length} Zeilen`);
    await sleep(1200);
  }
  return new Set(out);
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

const winners = await fetchWinners();
const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
const players = mod.PLAYERS.map((p) => ({ ...p }));
let hits = 0;
for (const p of players) {
  if (!winners.has(norm(p.n) + "|" + p.by)) continue;
  const t = new Set(p.t || []);
  if (!t.has("MSA")) { t.add("MSA"); hits++; }
  p.t = [...t].sort();
}
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampDataInfo();
console.log(`Fertig: ${hits} Spieler mit MSA ergänzt.`);
