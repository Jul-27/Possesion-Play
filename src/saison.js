/* Die Saison der Traumelf — reine Logik (kein React).

   WAS HIER PASSIERT UND WARUM ES NICHT GESCHÄTZT WIRD: Eine frühere Fassung rechnete
   aus der Wertung der Elf direkt eine Bilanz — eine Kurve mit Exponent, kalibriert an
   1.350 simulierten Drafts. Das ergab eine Zahl, aber kein Spiel. Jetzt wird die
   Saison wirklich ausgespielt: 34 bzw. 38 Spieltage, jedes Spiel einzeln, mit
   Toren, und die Tabelle steht nach jedem Spieltag neu.

   DIE GEGNER SIND ECHT. Nicht erfunden und nicht generisch, sondern Verein-Saison-
   Paare aus demselben Topf, aus dem gedraftet wird: Bayern 2014, Chelsea 2013,
   Real Madrid 2012. Ihre Stärke kommt aus ihrem tatsächlichen Kader in genau dieser
   Saison. Gemessen über den ganzen Topf:

     Bundesliga     62,4 (Werder 1996) bis 95,7 (Bayern 2014), Median 72,9
     Premier League 64,2 (Everton 2001) bis 91,5 (Chelsea 2014), Median 78,4
     La Liga        65,0 (Valencia 2026) bis 92,2 (Real 2013),   Median 75,5

   Siebzehn Gegner ergeben 34 Spieltage, neunzehn ergeben 38 — genau die echten
   Saisonlängen, ohne einen einzigen erfundenen Verein.

   ECHTE MANNSCHAFTEN BEKOMMEN DEN VOLLEN VERBUND. Sie haben alle 55 Paare wirklich
   zusammen gespielt. Deshalb muss eine zusammengedraftete Elf individuell besser
   sein, um mitzuhalten — das ist kein Nachteil, sondern der Grund, warum es sich
   lohnt, aus wenigen Kadern zu draften. */
import { klasseIn, kader, VERBUND_MAX, KLASSE_MIN } from "./draft.js";

/** Mannschaften je Liga, einschließlich der eigenen. 18 -> 34 Spieltage, 20 -> 38. */
export const TEAMS = { BL: 18, PL: 20, LL: 20 };
export const spieltageFuer = (n) => (n - 1) * 2;

/* ── Zufall ────────────────────────────────────────────────────────────────────
   Deterministisch aus einem Startwert: Dieselbe Saison lässt sich noch einmal
   ansehen, und ein Fehlerbericht ist nachstellbar. */
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
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}

/* ── Gegner ────────────────────────────────────────────────────────────────────
   Die Stärke eines echten Kaders: die besten elf Klassen DIESER Saison, plus der
   volle Verbund. Nur die besten elf, weil auch eine echte Mannschaft elf Leute
   aufstellt — mit dem ganzen Kader wäre ein 40-Mann-Aufgebot schlechter als ein
   knappes, obwohl es mehr Auswahl hat. */
export function teamStaerke(ziehung, players, klassen) {
  const k = ziehung.spieler
    .map((i) => klasseIn(klassen, players, i, ziehung.jahr))
    .sort((a, b) => b - a)
    .slice(0, 11);
  /* AUF ELF AUFFÜLLEN. Ein dünn besetzter Kader — St. Pauli hat 2025/26 nur sieben
     Spieler in unseren Daten — hätte sonst den Schnitt seiner sieben Bekannten und
     stünde damit STÄRKER da als ein voller Kader mit elf. Die fehlenden Plätze
     zählen als KLASSE_MIN, dem Boden der Skala; eine fest hingeschriebene 50 ließ
     St. Pauli auf 59 fallen, nachdem die Skala bei 65 zu beginnen anfing. */
  while (k.length < 11) k.push(KLASSE_MIN);
  return Math.round((k.reduce((a, b) => a + b, 0) / k.length + VERBUND_MAX) * 10) / 10;
}

/**
 * Die ECHTE Liga einer Saison: genau die Vereine, die damals dabei waren, jeder mit
 * der Stärke seines damaligen Kaders.
 *
 * Das ersetzt das Zusammenwürfeln von Jahrgängen. Vorher trat die Traumelf gegen
 * „Bayern 2014" und „Werder 1996" in derselben Tabelle an — unterhaltsam, aber keine
 * Liga. Jetzt spielt sie in der Bundesliga 2025/26 gegen die achtzehn, die dort
 * wirklich spielen.
 *
 * Die Kaderschwelle liegt NIEDRIGER als beim Draft: Gezogen werden soll nur, wen man
 * kennt, aber die Stärke eines Gegners soll auch seine weniger bekannten Spieler
 * berücksichtigen — sonst wäre ein Aufsteiger nur so stark wie seine zwei Nationalspieler.
 */
export const GEGNER_SL_MIN = 5;

export function echteLiga(players, klassen, vereine, jahr, slMin = GEGNER_SL_MIN) {
  return vereine
    .filter((v) => v.jahre.includes(jahr))
    .map((v) => {
      const spieler = kader(players, v.key, jahr, slMin);
      return {
        key: v.key, kurz: v.name, jahr, spieler,
        name: v.name,
        staerke: teamStaerke({ spieler, jahr }, players, klassen),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/**
 * Wen verdrängt die Traumelf?
 *
 * Eine Liga hat achtzehn oder zwanzig Plätze, und die eigene Elf braucht einen davon
 * — sonst wären es neunzehn Mannschaften und der Spielplan ginge nicht auf. Gewählt
 * wird zufällig, aber deterministisch aus dem Startwert, damit dieselbe Partie
 * dieselbe Liga hat.
 */
export function ersetzeEinen(liga, seed) {
  if (!liga.length) return { gegner: [], ersetzt: null };
  const n = hashStr(`ersetzt:${seed}`) % liga.length;
  return { gegner: liga.filter((_, k) => k !== n), ersetzt: liga[n] };
}

/* `waehleGegner` stand hier: Es würfelte siebzehn Verein-Saison-Paare geschichtet
   zusammen, damit die Liga eine Spitze und einen Keller hatte. Seit `echteLiga` die
   Vereine der echten Saison liefert, wird nichts mehr gewürfelt — die Bundesliga
   2025/26 HAT eine Spitze und einen Keller. */

/* ── Spielplan ─────────────────────────────────────────────────────────────────
   Kreisverfahren: Eine Mannschaft steht fest, die übrigen rotieren. Das erzeugt eine
   vollständige Hinrunde, in der jeder genau einmal gegen jeden spielt; die Rückrunde
   dreht das Heimrecht um. */
export function spielplan(n) {
  const ids = [...Array(n).keys()];
  const hin = [];
  for (let runde = 0; runde < n - 1; runde++) {
    const spiele = [];
    for (let k = 0; k < n / 2; k++) {
      const h = ids[k], a = ids[n - 1 - k];
      /* Heimrecht abwechselnd, sonst hätte die feste Mannschaft immer Heimspiele. */
      spiele.push((runde + k) % 2 ? { h: a, a: h } : { h, a });
    }
    hin.push(spiele);
    ids.splice(1, 0, ids.pop());
  }
  const rueck = hin.map((tag) => tag.map(({ h, a }) => ({ h: a, a: h })));
  return [...hin, ...rueck];
}

/* ── Ein Spiel ─────────────────────────────────────────────────────────────────
   Tore aus einer Poisson-Verteilung, deren Erwartungswert am Stärkeunterschied
   hängt. Das ist das übliche Modell für Fußballergebnisse und liefert von selbst
   die richtigen Häufigkeiten: viele 1:0 und 2:1, gelegentlich ein 5:0.

   Der Unterschied wird GEDECKELT. Ohne Deckel treffen im Extremfall Bayern 2014
   (95,7) auf Werder 1996 (62,4), das sind 33 Punkte — daraus würde jede Woche ein
   zweistelliges Ergebnis. */
export const TOR_BASIS = 1.35;      // mittlere Tore je Mannschaft und Spiel
export const HEIMVORTEIL = 1.18;
export const STAERKE_SKALA = 26;    // so viele Punkte Unterschied verdoppeln die Tore
export const STAERKE_DECKEL = 1.15; // höchstens gut das Dreifache an Toren

const poisson = (lambda, zufall) => {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= zufall(); } while (p > L && k < 40);
  return k - 1;
};

export function simuliereSpiel(staerkeH, staerkeA, zufall) {
  const d = Math.max(-STAERKE_DECKEL, Math.min(STAERKE_DECKEL, (staerkeH - staerkeA) / STAERKE_SKALA));
  return {
    th: poisson(TOR_BASIS * Math.exp(d) * HEIMVORTEIL, zufall),
    ta: poisson(TOR_BASIS * Math.exp(-d), zufall),
  };
}

/* ── Die Saison ────────────────────────────────────────────────────────────────
   Die eigene Elf ist Mannschaft 0. Der Spielplan wird einmal erzeugt und dann
   Spieltag für Spieltag ausgespielt — jedes Spiel, nicht nur die eigenen, sonst
   stünde in der Tabelle über den anderen nichts Belastbares. */
export function simuliereSaison({ meinName = "Deine Traumelf", meineStaerke, gegner, seed = 1 }) {
  const teams = [{ name: meinName, staerke: meineStaerke, ich: true }, ...gegner];
  const zufall = rng(hashStr(`saison:${seed}`));
  const plan = spielplan(teams.length);
  const spieltage = plan.map((spiele, n) => ({
    nr: n + 1,
    spiele: spiele.map(({ h, a }) => ({ h, a, ...simuliereSpiel(teams[h].staerke, teams[a].staerke, zufall) })),
  }));
  return { teams, spieltage };
}

/* ── Tabelle ───────────────────────────────────────────────────────────────────
   Bis zu einem Spieltag, damit die Ansicht den Stand mitlaufen lassen kann. */
export function tabelleNach(teams, spieltage, bis = spieltage.length) {
  const zeilen = teams.map((t, i) => ({
    i, name: t.name, ich: !!t.ich, staerke: t.staerke,
    sp: 0, s: 0, u: 0, n: 0, tore: 0, gegentore: 0, punkte: 0,
  }));
  for (const tag of spieltage.slice(0, bis)) {
    for (const { h, a, th, ta } of tag.spiele) {
      const H = zeilen[h], A = zeilen[a];
      H.sp++; A.sp++;
      H.tore += th; H.gegentore += ta;
      A.tore += ta; A.gegentore += th;
      if (th > ta) { H.s++; A.n++; H.punkte += 3; }
      else if (th < ta) { A.s++; H.n++; A.punkte += 3; }
      else { H.u++; A.u++; H.punkte++; A.punkte++; }
    }
  }
  /* Punkte, dann Tordifferenz, dann Tore — die übliche Reihenfolge. Der Name
     entscheidet zuletzt, damit die Sortierung bei Gleichstand stabil bleibt und ein
     Team nicht zwischen zwei Spieltagen grundlos die Plätze tauscht. */
  return zeilen
    .map((z) => ({ ...z, diff: z.tore - z.gegentore }))
    .sort((x, y) => y.punkte - x.punkte || y.diff - x.diff || y.tore - x.tore || x.name.localeCompare(y.name))
    .map((z, k) => ({ ...z, platz: k + 1 }));
}

export const meineZeile = (tabelle) => tabelle.find((z) => z.ich) || null;

/* ── Abzeichen ─────────────────────────────────────────────────────────────────
   Jetzt aus dem TABELLENPLATZ, nicht mehr aus einem Punkteanteil. Das ist der
   eigentliche Gewinn der Simulation: „Champions League" heißt, unter den ersten
   vier zu stehen, und nicht, 60 % der möglichen Punkte geholt zu haben. */
export const ABZEICHEN = [
  { key: "makellos",  name: "Makellos",         emoji: "👑", pruef: (z) => z.s === z.sp },
  { key: "unbesiegt", name: "Unbesiegt",        emoji: "🛡️", pruef: (z) => z.n === 0 },
  { key: "rekord",    name: "Rekordmeister",    emoji: "🏆", pruef: (z, n) => z.platz === 1 && z.punkte >= z.sp * 3 * 0.82 },
  { key: "meister",   name: "Meister",          emoji: "🥇", pruef: (z) => z.platz === 1 },
  { key: "cl",        name: "Champions League", emoji: "⭐", pruef: (z) => z.platz <= 4 },
  { key: "el",        name: "Europa League",    emoji: "✨", pruef: (z) => z.platz <= 6 },
  { key: "mitte",     name: "Mittelfeld",       emoji: "➖", pruef: (z, n) => z.platz <= n - 3 },
  { key: "abstieg",   name: "Abstiegsplatz",    emoji: "⬇️", pruef: () => true },
];

export const abzeichenFuer = (zeile, anzahl) => ABZEICHEN.find((a) => a.pruef(zeile, anzahl));

/* ── Höhepunkte ────────────────────────────────────────────────────────────────
   Für die Saisonkarte: was von 34 Spielen erzählenswert ist. */
export function hoehepunkte(teams, spieltage) {
  const meine = [];
  for (const tag of spieltage) {
    for (const s of tag.spiele) {
      if (s.h !== 0 && s.a !== 0) continue;
      const heim = s.h === 0;
      meine.push({
        nr: tag.nr, heim,
        gegner: teams[heim ? s.a : s.h].name,
        eigene: heim ? s.th : s.ta,
        fremde: heim ? s.ta : s.th,
      });
    }
  }
  const diff = (m) => m.eigene - m.fremde;
  const siege = meine.filter((m) => diff(m) > 0);
  const pleiten = meine.filter((m) => diff(m) < 0);
  /* Die längste Serie ohne Niederlage — die Zahl, die eine Saison am besten
     zusammenfasst, wenn sie nicht in einem Titel endet. */
  let lauf = 0, besterLauf = 0;
  for (const m of meine) { if (diff(m) >= 0) { lauf++; besterLauf = Math.max(besterLauf, lauf); } else lauf = 0; }
  const bestes = siege.sort((a, b) => diff(b) - diff(a) || b.eigene - a.eigene)[0] || null;
  const schlimmstes = pleiten.sort((a, b) => diff(a) - diff(b))[0] || null;
  return { spiele: meine, bestes, schlimmstes, serie: besterLauf };
}
