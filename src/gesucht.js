/* „Der Gesuchte" — reine Logik (kein React, kein Supabase).

   24 Spielerkarten, einer ist gesucht. Sechs Hinweise, von vage zu deutlich; man
   streicht, was nicht passt, und rät mit drei Versuchen. Je früher, desto mehr Punkte.
   Das Prinzip gibt es als „Wer ist es?" seit Jahrzehnten; angeregt hat es
   AnstoßQuiz.de. Dort fiel beim Durchspielen auf (27.10.2026), was hier anders ist:

   · Jedes Brett wird NEU GEZOGEN, auch nach Thema — dort waren es in allen Modi
     dieselben 24 Weltstars, und das Tagesrätsel begann wie ein Solorätsel.
   · Die Hinweise erzeugt ein GENERATOR passend zum Brett und prüft sie: Jeder schließt
     auf diesem Brett mindestens eine Karte aus, keiner verrät allein den Spieler
     (allein bleiben immer mindestens zwei übrig), und erst alle zusammen lassen genau
     einen stehen. Dort war der letzte Hinweis „Norwegen und Dortmund" — die Lösung.

   ── WORAUS HINWEISE ENTSTEHEN ────────────────────────────────────────────────
   Nur aus Feldern, die vollständig genug sind, um auch ANDERE Karten sicher
   auszuschließen: Verband und Nation, die 47 Spielvereine, Ligen, die großen Titel
   (WM, EM, Copa América, Champions League, Ballon d'Or), Position, Geburtsjahr und
   Mitspieler bei einem der 47 Vereine. Landesmeister- und Pokaltitel bleiben draußen —
   fehlt einem Spieler ein solcher Titel nur in den Daten, wäre er zu Unrecht
   gestrichen. Spieler mit zwei Nationalmannschaften ebenso: Bei ihnen ist „kommt aus
   Südamerika" nicht eindeutig. */
import { CLUBS, LEAGUES, NATIONS, leaguesOf, norm } from "./gameData.js";
import { hatFoto } from "./playerImage.js";
import { dailyRnd } from "./dailyChallenge.js";
import { buildShare } from "./share.js";

export const BRETT = 24;
export const HINWEISE = 6;
export const VERSUCHE = 3;
export const SPERRE_S = 10;
export const PUNKTE_START = 1000;
export const HINWEIS_KOSTEN = 100;
export const FEHLER_KOSTEN = 150;
export const SOLO_RAETSEL = 5;
export const SL_MIN = 45;
/* Aus so vielen der bekanntesten Spieler eines Themas wird das Brett gezogen: genug
   Abwechslung, aber keine Gesichter, die niemand kennt. */
export const THEMA_SPITZE = 120;

export const spielerKey = (p) => (p ? `${norm(p.n)}|${p.by}` : "");

/* Fußballverbände statt Erdteile: Australien spielt in Asien, und „kommt aus
   Ozeanien" hätte niemand gewusst. */
export const VERBAND = {
  UEFA: { name: "Europa", nationen: ["FRA", "GER", "ESP", "ITA", "NED", "BEL", "CRO", "ENG", "PRT", "AUT", "SRB", "SUI", "DEN", "SWE", "CZE", "POL", "IRL", "WAL", "TUR", "RUS", "UKR", "GRE", "SCO", "NOR"] },
  CONMEBOL: { name: "Südamerika", nationen: ["BRA", "ARG", "COL", "URU"] },
  CAF: { name: "Afrika", nationen: ["NGA", "CIV", "SEN", "MAR", "GHA", "CMR"] },
  AFC: { name: "Asien oder Australien", nationen: ["JPN", "KOR", "AUS"] },
  CONCACAF: { name: "Nord- oder Mittelamerika", nationen: ["MEX", "USA"] },
};
const VERBAND_VON = Object.fromEntries(Object.entries(VERBAND).flatMap(([v, d]) => d.nationen.map((n) => [n, v])));
export const verbandVon = (nat) => VERBAND_VON[nat] || null;

export const GROSSE_TITEL = {
  WM: { ja: "Ich bin Weltmeister geworden.", nein: "Ich bin nie Weltmeister geworden.", name: "Weltmeister" },
  EM: { ja: "Ich bin Europameister geworden.", nein: "Ich bin nie Europameister geworden.", name: "Europameister" },
  CA: { ja: "Ich habe die Copa América gewonnen.", nein: "Ich habe nie die Copa America gewonnen.", name: "Copa América" },
  CL: { ja: "Ich habe die Champions League gewonnen.", nein: "Ich habe nie die Champions League gewonnen.", name: "Champions League" },
  BDO: { ja: "Ich habe den Ballon d'Or gewonnen.", nein: "Ich habe nie den Ballon d'Or gewonnen.", name: "Ballon d'Or" },
};

const POSITION = {
  TW: { ja: "Ich bin Torwart.", nein: "Ich bin kein Torwart.", name: "Tor" },
  ABW: { ja: "Ich bin Verteidiger.", nein: "Ich bin kein Verteidiger.", name: "Abwehr" },
  MF: { ja: "Ich bin Mittelfeldspieler.", nein: "Ich bin kein Mittelfeldspieler.", name: "Mittelfeld" },
  ST: { ja: "Ich bin Stürmer.", nein: "Ich bin kein Stürmer.", name: "Sturm" },
};

const CLUB = Object.fromEntries(CLUBS.map((c) => [c.key, c]));
const LIGA = Object.fromEntries(LEAGUES.map((l) => [l.key, l]));
const NATION = Object.fromEntries(NATIONS.map((n) => [n.key, n]));
/* „in der Bundesliga" / „in der Eredivisie" / „in La Liga" — der Artikel hängt am Namen. */
const ligaMit = (k) => (k === "LL" ? "in La Liga" : `in der ${LIGA[k]?.name || k}`);

/* ── Wer darf auf ein Brett ──────────────────────────────────────────────────── */
export const taugtFuersBrett = (p) =>
  (p.sl || 0) >= SL_MIN && !!p.pos && POSITION[p.pos] && (p.nat || []).length === 1 && !!verbandVon(p.nat[0])
  && (p.clubs || []).length > 0 && hatFoto(p);

export const THEMEN = {
  alle: { name: "Alle Stars", text: "Die Bekanntesten aus allen Ligen", test: () => true },
  bl: { name: "Bundesliga", text: "Wer in der Bundesliga gespielt hat", test: (p) => leaguesOf(p).has("BL") },
  pl: { name: "Premier League", text: "Wer in England gespielt hat", test: (p) => leaguesOf(p).has("PL") },
  ll: { name: "La Liga", text: "Wer in Spanien gespielt hat", test: (p) => leaguesOf(p).has("LL") },
  sa: { name: "Serie A", text: "Wer in Italien gespielt hat", test: (p) => leaguesOf(p).has("SA") },
  legenden: { name: "Legenden", text: "Geboren vor 1982", test: (p) => p.by < 1982 },
};

/** Die bekanntesten THEMA_SPITZE Spieler eines Themas, die aufs Brett taugen. */
export function themenPool(players, thema = "alle") {
  const t = THEMEN[thema] || THEMEN.alle;
  return players.filter((p) => taugtFuersBrett(p) && t.test(p))
    .sort((a, b) => (b.sl || 0) - (a.sl || 0) || a.n.localeCompare(b.n))
    .slice(0, THEMA_SPITZE);
}

/* ── Hinweise ──────────────────────────────────────────────────────────────────
   Ein Hinweis ist { art, wert, ja } — so steht er auch in der Datenbank (Duell). Text
   und Wahrheit leiten sich daraus ab, für jeden Spieler gleich. */

/** Teamkollegen bei einem der 47 Spielvereine (zeitliche Überschneidung in cp). */
export function mitspielerBei(a, b) {
  const out = [];
  for (const [k1, f1, t1] of a?.cp || []) {
    if (!CLUB[k1]) continue;
    for (const [k2, f2, t2] of b?.cp || []) {
      if (k1 !== k2) continue;
      const von = Math.max(f1, f2), bis = Math.min(t1 || 9999, t2 || 9999);
      if (von <= bis) out.push({ club: k1, von, bis: bis === 9999 ? 0 : bis });
    }
  }
  return out;
}

/** Trifft der Hinweis auf den Spieler zu? `nachKey` braucht nur der Mitspieler-Hinweis. */
export function gilt(h, p, nachKey) {
  let wahr;
  switch (h.art) {
    case "verband": wahr = verbandVon(p.nat?.[0]) === h.wert; break;
    case "nation": wahr = p.nat?.[0] === h.wert; break;
    case "verein": wahr = (p.clubs || []).includes(h.wert); break;
    case "liga": wahr = leaguesOf(p).has(h.wert); break;
    case "titel": wahr = (p.t || []).includes(h.wert); break;
    case "position": wahr = p.pos === h.wert; break;
    case "geboren": wahr = p.by < h.wert; break;            // ja = „vor wert geboren"
    case "mitspieler": {
      const m = nachKey?.get(h.wert);
      if (!m) return null;
      wahr = spielerKey(m) !== spielerKey(p) && mitspielerBei(p, m).length > 0;
      break;
    }
    default: return null;
  }
  return h.ja ? wahr : !wahr;
}

export function hinweisText(h, nachKey) {
  switch (h.art) {
    case "verband": return h.ja ? `Meine Nationalmannschaft kommt aus ${VERBAND[h.wert].name}.`
      : `Meine Nationalmannschaft kommt nicht aus ${VERBAND[h.wert].name}.`;
    case "nation": return h.ja ? `Meine Nationalmannschaft ist ${NATION[h.wert]?.name || h.wert}.`
      : `Meine Nationalmannschaft ist nicht ${NATION[h.wert]?.name || h.wert}.`;
    case "verein": return h.ja ? `Ich habe für ${CLUB[h.wert]?.name || h.wert} gespielt.`
      : `Ich habe nie für ${CLUB[h.wert]?.name || h.wert} gespielt.`;
    case "liga": return h.ja ? `Ich habe ${ligaMit(h.wert)} gespielt.` : `Ich habe nie ${ligaMit(h.wert)} gespielt.`;
    case "titel": return h.ja ? GROSSE_TITEL[h.wert].ja : GROSSE_TITEL[h.wert].nein;
    case "position": return h.ja ? POSITION[h.wert].ja : POSITION[h.wert].nein;
    case "geboren": return h.ja ? `Ich bin vor ${h.wert} geboren.` : `Ich bin ${h.wert} oder später geboren.`;
    case "mitspieler": return `Ich habe mit ${nachKey?.get(h.wert)?.n || "?"} zusammengespielt.`;
    default: return "";
  }
}

/** Der Beleg für die Auflösung: woraus der Hinweis beim Gesuchten folgt. */
export function belegText(h, p, nachKey) {
  switch (h.art) {
    case "verband": case "nation": return `Nationalmannschaft: ${NATION[p.nat?.[0]]?.name || "—"}.`;
    case "verein": return `Vereine unter unseren 47: ${(p.clubs || []).map((k) => CLUB[k]?.name || k).join(", ")}.`;
    case "liga": return `Ligen: ${[...leaguesOf(p)].map((k) => LIGA[k]?.name).filter(Boolean).join(", ") || "keine der sieben"}.`;
    case "titel": {
      const hat = Object.keys(GROSSE_TITEL).filter((k) => (p.t || []).includes(k)).map((k) => GROSSE_TITEL[k].name);
      return hat.length ? `Große Titel: ${hat.join(", ")}.` : "Keiner der großen Titel (WM, EM, Copa América, Champions League, Ballon d'Or).";
    }
    case "position": return `Position: ${POSITION[p.pos]?.name || p.pos}.`;
    case "geboren": return `Geboren ${p.by}.`;
    case "mitspieler": {
      const m = nachKey?.get(h.wert);
      const z = m ? mitspielerBei(p, m)[0] : null;
      return z ? `Gemeinsam bei ${CLUB[z.club]?.name} (${z.von}–${z.bis || "heute"}).` : "";
    }
    default: return "";
  }
}

/** Alle Hinweise, die auf den Gesuchten zutreffen und auf diesem Brett etwas sagen. */
export function kandidaten(brett, ziel, alleSpieler, nachKey) {
  const out = [];
  const add = (art, wert, ja) => out.push({ art, wert, ja });
  const andere = brett.filter((p) => p !== ziel);
  const vb = verbandVon(ziel.nat[0]);
  add("verband", vb, true);
  for (const v of new Set(andere.map((p) => verbandVon(p.nat[0])))) if (v !== vb) add("verband", v, false);
  add("nation", ziel.nat[0], true);
  for (const n of new Set(andere.map((p) => p.nat[0]))) if (n !== ziel.nat[0]) add("nation", n, false);
  for (const c of ziel.clubs) add("verein", c, true);
  for (const c of new Set(andere.flatMap((p) => p.clubs))) if (!ziel.clubs.includes(c)) add("verein", c, false);
  const lz = leaguesOf(ziel);
  for (const l of LEAGUES) add("liga", l.key, lz.has(l.key));
  for (const t of Object.keys(GROSSE_TITEL)) add("titel", t, (ziel.t || []).includes(t));
  for (const pos of Object.keys(POSITION)) add("position", pos, ziel.pos === pos);
  for (const y of new Set(andere.map((p) => p.by))) add("geboren", y, ziel.by < y);
  /* Mitspieler: bekannte Namen, die NICHT auf dem Brett stehen — sonst schlösse der
     Hinweis die genannte Karte bloß selbst aus. */
  const aufBrett = new Set(brett.map(spielerKey));
  const mates = alleSpieler
    .filter((m) => (m.sl || 0) >= 70 && !aufBrett.has(spielerKey(m)) && mitspielerBei(ziel, m).length)
    .sort((a, b) => (b.sl || 0) - (a.sl || 0)).slice(0, 6);
  for (const m of mates) add("mitspieler", spielerKey(m), true);
  return out.filter((h) => gilt(h, ziel, nachKey) === true);
}

/* So viele Karten sollen nach jedem Hinweis ungefähr übrig sein: erst grob, dann fein. */
const ZIELKURVE = [15, 9, 6, 4, 2, 1];

/** Sechs Hinweise wählen — oder null, wenn dieses Brett das nicht hergibt. */
export function waehleHinweise(brett, ziel, kands, rnd, nachKey) {
  const keys = brett.map(spielerKey);
  const zk = spielerKey(ziel);
  // Wer fällt durch welchen Hinweis? Unbekannte Wahrheit (null) macht den Hinweis unbrauchbar.
  const raus = [];
  for (const h of kands) {
    const weg = new Set();
    let ok = true;
    for (const p of brett) {
      const g = gilt(h, p, nachKey);
      if (g === null) { ok = false; break; }
      if (!g) weg.add(spielerKey(p));
    }
    // Allein darf kein Hinweis die Lösung sein: mindestens zwei bleiben stehen.
    if (ok && weg.size >= 1 && brett.length - weg.size >= 2) raus.push({ h, weg });
  }
  for (let versuch = 0; versuch < 80; versuch++) {
    const rest = new Set(keys);
    const gewaehlt = [], proArt = {};
    for (let k = 0; k < HINWEISE; k++) {
      const opts = [];
      for (const o of raus) {
        if (gewaehlt.includes(o) || (proArt[o.h.art] || 0) >= 2) continue;
        let neu = 0;
        for (const w of o.weg) if (rest.has(w)) neu++;
        const nachher = rest.size - neu;
        if (neu < 1) continue;
        if (k < HINWEISE - 1 ? nachher < 2 : nachher !== 1) continue;
        opts.push({ o, nachher, d: Math.abs(nachher - ZIELKURVE[k]) });
      }
      if (!opts.length) break;
      opts.sort((a, b) => a.d - b.d);
      const best = opts.filter((x) => x.d <= opts[0].d + 1).slice(0, 4);
      const pick = best[Math.floor(rnd() * best.length)];
      gewaehlt.push(pick.o);
      proArt[pick.o.h.art] = (proArt[pick.o.h.art] || 0) + 1;
      for (const w of pick.o.weg) rest.delete(w);
    }
    if (gewaehlt.length === HINWEISE && rest.size === 1 && rest.has(zk)) return gewaehlt.map((o) => o.h);
  }
  return null;
}

function ziehe(arr, n, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/**
 * Ein Rätsel: { thema, brett: [key × 24], ziel: key, hinweise: [6 × {art, wert, ja}] }.
 * Brett und Gesuchter werden neu gezogen, bis der Generator eine saubere Folge findet.
 */
export function baueRaetsel(players, rnd = Math.random, thema = "alle", nachKey = null) {
  const nk = nachKey || new Map(players.map((p) => [spielerKey(p), p]));
  const pool = themenPool(players, thema);
  if (pool.length < BRETT) return null;
  for (let versuch = 0; versuch < 60; versuch++) {
    const brett = ziehe(pool, BRETT, rnd);
    const ziel = brett[Math.floor(rnd() * BRETT)];
    const hs = waehleHinweise(brett, ziel, kandidaten(brett, ziel, players, nk), rnd, nk);
    if (hs) return { thema, brett: brett.map(spielerKey), ziel: spielerKey(ziel), hinweise: hs };
  }
  return null;
}

/** Prüft ein Rätsel gegen die Regeln oben — für Tests und als Sicherung. */
export function pruefeRaetsel(r, nachKey) {
  const brett = r.brett.map((k) => nachKey.get(k));
  const ziel = nachKey.get(r.ziel);
  if (brett.some((p) => !p) || !ziel || brett.length !== BRETT) return "Brett unvollständig";
  if (r.hinweise.length !== HINWEISE) return "nicht sechs Hinweise";
  const rest = new Set(r.brett);
  for (const [i, h] of r.hinweise.entries()) {
    if (gilt(h, ziel, nachKey) !== true) return `Hinweis ${i + 1} trifft nicht zu`;
    const weg = brett.filter((p) => gilt(h, p, nachKey) === false);
    if (BRETT - weg.length < 2) return `Hinweis ${i + 1} verrät allein den Spieler`;
    const vorher = rest.size;
    for (const p of weg) rest.delete(spielerKey(p));
    if (rest.size === vorher) return `Hinweis ${i + 1} schließt nichts aus`;
  }
  return rest.size === 1 && rest.has(r.ziel) ? null : `am Ende bleiben ${rest.size}`;
}

/* Anzeigenamen fürs Brett: der Nachname — außer er kommt zweimal vor (Thomas und Gerd
   Müller standen nebeneinander). Dann mit Anfangsbuchstaben, notfalls voll. */
export function kartenNamen(spieler) {
  const zahl = (f) => spieler.reduce((m, p) => m.set(f(p), (m.get(f(p)) || 0) + 1), new Map());
  const ln = (p) => p.ln || p.n;
  const kurz = (p) => (p.n.includes(" ") && p.n !== ln(p) ? `${p.n[0]}. ${ln(p)}` : p.n);
  const nLn = zahl(ln), nKurz = zahl(kurz);
  return spieler.map((p) => (nLn.get(ln(p)) === 1 ? ln(p) : nKurz.get(kurz(p)) === 1 ? kurz(p) : p.n));
}

/* ── Punkte ───────────────────────────────────────────────────────────────────── */
export function punkteFuer({ hinweise, fehler, geloest }) {
  if (!geloest) return 0;
  return Math.max(100, PUNKTE_START - HINWEIS_KOSTEN * (hinweise - 1) - FEHLER_KOSTEN * fehler);
}
/** Was der nächste Hinweis kostet — steht am Knopf. */
export const naechsterHinweisKostet = (offen) => (offen < HINWEISE ? HINWEIS_KOSTEN : 0);
/** Tagesrätsel in die Bestenliste: 0–100 wie die anderen Tagesrätsel. */
export const bestenlistenPunkte = (p) => Math.max(0, Math.min(100, Math.round(p / 10)));

/* ── Tagesrätsel ─────────────────────────────────────────────────────────────── */
/** Für alle dasselbe Rätsel des Tages — immer aus „Alle Stars". */
export const tagesRaetsel = (players, datum, nachKey = null) => baueRaetsel(players, dailyRnd("gesucht", datum), "alle", nachKey);

/** Teilen: wie viele Hinweise, wie viele Fehlversuche — der Name bleibt geheim. */
export function teilenText(nummer, { hinweise, fehler, geloest, punkte }) {
  const lampen = "💡".repeat(hinweise) + "⬛".repeat(Math.max(0, HINWEISE - hinweise));
  return buildShare({
    solo: "gesucht",
    title: `🔍 Der Gesuchte #${nummer} · ${geloest ? `${punkte} Punkte` : "nicht gefunden"}`,
    lines: [`${lampen}${fehler ? " " + "❌".repeat(fehler) : ""}`],
  });
}
