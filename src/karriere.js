/* „Karriere" — reine Logik (kein React).

   Ein Laufbahn-Simulator nach dem Vorbild des Copero Football Career Simulator: Man
   steuert keinen Spieler auf dem Platz, sondern eine Laufbahn. Mit sechzehn fängt es
   an, mit Mitte dreißig hört es auf, und dazwischen entscheidet man über Training,
   Ernährung, Umgang mit der Presse und Vereinswechsel.

   ── WAS UNSERE FASSUNG ANDERS MACHT ─────────────────────────────────────────
   Die Vereine sind echt und ihre Stärke ist gerechnet, nicht gesetzt: Sie kommt aus
   den Kadern, die auch der Draft benutzt. Real Madrid steht bei 90, Bayern bei 88,
   Heidenheim bei 65 — und danach richtet sich, wer dich überhaupt haben will.

   In Bundesliga, Premier League und La Liga wird die Saison AUSGESPIELT: dieselbe
   Tabellensimulation wie in der Traumelf, mit Spielplan und Ergebnissen. Für Serie
   A, Ligue 1, Portugal, die Niederlande und Österreich reichen unsere Daten dafür
   nicht — dort gibt es Titel, aber keinen Spieltag.

   ── DIE SKALA ───────────────────────────────────────────────────────────────
   Dieselbe wie überall im Spiel: 65 bis 96. Kein eigenes System, damit „85" in der
   Karriere dasselbe heißt wie „85" im Draft. Copero geht bis 99; wir bleiben bei 96,
   weil das der Wert von Messi und Neuer ist und niemand darüber liegen sollte. */
import { KLASSE_MIN, KLASSE_MAX } from "./draft.js";

export const START_ALTER = 16;
export const OVERALL_START = KLASSE_MIN;
export const OVERALL_MAX = KLASSE_MAX;

/** Wie oft muss man entscheiden? Copero nennt das die Geschwindigkeit. */
export const TEMPO = {
  express:  { name: "Express",  saisonsJeSchritt: 3, ereignisse: 1, text: "Große Schritte, seltene Entscheidungen" },
  normal:   { name: "Normal",   saisonsJeSchritt: 2, ereignisse: 1, text: "Alle zwei Saisons eine Weiche" },
  intensiv: { name: "Intensiv", saisonsJeSchritt: 1, ereignisse: 2, text: "Jede Saison, jedes Detail" },
};

export const POSITIONEN = [
  { key: "ABW", name: "Verteidiger", tore: 0.12, vorlagen: 0.30 },
  { key: "MF",  name: "Mittelfeld",  tore: 0.40, vorlagen: 1.00 },
  { key: "ST",  name: "Angriff",     tore: 1.00, vorlagen: 0.45 },
];
export const posDaten = (key) => POSITIONEN.find((p) => p.key === key) || POSITIONEN[1];

/* ── Zufall ────────────────────────────────────────────────────────────────────
   Deterministisch aus dem Startwert der Laufbahn: Dieselbe Karriere lässt sich
   nacherzählen, und ein Fehlerbericht ist nachstellbar. */
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
const grenze = (x, min, max) => Math.max(min, Math.min(max, x));
export { grenze as _grenze };

/* ── Alter ─────────────────────────────────────────────────────────────────────
   Wie viel Luft nach oben hat ein Spieler noch, und wann geht es abwärts? Bis 21
   wächst er schnell, bis 27 langsamer, ab 31 verliert er.

   Die Kurve ist ABSICHTLICH nicht dieselbe wie die Formkurve in draft.js: Dort geht
   es darum, was ein bekannter Spieler in einer bestimmten Saison wert war; hier
   darum, wie sich ein Wert über die Jahre ENTWICKELT. */
export function alterswachstum(alter) {
  if (alter <= 21) return 2.6;
  if (alter <= 24) return 1.8;
  if (alter <= 27) return 1.0;
  if (alter <= 30) return 0.3;
  if (alter <= 32) return -0.6;
  if (alter <= 34) return -1.6;
  return -2.6;
}

/* ── Die Welt ──────────────────────────────────────────────────────────────────
   Alle Vereine mit einem NIVEAU auf der Spielerskala. `teamStaerke` liefert den
   Schnitt der besten elf PLUS den vollen Verbund; der Verbund gehört einer
   Mannschaft, nicht einem Spieler, und wird hier wieder abgezogen. Sonst verglichen
   wir einen Spielerwert mit einem Mannschaftswert. */
export function baueWelt(vereine, staerkeVon, verbundBonus = 9) {
  const out = [];
  for (const v of vereine) {
    const s = staerkeVon(v);
    if (!Number.isFinite(s)) continue;
    out.push({ ...v, niveau: Math.round((s - verbundBonus) * 10) / 10 });
  }
  out.sort((a, b) => b.niveau - a.niveau);
  /* Rang innerhalb der eigenen Liga — daraus folgt, um welche Plätze ein Verein
     spielt. */
  const proLiga = new Map();
  for (const v of out) {
    if (!proLiga.has(v.lg)) proLiga.set(v.lg, []);
    proLiga.get(v.lg).push(v);
  }
  for (const [lg, liste] of proLiga) {
    /* AUF DIE ECHTE LIGAGRÖSSE ABBILDEN. Unsere Welt kennt 31 Bundesligavereine aus
       sechzehn Jahren, eine Tabelle hat aber achtzehn Plätze — ohne die Umrechnung
       stand der 1. FC Nürnberg auf „Platz 21". Der Rang wird deshalb auf die Zahl
       der wirklich vergebenen Plätze gestaucht. */
    const plaetze = LIGA_PLAETZE[lg] || Math.min(liste.length, 20);
    liste.forEach((v, i) => {
      v.ligaGroesse = plaetze;
      v.ligaRang = liste.length <= 1 ? 1
        : Math.max(1, Math.round(1 + (i / (liste.length - 1)) * (plaetze - 1)));
    });
  }
  return { vereine: out, proLiga };
}

/* Wie viele Plätze vergibt eine Liga wirklich? */
export const LIGA_PLAETZE = { BL: 18, PL: 20, LL: 20, SA: 20, L1: 18, PT: 18, NL: 18, AT: 12 };

/* ── Der eigene Spieler ────────────────────────────────────────────────────────
   `form` schwankt saisonweise und wirkt auf Tore und Einsätze; `fitness` sinkt mit
   hartem Training und Verletzungen; `ruf` steuert, wie groß die Vereine sind, die
   anklopfen. Alle drei laufen von 0 bis 100. */
export function neueKarriere({ name, nation, nummer, pos, verein, tempo = "normal", seed = Date.now() }) {
  return {
    name, nation, nummer, pos, tempo, seed,
    alter: START_ALTER,
    saison: 1,
    overall: OVERALL_START,
    form: 60, fitness: 85, moral: 70, ruf: 20,
    verein,
    vertragBis: 3,
    verletzt: 0,
    verlauf: [],
    titel: {},
    gesamt: { spiele: 0, tore: 0, vorlagen: 0 },
    beendet: false,
  };
}

/* ── Eine Saison ───────────────────────────────────────────────────────────────
   Der Einsatzanteil hängt daran, wie gut man IM VERHÄLTNIS zum eigenen Verein ist.
   Wer acht Punkte unter dem Niveau seines Vereins liegt, sitzt auf der Bank; wer
   darüber liegt, spielt fast immer. Genau das macht den Wechsel zu einem
   Spitzenverein zur Entscheidung und nicht zum Selbstläufer. */
export function einsatzAnteil(overall, niveau, fitness = 85, form = 60) {
  const d = overall - niveau;
  /* Der Versatz von 2,5 ist entscheidend: Ohne ihn stand die Kurve bei Gleichstand
     auf 0,5, und ein Spieler auf Augenhöhe mit seinem Verein kam auf fünfzehn von
     34 Spielen. Ein Spieler auf dem Niveau seines Vereins ist Stammspieler, kein
     Ergänzungsspieler; erst deutlich darunter beginnt die Bank. */
  const basis = 1 / (1 + Math.exp(-(d + 2.5) / 3.2));
  const zustand = 0.55 + 0.45 * (fitness / 100) * (0.6 + 0.4 * (form / 100));
  return grenze(basis * zustand, 0.02, 0.98);
}

export const SPIELE_JE_SAISON = 34;

/**
 * Tore und Vorlagen einer Saison.
 *
 * Die vierte Potenz der Stärke ist der Regler: Sie trennt einen Torjäger deutlich
 * von einem soliden Stürmer, ohne ins Absurde zu laufen. Gemessen an der Skala 65–96
 * ergibt das für einen Stürmer mit voller Spielzeit etwa neun Tore bei 70, achtzehn
 * bei 82 und dreißig bei 93 — die Größenordnung echter Ligasaisons.
 */
export function saisonLeistung(k, niveau, zufall) {
  const p = posDaten(k.pos);
  const anteil = einsatzAnteil(k.overall, niveau, k.fitness, k.form);
  const spiele = Math.round(SPIELE_JE_SAISON * anteil);
  const guete = Math.pow(k.overall / 100, 4);
  /* Ein starker Verein schafft deutlich mehr Gelegenheiten. Die erste Fassung ließ
     das fast unberücksichtigt (0,85 bis 1,15), und weil die Spielzeit bei einem
     kleinen Verein bei 98 % liegt, war Bleiben torreicher als Aufsteigen: 185 Tore
     gegen 110 in einer ganzen Laufbahn. Jetzt wiegt das Umfeld schwerer als der
     Spielzeitvorteil, ohne ihn aufzuheben — ein Torjäger beim Tabellenzehnten bleibt
     ein Torjäger. */
  const umfeld = 0.7 + 0.6 * grenze((niveau - 65) / 25, 0, 1);
  const formFaktor = 0.8 + 0.4 * (k.form / 100);
  const roh = guete * 38 * p.tore * anteil * umfeld * formFaktor;
  /* GEDECKELT AUF FAST EIN TOR JE SPIEL. Die vierte Potenz der Stärke steigt oben
     steil an, und ein 96er-Stürmer mit voller Spielzeit kam auf 41 erwartete Tore
     bei 33 Spielen — in einer ganzen Laufbahn standen dann 380 Tore in 351 Spielen.
     Lewandowskis Rekordsaison waren 41 Tore in 29 Spielen; mehr als das soll auch
     die beste Saison nicht hergeben. */
  const toreErwartet = Math.min(roh, spiele * 0.95);
  const vorlagenErwartet = Math.min(guete * 24 * p.vorlagen * anteil * umfeld * formFaktor, spiele * 0.6);
  return {
    spiele,
    tore: poisson(toreErwartet, zufall),
    vorlagen: poisson(vorlagenErwartet, zufall),
    anteil,
  };
}

/* ── Wie lief es für den Verein? ───────────────────────────────────────────────
   Der Tabellenplatz streut um den Rang, den das Niveau hergibt. Ein Spitzenspieler
   hebt seinen Verein spürbar, aber er trägt ihn nicht allein: elf Leute spielen. */
export function ligaPlatz(verein, k, zufall) {
  const n = verein.ligaGroesse || 18;
  const hebel = grenze((k.overall - verein.niveau) / 10, -0.5, 1.5);
  const erwartet = (verein.ligaRang || Math.ceil(n / 2)) - hebel;
  /* Zwei Ziehungen addiert ergeben eine glockenförmige Streuung ohne Bibliothek. */
  const rausch = (zufall() + zufall() - 1) * (n / 5);
  return grenze(Math.round(erwartet + rausch), 1, n);
}

/* Welche Titel bringt ein Tabellenplatz? Die Schlüssel sind dieselben wie im Feld
   `t` der Spielerdaten, damit Karrieretitel und echte Titel dieselbe Sprache
   sprechen und dieselben Wappen zeigen. */
export const MEISTER_KEY = { BL: "MBL", PL: "MPL", LL: "MLL", SA: "MSA", L1: "ML1" };
export const POKAL_KEY = { BL: "DFB", PL: "FAC", LL: "CDR", SA: "CIT" };

export function vereinsTitel(verein, platz, k, zufall) {
  const titel = [];
  if (platz === 1 && MEISTER_KEY[verein.lg]) titel.push(MEISTER_KEY[verein.lg]);
  /* Der Pokal ist ein K.-o.-Wettbewerb: Auch ein Mittelklassist gewinnt ihn
     gelegentlich, ein Spitzenverein längst nicht jedes Jahr. */
  const pokalChance = grenze(0.30 - 0.02 * (platz - 1), 0.02, 0.30);
  if (POKAL_KEY[verein.lg] && zufall() < pokalChance) titel.push(POKAL_KEY[verein.lg]);
  return titel;
}

/**
 * Europapokal. Teilnahmeberechtigt ist, wer im Vorjahr vorn stand — das ruft die
 * Ansicht mit `vorplatz` auf.
 */
export function europaTitel(verein, vorplatz, k, zufall) {
  if (vorplatz == null) return [];
  const titel = [];
  if (vorplatz <= 4) {
    /* Die Champions League gewinnt man gegen die besten Vereine Europas, nicht
       gegen die der eigenen Liga — deshalb zählt das Niveau absolut. */
    const chance = grenze((verein.niveau - 78) / 60, 0.01, 0.22);
    if (zufall() < chance) titel.push("CL");
  } else if (vorplatz <= 6) {
    const chance = grenze((verein.niveau - 72) / 45, 0.02, 0.28);
    if (zufall() < chance) titel.push("EL");
  }
  return titel;
}

/* ── Nationalmannschaft ────────────────────────────────────────────────────────
   Berufen wird, wer stark genug ist. Die Schwelle hängt an der Nation: In Brasilien
   und Frankreich ist die Konkurrenz größer als in Nigeria oder den USA. */
export function nationsSchwelle(nationStaerke) {
  return 72 + (nationStaerke - 50) * 0.16;
}

/** Turnierjahre: alle zwei Saisons, abwechselnd WM und Kontinentalturnier. */
export function turnierIn(saison, nation) {
  if (saison % 4 === 0) return "WM";
  if (saison % 2 === 0) return ["BRA", "ARG", "COL", "MEX", "USA"].includes(nation) ? "CA" : "EM";
  return null;
}

export function nationalTitel(turnier, nationStaerke, k, zufall) {
  if (!turnier) return [];
  /* Der eigene Anteil ist echt, aber klein: Auch ein Weltfußballer gewinnt keine WM
     allein. */
  const chance = grenze((nationStaerke - 55) / 220 + (k.overall - 80) / 400, 0.005, 0.30);
  return zufall() < chance ? [turnier] : [];
}

/* ── Einzelauszeichnungen ──────────────────────────────────────────────────────
   Die Torjägerkanone bekommt, wer die Marke der Liga knackt; der Ballon d'Or
   verlangt eine große Saison UND einen großen Titel — genau wie in Wirklichkeit. */
export const TORJAEGER_MARKE = { ST: 22, MF: 14, ABW: 6 };
export const VORLAGEN_MARKE = { ST: 11, MF: 13, ABW: 8 };

export function einzelTitel(k, leistung, titelDerSaison, zufall) {
  const out = [];
  const marke = TORJAEGER_MARKE[k.pos] ?? 20;
  if (leistung.tore >= marke && zufall() < 0.55) out.push("TSK");
  const vMarke = VORLAGEN_MARKE[k.pos] ?? 12;
  if (leistung.vorlagen >= vMarke && zufall() < 0.5) out.push("VLK");
  /* Ballon d'Or: Weltklasse, eine überragende Saison und ein großer Titel. Ohne die
     Titelbedingung gewänne ihn ein Torjäger beim Tabellenzehnten. */
  const grosserTitel = titelDerSaison.some((t) => ["CL", "WM", "EM", "CA"].includes(t))
    || titelDerSaison.some((t) => Object.values(MEISTER_KEY).includes(t));
  const punkte = (k.overall - 90) + (leistung.tore + leistung.vorlagen - 30) / 5;
  if (k.overall >= 91 && grosserTitel && punkte > 0 && zufall() < grenze(punkte / 14, 0.02, 0.35)) out.push("BDO");
  return out;
}

/* ── Entscheidungen ────────────────────────────────────────────────────────────
   Coperos Kern: Weichen, die sportlich UND privat sind. Jede Wahl kostet etwas und
   bringt etwas — es gibt keine, die nur gut ist.

   `wirkung` verändert die Werte direkt, `risiko` ist die Wahrscheinlichkeit einer
   Verletzung in der Folgesaison. */
export const EREIGNISSE = [
  {
    key: "training", frage: "Wie hart trainierst du in der Vorbereitung?",
    wahlen: [
      { text: "Ans Limit gehen", wirkung: { overall: 1.6, fitness: -10, moral: -4 }, risiko: 0.18 },
      { text: "Solide Grundlage", wirkung: { overall: 0.6, fitness: 2 }, risiko: 0.05 },
      { text: "Auf den Körper hören", wirkung: { overall: -0.2, fitness: 10, moral: 4 }, risiko: 0.01 },
    ],
  },
  {
    key: "ernaehrung", frage: "Dein Ernährungsberater legt einen Plan vor.",
    wahlen: [
      { text: "Strikt durchziehen", wirkung: { fitness: 9, moral: -6, overall: 0.5 } },
      { text: "Lockere Fassung", wirkung: { fitness: 3, moral: 2, overall: -0.2 } },
      { text: "Ablehnen", wirkung: { fitness: -5, moral: 6 } },
    ],
  },
  {
    key: "presse", frage: "Ein Boulevardblatt bietet ein großes Interview an.",
    wahlen: [
      { text: "Offen reden", wirkung: { ruf: 9, moral: -3 } },
      { text: "Höflich absagen", wirkung: { ruf: -1, moral: 3 } },
      { text: "Gegen den Trainer schießen", wirkung: { ruf: 14, moral: -12, overall: -0.8 } },
    ],
  },
  {
    key: "feiern", frage: "Nach dem Sieg lädt die Mannschaft zur langen Nacht.",
    wahlen: [
      { text: "Mitfeiern", wirkung: { moral: 10, fitness: -8 }, risiko: 0.06 },
      { text: "Kurz zeigen, früh gehen", wirkung: { moral: 4, fitness: -2 } },
      { text: "Zu Hause bleiben", wirkung: { moral: -4, fitness: 4, overall: 0.3 } },
    ],
  },
  {
    key: "geld", frage: "Dein Berater schlägt vor, das Gehalt anzulegen.",
    wahlen: [
      { text: "Breit streuen", wirkung: { moral: 3, ruf: 2 } },
      { text: "In ein Restaurant stecken", wirkung: { moral: 6, ruf: 5, fitness: -3 } },
      { text: "Alles auf ein Startup", wirkung: { moral: -8, ruf: 8 } },
    ],
  },
  {
    key: "trainerstreit", frage: "Der Trainer stellt dich auf eine ungewohnte Position.",
    wahlen: [
      { text: "Annehmen und lernen", wirkung: { overall: 1.0, moral: -5 } },
      { text: "Widersprechen", wirkung: { moral: 6, ruf: 3, overall: -0.6 } },
      { text: "Wechselgesuch stellen", wirkung: { moral: -6, ruf: 6 } },
    ],
  },
  {
    key: "reha", frage: "Eine alte Blessur meldet sich zurück.",
    wahlen: [
      { text: "Durchspielen", wirkung: { moral: 4, fitness: -12 }, risiko: 0.30 },
      { text: "Zwei Wochen aussetzen", wirkung: { fitness: 8, moral: -3 } },
      { text: "Operation und lange Pause", wirkung: { fitness: 18, moral: -10, overall: -1.2 } },
    ],
  },
];

export function ziehEreignis(k, gesehen = []) {
  const frei = EREIGNISSE.filter((e) => !gesehen.includes(e.key));
  const liste = frei.length ? frei : EREIGNISSE;
  return liste[hashStr(`${k.seed}:e:${k.saison}:${gesehen.length}`) % liste.length];
}

/** Eine Wahl anwenden. Liefert eine NEUE Karriere, damit React den Wechsel sieht. */
export function entscheide(k, wahl) {
  const w = wahl.wirkung || {};
  return {
    ...k,
    overall: grenze(k.overall + (w.overall || 0), OVERALL_START, OVERALL_MAX),
    fitness: grenze(k.fitness + (w.fitness || 0), 5, 100),
    moral: grenze(k.moral + (w.moral || 0), 5, 100),
    ruf: grenze(k.ruf + (w.ruf || 0), 0, 100),
    risiko: (k.risiko || 0) + (wahl.risiko || 0),
  };
}

/* ── Transfers ─────────────────────────────────────────────────────────────────
   Wer klopft an? Vereine, deren Niveau zu dem passt, was man gerade wert ist. Der
   Marktwert steigt mit Stärke, Ruf und Jugend — ein 19-Jähriger mit 80 ist
   begehrter als ein 33-Jähriger mit 80. */
export function marktwert(k) {
  const jugend = grenze(1.25 - Math.max(0, k.alter - 26) * 0.06, 0.4, 1.25);
  return (k.overall - 55) * jugend + k.ruf * 0.12;
}

export function angebote(k, welt, zufall, anzahl = 3) {
  const wert = marktwert(k);
  /* Das Niveau, das ein Verein anlegt. Es hängt am EIGENEN Overall und nicht an
     einer freien Formel: Eine frühere Fassung rechnete `62 + Wert × 0,62` und schob
     einem 80er-Spieler Angebote von 91er-Vereinen zu. Wer die annahm, saß auf der
     Bank, entwickelte sich nicht und schoss in einer ganzen Laufbahn 54 Tore.

     Der Ruf verschiebt die Grenze nach oben — dafür ist er da —, aber er ersetzt
     kein Können. Ein Wechsel über das eigene Niveau hinaus bleibt möglich und bleibt
     ein Wagnis. */
  const ziel = k.overall - 2 + Math.min(6, k.ruf * 0.07) + Math.max(0, 24 - k.alter) * 0.25;
  const passend = welt.vereine
    .filter((v) => v.key !== k.verein?.key)
    .map((v) => ({ v, abstand: Math.abs(v.niveau - ziel) }))
    .filter((x) => x.abstand < 7)
    .sort((a, b) => a.abstand - b.abstand)
    .slice(0, 24);
  if (!passend.length) return [];
  const out = [];
  const gesehen = new Set();
  for (let i = 0; i < anzahl * 6 && out.length < anzahl; i++) {
    const kand = passend[Math.floor(zufall() * passend.length)];
    if (!kand || gesehen.has(kand.v.key)) continue;
    gesehen.add(kand.v.key);
    out.push({ verein: kand.v, jahre: 2 + Math.floor(zufall() * 4) });
  }
  return out.sort((a, b) => b.verein.niveau - a.verein.niveau);
}

/* ── Der Jahreswechsel ─────────────────────────────────────────────────────────
   Was eine Saison mit einem Spieler macht: Alter, Form, Fitness und der Overall.
   Der Overall folgt der Alterskurve, wird aber davon gebremst oder getragen, wie
   viel man gespielt hat — wer auf der Bank sitzt, entwickelt sich nicht. */
export function alterePlayer(k, leistung, zufall, niveau = 75) {
  const spielzeit = leistung.anteil;
  const wachstum = alterswachstum(k.alter);
  /* WACHSTUM HÄNGT AN BEIDEM: wie viel man spielt UND auf welchem Niveau. Hing es
     allein an der Spielzeit, war Faulheit die beste Strategie — wer bei einem
     kleinen Verein blieb, spielte immer und entwickelte sich schneller als einer,
     der zu einem Spitzenklub wechselte. Gemessen: Höchstwert 88 beim Bleiben gegen
     82,5 beim Wechseln, also genau verkehrt herum.

     Jetzt halten sich beide Wege die Waage: Stammspieler bei einem 65er-Verein
     kommt auf 1,00 × 0,60, Ergänzungsspieler bei einem 90er auf 0,42 × 1,50. Fast
     gleich — und damit ist der Wechsel eine echte Entscheidung statt einer Falle. */
  const niveauFaktor = 0.6 + 0.9 * grenze((niveau - 65) / 25, 0, 1);
  const delta = wachstum > 0
    ? wachstum * (0.35 + 0.65 * spielzeit) * niveauFaktor * (0.7 + 0.6 * (k.fitness / 100))
    : wachstum;
  const verletzung = zufall() < grenze((k.risiko || 0) + 0.04 + Math.max(0, k.alter - 30) * 0.015, 0, 0.6);
  return {
    ...k,
    alter: k.alter + 1,
    saison: k.saison + 1,
    overall: grenze(k.overall + delta + (verletzung ? -1.4 : 0), OVERALL_START, OVERALL_MAX),
    fitness: grenze(k.fitness + (verletzung ? -18 : 6), 5, 100),
    form: grenze(45 + zufall() * 45 + (k.moral - 60) * 0.2, 10, 100),
    risiko: 0,
    verletzt: verletzung ? 1 : 0,
    vertragBis: Math.max(0, (k.vertragBis || 0) - 1),
  };
}

/* ── Karriereende ──────────────────────────────────────────────────────────────
   Aufgehört wird, wenn der Overall unter das Niveau fällt, auf dem noch jemand
   spielen lässt — spätestens mit 40. */
export const RUECKTRITT_AB = 32;

export function trittZurueck(k, zufall) {
  if (k.alter >= 40) return true;
  if (k.alter < RUECKTRITT_AB) return false;
  const druck = (k.alter - RUECKTRITT_AB) * 0.20 + Math.max(0, 76 - k.overall) * 0.06;
  return zufall() < druck;
}

/* Das Urteil am Ende. Copero sagt „Legende" oder „gescheitertes Talent"; die Stufen
   dazwischen hängen an Titeln UND an der erreichten Stärke, damit nicht allein das
   Glück eines Vereinswechsels entscheidet. */
/* Die Schwellen stehen NICHT nach Gefühl, sondern nach der gemessenen Verteilung
   aus je 300 simulierten Laufbahnen mit drei Spielweisen — optimal entschieden,
   zufällig entschieden, gar nicht entschieden und nie gewechselt:

     optimal   p10 12 · Median 31 · p70 44 · p90 68 · max 97
     zufällig  p10  8 · Median 22 · p70 27 · p90 36 · max 65
     passiv    p10  2 · Median  6 · p70  7 · p90 11 · max 18

   Daraus folgen die Marken: „Legende" holt gut ein Fünftel der optimal gespielten
   Laufbahnen und fast keine zufällige; wer nie entscheidet und nie wechselt, kommt
   über „Solider Profi" nicht hinaus. */
export const STUFEN = [
  { key: "legende",   name: "Legende",              emoji: "👑", ab: 55 },
  { key: "weltstar",  name: "Weltstar",             emoji: "🌟", ab: 33 },
  { key: "star",      name: "Star",                 emoji: "⭐", ab: 20 },
  { key: "solide",    name: "Solider Profi",        emoji: "🎽", ab: 10 },
  { key: "durch",     name: "Durchgekommen",        emoji: "➖", ab: 4 },
  { key: "gescheit",  name: "Gescheitertes Talent", emoji: "💤", ab: -99 },
];

export function karrierePunkte(k) {
  const t = k.titel || {};
  const zaehl = (key) => t[key] || 0;
  const gross = zaehl("CL") * 4 + zaehl("WM") * 5 + zaehl("BDO") * 6
    + (zaehl("EM") + zaehl("CA")) * 3 + zaehl("EL") * 2;
  const liga = Object.values(MEISTER_KEY).reduce((a, key) => a + zaehl(key) * 2, 0);
  const pokal = Object.values(POKAL_KEY).reduce((a, key) => a + zaehl(key), 0);
  const einzel = (zaehl("TSK") + zaehl("VLK")) * 1.5;
  const staerke = Math.max(0, (k.hoechsterOverall || k.overall) - 78) * 0.6;
  return Math.round((gross + liga + pokal + einzel + staerke) * 10) / 10;
}

export const stufeFuer = (k) => STUFEN.find((s) => karrierePunkte(k) >= s.ab);
