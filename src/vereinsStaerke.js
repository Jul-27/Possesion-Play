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

/* ── Der zweite Anlauf ─────────────────────────────────────────────────────────
   Die Rechnung verlangt je Saison acht bekannte Spieler (sl ab 5). Das schaffen 95
   der 483 Vereine in keinem einzigen Jahr — sie standen in der Liste und kamen im
   Spiel nie vor: Von 20 saudischen Vereinen blieben 4, Portugals zweite Liga hatte
   7 statt 20, Österreichs zweite 5 statt 16. Im Durchspielen fiel es als „die
   Saudi Pro League sind immer dieselben vier" auf.

   Für GENAU diese Vereine gibt es einen zweiten Anlauf: alle erfassten Spieler,
   auch die wenig bekannten, und fünf je Saison statt acht. Das sind weiterhin nur
   echte Spieler mit echten Stationen — keine geschätzte Zahl. Wo weniger als elf
   bekannt sind, füllt teamStaerke den Rest mit dem untersten Wert der Skala auf;
   ein dünn erfasster Verein landet dadurch ehrlich am unteren Ende und nicht, wie
   ein Schnitt über fünf Stars, darüber.

   Die Vereine, die schon im ersten Anlauf eine Stärke bekommen, bleiben davon
   unberührt — ihre Zahlen sind dieselben wie vorher. */
export const KADER_MINDEST = 8, KADER_SL = 5;
export const ZWEITER_ANLAUF_MINDEST = 5, ZWEITER_ANLAUF_SL = 0;

/**
 * Median der Mannschaftsstärke je Verein über alle Jahre, in denen er einen
 * auswertbaren Kader hatte (mindestens acht bekannte Spieler).
 *
 * Gibt `staerke` (Vereinsschlüssel → Stärke) und `zweiterAnlauf` (die Schlüssel,
 * die erst im zweiten Anlauf eine bekamen) zurück. Vereine ohne ein einziges
 * auswertbares Jahr fehlen in `staerke`; `baueWelt` lässt sie dann weg.
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
  const median = (v, slMin, mindest) => {
    const w = [];
    for (const j of jahre) {
      const kd = kader(players, v.key, j, slMin);
      if (kd.length >= mindest) w.push(teamStaerke({ spieler: kd, jahr: j }, players, klassen));
    }
    if (!w.length) return null;
    w.sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  };
  const staerke = {}, zweiterAnlauf = [];
  for (const v of vereine) {
    let s = median(v, KADER_SL, KADER_MINDEST);
    if (s === null) {
      s = median(v, ZWEITER_ANLAUF_SL, ZWEITER_ANLAUF_MINDEST);
      if (s !== null) zweiterAnlauf.push(v.key);
    }
    if (s !== null) staerke[v.key] = s;
  }
  return { staerke, zweiterAnlauf };
}
