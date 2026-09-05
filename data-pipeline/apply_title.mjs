#!/usr/bin/env node
/*
 * apply_title.mjs — zieht EINEN Wettbewerbstitel gezielt nach, mit feinen Fenstern
 * und geduldigen Retries. Additiv auf src/players.js, kein anderes Feld angetastet.
 *
 *   node data-pipeline/apply_title.mjs MBL          # Deutscher Meister
 *   node data-pipeline/apply_title.mjs MSA --ab 1929 --fenster 4
 *
 * Warum getrennt von wikidata_honours.mjs: dessen Fenster sind grob (bis zu 10
 * Jahre). Bei den großen Ligen kippt die Abfrage darin ins Timeout — die Serie A
 * schon länger, die Bundesliga seit Schalke, HSV, Mainz, Freiburg und Hoffenheim
 * dazugekommen sind (deutlich mehr Spieler-Vereins-Paare je Saison). Ein
 * gescheitertes Fenster verliert im Gesamtlauf still alle Titel dieses Zeitraums;
 * hier bricht der Lauf stattdessen hörbar ab.
 *
 * Löst apply_msa.mjs ab: identische Logik, aber mit der P831-Brücke (Saison-Sieger
 * ist bei neueren Titeln die „Herrenfußballmannschaft", nicht der Verein) — ohne die
 * fehlten z. B. die Leverkusen-Meister 2024.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { COMP_QID, ZEITFILTER, START_GENAUIGKEIT } from "./wikidata_honours.mjs";
import { norm } from "./wikidata_roster.mjs";
import { recToString } from "./add_clubs.mjs";
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
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

export function windows(from, span, bis = new Date().getFullYear() + 2) {
  const out = [];
  for (let y = from; y < bis; y += span) out.push([y, y + span]);
  return out;
}

const titleQuery = (qid, from, to) => `SELECT DISTINCT ?pLabel ?by WHERE {
  ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; (wdt:P580|wdt:P585) ?ss .
  FILTER( YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
  OPTIONAL { ?season wdt:P582 ?se. }
  ?winner wdt:P831? ?club .
  ?p p:P54 ?st . ?st ps:P54 ?club .
  ${START_GENAUIGKEIT}
  # „UNBEKANNTER WERT" IST KEIN DATUM. Wikidata kennt neben „kein Wert" auch
  # „unbekannter Wert"; der kommt als anonymer Knoten zurück — die Variable ist
  # also GEBUNDEN, aber YEAR() scheitert daran, der Filter wird falsch und die
  # ganze Zeile fällt weg. Der Spieler verlor damit JEDEN Titel dieses Vereins.
  # Gemessen: 50 Stationen betroffen — Rüdiger bei Real (La Liga fehlte), Gnabry
  # bei Bayern (eine Meisterschaft statt sieben, Champions League gar nicht),
  # Andrich bei Leverkusen. Geprüft an La Liga 2020–2026: 194 Spieler ohne, 198
  # mit der Korrektur. Die Prüfung steht im ÄUSSEREN Filter und nicht im
  # OPTIONAL: Dort kostete es so viel, dass WDQS in den Zeitausfall lief.
  OPTIONAL { ?st pq:P582 ?ce. }
  ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
  ${ZEITFILTER}
  ${LABEL_SERVICE}
}`;

async function main() {
  const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def; };
  const key = process.argv.slice(2).find((a) => !a.startsWith("--") && isNaN(Number(a)));
  if (!key || !COMP_QID[key]) {
    console.error(`Aufruf: node data-pipeline/apply_title.mjs <KEY> [--ab 1903] [--fenster 4]\nBekannte Keys: ${Object.keys(COMP_QID).join(", ")}`);
    process.exit(2);
  }
  const qid = COMP_QID[key];
  const wins = windows(arg("ab", 1903), arg("fenster", 4));
  console.log(`${key} (${qid}): ${wins.length} Fenster à ${arg("fenster", 4)} Jahre`);

  const treffer = new Set();
  for (const [from, to] of wins) {
    const rows = await sparql(titleQuery(qid, from, to));
    for (const b of rows) {
      const name = cleanName(b.pLabel?.value);
      if (name && b.by?.value) treffer.add(norm(name) + "|" + b.by.value);
    }
    if (rows.length) console.log(`  ${from}-${to}: ${rows.length} Zeilen`);
    await sleep(1200);
  }
  console.log(`Zuordnungen gesamt: ${treffer.size}`);

  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  let n = 0;
  for (const p of players) {
    if (!treffer.has(norm(p.n) + "|" + p.by)) continue;
    if ((p.t || []).includes(key)) continue;
    p.t = [...new Set([...(p.t || []), key])].sort();
    n++;
  }

  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  console.log(`Fertig: ${n} Spieler haben ${key} dazubekommen.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
