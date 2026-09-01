#!/usr/bin/env node
/*
 * wikidata_league_squads.mjs — holt die Kader ALLER Ligavereine seit 2010/11 und
 * schreibt sie als datierte Stationen (`cp`) nach src/players.js.
 * Internet nötig. Idempotent.
 *
 *   node data-pipeline/wikidata_league_squads.mjs
 *   node data-pipeline/wikidata_league_squads.mjs --probe        # nichts schreiben
 *   node data-pipeline/wikidata_league_squads.mjs --nur BL       # eine Liga
 *
 * WOFÜR: src/leagueClubs.js kennt 108 Vereine, players.js aber nur die Karrieren bei
 * den 47 Spielvereinen. Ohne diesen Lauf hätte die Bundesliga 2025/26 zwar die
 * richtigen achtzehn Namen, aber Heidenheim, Union Berlin und St. Pauli stünden
 * ohne einen einzigen Spieler da.
 *
 * ── WAS GESCHRIEBEN WIRD UND WAS NICHT ──────────────────────────────────────
 * Nur `cp` — die datierten Stationen. NICHT `clubs`: Das Feld führt die 47
 * Spielvereine, die Hexfelder und Wappen tragen, und die neuen Vereine sind
 * ausdrücklich keine. Ein Eintrag dort würde Hexbretter, Raster und
 * Transferkarussell verändern, ohne dass jemand darum gebeten hätte.
 *
 * ── WER NEU ANGELEGT WIRD ───────────────────────────────────────────────────
 * Vorhandene Spieler bekommen ihre neuen Stationen IMMER. Neu angelegt wird nur, wer
 * mindestens NEU_SL_MIN Wikipedia-Sprachversionen hat. Grund: Der Draft zieht erst
 * ab DRAFT_SL_MIN = 25, und die Kaderstärke rechnet mit den besten elf. Ein
 * Ergänzungsspieler mit vier Sprachversionen brächte weder dem einen noch dem
 * anderen etwas und stünde nur in jeder Namensvervollständigung im Weg.
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { norm } from "../src/gameData.js";
import { LIGA_VEREINE } from "../src/leagueClubs.js";
import { CLUB_QID } from "./wikidata_roster.mjs";
import { posBucket, pickBucket } from "./wikidata_positions.mjs";
import { recToString } from "./player_record.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const AB_JAHR = 2010;      // Stationen, die davor endeten, interessieren nicht
export const NEU_SL_MIN = 20;     // knapp unter DRAFT_SL_MIN, damit Luft bleibt
export const JETZT = 2026;

async function sparql(query) {
  for (let a = 0; a < 5; a++) {
    let res;
    try {
      res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/sparql-query; charset=utf-8" },
        body: query,
      });
    } catch { await sleep(8000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(20000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch { await sleep(8000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

/* Eine Zeile je Station, nicht je Spieler: Ein Rückkehrer hat zwei Zeiträume beim
   selben Verein, und beide gehören nach `cp`. Positionen und Nationalität kommen
   mit, damit für neue Spieler kein zweiter Lauf nötig ist. */
const abfrage = (qid) => `SELECT ?pLabel ?by ?sl ?von ?bis ?posLabel ?natLabel WHERE {
  ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
  ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
  OPTIONAL { ?st pq:P580 ?von }
  OPTIONAL { ?st pq:P582 ?bis }
  OPTIONAL { ?p wdt:P413 ?pos }
  OPTIONAL { ?p wdt:P1532 ?nat }
  BIND(YEAR(?d) AS ?by)
  /* „de,en" und nicht nur „en": Zum Zeitpunkt des Laufs trugen Wayne Rooney, Juan
     Mata und Pierre-Emerick Aubameyang vandalierte ENGLISCHE Labels („El Perrito de
     la C", „Juan Mata Pata", „Pierre Cardin picha grande") und wurden dadurch als
     drei neue Spieler angelegt. Die deutschen Labels waren sauber. */
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}`;

const jahrVon = (v) => (v ? new Date(v).getFullYear() : null);

/**
 * Zeilen einer Vereinsabfrage zu Stationen verdichten.
 *
 * Eine Station ohne Anfangsjahr ist unbrauchbar — `cp` verlangt einen Zeitraum, und
 * ohne ihn könnte weder eine Ziehung noch das Mitspielernetz etwas damit anfangen.
 */
export function verdichte(zeilen, clubKey, ziel = new Map(), abJahr = AB_JAHR, jetzt = JETZT) {
  for (const b of zeilen) {
    const name = b.pLabel?.value;
    const by = b.by?.value ? parseInt(b.by.value, 10) : null;
    if (!name || !by || /^Q\d+$/.test(name)) continue;
    const von = jahrVon(b.von?.value);
    if (!von) continue;
    /* `bis` fehlt bei laufenden Verträgen — 0 ist die Schreibweise in `cp`. */
    const bis = jahrVon(b.bis?.value) ?? 0;
    if (bis !== 0 && bis < abJahr) continue;
    /* Offensichtlicher Datenmüll: Stationen, die vor der Geburt beginnen oder in
       der Zukunft enden. */
    if (von < by + 14 || von > jetzt + 1 || (bis !== 0 && bis < von)) continue;

    const k = norm(name) + "|" + by;
    let e = ziel.get(k);
    if (!e) { e = { name, by, sl: 0, pos: new Set(), nat: new Set(), cp: new Map() }; ziel.set(k, e); }
    const sl = b.sl?.value ? parseInt(b.sl.value, 10) : 0;
    if (sl > e.sl) e.sl = sl;
    const bucket = b.posLabel?.value ? posBucket(b.posLabel.value) : null;
    if (bucket) e.pos.add(bucket);
    if (b.natLabel?.value && !/^Q\d+$/.test(b.natLabel.value)) e.nat.add(b.natLabel.value);
    /* Dieselbe Station kommt durch Position und Nationalität mehrfach zurück —
       über den Zeitraum entdoppeln. */
    e.cp.set(`${clubKey}|${von}|${bis}`, [clubKey, von, bis]);
  }
  return ziel;
}

/** Stationen zusammenführen: gleiche Vereine mit überlappenden Zeiträumen verschmelzen. */
export function mischeStationen(alt = [], neu = []) {
  const proClub = new Map();
  for (const [c, von, bis] of [...alt, ...neu]) {
    if (!proClub.has(c)) proClub.set(c, []);
    proClub.get(c).push([von, bis]);
  }
  const out = [];
  for (const [c, zeiten] of proClub) {
    zeiten.sort((a, b) => a[0] - b[0]);
    let [von, bis] = zeiten[0];
    for (let i = 1; i < zeiten.length; i++) {
      const [v2, b2] = zeiten[i];
      const ende = bis === 0 ? JETZT : bis;
      /* Ein Jahr Abstand gilt noch als dieselbe Station: Wikidata und Wikipedia
         setzen Wechseldaten oft um ein Jahr versetzt an. */
      if (v2 <= ende + 1) { bis = bis === 0 || b2 === 0 ? 0 : Math.max(bis, b2); }
      else { out.push([c, von, bis]); [von, bis] = [v2, b2]; }
    }
    out.push([c, von, bis]);
  }
  return out.sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0])));
}

async function main() {
  const probe = process.argv.includes("--probe");
  const nurIdx = process.argv.indexOf("--nur");
  const nurLiga = nurIdx > 0 ? process.argv[nurIdx + 1] : null;

  const vereine = Object.entries(LIGA_VEREINE)
    .filter(([lg]) => !nurLiga || lg === nurLiga)
    .flatMap(([, v]) => v);
  /* Ein Verein kann in zwei Ligen stehen (Auf- und Abstieg über Landesgrenzen gibt
     es nicht, aber derselbe Schlüssel taucht durch die Auflösung doppelt auf). */
  const eindeutig = [...new Map(vereine.map((v) => [v.key, v])).values()];
  console.log(`${eindeutig.length} Vereine abzufragen`);

  const gesammelt = new Map();
  for (let i = 0; i < eindeutig.length; i++) {
    const v = eindeutig[i];
    let zeilen;
    try { zeilen = await sparql(abfrage(v.qid)); }
    catch (e) { console.log(`  ${v.key}: übersprungen (${e.message})`); continue; }
    const vorher = gesammelt.size;
    verdichte(zeilen, v.key, gesammelt);
    console.log(`  ${v.key.padEnd(5)} ${v.name.padEnd(28)} ${String(zeilen.length).padStart(5)} Zeilen · ${gesammelt.size - vorher} neue Spieler   (${i + 1}/${eindeutig.length})`);
    await sleep(1300);
  }

  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const alle = mod.PLAYERS.map((p) => ({ ...p }));
  const nachKey = new Map(alle.map((p) => [norm(p.n) + "|" + p.by, p]));

  let neu = 0, ergaenzt = 0, stationen = 0, verworfen = 0;
  for (const [k, e] of gesammelt) {
    const cpNeu = [...e.cp.values()];
    const vorhanden = nachKey.get(k);
    if (vorhanden) {
      const vorher = (vorhanden.cp || []).length;
      vorhanden.cp = mischeStationen(vorhanden.cp || [], cpNeu);
      if (vorhanden.cp.length !== vorher) ergaenzt++;
      stationen += cpNeu.length;
      if (!vorhanden.sl || e.sl > vorhanden.sl) vorhanden.sl = e.sl;
      if (!vorhanden.pos) vorhanden.pos = pickBucket(e.pos);
    } else if (e.sl >= NEU_SL_MIN) {
      const rec = {
        n: e.name,
        ln: e.name.split(" ").slice(-1)[0],
        by: e.by,
        nat: [],
        /* LEER, und das mit Absicht: `clubs` führt die 47 Spielvereine. */
        clubs: [],
        sl: e.sl,
        pos: pickBucket(e.pos),
        cp: mischeStationen([], cpNeu),
      };
      alle.push(rec);
      nachKey.set(k, rec);
      neu++; stationen += cpNeu.length;
    } else verworfen++;
  }

  console.log(`\n${gesammelt.size} Spieler in den Kadern · ${neu} neu angelegt · ${ergaenzt} ergänzt · ${verworfen} zu unbekannt (unter ${NEU_SL_MIN} Sprachversionen)`);
  console.log(`${stationen} Stationen · Bestand jetzt ${alle.length} Spieler`);
  if (probe) return;

  alle.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + alle.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  console.log(`geschrieben: src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
