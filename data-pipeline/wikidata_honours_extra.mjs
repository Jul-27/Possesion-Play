#!/usr/bin/env node
/*
 * wikidata_honours_extra.mjs — ergänzt das Feld `t` in src/players.js ADDITIV um:
 *   BDO Ballon d'Or (P166 direkt am Spieler)
 *   EM  Europameister, CA Copa-América-Sieger, EL Europa-League-Sieger
 *       (Turnier-/Saison-Sieger P1346 × P54-Mitgliedszeitraum, wie WM/CL im
 *        Basis-Skript wikidata_honours.mjs)
 * Merge: t = union(bestehend, neu); pos/sl bleiben erhalten. Internet nötig.
 *   node data-pipeline/wikidata_honours_extra.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Erwartete QIDs + engl. Labels — werden VOR dem Lauf verifiziert (Abbruch bei Abweichung).
const EXPECT = {
  EM:  { qid: "Q260858", label: "UEFA European Championship" },
  CA:  { qid: "Q178750", label: "Copa América" },
  EL:  { qid: "Q18760",  label: "UEFA Europa League" },
  BDO: { qid: "Q166177", label: "Ballon d'Or" },
};

export function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

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

async function verifyQids() {
  console.log("QID-Verifikation:");
  for (const [key, { qid, label }] of Object.entries(EXPECT)) {
    const rows = await sparql(`SELECT ?l WHERE { wd:${qid} rdfs:label ?l . FILTER(LANG(?l)="en") }`);
    const got = rows[0]?.l?.value || "";
    console.log(`  ${key} ${qid}: "${got}"`);
    if (norm(got) !== norm(label)) throw new Error(`QID-Check ${key}: erwartet "${label}", bekommen "${got}"`);
    await sleep(500);
  }
}

// Zeitfenster (Saison-/Turnier-Startjahr) gegen zu große WDQS-Antworten.
const WINDOWS = [[1890, 1960], [1960, 1980], [1980, 1995], [1995, 2005], [2005, 2010],
                 [2010, 2014], [2014, 2018], [2018, 2022], [2022, 2025], [2025, 2031]];

// Spieler, die im Titel-Zeitraum beim Sieger des Wettbewerbs waren (gefenstert).
async function fetchHonourPlayers(qid) {
  const out = [];
  for (const [from, to] of WINDOWS) {
    const q = `SELECT DISTINCT ?pLabel ?by WHERE {
      ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; wdt:P580 ?ss .
      FILTER( YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
      OPTIONAL { ?season wdt:P582 ?se. }
      ?p p:P54 ?st . ?st ps:P54 ?winner ; pq:P580 ?cs .
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

// Individueller Award (Ballon d'Or): P166 direkt am Spieler, keine Fensterung nötig.
async function fetchAwardPlayers(qid) {
  const q = `SELECT DISTINCT ?pLabel ?by WHERE {
    ?p wdt:P166 wd:${qid} ; wdt:P106 wd:Q937857 ; wdt:P569 ?d .
    BIND(YEAR(?d) AS ?by)
    ${LABEL_SERVICE}
  }`;
  const rows = await sparql(q);
  return rows.map((b) => ({ name: cleanName(b.pLabel?.value), by: b.by?.value ? parseInt(b.by.value) : null }));
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
  await verifyQids();

  // 1) Neue Honours je Spieler sammeln: "norm|by" -> Set(keys)
  const hon = new Map();
  const add = (rows, key) => {
    let c = 0;
    for (const r of rows) {
      if (!r.name || !r.by) continue;
      const k = norm(r.name) + "|" + r.by;
      if (!hon.has(k)) hon.set(k, new Set());
      hon.get(k).add(key); c++;
    }
    return c;
  };
  for (const key of ["EM", "CA", "EL"]) {
    const rows = await fetchHonourPlayers(EXPECT[key].qid);
    console.log(`  ${key}: ${rows.length} Zeilen, ${add(rows, key)} Zuordnungen`);
    await sleep(1300);
  }
  {
    const rows = await fetchAwardPlayers(EXPECT.BDO.qid);
    console.log(`  BDO: ${rows.length} Zeilen, ${add(rows, "BDO")} Zuordnungen`);
  }

  // 2) players.js laden, t ADDITIV mergen (pos/sl unangetastet)
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const counts = { BDO: 0, EM: 0, CA: 0, EL: 0 };
  let touched = 0;
  for (const p of players) {
    const extra = hon.get(norm(p.n) + "|" + p.by);
    if (!extra || !extra.size) continue;
    const t = new Set(p.t || []);
    const before = t.size;
    for (const k of extra) { if (!t.has(k)) counts[k] = (counts[k] || 0) + 1; t.add(k); }
    if (t.size > before) touched++;
    p.t = [...t].sort();
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${touched} Spieler ergänzt`, counts, "-> src/players.js");
  // Stichproben zur Plausibilität
  for (const key of ["BDO", "EM", "CA", "EL"]) {
    const sample = players.filter((p) => (p.t || []).includes(key)).sort((a, b) => (b.sl || 0) - (a.sl || 0)).slice(0, 5).map((p) => p.n);
    console.log(`  ${key}-Beispiele:`, sample.join(", "));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
