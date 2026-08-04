#!/usr/bin/env node
/*
 * add_clubs.mjs — trägt einen oder mehrere Spielvereine additiv in src/players.js
 * ein: Verein in clubs[], Zeiträume in cp[], Nationalität, neue Spieler anlegen.
 * Vorhandene Felder anderer Vereine bleiben unangetastet.
 *
 *   node data-pipeline/add_clubs.mjs S04 HSV M05 SCF TSG
 *   node data-pipeline/add_clubs.mjs            # alle Schlüssel aus CLUB_QID
 *
 * Unterschied zum alten add_salzburg.mjs: das Startdatum (pq:P580) ist OPTIONAL.
 * Bei Salzburg führen 76 von 436 Spielern gar kein Datum an ihrem P54-Statement —
 * die Pflichtangabe hat sie stillschweigend aus dem Kader geworfen. Ohne Datum
 * gibt es eben nur den Vereinsbezug und keinen cp-Eintrag; das HEX-Vereinsfeld
 * prüft ohnehin nur clubs[]. Geraten wird nichts.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { CLUB_QID, NATION_QID, norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const GAME_BY_QID = Object.fromEntries(Object.entries(NATION_QID).map(([g, q]) => [q, g]));
const qidOf = (uri) => (uri ? uri.split("/").pop() : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 10; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } }); }
    catch { await sleep(15000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(65000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch { await sleep(15000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

export function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  if (r.lg && r.lg.length) s += `, "lg": ${JSON.stringify(r.lg)}`;
  if (r.span && r.span.length) s += `, "span": ${JSON.stringify(r.span)}`;
  return s + "}";
}

/* Kader eines Vereins. ?s/?e sind OPTIONAL — ein Spieler ohne Datumsangabe soll
   trotzdem als Vereinsspieler zählen. */
const rosterQuery = (qid) => `SELECT ?pLabel ?by ?sl ?snat ?cnat ?f ?t WHERE {
  ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
  OPTIONAL { ?st pq:P580 ?s. }
  OPTIONAL { ?st pq:P582 ?e. }
  ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
  BIND(YEAR(?d) AS ?by)
  BIND(IF(BOUND(?s), YEAR(?s), 0) AS ?f)
  BIND(IF(BOUND(?e), YEAR(?e), 0) AS ?t)
  OPTIONAL { ?p wdt:P1532 ?snat. }
  OPTIONAL { ?p wdt:P27 ?cnat. }
  ${LABEL_SERVICE}
}`;

// Zeilen -> Map("norm(name)|by" -> { name, by, sl, nat, periods })
export function aggregate(rows) {
  const agg = new Map();
  for (const b of rows) {
    const name = cleanName(b.pLabel?.value);
    const by = b.by?.value ? parseInt(b.by.value) : null;
    if (!name || !by) continue;
    const k = norm(name) + "|" + by;
    let e = agg.get(k);
    if (!e) { e = { name, by, sl: 0, nat: null, periods: [] }; agg.set(k, e); }
    e.sl = Math.max(e.sl, b.sl?.value ? parseInt(b.sl.value) : 0);
    const nat = GAME_BY_QID[qidOf(b.snat?.value)] || GAME_BY_QID[qidOf(b.cnat?.value)];
    if (!e.nat && nat) e.nat = nat;
    const f = b.f?.value ? parseInt(b.f.value) : 0;
    const t = b.t?.value != null ? parseInt(b.t.value) : 0;
    if (f) e.periods.push([f, t]);   // ohne Startjahr kein cp-Eintrag
  }
  return agg;
}

// cp-Einträge eines Vereins, dedupliziert und nach Startjahr sortiert.
export function periodsToCp(key, periods) {
  const seen = new Set();
  return periods
    .filter(([f, t]) => { const s = `${f}|${t}`; if (seen.has(s)) return false; seen.add(s); return true; })
    .map(([f, t]) => [key, f, t])
    .sort((a, b) => a[1] - b[1]);
}

/* Einen aggregierten Kader in die Spielerliste einarbeiten. Rein funktional,
   damit die Zusammenführung ohne Netz testbar bleibt. */
export function mergeClub(players, key, agg) {
  const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
  let added = 0, enriched = 0, cpAdded = 0;
  for (const [k, e] of agg) {
    const cp = periodsToCp(key, e.periods);
    const cur = byKey.get(k);
    if (cur) {
      if (!cur.clubs.includes(key)) { cur.clubs = [...new Set([...cur.clubs, key])].sort(); enriched++; }
      if (cp.length) {
        cur.cp = [...(cur.cp || []).filter((x) => x[0] !== key), ...cp]
          .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
        cpAdded += cp.length;
      }
      if (!(cur.nat || []).length && e.nat) cur.nat = [e.nat];
    } else {
      const rec = { n: e.name, ln: deriveLastName(e.name), by: e.by, nat: e.nat ? [e.nat] : [], clubs: [key], sl: e.sl };
      if (cp.length) { rec.cp = cp; cpAdded += cp.length; }
      players.push(rec);
      byKey.set(k, rec);
      added++;
    }
  }
  return { added, enriched, cpAdded };
}

async function main() {
  const keys = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const todo = keys.length ? keys : Object.keys(CLUB_QID);
  const unknown = todo.filter((k) => !CLUB_QID[k]);
  if (unknown.length) { console.error(`Unbekannte Vereinsschlüssel: ${unknown.join(", ")}`); process.exit(2); }

  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const vorher = players.length;

  for (const key of todo) {
    const rows = await sparql(rosterQuery(CLUB_QID[key]));
    const agg = aggregate(rows);
    const { added, enriched, cpAdded } = mergeClub(players, key, agg);
    console.log(`  ${key} (${CLUB_QID[key]}): ${rows.length} Zeilen, ${agg.size} Spieler -> ${enriched} ergänzt, ${added} neu, ${cpAdded} cp`);
    await sleep(1500);
  }

  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${vorher} -> ${players.length} Spieler in src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
