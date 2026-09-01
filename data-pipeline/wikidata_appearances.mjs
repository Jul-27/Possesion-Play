#!/usr/bin/env node
/*
 * wikidata_appearances.mjs — holt die EINSÄTZE je Spieler und Spielverein und
 * schreibt src/appearances.js. Internet nötig. Idempotent.
 *
 *   node data-pipeline/wikidata_appearances.mjs
 *   node data-pipeline/wikidata_appearances.mjs --probe     # nichts schreiben
 *
 * WARUM ES DIESE ZAHL BRAUCHT
 *
 * Die Klasse eines Spielers kam bis dahin allein aus `sl`, der Zahl der
 * Wikipedia-Sprachversionen. Das misst LEBENSRUHM, und der ist karriereweit und
 * global. Zwei Verzerrungen folgen daraus zwangsläufig, und die zweite behebt genau
 * diese Datei:
 *
 *   Mesut Özil stand als bester MITTELFELDSPIELER DER BUNDESLIGA auf 96 — mit
 *   101 Bundesligaspielen für Schalke und Bremen als Heranwachsender. Sein Ruhm
 *   stammt von Real Madrid und Arsenal. Zum Vergleich, gemessen:
 *
 *     Müller 503 · Kahn 429 · Lahm 386 · Lewandowski 384 · Klose 183
 *     Özil 101 · James Rodríguez 77 · Raúl 66
 *
 * Die Einsatzzahl weiß, was jemand BEI DIESEM VEREIN war. Sie ist außerdem nicht
 * positionsverzerrt: Ein Torwart spielt so viele Spiele wie ein Stürmer.
 *
 * WAS SIE NICHT IST: ein Gütemaß. Ein Stammspieler in Freiburg hat dieselben 34
 * Spiele wie ein Stammspieler in München. Deshalb ersetzt sie die Bekanntheit
 * nicht, sondern gewichtet sie — Bekanntheit bleibt die Güte-Achse, der Einsatz
 * wird die Zugehörigkeits-Achse.
 *
 * ABDECKUNG: gemessen 57 bis 67 % der Stationen an Großvereinen (Bayern 578 von
 * 862, United 878 von 1308, Real 505 von 882). Ältere Spieler fehlen häufiger —
 * Lothar Matthäus trägt bei keiner seiner Stationen eine Einsatzzahl. Eine fehlende
 * Zahl MUSS deshalb neutral wirken und darf nie wie „null Spiele" zählen; darauf
 * verlässt sich src/draft.js.
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { norm } from "../src/gameData.js";
import { CLUB_QID } from "./wikidata_roster.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const OUT_PATH = join(HERE, "..", "src", "appearances.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  for (let a = 0; a < 5; a++) {
    let res;
    try {
      res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        /* charset=utf-8 ist zwingend — ohne die Angabe liest WDQS den Body nicht als
           UTF-8 und jeder Name mit Sonderzeichen findet nichts. */
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

/* Abgefragt wird VEREINSWEISE, nicht über Spielernamen. Wir haben für alle 47
   Spielvereine die QID, und damit ist die Zuordnung eindeutig — der Namensweg
   müsste über Labels und Aliasse raten und träfe Doppelnamen falsch. */
const abfrage = (qid) => `SELECT ?pLabel ?by ?sp ?tore WHERE {
  ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
  ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d .
  ?st pq:P1350 ?sp .
  OPTIONAL { ?st pq:P1351 ?tore }
  BIND(YEAR(?d) AS ?by)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}`;

const schluessel = (n, by) => norm(n) + "|" + by;

export function baueEintraege(zeilen, clubKey, bekannt, ziel) {
  let getroffen = 0;
  for (const b of zeilen) {
    const name = b.pLabel?.value;
    const by = b.by?.value ? parseInt(b.by.value, 10) : null;
    const sp = b.sp?.value ? parseInt(b.sp.value, 10) : null;
    if (!name || !by || !Number.isFinite(sp) || sp <= 0) continue;
    /* Namen, die Wikidata nicht auflösen konnte, kommen als „Q12345" zurück. */
    if (/^Q\d+$/.test(name)) continue;
    const k = schluessel(name, by);
    if (!bekannt.has(k)) continue;
    if (!ziel[k]) ziel[k] = {};
    /* Zwei Stationen beim selben Verein (Rückkehrer) werden addiert — genau wie
       `cp` dort zwei Zeiträume führt, deren Jahre wir später ebenfalls summieren. */
    ziel[k][clubKey] = (ziel[k][clubKey] || 0) + sp;
    const tore = b.tore?.value ? parseInt(b.tore.value, 10) : null;
    if (Number.isFinite(tore) && tore > 0) {
      if (!ziel[k].__tore) ziel[k].__tore = {};
      ziel[k].__tore[clubKey] = (ziel[k].__tore[clubKey] || 0) + tore;
    }
    getroffen++;
  }
  return getroffen;
}

async function main() {
  const probe = process.argv.includes("--probe");
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  /* Nur Spieler mit `cp` sind überhaupt ziehbar — für alle anderen wäre die Zahl
     totes Gewicht in einer Datei, die der Browser lädt. */
  const bekannt = new Set(mod.PLAYERS.filter((p) => p.cp?.length).map((p) => schluessel(p.n, p.by)));
  /* Geschrieben wird nur, wer auch gezogen werden kann — dieselbe Schwelle wie
     DRAFT_SL_MIN in src/draft.js. Abgefragt wird trotzdem breiter, weil die Grenze
     sich verschieben kann und ein zweiter Wikidata-Lauf teuer ist. */
  const ziehbar = new Set(mod.PLAYERS.filter((p) => p.cp?.length && (p.sl || 0) >= 25).map((p) => schluessel(p.n, p.by)));
  console.log(`${bekannt.size} Spieler mit Vereinsstationen, davon ${ziehbar.size} ziehbar`);

  const daten = {};
  const keys = Object.keys(CLUB_QID);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let zeilen;
    try { zeilen = await sparql(abfrage(CLUB_QID[key])); }
    catch (e) { console.log(`  ${key}: übersprungen (${e.message})`); continue; }
    const n = baueEintraege(zeilen, key, bekannt, daten);
    console.log(`  ${key.padEnd(4)} ${String(zeilen.length).padStart(5)} Stationen mit Einsätzen · ${n} davon in unserem Bestand   (${i + 1}/${keys.length})`);
    await sleep(1200);
  }

  const spieler = Object.keys(daten).length;
  const stationen = Object.values(daten).reduce((a, o) => a + Object.keys(o).filter((k) => k !== "__tore").length, 0);
  console.log(`\n${spieler} Spieler · ${stationen} Stationen mit Einsatzzahl (${Math.round((spieler / bekannt.size) * 100)} % des Bestands)`);
  if (probe) return;
  schreibe(daten, ziehbar);
}

/**
 * Schreibt src/appearances.js.
 *
 * Nur Spieler, die auch GEZOGEN werden können — das sind 3.617 von 15.725. Die
 * übrigen zwölftausend sind zu unbekannt für den Draft und wären totes Gewicht in
 * einer Datei, die der Browser lädt: 215 KB statt 767 KB.
 *
 * Als eigene Funktion, damit sich die Datei aus schon geholten Daten neu schreiben
 * lässt, ohne Wikidata ein zweites Mal zu belasten.
 */
export function schreibe(daten, ziehbar, pfad = OUT_PATH) {
  const keys = Object.keys(daten).filter((k) => !ziehbar || ziehbar.has(k)).sort();
  /* Tore stehen unter __tore, damit die Vereinsschlüssel oben flach bleiben und ein
     Zugriff EINSAETZE[key]?.FCB ohne Zwischenebene funktioniert. */
  const zeilen = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(daten[k])},`);
  writeFileSync(pfad, `/* Einsätze (und Tore) je Spieler und Spielverein, aus Wikidata (P1350/P1351).
   Erzeugt von data-pipeline/wikidata_appearances.mjs — nicht von Hand ändern.

   Schlüssel ist norm(name)|geburtsjahr wie überall im Projekt. Unter __tore stehen
   die Tore derselben Stationen. FEHLENDE EINTRÄGE SIND NORMAL: Wikidata führt die
   Zahl nur bei 69 % der Stationen, bei älteren Spielern seltener — Lothar Matthäus
   und Xavi tragen gar keine. Wer fehlt, muss neutral behandelt werden, nie wie null
   Spiele; darauf verlässt sich src/draft.js. */
export const EINSAETZE = {
${zeilen.join("\n")}
};
`);
  console.log(`geschrieben: ${pfad} (${keys.length} Spieler)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
