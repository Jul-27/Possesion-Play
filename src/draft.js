/* „Traumelf" — reine Logik (kein React).

   Ein Draft nach dem Vorbild von 38-0-0: Ein Spin zieht einen echten Verein in einer
   echten Saison, du nimmst EINEN Spieler aus genau diesem Kader auf eine freie
   Position, elfmal, bis die Mannschaft steht. Am Ende läuft sie eine Saison.

   ── WORIN WIR UNS VOM VORBILD UNTERSCHEIDEN MÜSSEN ──────────────────────────
   38-0-0 rechnet aus Spielerbewertungen (Overall 60–95, sechs Attribute) eine
   Bilanz. Solche Zahlen hat unsere Pipeline nicht, und die naheliegende Ersatzgröße
   ist untauglich: Titel zählen KARRIEREWEIT, dadurch überholt ein Ergänzungsspieler
   mit vielen Bank-Meisterschaften jeden Star — bei Bayern 2013 stünde Sânmărtean
   (7 Titel) vor Schweinsteiger (6).

   Bekanntheit rangiert dagegen richtig. Bayern 2013 von oben: Neuer, Müller, Robben,
   Ribéry, Lahm, Kroos, Boateng, Schweinsteiger. Barça 2011: Messi, Iniesta, Xavi,
   Piqué, Fàbregas, Villa, Alves, Busquets. Und sie ist NICHT epochenverzerrt — der
   Schnitt der besten elf eines Kaders liegt über alle Jahrzehnte bei 49 bis 58.

   Sie misst aber Berühmtheit, nicht Können. Deshalb heißt sie hier KLASSE und wird
   als Rangplatz im Pool ausgewiesen, nicht als erfundene Spielstärke.

   ── WORIN WIR BESSER SIND ───────────────────────────────────────────────────
   VERBUND. Zufällig zusammengewürfelte Elfen haben nur 1,5 % Paare, die je zusammen
   gespielt haben. Wer aus wenigen Kadern draftet, baut eine Mannschaft, die es
   hätte geben können — und genau das wird belohnt. Das kann das Vorbild nicht, weil
   ihm die datierten Karrieren fehlen. */
import { norm } from "./gameData.js";
import { passtAufPosition, posGruppe } from "./positions.js";

export const DRAFT_SL_MIN = 25;      // unter dieser Bekanntheit kennt sie niemand
export const DRAFT_MIN_KADER = 11;   // so viele bekannte Spieler muss eine Ziehung haben
export const DRAFT_AB_JAHR = 1995;   // davor wird die Datenlage je Saison zu dünn
export const RESPINS = 1;            // ein Neuwurf je Partie — bei uns ohne Werbung

/** Saisonlänge je Liga. „38-0-0" ist eine Premier-League-Zahl; die Bundesliga hat 34. */
export const SPIELE = { BL: 34, PL: 38, LL: 38 };
export const LIGA_NAME = { BL: "Bundesliga", PL: "Premier League", LL: "La Liga" };

const jahrIn = (cp, key, jahr) =>
  (cp || []).some(([c, von, bis]) => c === key && von <= jahr && jahr <= (bis === 0 ? 2026 : bis));

/**
 * Der Kader eines Vereins in einem Jahr — Spielerindizes.
 *
 * Eigenständig, weil ihn zwei ganz verschiedene Stellen brauchen: die Ziehungen des
 * Drafts und die Stärke der echten Ligagegner in `saison.js`.
 */
export function kader(players, clubKey, jahr, slMin = DRAFT_SL_MIN) {
  const out = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if ((p.sl || 0) < slMin || !p.pos) continue;
    if (jahrIn(p.cp, clubKey, jahr)) out.push(i);
  }
  return out;
}

/** Trägt der Kader alle vier Positionsgruppen? Sonst ist der Spin verschenkt. */
export const vollstaendig = (spieler, players) => {
  const gruppen = new Set(spieler.map((i) => players[i].pos));
  return ["TW", "ABW", "MF", "ST"].every((g) => gruppen.has(g));
};

/**
 * Alle ziehbaren Verein-Saison-Paare einer Liga.
 *
 * Eine Ziehung muss ELF bekannte Spieler haben UND alle vier Positionsgruppen —
 * sonst zieht man einen Kader, aus dem sich die offene Stelle gar nicht besetzen
 * lässt, und der Spin ist verschenkt.
 */
export function baueZiehungen(players, clubs, liga, jetzt = 2026) {
  const vereine = clubs.filter((c) => c.lg === liga);
  const out = [];
  for (const v of vereine) {
    /* `jahre` grenzt ein, WANN der Verein wirklich in dieser Liga spielte. Ohne die
       Angabe wird wie bisher der ganze Zeitraum durchprobiert — sonst verschwänden
       die 47 Spielvereine aus den Jahren, für die wir keine Ligalisten haben. */
    const jahre = v.jahre || null;
    for (let jahr = DRAFT_AB_JAHR; jahr <= jetzt; jahr++) {
      if (jahre && !jahre.includes(jahr)) continue;
      const spieler = kader(players, v.key, jahr);
      if (spieler.length < DRAFT_MIN_KADER) continue;
      if (!vollstaendig(spieler, players)) continue;
      out.push({ key: v.key, name: v.name, jahr, spieler });
    }
  }
  return out;
}

/* ── Klasse ────────────────────────────────────────────────────────────────────
   Der Rangplatz im Pool, umgerechnet auf 65 bis 96. Bewusst NICHT die rohe
   Bekanntheit: die reicht von 1 bis über 200 und würde von Messi allein beherrscht.
   Als Rangplatz ist die Zahl außerdem erklärbar — „besser als 99 % des Pools".

   DIE KURVE IST DER GANZE PUNKT. Eine erste Fassung streckte den Rangplatz LINEAR
   auf 50 bis 99 — dadurch lagen per Konstruktion 19 % des Pools über 90, in der
   Bundesliga 195 Spieler, und die Spitze war ein Plateau aus elf Namen auf 99.
   Mario Balotelli stand auf 98. Eine Bewertung, die ein Fünftel aller Spieler zur
   Weltklasse erklärt, sagt nichts mehr aus.

   Die Stützstellen unten bilden ab, wie Fußballkader wirklich aussehen: viele
   Solide, wenige Stars, eine Handvoll Ausnahmespieler. Gerechnet auf den Pool:

     ab 85  das oberste Vierzigstel — die Stars
     ab 90  etwa ein halbes Prozent — die Besten der Besten
     ab 92  das oberste Fünftel eines Prozents

   Die Skala beginnt bei 65 und nicht bei 50: Wer es überhaupt in einen Kader der
   drei größten Ligen geschafft hat, ist Profi. Die Spanne ist dadurch enger, und
   der Unterschied zwischen einem Ergänzungsspieler und einem Star muss aus der
   Kurve kommen, nicht aus der Skalenbreite. */
const KLASSEN_KURVE = [
  [0.00, 65], [0.50, 70], [0.80, 75], [0.93, 80],
  [0.975, 85], [0.99, 88], [0.998, 92], [1.00, 96],
];

/* Boden und Decke der Skala, damit niemand sie anderswo als Zahl hinschreibt. Genau
   das war schon einmal ein Fehler: `teamStaerke` füllte dünne Kader mit 50 auf, und
   als die Skala von 50 auf 65 stieg, stand St. Pauli mit 59 unter dem Boden. */
export const KLASSE_MIN = KLASSEN_KURVE[0][1];
export const KLASSE_MAX = KLASSEN_KURVE.at(-1)[1];

/** Perzentil (0 bis 1) auf die Klassenskala, linear zwischen den Stützstellen. */
export function klassenKurve(pct) {
  const p = Math.max(0, Math.min(1, pct));
  for (let n = 1; n < KLASSEN_KURVE.length; n++) {
    const [p0, k0] = KLASSEN_KURVE[n - 1], [p1, k1] = KLASSEN_KURVE[n];
    if (p <= p1) return k0 + ((p - p0) / (p1 - p0)) * (k1 - k0);
  }
  return 98;
}

/**
 * Die Grundklasse je Spieler — was er auf dem Höhepunkt seiner Laufbahn wert ist.
 * Die Klasse einer einzelnen SAISON kommt erst aus `klasseIn`.
 *
 * GERANGT WIRD JE POSITIONSGRUPPE, nicht über den ganzen Pool. Torhüter und
 * Verteidiger werden nie so berühmt wie Stürmer — über alle gerangt bestanden die
 * besten achtzehn der Bundesliga aus vierzehn Angreifern und einem einzigen
 * Verteidiger (Lahm auf Platz 17); Kahn, Matthäus und Ballack fehlten ganz.
 * Innerhalb der Gruppen stimmt die Reihenfolge dagegen sofort:
 *
 *   TW   Neuer · Kahn · Reina · ter Stegen · Lehmann
 *   ABW  Lahm · Boateng · Hummels · Hakimi · Carvajal
 *   MF   Özil · De Bruyne · Alonso · Matthäus · Kroos
 *   ST   Lewandowski · Klose · Kane · Müller · Robben
 *
 * Die Zahl heißt damit „so gut für einen Torhüter" statt „so berühmt" — und genau
 * so wird sie im Draft gebraucht, wo für jede Position nur ihresgleichen zur Wahl
 * stehen.
 */
export function baueKlassen(players, ziehungen, einsaetze = null) {
  const imPool = [...new Set(ziehungen.flatMap((z) => z.spieler))];
  const ligaVereine = new Set(ziehungen.map((z) => z.key));
  const proGruppe = new Map();
  for (const i of imPool) {
    const g = players[i].pos || "?";
    if (!proGruppe.has(g)) proGruppe.set(g, []);
    proGruppe.get(g).push(i);
  }
  const nation = nationsFaktoren(players, imPool);
  const klasse = new Map();
  for (const gruppe of proGruppe.values()) {
    const ruf = new Map(gruppe.map((i) => [
      i,
      ((players[i].sl || 0) / nationsAusgleich(players[i], nation)) * ligaFaktor(players[i], ligaVereine, einsaetze),
    ]));
    gruppe.sort((a, b) => ruf.get(a) - ruf.get(b));
    gruppe.forEach((i, rang) => {
      klasse.set(i, Math.round(klassenKurve(rang / Math.max(1, gruppe.length - 1))));
    });
  }
  return klasse;
}

/* ── Die Reichweite der eigenen Wikipedia ──────────────────────────────────────
   Die dritte Verzerrung, und die unauffälligste. Gemessen an der Median-Bekanntheit
   im Bundesliga-Pool:

     Japan 58 · Spanien 46 · Niederlande 45 · Kroatien 44 · England 40
     Deutschland 37 · Brasilien 37 · Frankreich 35 · Argentinien 33

   Japanische Spieler liegen 57 % über den deutschen. Das ist keine Fußballtatsache
   — sechs von ihnen standen dadurch in den Spitzenlisten, Sakai und Uchida vor
   Lizarazu und Höwedes. Es ist die Größe der japanischen Wikipedia.

   NUR ZUR HÄLFTE AUSGEGLICHEN (Wurzel), denn ein Teil des Abstands ist echt: Wer
   aus Spanien in die Bundesliga wechselt, ist ausgewählt, während der deutsche Pool
   jeden Ergänzungsspieler enthält. Voll ausgeglichen (β = 1) rutschte Robben hinter
   Mario Gómez — das wäre die Übertreibung in die andere Richtung. */
export const NATION_BETA = 0.5;
export const NATION_MIN = 8;    // unter so wenigen Spielern ist der Median Rauschen

export function nationsFaktoren(players, pool) {
  const alle = pool.map((i) => players[i].sl || 0).sort((a, b) => a - b);
  if (!alle.length) return new Map();
  const poolMedian = alle[Math.floor(alle.length / 2)] || 1;
  const proNat = new Map();
  for (const i of pool) {
    for (const n of players[i].nat || []) {
      if (!proNat.has(n)) proNat.set(n, []);
      proNat.get(n).push(players[i].sl || 0);
    }
  }
  const out = new Map();
  for (const [n, werte] of proNat) {
    if (werte.length < NATION_MIN) continue;
    werte.sort((a, b) => a - b);
    out.set(n, Math.pow(werte[Math.floor(werte.length / 2)] / poolMedian, NATION_BETA));
  }
  return out;
}

/** Der Ausgleich eines Spielers — bei mehreren Pässen der Mittelwert, sonst 1. */
export function nationsAusgleich(player, faktoren) {
  const f = (player.nat || []).map((n) => faktoren.get(n)).filter((x) => x > 0);
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 1;
}

/* ── Ruhm von anderswo ─────────────────────────────────────────────────────────
   Bekanntheit ist KARRIEREWEIT. Sie kann nicht wissen, was jemand in DIESER Liga
   war, und das führte zu offensichtlich falschen Ranglisten: Mesut Özil stand als
   bester Mittelfeldspieler der Bundesliga auf 96 — mit 101 Bundesligaspielen für
   Schalke und Bremen als Heranwachsender, während sein Ruhm von Real und Arsenal
   stammt. Gemessen an Bundesligaspielen:

     Müller 503 · Kahn 429 · Lahm 386 · Lewandowski 384 · Klose 183
     Özil 101 · James Rodríguez 77 · Raúl 66

   Der Anteil der Einsätze, die auf Vereine DIESER Liga entfallen, sagt genau das:
   Müller 100 %, Lewandowski 74 %, Özil 26 %. Er dämpft die Bekanntheit, ersetzt sie
   aber nicht — Einsätze messen die Rolle, nicht die Güte, und ein Stammspieler in
   Freiburg hat dieselben 34 Spiele wie einer in München.

   DER ANTEIL WIRD AUS JAHREN GERECHNET, NICHT AUS EINSÄTZEN. Der erste Versuch nahm
   die Einsätze als Nenner und ging schief, weil Wikidata sie nur bei 69 % der
   Stationen führt — und eine Lücke im Nenner dreht das Ergebnis um:

     De Bruyne trug {WOB 52, SVW 33, NAP 18}; seine über 400 Spiele für City und
     Chelsea fehlen. Sein Bundesliga-Anteil rechnete sich damit zu 83 %, und er
     stand als bester Mittelfeldspieler der Liga auf 98.
     Piqué und Eto'o hatten gar keinen Eintrag, blieben ungedämpft und führten die
     Premier League an — mit vier bzw. einem Jahr dort.

   `cp` hat dagegen jeder im Pool lückenlos, denn genau darüber kam er in seine
   Ziehung. Und die Jahre sagen dasselbe, wo beides vorliegt: Özil 27 % gegen
   gemessene 26 %, Lewandowski 75 % gegen 74 %, Beckham 67 % gegen 63 %. */
export const LIGA_BODEN = 0.45;      // so viel bleibt auch bei reinem Gastspiel

const spielerSchluesselFuer = (p) => norm(p.n) + "|" + p.by;

/** Jahre bei Vereinen dieser Liga und bei allen bekannten Vereinen. */
export function ligaJahre(player, ligaVereine, jetzt = 2026) {
  let hier = 0, gesamt = 0;
  for (const [club, von, bis] of player.cp || []) {
    const jahre = Math.max(1, (bis === 0 ? jetzt : bis) - von);
    gesamt += jahre;
    if (ligaVereine.has(club)) hier += jahre;
  }
  return { hier, gesamt };
}

export function ligaAnteil(player, ligaVereine) {
  const { hier, gesamt } = ligaJahre(player, ligaVereine);
  return gesamt > 0 ? hier / gesamt : 1;
}

/* ── Stammspieler oder Gast? ───────────────────────────────────────────────────
   Der Jahresanteil weiß nicht, ob jemand in diesen Jahren gespielt hat. Genau dafür
   sind die Einsätze aus Wikidata da: Maya Yoshida und Atsuto Uchida tragen dank
   japanischer Wikipedia eine Bekanntheit, die ihre 29 bzw. 104 Schalker Spiele
   nicht decken, und standen damit über Höwedes und Lizarazu.

   Gesättigt bei 120 Spielen — etwa drei volle Saisons. Darüber macht mehr keinen
   Unterschied mehr, damit heutige Spieler nicht bestraft werden, nur weil ihre
   Laufbahn noch läuft. FEHLT DIE ZAHL, bleibt der Faktor 1: Matthäus und Xavi
   tragen bei keiner Station eine, und eine Datenlücke darf nichts kosten. */
export const SPIELE_SATT = 120;
export const SPIELE_BODEN = 0.42;   // wenige Einsätze sollen spürbar kosten

export function ligaSpiele(player, ligaVereine, einsaetze) {
  const eintrag = einsaetze?.[spielerSchluesselFuer(player)];
  if (!eintrag) return null;
  let n = 0;
  for (const [club, spiele] of Object.entries(eintrag)) {
    if (club !== "__tore" && ligaVereine.has(club)) n += spiele;
  }
  return n > 0 ? n : null;
}

/* Wikidata führt die Einsatzzahl nur bei 69 % der Stationen — Matthäus und Xavi
   tragen gar keine. Sie deshalb wie „null Spiele" zu behandeln, hieße Datenlücken
   zu bestrafen statt Randfiguren. Wo die Zahl fehlt, wird sie aus den JAHREN
   geschätzt, die immer vorliegen: Ein Stammspieler kommt auf etwa dreißig Spiele je
   Saison, gerechnet wird mit fünfundzwanzig. Damit bleibt ein Zwölfjahresmann oben
   und ein Einjahresgast unten, ohne dass die Lücke selbst etwas kostet. */
export const SPIELE_JE_JAHR = 25;

export function ligaSpieleGeschaetzt(player, ligaVereine, einsaetze) {
  const echt = ligaSpiele(player, ligaVereine, einsaetze);
  if (echt != null) return echt;
  return ligaJahre(player, ligaVereine).hier * SPIELE_JE_JAHR;
}

/* Beide Achsen zusammen. Die Wurzeln dämpfen die Dämpfung: Ein Anteil von 25 % soll
   spürbar kosten, aber keinen Spieler auf ein Viertel seines Rufs stellen. */
export function ligaFaktor(player, ligaVereine, einsaetze) {
  const anteil = LIGA_BODEN + (1 - LIGA_BODEN) * Math.sqrt(ligaAnteil(player, ligaVereine));
  const spiele = ligaSpieleGeschaetzt(player, ligaVereine, einsaetze);
  return anteil * (SPIELE_BODEN + (1 - SPIELE_BODEN) * Math.sqrt(Math.min(1, spiele / SPIELE_SATT)));
}

/* ── Form: dieselbe Karriere, verschiedene Jahre ───────────────────────────────
   Bekanntheit gilt für die GANZE Laufbahn. Ohne Korrektur wäre der 38-jährige
   Auslaufmodell-Lewandowski so stark wie der von 2014, und ein 17-jähriger, der
   zweimal eingewechselt wurde, trüge den Ruhm seiner späteren Jahre.

   WAS DIESE KURVE KANN UND WAS NICHT: Sie kennt das Alter, nicht die Leistung —
   dazu haben wir keine Daten, `t` führt Titel ohne Jahreszahl. Sie trifft deshalb
   die häufigen Fälle (Talent am Anfang, Routinier am Ende) und irrt bei den
   Ausnahmen: Haalands 41 Tore mit 21 sind ihr genauso wenig bekannt wie
   Lewandowskis Rekordsaison mit 32. Das Plateau ist bewusst breit — von 21 bis 32
   voller Wert —, damit sie nur dort eingreift, wo sie sicher ist. */
const FORM_KURVE = [
  [16, 0.58], [18, 0.72], [19, 0.82], [20, 0.91], [21, 1.00],
  [32, 1.00], [33, 0.96], [34, 0.91], [35, 0.85], [36, 0.78], [39, 0.62],
];

export function formFaktor(alter) {
  if (!Number.isFinite(alter)) return 1;
  if (alter <= FORM_KURVE[0][0]) return FORM_KURVE[0][1];
  for (let n = 1; n < FORM_KURVE.length; n++) {
    const [a0, f0] = FORM_KURVE[n - 1], [a1, f1] = FORM_KURVE[n];
    if (alter <= a1) return f0 + ((alter - a0) / (a1 - a0)) * (f1 - f0);
  }
  return FORM_KURVE[FORM_KURVE.length - 1][1];
}

/**
 * Die Klasse eines Spielers in EINER Saison.
 *
 * Die Form wirkt nur auf den Teil ÜBER 50, nicht auf die ganze Zahl: 50 ist der
 * Boden der Skala, kein Können, das ein Talent noch nicht hätte. Ein 18-Jähriger
 * mit Grundklasse 90 steht bei 79, nicht bei 65.
 */
export function klasseIn(basis, players, i, jahr) {
  const grund = basis.get(i) ?? 50;
  const by = players[i]?.by;
  if (!by || !jahr) return grund;
  return Math.round(50 + (grund - 50) * formFaktor(jahr - by));
}

/* ── Positionspassung ──────────────────────────────────────────────────────────
   Wer die geforderte Position BELEGT spielt, zählt voll. Wer nur über seine grobe
   Gruppe passt, zählt etwas weniger — er steht dort, aber es ist nicht seine
   Position. Weniger als die Gruppe geht gar nicht.

   Die Gruppe gilt AUCH für Spieler mit bekannter Feinposition. `passtAufPosition`
   allein täte das nicht: Dort passt, wer Feinpositionen hat, nur exakt, und wer
   keine hat, auf die ganze Gruppe. Im Draft wäre das verkehrt herum — ein als
   Innenverteidiger geführter Spieler dürfte nicht links hinten aushelfen, einer ganz
   ohne Positionsangabe dagegen überall in der Abwehr. Bessere Daten machten den
   Spieler schlechter verwendbar. Hier hilft jeder in seiner Gruppe aus, und nur die
   Feinposition zählt voll. */
export const PASSUNG_GENAU = 1;
export const PASSUNG_GRUPPE = 0.92;

export function passung(player, slotPos) {
  if (!player) return 0;
  const fein = Array.isArray(player.pp) ? player.pp : [];
  if (fein.length && passtAufPosition(fein, slotPos)) return PASSUNG_GENAU;
  /* Die Gruppe ist zugleich die harte Grenze: Nur Torhüter tragen die Gruppe „TW",
     also kommt auch nur ein Torhüter ins Tor — und kein Torhüter ins Sturmzentrum. */
  return posGruppe(slotPos) === player.pos ? PASSUNG_GRUPPE : 0;
}

export const darfAufPosition = (player, slotPos) => passung(player, slotPos) > 0;

/* ── Verbund ───────────────────────────────────────────────────────────────────
   Wie viele der 55 möglichen Paare standen wirklich zusammen auf dem Platz? Bei
   zufällig zusammengewürfelten Elfen sind es 1,5 % — der Bonus ist also nichts, was
   von allein passiert. Er belohnt, aus wenigen Kadern zu draften, und macht aus dem
   Einsammeln großer Namen das Bauen einer Mannschaft, die es hätte geben können. */
/**
 * Das Mitspielernetz für den Draft — gebaut aus `cp`, den datierten Stationen bei den
 * 47 Spielvereinen.
 *
 * NICHT aus careerPathClubs, obwohl das mehr Vereine kennt: Dort stehen nur 2.005
 * Spieler, die Draft-Pools sind aber größer (Bundesliga 1.003, Premier League 1.452,
 * La Liga 920). Wer dort fehlt, brächte NIE Verbund — ein unsichtbarer Malus, den
 * niemand am Spieler erkennen kann. `cp` hat dagegen jeder, der überhaupt gezogen
 * werden kann; genau darüber kam er ja in seinen Kader. Der Preis ist, dass
 * gemeinsame Jahre bei einem kleinen Verein nicht zählen. Lieber eine Lücke, die für
 * alle gleich ist, als eine, die einzelne Spieler heimlich entwertet.
 */
export function baueVerbundNetz(players, ziehungen) {
  const pool = [...new Set(ziehungen.flatMap((z) => z.spieler))];
  const proVerein = new Map();
  for (const i of pool) {
    for (const [c, von, bis] of players[i].cp || []) {
      if (!proVerein.has(c)) proVerein.set(c, []);
      proVerein.get(c).push({ i, von, bis: bis === 0 ? 2026 : bis });
    }
  }
  const nachbarn = new Map(pool.map((i) => [i, new Set()]));
  for (const gruppe of proVerein.values()) {
    for (let a = 0; a < gruppe.length; a++) {
      for (let b = a + 1; b < gruppe.length; b++) {
        const x = gruppe[a], y = gruppe[b];
        if (x.i === y.i) continue;
        /* Dieselbe Bedingung wie in „Sechs Ecken": Die Zeiträume müssen sich
           ÜBERSCHNEIDEN. Ohne sie wäre Beckenbauer ein Mitspieler von Musiala. */
        if (Math.max(x.von, y.von) > Math.min(x.bis, y.bis)) continue;
        nachbarn.get(x.i).add(y.i);
        nachbarn.get(y.i).add(x.i);
      }
    }
  }
  return { nachbarn };
}

export function verbundPaare(elf, netz) {
  let n = 0;
  for (let a = 0; a < elf.length; a++) {
    for (let b = a + 1; b < elf.length; b++) {
      const i = elf[a], j = elf[b];
      if (i == null || j == null) continue;
      if (netz?.nachbarn?.get(i)?.has(j)) n++;
    }
  }
  return n;
}

/* Der Bonus wächst mit der Wurzel: Die ersten verbundenen Paare sollen spürbar
   zählen, ein Kader, aus dem man zehn Leute nimmt, aber nicht alles überstrahlen. */
export const VERBUND_MAX = 9;
export const verbundBonus = (paare) => Math.min(VERBUND_MAX, Math.round(Math.sqrt(paare) * 2.6 * 10) / 10);

/**
 * Die Wertung einer Elf.
 *
 * @param elf     je Slot `{ i, jahr }` oder null — das JAHR gehört dazu, weil ein
 *                Spieler in verschiedenen Saisons verschieden stark ist. Wer nur den
 *                Index führte, bekäme für Lewandowski 2014 und 2026 dieselbe Zahl.
 * @param slots   Positionsschlüssel je Slot
 */
export function bewerte(elf, slots, players, klassen, netz) {
  let summe = 0;
  const je = elf.map((e, k) => {
    if (e == null) return null;
    const kl = klasseIn(klassen, players, e.i, e.jahr);
    const pa = passung(players[e.i], slots[k]);
    const wert = kl * pa;
    summe += wert;
    return { i: e.i, jahr: e.jahr, klasse: kl, passung: pa, wert: Math.round(wert * 10) / 10 };
  });
  const schnitt = elf.length ? summe / elf.length : 0;
  const paare = verbundPaare(elf.filter((e) => e != null).map((e) => e.i), netz);
  const bonus = verbundBonus(paare);
  return {
    je,
    klasseSchnitt: Math.round(schnitt * 10) / 10,
    paare,
    bonus,
    wertung: Math.round((schnitt + bonus) * 10) / 10,
  };
}

/* ── Obergrenze ────────────────────────────────────────────────────────────────
   Was ist in DIESER Liga mit DIESER Formation überhaupt erreichbar? Die Frage muss
   gestellt werden, weil die Ligen ungleich sind: Mit einer festen Marke holte bestes
   Spiel in La Liga 25 % makellose Saisons, in der Bundesliga 3 % — La Ligas Pool ist
   kleiner und auf zwei Vereine konzentriert, die Spitze liegt dichter beieinander.

   Gerechnet wird die beste ERREICHBARE Elf: Positionen der Reihe nach besetzt,
   knappste zuerst, jeder Spieler nur einmal. Eine erste Fassung nahm je Position den
   besten Spieler OHNE diese Einschränkung — dadurch lag die Marke über allem, was
   eine echte Elf leisten kann, und die makellose Saison war wieder unerreichbar.

   Dazu kommt der volle Verbund. Beides zugleich zu holen — die stärksten Spieler UND
   lauter Mitspieler — ist praktisch ausgeschlossen, und genau dort soll die makellose
   Saison liegen.

   Gerechnet wird mit der BESTEN ziehbaren Saison je Spieler, nicht mit der
   Grundklasse: Lewandowskis Grundklasse gäbe es nur, wenn auch eine Ziehung aus
   seinen besten Jahren im Topf liegt. Was nicht gezogen werden kann, darf die Marke
   nicht anheben. */
export function obergrenze(slots, players, klassen, ziehungen) {
  /* Beste ziehbare Saison je Spieler. Ohne `ziehungen` bleibt es bei der
     Grundklasse — die Tests nutzen das für kleine, handgebaute Fälle. */
  const beste = new Map();
  if (ziehungen) {
    for (const z of ziehungen) {
      for (const i of z.spieler) {
        const k = klasseIn(klassen, players, i, z.jahr);
        if (k > (beste.get(i) ?? 0)) beste.set(i, k);
      }
    }
  } else {
    for (const [i, k] of klassen) beste.set(i, k);
  }

  /* Knappste Position zuerst: Sonst nähme der Torwart-Slot einen Spieler weg, den
     nur er brauchen kann, und die knappe Position ginge leer aus. */
  const kandidaten = slots.map((pos) => {
    const liste = [];
    for (const [i, kl] of beste) {
      const pa = passung(players[i], pos);
      if (pa) liste.push({ i, wert: kl * pa });
    }
    liste.sort((a, b) => b.wert - a.wert);
    return { pos, liste };
  }).sort((a, b) => a.liste.length - b.liste.length);

  const belegt = new Set();
  let summe = 0;
  for (const { liste } of kandidaten) {
    const nimm = liste.find((x) => !belegt.has(x.i));
    if (nimm) { belegt.add(nimm.i); summe += nimm.wert; } else summe += 50;
  }
  return Math.round((summe / slots.length + VERBUND_MAX) * 10) / 10;
}

/* Die Bilanz einer Saison steht NICHT mehr hier. Bis eben rechnete `bilanz` aus der
   Wertung direkt Siege, Unentschieden und Punkte — eine Kurve mit Exponent,
   kalibriert an 1.350 simulierten Drafts. Das ergab eine Zahl, aber kein Spiel.
   Jetzt wird die Saison in `saison.js` wirklich ausgespielt: 34 bzw. 38 Spieltage
   gegen echte Verein-Saison-Paare, jedes Ergebnis einzeln, und das Abzeichen kommt
   aus dem Tabellenplatz statt aus einem Punkteanteil. */

/* ── Ziehung ───────────────────────────────────────────────────────────────────
   Die Spins eines Tages sind NICHT zufällig, sondern aus dem Datum abgeleitet —
   dieselbe Partie für alle, wie bei allen Tagesrätseln des Spiels. Große Vereine
   kommen etwas häufiger, weil ihre Kader tiefer sind und ein dünner Kader den Spin
   verschenkt; das Vorbild macht es genauso. */
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}

export function zieh(ziehungen, seed, gezogen = []) {
  const frei = ziehungen.filter((z) => !gezogen.includes(`${z.key}|${z.jahr}`));
  const liste = frei.length ? frei : ziehungen;
  /* Gewichtet nach Kadertiefe: ein Kader mit 40 bekannten Spielern bietet für jede
     offene Stelle etwas an, einer mit elf fast nie. */
  const gewicht = liste.map((z) => Math.min(40, z.spieler.length));
  const summe = gewicht.reduce((a, b) => a + b, 0);
  let w = (hashStr(seed) / 4294967296) * summe;
  for (let i = 0; i < liste.length; i++) { w -= gewicht[i]; if (w <= 0) return liste[i]; }
  return liste[liste.length - 1];
}

/** Kann dieser Kader mindestens eine der noch offenen Stellen besetzen? */
export function bedientSlots(ziehung, players, slots, belegt) {
  return slots.some((pos, k) => belegt[k] == null
    && ziehung.spieler.some((i) => !belegt.includes(i) && darfAufPosition(players[i], pos)));
}

export const spielerSchluessel = (p) => norm(p.n) + "|" + p.by;
export { posGruppe };
