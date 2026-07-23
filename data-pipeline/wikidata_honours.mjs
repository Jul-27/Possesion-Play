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
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";

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

// Kuratierte, vom Owner bestätigte Fakten, die Wikidata (noch) nicht liefert.
// Key: norm(name)|Geburtsjahr -> zusätzliche Honour-Keys (additiv).
export const HONOUR_OVERRIDES = {
  "florian wirtz|2003": ["DFB"],  // DFB-Pokal 2024 mit Leverkusen
  "harry kane|1993": ["DFB"],
  // Bayern-Meister 2020/21 + 2021/22; sein Bayern-Eintrag ist in Wikidata inzwischen
  // verschwunden (nur noch PSG, fälschlich offen), daher greift die Query nicht.
  "tanguy nianzou|2002": ["MBL"],
};

// Saison-Sieger, die Wikidata (noch) nicht als P1346 führt (Owner-bestätigt).
// Honour-Key -> [[Saisonstartjahr, Club-Key], ...]; angewandt über cp-Überlappung
// (gleiche Semantik wie die Wikidata-Query: from <= saison+1 && ende >= saison).
export const GAP_WINNERS = {
  DFB: [[2009, "FCB"], [2011, "BVB"], [2012, "FCB"], [2013, "FCB"],
        [2023, "B04"], [2024, "VFB"], [2025, "FCB"]],
  FAC: [[2003, "MUN"]], // FA Cup 2003/04 — Manchester United (Wikidata-Lücke)
  CDR: [[2024, "BAR"], [2022, "RMA"]], // Copa del Rey 2024/25 (Barça), 2022/23 (Real)
  MBL: [[2022, "FCB"]],                // Bundesliga 2022/23 (Bayern)
};

const gapEnd = (to) => (to === 0 ? 9999 : to);
export function applyGapWinners(players) {
  let added = 0;
  for (const [key, seasons] of Object.entries(GAP_WINNERS)) {
    for (const [year, club] of seasons) {
      for (const p of players) {
        if (!(p.cp || []).some(([k, f, t]) => k === club && f <= year + 1 && gapEnd(t) >= year)) continue;
        const set = new Set(p.t || []);
        if (!set.has(key)) { set.add(key); p.t = [...set].sort(); added++; }
      }
    }
  }
  return added;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    } catch (e) { await sleep(5000); continue; }       // Netzwerkfehler -> retry
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; }
    catch (e) { await sleep(5000); continue; }          // unvollständige/abgeschnittene Antwort -> retry
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

// Zeitfenster (Saison-Startjahr), um zu große WDQS-Antworten zu vermeiden.
const WINDOWS = [[1890, 1960], [1960, 1980], [1980, 1995], [1995, 2005], [2005, 2010],
                 [2010, 2014], [2014, 2018], [2018, 2022], [2022, 2025], [2025, 2031]];

// Spieler, die im Titel-Saison-Zeitraum beim Sieger des Wettbewerbs waren (gefenstert).
async function fetchHonourPlayers(qid) {
  const out = [];
  for (const [from, to] of WINDOWS) {
    const q = `SELECT DISTINCT ?pLabel ?by WHERE {
      ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; (wdt:P580|wdt:P585) ?ss .
      FILTER( YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
      OPTIONAL { ?season wdt:P582 ?se. }
      # Der Saison-Sieger (P1346) ist bei neueren Titeln die „Herrenfußballmannschaft"
      # (eigene Entität), nicht der Verein, dem die Spieler per P54 zugeordnet sind.
      # P831 (Mutterverein) als Zero-or-One-Pfad brückt darauf; bei älteren Saisons ist
      # der Sieger direkt der Verein (kein P831) und ?club = ?winner. Ohne diese Brücke
      # fehlten z. B. die Leverkusen-Meister 2023/24 (Wirtz, Boniface) komplett.
      ?winner wdt:P831? ?club .
      ?p p:P54 ?st . ?st ps:P54 ?club ; pq:P580 ?cs .
      OPTIONAL { ?st pq:P582 ?ce. }
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
      FILTER( YEAR(?cs) <= YEAR(COALESCE(?se, ?ss)) && (!BOUND(?ce) || YEAR(?ce) >= YEAR(?ss)) )
      ${LABEL_SERVICE}
    }`;
    const rows = await sparql(q);
    for (const b of rows) out.push({ name: cleanName(b.pLabel?.value), by: b.by?.value ? parseInt(b.by.value) : null });
    await sleep(700);
  }
  return out;
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`; // pos erhalten (kam nach diesem Skript dazu)
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
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

  // Wikidata-Sieger-Lücken über cp schließen
  console.log(`  GAP_WINNERS: ${applyGapWinners(players)} Zuordnungen`);

  // Kuratierte Overrides additiv anwenden
  for (const p of players) {
    const extra = HONOUR_OVERRIDES[norm(p.n) + "|" + p.by];
    if (extra) p.t = [...new Set([...(p.t || []), ...extra])].sort();
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${withT} Spieler mit Honours -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
