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
/* GEMESSEN UND NACHGEZOGEN: Die erste Fassung war zu flach — aus 50 mit sechzehn
   wurden bis 22 rund 77, und weil der Ballon d'Or erst ab 88 vergeben wird, ist er
   in 600 simulierten Laufbahnen kein einziges Mal an einen Zweiundzwanzigjährigen
   gegangen. Eine Auszeichnung, die das Spiel nie hervorbringt, ist tot.

   Die Werte gelten JE SAISON, nicht je Entscheidungsschritt. Ein Frühentwickler mit
   Glück steht damit um die 86 bis 88, wenn er 22 wird. */
export const ENTWICKLUNG = {
  frueh:  { 18: [5, 10], 20: [4, 9], 22: [2, 6], 24: [0, 4], 26: [-1, 1], 28: [-1, 0], 30: [-1, 0], 32: [-2, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2] },
  normal: { 18: [3, 8],  20: [3, 8], 22: [2, 6], 24: [1, 4], 26: [0, 2],  28: [-1, 0], 30: [-1, 0], 32: [-2, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2] },
  spaet:  { 18: [2, 6],  20: [2, 6], 22: [2, 6], 24: [2, 5], 26: [1, 3],  28: [0, 1],  30: [0, 1],  32: [-1, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2] },
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
/* GEMESSEN an allen 305 Vereinen mit Kaderdaten: Die Stärken laufen von 74 (Virtus
   Entella) bis 97,9 (Real Madrid), der Median liegt bei 76,5 — die Hälfte drängt
   sich zwischen 74 und 76,5. Mit den alten Schwellen fiel deshalb 58 % der Welt in
   EINE Stufe, und Millwall stand als Premier-League-Verein auf Stufe 1.
   Die neuen Werte ergeben eine Pyramide: 27/26/15/19/9/3 Prozent, und Stufe 5 sind
   genau die zehn Vereine, die man dort erwartet. */
export const STUFEN_SCHWELLE = [0, 75, 77, 80, 85, 92];
export const STUFE_MAX_2_LIGA = 2;

export function stufeVon(staerke, ligaStufe = 1) {
  let s = 0;
  for (let i = STUFEN_SCHWELLE.length - 1; i >= 0; i--) if (staerke >= STUFEN_SCHWELLE[i]) { s = i; break; }
  return ligaStufe >= 2 ? Math.min(s, STUFE_MAX_2_LIGA) : s;
}

/** Welchen Wert muss man haben, damit eine Stufe einen überhaupt will? */
export const STUFE_MINDEST_OVR = [48, 56, 64, 72, 79, 85];

/* ── Wie weit trägt der eigene Verein? ────────────────────────────────────────
   Entwicklung hing nur an Alter und Typ. Gemessen im Spiel: Ein Torwart erreichte
   88, ohne je einen Zweitligisten zu verlassen — damit war jede Transferentscheidung
   folgenlos, und genau davon lebt der Modus.

   Jede Rufstufe trägt nur bis zu einer Decke. Darunter wächst man voll, darüber nur
   noch zu einem Drittel: Man kann sich auch bei einem kleinen Verein über sein
   Umfeld hinaus entwickeln, aber nicht beliebig weit. Wer nach oben will, muss
   wechseln.

   Und wer nicht spielt, entwickelt sich nicht — unter einem Drittel Einsatzzeit
   bleibt die Hälfte des Zuwachses liegen. Das macht die Leihe zu einer echten
   Entscheidung statt zu einer Verlegenheitslösung. */
export const DECKE_UEBER_ANFORDERUNG = 16;
export const UEBER_DER_DECKE = 0.5;
export const WENIG_EINSATZ = 0.34;

export const deckeVon = (stufe) => STUFE_MINDEST_OVR[grenze(stufe, 0, 5)] + DECKE_UEBER_ANFORDERUNG;

/** Zuwachs im Verein: Alter und Typ, gebremst vom Niveau und von der Einsatzzeit. */
export function wachstumImVerein(k, stufe, zufall) {
  const roh = wachstum(k.typ, k.alter, zufall);
  if (roh <= 0) return roh;                       // den Abbau bremst niemand
  const gebremst = k.ovr >= deckeVon(stufe) ? roh * UEBER_DER_DECKE : roh;
  return einsatzAnteil(k.ovr, stufe, k.rolle) < WENIG_EINSATZ ? gebremst * 0.5 : gebremst;
}

/* ── Ganze Ratings ─────────────────────────────────────────────────────────────
   Die beiden Bremsen oben halbieren den Zuwachs — und damit stand in der
   Zeitleiste irgendwann „78.5". Ein Rating ist eine ganze Zahl; Fußballspiele
   führen keine halben Stärken.

   Einfach zu runden wäre falsch: Ein gebremster Zuwachs von 0,5 würde je nach
   Rundungsregel entweder immer zu 1 (Bremse wirkungslos) oder immer zu 0 (Bremse
   absolut). Deshalb wandert der Rest in die nächste Saison. Über eine Laufbahn
   kommt exakt dieselbe Summe heraus wie vorher, nur eben in ganzen Schritten. */
export function wachstumGanz(k, stufe, zufall) {
  const roh = wachstumImVerein(k, stufe, zufall) + (k.rest || 0);
  /* Math.trunc statt floor: Bei Abbau (-1,5) soll -1 wirken und -0,5 liegen
     bleiben, nicht -2 wirken und +0,5 gutgeschrieben werden. */
  const zuwachs = Math.trunc(roh);
  return { zuwachs, rest: Math.round((roh - zuwachs) * 100) / 100 };
}

/* Wie oft gewinnt ein Verein dieser Stufe etwas? Je Saison, unabhängig gezogen.
   Die Liga ist steiler als der Pokal: Über 34 Spieltage setzt sich Klasse durch, im
   K.-o.-System reicht ein schlechter Abend. */
/* ── Wer gewinnt die Meisterschaft? ────────────────────────────────────────────
   FRÜHER EINE FESTE CHANCE JE STUFE — und das war der Fehler. Jeder Verein würfelte
   für sich, unabhängig von seinen Gegnern. Gemessen an der gebauten Welt kam dabei
   heraus:

     Premier League 5,24 Meister pro Saison · LaLiga 4,36 · Serie A 3,77 ·
     Bundesliga 3,55

   Eine Liga hat einen Meister. Ein Verein der Stufe 3 — Mainz, Espanyol — kam auf
   14 % je Saison und damit über eine Laufbahn fast sicher zu einem Titel. Genau das
   war die Rückmeldung: „mehrfach mit Espanyol Spanischer Meister".

   JETZT WIRD DIE MEISTERSCHAFT IM FELD AUSGESPIELT. Die Zahlen unten sind Gewichte,
   keine Wahrscheinlichkeiten: Die Meisterschaft geht an genau einen Verein der Liga,
   und das Verhältnis der Gewichte entscheidet, an welchen. Damit hängt die Chance
   eines Vereins daran, WER SONST NOCH in seiner Liga steht — so wie im Fußball.

   Die Spreizung ist Absicht. Zwischen Stufe 3 und Stufe 5 liegt Faktor 25, weil
   sonst zwölf Mittelfeldvereine gemeinsam den einen Spitzenverein überstimmen. Für
   Bayern in einer Bundesliga mit zwölf Stufe-3-Vereinen ergibt das rund 43 % je
   Saison, für Mainz rund 1,7 % — über fünfzehn Saisons also etwa jede vierte
   Laufbahn ein Titel. Vereinzelt, nicht regelmäßig.

   Der Pokal ist flacher: Über ein K.-o.-Turnier reicht ein schlechter Abend. */
/* Stufe 0 traegt das Gewicht null: Ein Abstiegskandidat wird nicht Meister, auch
   nicht vereinzelt. Im Pokal dagegen ist er moeglich — dafuer gibt es K.-o.-Runden. */
export const LIGA_GEWICHT  = [0, 2, 5, 12, 60, 300];
export const POKAL_GEWICHT = [1, 2, 4, 9, 22, 55];

/* Der Europapokal bleibt eine feste Chance je Stufe: Er wird nicht in der Liga
   ausgespielt, sondern zwischen den besten Vereinen mehrerer Länder. Ein Feld dafür
   zu bilden hiesse, alle sieben Ligen zusammenzuwerfen — und dann gewänne ihn ein
   Zweitligist nie, aber auch kein Aussenseiter mehr. */
export const TITEL_CHANCE = {
  europa: [0.00, 0.00, 0.02, 0.07, 0.16, 0.30],
};

/* Der Rang hinter dem Rating — er färbt die Kachel. Vier Stufen, damit ein
   Aufstieg sichtbar ist: Ein Wert, der immer gleich aussieht, ist eine Zahl. */
export const rangVon = (ovr) => (ovr >= 85 ? "platin" : ovr >= 75 ? "gold" : ovr >= 62 ? "silber" : "bronze");

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
  /* DAS FELD GEHÖRT AN DIE LIGA, NICHT AN DEN VEREIN. Der erste Entwurf hängte die
     Gewichtssumme an jeden Verein — und beim Aufstieg nahm er sie mit. Alemannia
     Aachen rechnete in der Bundesliga weiter gegen das Feld der zweiten Liga
     (Summe 31 statt 700) und wurde als Stufe-1-Verein Deutscher Meister. Genau der
     Fehler, den diese Umstellung beseitigen sollte.

     An der Liga hängend ist es dagegen fälschungssicher: `mitLiga` tauscht die Liga
     aus, und damit stimmt das Feld automatisch. */
  const summen = new Map();
  for (const v of out) {
    const e = summen.get(v.liga.key) || { liga: 0, pokal: 0 };
    e.liga += LIGA_GEWICHT[v.stufe];
    e.pokal += POKAL_GEWICHT[v.stufe];
    summen.set(v.liga.key, e);
  }
  const mitFeld = ligen.map((l) => ({ ...l, feld: summen.get(l.key) || { liga: 0, pokal: 0 } }));
  const neuVon = new Map(mitFeld.map((l) => [l.key, l]));
  for (const v of out) v.liga = neuVon.get(v.liga.key) || v.liga;
  return { vereine: out, ligen: mitFeld };
}

/** Wie oft gewinnt dieser Verein die Meisterschaft bzw. den Pokal seiner Liga? */
export function titelAnteil(verein, art) {
  const summe = verein.liga?.feld?.[art];
  if (!summe) return 0;
  const gewicht = (art === "liga" ? LIGA_GEWICHT : POKAL_GEWICHT)[verein.stufe] ?? 0;
  return gewicht / summe;
}

/* ── Auf- und Abstieg ──────────────────────────────────────────────────────────
   Ohne ihn wäre die zweite Spielklasse nur eine Schublade für schwächere Vereine,
   und „Aus der Zweiten" — mit demselben Verein aufsteigen und dann Meister werden —
   wäre nicht bloß schwer, sondern unmöglich: Jeder Verein hätte für immer dieselbe
   Liga.

   Gespielt wird nicht die Tabelle, sondern die Erwartung: Ein starker Zweitligist
   steigt oft auf, ein schwacher Erstligist oft ab. Die Rufstufe ist dabei an die
   Spielklasse gebunden (in der zweiten ist bei 2 Schluss), deshalb wird sie beim
   Wechsel neu berechnet — ein Aufsteiger darf wachsen. */
export const AUFSTIEG_CHANCE = [0.01, 0.04, 0.12];          // je Rufstufe, nur 2. Liga
export const ABSTIEG_CHANCE = [0.34, 0.16, 0.06, 0.01, 0, 0]; // je Rufstufe, nur 1. Liga

/** Die andere Spielklasse desselben Landes — oder null, wo es keine gibt. */
export function schwesterLiga(liga, ligen = WELT_LIGEN) {
  return ligen.find((l) => l.land === liga.land && l.stufe !== liga.stufe) || null;
}

/** Denselben Verein in einer anderen Liga, mit neu berechneter Rufstufe. */
export function mitLiga(verein, liga) {
  return { ...verein, lg: liga.key, liga, stufe: stufeVon(verein.staerke, liga.stufe) };
}

/** Steigt der Verein auf oder ab? Liefert { verein, richtung }. */
export function ligaWechsel(verein, zufall, ligen = WELT_LIGEN) {
  const andere = schwesterLiga(verein.liga, ligen);
  if (!andere) return { verein, richtung: null };
  if (verein.liga.stufe === 2 && zufall() < (AUFSTIEG_CHANCE[verein.stufe] ?? 0))
    return { verein: mitLiga(verein, andere), richtung: "auf" };
  if (verein.liga.stufe === 1 && zufall() < (ABSTIEG_CHANCE[verein.stufe] ?? 0))
    return { verein: mitLiga(verein, andere), richtung: "ab" };
  return { verein, richtung: null };
}

/* ── Leihe ─────────────────────────────────────────────────────────────────────
   Der zweite Grund, warum es die zweite Spielklasse gibt. Ein Siebzehnjähriger bei
   einem Spitzenverein spielt dort nicht — er sitzt. Eine Leihe nach unten gibt ihm
   Spiele, und Spiele sind das, woraus Entwicklung entsteht.

   Angeboten wird sie nur, solange er jung ist UND bei seinem Verein zu schwach für
   einen Stammplatz. Wer gut genug ist, wird nicht verliehen. */
export const LEIHE_BIS_ALTER = 21;
export const LEIHE_UNTER_ANTEIL = 0.45;   // weniger Einsatzzeit als das heißt: Bank

export function leiheMoeglich(k, verein) {
  return k.alter <= LEIHE_BIS_ALTER && !k.leiheVon
    && einsatzAnteil(k.ovr, verein.stufe, k.rolle) < LEIHE_UNTER_ANTEIL;
}

/** Vereine, die den Spieler leihweise nähmen — schwächer als sein eigener. */
export function leihAngebote(welt, k, verein, zufall, anzahl = 3) {
  const infrage = welt.vereine.filter((v) =>
    v.key !== verein.key && v.stufe < verein.stufe && k.ovr >= STUFE_MINDEST_OVR[v.stufe]);
  const kopie = [...infrage];
  const out = [];
  while (out.length < anzahl && kopie.length) out.push(...kopie.splice(Math.floor(zufall() * kopie.length), 1));
  return out;
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
    rest: 0,                 // Restbetrag des Wachstums, siehe wachstumGanz
    verein: null,
    leiheVon: null,
    /* „stamm" ist der richtige Anfang, nicht „kader": Ob jemand zu schwach für seinen
       Verein ist, entscheidet die Einsatzkurve ohnehin. Mit „kader" als Vorgabe lief
       JEDER Spieler von Anfang an mit 45 % Einsatzzeit — auch bei einem kleinen
       Verein, der ihn spielen ließe. Die Rolle sinkt erst durch Ereignisse. */
    rolle: "stamm",          // stamm | rotation | kader
    saisonNr: 0,             // zählt Saisons — daran hängt der Turnier-Takt
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

/* WIE STARK SCHLÄGT KLASSE DURCH?
   Die erste Fassung nahm die dritte Potenz von (Rating − 45) / 45. Gemessen ergab
   das bei Rating 58 noch zwei Prozent des Spitzenwerts — ein Mittelstürmer machte
   28 Spiele und schoss NULL Tore, ein Innenverteidiger kam auf 722 Spiele und null
   Tore, und die halbe Laufbahn produzierte nichts. Damit war jede Endstatistik
   wertlos.

   Die neue Kurve läuft von rund 0,29 bei 50 auf 1,16 bei 92: Klasse schlägt weiter
   deutlich durch — Faktor vier zwischen Anfänger und Weltklasse —, aber ein Stürmer
   in der zweiten Liga trifft auch. */
export const gueteVon = (ovr) => 0.28 + Math.pow(grenze(ovr - 45, 0, 55) / 50, 2);

/** Tore und Vorlagen einer Saison. */
export function saisonLeistung(k, stufe, zufall) {
  const p = posDaten(k.pos);
  const spiele = Math.round(SPIELE_JE_SAISON * einsatzAnteil(k.ovr, stufe, k.rolle));
  const guete = gueteVon(k.ovr);
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
  const liga = LIGA_TITEL[verein.lg];
  if (liga && zufall() < titelAnteil(verein, "liga") * (mod.liga ?? 1)) out.push(liga);
  const pokal = POKAL_TITEL[verein.lg];
  if (pokal && zufall() < titelAnteil(verein, "pokal") * (mod.pokal ?? 1)) out.push(pokal);
  const chance = (art) => TITEL_CHANCE[art][verein.stufe] * (mod[art] ?? 1);
  /* WELCHER EUROPAPOKAL — nicht gewürfelt, sondern nach Rang. Ein Verein der
     höchsten Stufen spielt die Champions League, kein Mittelfeldverein spielt sie.
     Vorher entschied ein Münzwurf, und damit gewann ein Spitzenverein die Champions
     League nur in 11,7 % der Saisons; fünf Titel in einer Laufbahn waren in 1500
     gespielten Läufen kein einziges Mal zu holen. Real Madrid hat sie in elf Jahren
     sechsmal gewonnen. */
  if (zufall() < chance("europa")) out.push(verein.stufe >= 4 ? "CL" : zufall() < 0.3 ? "CL" : "EL");
  return out;
}

/* Ballon d'Or: nur für die Allerbesten, und auch dann selten — es gibt ihn einmal
   im Jahr für die ganze Welt. */
export function einzelTitel(k, leistung, zufall) {
  /* GEMESSEN nach der Entwicklungsdecke: Der Spitzenwert einer Laufbahn liegt im
     Median bei 80, im oberen Zehntel bei 87. Eine Schwelle von 88 lag damit ueber
     dem, was das Spiel hergibt — der Ballon d'Or fiel in 1200 Laufbahnen nie, und
     mit ihm starben zwei Auszeichnungen. */
  if (k.ovr < 86) return [];
  const chance = (k.ovr - 85) * 0.045 + (leistung.tore >= 25 ? 0.06 : 0);
  return zufall() < chance ? ["BDO"] : [];
}

/* Nationalelf: ab einem Wert, der von der Stufe des Vereins mitgetragen wird.

   DER TAKT IST WICHTIG. Zuerst wurde in JEDER Saison auf beide Turniere gewürfelt —
   im Spiel wurde ein Spieler dadurch zweimal innerhalb von zwei Saisons Weltmeister.
   Eine WM gibt es alle vier Jahre, eine EM dazwischen. Der Fehler blähte nebenbei
   die Titelzahlen auf, an denen „Der Sammler" hängt. */
export const NATIONALELF_AB = 76;
export const TURNIER_TAKT = 4;

/** Welches Turnier findet in dieser Saison statt — oder keines? */
export function turnierIn(saisonNr) {
  const rest = saisonNr % TURNIER_TAKT;
  return rest === 0 ? "WM" : rest === 2 ? "EM" : null;
}

export function nationalTitel(k, verein, zufall, saisonNr = 0) {
  const turnier = turnierIn(saisonNr);
  if (!turnier || k.ovr < NATIONALELF_AB) return [];
  const guete = (k.ovr - NATIONALELF_AB) / 20 + verein.stufe * 0.03;
  /* Die EM ist leichter zu gewinnen als die WM: weniger Mitbewerber. */
  return zufall() < guete * (turnier === "WM" ? 0.22 : 0.30) ? [turnier] : [];
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

/* ── Wie oft kommt eine Ereigniskarte? ─────────────────────────────────────────
   FRÜHER FAST JEDE SAISON. Die Wahl lautete „Angebot oder Ereignis", und das
   Ereignis gewann in sechs von zehn Fällen — über eine Laufbahn also zehn- bis
   fünfzehnmal. Der Ernährungsberater kam damit häufiger als ein Vereinswechsel, und
   was selten ist, wird beachtet; was jede Saison kommt, wird weggeklickt.

   Jetzt sind es höchstens sechs je Laufbahn, mit mindestens zwei Schritten
   Abstand — genug, dass jede einzelne wieder ein Moment ist. */
export const EREIGNISSE_JE_LAUFBAHN = 6;
export const EREIGNIS_ABSTAND = 2;
export const EREIGNIS_CHANCE = 0.5;

export function ereignisFaellig({ gespielt = 0, seitLetztem = Infinity }, zufall) {
  if (gespielt >= EREIGNISSE_JE_LAUFBAHN) return false;
  if (seitLetztem < EREIGNIS_ABSTAND) return false;
  return zufall() < EREIGNIS_CHANCE;
}

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

export const ROLLEN_NAME = { stamm: "Stammspieler", rotation: "Rotation", kader: "nur im Kader" };

/* ── Was die Entscheidung gebracht hat ────────────────────────────────────────
   VORHER SAH MAN ES NICHT. Wer einen Privattrainer verpflichtete, hörte einen Ton
   und stand in der nächsten Saison — ob der Trainer angeschlagen hat oder nicht,
   liess sich nur aus der Stärke in der Zeitleiste zurückrechnen. Ein Spiel, das
   nach einer Wahl fragt, muss die Antwort auch zeigen.

   Die Sätze entstehen aus dem Vergleich VORHER/NACHHER, nicht aus der Beschreibung
   der Option. So kann hier nichts stehen, was nicht wirklich passiert ist: Ein
   Zuwachs, der an der Obergrenze verpufft, taucht nicht als Zuwachs auf. */
export function folgen(vorher, nachher, w, verletzt) {
  const liste = [];
  if (nachher.ovr !== vorher.ovr)
    liste.push({ text: `Stärke ${vorher.ovr} → ${nachher.ovr}`, art: nachher.ovr > vorher.ovr ? "gut" : "schlecht" });
  if (nachher.rolle !== vorher.rolle)
    liste.push({
      text: `Rolle im Team: ${ROLLEN_NAME[vorher.rolle]} → ${ROLLEN_NAME[nachher.rolle]}`,
      art: nachher.rolle === "stamm" ? "gut" : "schlecht",
    });
  if (verletzt) liste.push({ text: "Du fällst die kommende Saison verletzt aus", art: "schlecht" });
  for (const [feld, name] of [["liga", "Meisterschaft"], ["pokal", "Pokal"], ["europa", "Europapokal"]]) {
    const f = w[feld];
    if (f === undefined || f === 1) continue;
    liste.push({
      text: f > 1 ? `Aussicht auf die ${name}: ${f}-fach` : `Aussicht auf die ${name}: auf ${Math.round(f * 100)} Prozent gesenkt`,
      art: f > 1 ? "gut" : "schlecht",
    });
  }
  if (w.verbandswechsel) liste.push({ text: "Du spielst künftig für den anderen Verband", art: "neutral" });
  if (w.abschluss) liste.push({ text: "Der Schulabschluss ist in der Tasche", art: "gut" });
  if (!liste.length) liste.push({ text: "Es bleibt alles, wie es war", art: "neutral" });
  return liste;
}

/** Wendet eine gewählte Option an und sagt, was passiert ist. */
export function entscheide(k, option, zufall) {
  /* `gewagt` trennt die Wette von der sicheren Wahl: Wer „Beim Gewohnten bleiben"
     wählt, hat nichts gewonnen — die Folge darf dort nicht „Es geht auf" heissen. */
  const gewagt = option.chance !== undefined;
  const gelungen = gewagt ? zufall() < option.chance : true;
  const w = gelungen ? option.wirkung : (option.sonst || {});
  const naechster = { ...k };
  if (w.ovr) naechster.ovr = grenze(k.ovr + w.ovr, OVR_MIN, OVR_MAX);
  if (w.rolle) naechster.rolle = w.rolle;
  if (w.verbandswechsel) naechster.verbandGewechselt = true;
  if (w.abschluss) naechster.abschluss = true;
  const verletzt = w.verletzt ?? 0;
  return {
    karriere: naechster,
    gelungen,
    gewagt,
    mod: { liga: w.liga ?? 1, pokal: w.pokal ?? 1, europa: w.europa ?? 1 },
    verletzt,
    folgen: folgen(k, naechster, w, verletzt),
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
/* Spaetestens hier ist Schluss, auch wenn noch Angebote kaemen. Gemessen: Ohne
   diese Grenze liefen Laufbahnen bis 41, weil die Welt 345 Vereine kennt und sich
   fuer einen Spieler mit Stufe 0 immer noch einer findet. */
export const ALTERSGRENZE = 38;

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

/* DAS BAND. Angebote kommen aus einem Bereich UM das eigene Niveau — nicht aus
   allem, was unterhalb liegt.

   Das war der Fehler: Es gab nur eine Obergrenze. Ein Spieler mit 85 bekam deshalb
   weiterhin Angebote von Kellervereinen, und die Auswahl war eine Liste aus
   Weltklasse und Abstiegskampf nebeneinander. Im Vorbild klopfen bei 69 Zweitligisten
   an, bei 79 Bologna und Brügge — der eigene Wert verschiebt das ganze Fenster,
   nicht nur seine Decke.

   Eine Stufe nach oben ist der mögliche Sprung, eine nach unten der Schritt zurück,
   den ein alternder Spieler geht. Zwei Stufen tiefer ruft niemanden an, der oben
   spielt. */
export const BAND_UNTEN = 1;
export const BAND_OBEN = 1;

export function angebote(welt, k, zufall) {
  const anzahl = k.alter >= SPAET_AB ? ANGEBOTE_SPAET : ANGEBOTE_NORMAL;
  const eigene = eigeneStufe(k.ovr);
  const min = Math.max(0, eigene - BAND_UNTEN);
  const max = Math.min(5, eigene + BAND_OBEN);
  let infrage = passendeVereine(welt, k.ovr, { ausser: k.verein ? [k.verein.key] : [] })
    .filter((v) => v.stufe >= min && v.stufe <= max);
  /* Findet sich im Band nichts, wird nach unten geöffnet — ohne das stünde ein
     Spieler ohne Angebot da, obwohl es Vereine für ihn gäbe. */
  if (!infrage.length) infrage = passendeVereine(welt, k.ovr, { ausser: k.verein ? [k.verein.key] : [] });
  const out = [];
  const kopie = [...infrage];
  while (out.length < anzahl && kopie.length) out.push(...kopie.splice(Math.floor(zufall() * kopie.length), 1));
  return out;
}

/** Die höchste Stufe, deren Anforderung der Wert erfüllt — das eigene Niveau. */
export function eigeneStufe(ovr) {
  let s = 0;
  for (let i = 0; i < STUFE_MINDEST_OVR.length; i++) if (ovr >= STUFE_MINDEST_OVR[i]) s = i;
  return s;
}

/** Eine Stufe über dem, was der Wert sicher hergibt — mehr ist kein Wechsel, das
    wäre ein Wunder. */
export function hoechsteErreichbareStufe(ovr) {
  return Math.min(5, eigeneStufe(ovr) + BAND_OBEN);
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
  /* GEMESSEN über 1200 Laufbahnen: vier verschiedene große Meisterschaften kamen in
     0,3 % zusammen, alle fünf in keiner einzigen. Vier ist damit die härteste noch
     erreichbare Stufe — und liegt gleichauf mit „Der Größte" und „Goldjunge". */
  { key: "europas_erster", name: "Europas Erster", text: "Meister in vier der fünf großen Ligen.",
    pruefe: (k) => alleLigaTitel(k) >= 4 },
  { key: "vereinstreue", name: "Ein Leben, ein Verein", text: "Die ganze Laufbahn bei einem Verein — mit Meisterschaft, Pokal und Europapokal.",
    pruefe: (k) => k.vereine.length === 1 && alleLigaTitel(k) >= 1
      && Object.values(POKAL_TITEL).some((t) => zahl(k, t) > 0) && (zahl(k, "CL") + zahl(k, "EL")) > 0 },
  { key: "aus_der_zweiten", name: "Aus der Zweiten", text: "Mit demselben Verein aus der zweiten Liga zum Meistertitel.",
    pruefe: (k) => k.aufstiegMitMeister === true },
  { key: "riesentoeter", name: "Riesentöter", text: "Europapokal mit einem Verein unterhalb der Spitzenstufe.",
    pruefe: (k) => k.europaMitKleinem === true },
  { key: "das_triple", name: "Das Triple", text: "Meisterschaft, Pokal und Europapokal in einer einzigen Saison.",
    pruefe: (k) => k.triple === true },
  /* Elf Entscheidungsschritte heißt höchstens elf Vereine — fünfzehn zu verlangen
     war unerfüllbar. Gemessen: Median 6, oberes Zehntel 11. */
  { key: "wanderer", name: "Der Wanderer", text: "Für zehn verschiedene Vereine gespielt.",
    pruefe: (k) => k.vereine.length >= 10 },
  { key: "grenzgaenger", name: "Grenzgänger", text: "In allen sieben Ländern der Welt gespielt.",
    pruefe: (k) => k.laender.length >= 7 },
  /* Gemessen über 1200 Laufbahnen: Median 78 Tore, oberes Zehntel 181, Bestwert 366.
     Fünfhundert war unerreichbar; dreihundert liegt über dem oberen Zehntel und
     unter dem Bestwert — also selten, aber möglich. */
  { key: "torfabrik", name: "Torfabrik", text: "Dreihundert Tore in der Laufbahn.",
    pruefe: (k) => k.gesamt.tore >= 300 },
  /* GEMESSEN: „mit 38 noch im Kader" fiel in 100 % der Laufbahnen — jede erreicht
     dieses Alter, also war die Auszeichnung keine. Verlangt wird jetzt, mit 36 noch
     bei einem Spitzenverein zu stehen; das schafft nur, wer sein Niveau hält. */
  { key: "der_ewige", name: "Der Ewige", text: "Mit sechsunddreißig noch bei einem Spitzenverein.",
    pruefe: (k) => k.alter >= 36 && (k.verein?.stufe ?? 0) >= 4 },
  /* Vor 23 ist mit der Entwicklungsdecke nicht mehr zu schaffen: Mit 22 steht man
     typischerweise bei einem Verein der Stufe zwei oder drei. */
  { key: "goldjunge", name: "Goldjunge", text: "Ballon d'Or vor dem fünfundzwanzigsten Geburtstag.",
    pruefe: (k) => (k.bdoAlter ?? 99) < 25 },
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
