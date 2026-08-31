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
    for (let jahr = DRAFT_AB_JAHR; jahr <= jetzt; jahr++) {
      const spieler = [];
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if ((p.sl || 0) < DRAFT_SL_MIN || !p.pos) continue;
        if (jahrIn(p.cp, v.key, jahr)) spieler.push(i);
      }
      if (spieler.length < DRAFT_MIN_KADER) continue;
      const gruppen = new Set(spieler.map((i) => players[i].pos));
      if (!["TW", "ABW", "MF", "ST"].every((g) => gruppen.has(g))) continue;
      out.push({ key: v.key, name: v.name, jahr, spieler });
    }
  }
  return out;
}

/* ── Klasse ────────────────────────────────────────────────────────────────────
   Der Rangplatz im Pool, auf 50 bis 99 gestreckt. Bewusst NICHT die rohe
   Bekanntheit: die reicht von 1 bis über 200 und würde von Messi allein beherrscht.
   Als Rangplatz ist die Zahl außerdem erklärbar — „besser als 87 % des Pools". */
export function baueKlassen(players, ziehungen) {
  const imPool = [...new Set(ziehungen.flatMap((z) => z.spieler))];
  const sortiert = [...imPool].sort((a, b) => (players[a].sl || 0) - (players[b].sl || 0));
  const klasse = new Map();
  sortiert.forEach((i, rang) => {
    klasse.set(i, Math.round(50 + (49 * rang) / Math.max(1, sortiert.length - 1)));
  });
  return klasse;
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
 * @param elf     Spielerindizes je Slot, gleiche Reihenfolge wie die Formation
 * @param slots   Positionsschlüssel je Slot
 */
export function bewerte(elf, slots, players, klassen, netz) {
  let summe = 0;
  const je = elf.map((i, k) => {
    if (i == null) return null;
    const kl = klassen.get(i) ?? 50;
    const pa = passung(players[i], slots[k]);
    const wert = kl * pa;
    summe += wert;
    return { i, klasse: kl, passung: pa, wert: Math.round(wert * 10) / 10 };
  });
  const schnitt = elf.length ? summe / elf.length : 0;
  const paare = verbundPaare(elf.filter((i) => i != null), netz);
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
   Saison liegen. */
export function obergrenze(slots, players, klassen) {
  /* Knappste Position zuerst: Sonst nähme der Torwart-Slot einen Spieler weg, den
     nur er brauchen kann, und die knappe Position ginge leer aus. */
  const kandidaten = slots.map((pos) => {
    const liste = [];
    for (const [i, kl] of klassen) {
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

export const WERTUNG_UNTEN = 55;   // darunter ist jede Elf gleich chancenlos

/* Diese Obergrenze setzt freie Auswahl aus dem ganzen Pool voraus. Ein Draft sieht
   aber nur elf zufällige Kader — gemessen erreicht bestes Spiel davon 94 bis 98 %.
   Genau diese Lücke ist der Preis des Zufalls, und um sie wird die Marke gesenkt.
   Ohne die Senkung wäre die makellose Saison rechnerisch unerreichbar; mit ihr liegt
   sie am äußersten Rand sehr guten Spiels. */
export const DRAFT_ERREICHBAR = 0.92;
export const saisonMarke = (obergr) =>
  WERTUNG_UNTEN + (obergr - WERTUNG_UNTEN) * DRAFT_ERREICHBAR;

/* ── Saison ────────────────────────────────────────────────────────────────────
   Aus der Wertung wird eine Bilanz. Das ist eine SPIELWERTUNG, keine Prognose —
   nichts an unseren Daten sagt voraus, wie eine Mannschaft abschneidet. Die Kurve
   ist so gelegt, dass eine makellose Saison nur mit einer nahezu perfekten Elf
   erreichbar ist und ein durchschnittlicher Draft im Mittelfeld landet.

   Der Exponent ist der Regler: Er drückt die Siegquote im unteren Bereich, damit
   eine mittelmäßige Elf nicht schon halbe Meisterschaften einfährt. */
export function bilanz(wertung, spiele, obergr) {
  /* Gemessen an je 60 simulierten Partien mit einem Automaten, der stets den
     bestbewerteten passenden Spieler nahm:
       feste Spanne 46 -> makellos in 34 von 60 Partien, viel zu häufig
       feste Spanne 49 -> makellos in 0 von 180, ein unerreichbares Abzeichen
     Beides falsch, und mit EINER festen Spanne auch nicht zu beheben, weil die Ligen
     unterschiedlich hohe Decken haben. Deshalb wird gegen die erreichbare Obergrenze
     der jeweiligen Liga und Formation gerechnet. */
  const oben = saisonMarke(obergr || 106);
  const roh = Math.max(0, Math.min(1, (wertung - WERTUNG_UNTEN) / Math.max(1, oben - WERTUNG_UNTEN)));
  const quote = Math.pow(roh, 1.8);

  /* DIE PUNKTZAHL FÜHRT, Siege und Remis werden aus ihr abgeleitet. Andersherum
     — beide getrennt gerundet — war die Bilanz nicht monoton: Eine minimal bessere
     Elf verlor ein Unentschieden, ohne einen Sieg dazuzugewinnen, und stand mit
     weniger Punkten da. Ein Test über die ganze Wertungsspanne fängt das. */
  const punkte = Math.round(spiele * 3 * quote);

  /* Unentschieden häufen sich im Mittelfeld und verschwinden zur Spitze hin — eine
     makellose Saison hat keine. */
  const wunschRemis = Math.round(spiele * 0.34 * Math.max(0, 1 - Math.abs(quote - 0.42) / 0.58));
  /* Aus Punkten und Wunsch die Siege: Sie müssen die Punktzahl exakt tragen
     (3·Siege + Remis = Punkte) und dürfen zusammen die Saison nicht sprengen. */
  const minSiege = Math.max(0, Math.ceil((punkte - spiele) / 2));
  const maxSiege = Math.floor(punkte / 3);
  const siege = Math.min(maxSiege, Math.max(minSiege, Math.round((punkte - wunschRemis) / 3)));
  const remis = punkte - siege * 3;
  return { siege, remis, niederlagen: spiele - siege - remis, punkte, spiele };
}

/* Abzeichen als Anteil der erreichbaren Punkte — so gilt dieselbe Leiter für 34 und
   38 Spiele. „Makellos" ist der Gegenpart zum 38-0-0 des Vorbilds. */
export const ABZEICHEN = [
  { key: "makellos",  name: "Makellos",         pruef: (b) => b.siege === b.spiele },
  { key: "unbesiegt", name: "Unbesiegt",        pruef: (b) => b.niederlagen === 0 },
  { key: "rekord",    name: "Rekordmeister",    pruef: (b) => b.punkte >= b.spiele * 3 * 0.87 },
  { key: "meister",   name: "Meister",          pruef: (b) => b.punkte >= b.spiele * 3 * 0.74 },
  { key: "cl",        name: "Champions League", pruef: (b) => b.punkte >= b.spiele * 3 * 0.60 },
  { key: "el",        name: "Europa League",    pruef: (b) => b.punkte >= b.spiele * 3 * 0.50 },
  { key: "mitte",     name: "Mittelfeld",       pruef: (b) => b.punkte >= b.spiele * 3 * 0.36 },
  { key: "abstieg",   name: "Abstiegskampf",    pruef: () => true },
];

export const abzeichenFuer = (b) => ABZEICHEN.find((a) => a.pruef(b));

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
