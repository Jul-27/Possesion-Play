/* „Karriere" — reine Logik (kein React).

   Ein Laufbahn-Simulator: Man steuert keinen Spieler auf dem Platz, sondern eine
   Laufbahn. Mit sechzehn fängt es an, Mitte dreißig hört es auf, und dazwischen
   entscheidet man über Training, Angebote, Streit und Verletzungen.

   ── DIE DREI IDEEN, AUF DENEN DAS SPIEL STEHT ───────────────────────────────
   1. JEDE ENTSCHEIDUNG ZEIGT IHRE QUOTE. „Dem Ernährungsplan folgen: +3 zu 60 %,
      −2 zu 40 %" — der Spieler wettet mit offenen Karten statt zu raten. Das ist
      der Unterschied zwischen einer Entscheidung und einem Knopf.
   2. VEREINE ZÄHLEN NUR ÜBER IHRE RUFSTUFE. Sie reicht von 0 bis 5 und entscheidet
      alles: welchen Wert man haben muss, um dort unterzukommen, und wie oft der
      Verein etwas gewinnt.
   3. AM ENDE STEHT KEINE NOTE, SONDERN EINE SAMMLUNG. Statt „Legende, 62 Punkte"
      gibt es benannte Auszeichnungen, die man erzählen kann — „Fünf Ohren", „Der
      Unvollendete", „Aus der Zweiten".

   ── WARUM DER SPIELER EINE ANDERE SKALA HAT ALS DER REST DES SPIELS ─────────
   Überall sonst rechnen wir auf 65 bis 96 — das ist die Spanne, in der gemessene
   Spielerstärken liegen. Ein Sechzehnjähriger gehört unter diese Spanne, sonst
   startet jeder Anfänger als Bundesligaspieler. Der eigene Wert läuft deshalb von
   40 bis 99.

   Die beiden Skalen treffen NIE aufeinander: Vereine gehen ausschließlich über ihre
   Rufstufe in die Rechnung ein. Die Stufe wird einmal aus der Mannschaftsstärke
   abgeleitet, danach ist die alte Skala nicht mehr im Spiel. */
import { WELT_LIGEN, WELT_VEREINE } from "./careerWorld.js";

export const START_ALTER = 16;
export const OVR_START = 50;
export const OVR_MIN = 40;
export const OVR_MAX = 99;

/* Wie viele Saisons vergehen zwischen zwei Entscheidungen? */
export const TEMPO = {
  intensiv: { name: "Intensiv", saisons: 1, text: "Jede Saison eine Weiche — die lange Fassung" },
  normal:   { name: "Normal",   saisons: 2, text: "Alle zwei Saisons eine Entscheidung" },
  express:  { name: "Express",  saisons: 3, text: "Große Sprünge, wenige Entscheidungen" },
};

/* Zwölf Positionen wie auf einer Aufstellungstafel. `tore` und `vorlagen` sind
   Faktoren auf die Grundausbeute, `gruppe` fasst sie für alles zusammen, was nicht
   so fein unterscheiden muss. */
export const POSITIONEN = [
  { key: "TW",  name: "Torwart",             gruppe: "TOR", tore: 0.00, vorlagen: 0.02 },
  { key: "LV",  name: "Linksverteidiger",    gruppe: "ABW", tore: 0.10, vorlagen: 0.45 },
  { key: "IV",  name: "Innenverteidiger",    gruppe: "ABW", tore: 0.14, vorlagen: 0.12 },
  { key: "RV",  name: "Rechtsverteidiger",   gruppe: "ABW", tore: 0.10, vorlagen: 0.45 },
  { key: "DM",  name: "Defensives Mittelfeld", gruppe: "MIT", tore: 0.18, vorlagen: 0.40 },
  { key: "ZM",  name: "Zentrales Mittelfeld", gruppe: "MIT", tore: 0.35, vorlagen: 0.85 },
  { key: "OM",  name: "Offensives Mittelfeld", gruppe: "MIT", tore: 0.55, vorlagen: 1.00 },
  { key: "LM",  name: "Linkes Mittelfeld",   gruppe: "MIT", tore: 0.40, vorlagen: 0.75 },
  { key: "RM",  name: "Rechtes Mittelfeld",  gruppe: "MIT", tore: 0.40, vorlagen: 0.75 },
  { key: "LA",  name: "Linksaußen",          gruppe: "ANG", tore: 0.80, vorlagen: 0.70 },
  { key: "ST",  name: "Mittelstürmer",       gruppe: "ANG", tore: 1.00, vorlagen: 0.35 },
  { key: "RA",  name: "Rechtsaußen",         gruppe: "ANG", tore: 0.80, vorlagen: 0.70 },
];
export const posDaten = (key) => POSITIONEN.find((p) => p.key === key) || POSITIONEN[10];

/* ── Zufall ────────────────────────────────────────────────────────────────────
   Deterministisch aus dem Startwert: Dieselbe Laufbahn lässt sich nacherzählen, und
   ein Fehlerbericht ist nachstellbar. */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 1779033703 ^ String(s).length;
  for (let i = 0; i < String(s).length; i++) { h = Math.imul(h ^ String(s).charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
const poisson = (lambda, zufall) => {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= zufall(); } while (p > L && k < 200);
  return k - 1;
};
export const grenze = (x, min, max) => Math.max(min, Math.min(max, x));
/** Ein Wert aus einer Spanne [min,max], gleichverteilt und ganzzahlig. */
export const ausSpanne = ([min, max], zufall) => min + Math.floor(zufall() * (max - min + 1));

/* ── Entwicklung ───────────────────────────────────────────────────────────────
   Wie viel gewinnt oder verliert ein Spieler je Saison? Das hängt am Alter und an
   einem Typ, der bei der Erstellung verdeckt gezogen wird und die ganze Laufbahn
   trägt. Frühentwickler sind mit 22 fertig und bauen früh ab; Spätentwickler
   brauchen bis 26, halten dafür länger.

   Die Werte sind Spannen je Lebensjahr — der tatsächliche Zuwachs wird daraus
   gezogen. Deshalb sind zwei Laufbahnen desselben Typs nie gleich. */
export const ENTWICKLUNG = {
  frueh:  { 18: [4, 9], 20: [3, 8], 22: [2, 5], 24: [0, 4], 26: [-1, 1], 28: [-1, 0], 30: [-1, 0], 32: [-2, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2] },
  normal: { 18: [2, 7], 20: [2, 7], 22: [1, 5], 24: [1, 4], 26: [0, 2], 28: [-1, 0], 30: [-1, 0], 32: [-2, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2] },
  spaet:  { 18: [1, 6], 20: [1, 6], 22: [1, 5], 24: [1, 5], 26: [1, 3], 28: [0, 1], 30: [0, 1], 32: [-1, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2] },
};
export const ENTWICKLUNG_NAMEN = { frueh: "Frühentwickler", normal: "normale Entwicklung", spaet: "Spätentwickler" };

/** Der Typ wird gezogen: ein Zehntel früh, ein Zehntel spät, der Rest normal. */
export function entwicklungstyp(zufall, pos) {
  if (pos === "TW") return "normal";   // Torhüter reifen zu gleichmäßig für Ausreißer
  const w = zufall();
  return w < 0.1 ? "frueh" : w < 0.2 ? "spaet" : "normal";
}

/** Zuwachs je LEBENSJAHR — die Stufen der Tabelle gelten bis zum nächsten Eintrag. */
export function wachstum(typ, alter, zufall) {
  const tabelle = ENTWICKLUNG[typ] || ENTWICKLUNG.normal;
  const stufen = Object.keys(tabelle).map(Number).sort((a, b) => a - b);
  const stufe = stufen.find((s) => alter <= s) ?? stufen.at(-1);
  return ausSpanne(tabelle[stufe], zufall);
}

/* ── Rufstufen ─────────────────────────────────────────────────────────────────
   Sechs Stufen, von 0 (Abstiegskandidat der zweiten Liga) bis 5 (Bayern, Real,
   City). Sie ist die EINZIGE Eigenschaft, mit der ein Verein in die Rechnung
   eingeht — daran hängen Angebote, Einsatzzeit und Titel.

   Abgeleitet wird sie aus unserer gemessenen Mannschaftsstärke, nicht gesetzt. Ein
   Zweitligist kann Stufe 2 nicht überschreiten, auch wenn sein Kader stark ist:
   Aus der zweiten Liga gewinnt man keine Meisterschaft. */
export const STUFEN_SCHWELLE = [0, 73, 78, 82, 86, 90];
export const STUFE_MAX_2_LIGA = 2;

export function stufeVon(staerke, ligaStufe = 1) {
  let s = 0;
  for (let i = STUFEN_SCHWELLE.length - 1; i >= 0; i--) if (staerke >= STUFEN_SCHWELLE[i]) { s = i; break; }
  return ligaStufe >= 2 ? Math.min(s, STUFE_MAX_2_LIGA) : s;
}

/** Welchen Wert muss man haben, damit eine Stufe einen überhaupt will? */
export const STUFE_MINDEST_OVR = [48, 56, 64, 72, 79, 85];

/* Wie oft gewinnt ein Verein dieser Stufe etwas? Je Saison, unabhängig gezogen.
   Die Liga ist steiler als der Pokal: Über 34 Spieltage setzt sich Klasse durch, im
   K.-o.-System reicht ein schlechter Abend. */
export const TITEL_CHANCE = {
  liga:   [0.00, 0.01, 0.05, 0.14, 0.30, 0.55],
  pokal:  [0.01, 0.04, 0.09, 0.16, 0.24, 0.34],
  europa: [0.00, 0.00, 0.02, 0.07, 0.14, 0.26],
};

/* ── Marktwert ─────────────────────────────────────────────────────────────────
   Hängt allein am Wert, nicht am Verein — sonst wäre er nur eine zweite Anzeige
   derselben Zahl. Zwischen den Stützstellen wird linear geschätzt. */
export const MARKTWERT_STUFEN = [
  [50, 1e5], [55, 3e5], [60, 8e5], [65, 2e6], [70, 5e6], [75, 12e6],
  [80, 30e6], [85, 60e6], [90, 1.1e8], [95, 1.8e8], [99, 2.5e8],
];
export function marktwert(ovr) {
  const s = MARKTWERT_STUFEN;
  if (ovr <= s[0][0]) return s[0][1];
  if (ovr >= s.at(-1)[0]) return s.at(-1)[1];
  for (let i = 1; i < s.length; i++) {
    if (ovr <= s[i][0]) {
      const [a, av] = s[i - 1], [b, bv] = s[i];
      return Math.round((av + ((ovr - a) / (b - a)) * (bv - av)) / 1e4) * 1e4;
    }
  }
  return s.at(-1)[1];
}
export const werteText = (w) => (w >= 1e6 ? `${(w / 1e6).toFixed(w >= 1e7 ? 0 : 1)} Mio. €` : `${Math.round(w / 1e3)} Tsd. €`);

/* ── Die Welt ──────────────────────────────────────────────────────────────────
   Aus careerWorld.js plus einer Stärke je Verein, die von außen kommt (sie stammt
   aus den Kadern, die auch die Traumelf benutzt). Vereine ohne Kaderdaten fallen
   heraus — ohne Stärke keine Stufe, ohne Stufe kein Spiel. */
export function baueWelt(staerkeVon, vereine = WELT_VEREINE, ligen = WELT_LIGEN) {
  const ligaVon = new Map(ligen.map((l) => [l.key, l]));
  const out = [];
  for (const v of vereine) {
    const liga = ligaVon.get(v.lg);
    if (!liga) continue;
    const s = staerkeVon(v);
    if (!Number.isFinite(s)) continue;
    out.push({ ...v, staerke: Math.round(s * 10) / 10, stufe: stufeVon(s, liga.stufe), liga });
  }
  out.sort((a, b) => b.staerke - a.staerke);
  return { vereine: out, ligen };
}

/** Alle Vereine einer Stufe, die den Spieler nehmen würden. */
export function passendeVereine(welt, ovr, { land = null, ligaStufe = null, ausser = [] } = {}) {
  const raus = new Set(ausser);
  return welt.vereine.filter((v) =>
    !raus.has(v.key)
    && ovr >= STUFE_MINDEST_OVR[v.stufe]
    && (land === null || v.liga.land === land)
    && (ligaStufe === null || v.liga.stufe === ligaStufe));
}

/* ── Der eigene Spieler ────────────────────────────────────────────────────────*/
export function neueKarriere({ name, land, nummer, pos, fuss = "rechts", tempo = "normal", seed = Date.now() }) {
  const zufall = rng(hashStr(`${name}|${seed}`));
  return {
    name, land, nummer, pos, fuss, tempo, seed,
    typ: entwicklungstyp(zufall, pos),
    alter: START_ALTER,
    ovr: OVR_START,
    verein: null,
    leiheVon: null,
    rolle: "kader",          // kader | rotation | stamm
    verlauf: [],             // je Schritt eine Zeile für die Zeitleiste
    titel: {},               // Honour-Key -> Anzahl
    vereine: [],             // alle Vereine der Laufbahn, für Auszeichnungen
    laender: [],
    gesamt: { spiele: 0, tore: 0, vorlagen: 0 },
    beendet: false,
  };
}

/* ── Einsatzzeit ───────────────────────────────────────────────────────────────
   Wie gut ist man IM VERHÄLTNIS zu dem, was der Verein erwartet? Der Vergleichswert
   ist die Mindestanforderung der Stufe. Wer sie genau erfüllt, ist Stammspieler mit
   den üblichen Pausen; wer acht Punkte darunter liegt, sitzt.

   Der Versatz von 3 ist der Grund, dass „genau passend" nicht 50 % bedeutet: Ein
   Spieler, den ein Verein holt, spielt dort auch. */
export const SPIELE_JE_SAISON = 34;
export function einsatzAnteil(ovr, stufe, rolle = "stamm") {
  const d = ovr - STUFE_MINDEST_OVR[stufe];
  const basis = 1 / (1 + Math.exp(-(d + 3) / 3.4));
  const rollenFaktor = rolle === "stamm" ? 1 : rolle === "rotation" ? 0.72 : 0.45;
  return grenze(basis * rollenFaktor, 0.02, 0.97);
}

/** Tore und Vorlagen einer Saison. Die dritte Potenz trennt den Torjäger vom
    soliden Stürmer, ohne ins Absurde zu laufen. */
export function saisonLeistung(k, stufe, zufall) {
  const p = posDaten(k.pos);
  const spiele = Math.round(SPIELE_JE_SAISON * einsatzAnteil(k.ovr, stufe, k.rolle));
  const guete = Math.pow(grenze(k.ovr - 45, 1, 60) / 45, 3);
  const umfeld = 0.75 + stufe * 0.11;
  const tore = poisson(spiele * 0.42 * p.tore * guete * umfeld, zufall);
  const vorlagen = poisson(spiele * 0.26 * p.vorlagen * guete * umfeld, zufall);
  return { spiele, tore, vorlagen };
}

/* ── Titel ─────────────────────────────────────────────────────────────────────
   Je Saison wird für Liga, Pokal und Europapokal getrennt gewürfelt. Modifikatoren
   aus Entscheidungen (etwa „Priorität Liga") wirken als Faktor.

   Ein Zweitligist kann keinen Meistertitel gewinnen — dort steht kein Schlüssel. */
export const LIGA_TITEL = { BL: "MBL", PL: "MPL", LL: "MLL", SA: "MSA", L1: "ML1" };
export const POKAL_TITEL = { BL: "DFB", PL: "FAC", LL: "CDR", SA: "CIT" };

export function saisonTitel(verein, zufall, mod = {}) {
  const out = [];
  const chance = (art) => TITEL_CHANCE[art][verein.stufe] * (mod[art] ?? 1);
  const liga = LIGA_TITEL[verein.lg];
  if (liga && zufall() < chance("liga")) out.push(liga);
  const pokal = POKAL_TITEL[verein.lg];
  if (pokal && zufall() < chance("pokal")) out.push(pokal);
  if (zufall() < chance("europa")) out.push(zufall() < 0.45 ? "CL" : "EL");
  return out;
}

/* Ballon d'Or: nur für die Allerbesten, und auch dann selten — es gibt ihn einmal
   im Jahr für die ganze Welt. */
export function einzelTitel(k, leistung, zufall) {
  if (k.ovr < 88) return [];
  const chance = (k.ovr - 87) * 0.05 + (leistung.tore >= 25 ? 0.06 : 0);
  return zufall() < chance ? ["BDO"] : [];
}

/* Nationalelf: ab einem Wert, der von der Stufe des Vereins mitgetragen wird. Die
   Turniere kommen im Zweijahrestakt, deshalb hängt die Chance am Schritt. */
export const NATIONALELF_AB = 76;
export function nationalTitel(k, verein, zufall) {
  if (k.ovr < NATIONALELF_AB) return [];
  const guete = (k.ovr - NATIONALELF_AB) / 20 + verein.stufe * 0.03;
  const out = [];
  if (zufall() < guete * 0.10) out.push("WM");
  if (zufall() < guete * 0.14) out.push("EM");
  return out;
}

/* ── Entscheidungen ────────────────────────────────────────────────────────────
   Jede Karte nennt ihre Wirkung UND ihre Wahrscheinlichkeit. `wirkung` ist das, was
   bei Erfolg passiert, `sonst` das Gegenteil; fehlt `chance`, tritt `wirkung`
   sicher ein.

   Die Felder von `wirkung`: ovr (sofortiger Zuwachs), rolle (neue Rolle im Team),
   liga/pokal/europa (Faktor auf die Titelchance dieser Saison), verletzt (Saisons
   ohne Spiel). */
export const EREIGNISSE = [
  { key: "ernaehrung", titel: "Ernährungsplan", text: "Ein Ernährungsberater will deine Kost umstellen. Das kann anschlagen oder nach hinten losgehen.",
    optionen: [
      { label: "Dem Plan folgen", chance: 0.6, wirkung: { ovr: 3 }, sonst: { ovr: -2 } },
      { label: "Beim Gewohnten bleiben", wirkung: {} },
    ] },
  { key: "extraschicht", titel: "Extraschichten", text: "Du könntest nach dem Training bleiben. Mehr Arbeit, mehr Risiko.",
    optionen: [
      { label: "Jeden Abend länger", chance: 0.55, wirkung: { ovr: 4 }, sonst: { ovr: -1, verletzt: 1 } },
      { label: "Normal trainieren", wirkung: {} },
    ] },
  { key: "trainer", titel: "Privattrainer", text: "Ein Individualtrainer bietet sich an. Er kostet dich einen Teil deiner Erholung.",
    optionen: [
      { label: "Verpflichten", chance: 0.7, wirkung: { ovr: 3 }, sonst: { ovr: -1 } },
      { label: "Dankend ablehnen", wirkung: {} },
    ] },
  { key: "mittel", titel: "Zweifelhaftes Mittel", text: "Jemand im Umfeld verspricht dir ein Präparat, das angeblich nicht auffällt.",
    optionen: [
      { label: "Nehmen", chance: 0.65, wirkung: { ovr: 6 }, sonst: { ovr: -8, verletzt: 1 } },
      { label: "Finger weg", wirkung: {} },
    ] },
  { key: "posting", titel: "Unbedachter Beitrag", text: "Ein Beitrag von dir schlägt Wellen. Der Verein erwartet eine Reaktion.",
    optionen: [
      { label: "Öffentlich entschuldigen", wirkung: { rolle: "rotation" } },
      { label: "Dazu stehen", chance: 0.4, wirkung: { ovr: 1 }, sonst: { rolle: "kader" } },
    ] },
  { key: "prioritaet", titel: "Ansage des Vereins", text: "Der Verein will wissen, worauf ihr diese Saison alles setzt.",
    optionen: [
      { label: "Auf die Liga", wirkung: { liga: 2, europa: 0.5 } },
      { label: "Auf Europa", wirkung: { europa: 2, liga: 0.5 } },
    ] },
  { key: "konkurrenz", titel: "Konkurrenz auf deiner Position", text: "Der Verein holt jemanden für deinen Platz.",
    optionen: [
      { label: "Kampf annehmen", chance: 0.5, wirkung: { rolle: "stamm", ovr: 2 }, sonst: { rolle: "rotation" } },
      { label: "Sich fügen", wirkung: { rolle: "rotation" } },
    ] },
  { key: "talent", titel: "Ein Talent drängt nach", text: "Ein Sechzehnjähriger trainiert bei euch mit und ist nah dran.",
    optionen: [
      { label: "Ihn unter die Fittiche nehmen", wirkung: { liga: 1.3, pokal: 1.3 } },
      { label: "Ihm keinen Raum lassen", chance: 0.6, wirkung: { rolle: "stamm" }, sonst: { rolle: "rotation", ovr: -1 } },
    ] },
  { key: "pfiffe", titel: "Pfiffe von den Rängen", text: "Die eigenen Zuschauer stellen dich infrage.",
    optionen: [
      { label: "Bleiben und liefern", chance: 0.5, wirkung: { ovr: 2, rolle: "stamm" }, sonst: { ovr: -2 } },
      { label: "Sich zurückziehen", wirkung: { rolle: "rotation" } },
    ] },
  { key: "verletzung", titel: "Verletzung", text: "Es hat dich erwischt. Die Frage ist nur, wie lange.",
    optionen: [
      { label: "Auskurieren", wirkung: { verletzt: 1 } },
      { label: "Auf die Zähne beißen", chance: 0.35, wirkung: {}, sonst: { verletzt: 1, ovr: -3 } },
    ] },
  { key: "endspiel", titel: "Verletzt vor dem Endspiel", text: "Kurz vor dem wichtigsten Spiel deiner Saison zwickt es.",
    optionen: [
      { label: "Spielen", chance: 0.8, wirkung: { liga: 1.6, europa: 1.6, pokal: 1.6 }, sonst: { ovr: -2 } },
      { label: "Aussetzen", wirkung: { liga: 0.6, europa: 0.6, pokal: 0.6 } },
    ] },
  { key: "elfmeter", titel: "Elfmeter in der Nachspielzeit", text: "Alle schauen dich an. Übernimmst du?",
    optionen: [
      { label: "Schießen", chance: 0.5, wirkung: { ovr: 2, pokal: 1.5 }, sonst: { ovr: -1, rolle: "rotation" } },
      { label: "Einem anderen überlassen", wirkung: {} },
    ] },
  { key: "schule", titel: "Abschluss nachholen", text: "Du könntest neben dem Fußball die Schule zu Ende bringen.",
    optionen: [
      { label: "Durchziehen", wirkung: { ovr: -1, abschluss: true } },
      { label: "Ganz auf Fußball setzen", chance: 0.5, wirkung: { ovr: 2 }, sonst: {} },
    ] },
  { key: "grossvater", titel: "Ein Großvater aus dem Ausland", text: "Ein anderer Verband hätte dich gern. Du wärest dort sofort gesetzt.",
    optionen: [
      { label: "Verband wechseln", wirkung: { verbandswechsel: true } },
      { label: "Beim eigenen Land bleiben", wirkung: {} },
    ] },
  { key: "steuer", titel: "Post vom Finanzamt", text: "Deine Berater haben etwas übersehen. Es wird öffentlich.",
    optionen: [
      { label: "Alles nachzahlen", wirkung: { ovr: -1 } },
      { label: "Anwälte kämpfen lassen", chance: 0.45, wirkung: {}, sonst: { ovr: -3, rolle: "rotation" } },
    ] },
];

/** Zieht ein Ereignis, das gerade passt. */
export function ziehEreignis(k, zufall, zuletzt = []) {
  const moeglich = EREIGNISSE.filter((e) => {
    if (zuletzt.includes(e.key)) return false;
    if (e.key === "schule" && k.alter > 20) return false;
    if (e.key === "grossvater" && (k.alter > 26 || k.verbandGewechselt)) return false;
    if (e.key === "endspiel" && (!k.verein || k.verein.stufe < 3)) return false;
    return true;
  });
  return moeglich[Math.floor(zufall() * moeglich.length)] || EREIGNISSE[0];
}

/** Wendet eine gewählte Option an und sagt, was passiert ist. */
export function entscheide(k, option, zufall) {
  const gelungen = option.chance === undefined ? true : zufall() < option.chance;
  const w = gelungen ? option.wirkung : (option.sonst || {});
  const naechster = { ...k };
  if (w.ovr) naechster.ovr = grenze(k.ovr + w.ovr, OVR_MIN, OVR_MAX);
  if (w.rolle) naechster.rolle = w.rolle;
  if (w.verbandswechsel) naechster.verbandGewechselt = true;
  if (w.abschluss) naechster.abschluss = true;
  return {
    karriere: naechster,
    gelungen,
    mod: { liga: w.liga ?? 1, pokal: w.pokal ?? 1, europa: w.europa ?? 1 },
    verletzt: w.verletzt ?? 0,
  };
}

/* ── Angebote ──────────────────────────────────────────────────────────────────
   Wer will dich? Vereine bis eine Stufe über dem, was dein Wert hergibt — ein
   Sprung nach oben ist möglich, zwei nicht. Ab 32 werden es weniger, ab 34 kann
   ganz Schluss sein.

   Die Jugendangebote sind ein Sonderfall: Sie kommen aus dem eigenen Land, und
   mindestens eines davon aus der zweiten Liga. Sonst begänne jede Laufbahn oben. */
export const ANGEBOTE_NORMAL = 3;
export const ANGEBOTE_SPAET = 2;
export const SPAET_AB = 32;
export const RUECKTRITT_AB = 34;

export function jugendAngebote(welt, land, zufall) {
  const heimisch = (stufe) => welt.vereine.filter((v) => v.liga.land === land && v.liga.stufe === stufe && v.stufe <= 3);
  const zieh = (liste, n) => {
    const kopie = [...liste];
    const out = [];
    while (out.length < n && kopie.length) out.push(...kopie.splice(Math.floor(zufall() * kopie.length), 1));
    return out;
  };
  const angebote = [...zieh(heimisch(2), 2), ...zieh(heimisch(1), 1)];
  return angebote.length ? angebote : zieh(welt.vereine.filter((v) => v.stufe <= 2), 3);
}

export function angebote(welt, k, zufall) {
  const anzahl = k.alter >= SPAET_AB ? ANGEBOTE_SPAET : ANGEBOTE_NORMAL;
  const infrage = passendeVereine(welt, k.ovr, { ausser: k.verein ? [k.verein.key] : [] })
    .filter((v) => v.stufe <= hoechsteErreichbareStufe(k.ovr));
  const out = [];
  const kopie = [...infrage];
  while (out.length < anzahl && kopie.length) out.push(...kopie.splice(Math.floor(zufall() * kopie.length), 1));
  return out;
}

/** Eine Stufe über dem, was der Wert sicher hergibt — mehr ist kein Wechsel, das
    wäre ein Wunder. */
export function hoechsteErreichbareStufe(ovr) {
  let s = 0;
  for (let i = 0; i < STUFE_MINDEST_OVR.length; i++) if (ovr >= STUFE_MINDEST_OVR[i]) s = i;
  return Math.min(5, s + 1);
}

/* ── Auszeichnungen ────────────────────────────────────────────────────────────
   Statt einer Note am Ende: benannte Erfolge, die eine Geschichte erzählen. Jede
   prüft den fertigen Verlauf.

   Bewusst NICHT dabei sind Auszeichnungen, die unsere Welt nicht hergibt — sie
   umfasst sieben europäische Länder, also gibt es nichts über Kontinente oder
   Südamerika zu holen. Eine Auszeichnung, die niemand erreichen kann, ist ein
   Versprechen, das das Spiel nicht hält. */
const zahl = (k, key) => k.titel[key] || 0;
const alleLigaTitel = (k) => Object.values(LIGA_TITEL).filter((t) => zahl(k, t) > 0).length;

export const AUSZEICHNUNGEN = [
  { key: "fuenf_ohren", name: "Fünf Ohren", text: "Fünfmal die Champions League.",
    pruefe: (k) => zahl(k, "CL") >= 5 },
  { key: "unvollendet", name: "Der Unvollendete", text: "Eine ganze Laufbahn ohne einen einzigen Mannschaftstitel.",
    pruefe: (k) => Object.keys(k.titel).filter((t) => t !== "BDO").length === 0 },
  { key: "europas_erster", name: "Europas Erster", text: "Meister in allen fünf großen Ligen.",
    pruefe: (k) => alleLigaTitel(k) === 5 },
  { key: "vereinstreue", name: "Ein Leben, ein Verein", text: "Die ganze Laufbahn bei einem Verein — mit Meisterschaft, Pokal und Europapokal.",
    pruefe: (k) => k.vereine.length === 1 && alleLigaTitel(k) >= 1
      && Object.values(POKAL_TITEL).some((t) => zahl(k, t) > 0) && (zahl(k, "CL") + zahl(k, "EL")) > 0 },
  { key: "aus_der_zweiten", name: "Aus der Zweiten", text: "Mit demselben Verein aus der zweiten Liga zum Meistertitel.",
    pruefe: (k) => k.aufstiegMitMeister === true },
  { key: "riesentoeter", name: "Riesentöter", text: "Europapokal mit einem Verein unterhalb der Spitzenstufe.",
    pruefe: (k) => k.europaMitKleinem === true },
  { key: "das_triple", name: "Das Triple", text: "Meisterschaft, Pokal und Europapokal in einer einzigen Saison.",
    pruefe: (k) => k.triple === true },
  { key: "wanderer", name: "Der Wanderer", text: "Für fünfzehn verschiedene Vereine gespielt.",
    pruefe: (k) => k.vereine.length >= 15 },
  { key: "grenzgaenger", name: "Grenzgänger", text: "In allen sieben Ländern der Welt gespielt.",
    pruefe: (k) => k.laender.length >= 7 },
  { key: "torfabrik", name: "Torfabrik", text: "Fünfhundert Tore in der Laufbahn.",
    pruefe: (k) => k.gesamt.tore >= 500 },
  { key: "der_ewige", name: "Der Ewige", text: "Mit achtunddreißig noch im Kader.",
    pruefe: (k) => k.alter >= 38 },
  { key: "goldjunge", name: "Goldjunge", text: "Ballon d'Or vor dem dreiundzwanzigsten Geburtstag.",
    pruefe: (k) => (k.bdoAlter ?? 99) < 23 },
  { key: "der_groesste", name: "Der Größte", text: "Weltmeister, viermal Champions League und sechs Ballons d'Or.",
    pruefe: (k) => zahl(k, "WM") >= 1 && zahl(k, "CL") >= 4 && zahl(k, "BDO") >= 6 },
  { key: "doppelbuerger", name: "Doppelbürger", text: "Den Verband gewechselt und danach einen Titel mit der neuen Auswahl geholt.",
    pruefe: (k) => k.verbandGewechselt === true && (zahl(k, "WM") + zahl(k, "EM")) > 0 },
  { key: "sammler", name: "Der Sammler", text: "Fünfundzwanzig Titel oder mehr.",
    pruefe: (k) => Object.values(k.titel).reduce((a, b) => a + b, 0) >= 25 },
];

export function erreichteAuszeichnungen(k) {
  return AUSZEICHNUNGEN.filter((a) => { try { return a.pruefe(k); } catch { return false; } });
}
