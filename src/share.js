/* Ergebnisse teilen — reine Logik (kein React).

   Bisher konnte nur das Tagesrätsel teilen. Das Emoji-Raster ist aber genau das, was
   solche Rätsel im Freundeskreis weiterträgt, deshalb bekommt es jeder Solo-Modus.
   Einheitlicher Aufbau: Titel · Kennzahl / Emoji-Zeile / Link.

   „Steckbrief" baut seinen Text selbst (steckbrief.js): sein Raster hat zwei
   Dimensionen — eine Zeile je Versuch, eine Spalte je Kachel — und passt nicht in
   die einzeilige Form, die alle anderen Modi teilen. */

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

/* Transferkarussell: die verbliebenen Leben sind die Kennzahl — sie zeigen, wie knapp
   es war, und ein 3:0 liest sich anders als ein 1:0. */
export const shareCarousel = (gewonnen, meine, gegner, stufe) => buildShare({
  solo: "carousel",
  title: `🎠 Transferkarussell · ${gewonnen ? "gewonnen" : "verloren"} ${meine}:${gegner}`,
  lines: [`${"❤️".repeat(meine)}${"🖤".repeat(3 - meine)} gegen ${"❤️".repeat(gegner)}${"🖤".repeat(3 - gegner)}`,
          stufe ? `Bot: ${stufe}` : null],
});

export const shareEleven = (num, wrong, formation) => buildShare({
  solo: "eleven",
  title: `👕 Elf des Tages #${num} komplett${formation ? ` · ${formation}` : ""}`,
  lines: [wrong ? misses(wrong) : "✨ ohne Fehlversuch"],
});

/* Heatmap: die Punktzahl ist die Kennzahl, die Dichte sagt, WIE sie zustande kam —
   70 Punkte mit Dichte 1,0 sind große Combos, mit 1,6 viel nachgeheizt. Die
   Emoji-Zeile zeigt die Hitzeverteilung der 30 Felder als Rampe. */
export const shareHeat = (score, density, ramp = "") => buildShare({
  solo: "heat",
  title: `🔥 Heatmap · ${score} Punkte`,
  lines: [ramp || null, `Heat Density ${density.toFixed(2)}`],
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
