/* Abzeichen — reine Logik (kein React).

   DIESELBE ENTWURFSREGEL WIE BEI DEN MISSIONEN: Ein Abzeichen darf nur verlangen,
   was sich aus dem MESSEN LÄSST, WAS OHNEHIN GESPEICHERT WIRD. Deshalb braucht
   diese Datei keinen eigenen Speicher, kein Nachhalten von Ereignissen und keine
   Migration — sie rechnet bei jedem Aufruf aus den Statistiken, die seit Monaten
   mitlaufen. Wer vorher schon fünfzig Rätsel gelöst hat, bekommt seine Abzeichen
   rückwirkend.

   Der Preis dieser Regel: Manches, was ein schönes Abzeichen wäre, geht nicht.
   „Drei Combos in Folge" oder „einen Verein genannt, den sonst niemand kennt"
   verlangt Ereignisse aus dem Spielverlauf. Solche Abzeichen kommen, wenn die
   Modi Ereignisse melden — vorher wäre die Fortschrittsanzeige eine Behauptung.

   ZUSCHNITT: leichte Abzeichen als früher Anreiz, mittlere als Ziel für ein paar
   Wochen, harte als Fernziel. Jeder der acht Modi kommt mindestens einmal vor,
   damit die Sammlung durch alle Modi zieht statt den Lieblingsmodus zu belohnen. */
import { collectStats, totals } from "./stats.js";

const read = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };

/** Alles, worauf Abzeichen zugreifen dürfen — einmal gelesen, an alle gereicht. */
export function badgeStand(leser = read, entries = collectStats()) {
  const t = totals(entries);
  return {
    raetsel: t.played,
    modi: t.modes,
    serie: t.bestStreak,
    daily: leser("pp:dailyStats") || {},
    eleven: leser("pp:elevenStats") || {},
    career: leser("pp:careerStats") || {},
    odd: leser("pp:oddStats") || {},
    chain: leser("pp:chainStats") || {},
    hex: leser("pp:soloStats") || {},
    heat: leser("pp:heatBest") || {},
    carousel: leser("pp:carouselStats") || {},
  };
}

/* `ziel` ist der Wert, ab dem das Abzeichen sitzt; `wert` liest ihn aus dem Stand.
   Beides getrennt, damit die Anzeige einen Fortschritt zeigen kann statt nur
   „hast du / hast du nicht". */
export const BADGES = [
  { id: "erste",       icon: "star",     name: "Erster Treffer",   text: "Löse dein erstes Rätsel",              ziel: 1,   xp: 20,  wert: (s) => s.raetsel },
  { id: "stamm",       icon: "medal",    name: "Stammspieler",     text: "50 Rätsel gespielt",                   ziel: 50,  xp: 60,  wert: (s) => s.raetsel },
  { id: "dauerlaeufer",icon: "cup",      name: "Dauerläufer",      text: "250 Rätsel gespielt",                  ziel: 250, xp: 200, wert: (s) => s.raetsel },
  { id: "allrounder",  icon: "network",  name: "Alleskönner",      text: "Alle acht Modi mindestens einmal",     ziel: 8,   xp: 120, wert: (s) => s.modi },

  { id: "serie7",      icon: "streak",   name: "Serientäter",      text: "Sieben Tage in Folge",                 ziel: 7,   xp: 80,  wert: (s) => s.serie },
  { id: "serie30",     icon: "crown",    name: "Unbeugsam",        text: "Dreißig Tage in Folge",                ziel: 30,  xp: 300, wert: (s) => s.serie },

  { id: "detektiv",    icon: "guess",    name: "Detektiv",         text: "25× den Daily-Star geknackt",          ziel: 25,  xp: 120, wert: (s) => s.daily.wins || 0 },
  { id: "elf",         icon: "jersey",   name: "Elf Freunde",      text: "10× die Elf des Tages komplett",       ziel: 10,  xp: 100, wert: (s) => s.eleven.solved || 0 },
  { id: "spurleser",   icon: "route",    name: "Spurleser",        text: "Karriere-Pfad nach zwei Stationen",    ziel: 1,   xp: 90,
    wert: (s) => (s.career.best && s.career.best <= 2 ? 1 : 0) },
  { id: "adlerauge",   icon: "odd",      name: "Adlerauge",        text: "Zehn Treffer in Folge bei „Wer passt nicht?\u201c", ziel: 10, xp: 90, wert: (s) => s.odd.best || 0 },
  { id: "kette20",     icon: "chain",    name: "Kettenreaktion",   text: "Eine Kette mit 20 Spielern",           ziel: 20,  xp: 110, wert: (s) => s.chain.best || 0 },
  { id: "perfekt",     icon: "hex",      name: "Perfektionist",    text: "Ein Hex-Board ohne Fehlversuch",       ziel: 1,   xp: 70,  wert: (s) => s.hex.perfect || 0 },
  { id: "perfekt5",    icon: "trophy",   name: "Makellos",         text: "Fünf Boards ohne Fehlversuch",         ziel: 5,   xp: 160, wert: (s) => s.hex.perfect || 0 },
  { id: "gluehend",    icon: "flame",    name: "Durchgeglüht",     text: "Heat Density von 2,00",                ziel: 200, xp: 130,
    // ×100, weil der Fortschrittsbalken mit ganzen Zahlen rechnet
    wert: (s) => Math.round((s.heat.density || 0) * 100) },
  { id: "feuerwerk",   icon: "grid",     name: "Feuerwerk",        text: "80 Punkte in der Heatmap",             ziel: 80,  xp: 140, wert: (s) => s.heat.score || 0 },
  { id: "karussell",   icon: "carousel", name: "Drehschwindel",    text: "Zehn Siege im Transferkarussell",      ziel: 10,  xp: 110, wert: (s) => s.carousel.won || 0 },
];

/** Fortschritt eines Abzeichens. */
export function stand(badge, s) {
  const jetzt = Math.min(badge.ziel, badge.wert(s));
  return { jetzt, ziel: badge.ziel, fertig: jetzt >= badge.ziel, anteil: jetzt / badge.ziel };
}

/** Alle Abzeichen mit Fortschritt — erreichte zuerst, dann die nächstliegenden. */
export function alleBadges(s = badgeStand()) {
  return BADGES.map((b) => ({ ...b, ...stand(b, s) }))
    .sort((a, b) => (b.fertig - a.fertig) || (b.anteil - a.anteil) || a.ziel - b.ziel);
}

export const erreichteAnzahl = (s = badgeStand()) => BADGES.filter((b) => stand(b, s).fertig).length;

/** XP aus erreichten Abzeichen — fließt in die Gesamtrechnung ein. */
export const badgeXp = (s = badgeStand()) =>
  BADGES.reduce((n, b) => n + (stand(b, s).fertig ? b.xp : 0), 0);
