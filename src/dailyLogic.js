/* Gemeinsame Grundlage aller Tagesrätsel — reine Logik (kein React, kein Netzwerk).

   Hier steht nur, was jedes Tagesrätsel braucht: welcher Tag gerade ist, welche
   Nummer er trägt und wie die Serie fortgeschrieben wird. Die Regeln des jeweiligen
   Rätsels stehen bei ihm selbst (siehe steckbrief.js).

   Die Epoche bleibt der 30.06.2026, obwohl „Steckbrief" den Daily-Star abgelöst hat:
   die laufende Nummer ist für die Spieler eine durchgehende Zählung, und ein Sprung
   zurück auf #1 hätte die vorhandenen Serien entwertet. */

export const DAILY_EPOCH = "2026-06-30"; // Tagesrätsel #1 = 2026-07-01

// Lokales Datum als "YYYY-MM-DD" (Tageswechsel um lokale Mitternacht, wie Wordle).
export function dailyDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Laufende Nummer: Tagesdifferenz zur Epoche (beide via Date.parse = UTC-Mitternacht).
export function dailyNumber(dateStr) {
  return Math.round((Date.parse(dateStr) - Date.parse(DAILY_EPOCH)) / 86400000);
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

