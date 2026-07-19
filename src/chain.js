/* „Fußball-Kette" — reine Logik (kein React).
   Jeder genannte Spieler muss mit dem vorherigen ein noch freies Attribut teilen.
   Pro Zug verbrennt genau eine Verbindung — die spezifischste. */
import { CLUBS, NATIONS, LEAGUES, HONOURS, playerMatchesHex, lookupDef } from "./gameData.js";

export const CHAIN_START_SL_MIN = 60;   // Startspieler muss allgemein bekannt sein …
export const CHAIN_START_MIN_ATTRS = 5; // … und genug Anschlüsse haben, sonst endet die Kette sofort
export const CHAIN_START_SECONDS = 90;
export const CHAIN_BONUS_SECONDS = 8;

export const CHAIN_DEFS = [...CLUBS, ...NATIONS, ...LEAGUES, ...HONOURS];

// Spezifisch vor allgemein: „beide bei Bayern" ist die bessere Verbindung als „beide Deutsche".
const TYPE_RANK = { club: 0, honour: 1, league: 2, nat: 3 };
const byRank = (a, b) => TYPE_RANK[a.split(":")[0]] - TYPE_RANK[b.split(":")[0]];

export function playerAttrs(player) {
  const out = [];
  for (const d of CHAIN_DEFS) if (playerMatchesHex(player, d)) out.push(`${d.type}:${d.key}`);
  return out.sort(byRank);
}

export function openAttrs(player, burned) {
  return playerAttrs(player).filter((a) => !burned.has(a));
}

export function attrLabel(attr) {
  const [type, key] = attr.split(":");
  return lookupDef(type, key)?.name ?? key;
}

// Das Attribut, das dieser Zug verbrennt — oder null, wenn der Zug ungültig ist.
export function linkBetween(prev, next, burned) {
  if (!prev || !next) return null;
  const mine = new Set(openAttrs(prev, burned));
  for (const a of playerAttrs(next)) if (mine.has(a)) return a; // playerAttrs ist sortiert
  return null;
}

export function pickChainStart(players, rnd = Math.random) {
  const pool = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if ((p.sl || 0) >= CHAIN_START_SL_MIN && playerAttrs(p).length >= CHAIN_START_MIN_ATTRS) pool.push(i);
  }
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : -1;
}

/* Ein Zug, der von `current` aus noch möglich wäre — für den Sackgassen-Hinweis.
   Bevorzugt bekannte Spieler, damit der Hinweis auch etwas erklärt. */
export function chainHint(players, current, burned, usedNames) {
  if (!current || !openAttrs(current, burned).length) return null;
  let best = null;
  for (const p of players) {
    if (usedNames.has(p.n)) continue;
    const via = linkBetween(current, p, burned);
    if (!via) continue;
    if (!best || (p.sl || 0) > (best.player.sl || 0)) best = { player: p, via };
  }
  return best;
}
