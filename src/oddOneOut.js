/* „Wer passt nicht?" — reine Logik (kein React).
   Drei Spieler teilen eine Eigenschaft, einer nicht. Jede Runde wird auf
   Eindeutigkeit geprüft: Gäbe eine andere Regel einen 3:1-Split mit einem
   ANDEREN Außenseiter, wäre die Frage doppeldeutig -> verworfen. */
import { CLUBS, NATIONS, LEAGUES, HONOURS, playerMatchesHex } from "./gameData.js";

export const ODD_SL_MIN = 60; // nur gut bekannte Spieler (sonst sind die Rätsel nicht lösbar)
// Merkmale, die man beim Vergleichen tatsächlich bemerkt (bewusst ohne Ära/Jahrgang)
export const ODD_DEFS = [...CLUBS, ...NATIONS, ...LEAGUES, ...HONOURS];

export function oddCandidates(players) {
  const out = [];
  for (let i = 0; i < players.length; i++) if ((players[i].sl || 0) >= ODD_SL_MIN) out.push(i);
  return out;
}

export function oddRuleLabel(def) {
  if (def.type === "club") return `spielten alle für ${def.name}`;
  if (def.type === "league") return `spielten alle in der ${def.name}`;
  if (def.type === "nat") return `kommen alle aus ${def.name}`;
  return `sind alle ${def.name}`; // honour
}

// Liefert die störende Regel, wenn die Runde mehrdeutig ist — sonst null.
export function ambiguousWith(four, oddIndex, rule) {
  for (const d of ODD_DEFS) {
    if (d.type === rule.type && d.key === rule.key) continue;
    const miss = [];
    for (let i = 0; i < four.length; i++) if (!playerMatchesHex(four[i], d)) miss.push(i);
    if (miss.length === 1 && miss[0] !== oddIndex) return d;
  }
  return null;
}

const pickOne = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
function pickN(arr, n, rnd) {
  const copy = [...arr], out = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  return out;
}
function shuffle(arr, rnd) {
  const x = [...arr];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

// { def, options: [4 Spieler], oddIndex } oder null, wenn nichts Eindeutiges gefunden wurde.
export function buildOddRound(players, rnd = Math.random, tries = 80) {
  const pool = oddCandidates(players).map((i) => players[i]);
  for (let t = 0; t < tries; t++) {
    const def = pickOne(ODD_DEFS, rnd);
    const match = [], nonMatch = [];
    for (const p of pool) (playerMatchesHex(p, def) ? match : nonMatch).push(p);
    if (match.length < 3 || !nonMatch.length) continue;
    const odd = pickOne(nonMatch, rnd);
    const options = shuffle([...pickN(match, 3, rnd), odd], rnd);
    const oddIndex = options.indexOf(odd);
    if (ambiguousWith(options, oddIndex, def)) continue;
    return { def, options, oddIndex };
  }
  return null;
}
