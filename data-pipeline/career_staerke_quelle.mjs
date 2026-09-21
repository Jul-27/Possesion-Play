/*
 * career_staerke_quelle.mjs — der Fingerabdruck der Eingaben von careerStaerke.js.
 *
 * Eine vorberechnete Tabelle ist nur so gut wie die Gewissheit, dass sie zu den
 * Daten passt, aus denen sie stammt. Dieser Fingerabdruck hält fest, woraus sie
 * gerechnet wurde; die Prüfung in src/careerStaerke.test.js vergleicht ihn mit dem
 * aktuellen Stand.
 *
 * Eingaben sind nicht nur die Daten, sondern auch der Code, der aus ihnen rechnet:
 * Ändert jemand teamStaerke in saison.js, stimmen die Stärken genauso wenig wie
 * nach einem neuen Datenabgleich.
 *
 * Nur für Node — liegt deshalb hier und nicht unter src/, wo der Browser es finden
 * könnte.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

export const EINGABEN = [
  "players.js",        // die Spieler und ihre Stationen
  "appearances.js",    // Einsatzzahlen, verfeinern die Spielerklassen
  "careerWorld.js",    // welche Vereine in welcher Liga stehen
  "draft.js",          // kader(), baueZiehungen(), baueKlassen()
  "saison.js",         // teamStaerke()
  "vereinsStaerke.js", // die Rechnung, die alles zusammenführt
];

/** Kurzer SHA-1 je Eingabedatei. */
export function fingerabdruck() {
  const out = {};
  for (const f of EINGABEN) {
    out[f] = createHash("sha1").update(readFileSync(join(SRC, f))).digest("hex").slice(0, 16);
  }
  return out;
}
