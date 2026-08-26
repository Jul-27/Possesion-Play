/* „Elf des Tages" — reine Logik (kein React).
   Elf Positionen mit je einer Bedingung. Ausgegeben wird ein Rätsel nur, wenn sich
   nachweislich elf VERSCHIEDENE Spieler darauf verteilen lassen (bipartites Matching). */
import { playerMatchesHex, POS_LABEL } from "./gameData.js";
import { CHAIN_DEFS } from "./chain.js";
import { passtAufPosition, posName, posGruppe } from "./positions.js";

export const ELEVEN_SL_MIN = 40;        // Generierungspool: garantiert eine Lösung aus bekannten Spielern
export const ELEVEN_MIN_CANDIDATES = 8; // Mindestauswahl je Position

/* Eine Formation ist ihre Linienfolge von hinten nach vorne, und jede Linie nennt
   jetzt ECHTE Positionen statt viermal dieselbe Gruppe. Vorher hieß eine Viererkette
   „ABW, ABW, ABW, ABW" — das ist keine Kette, sondern vier Abwehrspieler. Jetzt steht
   dort Linksverteidiger, Innenverteidiger, Innenverteidiger, Rechtsverteidiger.

   WELCHE POSITIONEN VORKOMMEN, ist gemessen und nicht gewählt. Im Pool (sl >= 40,
   2196 Spieler) tragen nur 46 % eine belegte genaue Position; streng gefordert hätten
   Mittelstürmer und Linksaußen KEINE einzige Bedingung mit den nötigen acht
   Kandidaten. Deshalb greift überall der Rückfall aus positions.js: Wer keine genaue
   Position hinterlegt hat, zählt über seine grobe Gruppe mit. Ein
   Innenverteidiger-Feld nimmt damit 427 statt aller rund 640 Abwehrspieler des Pools
   — deutlich schärfer als vorher, ohne jemanden auszusperren, nur weil die Wikipedia
   zu ihm schweigt. */
export const FORMATIONS = [
  { name: "4-4-2",   lines: [["TW"],["LV","IV","IV","RV"],["LM","ZM","ZM","RM"],["MS","MS"]] },
  { name: "4-3-3",   lines: [["TW"],["LV","IV","IV","RV"],["DM","ZM","OM"],["LA","MS","RA"]] },
  { name: "3-5-2",   lines: [["TW"],["IV","IV","IV"],["LM","DM","ZM","OM","RM"],["MS","HS"]] },
  { name: "4-2-3-1", lines: [["TW"],["LV","IV","IV","RV"],["DM","DM"],["LA","OM","RA"],["MS"]] },
  { name: "5-3-2",   lines: [["TW"],["LV","IV","IV","IV","RV"],["DM","ZM","OM"],["MS","HS"]] },
  { name: "3-4-3",   lines: [["TW"],["IV","IV","IV"],["LM","DM","ZM","RM"],["LA","MS","RA"]] },
];

// Positionsfolge einer Formation (Reihenfolge = Slot-Index, hinten nach vorne).
export function formationPositions(f) {
  return f.lines.flat();
}

/* Koordinaten in Prozent: Tor unten (y groß), Sturm oben. Innerhalb einer Linie
   gleichmäßig verteilt, damit auch 5er-Reihen sauber sitzen. */
export function slotLayout(f) {
  const rows = f.lines.length;
  const out = [];
  f.lines.forEach((linie, li) => {
    // 90 % (Torwart, im eigenen Strafraum) bis 18 % — die vorderste Linie bleibt VOR
    // dem gegnerischen Strafraum (der endet bei ~14 %), sonst stehen Stürmer im Tor.
    const y = rows > 1 ? 90 - (li / (rows - 1)) * 72 : 50;
    linie.forEach((pos, k) => out.push({ pos, x: ((k + 1) / (linie.length + 1)) * 100, y }));
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
    if (passtAufPosition(p.pp, pos, p.pos) && playerMatchesHex(p, def)) out.push(i);
  }
  return out;
}

export function elevenAccepts(player, slot) {
  if (!player || !slot) return false;
  return passtAufPosition(player.pp, slot.pos, player.pos) && playerMatchesHex(player, slot.def);
}

/* Begründung einer Ablehnung. Zwei Fälle brauchen einen eigenen Satz.

   OHNE POSITION: vorher stand dort „X ist undefined, gesucht ist Torwart" — das las
   sich wie ein Fehler im Spiel und nicht wie eine Lücke im Datensatz.

   FALSCHE GENAUE POSITION: Seit die Felder echte Positionen fordern, wird ein
   Linksverteidiger auf einem Innenverteidiger-Feld abgelehnt, ein Abwehrspieler ohne
   hinterlegte Feinposition dagegen angenommen. Das wirkt willkürlich, wenn man es
   nicht ausspricht — deshalb nennt der Satz die Position, die wir zu ihm führen. */
export function elevenReason(player, slot) {
  if (!player || !slot) return "";
  if (!player.pos) return `Zu ${player.n} ist keine Position hinterlegt — such dir jemand anderen.`;
  const gesucht = posName(slot.pos);
  if (!passtAufPosition(player.pp, slot.pos, player.pos)) {
    const seine = player.pp?.length
      ? player.pp.map(posName).join(" und ")
      : POS_LABEL[player.pos];
    return `${player.n} ist ${seine}, gesucht ist ${gesucht}.`;
  }
  return `${player.n} erfüllt „${slot.def.name}" nicht.`;
}

/** Die grobe Gruppe eines Feldes — für Trikotfarbe und Sortierung in der Ansicht. */
export const slotGruppe = (pos) => posGruppe(pos) || pos;

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
