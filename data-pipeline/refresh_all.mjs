#!/usr/bin/env node
/*
 * refresh_all.mjs — kompletter Wikidata-Refresh in der EINZIG korrekten
 * Reihenfolge (honours setzt t neu, honours_extra ergänzt danach BDO/EM/CA/EL,
 * apply_name_overrides zieht die kuratierten Namen nach, wikidata_images baut den
 * Bildindex danach auf den korrigierten Namen auf).
 * Bricht beim ersten Fehler ab. Dauer: ~15–40 min (Rate-Limits).
 *   npm run data:refresh
 */
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { copyFileSync } from "fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS = join(HERE, "..", "src", "players.js");
const SNAPSHOT = join(HERE, "..", "src", ".players.before.js");
/* Jeder Eintrag ist [Skript, Argumente]. Die Reihenfolge ist nicht verhandelbar —
   siehe die Kommentare je Schritt. */
const CHAIN = [
  ["wikidata_roster.mjs"],        // 1) Spieler/Vereine/sl
  ["wikidata_national.mjs"],      // 1b) Nationalteam-Kader (nat auch für Vereinlose)
  ["wikidata_honours.mjs"],       // 2) t: 11 Basis-Wettbewerbe (setzt neu)
  ["wikidata_honours_extra.mjs"], // 3) t += BDO/EM/CA/EL (additiv, NACH 2!)
  ["wikidata_positions.mjs"],     // 4) pos über die Kader
  ["backfill_positions.mjs"],     // 4b) pos für alle, die dort durchfallen (QID-Auflösung)
  ["wikidata_careers.mjs"],       // 5) cp
  ["apply_name_overrides.mjs"],   // 6) kuratierte Namen/Ausschlüsse
  /* 6b) EXTRA_PLAYERS/WRONG_CLUBS NACH den Namenskorrekturen: die Tabellen sind über
     norm(name)|by verschlüsselt und träfen auf den unkorrigierten Namen ins Leere.
     Fehlte dieser Schritt bisher — ein Voll-Refresh hat damit jedes Mal still
     Matthäus, die fünf Salzburger und alle übrigen kuratierten Fakten gelöscht. */
  ["apply_extra_players.mjs"],
  /* 6c) Aktuelle Kader aus der deutschen Wikipedia. Wikidata hinkt bei Transfers stark
     hinterher — bei Hoffenheim fehlten 19 von 31 Kaderspielern, bei Salzburg 24 von 33.
     Läuft NACH den Namenskorrekturen (gleicher Schlüssel norm(name)|by) und VOR
     wikidata_player_careers, damit lg/span die neuen cp-Einträge sehen. */
  ["wikipedia_squads.mjs"],
  /* 6d) Vollständige Vereinsstationen für „Transferkarussell". NACH allen Namens-
     korrekturen, weil der Schlüssel norm(name)|by ist. Dauert ~40 min (Label-Batches
     gegen WDQS) und schreibt src/careerClubs.js, nicht players.js. */
  ["wikidata_career_clubs.mjs"],
  /* 6d2) Kuratierte Karrierestationen NACH dem Neubau: das Skript oben schreibt
     careerClubs.js jedes Mal komplett neu, gemeldete Nachträge wie Wanner/Elversberg
     wären sonst nach jedem Lauf wieder weg. Genau dieser Fehler ließ
     apply_extra_players lange aus der Kette fehlen. Kein Netz. */
  ["apply_extra_career_clubs.mjs"],
  /* 6e) Datierte Stationen für den Karriere-Pfad. Eigene, kleine Datei: der Modus
     braucht Jahreszahlen, das Karussell nicht — die Jahre dort mitzuführen
     verdreifachte dessen Nachlade-Brocken. Nur sl>=40, also ~3 Minuten. */
  ["wikidata_career_path.mjs"],
  // 7) Fotos zuletzt: der Bildindex ist über norm(name)|by verschlüsselt und muss
  //    daher die bereits korrigierten Namen sehen, sonst zeigen die Schlüssel ins Leere.
  ["wikidata_player_careers.mjs"], // 8) lg (gespielte Ligen) + span (Karriere-Spanne) — auch Nicht-Spielvereine
  ["wikidata_images.mjs"],
  /* 9) Aktuelle Kader für „Steckbrief". Läuft NACH den Fotos, weil der Modus für
     das Tagesrätsel nur Spieler zieht, die eines haben — die Auswahl soll den
     frischen Bildindex sehen. Schreibt src/squads.js, nicht players.js. */
  ["league_squads.mjs"],
  /* 10) Genaue Positionen aus den Wikipedia-Infoboxen. Ganz zuletzt, weil der Abgleich
     Artikel->Spieler über norm(name)|geburtsjahr läuft und deshalb die bereits
     korrigierten Namen sehen muss — dieselbe Begründung wie bei den Fotos. Setzt `pp`
     neben `pos`; die grobe Gruppe bleibt unangetastet. Braucht rund 35 Minuten. */
  ["wikipedia_positions.mjs"],
];

/* Stand sichern, damit verify_refresh.mjs am Ende Verluste erkennen kann. Wikidata
   wird aktiv vandaliert — ohne diesen Vergleich gingen gelöschte Vereine und Titel
   still live. */
copyFileSync(PLAYERS, SNAPSHOT);
console.log(`Stand gesichert: ${SNAPSHOT}`);

for (const [script, ...args] of CHAIN) {
  console.log(`\n════════ ${[script, ...args].join(" ")} ════════`);
  const r = spawnSync(process.execPath, [join(HERE, script), ...args], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nAbbruch: ${script} endete mit Exit-Code ${r.status}`);
    process.exit(r.status || 1);
  }
}
console.log("\n════════ verify_refresh.mjs ════════");
const check = spawnSync(process.execPath, [join(HERE, "verify_refresh.mjs"), SNAPSHOT], { stdio: "inherit" });
if (check.status === 1) {
  console.error("\nRefresh durchgelaufen, aber die Prüfung meldet auffällige Verluste (siehe oben).");
  console.error(`Vergleichsstand liegt unter ${SNAPSHOT} — vor dem Commit prüfen.`);
  process.exit(1);
}
console.log("\nRefresh komplett — players.js + dataInfo.js aktualisiert.");
