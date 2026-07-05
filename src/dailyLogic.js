/* Daily-Star — reine Logik (kein React, kein Netzwerk).
   Determinismus: gleiches Datum + gleiche players.js ⇒ gleicher Star für alle. */
import { guessEligibleIndices, norm } from "./gameData.js";

export const DAILY_EPOCH = "2026-06-30"; // Daily #1 = 2026-07-01
export const DAILY_MAX_Q = 8;            // max. Attributfragen
export const DAILY_MAX_G = 2;            // max. finale Tipps

// Lokales Datum als "YYYY-MM-DD" (Tageswechsel um lokale Mitternacht, wie Wordle).
export function dailyDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Laufende Nummer: Tagesdifferenz zur Epoche (beide via Date.parse = UTC-Mitternacht).
export function dailyNumber(dateStr) {
  return Math.round((Date.parse(dateStr) - Date.parse(DAILY_EPOCH)) / 86400000);
}

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
// Index des Tages-Stars per Rendezvous-Hashing: Es gewinnt der Kandidat mit dem
// kleinsten Hash aus Datum + stabilem Spieler-Schlüssel (norm(n)|by). Dadurch
// ändern Datenupdates den Tages-Star nur, wenn genau der Gewinner entfällt —
// nicht bei jeder Pool-Verschiebung (wichtig für den monatlichen Refresh).
export function dailyStarIndex(dateStr, players) {
  const pool = guessEligibleIndices(players);
  const list = pool.length ? pool : players.map((_, i) => i);
  let best = list[0], bestH = Infinity;
  for (const i of list) {
    const p = players[i];
    const h = hashStr(`daily:${dateStr}|${norm(p.n)}|${p.by}`);
    if (h < bestH) { bestH = h; best = i; }
  }
  return best;
}

// Streak zählt weiter, wenn der letzte gespielte Tag genau der Vortag war.
export function updateStreak(stats, dateStr, won) {
  const s = stats || {};
  const cont = s.last != null && dailyNumber(dateStr) === dailyNumber(s.last) + 1;
  const streak = won ? (cont ? (s.streak || 0) + 1 : 1) : 0;
  return {
    played: (s.played || 0) + 1,
    wins: (s.wins || 0) + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(s.maxStreak || 0, streak),
    last: dateStr,
  };
}

// Share-Zeilen: Frage 🟦, Fehltipp ❌, Treffer ⭐; Niederlage endet mit 💀.
export function buildShareText(num, log, won, url) {
  const emojis = log.map((e) => (e.dim ? "🟦" : e.correct ? "⭐" : "❌")).join("");
  return `Daily-Star #${num} ${won ? "⭐" : "💀"}\n${emojis}${won ? "" : "💀"}\n${url}`;
}
