/* „Vier Wappen" — Duell, reine Logik (kein React, kein Supabase).

   Vier bekannte Vereine, beide Spieler gleichzeitig 30 Sekunden: Wer nennt einen
   Spieler, der bei möglichst vielen davon war? Ein Punkt je Verein. Derselbe Spieler
   kann in einer Runde nur einmal vergeben werden — wer zuerst bestätigt, bekommt ihn;
   das entscheidet die Datenbank (supabase/migrations/20261017_vier_wappen.sql).

   Fünf Runden, wer mehr Punkte hat, gewinnt; bei Gleichstand Entscheidungsrunden, bis
   einer vorn liegt. (Owner-Entwurf vom 17.10.2026.)

   ── DER STAND ────────────────────────────────────────────────────────────────
   Liegt in games.board — NICHT in last_move. Die Abgangserkennung (usePresence)
   schreibt last_move beim Schließen eines Tabs komplett neu, aus einer womöglich
   veralteten Kopie; eine gerade getroffene Wahl des Gegners ginge dabei verloren.
     board = { kind: "vier", runden: [[k1, k2, k3, k4], …], stand }
     stand = { runde, start, wahl: { "1": Wahl, "2": Wahl }, verlauf: [wahl, …], ende }
     Wahl  = { key: "norm(name)|jahr", name, zeit } */
import { CLUBS, norm } from "./gameData.js";

export const VIER_SEKUNDEN = 30;
export const VORLAUF_SEKUNDEN = 3;       // so lange stehen „Runde 2" und der Countdown
export const AUFLOESUNG_MS = 5500;       // so lange steht die Auflösung, dann geht es weiter
export const RUNDEN = 5;
export const VORRAT = 12;                // gezogene Runden: fünf plus Entscheidungsrunden
/* Ab dieser Bekanntheit zählt ein Spieler für die Prüfung, ob eine Vierergruppe
   spielbar ist. Gemessen am 17.10.2026: Mit allen 47 Spielvereinen gab es dann in
   49 % der Gruppen höchstens zwei Treffer — solche Gruppen werden verworfen. */
export const BEKANNT_AB = 20;
export const MIN_BESTER_TREFFER = 3;

export const VIER_VEREINE = CLUBS.map((c) => c.key);

/** Schlüssel eines Spielers — derselbe wie in Meldungen und Sammlung. */
export const spielerKey = (p) => (p ? `${norm(p.n)}|${p.by}` : "");

/** Welche der Vereine trägt der Spieler? */
export const treffer = (player, vereine) => vereine.filter((k) => (player?.clubs || []).includes(k));

/** Der beste Spieler einer Runde (meiste Treffer, dann der bekanntere) — für „Möglich gewesen". */
export function besterSpieler(players, vereine, ohne = new Set()) {
  let best = null, bestN = 0;
  for (const p of players) {
    const n = treffer(p, vereine).length;
    if (!n || ohne.has(spielerKey(p))) continue;
    if (n > bestN || (n === bestN && (p.sl || 0) > (best.sl || 0))) { best = p; bestN = n; }
  }
  return best ? { player: best, treffer: bestN } : null;
}

/** Ist eine Vierergruppe spielbar? Mindestens ein bekannter Spieler mit drei Treffern. */
export function spielbar(players, vereine) {
  return players.some((p) => (p.sl || 0) >= BEKANNT_AB && treffer(p, vereine).length >= MIN_BESTER_TREFFER);
}

/** Zieht `anzahl` spielbare Vierergruppen. Keine Gruppe doppelt. */
export function ziehung(players, rnd = Math.random, anzahl = VORRAT, vereine = VIER_VEREINE) {
  const out = [], gesehen = new Set();
  for (let versuch = 0; out.length < anzahl && versuch < anzahl * 200; versuch++) {
    const a = [...vereine];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const vier = a.slice(0, 4);
    const sig = [...vier].sort().join(",");
    if (gesehen.has(sig) || !spielbar(players, vier)) continue;
    gesehen.add(sig);
    out.push(vier);
  }
  return out;
}

/** Ein frischer Spielstand (neue Partie oder Revanche). */
export function neuesBrett(players, rnd = Math.random) {
  return { kind: "vier", runden: ziehung(players, rnd), stand: { runde: 0, start: null, wahl: {}, verlauf: [], ende: false } };
}

/** Punkte einer Wahl in einer Runde. */
export function punkteFuer(wahl, vereine, nachKey) {
  if (!wahl) return 0;
  return treffer(nachKey.get(wahl.key), vereine).length;
}

/** Punktestand über alle abgeschlossenen Runden: { punkte: [s1, s2], runden: [{ vereine, wahl, punkte }] }. */
export function wertung(brett, nachKey) {
  const runden = (brett?.stand?.verlauf || []).map((wahl, i) => {
    const vereine = brett.runden[i] || [];
    return { vereine, wahl, punkte: [punkteFuer(wahl?.["1"], vereine, nachKey), punkteFuer(wahl?.["2"], vereine, nachKey)] };
  });
  return { punkte: runden.reduce((s, r) => [s[0] + r.punkte[0], s[1] + r.punkte[1]], [0, 0]), runden };
}

/** Nach `gespielt` Runden mit diesem Punktestand vorbei? { ende, sieger: 0|1|2 } (0 = unentschieden). */
export function spielEnde(gespielt, punkte, vorrat = VORRAT) {
  const fuehrt = punkte[0] === punkte[1] ? 0 : punkte[0] > punkte[1] ? 1 : 2;
  if (gespielt >= RUNDEN && fuehrt) return { ende: true, sieger: fuehrt };
  /* Alle gezogenen Runden verbraucht und immer noch gleich — dann ist es ein Remis.
     Bei zwölf Runden praktisch ausgeschlossen, aber eine Partie darf nie hängen. */
  if (gespielt >= vorrat) return { ende: true, sieger: fuehrt };
  return { ende: false, sieger: 0 };
}

/** Bezeichnung der Runde: „Runde 3 von 5" oder „Entscheidungsrunde". */
export const rundenTitel = (i) => (i < RUNDEN ? `Runde ${i + 1} von ${RUNDEN}` : i === RUNDEN ? "Entscheidungsrunde" : `Entscheidungsrunde ${i - RUNDEN + 1}`);

/**
 * In welcher Phase steht die laufende Runde? Alles in Server-Zeit (ms).
 *   warten     — noch kein Start (Gegner fehlt oder Start noch nicht gesetzt)
 *   vorlauf    — „Runde 2" und Countdown, Vereine noch verdeckt
 *   laeuft     — 30 Sekunden zum Wählen
 *   aufloesung — beide haben gewählt oder die Zeit ist um
 * `aufgeloestSeit` ist der Zeitpunkt, an dem die Auflösung begann (für den Weiterzug).
 */
export function phase(stand, jetzt) {
  if (!stand?.start) return { name: "warten" };
  const start = Date.parse(stand.start);
  const ende = start + VIER_SEKUNDEN * 1000;
  const w1 = stand.wahl?.["1"], w2 = stand.wahl?.["2"];
  if (jetzt < start) return { name: "vorlauf", rest: Math.ceil((start - jetzt) / 1000) };
  if (w1 && w2) return { name: "aufloesung", aufgeloestSeit: Math.max(Date.parse(w1.zeit), Date.parse(w2.zeit)) };
  if (jetzt >= ende) return { name: "aufloesung", aufgeloestSeit: ende };
  return { name: "laeuft", rest: Math.ceil((ende - jetzt) / 1000), anteil: (ende - jetzt) / (VIER_SEKUNDEN * 1000) };
}

/** Lesbarer Text zum Ergebnis einer Wahl-Anfrage an die Datenbank. */
export const WAHL_TEXT = {
  vergeben: "Schon vergeben — wähl einen anderen.",
  zu_spaet: "Zu spät — die Zeit ist um.",
  noch_nicht: "Noch nicht — gleich geht es los.",
  schon_gewaehlt: "Du hast in dieser Runde schon gewählt.",
  vorbei: "Diese Runde ist schon vorbei.",
};
