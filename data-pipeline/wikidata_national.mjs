#!/usr/bin/env node
/* Importiert Senior-Nationalteam-Kader (P54, Geburtsjahr >= 1970) je Nation aus
   Wikidata und setzt/ergänzt `nat` in src/players.js — auch für Spieler ohne
   erfassten Vereins-Match (füllt Länder-Felder). Additiv, robuste Retries. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Spiel-Code -> Senior-Nationalteam-QID (verifiziert)
export const NAT_TEAM_QID = {
  FRA: "Q47774", GER: "Q43310", ESP: "Q42267", ITA: "Q676899", NED: "Q47050",
  BEL: "Q166776", CRO: "Q134479", ENG: "Q47762", PRT: "Q267245", JPN: "Q170566",
  BRA: "Q83459", ARG: "Q79800", MEX: "Q164089", NGA: "Q181930", CIV: "Q175145",
  SEN: "Q207441", COL: "Q212564", USA: "Q164134", AUT: "Q163534",
};

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 10; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } }); }
    catch (e) { await sleep(15000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(65000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch (e) { await sleep(15000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

async function fetchSquad(qid) {
  const q = `SELECT DISTINCT ?pLabel ?by ?sl WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
    BIND(YEAR(?d) AS ?by)
    FILTER( ?by >= 1970 )
    ${LABEL_SERVICE}
  }`;
  return (await sparql(q)).map((b) => ({
    name: cleanName(b.pLabel?.value), by: b.by?.value ? parseInt(b.by.value) : null,
    sl: b.sl?.value ? parseInt(b.sl.value) : 0,
  }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  if (r.lg && r.lg.length) s += `, "lg": ${JSON.stringify(r.lg)}`;
  if (r.span && r.span.length) s += `, "span": ${JSON.stringify(r.span)}`;
  return s + "}";
}

async function main() {
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
  let added = 0, filled = 0;
  for (const [code, qid] of Object.entries(NAT_TEAM_QID)) {
    let squad;
    try { squad = await fetchSquad(qid); } catch (e) { console.log(`  ${code} FEHLER ${e.message}`); continue; }
    let a = 0, f = 0;
    for (const r of squad) {
      if (!r.name || !r.by) continue;
      const k = norm(r.name) + "|" + r.by;
      const cur = byKey.get(k);
      if (cur) { if (!cur.nat.length) { cur.nat = [code]; f++; } }
      else { const rec = { n: r.name, ln: deriveLastName(r.name), by: r.by, nat: [code], clubs: [], sl: r.sl }; players.push(rec); byKey.set(k, rec); a++; }
    }
    added += a; filled += f;
    console.log(`  ${code} (${qid}): ${squad.length} Kader, ${a} neu, ${f} nat ergänzt`);
    await sleep(1500);
  }
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${added} neue Spieler, ${filled} nat ergänzt -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
