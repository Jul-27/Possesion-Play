/* „Vier Wappen des Tages" — Solo, reine Logik (kein React).

   Dieselben Regeln wie im Duell (vier.js), nur allein und für alle gleich: fünf
   Runden aus dem Tageszufall, je 30 Sekunden, ein Spieler pro Runde, ein Punkt je
   Verein. Höchstens 20 Punkte. Danach frei weiterspielen mit Zufallsvereinen.

   ── WANN DER TAG ALS GELÖST ZÄHLT ────────────────────────────────────────────
   Ab der Hälfte der möglichen Punkte. Die Tagesserie (dailyChallenge.js) braucht ein
   Gewonnen/Verloren; „überhaupt gespielt" wäre keine Leistung, „alles richtig" kaum
   erreichbar — jede Gruppe hat zwar einen Spieler mit drei Treffern, aber nicht mehr.

   ── NEU LADEN ────────────────────────────────────────────────────────────────
   Der Fortschritt des Tages liegt im Browser (pp:vierTag:<datum>). Eine Runde gilt ab
   dem Aufdecken als begonnen: Wer dann neu lädt, bekommt für sie null Punkte — sonst
   ließen sich die Vereine ansehen, die Seite neu laden und in Ruhe nachdenken. */
import { ziehung, treffer, RUNDEN } from "./vier.js";
import { dailyRnd } from "./dailyChallenge.js";
import { buildShare, bar } from "./share.js";

export const MAX_PUNKTE = RUNDEN * 4;
export const GELOEST_AB = MAX_PUNKTE / 2;

/** Die fünf Runden des Tages — für alle dieselben. */
export const tagesRunden = (players, datum) => ziehung(players, dailyRnd("vier", datum), RUNDEN);

/** Ergebnis einer Runde: { key, name, punkte } oder { key: null, punkte: 0 } (keine Wahl). */
export function rundenErgebnis(player, vereine, key) {
  if (!player) return { key: null, name: null, punkte: 0 };
  return { key, name: player.n, punkte: treffer(player, vereine).length };
}

export const summe = (ergebnisse) => ergebnisse.reduce((s, e) => s + (e?.punkte || 0), 0);
export const geloest = (punkte) => punkte >= GELOEST_AB;

/** Punkte für die Bestenliste — dieselbe 0–100-Skala wie die anderen Tagesrätsel. */
export const bestenlistenPunkte = (punkte) => Math.max(0, Math.min(100, Math.round(punkte * 100 / MAX_PUNKTE)));

/* ── Fortschritt des Tages ───────────────────────────────────────────────────
   { ergebnisse: [Ergebnis, …], begonnen: Rundenindex | null }. Rein: die Ansicht
   liest und schreibt localStorage, die Regeln stehen hier. */
export const leererTag = () => ({ ergebnisse: [], begonnen: null });

/** Beim Öffnen: Eine aufgedeckte, aber unbeantwortete Runde zählt null. */
export function tagFortsetzen(tag) {
  const t = tag && Array.isArray(tag.ergebnisse) ? { ergebnisse: [...tag.ergebnisse], begonnen: tag.begonnen ?? null } : leererTag();
  if (t.begonnen != null && t.begonnen === t.ergebnisse.length) t.ergebnisse.push({ key: null, name: null, punkte: 0, abgebrochen: true });
  t.begonnen = null;
  return t;
}

export const rundeBegonnen = (tag, i) => ({ ...tag, begonnen: i });
export const rundeBeendet = (tag, ergebnis) => ({ ergebnisse: [...tag.ergebnisse, ergebnis], begonnen: null });
export const tagFertig = (tag) => (tag?.ergebnisse?.length || 0) >= RUNDEN;

/** Teilen: eine Zeile je Runde als Wappenbalken, die Namen bleiben geheim. */
export function teilenText(nummer, ergebnisse) {
  const p = summe(ergebnisse);
  return buildShare({
    solo: "vier",
    title: `🛡️ Vier Wappen #${nummer} · ${p}/${MAX_PUNKTE}`,
    lines: [ergebnisse.map((e) => bar(e?.punkte || 0, 4, "🟩", "⬛")).join(" ")],
  });
}
