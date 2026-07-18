/* Karriere-Pfad — reine Logik (kein React).
   Nutzt das cp-Feld (Vereinsperioden) für Spieler mit mehreren Stationen. */

export const CAREER_SL_MIN = 40;       // Mindest-Bekanntheit, damit ratbar
export const CAREER_MIN_STATIONS = 3;  // mind. so viele Stationen (Rückkehr zählt eigenständig)

const END = (to) => (to === 0 ? 9999 : to); // 0 = bis heute

// Stationen chronologisch. Überlappende/anschließende Spells desselben Vereins
// werden verschmolzen (Wikidata führt Leihen/Verträge doppelt), echte Rückkehrer
// nach einer Lücke bleiben eigene Stationen.
export function careerStations(player) {
  const sorted = [...(player?.cp || [])].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const out = [];
  for (const [club, from, to] of sorted) {
    const prev = out.find((s) => s.club === club && from <= END(s.to));
    if (prev) { prev.to = prev.to === 0 || to === 0 ? 0 : Math.max(prev.to, to); continue; }
    out.push({ club, from, to });
  }
  return out.sort((a, b) => a.from - b.from || a.club.localeCompare(b.club));
}

// Indizes aller Spieler, die sich als Rätsel eignen (nach dem Verschmelzen).
export function careerCandidates(players) {
  const out = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if ((p.sl || 0) < CAREER_SL_MIN) continue;
    if (careerStations(p).length >= CAREER_MIN_STATIONS) out.push(i);
  }
  return out;
}

// Zufälliger Kandidat (rnd injizierbar für Tests).
export function pickCareerIndex(players, rnd = Math.random) {
  const cand = careerCandidates(players);
  if (!cand.length) return -1;
  return cand[Math.min(cand.length - 1, Math.floor(rnd() * cand.length))];
}
