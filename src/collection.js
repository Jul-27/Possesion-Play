/* Sammlung — reine Logik (kein React).

   Die Idee: Wer einen Spieler im Spiel korrekt nennt, schaltet dessen Karte frei.
   Aus 31.565 Datensätzen, die bisher nur Nachschlagewerk waren, wird damit Inhalt.

   WARUM DIESES FEATURE ALS EINZIGES DIE MODI ANFASST: Missionen und Abzeichen
   ließen sich aus vorhandenen Statistiken rechnen. Hier geht das nicht — nirgends
   steht, WELCHE Spieler jemand genannt hat, und aus Zählern lässt sich das nicht
   rekonstruieren. Also melden die Modi es. Der Eingriff bleibt minimal: eine
   einzige Funktion, aufgerufen an der Stelle, an der ein Zug ohnehin als richtig
   gilt. Keine Modus-Logik ändert sich dadurch.

   EHRLICHE FOLGE: Die Sammlung startet leer. Anders als bei den Abzeichen gibt es
   nichts rückwirkend — was vor dieser Version gespielt wurde, ist nicht
   nachvollziehbar. Lieber leer und wahr als aufgefüllt und geraten.

   SPEICHER: eine Liste von Schlüsseln (norm(name)|geburtsjahr), dieselbe Form wie
   überall sonst im Projekt. Auch 2000 Karten bleiben damit unter 50 KB. */
import { norm } from "./gameData.js";

export const SAMMLUNG_KEY = "pp:sammlung";

const lesen = () => { try { return JSON.parse(localStorage.getItem(SAMMLUNG_KEY) || "[]"); } catch { return []; } };
const schreiben = (liste) => { try { localStorage.setItem(SAMMLUNG_KEY, JSON.stringify(liste)); } catch { /* ohne Sammlung weiter */ } };

export const spielerSchluessel = (p) => (p ? norm(p.n) + "|" + p.by : "");

/** Alle freigeschalteten Schlüssel als Menge. */
export const gesammelt = () => new Set(lesen());

/* Einen Spieler freischalten. Liefert true, wenn er NEU ist — daran hängt die
   Rückmeldung im Spiel („Neue Karte!"), die es sonst bei jedem zweiten Zug gäbe. */
export function merkeSpieler(player, speicher = { lesen, schreiben }) {
  const key = spielerSchluessel(player);
  if (!key) return false;
  const liste = speicher.lesen();
  if (liste.includes(key)) return false;
  speicher.schreiben([...liste, key]);
  return true;
}

/* Seltenheit. Sie richtet sich nach der Bekanntheit (sl) — UMGEKEHRT zur Intuition:
   Wer einen unbekannten Spieler aus dem Gedächtnis nennt, hat mehr geleistet als
   jemand, der Messi tippt. Deshalb ist „Geheimtipp" die wertvollste Stufe.
   Die Grenzen entsprechen denen, die die Modi ohnehin verwenden (START_SL_MIN 45,
   CAREER_SL_MIN 40, Bot-Stufen 25/55). */
export const STUFEN = [
  { key: "weltstar",   name: "Weltstar",   ab: 70, ton: "#FACC15" },
  { key: "star",       name: "Star",       ab: 50, ton: "#22D3EE" },
  { key: "profi",      name: "Profi",      ab: 30, ton: "#A78BFA" },
  { key: "geheimtipp", name: "Geheimtipp", ab: 0,  ton: "#34D399" },
];

export const stufeVon = (player) => STUFEN.find((s) => (player?.sl || 0) >= s.ab) || STUFEN[STUFEN.length - 1];

/** Karten eines Spielerdatensatzes, gefiltert und sortiert. */
export function karten(players, menge = gesammelt(), filter = {}) {
  const { nation = null, stufe = null, suche = "" } = filter;
  const q = norm(String(suche).trim());
  return players
    .filter((p) => menge.has(spielerSchluessel(p)))
    .filter((p) => !nation || (p.nat || []).includes(nation))
    .filter((p) => !stufe || stufeVon(p).key === stufe)
    .filter((p) => !q || norm(p.n).includes(q))
    // bekannteste zuerst — die erkennt man beim Durchblättern wieder
    .sort((a, b) => (b.sl || 0) - (a.sl || 0) || a.n.localeCompare(b.n, "de"));
}

/** Kennzahlen für die Übersicht: gesamt, je Stufe, je Nation. */
export function sammlungStand(players, menge = gesammelt()) {
  const meine = players.filter((p) => menge.has(spielerSchluessel(p)));
  const jeStufe = Object.fromEntries(STUFEN.map((s) => [s.key, 0]));
  const jeNation = new Map();
  for (const p of meine) {
    jeStufe[stufeVon(p).key]++;
    for (const n of p.nat || []) jeNation.set(n, (jeNation.get(n) || 0) + 1);
  }
  return {
    anzahl: meine.length,
    gesamt: players.length,
    jeStufe,
    // bei Gleichstand alphabetisch, sonst hinge die Reihenfolge an der
    // Einfügereihenfolge und spränge zwischen zwei Aufrufen
    nationen: [...jeNation.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    anteil: players.length ? meine.length / players.length : 0,
  };
}
