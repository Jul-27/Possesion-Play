#!/usr/bin/env node
/*
 * backfill_positions.mjs — füllt `pos` bei allen Spielern, die nach
 * wikidata_positions.mjs noch keine Position haben. Internet nötig. Idempotent.
 *
 *   node data-pipeline/backfill_positions.mjs [--limit 200] [--min-sl 0]
 *
 * Warum es diesen zweiten Lauf gibt: wikidata_positions.mjs holt P413 über die
 * Kader der 42 Spielvereine und der Nationalteams. Wer dort durchfällt, bekommt
 * keine Position — und durchfallen kann man auf zwei Wegen, die beide vorkommen:
 *   1. Der P54-Link zum Spielverein ist in Wikidata gelöscht (Vandalismus).
 *   2. Das Geburtsjahr weicht ab. Michael Owen steht in Wikidata mit 1976 im
 *      Liverpool-Kader, bei uns (korrekt) mit 1979 — der Schlüssel norm|by trifft nie.
 * Von 62 Spielern mit sl >= 20 ohne Position hatten 31 sehr wohl ein P413.
 *
 * Dieser Lauf geht deshalb NICHT über Kader, sondern löst pro Spieler die QID über
 * die Suche auf und liest P413 direkt. Ein Treffer zählt nur, wenn Beruf
 * (P106=Q937857) UND Geburtsjahr exakt passen — lieber keine Position als eine
 * fremde. Wen Wikidata gar nicht kennt, deckt POSITION_OVERRIDES ab.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm } from "./wikidata_roster.mjs";
import { posBucket, pickBucket } from "./wikidata_positions.mjs";
import { POSITION_OVERRIDES } from "./position_overrides.mjs";
import { stampDataInfo, stampFixes } from "./stamp.mjs";
import { recToString } from "./add_clubs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
/* Trefferliste der Suche. Verifiziert wird ohnehin über Beruf + Geburtsjahr, breiter
   suchen kostet also nur SPARQL-Zeilen, keine Genauigkeit. Bei häufigen Namen
   (mehrere „Rodrigo", „Diego") steht der gesuchte Spieler selten auf Platz 1. */
const CANDS_PER_NAME = 5;
const CHUNK = 400;          // QIDs je SPARQL-Abfrage
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = "https://www.wikidata.org/w/api.php?format=json&" + new URLSearchParams(params);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA } }); }
    catch { await sleep(3000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(10000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  throw new Error("Wikidata-API fehlgeschlagen (Retries erschöpft)");
}

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } }); }
    catch { await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(15000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch { await sleep(5000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

/* Positionen der Kandidaten-QIDs, gefiltert auf Fußballspieler mit Geburtsjahr.
   Rückgabe: Map(QID -> { by, labels: [engl. P413-Label, …] }). */
async function fetchPositions(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += CHUNK) {
    const chunk = qids.slice(i, i + CHUNK);
    const rows = await sparql(`SELECT ?p ?by ?posLabel WHERE {
      VALUES ?p { ${chunk.map((q) => "wd:" + q).join(" ")} }
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wdt:P413 ?pos .
      BIND(YEAR(?d) AS ?by)
      ?pos rdfs:label ?posLabel . FILTER(LANG(?posLabel) = "en")
    }`);
    for (const b of rows) {
      const qid = b.p.value.split("/").pop();
      let e = out.get(qid);
      if (!e) { e = { by: b.by?.value ? parseInt(b.by.value) : null, labels: [] }; out.set(qid, e); }
      if (b.posLabel?.value) e.labels.push(b.posLabel.value);
    }
    console.log(`  Positionen ${Math.min(i + CHUNK, qids.length)}/${qids.length} …`);
    await sleep(1200);
  }
  return out;
}

async function main() {
  const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def; };
  const MIN_SL = arg("min-sl", 0);
  const LIMIT = arg("limit", Infinity);

  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));

  const offen = players.filter((p) => !p.pos && (p.sl || 0) >= MIN_SL).slice(0, LIMIT);
  console.log(`Ohne Position: ${players.filter((p) => !p.pos).length}, davon in diesem Lauf: ${offen.length}`);

  // 1) Kandidaten-QIDs je Spieler über die Namenssuche
  const cands = new Map();     // "norm|by" -> [qid, …]
  const alleQids = new Set();
  for (let i = 0; i < offen.length; i++) {
    const p = offen[i];
    let ids = [];
    try {
      const s = await api({ action: "wbsearchentities", search: p.n, language: "de", uselang: "de", type: "item", limit: CANDS_PER_NAME });
      ids = (s.search || []).map((x) => x.id);
    } catch (e) { console.log(`  Suche fehlgeschlagen: ${p.n} (${e.message})`); }
    if (ids.length) {
      cands.set(norm(p.n) + "|" + p.by, ids);
      for (const id of ids) alleQids.add(id);
    }
    if ((i + 1) % 250 === 0) console.log(`  Suche ${i + 1}/${offen.length} …`);
    await sleep(110);
  }
  console.log(`Kandidaten: ${alleQids.size} QIDs für ${cands.size} Spieler`);

  // 2) Positionen dieser QIDs in einem Rutsch
  const posByQid = await fetchPositions([...alleQids]);

  // 3) Zuordnen — nur bei exakt passendem Geburtsjahr
  let gesetzt = 0, keinTreffer = 0, jahrDaneben = 0;
  const beispiele = [];
  for (const p of offen) {
    const ids = cands.get(norm(p.n) + "|" + p.by) || [];
    let bucket = null, jahrGesehen = false;
    for (const id of ids) {
      const e = posByQid.get(id);
      if (!e) continue;
      jahrGesehen = true;
      if (e.by !== p.by) continue;
      const buckets = new Set(e.labels.map(posBucket).filter(Boolean));
      bucket = pickBucket(buckets);
      if (bucket) break;
    }
    if (bucket) {
      p.pos = bucket; gesetzt++;
      if (beispiele.length < 12 && (p.sl || 0) >= 20) beispiele.push(`${p.n} (${p.by}, sl ${p.sl}) -> ${bucket}`);
    } else if (jahrGesehen) jahrDaneben++;
    else keinTreffer++;
  }

  // 4) Kuratierte Overrides für alle, die Wikidata nicht führt
  let ausOverride = 0;
  for (const p of players) {
    if (p.pos) continue;
    const o = POSITION_OVERRIDES[norm(p.n) + "|" + p.by];
    if (o) { p.pos = o; ausOverride++; }
  }

  console.log(`\n  aus Wikidata gesetzt: ${gesetzt}`);
  console.log(`  aus Overrides:        ${ausOverride}`);
  console.log(`  Kandidat ohne P413:   ${keinTreffer}`);
  console.log(`  Geburtsjahr abweichend/ohne Treffer: ${jahrDaneben}`);
  if (beispiele.length) console.log("\nBeispiele (bekannte Spieler):\n  " + beispiele.join("\n  "));

  /* Was danach noch offen ist, kann nur kuratiert werden. Diese Liste ist die
     Vorlage für POSITION_OVERRIDES — und zwar erst NACH Bestätigung, nicht geraten. */
  const offenBekannt = players.filter((p) => !p.pos && (p.sl || 0) >= 20).sort((a, b) => (b.sl || 0) - (a.sl || 0));
  if (offenBekannt.length) {
    console.log(`\nWeiter ohne Position, sl >= 20 (${offenBekannt.length}) — Kandidaten für position_overrides.mjs:`);
    for (const p of offenBekannt.slice(0, 40)) console.log(`  "${norm(p.n)}|${p.by}": "",   // ${p.n} (sl ${p.sl}, ${(p.clubs || []).join("/") || "kein Spielverein"})`);
  }

  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  if (ausOverride) stampFixes();
  console.log(`\nFertig: ${players.filter((p) => p.pos).length}/${players.length} Spieler mit Position -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
