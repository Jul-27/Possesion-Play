/* „Heatmap" — reine Logik (kein React).

   Solo-Modus auf dem bekannten 4-5-4-5-4-5-4-Brett: Feld wählen, Spieler nennen,
   passende Nachbarn fallen mit. Neu gegenüber dem Hex-Training sind drei Dinge:

   1. WERTUNG ALS COMBO. Nicht die Zahl der Felder zählt, sondern wie viele davon
      EIN Zug bringt: 1 Feld = 1 Punkt, 2 = 3, 4 = 10 (Dreieckszahl n·(n+1)/2). Ein
      Zug über sieben Zellen ist damit 28 Punkte wert, sieben Einzelzüge nur sieben.
   2. REHEAT. Trifft der Spieler auch schon eroberte Nachbarn, gibt das +1 je Feld
      und macht das Feld heißer. Weil nur FREIE Felder anwählbar sind, lässt sich
      damit nicht farmen — jeder Zug muss mindestens eine neue Zelle bringen.
   3. HITZE. Jeder Treffer auf einem Feld zählt: Eroberung = 1, jeder Reheat +1.
      Die Heat Density ist der Schnitt über alle 30 Felder; 1,0 heißt „jedes Feld
      genau einmal getroffen", alles darüber ist verdiente Hitze.

   Die Mittelzelle (Index 15) trägt die Punkteanzeige und ist kein Spielfeld. Sie
   überbrückt auch keine Nachbarschaft — die sechs Felder ringsum haben schlicht
   einen Nachbarn weniger.

   GEMESSEN (30 Boards, sim in der Sitzung vom 2026-08-16): bestmögliches Spiel
   Ø 70 Punkte in 12–16 Zügen, zufällig gültiges Spiel Ø 36 in ~29 Zügen. Der
   breiteste Spieler eines Boards deckt Ø 9,6 der 30 Zellen ab, wird vom optimalen
   Spiel aber fast nie zweimal gesetzt: seine Felder liegen verstreut, und nach dem
   ersten Zug sind die passenden Nachbarn dort schon weg. Mehrfachnennung ist
   deshalb erlaubt — sie ist kein Exploit, sondern nur selten die beste Wahl. */
import { ADJP, POSITIONS, buildBoardSerial, playerMatchesHex } from "./gameData.js";

export const HEAT_CENTER = 15;                       // Punkteanzeige statt Spielfeld
export const HEAT_CELLS = POSITIONS.map((p) => p.idx).filter((i) => i !== HEAT_CENTER);
export const HEAT_ADJ = Object.fromEntries(
  HEAT_CELLS.map((i) => [i, ADJP[i].filter((n) => n !== HEAT_CENTER)])
);

/** Combo-Wertung: 1, 3, 6, 10, 15, 21, 28 — die Dreieckszahlen. */
export const comboPoints = (n) => (n * (n + 1)) / 2;

/** Board mit 30 Feldern; an der Mittelzelle steht null. */
export function buildHeatSerial(rnd = Math.random) {
  const felder = buildBoardSerial(rnd, HEAT_CELLS.length);
  let k = 0;
  return POSITIONS.map((p) => (p.idx === HEAT_CENTER ? null : felder[k++]));
}

/* Ein Zug. Liefert null, wenn er gar nicht zulässig ist (belegtes Feld, Mittelzelle
   oder Spieler passt nicht) — die Trennung hält die Ansicht frei von Regelwissen. */
export function heatMove(board, heat, hex, player) {
  if (!board[hex]?.def || heat[hex]) return null;
  if (!playerMatchesHex(player, board[hex].def)) return null;
  const neu = [hex], reheat = [];
  for (const n of HEAT_ADJ[hex]) {
    if (!playerMatchesHex(player, board[n].def)) continue;
    (heat[n] ? reheat : neu).push(n);
  }
  return { neu, reheat, punkte: comboPoints(neu.length) + reheat.length };
}

/** Hitzekarte nach einem Zug: jedes getroffene Feld +1. */
export function applyHeat(heat, zug) {
  const next = { ...heat };
  for (const i of [...zug.neu, ...zug.reheat]) next[i] = (next[i] || 0) + 1;
  return next;
}

export const heatFilled = (heat) => HEAT_CELLS.filter((i) => heat[i]).length;
export const heatDone = (heat) => heatFilled(heat) === HEAT_CELLS.length;
export const heatDensity = (heat) =>
  HEAT_CELLS.reduce((a, i) => a + (heat[i] || 0), 0) / HEAT_CELLS.length;

/* Farbrampe kalt → weißglühend. Die Dichte liegt selbst bei optimalem Spiel nur bei
   ~1,3, Stufe 4 und 5 sind also echte Ausnahmen und dürfen entsprechend knallen.
   Ein Feld kann höchstens 1 + 6 Treffer sammeln, darüber deckelt die Rampe. */
export const HEAT_MAX = 5;
const RAMPE = [
  { c1: "#2DD4BF", c2: "#0f766e", glow: "rgba(45,212,191,.45)" },  // 1 — frisch erobert
  { c1: "#FACC15", c2: "#a16207", glow: "rgba(250,204,21,.45)" },  // 2
  { c1: "#FB923C", c2: "#9a3412", glow: "rgba(251,146,60,.50)" },  // 3
  { c1: "#F87171", c2: "#991b1b", glow: "rgba(248,113,113,.55)" }, // 4
  { c1: "#FFE4E6", c2: "#DC2626", glow: "rgba(255,120,120,.75)" }, // 5+ weißglühend
];

/** Malvorschrift für eine Zelle — `null` heißt „unerobert, Standardfarbe". */
export function heatPaint(level = 0) {
  if (!level) return null;
  const stufe = Math.min(level, HEAT_MAX);   // zuerst deckeln, sonst wächst der Schein weiter
  const r = RAMPE[stufe - 1];
  return {
    bg: `linear-gradient(150deg, ${r.c1}, ${r.c2})`,
    border: `1px solid ${r.c1}`,
    txt: stufe === HEAT_MAX ? "#4c0519" : "#fff",
    shadow: `0 0 ${10 + stufe * 4}px ${r.glow}, inset 0 1px 0 rgba(255,255,255,.25)`,
    glow: r.glow,
  };
}

/* Zum Teilen: die Hitzekarte als Emoji-Raster in Brettform (4-5-4-5-4-5-4). Das
   Bild transportiert mehr als die Zahl — man sieht sofort, wo es heiß wurde. */
const RAMPE_EMOJI = ["⬜", "🟩", "🟨", "🟧", "🟥", "🔥"];
export function heatShareGrid(heat) {
  const zeilen = [];
  let i = 0;
  for (let r = 0; r < 7; r++) {
    const zeile = [];
    for (let c = 0; c < (r % 2 === 1 ? 5 : 4); c++, i++) {
      zeile.push(i === HEAT_CENTER ? "⬛" : RAMPE_EMOJI[Math.min(heat[i] || 0, HEAT_MAX)]);
    }
    zeilen.push((r % 2 === 0 ? " " : "") + zeile.join(""));
  }
  return zeilen.join("\n");
}

/* Rückmeldung nach einem Zug. Steht hier statt in der Ansicht, weil die Zahlen
   erklärt werden müssen: „3 Felder = 6" ist sonst nicht nachvollziehbar. */
export function heatMoveText(zug, feldName) {
  const teile = [`${zug.neu.length} ${zug.neu.length === 1 ? "Feld" : "Felder"} = ${comboPoints(zug.neu.length)}`];
  if (zug.reheat.length) teile.push(`${zug.reheat.length}× Reheat +${zug.reheat.length}`);
  return `✓ ${feldName} · ${teile.join(" · ")} → +${zug.punkte}`;
}
