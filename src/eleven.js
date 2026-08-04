/* „Elf des Tages" — reine Logik (kein React).
   Elf Positionen mit je einer Bedingung. Ausgegeben wird ein Rätsel nur, wenn sich
   nachweislich elf VERSCHIEDENE Spieler darauf verteilen lassen (bipartites Matching). */
import { playerMatchesHex, POS_LABEL } from "./gameData.js";
import { CHAIN_DEFS } from "./chain.js";

export const ELEVEN_SL_MIN = 40;        // Generierungspool: garantiert eine Lösung aus bekannten Spielern
export const ELEVEN_MIN_CANDIDATES = 8; // Mindestauswahl je Position

/* Eine Formation ist nur ihre Linienfolge (von hinten nach vorne). Daraus berechnet
   slotLayout() die Koordinaten — dadurch kostet eine neue Formation eine Zeile, und
   mehrlinige Mittelfelder (4-2-3-1) brauchen keinen Sonderfall.
   Alle sechs sind auf Lösbarkeit geprüft (bipartites Matching, 20/20). */
export const FORMATIONS = [
  { name: "4-4-2",   lines: [["TW",1],["ABW",4],["MF",4],["ST",2]] },
  { name: "4-3-3",   lines: [["TW",1],["ABW",4],["MF",3],["ST",3]] },
  { name: "3-5-2",   lines: [["TW",1],["ABW",3],["MF",5],["ST",2]] },
  { name: "4-2-3-1", lines: [["TW",1],["ABW",4],["MF",2],["MF",3],["ST",1]] },
  { name: "5-3-2",   lines: [["TW",1],["ABW",5],["MF",3],["ST",2]] },
  { name: "3-4-3",   lines: [["TW",1],["ABW",3],["MF",4],["ST",3]] },
];

// Positionsfolge einer Formation (Reihenfolge = Slot-Index, hinten nach vorne).
export function formationPositions(f) {
  return f.lines.flatMap(([pos, n]) => Array(n).fill(pos));
}

/* Koordinaten in Prozent: Tor unten (y groß), Sturm oben. Innerhalb einer Linie
   gleichmäßig verteilt, damit auch 5er-Reihen sauber sitzen. */
export function slotLayout(f) {
  const rows = f.lines.length;
  const out = [];
  f.lines.forEach(([pos, n], li) => {
    // 90 % (Torwart, im eigenen Strafraum) bis 18 % — die vorderste Linie bleibt VOR
    // dem gegnerischen Strafraum (der endet bei ~14 %), sonst stehen Stürmer im Tor.
    const y = rows > 1 ? 90 - (li / (rows - 1)) * 72 : 50;
    for (let k = 0; k < n; k++) out.push({ pos, x: ((k + 1) / (n + 1)) * 100, y });
  });
  return out;
}

// Formation des Tages — deterministisch, wie das Rätsel selbst.
export function formationFor(dateStr) {
  return FORMATIONS[hashStr(`form:${dateStr}`) % FORMATIONS.length];
}

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

/* Begründung einer Ablehnung. Der Fall „Spieler ohne hinterlegte Position" braucht
   einen eigenen Satz: vorher stand dort „X ist undefined, gesucht ist Torwart" — das
   las sich wie ein Fehler im Spiel und nicht wie eine Lücke im Datensatz. */
export function elevenReason(player, slot) {
  if (!player || !slot) return "";
  if (!player.pos) return `Zu ${player.n} ist keine Position hinterlegt — such dir jemand anderen.`;
  if (player.pos !== slot.pos) return `${player.n} ist ${POS_LABEL[player.pos]}, gesucht ist ${POS_LABEL[slot.pos]}.`;
  return `${player.n} erfüllt „${slot.def.name}" nicht.`;
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

// { formation, slots: [{ pos, def, x, y }] } — deterministisch aus dem Datum.
export function buildEleven(dateStr, players, maxTries = 40) {
  const pool = elevenPool(players);
  const formation = formationFor(dateStr);
  const layout = slotLayout(formation);
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const rnd = mulberry32(hashStr(attempt === 1 ? `elf:${dateStr}` : `elf:${dateStr}#${attempt}`));
    const used = new Set();
    const slots = [];
    let ok = true;

    for (const { pos, x, y } of layout) {
      // Bedingungen mit genug Auswahl für genau diese Position
      const fits = CHAIN_DEFS.filter((d) => {
        const k = `${d.type}:${d.key}`;
        if (used.has(k)) return false;
        return slotCandidates(players, pool, pos, d).length >= ELEVEN_MIN_CANDIDATES;
      });
      if (!fits.length) { ok = false; break; }
      const def = fits[Math.floor(rnd() * fits.length)];
      used.add(`${def.type}:${def.key}`);
      slots.push({ pos, def, x, y });
    }
    if (!ok) continue;

    const lists = slots.map((s) => slotCandidates(players, pool, s.pos, s.def));
    if (hasPerfectMatching(lists)) return { formation, slots };
  }
  return { formation, slots: [] }; // in der Praxis unerreichbar; Tests decken 30 Tage ab
}
