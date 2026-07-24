/* Tagesaufgabe für die freien Solo-Modi — reine Logik (kein React).

   Vier von sechs Solo-Modi waren beliebig oft spielbar und boten damit keinen Grund,
   morgen wiederzukommen. Jeder bekommt jetzt eine Aufgabe des Tages: für alle Spieler
   dieselbe, einmal am Tag, mit Serie. Frei weiterspielen bleibt möglich.

   Der Kniff: Alle Generatoren (pickCareerIndex, buildOddRound, pickChainStart,
   buildBoardSerial) nehmen bereits eine Zufallsfunktion entgegen. Es genügt also, statt
   Math.random einen aus dem Datum abgeleiteten Generator zu übergeben — die Spiellogik
   selbst bleibt unangetastet. */
import { dailyDateStr, dailyNumber, updateStreak } from "./dailyLogic.js";

export const CHALLENGE_MODES = ["career", "odd", "chain", "hex"];

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Zufallsfunktion des Tages für einen Modus — gleicher Tag ⇒ gleiche Aufgabe für alle.
export function dailyRnd(mode, dateStr = dailyDateStr()) {
  return mulberry32(hashStr(`${mode}:${dateStr}`));
}

export const stateKey = (mode, dateStr = dailyDateStr()) => `pp:ch:${mode}:${dateStr}`;
export const statsKey = (mode) => `pp:chStats:${mode}`;

const read = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicherstand weiter */ } };

// Ist die Aufgabe von heute schon erledigt? { done, won } oder null.
export const challengeState = (mode, dateStr = dailyDateStr()) => read(stateKey(mode, dateStr));
export const challengeStats = (mode) => read(statsKey(mode));

/* Ergebnis festhalten. Mehrfaches Aufrufen am selben Tag zählt NICHT doppelt —
   sonst ließe sich die Serie durch Neuladen hochtreiben. */
export function recordChallenge(mode, won, dateStr = dailyDateStr()) {
  if (challengeState(mode, dateStr)) return challengeStats(mode);
  write(stateKey(mode, dateStr), { done: true, won });
  const next = updateStreak(challengeStats(mode), dateStr, won);
  write(statsKey(mode), next);
  return next;
}

// Kurzstatus für die Lobby: "heute offen" | "✓ gelöst" | "✗ vorbei"
export function challengeBadge(mode, dateStr = dailyDateStr()) {
  const st = challengeState(mode, dateStr);
  if (!st) return { text: "heute offen", tone: "" };
  return st.won ? { text: "✓ gelöst", tone: "won" } : { text: "✗ vorbei", tone: "lost" };
}

export { dailyDateStr, dailyNumber };
