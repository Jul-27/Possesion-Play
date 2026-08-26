/* Vereins-Index für „Transferkarussell" — reine Logik, kein React.

   Das Spiel braucht beide Richtungen: „bei welchen Vereinen war dieser Spieler?" und
   „wer hat bei diesem Verein gespielt?". Die zweite ist der Grund für den Index —
   ohne ihn müsste der Bot für jeden Zug 31.565 Spieler durchgehen.

   Vereine sind hier NAMEN, keine Schlüssel. Die 47 Spielvereine haben Kürzel und
   Wappen, weil sie Hexfelder tragen; die restlichen Tausend gibt es nur als Namen.
   Der Index führt beide zusammen und bevorzugt dabei die Schreibweise aus CLUBS,
   damit „FC Bayern München" nicht zweimal mit unterschiedlicher Schreibung auftaucht. */
import { norm, CLUBS } from "./gameData.js";
import { kanonischerVereinsname } from "./clubNames.js";

const spielerSchluessel = (p) => norm(p.n) + "|" + p.by;

/* Kurzformen, damit getippte Eingaben treffen. Die Liste deckt nur die 47
   Spielvereine ab — bei den übrigen Tausend genügt der Name, weil die Vorschlagsliste
   beim Tippen ohnehin mitsucht. */
export const KURZFORMEN = {
  FCB: ["bayern", "fc bayern"], BVB: ["dortmund"], BMG: ["gladbach", "monchengladbach"],
  RBL: ["leipzig"], B04: ["leverkusen", "bayer leverkusen"], SGE: ["frankfurt", "eintracht"],
  VFB: ["stuttgart"], WOB: ["wolfsburg"], SVW: ["werder", "bremen"], S04: ["schalke"],
  HSV: ["hamburg", "hsv"], M05: ["mainz"], SCF: ["freiburg"], TSG: ["hoffenheim"],
  MCI: ["man city", "city"], MUN: ["man united", "united", "man utd"], LIV: ["liverpool"],
  CHE: ["chelsea"], ARS: ["arsenal"], TOT: ["tottenham", "spurs"], NEW: ["newcastle"],
  EVE: ["everton"], AVL: ["villa", "aston villa"], BAR: ["barcelona", "barca"],
  RMA: ["real", "real madrid"], ATM: ["atletico", "atleti", "atletico madrid"],
  SEV: ["sevilla"], VAL: ["valencia"], VIL: ["villarreal"], JUV: ["juventus", "juve"],
  MIL: ["milan", "ac milan"], INT: ["inter", "internazionale"], NAP: ["napoli", "neapel"],
  ROM: ["roma", "as rom"], LAZ: ["lazio"], PSG: ["psg", "paris", "paris sg"],
  ASM: ["monaco"], OM: ["marseille", "om"], OL: ["lyon", "ol"], LIL: ["lille"],
  POR: ["porto"], SLB: ["benfica"], SCP: ["sporting", "sporting cp"], AJA: ["ajax"],
  PSV: ["psv", "eindhoven"], FEY: ["feyenoord"], RBS: ["salzburg", "rb salzburg"],
};

/**
 * @param players  die volle Spielerliste
 * @param clubs    CAREER_CLUBS — Namensliste aus careerClubs.js
 * @param byKey    CAREER_BY_KEY — "norm|by" -> Indizes in clubs
 */
export function createCareerIndex(players, clubs = [], byKey = {}) {
  const spielNameVonKey = new Map(CLUBS.map((c) => [c.key, c.name]));
  const keyVonSpielName = new Map(CLUBS.map((c) => [norm(c.name), c.key]));

  // Verein -> Spieler. Gleichzeitig je Spieler die Namensliste seiner Stationen.
  const vonSpieler = new Map();
  const vonVerein = new Map();
  const merke = (schluessel, spieler, name) => {
    const s = vonSpieler.get(schluessel) || vonSpieler.set(schluessel, new Set()).get(schluessel);
    if (s.has(name)) return;
    s.add(name);
    (vonVerein.get(name) || vonVerein.set(name, []).get(name)).push(spieler);
  };

  for (const p of players) {
    const k = spielerSchluessel(p);
    /* Über kanonischerVereinsname, weil careerClubs.js denselben Verein unter zwei
       Namen führt: „Arsenal" (unser Spielname) und „FC Arsenal" (Wikidatas Label).
       Ohne diese Zusammenführung zählten sie als zwei Vereine, und die
       Verbrannte-Vereine-Regel des Karussells ließe sich damit umgehen. */
    for (const i of byKey[k] || []) { const n = clubs[i]; if (n) merke(k, p, kanonischerVereinsname(n)); }
    /* Auch ohne Karrieredaten spielbar bleiben: die kuratierten 47 Vereine gelten
       immer. Sonst verlöre ein Spieler ohne Wikidata-Treffer alle Stationen. */
    for (const key of p.clubs || []) { const n = spielNameVonKey.get(key); if (n) merke(k, p, n); }
  }

  const alleVereine = [...vonVerein.keys()].sort((a, b) => a.localeCompare(b, "de"));

  // Suchtabelle: normalisierter Name/Kürzel/Kurzform -> Vereinsname
  const suchtabelle = new Map();
  for (const n of alleVereine) suchtabelle.set(norm(n), n);
  /* Kürzel und Kurzformen nur für Vereine eintragen, die auch wirklich im Index
     stehen — sonst gäbe match() einen Verein zurück, zu dem es keinen Spieler gibt. */
  for (const c of CLUBS) {
    if (!vonVerein.has(c.name)) continue;
    suchtabelle.set(norm(c.key), c.name);
    for (const kurz of KURZFORMEN[c.key] || []) suchtabelle.set(norm(kurz), c.name);
  }

  const groesse = (n) => (vonVerein.get(n) || []).length;
  /* Treffer nach Wortanfang, sortiert nach Bekanntheit und dann nach Kürze. Die
     Sortierung ist der Grund, warum „inter" zuerst Inter Mailand zeigt. */
  const passende = (q) => alleVereine
    .filter((n) => { const nn = norm(n); return nn.startsWith(q) || nn.includes(" " + q); })
    .sort((a, b) => groesse(b) - groesse(a) || a.length - b.length);

  return {
    alleVereine,
    /** Stationen eines Spielers, alphabetisch. */
    clubsOf(p) {
      const s = p && vonSpieler.get(spielerSchluessel(p));
      return s ? [...s].sort((a, b) => a.localeCompare(b, "de")) : [];
    },
    /** Alle Spieler eines Vereins. */
    playersOf(name) { return vonVerein.get(name) || []; },
    /** Kürzel der 47 Spielvereine, sonst null — nur die haben ein Wappen. */
    keyOf(name) { return keyVonSpielName.get(norm(name)) || null; },
    /* Getippten Text auf einen Vereinsnamen abbilden. Exakt zuerst; sonst über
       Wortanfänge. Bei 8158 Vereinen kann keine Kurzformen-Tabelle mehr alles
       abdecken — „Nürnberg" und „Galatasaray" müssen aber treffen, denn genau so
       tippt man im Spiel. Mehrdeutigkeit entscheidet die Bekanntheit, gemessen an
       der Zahl der Spieler: „1. FC Nürnberg" hat 289, „Post SV Nürnberg" zwei. Nur
       wenn kein Kandidat klar dominiert, wird abgelehnt und die Vorschlagsliste
       muss entscheiden. */
    match(text) {
      const q = norm(String(text || "").trim());
      if (!q) return null;
      const exakt = suchtabelle.get(q);
      if (exakt) return exakt;
      const kandidaten = passende(q);
      if (!kandidaten.length) return null;
      if (kandidaten.length === 1) return kandidaten[0];
      const [a, b] = kandidaten;
      return groesse(a) >= 3 * groesse(b) ? a : null;
    },
    /** Vorschläge beim Tippen — die bekanntesten zuerst. */
    suggest(text, limit = 8) {
      const q = norm(String(text || "").trim());
      if (q.length < 2) return [];
      const treffer = passende(q);
      const exakt = suchtabelle.get(q);
      if (exakt && !treffer.includes(exakt)) treffer.unshift(exakt);
      return treffer.slice(0, limit);
    },
  };
}
