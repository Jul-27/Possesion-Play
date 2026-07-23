#!/usr/bin/env node
/*
 * wikidata_player_careers.mjs — setzt zwei neue Felder je Spieler in src/players.js:
 *
 *   lg:   ["LL", …]           alle SPIEL-Ligen, in denen der Spieler war (auch via
 *                             Nicht-Spielvereine, z. B. La Liga über Real Betis)
 *   span: [erstesJahr, letztesJahr]  Karriere-Spanne über ALLE Ligaklub-Stationen
 *                             (letztesJahr 0 = laufend). Nur Ligaklubs zählen —
 *                             Jugend-/Nationalteams (ohne Liga) fallen automatisch raus.
 *
 * Strategie: PRO LIGA aggregieren (nicht pro Geburtsjahr — das sprengt WDQS' 60-s-Limit).
 * Eine Liga-Abfrage ist natürlich begrenzt und schnell (Swiss Super League: 2.629 Spieler
 * in 3,7 s). Sieben Spielligen liefern lg + span-Beiträge; zusätzliche Nicht-Spielligen
 * liefern nur span-Beiträge (ihr Code ist null), damit auch Basel/Genk/… in die Spanne
 * eingehen. Abgleich auf die DB über norm(name)|geburtsjahr.
 *
 *   node data-pipeline/wikidata_player_careers.mjs
 * Idempotent, wiederholbar. Internet nötig. Läuft NACH careers/name_overrides.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm } from "../src/gameData.js";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Spiel-Ligen: liefern lg (Code) UND span. Liga-QID = Klub-P118-Ziel (verifiziert).
const GAME_LEAGUES = [
  ["BL", "Q82595"], ["PL", "Q9448"], ["LL", "Q324867"], ["SA", "Q15804"],
  ["L1", "Q13394"], ["PT", "Q182994"], ["NL", "Q167541"],
];
// Nicht-Spiel-Ligen: nur span (Code null). Auswahl der Ligen, in denen DB-Spieler häufig
// früh/spät aktiv waren. Erweiterbar — fehlt eine Liga, greift für Betroffene der cp-Fallback.
const SPAN_LEAGUES = [
  "Q202699",   // Swiss Super League
  "Q216022",   // Belgian Pro League
  "Q485568",   // Süper Lig (Türkei)
  "Q182165",   // Russian Premier League
  "Q14377162", // Scottish Premiership
  "Q18543",    // Major League Soccer
  "Q206813",   // Brasileirão Série A
  "Q223170",   // Argentine Primera División
  "Q19510",    // EFL Championship
  "Q152665",   // 2. Bundesliga
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } }); }
    catch { await sleep(6000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(10000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; }
    catch { await sleep(6000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

// Je Spieler einer Liga: früheste Station, spätestes ABGESCHLOSSENES Ende, spätester
// Beginn einer OFFENEN Station. Daraus leitet der Aggregator span ab.
async function fetchLeague(qid) {
  const q = `SELECT ?pLabel ?by (MIN(?fy) AS ?first) (MAX(?cy) AS ?lastClosed) (MAX(?oy) AS ?openStart) WHERE {
    ?club wdt:P118 wd:${qid} .
    ?p p:P54 ?st . ?st ps:P54 ?club .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
    ?st pq:P580 ?f . BIND(YEAR(?f) AS ?fy)
    OPTIONAL { ?st pq:P582 ?t }
    BIND(IF(BOUND(?t), YEAR(?t), 0) AS ?cy)
    BIND(IF(BOUND(?t), 0, ?fy) AS ?oy)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } GROUP BY ?pLabel ?by`;
  return (await sparql(q)).map((b) => ({
    key: b.pLabel?.value && b.by?.value ? `${norm(b.pLabel.value)}|${b.by.value}` : null,
    first: +b.first?.value || 0,
    lastClosed: +b.lastClosed?.value || 0,
    openStart: +b.openStart?.value || 0,
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
  // Aggregat je Spielerschlüssel: { lg:Set, first, lastClosed, openStart }
  const agg = new Map();
  const touch = (k) => { if (!agg.has(k)) agg.set(k, { lg: new Set(), first: 0, lastClosed: 0, openStart: 0 }); return agg.get(k); };
  const addSpan = (a, r) => {
    if (r.first) a.first = a.first ? Math.min(a.first, r.first) : r.first;
    if (r.lastClosed > a.lastClosed) a.lastClosed = r.lastClosed;
    if (r.openStart > a.openStart) a.openStart = r.openStart;
  };

  const all = [...GAME_LEAGUES.map(([code, qid]) => ({ code, qid })), ...SPAN_LEAGUES.map((qid) => ({ code: null, qid }))];
  for (const { code, qid } of all) {
    try {
      const rows = await fetchLeague(qid);
      let n = 0;
      for (const r of rows) {
        if (!r.key) continue;
        const a = touch(r.key);
        if (code) a.lg.add(code);
        addSpan(a, r);
        n++;
      }
      console.log(`  ${code || "(span)"} ${qid}: ${rows.length} Zeilen, ${n} übernommen`);
    } catch (e) { console.log(`  ${qid} FEHLER ${e.message}`); }
    await sleep(800);
  }
  console.log(`\nAggregiert: ${agg.size} Spielerschlüssel`);

  // Auf players.js abbilden
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p }));
  let withLg = 0, withSpan = 0;
  for (const p of players) {
    const a = agg.get(norm(p.n) + "|" + p.by);
    if (a && a.lg.size) { p.lg = [...a.lg].sort(); withLg++; } else delete p.lg;

    // span aus cp UND Ligaabfrage vereinigen: cp enthält alle Spielverein-Stationen
    // (auch RB Salzburg = österr. Liga, die wir nicht abfragen, und kuratierte Fälle),
    // die Ligaabfrage ergänzt Stationen bei Nicht-Spielvereinen (Basel …).
    const firsts = [], closedEnds = [], openStarts = [];
    for (const [, f, t] of p.cp || []) { firsts.push(f); if (t === 0) openStarts.push(f); else closedEnds.push(t); }
    if (a && a.first) {
      firsts.push(a.first);
      if (a.lastClosed) closedEnds.push(a.lastClosed);
      if (a.openStart) openStarts.push(a.openStart);
    }
    if (firsts.length) {
      const lastClosed = closedEnds.length ? Math.max(...closedEnds) : 0;
      const openStart = openStarts.length ? Math.max(...openStarts) : 0;
      const last = openStart && openStart >= lastClosed ? 0 : lastClosed;
      // Kein Profi ist vor ~15 aktiv — Akademie-Datierungen (Messi „ab 1995") wegklemmen.
      const first = Math.max(Math.min(...firsts), p.by + 15);
      if (last === 0 || first <= last) { p.span = [first, last]; withSpan++; } else delete p.span;
    } else delete p.span;
  }

  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${withLg} Spieler mit lg, ${withSpan} mit span -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
