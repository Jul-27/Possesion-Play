/* „Sechs Ecken" — reine Logik (kein React).

   Verbinde zwei Spieler über gemeinsame Mitspieler: Jeder genannte Spieler muss mit
   dem vorherigen GLEICHZEITIG beim selben Verein gespielt haben.

   WAS DEN MODUS VON ALLEN ANDEREN UNTERSCHEIDET: Er ist ein Suchproblem. Die
   übrigen Modi fragen ab oder lassen schließen; hier muss man einen Weg planen und
   dabei von beiden Enden her denken.

   DIE KANTE IST DAS ENTSCHEIDENDE. Zwei Spieler sind verbunden, wenn sich ihre
   Zeiträume beim selben Verein ÜBERSCHNEIDEN. Ohne die Jahresprüfung wäre Beckenbauer
   ein Mitspieler von Musiala (beide FC Bayern) und das Netz zerfiele zu Brei: Jeder
   wäre über zwei Ecken mit jedem verbunden.

   GEMESSEN am Pool (Spieler mit datierten Stationen und sl >= 50):
     1.022 Spieler · Median 43 Mitspieler · 89,7 % in einem zusammenhängenden Netz
     mittlerer Abstand 2,47 Schritte, größter 7.
   Dicht genug, dass fast jedes Paar verbunden ist; weit genug, dass es nicht trivial
   wird. */
import { norm } from "./gameData.js";
import { kanonischerVereinsname } from "./clubNames.js";

export const ECKEN_SL_MIN = 50;      // Pool: bekannt genug, dass man sie nennen kann
export const ECKEN_ZIEL_ABSTAND = 3; // Tagesrätsel: so viele Schritte auf dem kürzesten Weg
export const ECKEN_TIPP_AB = 3;      // ab so vielen Fehlversuchen gibt es einen Hinweis

const spielerSchluessel = (p) => norm(p.n) + "|" + p.by;
const ENDE = (bis) => (bis === 0 ? 9999 : bis);   // 0 heißt „bis heute"

/** Überschneiden sich zwei Zeiträume beim selben Verein? */
export const ueberlappt = (a, b) =>
  a.club === b.club && Math.max(a.von, b.von) <= Math.min(ENDE(a.bis), ENDE(b.bis));

/**
 * Das Mitspieler-Netz.
 *
 * Der Aufbau geht ÜBER DIE VEREINE, nicht über alle Paare: 1.022 Spieler wären eine
 * halbe Million Vergleiche, von denen fast alle an unterschiedlichen Vereinen
 * scheitern. Nach Verein gruppiert bleiben nur Vergleiche innerhalb einer
 * Mannschaft — dieselbe Zahl an Kanten, ein Bruchteil der Arbeit.
 */
export function baueNetz(players, dated, slMin = ECKEN_SL_MIN) {
  const knoten = [];
  const stationen = new Map();   // Spielerindex -> [{club, von, bis}]
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if ((p.sl || 0) < slMin) continue;
    const roh = dated?.byKey?.[spielerSchluessel(p)];
    if (!roh?.length) continue;
    knoten.push(i);
    stationen.set(i, roh.map(([c, von, bis]) => ({ club: c, von, bis })));
  }

  const proVerein = new Map();
  for (const i of knoten) {
    for (const s of stationen.get(i)) {
      if (!proVerein.has(s.club)) proVerein.set(s.club, []);
      proVerein.get(s.club).push(i);
    }
  }

  const nachbarn = new Map(knoten.map((i) => [i, new Set()]));
  for (const gruppe of proVerein.values()) {
    const eindeutig = [...new Set(gruppe)];
    for (let a = 0; a < eindeutig.length; a++) {
      for (let b = a + 1; b < eindeutig.length; b++) {
        const i = eindeutig[a], j = eindeutig[b];
        if (nachbarn.get(i).has(j)) continue;
        if (!stationen.get(i).some((x) => stationen.get(j).some((y) => ueberlappt(x, y)))) continue;
        nachbarn.get(i).add(j);
        nachbarn.get(j).add(i);
      }
    }
  }
  return { knoten, nachbarn, stationen, clubs: dated?.clubs || [] };
}

/** Die gemeinsame Station zweier Spieler, oder null. Für die Rückmeldung im Spiel. */
export function gemeinsameStation(netz, i, j) {
  const a = netz.stationen.get(i) || [], b = netz.stationen.get(j) || [];
  let beste = null;
  for (const x of a) for (const y of b) {
    if (!ueberlappt(x, y)) continue;
    const von = Math.max(x.von, y.von);
    const bis = Math.min(ENDE(x.bis), ENDE(y.bis));
    /* Die LÄNGSTE Überschneidung nennen: Wer zwei Spells beim selben Verein teilt,
       soll den bedeutenderen zu sehen bekommen, nicht den zufällig ersten. */
    if (!beste || bis - von > beste.bis - beste.von) {
      /* Über kanonischerVereinsname, damit hier „AC Mailand" steht wie überall sonst
         im Spiel und nicht Wikidatas „AC Milan". */
      beste = { club: kanonischerVereinsname(netz.clubs[x.club] || String(x.club)), von, bis: bis === 9999 ? 0 : bis };
    }
  }
  return beste;
}

export const sindMitspieler = (netz, i, j) => !!netz.nachbarn.get(i)?.has(j);

/** Kürzester Weg als Spielerindizes, einschließlich beider Enden. Leer, wenn keiner. */
export function kuerzesterWeg(netz, von, nach) {
  if (von === nach) return [von];
  const vorgaenger = new Map([[von, null]]);
  let rand = [von];
  while (rand.length) {
    const naechster = [];
    for (const v of rand) {
      for (const w of netz.nachbarn.get(v) || []) {
        if (vorgaenger.has(w)) continue;
        vorgaenger.set(w, v);
        if (w === nach) {
          const weg = [w];
          for (let x = v; x != null; x = vorgaenger.get(x)) weg.unshift(x);
          return weg;
        }
        naechster.push(w);
      }
    }
    rand = naechster;
  }
  return [];
}

/** Abstände von einem Startknoten aus — Grundlage für die Paarwahl und für Hinweise. */
export function abstaende(netz, von) {
  const dist = new Map([[von, 0]]);
  let rand = [von];
  while (rand.length) {
    const naechster = [];
    for (const v of rand) for (const w of netz.nachbarn.get(v) || []) {
      if (dist.has(w)) continue;
      dist.set(w, dist.get(v) + 1);
      naechster.push(w);
    }
    rand = naechster;
  }
  return dist;
}

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}

/**
 * Das Paar des Tages: deterministisch, mit dem gewünschten Abstand, beide Enden
 * bekannt genug zum Nennen.
 *
 * Gewählt wird nur aus den BEKANNTESTEN Spielern als Startpunkt (die Enden nennt das
 * Rätsel selbst, sie müssen also auf Anhieb etwas sagen), das Ziel dann aus allen im
 * passenden Abstand. Findet sich kein Paar mit dem Wunschabstand, wird schrittweise
 * gelockert statt aufzugeben.
 */
export function paarDesTages(datum, players, netz, wunsch = ECKEN_ZIEL_ABSTAND) {
  const prominent = netz.knoten
    .filter((i) => (players[i].sl || 0) >= 70)
    .sort((a, b) => (players[b].sl || 0) - (players[a].sl || 0));
  const liste = prominent.length >= 20 ? prominent : netz.knoten;
  if (!liste.length) return null;

  for (const abstand of [wunsch, wunsch + 1, wunsch - 1, wunsch + 2]) {
    if (abstand < 2) continue;
    for (let versuch = 0; versuch < 60; versuch++) {
      const von = liste[hashStr(`ecken:${datum}#${abstand}#${versuch}`) % liste.length];
      const dist = abstaende(netz, von);
      const ziele = [...dist.entries()]
        .filter(([i, d]) => d === abstand && (players[i].sl || 0) >= 70)
        .map(([i]) => i)
        .sort((a, b) => a - b);
      if (!ziele.length) continue;
      const nach = ziele[hashStr(`ecken:${datum}#ziel#${abstand}#${versuch}`) % ziele.length];
      return { von, nach, par: abstand };
    }
  }
  return null;
}

/* ── Spielstand ────────────────────────────────────────────────────────────────
   Die Kette beginnt beim Startspieler. Gelöst ist sie, sobald ihr letztes Glied ein
   Mitspieler des Ziels ist — das Ziel selbst muss man nicht mehr nennen. */

export const ECKEN_MAX = 8;   // so viele Zwischenschritte, dann ist Schluss

export function pruefeSchritt(netz, kette, kandidat, nach) {
  if (kandidat == null) return { fehler: "Diesen Spieler gibt es im Pool nicht." };
  if (kette.includes(kandidat) || kandidat === nach) return { fehler: "Den hattest du schon." };
  const letzter = kette[kette.length - 1];
  const station = gemeinsameStation(netz, letzter, kandidat);
  if (!station) return { fehler: "kein-mitspieler", station: null };
  return { ok: true, station, schliesst: sindMitspieler(netz, kandidat, nach) };
}

/** Zeitraum als Text: „Real Madrid, 2015–2018" bzw. „… seit 2021". */
export function stationText(station) {
  if (!station) return "";
  return station.bis ? `${station.club}, ${station.von}–${station.bis}` : `${station.club}, seit ${station.von}`;
}

/* ── Teilen ────────────────────────────────────────────────────────────────────
   Gezeigt wird die LÄNGE, nicht der Weg — sonst verrät die geteilte Nachricht die
   Lösung an alle, die noch spielen wollen. */
export function shareText(nummer, von, nach, schritte, par, url) {
  const kopf = `Sechs Ecken #${nummer}`;
  const wie = schritte == null ? "aufgegeben 💀"
    : schritte <= par ? `${schritte} Schritte ✨ (Bestweg)`
      : `${schritte} Schritte (Bestweg ${par})`;
  return `${kopf}\n${von} → ${nach}\n${wie}\n${url}`;
}
