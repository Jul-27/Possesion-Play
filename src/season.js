/* Saison für die Bestenliste — reine Logik (kein React, kein Supabase).

   WOZU: Die Bestenliste ist tagesaktuell — morgen ist alles weg. Wer gestern
   gewonnen hat, hat heute nichts davon, und wer einen Tag verpasst, verliert
   nichts. Damit fehlt genau der Bogen, der einen Freundeskreis über Wochen bei
   der Stange hält.

   EINE SAISON DAUERT VIER WOCHEN. Kurz genug, dass ein schlechter Start nicht die
   Laune verdirbt, lang genug, dass Beständigkeit sich auszahlt.

   AUF- UND ABSTIEG OHNE SERVERZUSTAND: Die Liga ergibt sich aus den SAISONPUNKTEN
   über Schwellen, nicht aus dem Tabellenplatz. Das ist bewusst so:
   · Ein Platz-basierter Auf-/Abstieg bräuchte eine gespeicherte Liga je Spieler
     und einen Lauf am Saisonende, der sie verschiebt — beides Infrastruktur, die
     bei fünf Freunden nichts besser macht.
   · Über Schwellen steigt jeder, der spielt, und wer aussetzt, startet die nächste
     Saison wieder unten. Das FÜHLT sich wie Auf- und Abstieg an und rechnet sich
     aus Zahlen, die ohnehin in der Datenbank stehen.
   Der Unterschied zur echten Liga: Man steigt nicht auf Kosten eines anderen ab.
   Für einen Freundeskreis ist das eher ein Vorteil. */

/** Erster Tag der ersten Saison. Bewusst ein Montag. */
export const SAISON_START = "2026-08-03";
export const SAISON_TAGE = 28;

const TAG = 86400000;
const alsTag = (s) => Date.parse(s + "T00:00:00Z");
const alsText = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Laufende Saisonnummer, beginnend bei 1. */
export function saisonNummer(datum) {
  const tage = Math.floor((alsTag(datum) - alsTag(SAISON_START)) / TAG);
  return Math.floor(tage / SAISON_TAGE) + 1;
}

/** Zeitraum der Saison, in der `datum` liegt — plus wie viele Tage noch bleiben. */
export function saisonSpanne(datum) {
  const nummer = saisonNummer(datum);
  const von = alsTag(SAISON_START) + (nummer - 1) * SAISON_TAGE * TAG;
  const bis = von + (SAISON_TAGE - 1) * TAG;
  return {
    nummer,
    von: alsText(von),
    bis: alsText(bis),
    tagImZeitraum: Math.floor((alsTag(datum) - von) / TAG) + 1,
    resttage: Math.floor((bis - alsTag(datum)) / TAG) + 1,
  };
}

/* Ligen nach Saisonpunkten. Die Schwellen sind an dem geeicht, was in vier Wochen
   erreichbar ist: Ein Tagesrätsel bringt grob 60–100 Punkte, wer fast täglich eines
   löst, landet also im oberen Drittel. Die Champions League bleibt ein Ausreißer
   für jemanden, der wirklich alle Modi täglich spielt. */
export const LIGEN = [
  { ab: 0,    name: "Kreisliga",        kurz: "KL" },
  { ab: 400,  name: "Landesliga",       kurz: "LL" },
  { ab: 900,  name: "Regionalliga",     kurz: "RL" },
  { ab: 1600, name: "2. Bundesliga",    kurz: "2BL" },
  { ab: 2600, name: "Bundesliga",       kurz: "BL" },
  { ab: 4000, name: "Champions League", kurz: "CL" },
];

/** Liga zu einer Punktzahl, mit Fortschritt zur nächsten. */
export function ligaFuer(punkte) {
  let i = 0;
  while (i + 1 < LIGEN.length && punkte >= LIGEN[i + 1].ab) i++;
  const jetzt = LIGEN[i], naechste = LIGEN[i + 1] || null;
  if (!naechste) return { ...jetzt, nummer: i + 1, naechste: null, bisNaechste: 0, anteil: 1 };
  return {
    ...jetzt,
    nummer: i + 1,
    naechste,
    bisNaechste: naechste.ab - punkte,
    anteil: Math.min(1, Math.max(0, (punkte - jetzt.ab) / (naechste.ab - jetzt.ab))),
  };
}

/* Tabelle aus den Rohzeilen der Datenbank. Sortiert nach Punkten, bei Gleichstand
   entscheidet, wer an MEHR TAGEN gespielt hat — Beständigkeit vor einem Glückstag. */
export function tabelle(zeilen, meinClient) {
  return [...zeilen]
    .sort((a, b) => (b.punkte - a.punkte) || (b.tage - a.tage) || String(a.name).localeCompare(String(b.name), "de"))
    .map((z, i) => ({ ...z, platz: i + 1, ichSelbst: z.client_id === meinClient, liga: ligaFuer(z.punkte) }));
}
