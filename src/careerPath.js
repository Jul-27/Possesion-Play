/* Karriere-Pfad — reine Logik (kein React).
   Nutzt das cp-Feld (Vereinsperioden) für Spieler mit mehreren Stationen. */

export const CAREER_SL_MIN = 40;    // Mindest-Bekanntheit, damit ratbar
export const CAREER_MIN_CLUBS = 3;  // mind. so viele verschiedene Vereine

// Stationen chronologisch; Mehrfach-Engagements bleiben eigene Stationen.
export function careerStations(player) {
  return [...(player?.cp || [])]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([club, from, to]) => ({ club, from, to }));
}

// Indizes aller Spieler, die sich als Rätsel eignen.
export function careerCandidates(players) {
  const out = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if ((p.sl || 0) < CAREER_SL_MIN) continue;
    const clubs = new Set((p.cp || []).map((c) => c[0]));
    if (clubs.size >= CAREER_MIN_CLUBS) out.push(i);
  }
  return out;
}

// Zufälliger Kandidat (rnd injizierbar für Tests).
export function pickCareerIndex(players, rnd = Math.random) {
  const cand = careerCandidates(players);
  if (!cand.length) return -1;
  return cand[Math.min(cand.length - 1, Math.floor(rnd() * cand.length))];
}
