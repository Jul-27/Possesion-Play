/* Ergebnisse teilen — reine Logik (kein React).

   Bisher konnte nur der Daily-Star teilen. Das Emoji-Raster ist aber genau das, was
   solche Rätsel im Freundeskreis weiterträgt, deshalb bekommt es jeder Solo-Modus.
   Einheitlicher Aufbau: Titel · Kennzahl / Emoji-Zeile / Link. */

export const SHARE_BASE = () => `${window.location.origin}${window.location.pathname}`;

// Balken aus vollen/leeren Feldern — z. B. Fehlversuche oder Fortschritt.
export function bar(filled, total, full = "🟩", empty = "⬜") {
  const n = Math.max(0, Math.min(total, filled));
  return full.repeat(n) + empty.repeat(Math.max(0, total - n));
}

/* Jeder Modus liefert { title, lines[] }. Der Link wird zentral angehängt, damit
   Empfänger direkt im richtigen Modus landen. */
export function buildShare({ title, lines = [], solo }) {
  const url = solo ? `${SHARE_BASE()}?solo=${solo}` : SHARE_BASE();
  return [title, ...lines, url].filter(Boolean).join("\n");
}

/* „ohne Fehlversuch" darf nur nach einer Lösung stehen — nach dem Auflösen läse es
   sich wie ein Lob fürs Aufgeben. */
const misses = (wrong) => `${"❌".repeat(Math.min(wrong, 10))} ${wrong} Fehlversuch${wrong === 1 ? "" : "e"}`;

export const shareCareer = (stations, wrong, solved) => buildShare({
  solo: "career",
  title: solved
    ? `🧭 Karriere-Pfad gelöst nach ${stations} Station${stations > 1 ? "en" : ""}`
    : "🧭 Karriere-Pfad · aufgelöst",
  lines: [solved ? (wrong ? misses(wrong) : "✨ ohne Fehlversuch") : (wrong ? misses(wrong) : null)],
});

export const shareOdd = (streak, best) => buildShare({
  solo: "odd",
  title: `🧩 Wer passt nicht? · Serie ${streak}`,
  lines: [`${bar(Math.min(streak, 10), 10)}${streak > 10 ? " …" : ""}`, `Rekord ${best}`],
});

/* isRecord kommt vom Modus: der Bestwert ist beim Teilen bereits gespeichert, ein
   Vergleich len>=best hier würde selbst nach sofortigem Aufgeben „Rekord" behaupten. */
export const shareChain = (len, best, isRecord) => buildShare({
  solo: "chain",
  title: `⛓️ Fußball-Kette · ${len} Spieler`,
  lines: [isRecord ? "🏆 neuer Rekord!" : `Rekord ${best}`],
});

export const shareEleven = (num, wrong, formation) => buildShare({
  solo: "eleven",
  title: `👕 Elf des Tages #${num} komplett${formation ? ` · ${formation}` : ""}`,
  lines: [wrong ? misses(wrong) : "✨ ohne Fehlversuch"],
});

export const shareSolo = (moves, wrong) => buildShare({
  solo: "hex",
  title: `🎯 Hex-Training · Board in ${moves === 1 ? "1 Zug" : `${moves} Zügen`} gelöst`,
  lines: [wrong ? misses(wrong) : "✨ perfektes Board"],
});

/* Teilen anstoßen. Liefert "shared" | "copied" | "failed", damit die Oberfläche
   Rückmeldung geben kann — ohne Rückmeldung wirkt ein Klick ins Leere. */
export async function shareText(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return "shared"; }
  } catch { /* Abbruch durch den Nutzer ist kein Fehler — unten Zwischenablage versuchen */ }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch { return "failed"; }
}
