/* „Transferkarussell" — reine Logik (kein React, kein Supabase).
   Eine Kette wechselt zwischen Spieler und Verein: Spieler → Verein, bei dem er
   gespielt hat → nächster Spieler dieses Vereins → dessen nächster Verein → …

   DREI REGELN, die das Spiel überhaupt erst spielbar machen (alle gemessen, siehe
   Kommentare an der jeweiligen Funktion):
   1. Genannte Vereine UND Spieler sind danach verbrannt. Ohne das endet keine Runde —
      Messi → Barça → Xavi → Barça → Iniesta → Barça … (400 simulierte Runden, keine
      einzige beendet).
   2. Ein genannter Spieler muss mindestens einen unverbrannten Verein übrig lassen.
      Ohne das gewinnt der Spieler-Nenner nach drei Zügen: 25.720 der 31.565 Spieler
      haben nur einen Verein, und wer so einen nennt, lässt dem Gegner nichts.
   3. Die Rollen wechseln nach jedem Zugpaar (A · B · B · A · A · B …), nicht erst nach
      einem verlorenen Leben. Wer Vereine nennt, hat 2–5 Möglichkeiten, wer Spieler
      nennt, im Schnitt 700 — dieselbe Rolle eine ganze Runde lang wäre unfair. */

export const CAROUSEL_SECONDS = 30;   // Bedenkzeit je Zug
export const CAROUSEL_LIVES = 3;

/* Bot-Stärke = Bekanntheitsgrenze seines Wissens. Der Mensch darf immer alles nennen,
   was in den Daten steht; nur der Bot ist eingeschränkt. */
export const BOT_LEVELS = [
  { key: "leicht", name: "Leicht", minSl: 55, hint: "kennt nur die ganz Großen" },
  { key: "mittel", name: "Mittel", minSl: 25, hint: "kennt die meisten Stammspieler" },
  { key: "schwer", name: "Schwer", minSl: 0,  hint: "kennt jeden im Datensatz" },
];
export const botLevel = (key) => BOT_LEVELS.find((l) => l.key === key) || BOT_LEVELS[1];

/** Zugart nach Position in der Kette: gerade Züge sind Spieler, ungerade Vereine. */
export function moveKind(i) {
  return i % 2 === 0 ? "player" : "club";
}

/* Wer ist am Zug? Muster A · B · B · A · A · B · B … — der Eröffnende nennt nur den
   ersten Spieler, danach übernimmt jeder abwechselnd ein ganzes Paar aus Verein und
   Spieler. Damit macht jede Seite gleich oft den schweren und den leichten Teil. */
export function moveOwner(i, starter = 0) {
  if (i <= 0) return starter;
  return Math.floor((i - 1) / 2) % 2 === 0 ? 1 - starter : starter;
}

/** Unverbrannte Vereine eines Spielers — die Auswahl des Vereins-Nenners. */
export function freeClubs(player, burnedClubs) {
  return (player?.clubs || []).filter((c) => !burnedClubs.has(c));
}

/* Darf dieser Spieler genannt werden? `burnedClubs` enthält den aktuellen Verein
   bereits — die Prüfung auf einen freien Verein ist damit genau Regel 2. */
export function isPlayerLegal(player, club, burnedClubs, burnedPlayers) {
  if (!player || !club) return false;
  if (!(player.clubs || []).includes(club)) return false;
  if (burnedPlayers.has(player.n)) return false;
  return freeClubs(player, burnedClubs).length > 0;
}

/** Alle erlaubten Antworten auf einen Verein, optional auf bekannte Spieler begrenzt. */
export function legalPlayers(players, club, burnedClubs, burnedPlayers, minSl = 0) {
  const out = [];
  for (const p of players) {
    if ((p.sl || 0) < minSl) continue;
    if (isPlayerLegal(p, club, burnedClubs, burnedPlayers)) out.push(p);
  }
  return out;
}

/* Eröffnung: mindestens zwei Vereine, damit die Kette nicht sofort im Kreis läuft,
   und bekannt genug, dass der Gegner überhaupt etwas damit anfangen kann. */
export const START_SL_MIN = 45;
export function startCandidates(players, minSl = START_SL_MIN) {
  return players.filter((p) => (p.clubs || []).length >= 2 && (p.sl || 0) >= minSl);
}
export function pickStart(players, rnd = Math.random, minSl = START_SL_MIN) {
  const pool = startCandidates(players, minSl);
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}

/* Bot-Vereinswahl. Er spielt nicht optimal, sondern nachvollziehbar: auf „schwer"
   wählt er den Verein, der dem Gegner die wenigsten Antworten lässt, sonst zufällig.
   Ein perfekt spielender Bot wäre unschlagbar und kein Übungspartner. */
export function botClubMove(players, player, burnedClubs, burnedPlayers, rnd = Math.random, level = "mittel") {
  const frei = freeClubs(player, burnedClubs);
  if (!frei.length) return null;
  if (level !== "schwer" || frei.length === 1) return frei[Math.floor(rnd() * frei.length)];
  let beste = frei[0], wenigste = Infinity;
  for (const c of frei) {
    const naechste = new Set(burnedClubs); naechste.add(c);
    const n = legalPlayers(players, c, naechste, burnedPlayers).length;
    if (n < wenigste) { wenigste = n; beste = c; }
  }
  return beste;
}

/* Bot-Spielerwahl. Innerhalb seines Wissens bevorzugt er auf „schwer" Spieler mit
   wenigen freien Vereinen — das ist der Zug, der den Gegner in die Enge treibt. */
export function botPlayerMove(players, club, burnedClubs, burnedPlayers, rnd = Math.random, level = "mittel") {
  const { minSl } = botLevel(level);
  const kandidaten = legalPlayers(players, club, burnedClubs, burnedPlayers, minSl);
  if (!kandidaten.length) return null;
  if (level !== "schwer") return kandidaten[Math.floor(rnd() * kandidaten.length)];
  const eng = Math.min(...kandidaten.map((p) => freeClubs(p, burnedClubs).length));
  const beste = kandidaten.filter((p) => freeClubs(p, burnedClubs).length === eng);
  return beste[Math.floor(rnd() * beste.length)];
}

/** Was wäre möglich gewesen? Für die Auflösung nach einem verlorenen Leben. */
export function carouselHint(players, kind, current, burnedClubs, burnedPlayers) {
  if (kind === "club") {
    const frei = freeClubs(current, burnedClubs);
    return frei.length ? { club: frei[0] } : null;
  }
  // bekannteste erlaubte Antwort — die hilft am meisten beim Lernen
  const kandidaten = legalPlayers(players, current, burnedClubs, burnedPlayers);
  if (!kandidaten.length) return null;
  return { player: kandidaten.reduce((a, b) => ((b.sl || 0) > (a.sl || 0) ? b : a)) };
}

/* ── Vereinseingabe ───────────────────────────────────────────────────────────
   Der Verein wird getippt, nicht aus einer Liste geklickt: bei 47 Vereinen wäre eine
   vollständige Auswahlliste ein Spickzettel, mit dem man sich durchprobieren könnte.
   Erkannt werden der volle Name, das Kürzel und gängige Kurzformen. */
const KURZFORMEN = {
  FCB: ["bayern", "fc bayern", "bayern munchen", "bayern muenchen"],
  BVB: ["dortmund", "borussia dortmund"],
  BMG: ["gladbach", "monchengladbach", "moenchengladbach", "borussia monchengladbach"],
  RBL: ["leipzig", "rb leipzig"],
  B04: ["leverkusen", "bayer leverkusen", "bayer 04"],
  SGE: ["frankfurt", "eintracht", "eintracht frankfurt"],
  VFB: ["stuttgart", "vfb stuttgart"],
  WOB: ["wolfsburg", "vfl wolfsburg"],
  SVW: ["werder", "bremen", "werder bremen"],
  S04: ["schalke", "schalke 04", "fc schalke"],
  HSV: ["hamburg", "hamburger sv", "hsv"],
  M05: ["mainz", "mainz 05", "fsv mainz"],
  SCF: ["freiburg", "sc freiburg"],
  TSG: ["hoffenheim", "tsg hoffenheim", "1899 hoffenheim"],
  MCI: ["man city", "manchester city", "city"],
  MUN: ["man united", "manchester united", "united", "man utd"],
  LIV: ["liverpool", "fc liverpool"],
  CHE: ["chelsea", "fc chelsea"],
  ARS: ["arsenal", "fc arsenal"],
  TOT: ["tottenham", "spurs"],
  NEW: ["newcastle", "newcastle united"],
  EVE: ["everton", "fc everton"],
  AVL: ["aston villa", "villa"],
  BAR: ["barcelona", "barca", "fc barcelona"],
  RMA: ["real", "real madrid"],
  ATM: ["atletico", "atletico madrid", "atleti"],
  SEV: ["sevilla", "fc sevilla"],
  VAL: ["valencia", "fc valencia"],
  VIL: ["villarreal", "fc villarreal"],
  JUV: ["juventus", "juve", "juventus turin"],
  MIL: ["milan", "ac milan", "ac mailand"],
  INT: ["inter", "inter mailand", "internazionale"],
  NAP: ["napoli", "neapel", "ssc neapel"],
  ROM: ["roma", "as rom", "as roma"],
  LAZ: ["lazio", "lazio rom"],
  PSG: ["psg", "paris", "paris saint-germain", "paris sg"],
  ASM: ["monaco", "as monaco"],
  OM: ["marseille", "olympique marseille", "om"],
  OL: ["lyon", "olympique lyon", "ol"],
  LIL: ["lille", "osc lille"],
  POR: ["porto", "fc porto"],
  SLB: ["benfica", "benfica lissabon"],
  SCP: ["sporting", "sporting lissabon", "sporting cp"],
  AJA: ["ajax", "ajax amsterdam"],
  PSV: ["psv", "psv eindhoven", "eindhoven"],
  FEY: ["feyenoord", "feyenoord rotterdam"],
  RBS: ["salzburg", "red bull salzburg", "rb salzburg"],
};

/** Getippten Text auf einen Vereinsschlüssel abbilden — null, wenn nichts passt. */
export function matchClub(input, clubs, norm) {
  const q = norm(String(input || "").trim());
  if (!q) return null;
  for (const c of clubs) {
    if (norm(c.name) === q || norm(c.key) === q || norm(c.label) === q) return c.key;
    if ((KURZFORMEN[c.key] || []).some((k) => norm(k) === q)) return c.key;
  }
  return null;
}

/** Vorschläge beim Tippen: Präfix auf Name, Kürzel oder Kurzform. */
export function suggestClubs(input, clubs, norm, limit = 6) {
  const q = norm(String(input || "").trim());
  if (q.length < 1) return [];
  const treffer = clubs.filter((c) => {
    if (norm(c.name).startsWith(q) || norm(c.key).startsWith(q)) return true;
    if (norm(c.name).includes(" " + q)) return true;
    return (KURZFORMEN[c.key] || []).some((k) => norm(k).startsWith(q));
  });
  return treffer.slice(0, limit);
}

/* ── Zustandsmaschine ──────────────────────────────────────────────────────────
   Bewusst serialisierbar (nur Zahlen, Strings, Arrays): dieselbe Struktur trägt den
   Solo-Modus und den Duell-Modus über Supabase. */

export function initCarousel(starter = 0) {
  return { starter, round: 1, lives: [CAROUSEL_LIVES, CAROUSEL_LIVES], moves: [], over: null };
}

/** Aktueller Zugindex innerhalb der Runde. */
export const moveIndex = (state) => state.moves.length;
export const currentKind = (state) => moveKind(moveIndex(state));
export const currentOwner = (state) => moveOwner(moveIndex(state), state.starter);

export function burnedOf(state) {
  const clubs = new Set(), players = new Set();
  for (const m of state.moves) (m.kind === "club" ? clubs : players).add(m.value);
  return { clubs, players };
}

/** Letzter genannter Spieler bzw. Verein — das, worauf geantwortet werden muss. */
export function currentTarget(state) {
  for (let i = state.moves.length - 1; i >= 0; i--) return state.moves[i];
  return null;
}

export function addMove(state, kind, value) {
  return { ...state, moves: [...state.moves, { kind, value, by: currentOwner(state) }] };
}

/* Ein Leben verlieren: Runde endet, Verbranntes wird zurückgesetzt, und die
   Eröffnung wechselt — wie vom Owner vorgegeben. */
export function loseLife(state, who, reason) {
  const lives = [...state.lives];
  lives[who] -= 1;
  const over = lives[who] <= 0 ? { loser: who, winner: 1 - who } : null;
  return {
    ...state, lives, over,
    round: state.round + 1,
    starter: 1 - state.starter,
    moves: [],
    lastRound: { reason, loser: who, laenge: state.moves.length, moves: state.moves },
  };
}
