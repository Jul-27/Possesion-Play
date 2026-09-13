#!/usr/bin/env node
/*
 * keine_station_verlieren.mjs — trägt Vereinsstationen, die ein Datenlauf verloren
 * hat, aus dem Stand davor wieder ein. Kein Netz nötig.
 *
 *   node data-pipeline/keine_station_verlieren.mjs .stand-vor-lauf            # anwenden
 *   node data-pipeline/keine_station_verlieren.mjs .stand-vor-lauf --nur-zeigen
 *
 * ── WARUM ES DAS BRAUCHT ────────────────────────────────────────────────────
 * Drei der erzeugten Dateien werden bei jedem Lauf KOMPLETT NEU geschrieben:
 * players.js, careerClubs.js und careerPathClubs.js. Was in Wikidata gerade fehlt,
 * fehlt danach auch bei uns. Und in Wikidata fehlt ständig etwas: De Bruynes
 * Chelsea- und City-Zeiten waren zwischenzeitlich gelöscht, Nianzous Bayern-Zeit
 * ebenso. verify_refresh.mjs MELDET solche Verluste seit je — es verhindert sie
 * aber nicht, und careerClubs.js sieht es überhaupt nicht an.
 *
 * Dieses Skript schliesst die Lücke: Es vereinigt den neuen Stand mit dem alten.
 * Eine Station, die einmal belegt war, bleibt.
 *
 * ── WAS DAS KOSTET ──────────────────────────────────────────────────────────
 * Der Preis ist die Kehrseite: Wird eine FALSCHE Station upstream korrekt
 * entfernt, halten wir sie fest. Dafür gibt es das Gegenstück — WRONG_CLUBS in
 * apply_extra_players.mjs entfernt kuratiert, was wir zu Unrecht führen. Ein
 * gemeldeter Fehler ist billiger zu beheben als eine verschwundene Station, die
 * niemandem auffällt.
 *
 * ── WAS ES NICHT TUT ────────────────────────────────────────────────────────
 * Komplett verschwundene Spieler legt es NICHT wieder an. Ein Spieler verschwindet
 * meist nicht, weil er gelöscht wurde, sondern weil sein Schlüssel sich geändert
 * hat — korrigierter Name, korrigiertes Geburtsjahr. Ihn unter dem alten Schlüssel
 * neu anzulegen erzeugte ein Doppel, und Doppel-Datensätze haben dieses Projekt
 * schon einmal Wochen gekostet. Solche Fälle werden nur gemeldet.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { recToString } from "./player_record.mjs";
import { WRONG_CLUBS } from "./apply_extra_players.mjs";
import { FALSCHE_CAREER_CLUBS } from "./extra_career_clubs.mjs";
import { baueDatei as baueKarussell } from "./wikidata_career_clubs.mjs";
import { baueDatei as bauePfad } from "./wikidata_career_path.mjs";

import { norm as normName } from "../src/gameData.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

const frisch = (p) => import(pathToFileURL(p).href + "?t=" + Date.now());

/* ── Die drei Vereinigungsregeln, ohne Dateien — so sind sie prüfbar ─────────
   Jede bekommt „alt" und „neu" und liefert die Vereinigung plus das, was gefehlt
   hat. Nichts hier liest oder schreibt. */

/** Reine Namensliste (players.clubs): alles behalten, sortiert, ohne Doppel. */
export function vereinigeListe(alt = [], neu = []) {
  const hat = new Set(neu);
  const fehlt = alt.filter((c) => !hat.has(c));
  return { wert: fehlt.length ? [...neu, ...fehlt].sort() : neu, fehlt };
}

/** Tripel [verein, von, bis]: verglichen wird der VEREIN, nicht das ganze Tripel.
    Sonst stünde nach jeder Jahresaktualisierung ["HSV",2022,0] neben
    ["HSV",2022,2026] — derselbe Verein zweimal. Ist er neu dabei, gilt der neue
    Eintrag mit den frischen Jahren; fehlt er ganz, kommt der alte zurück. */
export function vereinigeDatiert(alt = [], neu = []) {
  const drin = new Set(neu.map((e) => e[0]));
  const fehlt = alt.filter((e) => !drin.has(e[0]));
  const wert = fehlt.length
    ? [...neu, ...fehlt].sort((a, b) => (a[1] || 0) - (b[1] || 0) || String(a[0]).localeCompare(String(b[0])))
    : neu;
  return { wert, fehlt };
}


/* ── players.js: clubs und cp ──────────────────────────────────────────────── */
async function players(standDir, anwenden) {
  const vor = await frisch(join(standDir, "players.js"));
  const nach = await frisch(join(SRC, "players.js"));
  const schluessel = (p) => `${p.n}|${p.by}`;
  const nachKey = new Map(nach.PLAYERS.map((p) => [schluessel(p), p]));

  const bericht = { clubs: [], cp: [], fehlendeSpieler: [] };
  for (const alt of vor.PLAYERS) {
    const neu = nachKey.get(schluessel(alt));
    if (!neu) { bericht.fehlendeSpieler.push(`${alt.n} (${alt.by}, sl ${alt.sl || 0})`); continue; }

    /* WAS KURATIERT ENTFERNT WURDE, BLEIBT ENTFERNT. Sonst hebt dieses Skript jede
       Korrektur wieder auf: WRONG_CLUBS streicht einen Verein, den wir zu Unrecht
       führen — und die Vereinigung mit dem Stand davor holte ihn zurück. Der Lauf
       liefe dann jedes Mal gegen sich selbst. */
    const falsch = new Set(WRONG_CLUBS[`${normName(alt.n)}|${alt.by}`] || []);
    const altClubs = (alt.clubs || []).filter((c) => !falsch.has(c));
    const altCp = (alt.cp || []).filter((e) => !falsch.has(e[0]));

    const c = vereinigeListe(altClubs, neu.clubs);
    if (c.fehlt.length) { neu.clubs = c.wert; bericht.clubs.push(`${alt.n}: ${c.fehlt.join(", ")}`); }

    const cp = vereinigeDatiert(altCp, neu.cp);
    if (cp.fehlt.length) { neu.cp = cp.wert; bericht.cp.push(`${alt.n}: ${cp.fehlt.map((e) => e[0]).join(", ")}`); }
  }

  if (anwenden && (bericht.clubs.length || bericht.cp.length)) {
    const kopf = readFileSync(join(SRC, "players.js"), "utf8").split("export const PLAYERS")[0];
    writeFileSync(join(SRC, "players.js"),
      `${kopf}export const PLAYERS = [\n${nach.PLAYERS.map((p) => "  " + recToString(p)).join(",\n")}\n];\n`);
  }
  return bericht;
}

/* ── careerClubs.js: die vollen Stationen fürs Karussell ───────────────────── */
async function karussell(standDir, anwenden) {
  const vor = await frisch(join(standDir, "careerClubs.js"));
  const nach = await frisch(join(SRC, "careerClubs.js"));
  const namenVon = (mod, feld) => (key) => (mod[feld][key] || []).map((i) => mod.CAREER_CLUBS[i]);
  const altNamen = namenVon(vor, "CAREER_BY_KEY");
  const neuNamen = namenVon(nach, "CAREER_BY_KEY");

  const proSpieler = new Map();
  for (const key of Object.keys(nach.CAREER_BY_KEY)) proSpieler.set(key, new Set(neuNamen(key)));

  /* Auch hier gilt: Was kuratiert widerlegt ist, kommt nicht zurück. Salihović
     stand im Karussell bei Inter Mailand, wo er nie gespielt hat; ohne diese Zeile
     holte die Vereinigung ihn aus dem Stand davor wieder herein. */
  const widerlegt = new Map(FALSCHE_CAREER_CLUBS.map((f) => [`${normName(f.n)}|${f.by}`, new Set(f.clubs)]));

  const bericht = [];
  for (const key of Object.keys(vor.CAREER_BY_KEY)) {
    const weg = widerlegt.get(key);
    const alt = altNamen(key).filter((n) => !weg || !weg.has(n));
    if (!alt.length) continue;
    const { wert, fehlt } = vereinigeListe(alt, [...(proSpieler.get(key) || [])]);
    if (!fehlt.length) continue;
    proSpieler.set(key, new Set(wert));
    bericht.push(`${key}: ${fehlt.join(", ")}`);
  }

  if (anwenden && bericht.length) {
    const vereine = [...new Set([...proSpieler.values()].flatMap((s) => [...s]))].sort();
    writeFileSync(join(SRC, "careerClubs.js"), baueKarussell(vereine, proSpieler));
  }
  return bericht;
}

/* ── careerPathClubs.js: datierte Stationen für den Karriere-Pfad ──────────── */
async function pfad(standDir, anwenden) {
  const datei = join(standDir, "careerPathClubs.js");
  if (!existsSync(datei)) return [];
  const vor = await frisch(datei);
  const nach = await frisch(join(SRC, "careerPathClubs.js"));
  const auf = (mod) => (key) => (mod.CAREER_PATH_BY_KEY[key] || []).map(([i, von, bis]) => [mod.CAREER_PATH_CLUBS[i], von, bis]);
  const altAuf = auf(vor), neuAuf = auf(nach);

  const proSpieler = new Map();
  for (const key of Object.keys(nach.CAREER_PATH_BY_KEY)) proSpieler.set(key, neuAuf(key));

  const bericht = [];
  for (const key of Object.keys(vor.CAREER_PATH_BY_KEY)) {
    const alt = altAuf(key);
    if (!alt.length) continue;
    const { wert, fehlt } = vereinigeDatiert(alt, proSpieler.get(key) || []);
    if (!fehlt.length) continue;
    proSpieler.set(key, wert);
    bericht.push(`${key}: ${fehlt.map((e) => e[0]).join(", ")}`);
  }

  if (anwenden && bericht.length) {
    const vereine = [...new Set([...proSpieler.values()].flat().map((e) => e[0]))].sort();
    writeFileSync(join(SRC, "careerPathClubs.js"), bauePfad(vereine, proSpieler));
  }
  return bericht;
}

const zeige = (titel, zeilen, grenze = 12) => {
  console.log(`\n${titel}: ${zeilen.length}`);
  for (const z of zeilen.slice(0, grenze)) console.log("  " + z);
  if (zeilen.length > grenze) console.log(`  … und ${zeilen.length - grenze} weitere`);
};

async function main() {
  const args = process.argv.slice(2);
  const standDir = resolve(args.find((a) => !a.startsWith("--")) || ".stand-vor-lauf");
  const anwenden = !args.includes("--nur-zeigen");
  if (!existsSync(join(standDir, "players.js"))) {
    console.error(`Kein Vergleichsstand unter ${standDir} — erwartet players.js, careerClubs.js, careerPathClubs.js.`);
    process.exit(2);
  }
  console.log(`Vergleichsstand: ${standDir}${anwenden ? "" : "  (nur zeigen)"}`);

  const p = await players(standDir, anwenden);
  zeige("players.js — clubs zurückgeholt", p.clubs);
  zeige("players.js — cp zurückgeholt", p.cp);
  zeige("players.js — Spieler ohne Entsprechung (NICHT angelegt)", p.fehlendeSpieler);
  zeige("careerClubs.js — Stationen zurückgeholt", await karussell(standDir, anwenden));
  zeige("careerPathClubs.js — Stationen zurückgeholt", await pfad(standDir, anwenden));
  console.log(anwenden ? "\nGeschrieben." : "\nNichts geschrieben.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
