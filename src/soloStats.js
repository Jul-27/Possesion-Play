/* Statistik des Hex-Trainings — reine Logik, damit sie ohne React prüfbar ist.
   Hex-Training war der einzige Modus ohne jeden gespeicherten Fortschritt. */

export const SOLO_STATS_KEY = "pp:soloStats";
export const emptySoloStats = () => ({ played: 0, bestMoves: 0, perfect: 0 });

/* Weniger Züge ist besser, deshalb Minimum statt Maximum. bestMoves = 0 bedeutet
   „noch kein Wert" und darf ein echtes Ergebnis nicht schlagen. */
export function updateSoloStats(prev, moves, misses) {
  const p = prev && typeof prev === "object" ? prev : emptySoloStats();
  return {
    played: (p.played || 0) + 1,
    bestMoves: p.bestMoves ? Math.min(p.bestMoves, moves) : moves,
    perfect: (p.perfect || 0) + (misses === 0 ? 1 : 0),
  };
}

export function soloStatsLine(st) {
  if (!st || !st.played) return null;
  return `${st.played} Board${st.played === 1 ? "" : "s"} gelöst · Bestwert ${st.bestMoves} Züge`
    + (st.perfect ? ` · ${st.perfect}× perfekt` : "");
}
