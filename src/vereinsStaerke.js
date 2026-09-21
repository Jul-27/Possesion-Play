/* Die Stärke jedes Vereins der Karrierewelt — aus seinen echten Kadern.
   ═══════════════════════════════════════════════════════════════════════════

   Dieselbe Rechnung wie in der Traumelf: Für jeden Verein und jedes Jahr von 1995
   bis 2026 der Kader, daraus die Mannschaftsstärke, und über alle Jahre der Median.
   Aus ihr macht `baueWelt` in karriere.js die Rufstufe eines Vereins.

   ── WARUM DIESE RECHNUNG NICHT MEHR IM SPIEL LÄUFT ──────────────────────────
   Sie lief bis zum 21.09.2026 bei JEDEM Öffnen des Karrieremodus, im Browser, auf
   dem Hauptfaden. Gemessen: 22 Sekunden vom Klick bis zum ersten Bildschirm, bei
   jedem Betreten aufs Neue — sie hing in einem useMemo der Komponente, und das
   verfällt, sobald man den Modus verlässt. Dazu kamen 5 MB Spielerdaten, die
   heruntergeladen und eingelesen werden mussten, nur um diese eine Zahl je Verein
   zu bekommen.

   Der Grund für die Dauer ist `kader()`: Es durchläuft für JEDES Verein-Jahr-Paar
   alle 34.652 Spieler. 483 Vereine mal 32 Jahre sind 15.456 Durchläufe, rund eine
   halbe Milliarde Prüfungen — dazu 2.806 Ziehungen, die dasselbe tun.

   Das Ergebnis hängt aber nur an festen Daten. Es ändert sich, wenn der Daten-
   abgleich läuft, und sonst nie. Also rechnet ihn jetzt der Abgleich, einmal
   (data-pipeline/career_staerke.mjs), und das Spiel liest eine Tabelle mit 483
   Zahlen. Die Rechnung selbst steht hier, damit der Abgleich und die Prüfungen
   dieselbe Funktion benutzen und nicht zwei Fassungen auseinanderlaufen. */
import { baueZiehungen, baueKlassen, kader, DRAFT_AB_JAHR } from "./draft.js";
import { teamStaerke } from "./saison.js";

/** Das letzte Jahr, dessen Kader in die Stärke eingehen. */
export const STAERKE_BIS_JAHR = 2026;

/**
 * Median der Mannschaftsstärke je Verein über alle Jahre, in denen er einen
 * auswertbaren Kader hatte (mindestens acht bekannte Spieler).
 *
 * Gibt ein Objekt Vereinsschlüssel → Stärke zurück. Vereine ohne ein einziges
 * auswertbares Jahr fehlen darin; `baueWelt` lässt sie dann weg, wie vorher.
 */
export function berechneVereinsStaerken(players, einsaetze, vereine, ligen) {
  const jahre = Array.from({ length: STAERKE_BIS_JAHR - DRAFT_AB_JAHR + 1 }, (_, i) => DRAFT_AB_JAHR + i);
  /* Die Klassen — also wie stark jeder Spieler war — brauchen Ziehungen je Liga.
     Sie werden über die ganze Welt gebaut, damit ein Zweitligist an derselben
     Skala gemessen wird wie Bayern. */
  const ziehungen = [];
  for (const liga of ligen) {
    const vs = vereine.filter((v) => v.lg === liga.key);
    if (vs.length) ziehungen.push(...baueZiehungen(players, vs, liga.key));
  }
  const klassen = baueKlassen(players, ziehungen, einsaetze);
  const out = {};
  for (const v of vereine) {
    const w = [];
    for (const j of jahre) {
      const kd = kader(players, v.key, j, 5);
      if (kd.length >= 8) w.push(teamStaerke({ spieler: kd, jahr: j }, players, klassen));
    }
    if (!w.length) continue;
    w.sort((a, b) => a - b);
    out[v.key] = w[Math.floor(w.length / 2)];
  }
  return out;
}
