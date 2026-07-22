#!/usr/bin/env node
/* Trägt FC Red Bull Salzburg (RBS, Q994811) in src/players.js ein: RBS in clubs,
   cp-Zeiträume, Nationalität (via NATION_QID), neue Spieler anlegen. Additiv.
   Robuste Retries (Wikidata-Störung). */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { NATION_QID, norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const QID = "Q994811";
const GAME_BY_QID = Object.fromEntries(Object.entries(NATION_QID).map(([g, q]) => [q, g]));
const qidOf = (uri) => (uri ? uri.split("/").pop() : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

const q = `SELECT ?pLabel ?by ?sl ?snat ?cnat ?f ?t WHERE {
  ?p p:P54 ?st . ?st ps:P54 wd:${QID} ; pq:P580 ?s . OPTIONAL { ?st pq:P582 ?e. }
  ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
  BIND(YEAR(?d) AS ?by) BIND(YEAR(?s) AS ?f) BIND(IF(BOUND(?e), YEAR(?e), 0) AS ?t)
  OPTIONAL { ?p wdt:P1532 ?snat. }
  OPTIONAL { ?p wdt:P27 ?cnat. }
  ${LABEL_SERVICE}
}`;

const rows = await sparql(q);
console.log(`Salzburg-Zeilen: ${rows.length}`);
const agg = new Map();
for (const b of rows) {
  const name = cleanName(b.pLabel?.value), by = b.by?.value ? parseInt(b.by.value) : null;
  if (!name || !by) continue;
  const k = norm(name) + "|" + by;
  let e = agg.get(k);
  if (!e) { e = { name, by, sl: 0, nat: null, periods: [] }; agg.set(k, e); }
  e.sl = Math.max(e.sl, b.sl?.value ? parseInt(b.sl.value) : 0);
  const nat = GAME_BY_QID[qidOf(b.snat?.value)] || GAME_BY_QID[qidOf(b.cnat?.value)];
  if (!e.nat && nat) e.nat = nat;
  const f = b.f?.value ? parseInt(b.f.value) : null;
  const t = b.t?.value != null ? parseInt(b.t.value) : 0;
  if (f) e.periods.push([f, t]);
}

const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
const players = mod.PLAYERS.map((p) => ({ ...p }));
const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
let added = 0, enriched = 0;
for (const [k, e] of agg) {
  const seen = new Set();
  const cp = e.periods
    .filter(([f, t]) => { const s = `RBS|${f}|${t}`; if (seen.has(s)) return false; seen.add(s); return true; })
    .map(([f, t]) => ["RBS", f, t]).sort((a, b) => a[1] - b[1]);
  const cur = byKey.get(k);
  if (cur) {
    if (!cur.clubs.includes("RBS")) { cur.clubs = [...new Set([...cur.clubs, "RBS"])].sort(); enriched++; }
    cur.cp = [...(cur.cp || []).filter((x) => x[0] !== "RBS"), ...cp].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    if (!(cur.nat || []).length && e.nat) cur.nat = [e.nat];
  } else {
    players.push({ n: e.name, ln: deriveLastName(e.name), by: e.by, nat: e.nat ? [e.nat] : [], clubs: ["RBS"], sl: e.sl, cp });
    added++;
  }
}
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampDataInfo();
console.log(`Fertig: ${enriched} ergänzt, ${added} neu -> src/players.js`);
