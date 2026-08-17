/* Punktwerte und Beschriftungen der Bestenliste — reine Logik, ohne Server-Anbindung
   (leaderboard.js importiert Supabase und ist deshalb außerhalb des Browsers nicht ladbar).

   Immer gilt „höher ist besser", damit die Liste einheitlich sortiert. Wo im Spiel
   weniger besser ist (Stationen, Züge), wird umgerechnet. */

export const MODES = {
  career: { name: "Karriere-Pfad", icon: "🧭", label: (s, d) => (d?.solved ? `nach ${d.stations} Stat.` : "aufgelöst") },
  odd:    { name: "Wer passt nicht?", icon: "🧩", label: (s) => (s > 0 ? "richtig" : "daneben") },
  chain:  { name: "Fußball-Kette", icon: "⛓️", label: (s, d) => `${d?.length ?? s} Spieler` },
  hex:    { name: "Hex-Training", icon: "🎯", label: (s, d) => `${d?.moves ?? "?"} Züge` },
  eleven: { name: "Elf des Tages", icon: "👕", label: (s, d) => (d?.wrong ? `${d.wrong} Fehlversuche` : "ohne Fehler") },
  heat:   { name: "Heatmap", icon: "🔥", label: (s, d) => `Dichte ${(d?.density ?? 0).toFixed(2)}` },
};

export function scoreFor(mode, result = {}) {
  switch (mode) {
    // früher gelöst = mehr Punkte; Fehlversuche kosten. Nie negativ.
    case "career": return result.solved ? Math.max(1, 100 - result.stations * 10 - result.wrong * 5) : 0;
    case "odd":    return result.correct ? 1 : 0;
    case "chain":  return Math.max(0, result.length || 0);
    case "hex":    return Math.max(1, 100 - result.moves * 2 - result.misses * 3);
    case "eleven": return result.solved ? Math.max(1, 100 - result.wrong * 5) : 0;
    // Heatmap wertet selbst schon in Punkten, hoch ist besser — nichts umzurechnen.
    case "heat":   return Math.max(0, Math.round(result.score || 0));
    default:       return 0;
  }
}
