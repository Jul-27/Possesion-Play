/* Die Karriere des Tages und die Bilanz über alle Laufbahnen — was gespeichert wird.
   ═══════════════════════════════════════════════════════════════════════════

   DIE LAUFENDE KARRIERE WIRD NICHT GESPEICHERT. Das ist so gewollt: Eine Laufbahn
   ist schnell durchgespielt und nicht dafür gedacht, über Tage aufgebaut zu werden.
   Gespeichert wird nur, was nach dem Ende von ihr übrig bleibt:

     pp:karriereStats          Bilanz über alle Laufbahnen (für Statistik, XP, Abzeichen)
     pp:karriereTag:<datum>    ob die Karriere des Tages begonnen und wie sie ausging
     pp:ch:karriere:<datum>    die Tagesaufgabe, wie bei jedem anderen Modus (Serie)

   ── EIN VERSUCH AM TAG ───────────────────────────────────────────────────────
   Die Karriere des Tages zählt einmal. Wer sie beginnt, bekommt eine Markierung;
   verlässt er sie mittendrin, kann er sie nicht neu beginnen, bis sie besser läuft —
   sonst wäre die Bestenliste eine Frage der Geduld. Eine abgebrochene Karriere des
   Tages wird beim nächsten Öffnen als verloren verbucht (die Serie reisst), eine zu
   Ende gespielte als gewonnen, mit ihren Punkten. */
import { dailyDateStr } from "./dailyLogic.js";
import { challengeState, recordChallenge } from "./dailyChallenge.js";
import { KARRIERE_STATS_KEY, laufbahnBilanz, updateKarriereStats, tagesPunkte } from "./karriere.js";

const read = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicher weiter */ } };

export const tagKey = (datum) => `pp:karriereTag:${datum}`;

/** Wie steht die Karriere des Tages? { begonnen, ergebnis } — beides falsy, wenn offen. */
export function tagesZustand(datum = dailyDateStr()) {
  return read(tagKey(datum)) || { begonnen: false, ergebnis: null };
}

/** Beim Start: die Markierung setzen. */
export function beginneTag(datum = dailyDateStr()) {
  write(tagKey(datum), { begonnen: true, ergebnis: null });
}

/** Beim Öffnen des Modus: eine begonnene, nie beendete Karriere des Tages verbuchen. */
export function abbruchVerbuchen(datum = dailyDateStr()) {
  const z = tagesZustand(datum);
  if (!z.begonnen || z.ergebnis || challengeState("karriere", datum)) return false;
  recordChallenge("karriere", false, datum);
  write(tagKey(datum), { begonnen: true, ergebnis: { abgebrochen: true } });
  return true;
}

/**
 * Am Ende jeder Laufbahn: die Bilanz fortschreiben; bei der Karriere des Tages
 * zusätzlich Punkte, Tagesaufgabe und Ergebnis festhalten. Gibt die Wertung des
 * Tages zurück (oder null bei einer frei gespielten Laufbahn).
 */
export function verbucheLaufbahn(k) {
  write(KARRIERE_STATS_KEY, updateKarriereStats(read(KARRIERE_STATS_KEY), laufbahnBilanz(k)));
  if (!k.tagesDatum) return null;
  const wertung = tagesPunkte(k);
  /* Dieselbe Karriere des Tages zählt nur einmal — auch wenn beende zweimal liefe. */
  if (tagesZustand(k.tagesDatum).ergebnis) return tagesZustand(k.tagesDatum).ergebnis;
  write(tagKey(k.tagesDatum), { begonnen: true, ergebnis: wertung });
  recordChallenge("karriere", true, k.tagesDatum);
  return wertung;
}
