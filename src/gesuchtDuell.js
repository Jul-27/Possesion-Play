/* „Der Gesuchte" als Duell — reine Logik (kein React, kein Supabase).

   Beide sehen dasselbe Brett. Hinweise kommen von selbst, alle 12 Sekunden einer,
   für beide gleichzeitig; nach 90 Sekunden ist die Runde vorbei. Wer zuerst richtig
   rät, gewinnt sie — das entscheidet die Datenbank (gesucht_raten, Migration
   20261027_der_gesuchte.sql). Drei Versuche je Runde, ein Fehler kostet 10 Sekunden.
   Zwei Rundensiege gewinnen; eine Runde ohne Sieger wird mit neuem Brett wiederholt.

   Der Stand liegt in games.board.stand — nicht in last_move, das die
   Abgangserkennung aus veralteten Kopien neu schreibt (siehe vier.js). */
import { baueRaetsel, HINWEISE, VERSUCHE } from "./gesucht.js";

export const HINWEIS_TAKT_S = 12;
export const RUNDE_S = 90;
export const VORLAUF_S = 3;
export const AUFLOESUNG_MS = 6500;
export const SIEGE_ZIEL = 2;
/* So viele Bretter liegen bereit: zwei Siege brauchen höchstens drei entschiedene
   Runden, dazu Reserve für Runden ohne Sieger. */
export const RUNDEN_VORRAT = 7;

export const leererStand = () => ({ runde: 0, start: null, sieger: null, fehler: {}, sperre: {}, siege: {}, verlauf: [], ende: false });

/** Ein frischer Spielstand (neue Partie oder Revanche). */
export function neuesBrettDuell(players, rnd = Math.random, nachKey = null) {
  const runden = [];
  for (let i = 0; i < RUNDEN_VORRAT * 2 && runden.length < RUNDEN_VORRAT; i++) {
    const r = baueRaetsel(players, rnd, "alle", nachKey);
    if (r) runden.push(r);
  }
  return { kind: "gesucht", runden, stand: leererStand() };
}

const zahl = (o, s) => Number(o?.[s] || 0);

/** Ist die Runde vorbei? Gleiche Regel wie gesucht_vorbei in der Datenbank. */
export function rundeVorbei(stand, jetzt) {
  if (!stand?.start) return false;
  return stand.sieger != null
    || jetzt >= Date.parse(stand.start) + RUNDE_S * 1000
    || (zahl(stand.fehler, "1") >= VERSUCHE && zahl(stand.fehler, "2") >= VERSUCHE);
}

/**
 * Phase der laufenden Runde, alles in Server-Zeit (ms):
 *   warten · vorlauf { rest } · laeuft { offen, rest, naechsterIn, anteil } · aufloesung { seit }
 */
export function duellPhase(stand, jetzt) {
  if (!stand?.start) return { name: "warten" };
  const start = Date.parse(stand.start);
  if (jetzt < start) return { name: "vorlauf", rest: Math.ceil((start - jetzt) / 1000) };
  if (rundeVorbei(stand, jetzt)) {
    // endzeit setzt die Datenbank bei einem Treffer oder wenn beide keine Versuche mehr haben.
    const seit = stand.endzeit ? Date.parse(stand.endzeit) : start + RUNDE_S * 1000;
    return { name: "aufloesung", seit: Math.min(seit, jetzt) };
  }
  const vergangen = jetzt - start;
  const offen = Math.min(HINWEISE, 1 + Math.floor(vergangen / (HINWEIS_TAKT_S * 1000)));
  const naechsterIn = offen < HINWEISE ? Math.ceil(((offen * HINWEIS_TAKT_S * 1000) - vergangen) / 1000) : 0;
  return {
    name: "laeuft", offen, naechsterIn,
    rest: Math.ceil((RUNDE_S * 1000 - vergangen) / 1000),
    anteil: 1 - vergangen / (RUNDE_S * 1000),
  };
}

/** Restsperre eines Spielers in Sekunden. */
export const sperreRest = (stand, spieler, jetzt) => {
  const bis = stand?.sperre?.[spieler];
  return bis ? Math.max(0, Math.ceil((Date.parse(bis) - jetzt) / 1000)) : 0;
};

export const versucheUebrig = (stand, spieler) => Math.max(0, VERSUCHE - zahl(stand?.fehler, String(spieler)));
export const siege = (stand, spieler) => zahl(stand?.siege, String(spieler));

export const RATE_TEXT = {
  falsch: "Falsch — 10 Sekunden Pause.",
  gesperrt: "Noch gesperrt — kurz warten.",
  keine_versuche: "Keine Versuche mehr in dieser Runde.",
  vorbei: "Die Runde ist schon vorbei.",
  noch_nicht: "Gleich geht es los.",
};
