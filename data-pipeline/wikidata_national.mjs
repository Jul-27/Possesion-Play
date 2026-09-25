#!/usr/bin/env node
/* Importiert Senior-Nationalteam-Kader (P54) je Nation aus Wikidata und ergänzt `nat`
   in src/players.js — auch für Spieler ohne erfassten Vereins-Match (füllt
   Länder-Felder). Additiv, robuste Retries.

   ── WAS SICH AM 25.09.2026 GEÄNDERT HAT ─────────────────────────────────────
   · 39 statt 19 Nationen. Gemessen: 13.239 Spieler standen ohne Nationalität da,
     darunter Ibrahimović, Suárez, Lewandowski, Salah, Haaland und Bale — ihre Länder
     gab es im Spiel schlicht nicht.
   · Die Nation des A-Nationalteams wird ERGÄNZT, nicht nur in leere Felder gesetzt.
     Wer für die Türkei spielt, aber aus der Staatsangehörigkeit „GER" mitbrachte,
     bekam „TUR" bisher nie — bei der Türkei 27 von 79 Treffern.
   · Abgleich über englisches UND deutsches Label. Nur über das englische entstanden
     Dubletten, sobald unser Datensatz die deutsche Schreibweise trug.
   · Nationen für alle Jahrgänge; NEUE Datensätze weiter nur ab Jahrgang 1970 — sonst
     kämen Tausende Spieler aus dem 19. Jahrhundert ohne einen einzigen Verein dazu. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";
import { recToString } from "./player_record.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Spiel-Code -> Senior-Nationalteam-QID. Die ersten 19 verifiziert seit Juni 2026;
   die 20 neuen am 25.09.2026 über dieselbe Klasse wie Frankreich/Deutschland
   (P31 Q135408445, P2094 Q31930761) abgefragt und am Label geprüft. Aufgenommen
   wurde jede Nation mit mindestens 30 bekannten Spielern (sl ≥ 30) im Bestand — die
   schwächste bisherige, die Elfenbeinküste, hat 48. */
export const NAT_TEAM_QID = {
  FRA: "Q47774", GER: "Q43310", ESP: "Q42267", ITA: "Q676899", NED: "Q47050",
  BEL: "Q166776", CRO: "Q134479", ENG: "Q47762", PRT: "Q267245", JPN: "Q170566",
  BRA: "Q83459", ARG: "Q79800", MEX: "Q164089", NGA: "Q181930", CIV: "Q175145",
  SEN: "Q207441", COL: "Q212564", USA: "Q164134", AUT: "Q163534",
  URU: "Q134916", SRB: "Q182740", SUI: "Q165141", DEN: "Q131785", SWE: "Q160826",
  CZE: "Q483868", POL: "Q166196", AUS: "Q268208", IRL: "Q163547", MAR: "Q207337",
  GHA: "Q172014", WAL: "Q180857", TUR: "Q483856", RUS: "Q726080", UKR: "Q170403",
  CMR: "Q175309", GRE: "Q134925", SCO: "Q34044", KOR: "Q543842", NOR: "Q184387",
};

/* Neue Datensätze nur ab diesem Jahrgang (siehe oben). */
export const NEU_AB = 1970;

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
  const q = `SELECT DISTINCT ?pLabel ?de ?by ?sl WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
    BIND(YEAR(?d) AS ?by)
    OPTIONAL { ?p rdfs:label ?de . FILTER(LANG(?de) = "de") }
    ${LABEL_SERVICE}
  }`;
  return (await sparql(q)).map((b) => ({
    name: cleanName(b.pLabel?.value), de: cleanName(b.de?.value),
    by: b.by?.value ? parseInt(b.by.value) : null, sl: b.sl?.value ? parseInt(b.sl.value) : 0,
  }));
}

/**
 * Ordnet einen Kader zu: bekannte Spieler (über englisches oder deutsches Label)
 * bekommen den Code dazu, unbekannte ab NEU_AB werden angelegt. `byKey` wird
 * fortgeschrieben. Gibt { ergaenzt, neu } zurück.
 */
export function ordneKaderZu(players, byKey, code, squad) {
  let ergaenzt = 0, neu = 0;
  for (const r of squad) {
    if (!r.name || !r.by) continue;
    const cur = [r.name, r.de].filter(Boolean).map((n) => byKey.get(norm(n) + "|" + r.by)).find(Boolean);
    if (cur) {
      if (!cur.nat.includes(code)) { cur.nat = [...cur.nat, code]; ergaenzt++; }
    } else if (r.by >= NEU_AB) {
      const rec = { n: r.name, ln: deriveLastName(r.name), by: r.by, nat: [code], clubs: [], sl: r.sl };
      players.push(rec);
      byKey.set(norm(r.name) + "|" + r.by, rec);
      neu++;
    }
  }
  return { ergaenzt, neu };
}

async function main() {
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
  let added = 0, filled = 0;
  for (const [code, qid] of Object.entries(NAT_TEAM_QID)) {
    let squad;
    try { squad = await fetchSquad(qid); } catch (e) { console.log(`  ${code} FEHLER ${e.message}`); continue; }
    const { ergaenzt, neu } = ordneKaderZu(players, byKey, code, squad);
    added += neu; filled += ergaenzt;
    console.log(`  ${code} (${qid}): ${squad.length} Kader, ${neu} neu, ${ergaenzt} nat ergänzt`);
    await sleep(1500);
  }
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${added} neue Spieler, ${filled} nat ergänzt -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
