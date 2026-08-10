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

/** Unverbrannte Stationen eines Spielers — die Auswahl des Vereins-Nenners. */
export function freeClubs(idx, player, burnedClubs) {
  return idx.clubsOf(player).filter((c) => !burnedClubs.has(c));
}

/* Darf dieser Spieler genannt werden? `burnedClubs` enthält den aktuellen Verein
   bereits — die Prüfung auf einen freien Verein ist damit genau Regel 2. */
export function isPlayerLegal(idx, player, club, burnedClubs, burnedPlayers) {
  if (!player || !club) return false;
  if (!idx.clubsOf(player).includes(club)) return false;
  if (burnedPlayers.has(player.n)) return false;
  return freeClubs(idx, player, burnedClubs).length > 0;
}

/* Alle erlaubten Antworten auf einen Verein. Läuft über die Rückrichtung des Index
   statt über alle 31.565 Spieler — sonst wäre jeder Bot-Zug eine Vollsuche. */
export function legalPlayers(idx, club, burnedClubs, burnedPlayers, minSl = 0) {
  const out = [];
  for (const p of idx.playersOf(club)) {
    if ((p.sl || 0) < minSl) continue;
    if (isPlayerLegal(idx, p, club, burnedClubs, burnedPlayers)) out.push(p);
  }
  return out;
}

/* Eröffnung: mindestens zwei Stationen, damit die Kette nicht sofort im Kreis läuft,
   und bekannt genug, dass der Gegner überhaupt etwas damit anfangen kann. */
export const START_SL_MIN = 45;
export function startCandidates(idx, players, minSl = START_SL_MIN) {
  return players.filter((p) => (p.sl || 0) >= minSl && idx.clubsOf(p).length >= 2);
}
export function pickStart(idx, players, rnd = Math.random, minSl = START_SL_MIN) {
  const pool = startCandidates(idx, players, minSl);
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}

/* Bot-Vereinswahl. Er spielt nicht optimal, sondern nachvollziehbar: auf „schwer"
   wählt er den Verein, der dem Gegner die wenigsten Antworten lässt, sonst zufällig.
   Ein perfekt spielender Bot wäre unschlagbar und kein Übungspartner. */
export function botClubMove(idx, player, burnedClubs, burnedPlayers, rnd = Math.random, level = "mittel") {
  const frei = freeClubs(idx, player, burnedClubs);
  if (!frei.length) return null;
  if (level !== "schwer" || frei.length === 1) return frei[Math.floor(rnd() * frei.length)];
  let beste = frei[0], wenigste = Infinity;
  for (const c of frei) {
    const naechste = new Set(burnedClubs); naechste.add(c);
    const n = legalPlayers(idx, c, naechste, burnedPlayers).length;
    if (n < wenigste) { wenigste = n; beste = c; }
  }
  return beste;
}

/* Bot-Spielerwahl. Innerhalb seines Wissens bevorzugt er auf „schwer" Spieler mit
   wenigen freien Stationen — das ist der Zug, der den Gegner in die Enge treibt. */
export function botPlayerMove(idx, club, burnedClubs, burnedPlayers, rnd = Math.random, level = "mittel") {
  const { minSl } = botLevel(level);
  const kandidaten = legalPlayers(idx, club, burnedClubs, burnedPlayers, minSl);
  if (!kandidaten.length) return null;
  if (level !== "schwer") return kandidaten[Math.floor(rnd() * kandidaten.length)];
  const eng = Math.min(...kandidaten.map((p) => freeClubs(idx, p, burnedClubs).length));
  const beste = kandidaten.filter((p) => freeClubs(idx, p, burnedClubs).length === eng);
  return beste[Math.floor(rnd() * beste.length)];
}

/** Was wäre möglich gewesen? Für die Auflösung nach einem verlorenen Leben. */
export function carouselHint(idx, kind, current, burnedClubs, burnedPlayers) {
  if (kind === "club") {
    const frei = freeClubs(idx, current, burnedClubs);
    return frei.length ? { club: frei[0] } : null;
  }
  // bekannteste erlaubte Antwort — die hilft am meisten beim Lernen
  const kandidaten = legalPlayers(idx, current, burnedClubs, burnedPlayers);
  if (!kandidaten.length) return null;
  return { player: kandidaten.reduce((a, b) => ((b.sl || 0) > (a.sl || 0) ? b : a)) };
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
