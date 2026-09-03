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
import { recToString } from "./player_record.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Honour-Key -> Wikidata-Wettbewerb (verifiziert: Label + vorhandene Saison-Sieger)
export const COMP_QID = {
  CL:"Q18756", WM:"Q19317",
  MBL:"Q82595", MPL:"Q9448", MLL:"Q324867", MSA:"Q15804", ML1:"Q13394",
  DFB:"Q150880", FAC:"Q11151", CDR:"Q483794", CIT:"Q169918",
};

/* Buchstaben, die lateinisch AUSSEHEN, aber griechisch oder kyrillisch sind. Sie
   kommen in Wikidata-Labels vor — teils Tippfehler, teils Vandalismus — und machen
   einen Namen für jeden Vergleich unauffindbar.

   GEMESSEN: Arda Gülers englisches Label begann mit einem griechischen Alpha
   („Αrda Güler", U+0391). Der Schlüssel „αrda guler" traf unseren „arda guler"
   nicht, und er verlor Meisterschaft und Champions League — obwohl beide Seiten
   auf dem Bildschirm identisch aussehen. */
const HOMOGLYPHEN = {
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0396": "Z", "\u0397": "H",
  "\u0399": "I", "\u039A": "K", "\u039C": "M", "\u039D": "N", "\u039F": "O",
  "\u03A1": "P", "\u03A4": "T", "\u03A5": "Y", "\u03A7": "X", "\u03BF": "o",
  "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041A": "K", "\u041C": "M",
  "\u041D": "H", "\u041E": "O", "\u0420": "P", "\u0421": "C", "\u0422": "T",
  "\u0423": "Y", "\u0425": "X", "\u0430": "a", "\u0435": "e", "\u043E": "o",
  "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x",
};

export function norm(s) {
  return String(s)
    /* Geschützte und schmale Leerzeichen zuerst — zwei unserer eigenen Namen tragen
       sie, und „Ezequiel\u00A0Fernández" ist sonst ein anderer Name als der mit
       gewöhnlichem Leerzeichen. */
    .replace(/[\u00A0\u2007\u202F\u200B-\u200D]/g, " ")
    .replace(/[\u0391-\u03BF\u0410-\u0445]/g, (c) => HOMOGLYPHEN[c] || c)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
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

/* Zeitfenster (Saison-Startjahr), um zu große WDQS-Antworten zu vermeiden.
   Früher waren das bis zu 70 Jahre breite Blöcke. Die kippen inzwischen zuverlässig
   ins Timeout — gemessen am 03.08.2026: von fünf Wettbewerben scheiterten vier,
   dasselbe Fenster in 4-Jahres-Schritten antwortet dagegen mit 200. Ursache ist die
   gewachsene Datenmenge (mit Schalke, HSV, Mainz, Freiburg und Hoffenheim allein
   ~1300 Spieler mehr). Feiner = mehr Abfragen, aber sie kommen durch. */
export const WINDOWS = [];
for (let y = 1890; y < 2032; y += 4) WINDOWS.push([y, y + 4]);

// Spieler, die im Titel-Saison-Zeitraum beim Sieger des Wettbewerbs waren (gefenstert).
async function fetchHonourPlayers(qid) {
  const out = [];
  for (const [from, to] of WINDOWS) {
    const q = `SELECT DISTINCT ?pLabel ?deLabel ?by WHERE {
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
      # ZWEI LABEL STATT EINEM. Wir gleichen über Namen ab, und die ENGLISCHEN Labels
      # werden in Wikidata regelmäßig manipuliert: André Onana hieß dort „Andrcu
      # Onana", Wayne Rooney „El Perrito de la C", Juan Mata „Juan Mata Pata". Wer so
      # umbenannt ist, findet keinen Anschluss an unseren Bestand und verliert JEDEN
      # Titel. Das deutsche Label war in allen beobachteten Fällen sauber, also zählt
      # ein Treffer auf einer der beiden Schreibweisen.
      OPTIONAL { ?p rdfs:label ?deLabel . FILTER(LANG(?deLabel) = "de") }
      FILTER( YEAR(?cs) <= YEAR(COALESCE(?se, ?ss)) && (!BOUND(?ce) || !isLiteral(?ce) || YEAR(?ce) >= YEAR(?ss)) )
      ${LABEL_SERVICE}
    }`;
    const rows = await sparql(q);
    for (const b of rows) {
      out.push({
        name: cleanName(b.pLabel?.value),
        deName: cleanName(b.deLabel?.value),
        by: b.by?.value ? parseInt(b.by.value) : null,
      });
    }
    await sleep(700);
  }
  return out;
}

async function main() {
  // 1) Honours pro Spieler aus Wikidata: key "norm|by" -> Set(honourKeys)
  const hon = new Map();
  for (const [key, qid] of Object.entries(COMP_QID)) {
    /* Kein `continue` im Fehlerfall: ohne --additiv setzt dieser Lauf `t` neu, und
       ein übersprungener Wettbewerb löschte dann jeden Titel dieser Art bei jedem
       Spieler — still und großflächig. Lieber abbrechen und den alten Stand behalten. */
    let rows;
    try { rows = await fetchHonourPlayers(qid); }
    catch (e) { throw new Error(`${key} (${qid}) fehlgeschlagen: ${e.message} — Abbruch, damit kein Titel verloren geht.`); }
    let c = 0;
    for (const r of rows) {
      if (!r.by) continue;
      /* Beide Schreibweisen eintragen: Der Bestand kennt den Spieler unter einer von
         beiden, und welche das ist, wissen wir hier nicht. */
      for (const n of new Set([r.name, r.deName].filter(Boolean))) {
        const k = norm(n) + "|" + r.by;
        if (!hon.has(k)) hon.set(k, new Set());
        hon.get(k).add(key);
      }
      if (r.name || r.deName) c++;
    }
    console.log(`  ${key} (${qid}): ${rows.length} Zeilen, ${c} Zuordnungen`);
    await sleep(1300);
  }

  // 2) players.js laden, t neu setzen
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  /* --additiv: bereits eingetragene Titel bleiben stehen, es kommen nur welche dazu.
     Wikidata wird aktiv vandaliert — ein neu setzender Lauf hätte hier schon einmal
     38 real gewonnene Titel bei 20 Spielern still gelöscht. Wenn der Lauf nur dazu
     dient, neu aufgenommene Spieler zu versorgen, ist additiv die richtige Wahl. */
  const additiv = process.argv.includes("--additiv");
  console.log(additiv ? "  Modus: additiv (vorhandene t bleiben erhalten)" : "  Modus: t wird neu gesetzt");
  let withT = 0;
  for (const p of players) {
    const keys = hon.get(norm(p.n) + "|" + p.by);
    if (keys && keys.size) { p.t = [...new Set([...(additiv ? p.t || [] : []), ...keys])].sort(); withT++; }
    else if (!additiv) delete p.t;
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
