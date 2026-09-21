#!/usr/bin/env node
/*
 * career_staerke.mjs — rechnet die Stärke jedes Vereins der Karrierewelt vor.
 *
 *   node data-pipeline/career_staerke.mjs
 *
 * Schreibt src/careerStaerke.js. Läuft in refresh_all.mjs nach jedem Abgleich mit;
 * einzeln braucht man es nur, wenn eine der Eingabedateien von Hand geändert wurde.
 *
 * ── WARUM ES DIESES SKRIPT GIBT ──────────────────────────────────────────────
 * Die Rechnung lief vorher bei jedem Öffnen des Karrieremodus im Browser und
 * kostete 22 Sekunden — siehe src/vereinsStaerke.js. Ihr Ergebnis hängt nur an
 * festen Daten, also wird es hier einmal gerechnet und als Tabelle abgelegt.
 *
 * ── DER FINGERABDRUCK ────────────────────────────────────────────────────────
 * Eine vorberechnete Tabelle kann veralten: Jemand lässt einen einzelnen Schritt
 * des Abgleichs laufen, players.js ändert sich, und die Stärken passen nicht mehr
 * dazu. Deshalb steht in der Datei ein Fingerabdruck aller Eingaben — der Daten UND
 * des Codes, der aus ihnen rechnet. Eine Prüfung vergleicht ihn mit dem aktuellen
 * Stand und schlägt an, sobald eine Eingabe sich geändert hat, ohne dass dieses
 * Skript danach lief.
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");
const ZIEL = join(SRC, "careerStaerke.js");

const { fingerabdruck } = await import(join(HERE, "career_staerke_quelle.mjs"));
const { PLAYERS } = await import(join(SRC, "players.js"));
const { EINSAETZE } = await import(join(SRC, "appearances.js"));
const { WELT_LIGEN, WELT_VEREINE } = await import(join(SRC, "careerWorld.js"));
const { berechneVereinsStaerken } = await import(join(SRC, "vereinsStaerke.js"));

const t = performance.now();
const { staerke, zweiterAnlauf } = berechneVereinsStaerken(PLAYERS, EINSAETZE, WELT_VEREINE, WELT_LIGEN);
const dauer = ((performance.now() - t) / 1000).toFixed(1);

/* Volle Genauigkeit, nicht gerundet: `baueWelt` leitet aus der ungerundeten Zahl die
   Rufstufe ab. Gerundet könnte ein Verein, der genau an einer Grenze liegt, die
   Stufe wechseln — und die Welt sähe anders aus als vorher. */
const zeilen = Object.keys(staerke).sort()
  .map((k) => `  ${JSON.stringify(k)}: ${staerke[k]},`);
const ohne = WELT_VEREINE.filter((v) => !(v.key in staerke)).map((v) => v.key);

const text = `/* Die Stärke jedes Vereins der Karrierewelt — erzeugt von
   data-pipeline/career_staerke.mjs, nicht von Hand ändern.

   Median der Mannschaftsstärke über alle Jahre mit auswertbarem Kader; die
   Rechnung steht in src/vereinsStaerke.js. Warum sie hier als Tabelle liegt und
   nicht mehr im Spiel läuft: siehe dort (22 Sekunden bei jedem Öffnen).

   ${Object.keys(staerke).length} von ${WELT_VEREINE.length} Vereinen haben eine Stärke, ${zweiterAnlauf.length} davon erst
   im zweiten Anlauf (alle erfassten Spieler, fünf je Saison — siehe dort).${ohne.length ? `
   Ohne auswertbaren Kader und damit nicht in der Welt: ${ohne.join(", ")}.` : ""} */

/* Die Vereine aus dem zweiten Anlauf — dünn erfasst, deshalb am unteren Ende. */
export const ZWEITER_ANLAUF = ${JSON.stringify(zweiterAnlauf)};

/* Fingerabdruck der Eingaben. Eine Prüfung vergleicht ihn mit dem aktuellen
   Stand; weicht er ab, ist diese Tabelle veraltet. */
export const STAERKE_QUELLE = ${JSON.stringify(fingerabdruck(), null, 2)};

export const VEREINS_STAERKE = {
${zeilen.join("\n")}
};
`;
writeFileSync(ZIEL, text);
console.log(`careerStaerke.js: ${Object.keys(staerke).length} Vereine in ${dauer} s gerechnet, ${zweiterAnlauf.length} im zweiten Anlauf${ohne.length ? `, ${ohne.length} ohne Kader` : ""}.`);
