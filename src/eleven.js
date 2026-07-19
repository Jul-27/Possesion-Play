/* „Elf des Tages" — reine Logik (kein React).
   Elf Positionen mit je einer Bedingung. Ausgegeben wird ein Rätsel nur, wenn sich
   nachweislich elf VERSCHIEDENE Spieler darauf verteilen lassen (bipartites Matching). */
import { playerMatchesHex } from "./gameData.js";
import { CHAIN_DEFS } from "./chain.js";

export const ELEVEN_SL_MIN = 40;        // Generierungspool: garantiert eine Lösung aus bekannten Spielern
export const ELEVEN_MIN_CANDIDATES = 8; // Mindestauswahl je Position

export const FORMATION = [
  { pos: "TW", count: 1, label: "Tor" },
  { pos: "ABW", count: 4, label: "Abwehr" },
  { pos: "MF", count: 4, label: "Mittelfeld" },
  { pos: "ST", count: 2, label: "Sturm" },
];
export const SLOT_POSITIONS = FORMATION.flatMap((f) => Array(f.count).fill(f.pos));

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function elevenPool(players) {
  const out = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.pos && (p.sl || 0) >= ELEVEN_SL_MIN) out.push(i);
  }
  return out;
}

export function slotCandidates(players, pool, pos, def) {
  const out = [];
  for (const i of pool) {
    const p = players[i];
    if (p.pos === pos && playerMatchesHex(p, def)) out.push(i);
  }
  return out;
}

export function elevenAccepts(player, slot) {
  if (!player || !slot) return false;
  return player.pos === slot.pos && playerMatchesHex(player, slot.def);
}

/* Bipartites Matching (Kuhn): Lassen sich allen Positionen paarweise verschiedene
   Spieler zuordnen? Acht Kandidaten je Position genügen dafür nicht — die Mengen
   können sich überschneiden (Satz von Hall). */
export function hasPerfectMatching(candLists) {
  const takenBy = new Map(); // Kandidat -> Position
  function augment(slot, seen) {
    for (const c of candLists[slot]) {
      if (seen.has(c)) continue;
      seen.add(c);
      const holder = takenBy.get(c);
      if (holder === undefined || augment(holder, seen)) { takenBy.set(c, slot); return true; }
    }
    return false;
  }
  for (let s = 0; s < candLists.length; s++) if (!augment(s, new Set())) return false;
  return true;
}

// { slots: [{ pos, def }] } — deterministisch aus dem Datum.
export function buildEleven(dateStr, players, maxTries = 40) {
  const pool = elevenPool(players);
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const rnd = mulberry32(hashStr(attempt === 1 ? `elf:${dateStr}` : `elf:${dateStr}#${attempt}`));
    const used = new Set();
    const slots = [];
    let ok = true;

    for (const pos of SLOT_POSITIONS) {
      // Bedingungen mit genug Auswahl für genau diese Position
      const fits = CHAIN_DEFS.filter((d) => {
        const k = `${d.type}:${d.key}`;
        if (used.has(k)) return false;
        return slotCandidates(players, pool, pos, d).length >= ELEVEN_MIN_CANDIDATES;
      });
      if (!fits.length) { ok = false; break; }
      const def = fits[Math.floor(rnd() * fits.length)];
      used.add(`${def.type}:${def.key}`);
      slots.push({ pos, def });
    }
    if (!ok) continue;

    const lists = slots.map((s) => slotCandidates(players, pool, s.pos, s.def));
    if (hasPerfectMatching(lists)) return { slots };
  }
  return { slots: [] }; // in der Praxis unerreichbar; die Tests decken 30 Tage ab
}
