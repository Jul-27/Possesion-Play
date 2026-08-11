/* Karriere-Pfad — reine Logik (kein React).

   Stationen kommen aus zwei Quellen, in dieser Reihenfolge:
   1. careerPathClubs.js — die volle, datierte Karriere aus Wikidata. Damit beginnt
      Gündoğans Pfad bei Bochum und Nürnberg statt erst bei Dortmund.
   2. das Feld `cp` in players.js — nur die 47 Spielvereine. Fällt ein, wenn die
      Wikidata-Abfrage einen Spieler nicht getroffen hat; sonst wäre er plötzlich
      kein Rätsel mehr, obwohl er es vorher war. */
import { norm, CLUBS } from "./gameData.js";

export const CAREER_SL_MIN = 40;       // Mindest-Bekanntheit, damit ratbar
export const CAREER_MIN_STATIONS = 3;  // mind. so viele Stationen (Rückkehr zählt eigenständig)

const END = (to) => (to === 0 ? 9999 : to); // 0 = bis heute
const NAME_VON_KEY = new Map(CLUBS.map((c) => [c.key, c.name]));
const KEY_VON_NAME = new Map(CLUBS.map((c) => [norm(c.name), c.key]));
const spielerSchluessel = (p) => norm(p.n) + "|" + p.by;

/* Überlappende oder anschließende Spells desselben Vereins verschmelzen — Wikidata
   führt Leihen und Vertragsverlängerungen doppelt. Echte Rückkehrer nach einer Lücke
   bleiben eigene Stationen: Gündoğan war zweimal bei Manchester City, und genau das
   macht seinen Pfad interessant. */
function verschmelzen(roh) {
  const sortiert = [...roh].sort((a, b) => a.from - b.from || a.name.localeCompare(b.name));
  const out = [];
  for (const s of sortiert) {
    const prev = out.find((x) => x.name === s.name && s.from <= END(x.to));
    if (prev) { prev.to = prev.to === 0 || s.to === 0 ? 0 : Math.max(prev.to, s.to); continue; }
    out.push({ ...s });
  }
  return out.sort((a, b) => a.from - b.from || a.name.localeCompare(b.name));
}

/** Stationen chronologisch: { club (47er-Kürzel oder null), name, from, to }. */
export function careerStations(player, dated = null) {
  const voll = dated?.byKey?.[spielerSchluessel(player)];
  const roh = voll?.length
    ? voll.map(([i, from, to]) => ({ name: dated.clubs[i], from, to }))
    : (player?.cp || []).map(([key, from, to]) => ({ name: NAME_VON_KEY.get(key) || key, from, to }));
  // Das Kürzel entscheidet nur darüber, ob ein Wappen existiert.
  return verschmelzen(roh).map((s) => ({ ...s, club: KEY_VON_NAME.get(norm(s.name)) || null }));
}

/** Indizes aller Spieler, die sich als Rätsel eignen (nach dem Verschmelzen). */
export function careerCandidates(players, dated = null) {
  const out = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if ((p.sl || 0) < CAREER_SL_MIN) continue;
    if (careerStations(p, dated).length >= CAREER_MIN_STATIONS) out.push(i);
  }
  return out;
}

/** Zufälliger Kandidat (rnd injizierbar für Tests). */
export function pickCareerIndex(players, rnd = Math.random, dated = null) {
  const cand = careerCandidates(players, dated);
  if (!cand.length) return -1;
  return cand[Math.min(cand.length - 1, Math.floor(rnd() * cand.length))];
}
