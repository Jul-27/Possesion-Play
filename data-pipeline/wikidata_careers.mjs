#!/usr/bin/env node
/*
 * wikidata_careers.mjs — setzt das Feld `cp` (Club-Perioden [[key, von, bis], ...],
 * bis 0 = offen) je Spieler aus Wikidata (P54 mit P580/P582 je Verein).
 * Nur Club-Keys, die bereits in clubs[] stehen. Idempotent. Internet nötig.
 *   node data-pipeline/wikidata_careers.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { CLUB_QID, norm } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    } catch (e) { await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; }
    catch (e) { await sleep(5000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

// Alle P54-Perioden eines Vereins: Spielername, Geburtsjahr, von, bis (0 = offen).
async function fetchClubPeriods(qid) {
  const q = `SELECT ?pLabel ?by ?f ?t WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} ; pq:P580 ?s .
    OPTIONAL { ?st pq:P582 ?e. }
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d .
    BIND(YEAR(?d) AS ?by) BIND(YEAR(?s) AS ?f) BIND(IF(BOUND(?e), YEAR(?e), 0) AS ?t)
    ${LABEL_SERVICE}
  }`;
  return (await sparql(q)).map((b) => ({
    name: cleanName(b.pLabel?.value),
    by: b.by?.value ? parseInt(b.by.value) : null,
    from: b.f?.value ? parseInt(b.f.value) : null,
    to: b.t?.value != null ? parseInt(b.t.value) : 0,
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
  // 1) Perioden je Spieler sammeln: "norm|by" -> [[key, von, bis], ...]
  const per = new Map();
  for (const [key, qid] of Object.entries(CLUB_QID)) {
    let rows;
    try { rows = await fetchClubPeriods(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    let c = 0;
    for (const r of rows) {
      if (!r.name || !r.by || !r.from) continue;
      const k = norm(r.name) + "|" + r.by;
      if (!per.has(k)) per.set(k, []);
      per.get(k).push([key, r.from, r.to]); c++;
    }
    console.log(`  ${key}: ${rows.length} Zeilen, ${c} Perioden`);
    await sleep(900);
  }

  // 2) players.js laden, cp setzen (nur Keys aus clubs[]; sortiert; Duplikate raus)
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  let withCp = 0;
  for (const p of players) {
    const raw = per.get(norm(p.n) + "|" + p.by) || [];
    const own = new Set(p.clubs);
    const seen = new Set();
    const cp = raw
      .filter(([k]) => own.has(k))
      .filter(([k, f, t]) => { const sig = `${k}|${f}|${t}`; if (seen.has(sig)) return false; seen.add(sig); return true; })
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    if (cp.length) { p.cp = cp; withCp++; } else delete p.cp;
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${withCp} Spieler mit cp -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
