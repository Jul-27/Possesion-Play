/* Fortschritt über ALLE Modi — reine Logik (kein React).

   Das Problem, das diese Datei löst: Bisher zählt jeder Modus für sich
   (pp:heatBest, pp:chainStats, pp:careerStats …). Zwölf Inseln, aber keine Zahl,
   die über allem steht und wächst. Genau daran fehlt es der Lobby.

   XP kommt aus dem, was ohnehin schon gezählt wird — kein neuer Speicher, keine
   Migration, und alte Spielstände zählen rückwirkend mit. */
import { collectStats, totals } from "./stats.js";
import { challengeState, CHALLENGE_MODES } from "./dailyChallenge.js";

/* Fußball-Stufen statt „Level 7". Die Schwellen wachsen, aber nicht brutal: die
   erste Stufe nach ein paar Rätseln, die letzte als echtes Fernziel. */
export const STUFEN = [
  { ab: 0,    name: "Amateur",         kurz: "AM" },
  { ab: 150,  name: "Landesliga",      kurz: "LL" },
  { ab: 400,  name: "Regionalliga",    kurz: "RL" },
  { ab: 800,  name: "Zweitligist",     kurz: "2L" },
  { ab: 1500, name: "Bundesligist",    kurz: "BL" },
  { ab: 2600, name: "Nationalspieler", kurz: "NT" },
  { ab: 4200, name: "Legende",         kurz: "LG" },
];

/** Stufe, Fortschritt zur nächsten und der Rest in XP. */
export function stufeFuer(xp) {
  let i = 0;
  while (i + 1 < STUFEN.length && xp >= STUFEN[i + 1].ab) i++;
  const jetzt = STUFEN[i], naechste = STUFEN[i + 1] || null;
  if (!naechste) return { ...jetzt, nummer: i + 1, anteil: 1, bisNaechste: 0, naechste: null };
  const spanne = naechste.ab - jetzt.ab;
  return {
    ...jetzt,
    nummer: i + 1,
    naechste,
    bisNaechste: naechste.ab - xp,
    anteil: Math.min(1, Math.max(0, (xp - jetzt.ab) / spanne)),
  };
}

/* XP-Formel. Bewusst simpel und nachvollziehbar: ein gespieltes Rätsel zählt, eine
   Serie zählt stärker, und wer viele verschiedene Modi anfasst, bekommt einen
   Bonus — das ist der Effekt, den wir wollen (raus aus dem Lieblingsmodus). */
export const XP_PRO_RAETSEL = 10;
export const XP_PRO_SERIENTAG = 15;
export const XP_PRO_MODUS = 25;

export function berechneXp(entries = collectStats()) {
  const t = totals(entries);
  const serien = entries.reduce((s, e) => s + (e.streak || 0), 0);
  return {
    xp: t.played * XP_PRO_RAETSEL + serien * XP_PRO_SERIENTAG + t.modes * XP_PRO_MODUS,
    raetsel: t.played,
    modi: t.modes,
    serienTage: serien,
  };
}

/* Tagesserie über ALLES statt je Modus: „heute mindestens ein Tagesrätsel gelöst".
   Die längste Einzelserie ist der ehrlichste Näherungswert dafür — wer täglich
   spielt, hält mindestens eine davon am Leben. */
export function tagesserie(entries = collectStats()) {
  return entries.reduce((m, e) => Math.max(m, e.streak || 0), 0);
}

/* Wie viele Tagesrätsel sind heute noch offen? EINE Zahl, die zum Handeln auffordert
   — sieben gleiche „heute offen"-Abzeichen tun das nicht. */
export function offeneHeute(modi = CHALLENGE_MODES) {
  return modi.filter((m) => !challengeState(m)).length;
}

/** Tagesmissionen, aus dem Datum abgeleitet — für alle gleich, ohne Server. */
export const MISSIONEN = [
  { id: "drei-modi",   text: "Spiele drei verschiedene Modi",      ziel: 3 },
  { id: "ohne-fehler", text: "Löse ein Rätsel ohne Fehlversuch",   ziel: 1 },
  { id: "combo",       text: "Erreiche eine Combo aus 4 Feldern",  ziel: 1 },
  { id: "kette",       text: "Baue eine Kette mit 12 Spielern",    ziel: 12 },
  { id: "duell",       text: "Spiele ein Duell gegen einen Freund", ziel: 1 },
  { id: "perfekt",     text: "Löse ein Board ohne Fehlversuch",    ziel: 1 },
];

/** Drei Missionen des Tages, deterministisch aus dem Datum. */
export function missionenDesTages(rnd) {
  const rest = [...MISSIONEN];
  const out = [];
  for (let i = 0; i < 3 && rest.length; i++) out.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]);
  return out;
}
