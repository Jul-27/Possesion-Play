/* ──────────────────────────────────────────────────────────────────────────
   POSSESSION PLAY — Spieldaten & reine Logik (kein React, kein Supabase)
   Validierung ist deterministisch: Verein über clubs[], Nation über nat[],
   Alter über Geburtsjahr by. Dadurch kann jeder Client einen Zug selbst prüfen.
   ────────────────────────────────────────────────────────────────────────── */

export const P = {
  1: { name: "Spieler 1", c1: "#2DD4BF", c2: "#0D9488", glow: "rgba(45,212,191,.55)" },
  2: { name: "Spieler 2", c1: "#FB7185", c2: "#BE123C", glow: "rgba(251,113,133,.55)" },
};

const LG_COUNTRY = { BL: "GER", PL: "ENG", LL: "ESP", SA: "ITA", L1: "FRA", PT: "POR", NL: "NED" };

export const CLUBS = [
  { key: "FCB", lg: "BL", label: "FCB", name: "FC Bayern München",        c1: "#DC052D", c2: "#fff",     pat: "solid"   },
  { key: "BVB", lg: "BL", label: "BVB", name: "Borussia Dortmund",        c1: "#FDE100", c2: "#111",     pat: "stripesH" },
  { key: "RBL", lg: "BL", label: "RBL", name: "RB Leipzig",               c1: "#DD0741", c2: "#001F47",  pat: "solid"   },
  { key: "B04", lg: "BL", label: "B04", name: "Bayer 04 Leverkusen",      c1: "#E32221", c2: "#111",     pat: "halvesV" },
  { key: "SGE", lg: "BL", label: "SGE", name: "Eintracht Frankfurt",      c1: "#111",    c2: "#E1000F",  pat: "stripesV" },
  { key: "BMG", lg: "BL", label: "BMG", name: "Borussia Mönchengladbach", c1: "#fff",    c2: "#111",     pat: "halvesH" },
  { key: "VFB", lg: "BL", label: "VFB", name: "VfB Stuttgart",            c1: "#fff",    c2: "#E32219",  pat: "solid"   },
  { key: "WOB", lg: "BL", label: "WOB", name: "VfL Wolfsburg",            c1: "#65B32E", c2: "#fff",     pat: "solid"   },
  { key: "SVW", lg: "BL", label: "SVW", name: "Werder Bremen",            c1: "#1D9053", c2: "#fff",     pat: "solid"   },
  { key: "MCI", lg: "PL", label: "MCI", name: "Manchester City",          c1: "#6CABDD", c2: "#1C2C5B",  pat: "solid"   },
  { key: "MUN", lg: "PL", label: "MUN", name: "Manchester United",        c1: "#DA291C", c2: "#111",     pat: "solid"   },
  { key: "LIV", lg: "PL", label: "LIV", name: "Liverpool",                c1: "#C8102E", c2: "#fff",     pat: "solid"   },
  { key: "CHE", lg: "PL", label: "CHE", name: "Chelsea",                  c1: "#034694", c2: "#fff",     pat: "solid"   },
  { key: "ARS", lg: "PL", label: "ARS", name: "Arsenal",                  c1: "#EF0107", c2: "#fff",     pat: "solid"   },
  { key: "TOT", lg: "PL", label: "TOT", name: "Tottenham Hotspur",        c1: "#fff",    c2: "#132257",  pat: "solid"   },
  { key: "NEW", lg: "PL", label: "NEW", name: "Newcastle United",         c1: "#111",    c2: "#fff",     pat: "stripesV" },
  { key: "EVE", lg: "PL", label: "EVE", name: "Everton",                  c1: "#003399", c2: "#fff",     pat: "solid"   },
  { key: "AVL", lg: "PL", label: "AVL", name: "Aston Villa",              c1: "#670E36", c2: "#95BFE5",  pat: "halvesV" },
  { key: "BAR", lg: "LL", label: "BAR", name: "FC Barcelona",             c1: "#A50044", c2: "#004D98",  pat: "stripesV" },
  { key: "RMA", lg: "LL", label: "RMA", name: "Real Madrid",             c1: "#fff",    c2: "#FEBE10",  pat: "solid"   },
  { key: "ATM", lg: "LL", label: "ATM", name: "Atlético Madrid",          c1: "#CB3524", c2: "#fff",     pat: "stripesV" },
  { key: "SEV", lg: "LL", label: "SEV", name: "FC Sevilla",               c1: "#fff",    c2: "#D81E05",  pat: "solid"   },
  { key: "VAL", lg: "LL", label: "VAL", name: "FC Valencia",              c1: "#fff",    c2: "#F4A100",  pat: "solid"   },
  { key: "VIL", lg: "LL", label: "VIL", name: "FC Villarreal",            c1: "#FFE667", c2: "#005187",  pat: "solid"   },
  { key: "JUV", lg: "SA", label: "JUV", name: "Juventus",                 c1: "#111",    c2: "#fff",     pat: "stripesV" },
  { key: "MIL", lg: "SA", label: "MIL", name: "AC Mailand",               c1: "#FB090B", c2: "#111",     pat: "stripesV" },
  { key: "INT", lg: "SA", label: "INT", name: "Inter Mailand",            c1: "#0068A8", c2: "#111",     pat: "stripesV" },
  { key: "NAP", lg: "SA", label: "NAP", name: "SSC Neapel",               c1: "#12A0D7", c2: "#fff",     pat: "solid"   },
  { key: "ROM", lg: "SA", label: "ROM", name: "AS Rom",                   c1: "#8E1F2F", c2: "#F0BC42",  pat: "halvesV" },
  { key: "LAZ", lg: "SA", label: "LAZ", name: "Lazio Rom",                c1: "#87D8F7", c2: "#fff",     pat: "solid"   },
  { key: "PSG", lg: "L1", label: "PSG", name: "Paris Saint-Germain",      c1: "#004170", c2: "#DA291C",  pat: "stripesV" },
  { key: "ASM", lg: "L1", label: "ASM", name: "AS Monaco",               c1: "#E63312", c2: "#fff",     pat: "halvesV" },
  { key: "OM",  lg: "L1", label: "OM",  name: "Olympique Marseille",      c1: "#2FAEE0", c2: "#fff",     pat: "solid"   },
  { key: "OL",  lg: "L1", label: "OL",  name: "Olympique Lyon",           c1: "#fff",    c2: "#1B4DA1",  pat: "solid"   },
  { key: "LIL", lg: "L1", label: "LIL", name: "OSC Lille",                c1: "#E01E13", c2: "#fff",     pat: "solid"   },
  { key: "POR", lg: "PT", label: "POR", name: "FC Porto",                 c1: "#1452C8", c2: "#fff",     pat: "stripesV" },
  { key: "SLB", lg: "PT", label: "SLB", name: "Benfica Lissabon",         c1: "#E30613", c2: "#fff",     pat: "solid"   },
  { key: "SCP", lg: "PT", label: "SCP", name: "Sporting Lissabon",        c1: "#1A8A4C", c2: "#fff",     pat: "stripesH" },
  { key: "AJA", lg: "NL", label: "AJA", name: "Ajax Amsterdam",           c1: "#fff",    c2: "#D2122E",  pat: "halvesV" },
  { key: "PSV", lg: "NL", label: "PSV", name: "PSV Eindhoven",            c1: "#EC1C24", c2: "#fff",     pat: "solid"   },
  { key: "FEY", lg: "NL", label: "FEY", name: "Feyenoord Rotterdam",      c1: "#fff",    c2: "#E30613",  pat: "halvesV" },
].map((c) => ({ ...c, type: "club", country: LG_COUNTRY[c.lg] }));

export const NATIONS = [
  { key: "FRA", label: "FRA", name: "Frankreich",      flag: { kind: "v",  colors: ["#0055A4", "#fff", "#EF4135"] } },
  { key: "GER", label: "GER", name: "Deutschland",     flag: { kind: "h",  colors: ["#111", "#DD0000", "#FFCE00"] } },
  { key: "ESP", label: "ESP", name: "Spanien",         flag: { kind: "hw", colors: ["#AA151B", "#F1BF00", "#AA151B"], weights: [1, 2, 1] } },
  { key: "ITA", label: "ITA", name: "Italien",         flag: { kind: "v",  colors: ["#009246", "#fff", "#CE2B37"] } },
  { key: "NED", label: "NED", name: "Niederlande",     flag: { kind: "h",  colors: ["#AE1C28", "#fff", "#21468B"] } },
  { key: "BEL", label: "BEL", name: "Belgien",         flag: { kind: "v",  colors: ["#111", "#FDDA24", "#EF3340"] } },
  { key: "CRO", label: "CRO", name: "Kroatien",        flag: { kind: "h",  colors: ["#FF0000", "#fff", "#171796"] } },
  { key: "ENG", label: "ENG", name: "England",         flag: { kind: "cross", colors: ["#fff", "#CE1124"] } },
  { key: "PRT", label: "PRT", name: "Portugal",        flag: { kind: "portugal" } },
  { key: "JPN", label: "JPN", name: "Japan",           flag: { kind: "circle", colors: ["#fff", "#BC002D"] } },
  { key: "BRA", label: "BRA", name: "Brasilien",       flag: { kind: "diamond" } },
  { key: "ARG", label: "ARG", name: "Argentinien",     flag: { kind: "h",  colors: ["#74ACDF", "#fff", "#74ACDF"] } },
  { key: "MEX", label: "MEX", name: "Mexiko",          flag: { kind: "v",  colors: ["#006847", "#fff", "#CE1126"] } },
  { key: "NGA", label: "NGA", name: "Nigeria",         flag: { kind: "v",  colors: ["#008751", "#fff", "#008751"] } },
  { key: "CIV", label: "CIV", name: "Elfenbeinküste",  flag: { kind: "v",  colors: ["#F77F00", "#fff", "#009E60"] } },
  { key: "SEN", label: "SEN", name: "Senegal",         flag: { kind: "v",  colors: ["#00853F", "#FDEF42", "#E31B23"] } },
  { key: "COL", label: "COL", name: "Kolumbien",       flag: { kind: "hw", colors: ["#FCD116", "#003893", "#CE1126"], weights: [2, 1, 1] } },
  { key: "USA", label: "USA", name: "USA",             flag: { kind: "canton" } },
].map((n) => ({ ...n, type: "nat" }));

// Nur DB-prüfbare Spezialfelder (Geburtsjahr).
export const SPECIALS = [
  { key: "Y2K", label: "AB 2000",   icon: "🎂", name: "Geboren ab 2000",   c1: "#34D399", c2: "#065f46", test: (p) => p.by >= 2000 },
  { key: "N90", label: "90ER JG.",  icon: "📅", name: "Geboren 1990–1999", c1: "#A78BFA", c2: "#5b21b6", test: (p) => p.by >= 1990 && p.by <= 1999 },
  { key: "OLD", label: "VOR 1990",  icon: "⏳", name: "Geboren vor 1990",  c1: "#94a3b8", c2: "#475569", test: (p) => p.by < 1990 },
].map((s) => ({ ...s, type: "spec" }));

// Liga-Felder: erfüllt, wenn der Spieler einen Verein dieser Liga hat.
export const LEAGUES = [
  { key: "BL", label: "BL", name: "Bundesliga",     c1: "#D3010C", c2: "#1a1a1a" },
  { key: "PL", label: "PL", name: "Premier League", c1: "#3D195B", c2: "#1f0e36" },
  { key: "LL", label: "LL", name: "La Liga",        c1: "#E03A3E", c2: "#1f1f3c" },
  { key: "SA", label: "SA", name: "Serie A",        c1: "#0A66B0", c2: "#0a2a4a" },
  { key: "L1", label: "L1", name: "Ligue 1",        c1: "#091C3E", c2: "#1d6f6f" },
].map((l) => ({ ...l, type: "league" }));

// Vereins-Key -> Liga-Code (für das Liga-Matching)
const CLUB_LG = Object.fromEntries(CLUBS.map((c) => [c.key, c.lg]));

// Honour-Felder: erfüllt, wenn der Spieler den Titel gewonnen hat (player.t).
export const HONOURS = [
  { key: "CL",  label: "CL",  name: "Champions-League-Sieger", icon: "🏆", c1: "#1b2a6b", c2: "#0a1030" },
  { key: "WM",  label: "WM",  name: "Weltmeister",            icon: "🌍", c1: "#C9A227", c2: "#6b4e00" },
  { key: "MBL", label: "DE",  name: "Deutscher Meister",      icon: "🏅", c1: "#D3010C", c2: "#1a1a1a" },
  { key: "MPL", label: "EN",  name: "Englischer Meister",     icon: "🏅", c1: "#3D195B", c2: "#1f0e36" },
  { key: "MLL", label: "ES",  name: "Spanischer Meister",     icon: "🏅", c1: "#E03A3E", c2: "#1f1f3c" },
  { key: "MSA", label: "IT",  name: "Italienischer Meister",  icon: "🏅", c1: "#0A66B0", c2: "#0a2a4a" },
  { key: "ML1", label: "FR",  name: "Französischer Meister",  icon: "🏅", c1: "#091C3E", c2: "#1d6f6f" },
  { key: "DFB", label: "DFB", name: "DFB-Pokal-Sieger",       icon: "🥇", c1: "#D3010C", c2: "#1a1a1a" },
  { key: "FAC", label: "FA",  name: "FA-Cup-Sieger",          icon: "🥇", c1: "#3D195B", c2: "#1f0e36" },
  { key: "CDR", label: "CDR", name: "Copa-del-Rey-Sieger",    icon: "🥇", c1: "#E03A3E", c2: "#1f1f3c" },
  { key: "CIT", label: "CIT", name: "Coppa-Italia-Sieger",    icon: "🥇", c1: "#0A66B0", c2: "#0a2a4a" },
].map((h) => ({ ...h, type: "honour" }));

/* Spielerdaten liegen in ./players.js (~2,6 MB) und werden NICHT mehr statisch
   importiert, sondern lazy über ./playersStore.js geladen (loadPlayers()).
   Funktionen, die die Liste brauchen (z. B. buildGridSerial), bekommen sie als
   Parameter. */

export const cname = (def) => (def.type === "club" ? `${def.name} (${def.country})` : def.name);
export const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Autocomplete-Vorschl\u00e4ge: Nachname-Pr\u00e4fix, sortiert nach Bekanntheit (sl) desc, dann alphabetisch.
export function suggestPlayers(players, query, limit = 8) {
  const q = norm((query || "").trim());
  if (q.length < 2) return [];
  return players
    .filter((p) => norm(p.ln).startsWith(q))
    .sort((a, b) => (b.sl || 0) - (a.sl || 0) || a.ln.localeCompare(b.ln, "de"))
    .slice(0, limit);
}

// ── Uhr (Gesamt-Zeitbudget pro Spieler) ──────────────────────────────────────
export const START_SECONDS = 240; // 4:00 pro Spieler

export function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Restsekunden des aktiven Spielers (turn): gespeichertes Budget minus verstrichene
// Zeit seit clocks.started. Ohne started -> volles Budget.
export function liveRemaining(clocks, turn, nowMs) {
  const base = clocks?.[turn] ?? START_SECONDS;
  const st = clocks?.started;
  if (st == null) return base;
  const startedMs = typeof st === "number" ? st : Date.parse(st);
  return Math.max(0, base - Math.floor((nowMs - startedMs) / 1000));
}

export function playerMatchesHex(player, def) {
  if (!player || !def) return false;
  if (def.type === "club") return (player.clubs || []).includes(def.key);
  if (def.type === "nat") return (player.nat || []).includes(def.key);
  if (def.type === "spec") return def.test ? def.test(player) : false;
  if (def.type === "league") return (player.clubs || []).some((ck) => CLUB_LG[ck] === def.key);
  if (def.type === "honour") return (player.t || []).includes(def.key);
  return false;
}

// ── Errate den Star (Deduktions-Duell) ───────────────────────────────────────
export const GUESS_SL_MIN = 40; // Mindest-Bekanntheit der Ziel-Spieler (tunebar)
export const POS_LABEL = { TW: "Torwart", ABW: "Abwehr", MF: "Mittelfeld", ST: "Sturm" };

// Deterministische Ja/Nein-Antwort auf eine Attributfrage { dim, val }.
export function answerGuessQuestion(player, q) {
  if (!player || !q) return false;
  switch (q.dim) {
    case "nat":    return (player.nat || []).includes(q.val);
    case "club":   return (player.clubs || []).includes(q.val);
    case "league": return (player.clubs || []).some((ck) => CLUB_LG[ck] === q.val);
    case "pos":    return player.pos === q.val;
    case "title":  return (player.t || []).includes(q.val);
    case "born":   return q.val.cmp === "before" ? player.by < q.val.year : player.by >= q.val.year;
    default:       return false;
  }
}

// Klartext einer Frage für die Protokollanzeige.
export function guessQuestionLabel(q) {
  switch (q.dim) {
    case "nat":    return `Aus ${lookupDef("nat", q.val)?.name ?? q.val}?`;
    case "club":   return `Spielte für ${lookupDef("club", q.val)?.name ?? q.val}?`;
    case "league": return `Spielte in der ${lookupDef("league", q.val)?.name ?? q.val}?`;
    case "pos":    return `Position: ${POS_LABEL[q.val] ?? q.val}?`;
    case "title":  return `${lookupDef("honour", q.val)?.name ?? q.val}?`;
    case "born":   return `Geboren ${q.val.cmp === "before" ? "vor" : "ab"} ${q.val.year}?`;
    default:       return "?";
  }
}

// Leichte Verschleierung der Index-Referenz (kein echter Schutz; vertrauensbasiert).
export function encodeTarget(index) { return btoa(String(index)); }
export function decodeTarget(tgt)   { return Number(atob(tgt)); }
export function checkGuess(tgt, guessedIndex) { return decodeTarget(tgt) === guessedIndex; }

// Indizes aller Spieler, die als Guess-/Daily-Ziel taugen (vollständige Daten + bekannt).
export function guessEligibleIndices(players) {
  const out = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.pos && (p.nat || []).length && (p.clubs || []).length && (p.sl || 0) >= GUESS_SL_MIN) out.push(i);
  }
  return out;
}

// Geheimes Ziel ziehen: bekannt (sl >= GUESS_SL_MIN) und mit vollständigen Daten,
// damit jede Frage-Dimension sinnvoll beantwortbar ist.
export function buildGuessSerial(players) {
  const eligible = guessEligibleIndices(players);
  const pool = eligible.length ? eligible : players.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  return { kind: "guess", tgt: encodeTarget(idx) };
}

// ── Raster-Duell (3x3) ───────────────────────────────────────────────────────
export function gridCellMatches(player, rowDef, colDef) {
  return playerMatchesHex(player, rowDef) && playerMatchesHex(player, colDef);
}

const GRID_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function gridWinner(owners) {
  for (const [a, b, c] of GRID_LINES) {
    const v = owners[a];
    if (v && owners[b] === v && owners[c] === v) return v;
  }
  return null;
}

// ── Geometrie (pointy-top, 4-5-4-5-4-5-4) ────────────────────────────────────
const ROW_LEN = (r) => (r % 2 === 1 ? 5 : 4);
export const HEXH = 2 / Math.sqrt(3);
const ROWSP = 0.75 * HEXH;
export const BOARDH = HEXH + 6 * ROWSP;

const RAW = [];
for (let r = 0; r < 7; r++) for (let c = 0; c < ROW_LEN(r); c++) RAW.push({ row: r, col: c });
export const POSITIONS = RAW.map((p, i) => {
  const xc = p.row % 2 === 1 ? 0.5 + p.col : 1 + p.col;
  const yc = HEXH / 2 + p.row * ROWSP;
  return { idx: i, row: p.row, col: p.col, left: (xc / 5) * 100, top: (yc / BOARDH) * 100 };
});
const idxByRC = Object.fromEntries(POSITIONS.map((p) => [`${p.row},${p.col}`, p.idx]));
function neighborsRC(r, c) {
  const wide = r % 2 === 1;
  const cand = [[r, c - 1], [r, c + 1]];
  if (wide) cand.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
  else cand.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
  return cand.filter(([rr, cc]) => rr >= 0 && rr < 7 && cc >= 0 && cc < ROW_LEN(rr));
}
export const ADJP = Object.fromEntries(
  POSITIONS.map((p) => [p.idx, neighborsRC(p.row, p.col).map(([rr, cc]) => idxByRC[`${rr},${cc}`])])
);

// ── Board: bauen + (de)serialisieren für Supabase ────────────────────────────
const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};
const pick = (a, n) => shuffle(a).slice(0, n);

const DEF_BY_KEY = {
  club: Object.fromEntries(CLUBS.map((c) => [c.key, c])),
  nat: Object.fromEntries(NATIONS.map((n) => [n.key, n])),
  spec: Object.fromEntries(SPECIALS.map((s) => [s.key, s])),
  league: Object.fromEntries(LEAGUES.map((l) => [l.key, l])),
  honour: Object.fromEntries(HONOURS.map((h) => [h.key, h])),
};
export const lookupDef = (type, key) => DEF_BY_KEY[type]?.[key];

// kompakte, serialisierbare Form: pro Feld nur { t: type, k: key }
export function buildBoardSerial() {
  const nLeague = 1 + Math.floor(Math.random() * 3); // 1–3
  const nHonour = 2 + Math.floor(Math.random() * 3); // 2–4
  const leagues = pick(LEAGUES, nLeague);
  const honours = pick(HONOURS, nHonour);
  const specials = pick(SPECIALS, 3);
  const blClubs = pick(CLUBS.filter((c) => c.lg === "BL"), 4);
  const nations = pick(NATIONS, 6);
  const rest = pick(CLUBS.filter((c) => !blClubs.includes(c)), 31 - 3 - 4 - 6 - nLeague - nHonour);
  const chosen = shuffle([...specials, ...blClubs, ...nations, ...rest, ...leagues, ...honours]);
  return chosen.map((d) => ({ t: d.type, k: d.key }));
}

// serialisiertes Board -> volle Zellen mit Position + aufgelöstem def
export function hydrateBoard(serial) {
  return POSITIONS.map((p, i) => ({ ...p, def: lookupDef(serial[i].t, serial[i].k) }));
}

// 6-stelliger, gut lesbarer Spielcode (ohne verwechselbare Zeichen)
export function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// Lösbares 3x3-Raster erzeugen: 6 verschiedene Bedingungen, jede der 9 Zellen
// von mindestens einem Spieler erfüllbar.
export function buildGridSerial(players) {
  const POOL = [...CLUBS, ...NATIONS, ...LEAGUES, ...HONOURS, ...SPECIALS];
  const ser = (d) => ({ t: d.type, k: d.key });
  const solvable = (rowDefs, colDefs) =>
    rowDefs.every((rd) => colDefs.every((cd) => players.some((p) => gridCellMatches(p, rd, cd))));
  for (let attempt = 0; attempt < 80; attempt++) {
    const six = pick(POOL, 6);
    const rows = six.slice(0, 3), cols = six.slice(3, 6);
    if (solvable(rows, cols)) return { kind: "grid", rows: rows.map(ser), cols: cols.map(ser) };
  }
  // Fallback (garantiert lösbar): Ligen × Nationen
  const rows = [lookupDef("league", "BL"), lookupDef("league", "PL"), lookupDef("league", "LL")];
  const cols = [lookupDef("nat", "GER"), lookupDef("nat", "ESP"), lookupDef("nat", "BRA")];
  return { kind: "grid", rows: rows.map(ser), cols: cols.map(ser) };
}
