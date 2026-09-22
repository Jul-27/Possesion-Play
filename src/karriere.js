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
import { namenVon, EIGENE, alleLaender } from "./laender.js";

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
  frueh:  { 18: [5, 10], 20: [4, 9], 22: [2, 6], 24: [0, 4], 26: [-1, 1], 28: [-1, 0], 30: [-1, 0], 32: [-2, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2], 40: [-6, -3] },
  normal: { 18: [3, 8],  20: [3, 8], 22: [2, 6], 24: [1, 4], 26: [0, 2],  28: [-1, 0], 30: [-1, 0], 32: [-2, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2], 40: [-6, -3] },
  spaet:  { 18: [2, 6],  20: [2, 6], 22: [2, 6], 24: [2, 5], 26: [1, 3],  28: [0, 1],  30: [0, 1],  32: [-1, 0], 34: [-3, -1], 36: [-4, -1], 38: [-5, -2], 40: [-6, -3] },
};
export const ENTWICKLUNG_NAMEN = { frueh: "Frühentwickler", normal: "normale Entwicklung", spaet: "Spätentwickler" };

/* ── Talent: warum nicht jeder oben ankommt ────────────────────────────────────
   GEMESSEN an 4000 Laufbahnen, die immer zum besten erreichbaren Verein wechseln:
   Der Höchstwert lag im Median bei 87, und 48 % aller Spieler kamen über 88 — die
   Schwelle, ab der der Ballon d'Or überhaupt vergeben wird. Damit war die Spitze
   nicht die Ausnahme, sondern der Regelfall: Wer die Saisons durchklickte, wurde
   Weltklasse, und ein Titel hing nur noch an der Geduld.

   Der Grund lag in der Tabelle oben. Sie beschreibt, was ein Spieler je Saison
   dazugewinnen KANN, und jeder bekam dieselbe Spanne. Ein Fußballer ist aber nicht
   die Summe seiner Trainingsjahre — die meisten sind irgendwann fertig, und nur
   wenige haben das, woraus Weltklasse wird.

   DESHALB EINE ZWEITE, VERDECKTE ZIEHUNG. Beim Anlegen bekommt jede Laufbahn einen
   Talentfaktor, der den Zuwachs (nicht den Abbau) streckt oder staucht. Die Kurve
   ist absichtlich schief: Der Faktor läuft von 0,58 bis 1,12, aber die hohe Potenz
   drückt die Masse nach unten, sodass die Spitze selten bleibt.

   NACHGEMESSEN mit denselben 4000 Laufbahnen: Median 74, ein Viertel über 79, ein
   Zehntel über 86; 12 % erreichen 85, 7 % die Ballon-d'Or-Schwelle 88, 1 % die 95.
   Möglich ist damit alles — die Regel ist es nicht mehr. */
export const TALENT_MIN = 0.58, TALENT_MAX = 1.12, TALENT_FORM = 3.4;

export const zieheTalent = (zufall) =>
  Math.round((TALENT_MIN + (TALENT_MAX - TALENT_MIN) * Math.pow(zufall(), TALENT_FORM)) * 1000) / 1000;

/* Nur für den Rückblick am Ende der Laufbahn: Man erfährt erst dann, was man
   gezogen hatte. Währenddessen wäre es eine Vorhersage und keine Laufbahn mehr. */
/* Die Schwellen sind aus der Ziehung zurückgerechnet, nicht geraten: Sie teilen die
   Laufbahnen in rund 4 / 8 / 14 / 24 / 50 Prozent. Ein Jahrhunderttalent soll eines
   von fünfundzwanzig sein — sonst wäre das Wort gelogen. */
export const TALENT_STUFEN = [
  [1.05, "Jahrhunderttalent"], [0.93, "außergewöhnliches Talent"], [0.77, "großes Talent"],
  [0.63, "solide veranlagt"], [0, "harter Arbeiter"],
];
export const talentName = (t) => (TALENT_STUFEN.find(([ab]) => (t ?? 1) >= ab) || TALENT_STUFEN.at(-1))[1];

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

/** Zuwachs im Verein: Alter, Typ und Talent, gebremst vom Niveau und der Einsatzzeit. */
export function wachstumImVerein(k, stufe, zufall) {
  const roh = wachstum(k.typ, k.alter, zufall);
  if (roh <= 0) return roh;                       // den Abbau bremst weder Talent noch Verein
  const begabt = roh * (k.talent ?? 1);
  const gebremst = k.ovr >= deckeVon(stufe) ? begabt * UEBER_DER_DECKE : begabt;
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

/* ── Und der Europapokal ───────────────────────────────────────────────────────
   Der blieb beim Umbau zunächst auf der alten festen Chance je Stufe stehen — und
   damit kippte das Verhältnis. Gemessen danach:

     Mainz 05: Meisterschaft 1,7 % je Saison, Europapokal 7 %
     Fulham:   Meisterschaft 0,6 % je Saison, Europapokal 7 %

   Weltweit kamen 10,6 Europapokalsieger pro Saison heraus. Es gibt zwei. Über 500
   Laufbahnen wurde die Champions League zehnmal häufiger gewonnen als die
   Bundesliga — die Königsklasse war die leichteste Trophäe im Spiel.

   Jetzt gilt dasselbe Prinzip wie im Inland, nur ist das Feld ein anderes: Alle
   Erstligisten aller Länder spielen es untereinander aus. Zweitligisten nehmen
   nicht teil, ihre Liga trägt deshalb die Summe null.

   Die Gewichte unterscheiden sich zwischen den Wettbewerben: Die Champions League
   ist noch steiler als eine Meisterschaft, weil dort nur die Besten Europas
   antreten. Die Europa League ist ihr Gegenstück — dort fehlt die Spitze, weil sie
   eine Etage höher spielt, und deshalb hat Stufe 5 hier das KLEINERE Gewicht. */
export const CL_GEWICHT = [0, 0, 1, 5, 25, 150];
export const EL_GEWICHT = [0, 1, 5, 14, 20, 12];

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
    const e = summen.get(v.liga.key) || { liga: 0, pokal: 0, ab: 0, auf: 0 };
    e.liga += LIGA_GEWICHT[v.stufe];
    e.pokal += POKAL_GEWICHT[v.stufe];
    /* Die Felder für Auf- und Abstieg — dieselbe Idee wie bei den Titeln: Die Liga
       kennt die Summe, der Verein nur sein Gewicht. */
    if (v.liga.stufe === 1) e.ab += ABSTIEG_GEWICHT[v.stufe] ?? 0;
    if (v.liga.stufe === 2) e.auf += AUFSTIEG_GEWICHT[v.stufe] ?? 0;
    summen.set(v.liga.key, e);
  }
  /* Das Europafeld ist EINE Summe über alle Erstligisten — es hängt trotzdem an der
     Liga, damit ein Auf- oder Absteiger automatisch hinein- oder herausfällt. Eine
     zweite Liga trägt null und kann den Europapokal damit nicht gewinnen. */
  /* UND NUR EUROPA. Mit den vier Ligen ausserhalb Europas stand plötzlich auch
     Flamengo im Feld der Champions League — die Summe kannte nur die Spielklasse,
     nicht den Erdteil. Ein brasilianischer Meister gewinnt keinen Europapokal. */
  let clSumme = 0, elSumme = 0;
  for (const v of out) {
    if (v.liga.stufe !== 1 || !EUROPA.has(v.liga.land)) continue;
    clSumme += CL_GEWICHT[v.stufe];
    elSumme += EL_GEWICHT[v.stufe];
  }
  const mitFeld = ligen.map((l) => ({
    ...l,
    feld: {
      ...(summen.get(l.key) || { liga: 0, pokal: 0, ab: 0, auf: 0 }),
      cl: l.stufe === 1 && EUROPA.has(l.land) ? clSumme : 0,
      el: l.stufe === 1 && EUROPA.has(l.land) ? elSumme : 0,
    },
  }));
  const neuVon = new Map(mitFeld.map((l) => [l.key, l]));
  for (const v of out) v.liga = neuVon.get(v.liga.key) || v.liga;
  return { vereine: out, ligen: mitFeld };
}

/** Wie oft gewinnt dieser Verein die Meisterschaft bzw. den Pokal seiner Liga? */
const GEWICHTE = { liga: LIGA_GEWICHT, pokal: POKAL_GEWICHT, cl: CL_GEWICHT, el: EL_GEWICHT };

export function titelAnteil(verein, art) {
  const summe = verein.liga?.feld?.[art];
  if (!summe) return 0;
  const gewicht = GEWICHTE[art]?.[verein.stufe] ?? 0;
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
   Wechsel neu berechnet — ein Aufsteiger darf wachsen.

   ── JEDE LIGA HAT IHRE PLÄTZE ────────────────────────────────────────────────
   VORHER WÜRFELTE JEDER VEREIN FÜR SICH, mit einer festen Chance je Rufstufe. Das
   ist derselbe Fehler, den die Meisterschaften schon einmal hatten: Wie viele
   absteigen, hing daran, wie viele schwache Vereine zufällig in einer Liga stehen.
   Nachgerechnet stiegen in Österreich 2,5 von 10 Vereinen je Saison ab und 0,2 auf,
   in Portugal 3,5 ab und 0,2 auf, in LaLiga 0,3 ab, aus der Championship 3,3 auf.
   Im Durchspielen am 21.09.2026 stieg ein Spieler deshalb mit drei Vereinen in Folge
   ab.

   JETZT HAT JEDE LIGA IHRE PLÄTZE — so viele, wie es dort wirklich gibt, mit einem
   halben Platz für eine Relegation. Die Rufstufe verteilt sie nur noch: Die Chance
   eines Vereins ist sein Gewicht geteilt durch die Summe seiner Liga, mal die Zahl
   der Plätze. Die Summen hängen wie die Titelfelder an der Liga (siehe baueWelt).

   Die Gewichte sind mit Absicht flach: Bayern steigt nie ab, ein Mittelfeldklub ab
   und zu, der schwächste oft — aber nicht sicher. Deshalb auch der Deckel: Ohne ihn
   stieg der schwächste Verein der Premier League zu 90 % je Saison ab, in einem
   Schritt über zwei Saisons also fast sicher. */
export const ABSTIEG_GEWICHT = [1.0, 0.6, 0.3, 0.1, 0.02, 0];   // je Rufstufe, 1. Liga
export const AUFSTIEG_GEWICHT = [0.2, 0.5, 1.0];                // je Rufstufe, 2. Liga
export const WECHSEL_DECKEL = 0.75;
/* Auf- und Abstiegsplätze je Land, für beide Richtungen gleich. Ein halber Platz ist
   eine Relegation, die man in der Hälfte der Fälle verliert. */
export const WECHSEL_PLAETZE = { GER: 2.5, ENG: 3, ESP: 3, ITA: 3, FRA: 2.5, PRT: 2.5, NED: 2.5, AUT: 1 };
/* Für ein Land, das eine zweite Liga bekommt, ohne hier eingetragen zu werden —
   sonst stiege dort still nie jemand auf oder ab. */
export const WECHSEL_PLAETZE_SONST = 2;

/** Die andere Spielklasse desselben Landes — oder null, wo es keine gibt. */
export function schwesterLiga(liga, ligen = WELT_LIGEN) {
  return ligen.find((l) => l.land === liga.land && l.stufe !== liga.stufe) || null;
}

/** Denselben Verein in einer anderen Liga, mit neu berechneter Rufstufe. */
export function mitLiga(verein, liga) {
  return { ...verein, lg: liga.key, liga, stufe: stufeVon(verein.staerke, liga.stufe) };
}

/** Steigt der Verein auf oder ab? Liefert { verein, richtung }. */
/* `klasse` ist der Einfluss einer Entscheidung auf die Tabelle — immer zugunsten
   des Vereins gelesen: über eins heisst bessere Aussicht auf den Aufstieg und
   geringere Abstiegsgefahr, unter eins das Gegenteil.

   ES GAB IHN NICHT, UND DAS WAR DER FEHLER. „Der Abstiegskampf" und „Das
   Aufstiegsrennen" erzählten vom Kampf um die Liga, aber keine ihrer Kacheln
   berührte ihn: Man wählte zwischen drei Punkten Stärke und einem, und ob der
   Verein oben blieb, entschied hinterher ein Würfel, der von der Entscheidung
   nichts wusste. Eine Karte, die nach etwas fragt, muss es auch bewegen. */
export function ligaWechsel(verein, zufall, ligen = WELT_LIGEN, klasse = 1) {
  const andere = schwesterLiga(verein.liga, ligen);
  if (!andere) return { verein, richtung: null };
  if (verein.liga.stufe === 2 && zufall() < aufstiegsChance(verein) * klasse)
    return { verein: mitLiga(verein, andere), richtung: "auf" };
  if (verein.liga.stufe === 1 && zufall() < abstiegsChance(verein) / klasse)
    return { verein: mitLiga(verein, andere), richtung: "ab" };
  return { verein, richtung: null };
}

/* Die Chance je Saison, VOR dem Klassenfaktor einer Entscheidung. Ohne Feld — ein
   Verein, der nicht durch baueWelt ging — gibt es keinen Wechsel: Eine Chance ohne
   Feld wäre wieder eine, die für sich allein würfelt. */
function wechselChance(verein, gewicht, summe) {
  const plaetze = WECHSEL_PLAETZE[verein.liga.land] ?? WECHSEL_PLAETZE_SONST;
  if (!summe || !plaetze) return 0;
  return Math.min(WECHSEL_DECKEL, plaetze * (gewicht[verein.stufe] ?? 0) / summe);
}
export const abstiegsChance = (verein) => wechselChance(verein, ABSTIEG_GEWICHT, verein.liga.feld?.ab);
export const aufstiegsChance = (verein) => wechselChance(verein, AUFSTIEG_GEWICHT, verein.liga.feld?.auf);

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

/* ── Nach der Leihe ────────────────────────────────────────────────────────────
   DIE RÜCKKEHR WAR ZWANG. Nach einer Leihsaison gab es genau eine Kachel: „Zurück
   zu …" — auch wenn man beim Leihverein Stammspieler geworden war und der eigene
   Verein einen weiter auf die Bank gesetzt hätte. Eine Entscheidung gab es erst
   wieder einen Schritt später.

   Jetzt ist das Ende der Leihe ein Wechselfenster wie jedes andere, mit drei Wegen:
   zurück zum Stammverein (der naheliegende, deshalb die breite Kachel), beim
   Leihverein bleiben, oder zu einem der Vereine, die gerade anklopfen. Von denen
   höchstens zwei, damit das Bild dasselbe bleibt wie bei jedem Angebot: drei
   Kacheln und eine breite darunter. Stammverein und Leihverein stehen nie doppelt
   unter den fremden Angeboten. */
export const NACH_LEIHE_ANDERE = 2;
export function nachLeiheWege(heim, leihverein, offerten) {
  const andere = offerten
    .filter((v) => v.key !== heim.key && v.key !== leihverein.key)
    .slice(0, NACH_LEIHE_ANDERE);
  return { heim, leihverein, andere };
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
    talent: zieheTalent(zufall),
    alter: START_ALTER,
    ovr: OVR_START,
    rest: 0,                 // Restbetrag des Wachstums, siehe wachstumGanz
    national: { spiele: 0, tore: 0, vorlagen: 0 },
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
    gesamt: { spiele: 0, tore: 0, vorlagen: 0, gegentore: 0, westen: 0 },
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

/* ── Der Torwart hatte keine Statistik ────────────────────────────────────────
   Die Zeitleiste führt Spiele, Tore und Vorlagen. Ein Torwart kam über eine ganze
   Laufbahn auf NULL Tore und eine Handvoll Vorlagen — gemessen bei Rating 80 und
   26 Spielen je Saison: 0,0 Tore, 0,1 Vorlagen. Eine von zwölf wählbaren Positionen
   hatte damit zwei Spalten Nullen und nichts, woran man eine gute Saison erkennt.

   Er bekommt deshalb zwei eigene Zahlen. Gegentore und weisse Westen sind die
   beiden, die im Fussball wirklich über Torhüter geführt werden.

   DIE RECHNUNG. Grundlage ist ein Gegentorschnitt, der am Niveau der Mannschaft
   hängt (ein Spitzenverein lässt weniger zu) und an der Klasse des Torhüters. Aus
   demselben Schnitt folgt die Wahrscheinlichkeit einer weissen Weste: Bei einem
   Erwartungswert von λ Toren je Spiel bleibt ein Spiel mit e^−λ zu null — die
   Poissonverteilung liefert sie frei Haus, und die Zahlen treffen die Wirklichkeit
   gut (bei 1,0 Gegentoren je Spiel rund 37 % weisse Westen). */
export const GEGENTORE_GRUND = 1.85;

export function torwartSaison(k, stufe, spiele, zufall) {
  /* Je stärker das Umfeld und je besser der Mann, desto weniger fällt. Die Spanne
     läuft von rund 1,6 Gegentoren je Spiel bei einem schwachen Torwart in einem
     schwachen Verein bis rund 0,8 an der Spitze. */
  const schnitt = grenze(
    GEGENTORE_GRUND - stufe * 0.09 - (grenze(k.ovr, 40, 99) - 55) * 0.012,
    0.6, 2.2);
  const gegentore = poisson(spiele * schnitt, zufall);
  let westen = 0;
  const zuNull = Math.exp(-schnitt);
  for (let i = 0; i < spiele; i++) if (zufall() < zuNull) westen++;
  return { gegentore, westen };
}

/** Tore und Vorlagen einer Saison — beim Torwart zusätzlich Gegentore und Westen. */
export function saisonLeistung(k, stufe, zufall) {
  const p = posDaten(k.pos);
  const spiele = Math.round(SPIELE_JE_SAISON * einsatzAnteil(k.ovr, stufe, k.rolle));
  const guete = gueteVon(k.ovr);
  const umfeld = 0.75 + stufe * 0.11;
  const tore = poisson(spiele * 0.42 * p.tore * guete * umfeld, zufall);
  const vorlagen = poisson(spiele * 0.26 * p.vorlagen * guete * umfeld, zufall);
  if (p.gruppe !== "TOR") return { spiele, tore, vorlagen };
  return { spiele, tore, vorlagen, ...torwartSaison(k, stufe, spiele, zufall) };
}

/** Führt dieser Spieler Torwartzahlen? Entscheidet über die Spalten der Tabelle. */
export const istTorwart = (pos) => posDaten(pos).gruppe === "TOR";

/* ── Alle Titel des Modus ──────────────────────────────────────────────────────
   Name, Trophäenform und die Lichtfarbe der Feier stehen hier — an EINER Stelle.

   WARUM NICHT HONOURS AUS gameData.js, wo dreizehn davon schon stehen: Jene Liste
   speist auch Hexbretter, „Wer passt nicht?" und die Fußball-Kette. Dort ist ein
   Titel eine Rätselkachel, und eine Kachel braucht Spieler, die den Titel laut
   Datenbestand gewonnen haben. Für die Taça de Portugal führen wir keine — ein
   Eintrag dort ergäbe ein unlösbares Feld in einem anderen Modus. Der Karrieremodus
   erfindet seine Titel selbst und braucht dafür keine Spielerdaten, also bekommt er
   seine eigene Liste. */
export const TITEL_DATEN = {
  /* Meisterschaften — eine Schale, die man über eine ganze Saison erspielt. */
  MBL: { name: "Deutscher Meister",       form: "schale", c1: "#D3010C" },
  MPL: { name: "Englischer Meister",      form: "schale", c1: "#3D195B" },
  MLL: { name: "Spanischer Meister",      form: "schale", c1: "#E03A3E" },
  MSA: { name: "Italienischer Meister",   form: "schale", c1: "#0A66B0" },
  ML1: { name: "Französischer Meister",   form: "schale", c1: "#091C3E" },
  MPT: { name: "Portugiesischer Meister", form: "schale", c1: "#046A38" },
  MNL: { name: "Niederländischer Meister", form: "schale", c1: "#F36C21" },
  MAT: { name: "Österreichischer Meister", form: "schale", c1: "#C8102E" },
  MBR: { name: "Brasilianischer Meister", form: "schale", c1: "#009B3A" },
  MML: { name: "MLS Cup",                 form: "schale", c1: "#1B3A6B" },
  MSP: { name: "Saudi-arabischer Meister", form: "schale", c1: "#006C35" },
  MJP: { name: "Japanischer Meister",     form: "schale", c1: "#BC002D" },
  /* Landespokale — Henkelpokal mit Deckel. */
  DFB: { name: "DFB-Pokal",        form: "pokal", c1: "#D3010C" },
  FAC: { name: "FA Cup",           form: "pokal", c1: "#3D195B" },
  CDR: { name: "Copa del Rey",     form: "pokal", c1: "#E03A3E" },
  CIT: { name: "Coppa Italia",     form: "pokal", c1: "#0A66B0" },
  CDF: { name: "Coupe de France",  form: "pokal", c1: "#091C3E" },
  TDP: { name: "Taça de Portugal", form: "pokal", c1: "#046A38" },
  KNV: { name: "KNVB-Pokal",       form: "pokal", c1: "#F36C21" },
  OFB: { name: "ÖFB-Pokal",        form: "pokal", c1: "#C8102E" },
  /* Europa, Auswahl, Einzelauszeichnung. */
  CL:  { name: "Champions League", form: "ohren",   c1: "#1B2A6B" },
  EL:  { name: "Europa League",    form: "amphore", c1: "#F26F21" },
  WM:  { name: "Weltmeister",      form: "globus",  c1: "#C9A227" },
  EM:  { name: "Europameister",    form: "kelch",   c1: "#123B8F" },
  CA:  { name: "Copa América",     form: "kelch",   c1: "#2DD4BF" },
  BDO: { name: "Ballon d'Or",      form: "ball",    c1: "#C9A227" },
};

/* Die Reihenfolge in Vitrine und Urkunde: das Seltenste zuerst. */
export const TITEL_REIHE = [
  "BDO", "WM", "EM", "CA", "CL", "EL",
  "MBL", "MPL", "MLL", "MSA", "ML1", "MPT", "MNL", "MAT", "MBR", "MML", "MSP", "MJP",
  "DFB", "FAC", "CDR", "CIT", "CDF", "TDP", "KNV", "OFB",
];

export const titelName = (key) => TITEL_DATEN[key]?.name || key;
export const titelForm = (key) => TITEL_DATEN[key]?.form || "pokal";

/* ── Titel ─────────────────────────────────────────────────────────────────────
   Je Saison wird für Liga, Pokal und Europapokal getrennt gewürfelt. Modifikatoren
   aus Entscheidungen (etwa „Priorität Liga") wirken als Faktor.

   Ein Zweitligist kann keinen Meistertitel gewinnen — dort steht kein Schlüssel.

   NACHGETRAGEN: Portugal, die Niederlande und Österreich hatten keinen Meister und
   Frankreich keinen Pokal. Das waren 52 beziehungsweise 70 Vereine, bei denen die
   halbe Titelmechanik abgeschaltet war, ohne dass es irgendwo stand — wer sich für
   Benfica oder Ajax entschied, konnte national nichts gewinnen. Die vier neuen
   Ligen ausserhalb Europas haben aus demselben Grund von Anfang an eine
   Meisterschaft; einen Pokal führen wir dort nicht, weil er auch im Fussball
   ausserhalb Europas seltener eine bekannte Trophäe ist. */
export const LIGA_TITEL = {
  BL: "MBL", PL: "MPL", LL: "MLL", SA: "MSA", L1: "ML1",
  PT: "MPT", NL: "MNL", AT: "MAT",
  BRA: "MBR", MLS: "MML", SAU: "MSP", JPN: "MJP",
};
export const POKAL_TITEL = {
  BL: "DFB", PL: "FAC", LL: "CDR", SA: "CIT", L1: "CDF",
  PT: "TDP", NL: "KNV", AT: "OFB",
};

/* Die fünf, die „Europas Erster" meint. Sie stehen ausdrücklich hier und werden
   NICHT aus LIGA_TITEL abgeleitet: Sonst hätte das Nachtragen der acht weiteren
   Meisterschaften die Auszeichnung still verwässert. */
export const GROSSE_LIGEN = ["MBL", "MPL", "MLL", "MSA", "ML1"];

export function saisonTitel(verein, zufall, mod = {}) {
  const out = [];
  const liga = LIGA_TITEL[verein.lg];
  if (liga && zufall() < titelAnteil(verein, "liga") * (mod.liga ?? 1)) out.push(liga);
  const pokal = POKAL_TITEL[verein.lg];
  if (pokal && zufall() < titelAnteil(verein, "pokal") * (mod.pokal ?? 1)) out.push(pokal);
  /* Erst die Champions League, dann die Europa League — wer beides gewinnt, gibt es
     nicht. Welcher der beiden Wettbewerbe einem Verein liegt, steckt schon in den
     Gewichten: Die Spitze holt die eine, das obere Mittelfeld die andere. */
  const europa = mod.europa ?? 1;
  if (zufall() < titelAnteil(verein, "cl") * europa) out.push("CL");
  else if (zufall() < titelAnteil(verein, "el") * europa) out.push("EL");
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
/* BERUFEN WIRD FRÜHER ALS VORHER. Die Schwelle lag bei 76, und das passte zu einer
   Welt, in der der Median einer Laufbahn bei 87 endete. Mit dem Talentwurf liegt er
   bei 74 — mit der alten Schwelle hätte die Mehrheit nie ein Länderspiel gemacht,
   und die Auswahl käme im Spiel schlicht nicht mehr vor. 72 heisst: Wer eine
   ordentliche Laufbahn spielt, kommt zu ein paar Einsätzen; gesetzt ist deshalb
   noch niemand. */
export const TURNIER_TAKT = 4;

/* WER DEN VERBAND WECHSELT, IST DORT GESETZT. Genau das verspricht die Karte („Du
   wärest dort sofort gesetzt") — und genau das löste sie vorher nicht ein: Sie setzte
   ein Merkmal und sonst nichts. Der Wechsel senkt jetzt die Berufungsschwelle um
   sechs Punkte, und weil das Land in der Titelrechnung steht, ändert er auch die
   Aussichten auf einen Länderpokal. Ein Tausch mit zwei Seiten, keine Zierde. */
export const VERBAND_BONUS = 6;

/* ── Welche Auswahl gewinnt etwas? ─────────────────────────────────────────────
   VORHER GAR KEINE FRAGE: Die Titelchance hing allein am Rating des Spielers und an
   der Stufe seines Vereins. Das Land kam in der Rechnung nicht vor — ein starker
   Österreicher wurde deshalb genauso oft Weltmeister wie ein starker Brasilianer,
   und im Spiel passierte genau das: zweimal Weltmeister mit Österreich.

   Eine Weltmeisterschaft gewinnt aber die Mannschaft, nicht der Spieler. Deshalb
   trägt jedes Land jetzt einen Faktor, und der ist mit Absicht hart gestuft:

     1,00  die neun, die eine WM realistisch gewinnen
     0,25  Mannschaften, denen man ein Endspiel zutraut
     0,07  Nationen mit Tradition, die dafür alles zusammenkommen muss
     0,012 alle übrigen

   Wie aus diesen Gewichten eine Siegchance wird, steht unten bei nationalTitel: Sie
   werden gegen das Feld des Turniers gerechnet, nicht für sich allein. */
export const NATION_A = 1.0, NATION_B = 0.25, NATION_C = 0.07, NATION_REST = 0.012;

const NATIONEN_A = ["BR", "AR", "FRA", "GER", "ESP", "ENG", "ITA", "PRT", "NED"];
const NATIONEN_B = ["BE", "HR", "UY", "CO", "MX", "MA", "JP", "US", "DK", "CH"];
const NATIONEN_C = ["RS", "SN", "KR", "PL", "SE", "TR", "AUT", "AT", "CZ", "UA", "NO", "EC", "PE",
  "CL", "PY", "NG", "CM", "GH", "CI", "DZ", "EG", "TN", "AU", "IR", "GR", "RU", "HU", "RO",
  "SCO", "WAL", "IE", "SK", "SI", "IS", "FI", "CA", "CR", "QA", "SA", "VE", "BO", "JM", "ZA"];

const NATION_STAERKE = new Map([
  ...NATIONEN_A.map((k) => [k, NATION_A]),
  ...NATIONEN_B.map((k) => [k, NATION_B]),
  ...NATIONEN_C.map((k) => [k, NATION_C]),
]);

export const nationStaerke = (land) => NATION_STAERKE.get(land) ?? NATION_REST;

/* ── Wer wird berufen? ─────────────────────────────────────────────────────────
   DIE SCHWELLE WAR FÜR JEDES LAND DIESELBE: 72, für Brasilien wie für Österreich
   wie für Luxemburg. Die Titelchance der Auswahl hing längst am Land, die Berufung
   nicht. Im Durchspielen am 21.09.2026 kam ein Österreicher mit Höchstwert 70 und
   178 Spielen in der Premier League über eine ganze Laufbahn auf kein einziges
   Länderspiel — während Österreich in Wirklichkeit genau aus solchen Spielern
   besteht.

   Ein Land mit tiefem Kader beruft später. Gemessen über 3000 Laufbahnen (Median
   des Höchstwerts 73) heissen die Stufen:

     76  die neun Grossen          etwa 30 % aller Laufbahnen werden berufen
     73  die zweite Reihe          etwa 50 %
     70  Nationen mit Tradition    etwa 76 %
     67  alle übrigen              etwa 92 %

   Ein Deutscher mit 74 ist ein ordentlicher Bundesligaspieler und bleibt zu Hause;
   ein Österreicher mit 70 fährt mit. Die Titelchance ändert sich dadurch nicht —
   sie hängt weiter am Land, nicht an der Schwelle. */
export const BERUFUNG_A = 76, BERUFUNG_B = 73, BERUFUNG_C = 70, BERUFUNG_REST = 67;

/** Ab welcher Stärke beruft dieses Land — ohne Verbandswechsel gerechnet. */
export function berufungsSchwelle(land) {
  const s = nationStaerke(land);
  return s >= NATION_A ? BERUFUNG_A : s >= NATION_B ? BERUFUNG_B : s >= NATION_C ? BERUFUNG_C : BERUFUNG_REST;
}

/* Der Verbandswechsel senkt die Schwelle des NEUEN Landes um VERBAND_BONUS — die
   Karte verspricht „Du wärest dort sofort gesetzt". */
export const berufungAb = (k) => berufungsSchwelle(k.land) - (k.verbandGewechselt ? VERBAND_BONUS : 0);

/* Alle wählbaren Länder — sie bilden das Feld der WM. Unsere acht eigenen Schlüssel
   (GER, ENG, …) ersetzen dort ihren ISO-Code, damit kein Land doppelt zählt. */
const TURNIERLAENDER = alleLaender().map((l) => l.key);

/* Der Name eines Landes. Die acht mit eigener Liga tragen unseren internen
   Schlüssel (GER, ENG, …), alle übrigen ihren ISO-Code — laender.js löst beide auf. */
export const landName = (code) => namenVon(EIGENE[code] || code) || code;

/* ── Und welches Turnier? ──────────────────────────────────────────────────────
   Die Kontinentalmeisterschaft ist nicht überall dieselbe. Vorher gab es nur die
   EM — ein Brasilianer wurde damit Europameister. Europa spielt die EM, Südamerika
   die Copa América; für alle übrigen Verbände führt das Spiel keine Trophäe, sie
   spielen also nur um die Weltmeisterschaft. Lieber eine Lücke als ein Titel, den
   es für dieses Land nicht gibt. */
const EUROPA = new Set(["GER", "ENG", "ESP", "ITA", "FRA", "PRT", "NED", "AUT",
  "AL", "AD", "AM", "AT", "AZ", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FO", "FI",
  "GE", "GI", "GR", "HU", "IS", "IE", "IL", "IM", "GG", "JE", "XK", "LV", "LI", "LT", "LU", "MT",
  "MD", "MC", "ME", "MK", "NO", "PL", "RO", "RU", "SM", "RS", "SK", "SI", "SE", "CH", "TR", "UA",
  "VA", "SCO", "WAL"]);
const SUEDAMERIKA = new Set(["BR", "AR", "UY", "CO", "CL", "PE", "EC", "PY", "BO", "VE"]);

/** Die Kontinentalmeisterschaft dieses Landes — oder null, wo das Spiel keine führt. */
export const kontinentTurnier = (land) =>
  EUROPA.has(land) ? "EM" : SUEDAMERIKA.has(land) ? "CA" : null;

/* Der Erdteil — gröber als das Turnier und aus einem anderen Grund: Er entscheidet,
   welcher Verband einen Großvater ins Spiel bringen darf. Ohne ihn wären Europa und
   Südamerika sauber getrennt, aber alle übrigen Länder lägen in EINEM Topf, und ein
   Japaner bekäme ein Angebot aus Kamerun. */
const AFRIKA = new Set(["MA", "SN", "NG", "CM", "GH", "CI", "DZ", "EG", "TN", "ZA", "ML", "BF",
  "CD", "CG", "GA", "GN", "AO", "ZM", "ZW", "UG", "KE", "ET", "MZ", "MG", "SD", "LY", "MR", "TG", "BJ", "NE", "CV"]);
const ASIEN = new Set(["JP", "KR", "IR", "SA", "QA", "AU", "CN", "IQ", "AE", "UZ", "TH", "VN", "ID",
  "IN", "MY", "SY", "JO", "OM", "KW", "BH", "LB", "PS", "KP", "TJ", "TM", "KG", "KZ", "PH", "SG", "NP", "MM", "KH", "LA", "BD", "LK", "YE", "AF", "MN", "HK", "TW", "MO", "BT", "MV", "TL", "BN"]);
const NORDAMERIKA = new Set(["US", "MX", "CA", "CR", "JM", "HN", "PA", "SV", "GT", "TT", "HT", "DO",
  "CU", "NI", "BZ", "CW", "SX", "AW", "BB", "BS", "GD", "LC", "VC", "AG", "KN", "DM", "PR", "VI", "VG", "KY", "BM", "TC", "AI", "MS"]);

export function erdteil(land) {
  if (EUROPA.has(land)) return "EU";
  if (SUEDAMERIKA.has(land)) return "SA";
  if (AFRIKA.has(land)) return "AF";
  if (ASIEN.has(land)) return "AS";
  if (NORDAMERIKA.has(land)) return "NA";
  return null;
}

/** Welches Turnier findet in dieser Saison statt — oder keines? */
export function turnierIn(saisonNr, land = null) {
  const rest = saisonNr % TURNIER_TAKT;
  if (rest === 0) return "WM";
  if (rest === 2) return land === null ? "EM" : kontinentTurnier(land);
  return null;
}

/* ── Die Auswahl zählt auch ohne Titel ─────────────────────────────────────────
   VORHER GAB ES NUR TITEL. Man wurde Weltmeister, aber wie oft man überhaupt für
   sein Land gespielt hatte, stand nirgends — und damit fehlte der Zusammenhang:
   Ein Titel ohne Länderspiele wirkt wie ein Zufallsfund.

   Berufen wird, wer die Schwelle seines Landes erreicht. Die Zahl der Spiele hängt daran, wie
   weit er darüber liegt — ein gerade Berufener kommt auf zwei, drei Einsätze, ein
   Weltklassespieler ist gesetzt. Tore und Vorlagen folgen derselben Rechnung wie
   im Verein, nur auf weniger Spiele. */
export const LAENDERSPIELE_JE_SAISON = 10;

export function nationalLeistung(k, zufall) {
  const ab = berufungAb(k);
  if (k.ovr < ab) return { spiele: 0, tore: 0, vorlagen: 0 };
  const p = posDaten(k.pos);
  /* Von einem Viertel der möglichen Spiele bei frischer Berufung bis fast allen
     an der Spitze. */
  const anteil = grenze(0.25 + (k.ovr - ab) / 30, 0.25, 0.95);
  const spiele = Math.round(LAENDERSPIELE_JE_SAISON * anteil);
  const guete = gueteVon(k.ovr);
  return {
    spiele,
    tore: poisson(spiele * 0.42 * p.tore * guete, zufall),
    vorlagen: poisson(spiele * 0.26 * p.vorlagen * guete, zufall),
  };
}

/* ── EIN TURNIER HAT EINEN SIEGER ──────────────────────────────────────────────
   DER FEHLER DER VORIGEN FASSUNG war derselbe, den die Meisterschaften schon einmal
   hatten: Jede Nation würfelte für sich. Mit einer Grundchance von 22 % je WM und
   neun Nationen der obersten Gruppe kamen rechnerisch rund zwei Weltmeister auf
   jedes Turnier. Gemessen an einer gewöhnlichen portugiesischen Laufbahn (Höchstwert
   74, „harter Arbeiter"): In 24 % aller Laufbahnen fiel ein Länderpokal. Im Spiel
   wurde ein Spieler, der nie über Clermont und Burnley hinauskam, zweimal
   Weltmeister und einmal Europameister.

   JETZT WIRD DAS TURNIER IM FELD AUSGESPIELT. Die Nationenfaktoren oben sind
   Gewichte; die Siegchance einer Nation ist ihr Gewicht geteilt durch die Summe
   aller Teilnehmer — bei der WM alle Länder, bei der EM Europa, bei der Copa
   Südamerika. ÜBERRASCHUNG ist ein Punkt für alles, was die Gruppen nicht abbilden:
   Gastmannschaften, Aussenseiter, einen schlechten Tag.

   UND DER SPIELER MUSS DABEI SEIN. Wer gerade so berufen wird, fährt selten mit —
   der Kaderanteil läuft von 10 % an der Berufungsschwelle bis zum vollen Wert
   vierzehn Punkte darüber. Gewinnt Portugal, ist ein Stammspieler Europameister; ein
   Ergänzungsspieler nur, wenn er im Aufgebot stand.

   NACHGEMESSEN (je 4000 Laufbahnen): Portugal mit Höchstwert 74 holt in 5 % der
   Laufbahnen einen Länderpokal (vorher 24 %), mit 90 in 40 % (vorher 67 %);
   Brasilien mit 74 in 9 %, mit 90 in 60 %; Österreich mit 90 in 4 % (vorher 6 %).
   Je Turnier: 5,9 % WM für eine Nation der obersten Gruppe, 9,9 % EM, 21,6 % Copa
   América für Brasilien. */
/* Klein gehalten, weil es gegen die ganze Summe zählt: Bei der Copa mit nur zehn
   Verbänden hätte ein ganzer Punkt ein Viertel aller Turniere ohne Sieger gelassen —
   eine Prüfung hat genau das aufgedeckt. Gäste gewinnen die Copa praktisch nie. */
export const UEBERRASCHUNG = 0.5;
export const KADER_SOCKEL = 0.10, KADER_SPANNE = 14;

/* In der Copa América zählen zwei Verbände mehr, als ihre Weltstärke sagt: Uruguay
   hat sie fünfzehnmal gewonnen, so oft wie Argentinien, und Kolumbien stand zuletzt
   regelmässig im Halbfinale. Mit den Weltgewichten teilten sich Brasilien und
   Argentinien die Copa fast allein (je 29 %); so sind es je gut 21 % — nahe an dem,
   was die Geschichte des Turniers hergibt. Nur für die Copa, nicht für die WM. */
const COPA_STAERKE = { UY: 1.0, CO: 0.7 };
const turnierStaerke = (land, turnier) =>
  turnier === "CA" && COPA_STAERKE[land] !== undefined ? COPA_STAERKE[land] : nationStaerke(land);

const feldSummen = new Map();
function feldSumme(turnier) {
  if (feldSummen.has(turnier)) return feldSummen.get(turnier);
  const teilnehmer = new Set([...NATIONEN_A, ...NATIONEN_B, ...NATIONEN_C, ...TURNIERLAENDER]);
  let summe = UEBERRASCHUNG;
  for (const land of teilnehmer) {
    if (land === "AT") continue;   // dasselbe Land wie AUT, nur anders geschrieben
    if (turnier === "EM" && erdteil(land) !== "EU") continue;
    if (turnier === "CA" && erdteil(land) !== "SA") continue;
    summe += turnierStaerke(land, turnier);
  }
  feldSummen.set(turnier, summe);
  return summe;
}

/** Wie wahrscheinlich gewinnt dieses Land dieses Turnier? */
export const siegChance = (land, turnier) => turnierStaerke(land, turnier) / feldSumme(turnier);

/** Wie wahrscheinlich steht der Spieler im Turnieraufgebot? */
export const imKader = (k) => grenze(KADER_SOCKEL + (k.ovr - berufungAb(k)) / KADER_SPANNE, KADER_SOCKEL, 1);

export function nationalTitel(k, verein, zufall, saisonNr = 0) {
  const turnier = turnierIn(saisonNr, k.land ?? null);
  if (!turnier || k.ovr < berufungAb(k)) return [];
  return zufall() < siegChance(k.land, turnier) * imKader(k) ? [turnier] : [];
}

/* ── Welcher Verband würde ihn nehmen? ────────────────────────────────────────
   Die Karte „Ein Großvater aus dem Ausland" nannte kein Land. Sie konnte auch
   keines nennen, denn sie änderte keines — jetzt nennt sie eines, und der Spieler
   sieht vor der Entscheidung, worauf er sich einlässt.

   Angeboten wird ein Land desselben Erdteils — sonst würde man über einen Großvater
   vom Europameister zum Südamerikameister, und ein Japaner bekäme ein Angebot aus
   Kamerun. Und es ist eines der SCHWÄCHEREN, wenn man aus einer
   starken Nation kommt, sonst eines der stärkeren: So ist der Tausch immer
   ein echter — Einsätze gegen Titelaussicht oder umgekehrt. */
const VERBAND_KANDIDATEN = [
  ...NATIONEN_A, ...NATIONEN_B, ...NATIONEN_C,
].filter((l) => l !== "AT");   // AT und AUT sind dasselbe Land, nur zwei Schreibweisen

export function verbandsAngebot(k, zufall) {
  const eigen = nationStaerke(k.land);
  const heimat = erdteil(k.land);
  if (!heimat) return null;
  const schwaecher = eigen >= NATION_B;
  const infrage = VERBAND_KANDIDATEN.filter((l) => {
    if (l === k.land || erdteil(l) !== heimat) return false;
    const s = nationStaerke(l);
    return schwaecher ? s < eigen : s > eigen;
  });
  if (!infrage.length) return null;
  return infrage[Math.floor(zufall() * infrage.length)];
}

/* ── Entscheidungen ────────────────────────────────────────────────────────────
   Jede Karte nennt ihre Wirkung UND ihre Wahrscheinlichkeit. `wirkung` ist das, was
   bei Erfolg passiert, `sonst` das Gegenteil; fehlt `chance`, tritt `wirkung`
   sicher ein.

   Die Felder von `wirkung`: ovr (sofortiger Zuwachs), rolle (neue Rolle im Team),
   liga/pokal/europa (Faktor auf die Titelchance dieser Saison), verletzt und
   gesperrt (Saisons ohne Spiel), schutz (Rückhalt), klasse (Auf- und Abstieg).

   `text` ist KEINE Wirkung, sondern der Satz für einen Ausgang, bei dem sich an den
   Zahlen nichts ändert. Wer die 35-Prozent-Wette gegen die Verletzung gewann, las
   vorher auf der Kachel „▲ nichts ändert sich" und danach „Es bleibt alles, wie es
   war" — beides wahr, aber es klang nicht nach dem Glückstreffer, der es war. Eine
   SICHERE Kachel darf nicht nur aus `text` bestehen; eine Prüfung passt darauf auf.

   ── RÜCKHALT ────────────────────────────────────────────────────────────────
   Eine sichere Kachel konnte lange nur eines: einen Punkt Stärke geben. Damit
   sah jede ruhige Entscheidung im Spiel gleich aus, egal ob es um einen Berater,
   ein Interview oder die Ernährung ging — dreimal „+1 Stärke".

   `schutz` ist der zweite Hebel. Er gibt ein Polster, das den NÄCHSTEN
   misslungenen Einsatz abfängt: Der Rückschlag tritt nicht ein, das Polster ist
   danach verbraucht. Er wirkt nur gegen eine Wette, nicht gegen den Preis einer
   sicheren Wahl — wer „Finger weg" sagt und dafür einen Punkt zahlt, zahlt ihn.

   Ursprünglich sollte der zweite Hebel „diese Saison kann dich keine Verletzung
   treffen" heissen. Das wäre ein leeres Versprechen gewesen: Eine Saison
   verletzt hier niemanden von selbst, Verletzungen kommen ausschliesslich aus
   diesen Karten. Der Schutz muss also an der Karte ansetzen, nicht an der Saison.

   Verletzt und gesperrt kosten mechanisch dasselbe — die Saison ist weg. Sie
   stehen trotzdem getrennt da, weil sie im Lebenslauf nicht dasselbe sind: Ein
   Kreuzbandriss ist Pech, eine Sperre ist die Rechnung für eine Entscheidung.
   Wer beim Präparat erwischt wird, soll in der Zeitleiste „gesperrt" lesen und
   nicht „verletzt". */
/* ── Welche Wettbewerbe spielt der Verein überhaupt? ──────────────────────────
   Karten wirken auf Meisterschaft, Pokal und Europapokal. Solange es nur die
   europäischen ersten Ligen gab, spielte fast jeder Verein, dem eine solche Karte
   begegnete, alle drei. Mit den zweiten Ligen war das schon nicht mehr wahr, mit
   Brasilien, der MLS, Saudi-Arabien und Japan ist es offensichtlich falsch: Bei
   Al-Hilal kam „Drei Wettbewerbe — Liga, Pokal, Europa", in der 2. Bundesliga
   „Aussicht auf die Meisterschaft ×1,5". Beides verspricht etwas, das es dort nicht
   gibt. Ohne Verein (etwa in einer Prüfung) gilt alles als vorhanden. */
export function wettbewerbe(verein) {
  if (!verein?.lg) return { liga: true, pokal: true, europa: true };
  return {
    liga: !!LIGA_TITEL[verein.lg],
    pokal: !!POKAL_TITEL[verein.lg],
    europa: verein.liga?.stufe === 1 && EUROPA.has(verein.liga?.land),
  };
}

/* Helfer für die Bedingungen unten. Sie lesen aus dem Verlauf, was gerade passiert
   ist — der Schritt davor ist die „letzte Saison", auch wenn er zwei umfasst. */
export const letzteSaison = (k) => (k.verlauf && k.verlauf.length ? k.verlauf[k.verlauf.length - 1] : null);

/* ── Die Rolle gilt für einen Verein, nicht für eine Laufbahn ────────────────
   DIE ROLLE WURDE NIE ZURÜCKGESETZT. Sie startete als „Stammspieler" und änderte
   sich nur durch Ereigniskarten — nicht bei einem Wechsel. Wer mit 22 wegen eines
   unbedachten Beitrags bei Werder Bremen auf „Rotation" fiel, blieb das in Kobe, in
   Dschidda, in Caen, in New York und in Vila do Conde, bis zum Karriereende, und
   bekam bei jedem dieser Vereine nur 72 Prozent der Einsätze. So im Durchspielen
   am 21.09.2026 passiert.

   Jede Karte, die eine Rolle vergibt, spricht von DIESER Mannschaft: „Der Verein
   erwartet eine Reaktion", „Der Verein holt jemanden für deinen Platz". Ein neuer
   Verein ist ein neuer Anfang. Derselbe Verein bleibt derselbe — auch nach Auf- oder
   Abstieg, der den Schlüssel nicht ändert. */
export function rolleNachWechsel(k, neuerVerein) {
  if (!k.verein || !neuerVerein || k.verein.key !== neuerVerein.key) return "stamm";
  return k.rolle;
}

/* ── In welche Richtung eine Rolle wirkt ──────────────────────────────────────
   EIN RÜCKSCHLAG BEFÖRDERTE. „Das regelt der Platz" setzt beim Misslingen die Rolle
   auf „Rotation" — und wer vorher nur im Kader stand, stieg damit AUF. Eine Wette zu
   verlieren war für ihn besser, als sie nicht einzugehen. Umgekehrt konnte ein
   gelungener Einsatz, der „Rotation" vergibt, einen Stammspieler herabstufen.

   Eine Rolle in einer Wirkung ist deshalb ein Ziel MIT Richtung: Beim Gelingen einer
   Wette geht es höchstens hinauf, beim Rückschlag und bei einer sicheren Kachel
   höchstens hinunter. Sichere Kacheln vergeben in diesem Spiel nur Rückzüge
   („Sich fügen", „Um eine Pause bitten") — käme eine hinzu, die befördern soll,
   müsste sie eine Wette sein. */
const ROLLEN_RANG = { kader: 0, rotation: 1, stamm: 2 };
const RANG_ROLLE = ["kader", "rotation", "stamm"];
export function rolleNach(aktuell, ziel, aufwaerts) {
  if (!ziel) return aktuell;
  const a = ROLLEN_RANG[aktuell] ?? ROLLEN_RANG.stamm, z = ROLLEN_RANG[ziel];
  return RANG_ROLLE[aufwaerts ? Math.max(a, z) : Math.min(a, z)];
}

/* Der Höchstwert einer Laufbahn — für Urkunde UND Teilen-Text aus derselben
   Quelle. Die Urkunde zeigte früher den Wert beim Rücktritt und wurde korrigiert;
   der Teilen-Text hatte denselben Fehler behalten und schrieb „Höchstwert 67" unter
   eine Laufbahn, deren Urkunde „Bestwert 70" sagte. */
export const bestwert = (k) => Math.max(k.ovr, ...(k.verlauf || []).map((z) => z.ovr));
export const letzteTitel = (k) => letzteSaison(k)?.titel || [];
/* Ging es zuletzt aufwärts oder abwärts? Der Vergleich der beiden letzten Zeilen.
   Er ist der einzige Maßstab, der für jede Position gleich gilt: Ein Torwart und
   ein Stürmer haben ganz verschiedene Zahlen, aber beide einen Wert, der steigt
   oder fällt. Ohne zwei Zeilen gibt es keinen Trend — dann null. */
export function ratingTrend(k) {
  const v = k.verlauf || [];
  if (v.length < 2) return 0;
  return v[v.length - 1].ovr - v[v.length - 2].ovr;
}

/* Tore plus Vorlagen je Spiel — der einfachste Maßstab dafür, ob etwas ankam. */
export function torBeitrag(k) {
  const s = letzteSaison(k);
  if (!s || !s.spiele) return 0;
  return (s.tore + s.vorlagen) / s.spiele;
}

export const EREIGNISSE = [
  /* ── Die drei Trainingskarten ────────────────────────────────────────────────
     Sie fragen alle dasselbe: mehr Arbeit gegen mehr Risiko. Damit daraus nicht
     dreimal dieselbe Karte wird, hat jede ein eigenes Risikobild — die Ernährung
     ist die kleine Wette, die Extraschicht die grosse (sie kann eine ganze Saison
     kosten), der Privattrainer geht nicht auf die Stärke, sondern auf den Platz in
     der Elf.

     Und keine der sicheren Kacheln ist mehr leer. Vorher stand dort `{}` — „nichts
     ändert sich". Damit war die Rechnung jedes Mal dieselbe: Wetten hatte einen
     Erwartungswert über null, Ablehnen keinen. Das ist keine Entscheidung, das ist
     ein Knopf. Jetzt zahlt die sichere Kachel sicher etwas, die riskante im Schnitt
     mehr — und wer nicht wetten will, gibt trotzdem nicht umsonst ab. */
  { key: "ernaehrung", titel: "Ernährungsplan", text: "Ein Ernährungsberater will deine Kost umstellen. Dein Körper kennt allerdings, was er kennt.",
    optionen: [
      { label: "Dem Plan folgen", bild: "ruhe", chance: 0.6, wirkung: { ovr: 3 }, sonst: { ovr: -2 } },
      { label: "Beim Gewohnten bleiben", bild: "familie", wirkung: { ovr: 1 } },
    ] },
  { key: "extraschicht", titel: "Extraschichten", text: "Du könntest nach dem Training bleiben. Mehr Arbeit, weniger Erholung.",
    optionen: [
      { label: "Jeden Abend länger", bild: "training", chance: 0.7, wirkung: { ovr: 4 }, sonst: { ovr: -1, verletzt: 1 } },
      { label: "Normal trainieren", bild: "platz", wirkung: { ovr: 1, liga: 1.2 } },
    ] },
  { key: "trainer", titel: "Privattrainer", text: "Ein Individualtrainer bietet sich an. Er arbeitet genau an dem, was der Trainer an dir vermisst.",
    optionen: [
      { label: "Verpflichten", bild: "training", chance: 0.7, wirkung: { ovr: 2, rolle: "stamm" }, sonst: { ovr: -1, rolle: "rotation" } },
      { label: "Dankend ablehnen", bild: "ruhe", wirkung: { ovr: 1 } },
    ] },
  /* Die einzige Karte mit einem Gewissen — und die einzige, bei der ein Ausfall
     keine Verletzung ist, sondern eine Sperre. Wer sauber bleibt, verliert
     trotzdem: nicht viel, aber die anderen ziehen vorbei. Eine moralische Wahl,
     die gratis ist, ist keine. */
  { key: "mittel", titel: "Zweifelhaftes Mittel", text: "Jemand im Umfeld verspricht dir ein Präparat, das angeblich nicht auffällt.",
    optionen: [
      { label: "Nehmen", bild: "risiko", chance: 0.65, wirkung: { ovr: 5 }, sonst: { ovr: -2, gesperrt: 1 } },
      { label: "Finger weg", bild: "medizin", wirkung: { ovr: -1 } },
    ] },
  { key: "posting", titel: "Unbedachter Beitrag", text: "Ein Beitrag von dir schlägt Wellen. Der Verein erwartet eine Reaktion.",
    optionen: [
      /* Beide Ausgänge setzten nur eine Rolle — und wer schon unten stand, verlor
         dabei nichts: Die Entschuldigung war für einen Rotationsspieler gratis, der
         Rückschlag für einen Ergänzungsspieler ebenso. Jetzt kostet beides auch. */
      { label: "Öffentlich entschuldigen", bild: "presse", wirkung: { rolle: "rotation", ovr: -1 } },
      { label: "Dazu stehen", bild: "risiko", chance: 0.4, wirkung: { ovr: 1 }, sonst: { rolle: "kader", ovr: -1 } },
    ] },
  { key: "prioritaet", titel: "Ansage des Vereins", text: "Der Verein will wissen, worauf ihr diese Saison alles setzt.",
    wenn: (k) => { const w = wettbewerbe(k.verein); return w.liga && w.europa; },
    optionen: [
      { label: "Auf die Liga", bild: "platz", wirkung: { liga: 2, europa: 0.5 } },
      { label: "Auf Europa", bild: "pokal", wirkung: { europa: 2, liga: 0.5 } },
    ] },
  /* „Für DEINEN Platz" — die Karte setzt voraus, dass man einen hat. Vorher konnte
     sie auch einen Ergänzungsspieler treffen, und dann ging es um einen Platz, den
     er gar nicht besass. */
  { key: "konkurrenz", titel: "Konkurrenz auf deiner Position", text: "Der Verein holt jemanden für deinen Platz.",
    wenn: (k) => k.rolle === "stamm",
    optionen: [
      { label: "Kampf annehmen", bild: "training", chance: 0.5, wirkung: { rolle: "stamm", ovr: 2 }, sonst: { rolle: "rotation" } },
      { label: "Sich fügen", bild: "bank", wirkung: { rolle: "rotation" } },
    ] },
  { key: "talent", titel: "Ein Talent drängt nach", text: "Ein Sechzehnjähriger trainiert bei euch mit und ist nah dran.",
    /* Der Junge drängt auf DEINEN Platz — also nur, wenn man einen hat. Und wer ihn
       verteidigt, gewinnt dabei etwas: Vorher war der gute Ausgang nur „Stammplatz",
       und für einen, der Stammspieler schon ist, hiess das: nichts. Die Wette hatte
       dann keine Seite nach oben — im Durchspielen am 21.09.2026 ging sie auf, und
       die Folge lautete „Es bleibt alles, wie es war". */
    wenn: (k) => { const w = wettbewerbe(k.verein); return (w.liga || w.pokal) && k.rolle === "stamm"; },
    optionen: [
      { label: "Ihn unter die Fittiche nehmen", bild: "nachwuchs", wirkung: { liga: 1.3, pokal: 1.3 } },
      { label: "Ihm keinen Raum lassen", bild: "kabine", chance: 0.6, wirkung: { ovr: 1 }, sonst: { rolle: "rotation", ovr: -1 } },
    ] },
  /* PFIFFE KAMEN AUS DEM NICHTS. Die Karte hatte keine Bedingung und traf damit auch
     einen, der gerade Meister geworden war und dreissig Tore geschossen hatte. Jetzt
     braucht sie eine Saison, die dazu passt: gespielt, nichts gewonnen, und der Wert
     ist nicht gestiegen. */
  { key: "pfiffe", titel: "Pfiffe von den Rängen", text: "Die eigenen Zuschauer stellen dich infrage.",
    wenn: (k) => {
      const s = letzteSaison(k);
      /* Mindestens zwei Zeilen: In der ersten Saison kann der Wert noch nicht
         gefallen sein, und nach einem einzigen Jahr pfeift auch niemand. */
      return k.alter >= 20 && !!s && (k.verlauf?.length ?? 0) >= 2
        && s.spiele >= 10 && !s.titel.length && ratingTrend(k) <= 0;
    },
    optionen: [
      { label: "Bleiben und liefern", bild: "platz", chance: 0.5, wirkung: { ovr: 2, rolle: "stamm" }, sonst: { ovr: -2 } },
      { label: "Sich zurückziehen", bild: "bank", wirkung: { rolle: "rotation", ovr: -1 } },
    ] },
  /* AUSKURIEREN WAR DIE DUMME WAHL. Es kostete sicher eine ganze Saison, während
     Durchbeissen im Schnitt nur 0,65 kostete — vernünftig war also genau das, wovon
     die Karte abrät. Die Reha zahlt jetzt zurück: ein Jahr weg, aber danach stärker. */
  { key: "verletzung", titel: "Verletzung", text: "Es hat dich erwischt. Die Frage ist nur, wie lange.",
    optionen: [
      { label: "Auskurieren", bild: "medizin", wirkung: { verletzt: 1, ovr: 1 } },
      { label: "Auf die Zähne beißen", bild: "risiko", chance: 0.35, wirkung: { text: "Du spielst die Saison durch" }, sonst: { verletzt: 1, ovr: -3 } },
    ] },
  /* Achtzig Prozent auf das Dreifache der Titelchance, und der Rückschlag kostete nur
     zwei Punkte Stärke — da drückte man immer. Wenn es schiefgeht, bricht man im
     Endspiel ab, und das kostet die Mannschaft den Titel. Erst damit ist es eine Wette. */
  { key: "endspiel", titel: "Verletzt vor dem Endspiel", text: "Kurz vor dem wichtigsten Spiel deiner Saison zwickt es.",
    wenn: (k) => (k.verein?.stufe ?? 0) >= 3,
    optionen: [
      { label: "Spielen", bild: "platz", chance: 0.55, wirkung: { liga: 1.5, europa: 1.5, pokal: 1.5 },
        sonst: { ovr: -2, liga: 0.7, europa: 0.7, pokal: 0.7 } },
      { label: "Aussetzen", bild: "medizin", wirkung: { ovr: 1, liga: 0.85, europa: 0.85, pokal: 0.85 } },
    ] },
  /* Nur dort, wo es einen Pokal zu gewinnen gibt — beide Kacheln sprechen von ihm. */
  { key: "elfmeter", titel: "Elfmeter in der Nachspielzeit", text: "Alle schauen dich an. Übernimmst du?",
    wenn: (k) => wettbewerbe(k.verein).pokal,
    optionen: [
      { label: "Schießen", bild: "platz", chance: 0.5, wirkung: { ovr: 2, pokal: 1.5 }, sonst: { ovr: -1, rolle: "rotation" } },
      /* Er trifft — der Mannschaft hilft es, dir nicht: Wer in der Nachspielzeit
         wegschaut, steht danach kleiner da. */
      { label: "Einem anderen überlassen", bild: "kabine", wirkung: { pokal: 1.2, ovr: -1 } },
    ] },
  { key: "schule", titel: "Abschluss nachholen", text: "Du könntest neben dem Fußball die Schule zu Ende bringen.",
    wenn: (k) => k.alter <= 20 && !k.abschluss,
    optionen: [
      { label: "Durchziehen", bild: "lernen", wirkung: { ovr: -1, abschluss: true } },
      { label: "Ganz auf Fußball setzen", bild: "training", chance: 0.5, wirkung: { ovr: 2 }, sonst: { text: "Es bringt diesmal nichts" } },
    ] },
  /* Die Optionen dieser Karte werden in ziehEreignis ersetzt — erst dort steht
     fest, welches Land anklopft. Was hier steht, ist der Rückfall. */
  { key: "grossvater", titel: "Ein Großvater aus dem Ausland", text: "Ein anderer Verband hätte dich gern. Du wärest dort sofort gesetzt.",
    wenn: (k) => k.alter <= 26 && !k.verbandGewechselt && !!k.land,
    optionen: [
      { label: "Verband wechseln", bild: "verband", wirkung: { verbandswechsel: true } },
      /* Bleiben ist nicht gratis und nicht umsonst: kein Wechsel der Verbände, kein
         neues Umfeld, kein Sommer voller Formalitäten — ein ruhiges Jahr. */
      { label: "Beim eigenen Land bleiben", bild: "platz", wirkung: { ovr: 1 } },
    ] },
  { key: "steuer", titel: "Post vom Finanzamt", text: "Deine Berater haben etwas übersehen. Es wird öffentlich.",
    wenn: (k) => k.alter >= 22,
    optionen: [
      { label: "Alles nachzahlen", bild: "geld", wirkung: { ovr: -1 } },
      { label: "Anwälte kämpfen lassen", bild: "vertrag", chance: 0.45, wirkung: { text: "Die Anwälte setzen sich durch" }, sonst: { ovr: -3, rolle: "rotation" } },
    ] },

  /* ── Karten, die an die Lage gebunden sind ──────────────────────────────────
     Jede hier unten kommt nur, wenn ihre Bedingung zutrifft. Das ist der ganze
     Unterschied zwischen einer Geschichte und einem Los: Die Binde bekommt man
     nicht mit neunzehn, das Knie meldet sich nicht mit zwanzig, und der Patzer
     beim Abschlag trifft nur Torhüter. */

  /* Jung. */
  { key: "internat", titel: "Ein Platz im Internat", text: "Der Verein bietet dir einen Platz im Nachwuchsinternat — näher am Training, weiter weg von zu Hause.",
    wenn: (k) => k.alter <= 18,
    optionen: [
      { label: "Hingehen", bild: "nachwuchs", chance: 0.7, wirkung: { ovr: 3 }, sonst: { ovr: -1 } },
      { label: "Zu Hause bleiben", bild: "familie", wirkung: { ovr: 1 } },
    ] },
  { key: "debuet", titel: "Der Trainer ruft dich", text: "Zwei Ausfälle, und plötzlich stehst du im Kader der Profis. Eine Halbzeit, mehr wird es nicht.",
    wenn: (k) => k.alter <= 21 && k.rolle !== "stamm",
    optionen: [
      /* Ein missratenes Debüt kostet Ansehen, nicht nur einen Punkt: Vorher brachte
         „Alles riskieren" im Schnitt +1,25 UND die bessere Rolle, während das
         vorsichtige Spiel auf +0,75 kam — es gab nichts abzuwägen. */
      { label: "Alles riskieren", bild: "platz", chance: 0.45, wirkung: { ovr: 4, rolle: "rotation" }, sonst: { ovr: -1, rolle: "kader" } },
      { label: "Kein Risiko eingehen", bild: "bank", chance: 0.75, wirkung: { ovr: 1 }, sonst: { text: "Du bleibst unauffällig" } },
    ] },
  { key: "berater", titel: "Ein Berater umwirbt dich", text: "Er verspricht dir die großen Vereine. Sein Anteil ist happig, seine Verbindungen sind es auch.",
    wenn: (k) => k.alter <= 23,
    optionen: [
      { label: "Unterschreiben", bild: "vertrag", chance: 0.6, wirkung: { ovr: 2 }, sonst: { ovr: -2 } },
      /* Der Rückhalt im Wortsinn — jemand, der einen kennt, seit man vierzehn ist,
         fängt den nächsten Rückschlag ab. */
      { label: "Beim Familienberater bleiben", bild: "familie", wirkung: { schutz: 1 } },
    ] },

  /* Rolle und Stellung im Verein. */
  { key: "bank", titel: "Die Bank wird eng", text: "Seit Wochen kommst du nicht mehr rein. Der Trainer redet nicht mit dir darüber.",
    wenn: (k) => k.rolle === "kader",
    optionen: [
      { label: "Ihn zur Rede stellen", bild: "kabine", chance: 0.5, wirkung: { rolle: "rotation" }, sonst: { ovr: -2 } },
      /* Warten kostet, wenn es nicht klappt. Vorher war diese Kachel 40 Prozent auf
         eine bessere Rolle UND zwei Punkte, bei null Risiko — niemand stellte den
         Trainer zur Rede, weil es dafür keinen Grund gab. */
      { label: "Im Training antworten", bild: "training", chance: 0.4, wirkung: { rolle: "rotation", ovr: 2 }, sonst: { ovr: -1 } },
    ] },
  { key: "binde", titel: "Die Binde", text: "Der Kapitän hat aufgehört. Die Mannschaft sieht dich an.",
    wenn: (k) => k.alter >= 27 && k.rolle === "stamm" && (k.verein?.stufe ?? 0) >= 2,
    optionen: [
      { label: "Übernehmen", bild: "kabine", chance: 0.65, wirkung: { ovr: 2, liga: 1.3, pokal: 1.3 }, sonst: { ovr: -1 } },
      /* Der Richtige bekommt die Binde, die Mannschaft läuft besser — du persönlich
         gewinnst nichts. Das spiegelt die andere Kachel: dort beides, hier nur das
         eine. */
      { label: "Einem anderen lassen", bild: "platz", wirkung: { liga: 1.2, pokal: 1.2 } },
    ] },
  { key: "trainerwechsel", titel: "Neuer Trainer", text: "Der Verein entlässt den Trainer. Der Neue bringt eigene Vorstellungen mit — und eigene Spieler.",
    wenn: (k) => k.alter >= 20,
    optionen: [
      /* Für einen Stammspieler war das vorher schlechter als Abwarten: gewonnen +1,
         verloren die Rolle — gegen +1 sicher. Wer sich dem Neuen anbietet und ihn
         überzeugt, gewinnt jetzt mehr als der, der den Kopf einzieht. */
      { label: "Sich anbieten", bild: "kabine", chance: 0.55, wirkung: { rolle: "stamm", ovr: 2 }, sonst: { rolle: "rotation", ovr: -1 } },
      /* Beide Kacheln hatten denselben schlechten Ausgang, aber nur eine einen
         guten — Abwarten war nie richtig. Jetzt ist es die sichere Wahl: kein
         Sprung, aber auch kein Absturz. */
      { label: "Abwarten", bild: "bank", wirkung: { ovr: 1 } },
    ] },

  /* Spitzenverein. */
  { key: "ausruester", titel: "Ein Ausrüster klopft an", text: "Werbetermine, Fototage, eigener Schuh. Es zahlt sich aus und kostet Trainingszeit.",
    wenn: (k) => k.ovr >= 80,
    optionen: [
      /* DIESE KARTE WAR KEINE. Unterschreiben gewann im besten Fall genau das, was
         Absagen sicher gab, und konnte zwei Punkte verlieren — es gab keinen Grund,
         jemals zu unterschreiben. */
      { label: "Unterschreiben", bild: "geld", chance: 0.55, wirkung: { ovr: 3 }, sonst: { ovr: -2 } },
      { label: "Absagen", bild: "training", wirkung: { ovr: 1 } },
    ] },
  { key: "dreifach", titel: "Drei Wettbewerbe", text: "Liga, Pokal, Europa — und dazwischen kaum ein freier Mittwoch.",
    wenn: (k) => { const w = wettbewerbe(k.verein); return (k.verein?.stufe ?? 0) >= 4 && w.liga && w.pokal && w.europa; },
    optionen: [
      { label: "Alles spielen", bild: "platz", chance: 0.5, wirkung: { liga: 1.4, pokal: 1.4, europa: 1.4 }, sonst: { verletzt: 1 } },
      { label: "Im Pokal schonen", bild: "ruhe", wirkung: { pokal: 0.4, liga: 1.2, europa: 1.2 } },
    ] },
  { key: "medien", titel: "Das große Interview", text: "Eine Zeitung will ein langes Gespräch. Offen reden bringt Sympathien und Ärger.",
    wenn: (k) => k.ovr >= 78,
    optionen: [
      { label: "Klartext reden", bild: "presse", chance: 0.45, wirkung: { ovr: 2 }, sonst: { rolle: "rotation", ovr: -1 } },
      { label: "Nichts sagen", bild: "kabine", wirkung: { ovr: 1 } },
    ] },

  /* Nach einem Titel. */
  { key: "titelverteidigung", titel: "Alle erwarten die Wiederholung", text: "Ihr habt geliefert. Jetzt ist genau das die Erwartung, nicht mehr die Hoffnung.",
    /* Beide Kacheln sprechen von Meisterschaft und Pokal. Nach einem Titel mit der
       Auswahl kann man aber bei einem Verein stehen, der weder das eine noch das
       andere spielt — dann verspricht die Karte nichts. */
    wenn: (k) => { const w = wettbewerbe(k.verein); return letzteTitel(k).length > 0 && (w.liga || w.pokal); },
    optionen: [
      { label: "Den Druck annehmen", bild: "pokal", chance: 0.5, wirkung: { liga: 1.5, pokal: 1.3 }, sonst: { ovr: -2 } },
      { label: "Ruhe bewahren", bild: "ruhe", wirkung: { ovr: 1 } },
    ] },
  { key: "feier", titel: "Die Feier läuft aus dem Ruder", text: "Ein Bild von der Nacht nach dem Titel geht herum. Der Verein ist not amused.",
    wenn: (k) => letzteTitel(k).length > 0,
    optionen: [
      { label: "Dazu stehen", bild: "pokal", chance: 0.55, wirkung: { text: "Der Verein lässt es dabei bewenden" }, sonst: { ovr: -2, rolle: "rotation" } },
      { label: "Sich entschuldigen und zahlen", bild: "geld", wirkung: { ovr: -1 } },
    ] },

  /* Nach einer schlechten Saison. */
  { key: "formtief", titel: "Kein Treffer seit Monaten", text: "Die Zahlen der letzten Saison sprechen gegen dich, und du weißt es.",
    wenn: (k) => k.alter >= 22 && letzteSaison(k) && letzteSaison(k).spiele >= 15
      && torBeitrag(k) < 0.14 && posDaten(k.pos).gruppe !== "TOR" && posDaten(k.pos).gruppe !== "ABW",
    optionen: [
      { label: "Zum Sportpsychologen", bild: "ruhe", chance: 0.65, wirkung: { ovr: 3 }, sonst: { ovr: -1 } },
      { label: "Da muss man durch", bild: "training", chance: 0.5, wirkung: { ovr: 4 }, sonst: { ovr: -2 } },
    ] },
  { key: "abstiegskampf", titel: "Der Abstiegskampf", text: "Neun Spiele, sechs Punkte Rückstand. Es geht um die Liga.",
    wenn: (k) => (k.verein?.stufe ?? 9) <= 2 && (k.verein?.liga?.stufe ?? 2) === 1
      && !!k.verein?.liga && !!schwesterLiga(k.verein.liga),
    optionen: [
      { label: "Vorangehen", bild: "platz", chance: 0.5, wirkung: { ovr: 3, klasse: 1.8 }, sonst: { ovr: -2, verletzt: 1 } },
      /* Wer abhakt, arbeitet an sich und lässt die Mannschaft allein — das ist die
         eigentliche Entscheidung dieser Karte, nicht ein Punkt Stärke hin oder her. */
      { label: "Die Saison abhaken", bild: "bank", wirkung: { ovr: 1, klasse: 0.75 } },
    ] },
  { key: "aufstiegsrennen", titel: "Das Aufstiegsrennen", text: "Zweite Liga, dritter Platz, fünf Spieltage. Jetzt entscheidet sich das Jahr.",
    wenn: (k) => (k.verein?.liga?.stufe ?? 1) === 2
      && !!k.verein?.liga && !!schwesterLiga(k.verein.liga),
    optionen: [
      /* Kein Meisterschaftsfaktor: In der zweiten Liga gibt es keinen Titel, auf den
         er wirken könnte. Der Aufstieg ist hier der Titel — und `klasse` ist der
         Hebel darauf. */
      { label: "Alles auf diese Saison", bild: "platz", chance: 0.5, wirkung: { ovr: 3, klasse: 1.8 }, sonst: { ovr: -1 } },
      { label: "Auf die eigene Entwicklung schauen", bild: "training", wirkung: { ovr: 2, klasse: 0.8 } },
    ] },

  /* Torwart. */
  { key: "patzer", titel: "Der Patzer", text: "Ein Abschlag genau vor die Füße des Gegners. Das Bild läuft eine Woche lang.",
    wenn: (k) => posDaten(k.pos).gruppe === "TOR",
    optionen: [
      { label: "Im nächsten Spiel antworten", bild: "platz", chance: 0.55, wirkung: { ovr: 3 }, sonst: { ovr: -3, rolle: "rotation" } },
      { label: "Um eine Pause bitten", bild: "ruhe", wirkung: { rolle: "rotation", ovr: 1 } },
    ] },
  { key: "elfmeterschiessen", titel: "Elfmeterschießen", text: "Pokalhalbfinale, es steht unentschieden nach Verlängerung. Jetzt bist du dran.",
    wenn: (k) => posDaten(k.pos).gruppe === "TOR" && (k.verein?.stufe ?? 0) >= 2 && wettbewerbe(k.verein).pokal,
    optionen: [
      { label: "Auf die Ecke gehen", bild: "platz", chance: 0.45, wirkung: { ovr: 3, pokal: 1.8 }, sonst: { ovr: -1 } },
      { label: "Stehen bleiben und reagieren", bild: "kabine", chance: 0.6, wirkung: { ovr: 1, pokal: 1.3 }, sonst: { text: "Er trifft trotzdem" } },
    ] },

  /* Auswahl. */
  { key: "erste_berufung", titel: "Die erste Berufung", text: "Ein Brief vom Verband. Du stehst im vorläufigen Kader — zum ersten Mal.",
    wenn: (k) => k.ovr >= berufungAb(k) && (k.national?.spiele ?? 0) === 0,
    optionen: [
      { label: "Alles darauf ausrichten", bild: "verband", chance: 0.6, wirkung: { ovr: 2 }, sonst: { ovr: -1 } },
      /* Der Ligafaktor allein hinge in der zweiten Liga in der Luft — dort gibt es
         keinen Meistertitel, und die Kachel stünde leer da. */
      { label: "Den Verein nicht vernachlässigen", bild: "platz", wirkung: { ovr: 1, liga: 1.2 } },
    ] },
  { key: "turnierpause", titel: "Turnier statt Urlaub", text: "Ein ganzer Sommer mit der Auswahl. Erholung gibt es dann eben nicht.",
    wenn: (k) => k.ovr >= berufungAb(k) + 4,
    optionen: [
      { label: "Hinfahren", bild: "reise", chance: 0.6, wirkung: { ovr: 5 }, sonst: { ovr: -1, verletzt: 1 } },
      { label: "Absagen und regenerieren", bild: "ruhe", wirkung: { ovr: 1, liga: 1.2 } },
    ] },

  /* Im Ausland. */
  { key: "sprache", titel: "Die Sprache", text: "In der Kabine verstehst du die Hälfte. Beim Trainer ist es dieselbe Hälfte.",
    wenn: (k) => !!k.verein && !!k.land && k.verein.liga.land !== k.land,
    optionen: [
      { label: "Jeden Morgen Unterricht", bild: "lernen", chance: 0.75, wirkung: { ovr: 2 }, sonst: { text: "Es dauert länger als gedacht" } },
      /* Vorher 35 Prozent auf einen Punkt gegen 75 Prozent auf zwei — die Kachel war
         nur da. Wer die Sprache auf dem Platz lernt, lernt sie langsamer, aber bei
         denen, auf die es ankommt. */
      { label: "Das regelt der Platz", bild: "platz", chance: 0.35, wirkung: { ovr: 3 }, sonst: { rolle: "rotation", ovr: -1 } },
    ] },
  { key: "heimweh", titel: "Heimweh", text: "Es läuft sportlich, aber es ist weit weg. Die Familie fragt, wann du zurückkommst.",
    wenn: (k) => !!k.verein && !!k.land && k.verein.liga.land !== k.land && k.alter <= 25,
    optionen: [
      { label: "Die Familie nachholen", bild: "familie", chance: 0.7, wirkung: { ovr: 2 }, sonst: { ovr: -1 } },
      { label: "Durchhalten", bild: "reise", chance: 0.45, wirkung: { ovr: 3 }, sonst: { ovr: -2 } },
    ] },

  /* Spät. */
  { key: "knie", titel: "Das Knie meldet sich", text: "Nicht schlimm, sagt der Arzt. Aber es meldet sich jetzt jeden Montag.",
    wenn: (k) => k.alter >= 30,
    optionen: [
      /* Vorher war die vernuenftige Wahl, das kaputte Knie NICHT behandeln zu lassen:
         Die Operation kostete sicher eine Saison und gab zwei Punkte, das Durch-
         spritzen im Schnitt weniger. Jetzt holt sie mehr zurueck. */
      { label: "Operieren lassen", bild: "medizin", wirkung: { verletzt: 1, ovr: 3 } },
      { label: "Mit Spritzen durch die Saison", bild: "risiko", chance: 0.5, wirkung: { text: "Das Knie hält" }, sonst: { ovr: -4 } },
    ] },
  /* DER SCHULABSCHLUSS HAT ENDLICH EINEN ZWECK. Er kostete mit zwanzig einen Punkt
     Stärke und tat danach nichts: Er stand in keiner Rechnung, auf keiner Urkunde,
     er schaltete nur seine eigene Karte ab. Jetzt ist er die Voraussetzung für den
     Trainerschein — wer mit zwanzig durchgezogen hat, kann mit zweiunddreissig den
     Schein machen; wer nur gespielt hat, bekommt diese Karte nie zu sehen.

     Und es sind zwei Dinge, nicht eines: Vorher setzten BEIDE Karten dasselbe Feld
     `abschluss`. Der Trainerschein trug sich damit als Schulabschluss ein, was auf
     der Urkunde schlicht falsch stand. */
  { key: "trainerschein", titel: "Der Trainerschein", text: "Die Lehrgänge laufen parallel zur Saison. Danach hättest du etwas in der Hand.",
    wenn: (k) => k.alter >= 32 && !!k.abschluss && !k.trainerschein,
    optionen: [
      { label: "Nebenher machen", bild: "lernen", wirkung: { ovr: -1, trainerschein: true } },
      { label: "Später, erst spielen", bild: "platz", wirkung: { ovr: 1 } },
    ] },
  { key: "abschiedsspiel", titel: "Ein Verein von früher fragt an", text: "Dein Jugendverein will dich zurück — als Aushängeschild, nicht als Verstärkung.",
    /* Dieselbe Luecke wie bei der Titelverteidigung: Die Zusage verspricht
       Meisterschaft und Pokal, ohne zu pruefen, ob der Verein sie ueberhaupt spielt. */
    wenn: (k) => { const w = wettbewerbe(k.verein); return k.alter >= 33 && k.vereine.length >= 3 && (w.liga || w.pokal); },
    optionen: [
      { label: "Zusagen", bild: "nachwuchs", wirkung: { ovr: -1, liga: 1.2, pokal: 1.2 } },
      { label: "Noch nicht", bild: "platz", wirkung: { ovr: 1 } },
    ] },

  /* Umfeld. */
  { key: "wetten", titel: "Ein Anruf, den man nicht annimmt", text: "Jemand bietet viel Geld für eine gelbe Karte zur richtigen Minute.",
    wenn: (k) => k.alter >= 21,
    optionen: [
      { label: "Auflegen und melden", bild: "presse", wirkung: { ovr: 1 } },
      { label: "Zuhören", bild: "risiko", chance: 0.5, wirkung: { ovr: 2 }, sonst: { ovr: -6, rolle: "kader" } },
    ] },
  { key: "stiftung", titel: "Eine Kinderstation fragt an", text: "Einmal im Monat vorbeikommen, ohne Kameras. Es kostet freie Tage.",
    wenn: (k) => k.alter >= 24,
    optionen: [
      /* Mit nur einem Punkt bei achtzig Prozent waere Absagen das bessere Geschaeft
         gewesen. Das Richtige soll hier auch das Bessere sein — knapp. */
      { label: "Zusagen", bild: "familie", chance: 0.8, wirkung: { ovr: 2 }, sonst: { text: "Es kostet nur freie Tage" } },
      { label: "Die Saison ist zu eng", bild: "reise", wirkung: { ovr: 1 } },
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
/* ── Welche Karte passt zur Lage? ─────────────────────────────────────────────
   Vorher standen drei Bedingungen als Sonderfälle hier unten im Filter, und alle
   übrigen Karten konnten immer kommen. Bei fünfzehn Karten und sechs je Laufbahn
   hiess das: Ab der dritten Laufbahn kennt man alle, und keine hat etwas mit dem
   zu tun, was gerade passiert.

   Jetzt trägt jede Karte ihre eigene Bedingung (`wenn`), und die meisten neuen sind
   an die Lage gebunden — an das Alter, die Position, die Spielklasse, den letzten
   Titel, die letzte Saison. Eine Karte, die zur eigenen Lage passt, liest sich wie
   eine Geschichte; eine zufällige wie ein Los. */
export function ziehEreignis(k, zufall, zuletzt = []) {
  const moeglich = EREIGNISSE.filter((e) => {
    if (zuletzt.includes(e.key)) return false;
    return e.wenn ? e.wenn(k) : true;
  });
  /* Passt nichts (etwa weil die letzten Karten die wenigen offenen weggenommen
     haben), fällt die Wahl auf die Karten ohne Bedingung — eine davon gibt es
     immer. */
  const topf = moeglich.length ? moeglich : EREIGNISSE.filter((e) => !e.wenn);
  const e = topf[Math.floor(zufall() * topf.length)] || EREIGNISSE[0];
  return e.key === "grossvater" ? mitVerband(e, k, zufall) : e;
}

/* Setzt das anklopfende Land in Text und Optionen ein. Findet sich keines — etwa
   weil der Spieler schon aus der schwächsten Gruppe kommt und der Erdteil keine
   stärkere hergibt —, bleibt die Karte, wie sie ist; der Filter oben nimmt sie
   dann beim nächsten Mal ohnehin heraus. */
function mitVerband(e, k, zufall) {
  const ziel = verbandsAngebot(k, zufall);
  if (!ziel) return e;
  const name = landName(ziel);
  const staerker = nationStaerke(ziel) > nationStaerke(k.land);
  /* DIE DOPPELPUNKT-FORM IST ABSICHT. „Für Slowakei spielen" ist falsches Deutsch —
     es hiesse „für die Slowakei". Etliche Ländernamen tragen einen Artikel (die
     Schweiz, die Türkei, die Niederlande, die Vereinigten Staaten, der Iran), und
     ihn je Land und Fall zu beugen wäre eine Grammatiktabelle für eine Zeile Text.
     Nach einem Doppelpunkt steht der blosse Name richtig — in jedem Fall. */
  return {
    ...e,
    ziel,
    text: `Ein anderer Verband klopft an: ${name}. Ein Großvater macht dich spielberechtigt, `
      + `und gesetzt wärst du dort sofort`
      + `${staerker ? " — die Auswahl spielt um Titel mit." : ", auch wenn die Auswahl kleiner ist."}`,
    optionen: [
      { label: `Verband wechseln: ${name}`, wirkung: { verbandswechsel: ziel } },
      { label: `Bei der eigenen Auswahl bleiben`, wirkung: {} },
    ],
  };
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
/* „1.6" ist englisch — im Spiel steht „1,6". */
export const faktorText = (f) => String(Math.round(f * 100) / 100).replace(".", ",");

/** Wie sich ein Klassenfaktor liest — je nachdem, worum es bei diesem Verein
 *  überhaupt gehen kann. In der zweiten Liga geht es um den Aufstieg, in der
 *  ersten um den Abstieg; wo es keine Schwesterliga gibt, geht es um nichts, und
 *  dann steht auch nichts da. */
export function klasseText(klasse, verein) {
  if (!klasse || klasse === 1 || !verein?.liga) return null;
  if (!schwesterLiga(verein.liga)) return null;
  if (verein.liga.stufe === 2) {
    return klasse > 1
      ? `Aussicht auf den Aufstieg ×${faktorText(klasse)}`
      : `Aussicht auf den Aufstieg auf ${Math.round(klasse * 100)} %`;
  }
  if (verein.liga.stufe === 1) {
    return klasse > 1
      ? `Abstiegsgefahr auf ${Math.round(100 / klasse)} %`
      : `Abstiegsgefahr ×${faktorText(1 / klasse)}`;
  }
  return null;
}

export function folgen(vorher, nachher, w, ausfall, grund = "verletzt", abgefangen = false, gelungen = true) {
  const liste = [];
  /* Zuerst, weil es erklärt, warum darunter nichts Schlimmes steht. */
  if (abgefangen) liste.push({ text: "Es ging schief — dein Rückhalt hat es abgefangen", art: "gut" });
  if (nachher.ovr !== vorher.ovr)
    liste.push({ text: `Stärke ${vorher.ovr} → ${nachher.ovr}`, art: nachher.ovr > vorher.ovr ? "gut" : "schlecht" });
  if (nachher.rolle !== vorher.rolle)
    liste.push({
      text: `Rolle im Team: ${ROLLEN_NAME[vorher.rolle]} → ${ROLLEN_NAME[nachher.rolle]}`,
      art: nachher.rolle === "stamm" ? "gut" : "schlecht",
    });
  if (ausfall) liste.push({
    text: grund === "gesperrt"
      ? "Du bist die kommende Saison gesperrt"
      : "Du fällst die kommende Saison verletzt aus",
    art: "schlecht",
  });
  /* Nur, was der Verein spielt — und mit dem richtigen Artikel: „die Pokal" und
     „die Europapokal" standen so im Spiel. */
  const hat = wettbewerbe(vorher.verein);
  for (const [feld, name] of [["liga", "die Meisterschaft"], ["pokal", "den Pokal"], ["europa", "den Europapokal"]]) {
    const f = w[feld];
    if (f === undefined || f === 1 || !hat[feld]) continue;
    liste.push({
      text: f > 1 ? `Aussicht auf ${name}: ${faktorText(f)}-fach` : `Aussicht auf ${name}: auf ${Math.round(f * 100)} Prozent gesenkt`,
      art: f > 1 ? "gut" : "schlecht",
    });
  }
  if (w.verbandswechsel) {
    liste.push({
      text: nachher.land !== vorher.land
        ? `Verband: ${landName(vorher.land)} → ${landName(nachher.land)}`
        : "Du spielst künftig für den anderen Verband",
      art: "neutral",
    });
    liste.push({ text: `In der Auswahl bist du gesetzt (berufen ab ${berufungAb(nachher)} statt ${berufungAb(vorher)})`, art: "gut" });
  }
  const klasse = klasseText(w.klasse, vorher.verein);
  if (klasse) liste.push({ text: klasse, art: w.klasse > 1 ? "gut" : "schlecht" });
  if (w.abschluss) liste.push({ text: "Der Schulabschluss ist in der Tasche — er öffnet später den Trainerschein", art: "gut" });
  if (w.trainerschein) liste.push({ text: "Der Trainerschein ist gemacht", art: "gut" });
  if (w.schutz) liste.push({ text: "Du hast Rückhalt — der nächste Rückschlag geht an dir vorbei", art: "gut" });
  if (!liste.length && w.text) liste.push({ text: w.text, art: gelungen ? "gut" : "neutral" });
  if (!liste.length) liste.push({ text: "Es bleibt alles, wie es war", art: "neutral" });
  return liste;
}

/** Wendet eine gewählte Option an und sagt, was passiert ist. */
export function entscheide(k, option, zufall) {
  /* `gewagt` trennt die Wette von der sicheren Wahl: Wer „Beim Gewohnten bleiben"
     wählt, hat nichts gewonnen — die Folge darf dort nicht „Es geht auf" heissen. */
  const gewagt = option.chance !== undefined;
  const gelungen = gewagt ? zufall() < option.chance : true;
  /* Der Rückhalt fängt genau einen misslungenen Einsatz ab und ist danach weg.
     Der Zufall wird trotzdem gezogen — die Karte zeigt ja, dass es schiefging;
     nur die Folge bleibt aus. */
  const abgefangen = !gelungen && (k.schutz ?? 0) > 0;
  const w = gelungen ? option.wirkung : (abgefangen ? {} : (option.sonst || {}));
  const naechster = { ...k };
  if (abgefangen) naechster.schutz = (k.schutz ?? 0) - 1;
  if (w.schutz) naechster.schutz = (naechster.schutz ?? 0) + w.schutz;
  if (w.ovr) naechster.ovr = grenze(k.ovr + w.ovr, OVR_MIN, OVR_MAX);
  if (w.rolle) naechster.rolle = rolleNach(k.rolle, w.rolle, gewagt && gelungen);
  /* DER WECHSEL WECHSELT JETZT WIRKLICH. Vorher stand hier nur das Merkmal, und
     `k.land` blieb — Flagge, Auswahl und Titelchance änderten sich nicht. */
  if (w.verbandswechsel) {
    naechster.verbandGewechselt = true;
    if (typeof w.verbandswechsel === "string") naechster.land = w.verbandswechsel;
  }
  if (w.abschluss) naechster.abschluss = true;
  if (w.trainerschein) naechster.trainerschein = true;
  /* Ein Ausfall ist ein Ausfall — die Saison ist weg, egal warum. Der Grund reist
     trotzdem mit, weil die Zeitleiste ihn anzeigt. */
  const ausfall = (w.verletzt ?? 0) + (w.gesperrt ?? 0);
  const grund = w.gesperrt ? "gesperrt" : "verletzt";
  return {
    karriere: naechster,
    gelungen,
    gewagt,
    mod: { liga: w.liga ?? 1, pokal: w.pokal ?? 1, europa: w.europa ?? 1, klasse: w.klasse ?? 1 },
    ausfall,
    grund,
    abgefangen,
    folgen: folgen(k, naechster, w, ausfall, grund, abgefangen, gelungen),
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

/* ── Wann ist Schluss? ─────────────────────────────────────────────────────────
   VORHER IMMER MIT 38. Gemessen über 300 Laufbahnen endeten 299 auf den Tag genau
   an der Altersgrenze; die einzige Ausnahme war ein Spieler, den niemand mehr haben
   wollte. Jede Laufbahn hatte damit dieselbe Länge, und das Ende war kein Ereignis,
   sondern ein Anschlag.

   Jetzt entscheidet der Körper mit. Ab 32 wächst die Wahrscheinlichkeit Jahr für
   Jahr, und ein hoher Wert hält dagegen — wer mit 35 noch 88 hat, hört nicht auf,
   wer mit 33 auf 68 abgebaut hat, sehr wohl. */
export const RUECKTRITT_PRUEFEN_AB = 32;

export function ruecktrittFaellig(k, zufall) {
  if (k.alter < RUECKTRITT_PRUEFEN_AB) return false;
  const jahre = k.alter - RUECKTRITT_PRUEFEN_AB;
  const drang = 0.05 + jahre * 0.13;
  const haelt = grenze((k.ovr - 62) / 55, 0, 0.5);
  return zufall() < grenze(drang - haelt, 0, 1);
}
/* Spaetestens hier ist Schluss, auch wenn noch Angebote kaemen. Gemessen: Ohne
   diese Grenze liefen Laufbahnen bis 41, weil die Welt 345 Vereine kennt und sich
   fuer einen Spieler mit Stufe 0 immer noch einer findet. */
/* Bis vierzig. Vorher war bei 38 Schluss — die Zeitleiste zeigt jetzt aber alle
   Zeilen von Anfang an, und eine Zeile, die nie gefüllt werden kann, ist eine
   Lücke. Die beiden zusätzlichen Jahre sind hart: Der Abbau läuft weiter, und mit
   39 steht kaum noch jemand bei einem Verein, der ihn spielen lässt. */
export const ALTERSGRENZE = 40;

/* ── Ligaland und Spielerland sind nicht dasselbe Wort ────────────────────────
   Die Ligen der vier neuen Länder tragen BRA, USA, SAU und JPN; die Spieler tragen
   ihren ISO-Code BR, US, SA und JP. Ohne diese Brücke fände ein Brasilianer keinen
   Jugendverein in Brasilien — und bekäme statt dessen den Rückfall auf beliebige
   kleine Vereine irgendwo in Europa. Die acht europäischen Länder brauchen sie
   nicht: Dort heissen Liga und Spieler schon gleich (GER, ENG, …). */
export const LIGALAND_VON_SPIELERLAND = { BR: "BRA", US: "USA", SA: "SAU", JP: "JPN" };
export const ligaLand = (spielerLand) => LIGALAND_VON_SPIELERLAND[spielerLand] || spielerLand;

export function jugendAngebote(welt, land, zufall) {
  const heimat = ligaLand(land);
  const heimisch = (stufe) => welt.vereine.filter((v) => v.liga.land === heimat && v.liga.stufe === stufe && v.stufe <= 3);
  const zieh = (liste, n) => {
    const kopie = [...liste];
    const out = [];
    while (out.length < n && kopie.length) out.push(...kopie.splice(Math.floor(zufall() * kopie.length), 1));
    return out;
  };
  /* Zwei aus der zweiten Spielklasse, einer aus der ersten. Die vier Ligen
     ausserhalb Europas haben keine zweite — dort kommen alle drei aus der einen. */
  const angebote = heimisch(2).length
    ? [...zieh(heimisch(2), 2), ...zieh(heimisch(1), 1)]
    : zieh(heimisch(1), 3);
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
    .filter((v) => v.stufe >= min && v.stufe <= max)
    .filter((v) => ausseneuropaOffen(k, v));
  /* Findet sich im Band nichts, wird nach unten geöffnet — ohne das stünde ein
     Spieler ohne Angebot da, obwohl es Vereine für ihn gäbe. */
  if (!infrage.length) infrage = passendeVereine(welt, k.ovr, { ausser: k.verein ? [k.verein.key] : [] })
    .filter((v) => ausseneuropaOffen(k, v));
  /* GEWICHTET, NICHT GLEICHVERTEILT. Vorher wurde im Band blind gezogen — und weil
     es 27 Vereine der Stufe 4 gibt, aber nur 10 der Stufe 5, kamen bei Rating 88 von
     18 Angeboten 13 von Stufe 4 und nur 5 von der Spitze. Wer Weltklasse ist, soll
     auch von den Grossen angerufen werden. Das Gewicht verdoppelt sich je Stufe. */
  const out = [];
  const kopie = [...infrage];
  while (out.length < anzahl && kopie.length) {
    const gewichte = kopie.map((v) => 2 ** v.stufe);
    let ziel = zufall() * gewichte.reduce((s, g) => s + g, 0);
    let i = 0;
    while (i < kopie.length - 1 && (ziel -= gewichte[i]) > 0) i++;
    out.push(...kopie.splice(i, 1));
  }
  return out;
}

/* ── Wann Übersee in Frage kommt ──────────────────────────────────────────────
   Brasilien, die MLS, Saudi-Arabien und Japan sind Ziele für die späte Laufbahn —
   und die Heimat derer, die von dort kommen. Was es NICHT sein soll: der Verein,
   zu dem ein Zweiundzwanzigjähriger aus Europa wechselt, weil die Rufstufe gerade
   passt. Ein Angebot von dort bekommt deshalb nur, wer alt genug ist oder aus dem
   Land kommt. Die eigene Jugend ist davon ohnehin nicht betroffen: jugendAngebote
   sucht nach dem Land des Spielers. */
export const UEBERSEE_AB = 29;

export function ausseneuropaOffen(k, verein) {
  const land = verein.liga?.land;
  if (!land || EUROPA.has(land)) return true;
  return k.alter >= UEBERSEE_AB || ligaLand(k.land) === land;
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
const alleLigaTitel = (k) => GROSSE_LIGEN.filter((t) => zahl(k, t) > 0).length;

export const AUSZEICHNUNGEN = [
  /* NACHGEZOGEN, nachdem der Europapokal im Feld ausgespielt wird. Vorher gewann ein
     Stufe-4-Verein ihn zu 16 % je Saison, weltweit fielen 10,6 Titel pro Jahr — es
     gibt zwei. Mit den richtigen Quoten war „fünfmal" in 1500 ehrgeizig gespielten
     Laufbahnen kein einziges Mal zu holen; viermal in 4 von 1500 — das schafft die
     Prüfung nebenan in ihrer kleineren Kunstwelt nicht mehr nachzuweisen. Dreimal
     gelingt in 23 von 1500 und ist damit immer noch eine der härtesten. */
  { key: "fuenf_ohren", name: "Die großen Ohren", text: "Dreimal die Champions League.",
    pruefe: (k) => zahl(k, "CL") >= 3 },
  /* NACHGEZOGEN mit dem Talentwurf: Ohne Titel zu bleiben war vorher die Ausnahme
     und ist jetzt der Normalfall — 54 % der Laufbahnen. Eine Auszeichnung, die jede
     zweite Laufbahn bekommt, sagt nichts. Verlangt wird deshalb die LANGE Laufbahn
     ohne Titel: vierhundert Spiele, nichts gewonnen. Gemessen 44 % — knapp unter der
     Hälfte, und damit weiterhin der Boden, auf dem die anderen vierzehn stehen. */
  { key: "unvollendet", name: "Der Unvollendete", text: "Vierhundert Spiele und kein einziger Mannschaftstitel.",
    pruefe: (k) => k.gesamt.spiele >= 400 && Object.keys(k.titel).filter((t) => t !== "BDO").length === 0 },
  /* NACHGEZOGEN: Mit vier großen Meisterschaften war sie in 1500 Laufbahnen nicht
     mehr zu holen — dafür muss man bei vier verschiedenen Spitzenvereinen stehen,
     und dorthin kommt seit dem Talentwurf jeder Achte überhaupt. Drei trifft 0,2 %
     und ist damit die härteste noch belegbare Stufe. */
  { key: "europas_erster", name: "Europas Erster", text: "Meister in drei der fünf großen Ligen.",
    pruefe: (k) => alleLigaTitel(k) >= 3 },
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
  /* „In ALLEN sieben Ländern der Welt" stimmte, als die Welt sieben Länder hatte.
     Dann kam Österreich dazu, jetzt Brasilien, die USA, Saudi-Arabien und Japan —
     zwölf. Der Text behauptete eine Vollständigkeit, die die Prüfung nie verlangt
     hat; jetzt sagen beide dasselbe. */
  { key: "grenzgaenger", name: "Grenzgänger", text: "In sieben verschiedenen Ländern gespielt.",
    pruefe: (k) => k.laender.length >= 7 },
  /* NACHGEMESSEN nach dem Talentwurf: Median 87 Tore, oberes Zehntel 148, Bestwert
     345. Dreihundert trifft nur noch 0,2 %; zweihundertfünfzig liegt weit über dem
     oberen Zehntel und fällt in 0,5 %. */
  { key: "torfabrik", name: "Torfabrik", text: "Zweihundertfünfzig Tore in der Laufbahn.",
    pruefe: (k) => k.gesamt.tore >= 250 },
  /* GEMESSEN: „mit 38 noch im Kader" fiel in 100 % der Laufbahnen — jede erreicht
     dieses Alter, also war die Auszeichnung keine. Verlangt wird jetzt, mit 36 noch
     bei einem Spitzenverein zu stehen; das schafft nur, wer sein Niveau hält. */
  { key: "der_ewige", name: "Der Ewige", text: "Mit sechsunddreißig noch bei einem Spitzenverein.",
    pruefe: (k) => k.alter >= 36 && (k.verein?.stufe ?? 0) >= 4 },
  /* NACHGEZOGEN: Der Ballon d'Or wird ab 85 vergeben, und den erreicht seit dem
     Talentwurf nur, wer ein grosses Talent gezogen hat — der früheste gemessene
     Gewinner war vierundzwanzig, und „vor 25" traf damit eine einzige Laufbahn von
     1500. Vor siebenundzwanzig trifft 0,6 % und meint weiter dasselbe: jung. */
  { key: "goldjunge", name: "Goldjunge", text: "Ballon d'Or vor dem siebenundzwanzigsten Geburtstag.",
    pruefe: (k) => (k.bdoAlter ?? 99) < 27 },
  /* Zum zweiten Mal nachgezogen, jetzt wegen des Talentwurfs: „Weltmeister, zweimal
     Champions League und drei Ballons d'Or" fiel in 1500 Laufbahnen keine einzige
     Mal mehr. Weltmeister UND Ballon d'Or verlangt weiterhin beides — die beste
     Mannschaft der Welt und der beste Spieler der Welt — und trifft 0,5 %. */
  { key: "der_groesste", name: "Der Größte", text: "Weltmeister und Ballon d'Or.",
    pruefe: (k) => zahl(k, "WM") >= 1 && zahl(k, "BDO") >= 1 },
  { key: "doppelbuerger", name: "Doppelbürger", text: "Den Verband gewechselt und danach einen Titel mit der neuen Auswahl geholt.",
    pruefe: (k) => k.verbandGewechselt === true && (zahl(k, "WM") + zahl(k, "EM")) > 0 },
  /* Nachgemessen: Der höchste Stand ist jetzt 23, aber zwanzig erreichen nur noch
     0,3 %. Fünfzehn trifft 1,5 % und bleibt weit oberhalb dessen, was eine gute
     Laufbahn zusammenträgt (oberes Zehntel: vier Titel). */
  { key: "sammler", name: "Der Sammler", text: "Fünfzehn Titel oder mehr.",
    pruefe: (k) => Object.values(k.titel).reduce((a, b) => a + b, 0) >= 15 },
];

export function erreichteAuszeichnungen(k) {
  return AUSZEICHNUNGEN.filter((a) => { try { return a.pruefe(k); } catch { return false; } });
}

/* ── Die Auswahl, die zwischen den Ausgängen hin- und herspringt ──────────────
   Nach dem Klick auf eine Kachel sah man sofort das Ergebnis. Eine Wette, deren
   Ausgang unmittelbar daliegt, ist keine Wette — man liest eine Zahl. Beim Vorbild
   springt die Auswahl nach dem Klick zwischen den möglichen Ausgängen hin und her
   und bleibt auf einem stehen; erst dieses Stehenbleiben ist das Ergebnis.

   `wahlLauf` rechnet die Sprünge aus: Wie viele, und wie lange jeder dauert. Die
   Folge endet IMMER beim wahren Ausgang — gelost wird nichts, es wird nur gezeigt.
   Die Abstände wachsen (ease-out), damit es ausläuft statt abzubrechen.

   SPRUENGE ist ungerade oder gerade je nach Ziel: Wer bei 0 anfängt und auf 1
   landen soll, braucht eine ungerade Zahl von Sprüngen. Das rechnet die Funktion
   selbst aus, damit der Aufrufer nur das Ziel kennen muss. */
export const WAHL_SPRUENGE = 7;
export const WAHL_ERST = 90, WAHL_LETZT = 420;

export function wahlLauf(ziel, sprungZahl = WAHL_SPRUENGE) {
  /* Von 0 aus: gerade Zahl Sprünge endet bei 0, ungerade bei 1. */
  const n = (sprungZahl % 2 === ziel % 2) ? sprungZahl : sprungZahl + 1;
  const schritte = [];
  for (let i = 0; i < n; i++) {
    const anteil = n === 1 ? 1 : i / (n - 1);
    const dauer = Math.round(WAHL_ERST + (WAHL_LETZT - WAHL_ERST) * Math.pow(anteil, 2));
    schritte.push({ feld: (i + 1) % 2, dauer });
  }
  /* Der letzte Sprung muss auf dem Ziel stehen bleiben. */
  schritte[schritte.length - 1].feld = ziel;
  return schritte;
}

/** Wie lange der ganze Lauf dauert — für das Sicherungsnetz. */
export const wahlDauer = (ziel) => wahlLauf(ziel).reduce((s, x) => s + x.dauer, 0);

/* ── Wie lange der Ratingzähler läuft ─────────────────────────────────────────
   Vorher waren es immer 900 Millisekunden, egal ob zwei Punkte oder fünfzehn. Zwei
   Punkte huschten damit vorbei, fünfzehn tickten im Zeitlupentempo durch.

   Jetzt wächst die Dauer mit dem Sprung, aber LANGSAMER als er selbst: Bei zwei
   Punkten bleibt eine Ziffer rund 370 Millisekunden stehen und man liest sie, bei
   fünfzehn sind es 110 und die Zahl rollt sichtbar hoch. Genau der Eindruck, den das
   Vorbild macht — kleine Änderung gemächlich, grosse rasant.

   ZWEIMAL NACHGEZOGEN: Die erste Fassung war zu hastig (300 ms Grund, 42 je Punkt),
   die zweite immer noch (600/70). Jetzt sind es 900 und 110 — bei zwei Punkten
   steht eine Ziffer rund 560 ms, bei fünfzehn 170. */
export const zaehlerDauer = (sprung) => Math.round(Math.min(3000, 900 + Math.abs(sprung) * 110));

/* ── Und wann er losläuft ─────────────────────────────────────────────────────
   Eine gespielte Saison setzt zwei Dinge auf einmal: die neue Zeile in der Tabelle
   rechts und das neue Rating in der Kachel links. Liefen beide gleichzeitig, sah
   man keines von beiden richtig — das Auge kann nur an einer Stelle sein.

   Deshalb wartet die Kachel. Erst steht die Zeile mit Spielen, Toren und Vorlagen,
   dann läuft die Zahl. */
export const ZAEHLER_WARTEN = 900;

/* ── Solange darf nichts geklickt werden ──────────────────────────────────────
   Die nächste Entscheidung stand sofort bereit, während die Zeilen noch einliefen
   und die Ratingkachel noch hochlief. Wer schnell klickte, sah von der eigenen
   Saison nichts. Die Sperre dauert genau so lange wie das, was gerade läuft:
   Wartezeit, Zählerlauf und ein kurzer Atemzug danach. */
export const SPERRE_NACHLAUF = 260;
export const sperrDauer = (sprung) => ZAEHLER_WARTEN + zaehlerDauer(sprung) + SPERRE_NACHLAUF;
