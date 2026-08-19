#!/usr/bin/env node
/*
 * apply_extra_career_clubs.mjs — kuratierte Karrierestationen additiv in
 * src/careerClubs.js. Kein Netz. Idempotent.
 *
 *   node data-pipeline/apply_extra_career_clubs.mjs
 *   node data-pipeline/apply_extra_career_clubs.mjs --probe   # nur zeigen
 *
 * Läuft in refresh_all NACH wikidata_career_clubs.mjs: das Skript schreibt die Datei
 * jedes Mal neu, kuratierte Einträge wären sonst nach jedem Lauf wieder weg — genau
 * der Fehler, der apply_extra_players lange aus der Kette fehlen ließ.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm } from "../src/gameData.js";
import { EXTRA_CAREER_CLUBS } from "./extra_career_clubs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PFAD = join(HERE, "..", "src", "careerClubs.js");

/** Kuratierte Stationen in die vorhandenen Karten einarbeiten. Rein, damit testbar. */
export function applyExtraCareerClubs(clubs, byKey, extras = EXTRA_CAREER_CLUBS) {
  const neueClubs = [...clubs];
  const idxVon = new Map(neueClubs.map((n, i) => [n, i]));
  const neueKarte = { ...byKey };
  const bericht = { ergaenzt: 0, schonDa: 0, neueVereine: [], spieler: [] };

  for (const e of extras) {
    const key = norm(e.n) + "|" + e.by;
    const vorher = new Set(neueKarte[key] || []);
    const dazu = [];
    for (const name of e.clubs) {
      let i = idxVon.get(name);
      if (i === undefined) {
        // Verein bislang unbekannt — anhängen statt still zu verwerfen.
        i = neueClubs.push(name) - 1;
        idxVon.set(name, i);
        bericht.neueVereine.push(name);
      }
      if (vorher.has(i)) { bericht.schonDa++; continue; }
      vorher.add(i); dazu.push(name); bericht.ergaenzt++;
    }
    if (!dazu.length) continue;
    neueKarte[key] = [...vorher].sort((a, b) => a - b);
    bericht.spieler.push({ key, name: e.n, dazu });
  }
  return { clubs: neueClubs, byKey: neueKarte, bericht };
}

/* Datei in derselben Form schreiben, die wikidata_career_clubs.mjs erzeugt.
   Die Sortierung MUSS localeCompare sein wie dort — mit der Standardsortierung
   (Code-Punkte) wandern 343 Zeilen, obwohl sich inhaltlich fünf ändern, und ein
   verrauschter Diff verdeckt beim nächsten Mal die echten Änderungen. */
export function baueDatei(clubs, byKey) {
  const zeilen = Object.keys(byKey).sort((a, b) => a.localeCompare(b))
    .map((k) => `  ${JSON.stringify(k)}: [${byKey[k].join(",")}]`);
  return `// GENERIERT von data-pipeline/wikidata_career_clubs.mjs. Nicht von Hand editieren.
/* Vollständige Vereinsstationen je Spieler — die Grundlage für „Transferkarussell".
   Getrennt von players.js und bewusst NICHT im Hauptbundle: die Datei wird erst
   geladen, wenn das Karussell startet.

   CAREER_CLUBS  Namensliste aller Vereine
   CAREER_BY_KEY "norm(name)|geburtsjahr" -> Indizes in CAREER_CLUBS

   Nationalmannschaften, Zweitmannschaften und Frauenteams sind ausgeschlossen.
   Kuratierte Nachträge kommen aus extra_career_clubs.mjs (apply_extra_career_clubs.mjs). */
export const CAREER_CLUBS = ${JSON.stringify(clubs)};

export const CAREER_BY_KEY = {
${zeilen.join(",\n")}
};
`;
}

async function main() {
  const probe = process.argv.includes("--probe");
  const mod = await import(pathToFileURL(PFAD).href + "?t=" + Date.now());
  const { clubs, byKey, bericht } = applyExtraCareerClubs(mod.CAREER_CLUBS, mod.CAREER_BY_KEY);

  console.log(`${EXTRA_CAREER_CLUBS.length} kuratierte Spieler · ${bericht.ergaenzt} Station(en) ergänzt`
    + `, ${bericht.schonDa} schon vorhanden`);
  for (const s of bericht.spieler) console.log(`  + ${s.name}: ${s.dazu.join(", ")}`);
  if (bericht.neueVereine.length) {
    console.log(`\nVereine, die es vorher nicht gab (Schreibweise prüfen!):`);
    for (const v of bericht.neueVereine) console.log(`  ? ${v}`);
  }

  if (probe) return console.log("\n--probe: nichts geschrieben.");
  if (!bericht.ergaenzt) return console.log("\nNichts zu tun.");
  writeFileSync(PFAD, baueDatei(clubs, byKey));
  console.log(`\nGeschrieben: ${PFAD} · ${clubs.length} Vereine`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
