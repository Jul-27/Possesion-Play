/* „Heatmap" — reine Logik (kein React).

   Solo-Modus auf dem bekannten 4-5-4-5-4-5-4-Brett: Feld wählen, Spieler nennen,
   passende Nachbarn fallen mit. Neu gegenüber dem Hex-Training sind drei Dinge:

   1. WERTUNG ALS COMBO. Nicht die Zahl der Felder zählt, sondern wie viele davon
      EIN Zug bringt: 1 Feld = 1 Punkt, 2 = 3, 4 = 10 (Dreieckszahl n·(n+1)/2). Ein
      Zug über sieben Zellen ist damit 28 Punkte wert, sieben Einzelzüge nur sieben.
   2. REHEAT. Trifft der Spieler auch schon eroberte Nachbarn, gibt das +1 je Feld
      und macht das Feld heißer. Weil nur FREIE Felder anwählbar sind, lässt sich
      damit nicht farmen — jeder Zug muss mindestens eine neue Zelle bringen.
   3. HITZE = GRÖSSE DES ZUGES. Alle Felder eines Zuges bekommen die Zahl der in
      DIESEM Zug eroberten Felder als Stufe: „Portugal" mit André Silva reißt auch
      „RB Leipzig" und „Bundesliga" mit, also stehen alle drei auf Stufe 3. Ein
      Alleingang („Copa-del-Rey-Sieger" mit Cristiano Ronaldo, der zu keinem
      Nachbarn passt) bleibt Stufe 1. Ein späterer Reheat hebt ein Feld um eine
      weitere Stufe — er macht das Brett laut Regelwerk ja „hotter".
      Die Heat Density ist der Schnitt dieser Stufen über alle 30 Felder.

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

/* Hitzekarte nach einem Zug. Die neu eroberten Felder teilen sich die Stufe „so viele
   Felder hat dieser Zug gebracht" — ein Vierer-Zug färbt alle vier gleich heiß, nicht
   nur das angeklickte. Bereits erobertes steigt um eine Stufe. */
export function applyHeat(heat, zug) {
  const next = { ...heat };
  for (const i of zug.neu) next[i] = zug.neu.length;
  for (const i of zug.reheat) next[i] = (next[i] || 0) + 1;
  return next;
}

export const heatFilled = (heat) => HEAT_CELLS.filter((i) => heat[i]).length;
export const heatDone = (heat) => heatFilled(heat) === HEAT_CELLS.length;
export const heatDensity = (heat) =>
  HEAT_CELLS.reduce((a, i) => a + (heat[i] || 0), 0) / HEAT_CELLS.length;

/* Farbrampe hellgelb → gelb → orange → hellrot → rot → schwarz. Sechs Stufen, weil
   ein Zug höchstens das gewählte Feld plus sechs Nachbarn bringt; alles ab sechs
   Feldern ist gleich schwarz.

   Die Helligkeit fällt über die ganze Rampe monoton (Test hält das fest) — nur so
   liest sich die Folge als Steigerung und nicht als sechs bunte Zustände. Deshalb
   ist Orange bewusst das hellere #FB923C: das kräftigere #F97316 wäre dunkler als
   das nachfolgende Hellrot gewesen und hätte die Reihenfolge umgedreht.

   Jede Stufe trägt eine HELLERE Kante, sonst verschwände die schwarze Kachel auf
   dem dunklen Brett. Die Schrift kippt ab Stufe 5 von dunkel auf hell. */
export const HEAT_MAX = 6;
const RAMPE = [
  { c1: "#FEF08A", c2: "#FDE047", kante: "#FEF9C3", txt: "#422006" }, // 1 hellgelb
  { c1: "#FACC15", c2: "#EAB308", kante: "#FDE68A", txt: "#422006" }, // 2 gelb
  { c1: "#FB923C", c2: "#F97316", kante: "#FED7AA", txt: "#431407" }, // 3 orange
  { c1: "#F87171", c2: "#EF4444", kante: "#FCA5A5", txt: "#450A0A" }, // 4 hellrot
  { c1: "#DC2626", c2: "#991B1B", kante: "#F87171", txt: "#FFF1F2" }, // 5 rot
  /* Stufe 6 ist Schwarz — und Schwarz sieht auf dunklem Grund aus wie GAR NICHTS.
     Ein unerobertes Feld ist rgba(30,42,58) und damit ebenfalls fast schwarz; die
     heißesten Felder wirkten dadurch unerobert. Die Füllung bleibt schwarz, aber
     warm getönt, und bekommt einen glühenden Rand plus inneres Glimmen — Kohle,
     die noch brennt, statt eines Lochs im Brett. */
  { c1: "#241713", c2: "#0B0605", kante: "#F97316", txt: "#FFE4CC", glut: true }, // 6+ durchgeglüht
];

/** Malvorschrift für eine Zelle — `null` heißt „unerobert, Standardfarbe". */
export function heatPaint(level = 0) {
  if (!level) return null;
  const stufe = Math.min(level, HEAT_MAX);   // zuerst deckeln, sonst liefe die Rampe weiter
  const r = RAMPE[stufe - 1];
  return {
    bg: `linear-gradient(150deg, ${r.c1}, ${r.c2})`,
    border: `1px solid ${r.kante}`,
    txt: r.txt,
    /* Glanzkante oben, mit dunkler werdender Kachel zurückgenommen. Die oberste
       Stufe bekommt stattdessen inneres Glimmen — nur so ist sie von einem
       unereroberten Feld zu unterscheiden. */
    shadow: r.glut
      ? "inset 0 0 15px rgba(249,115,22,.5), inset 0 0 3px rgba(249,115,22,.7)"
      : `inset 0 1px 0 rgba(255,255,255,${(0.4 - stufe * 0.06).toFixed(2)})`,
  };
}

/* Zum Teilen: die Hitzekarte als Emoji-Raster in Brettform (4-5-4-5-4-5-4). Das
   Bild transportiert mehr als die Zahl — man sieht sofort, wo es heiß wurde.

   Emoji kennen nur EIN Gelb und EIN Rot, die sechs Stufen lassen sich also nicht
   eins zu eins abbilden: 1/2 teilen sich das Gelb, 4/5 das Rot. Die Mitte ist 🔲
   und nicht mehr ⬛ — schwarz ist jetzt die heißeste Stufe. */
const RAMPE_EMOJI = ["⬜", "🟨", "🟨", "🟧", "🟥", "🟥", "⬛"];
export function heatShareGrid(heat) {
  const zeilen = [];
  let i = 0;
  for (let r = 0; r < 7; r++) {
    const zeile = [];
    for (let c = 0; c < (r % 2 === 1 ? 5 : 4); c++, i++) {
      zeile.push(i === HEAT_CENTER ? "🔲" : RAMPE_EMOJI[Math.min(heat[i] || 0, HEAT_MAX)]);
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
