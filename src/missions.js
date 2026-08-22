/* Tagesmissionen — reine Logik (kein React).

   ENTWURFSREGEL, die alles andere bestimmt: Eine Mission darf nur verlangen, was
   sich aus dem MESSEN LÄSST, WAS OHNEHIN GESPEICHERT WIRD. Sonst müsste jeder der
   zwölf Modi Ereignisse melden — zwölf Dateien anfassen für ein Abzeichen.

   Messbar ist heute:
     pp:ch:<modus>:<datum>   Tagesaufgabe gelöst (career, odd, chain, hex, heat)
     pp:daily:<datum>        Steckbrief gespielt/gelöst (Schlüssel historisch)
     pp:eleven:<datum>       Elf des Tages, mit Zwischenstand
   Daraus lassen sich „wie viele Tagesrätsel", „wie viele verschiedene Modi" und
   „welches bestimmte Rätsel" ableiten — mehr braucht die erste Fassung nicht.

   Missionen, die feineres Wissen bräuchten (»ohne Fehlversuch«, »Combo aus vier
   Feldern«), stehen bewusst NICHT hier. Sie kommen, wenn die Modi Ereignisse
   melden — nicht vorher, sonst zeigt der Balken etwas an, das niemand misst. */
import { dailyDateStr } from "./dailyLogic.js";
import { CHALLENGE_MODES } from "./dailyChallenge.js";

const read = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };

/** Was ist heute passiert? Einmal gelesen, von allen Missionen benutzt. */
export function tagesStand(datum = dailyDateStr(), leser = read) {
  const geloest = CHALLENGE_MODES.filter((m) => leser(`pp:ch:${m}:${datum}`)?.done);
  const daily = leser(`pp:daily:${datum}`);
  const elf = leser(`pp:eleven:${datum}`);
  return {
    modi: geloest,
    dailyGeloest: !!daily?.won,
    dailyGespielt: !!daily,
    elfKomplett: !!elf?.done,
    elfFelder: (elf?.names || []).filter(Boolean).length,
    /* „Rätsel heute" zählt die Tagesaufgaben plus die zwei eigenständigen
       Tagesrätsel — für den Spieler ist der Steckbrief genauso ein Rätsel wie Heatmap. */
    raetsel: geloest.length + (daily?.won ? 1 : 0) + (elf?.done ? 1 : 0),
  };
}

/* Der Vorrat. `wert` liest nur aus dem Tagesstand — keine Mission darf eigene
   Quellen anzapfen, sonst driften Anzeige und Wirklichkeit auseinander. */
export const MISSIONEN = [
  { id: "zwei-raetsel", text: "Löse zwei Tagesrätsel",            ziel: 2, xp: 40, wert: (s) => s.raetsel },
  { id: "drei-raetsel", text: "Löse drei Tagesrätsel",            ziel: 3, xp: 60, wert: (s) => s.raetsel },
  { id: "drei-modi",    text: "Spiele in drei verschiedenen Modi", ziel: 3, xp: 50, wert: (s) => s.modi.length },
  { id: "daily",        text: "Löse den Steckbrief",              ziel: 1, xp: 40, wert: (s) => (s.dailyGeloest ? 1 : 0) },
  { id: "elf",          text: "Stelle die Elf des Tages komplett", ziel: 1, xp: 50, wert: (s) => (s.elfKomplett ? 1 : 0) },
  { id: "elf-halb",     text: "Besetze sechs Positionen in der Elf", ziel: 6, xp: 30, wert: (s) => s.elfFelder },
  { id: "heatmap",      text: "Fülle ein Heatmap-Board",          ziel: 1, xp: 40, wert: (s) => (s.modi.includes("heat") ? 1 : 0) },
  { id: "kette",        text: "Löse die Tagesaufgabe der Fußball-Kette", ziel: 1, xp: 40, wert: (s) => (s.modi.includes("chain") ? 1 : 0) },
];

/* Drei Missionen des Tages, aus dem Datum abgeleitet — für alle gleich, ohne Server.
   Sie dürfen sich nicht überschneiden: „zwei Rätsel" und „drei Rätsel" nebeneinander
   wäre eine Mission zu viel und eine Aufgabe zu wenig. */
const SCHLIESST_AUS = [["zwei-raetsel", "drei-raetsel"], ["elf", "elf-halb"]];

export function missionenDesTages(rnd, vorrat = MISSIONEN) {
  const rest = [...vorrat];
  const out = [];
  while (out.length < 3 && rest.length) {
    const m = rest.splice(Math.floor(rnd() * rest.length), 1)[0];
    out.push(m);
    for (const paar of SCHLIESST_AUS) {
      if (!paar.includes(m.id)) continue;
      for (const anderer of paar) {
        const i = rest.findIndex((x) => x.id === anderer);
        if (i >= 0) rest.splice(i, 1);
      }
    }
  }
  return out;
}

/** Fortschritt einer Mission gegen den Tagesstand. */
export function fortschritt(mission, stand) {
  const jetzt = Math.min(mission.ziel, mission.wert(stand));
  return { jetzt, ziel: mission.ziel, fertig: jetzt >= mission.ziel, anteil: jetzt / mission.ziel };
}

/** XP aus erledigten Missionen — fließt in die Gesamt-XP ein. */
export function missionsXp(missionen, stand) {
  return missionen.reduce((s, m) => s + (fortschritt(m, stand).fertig ? m.xp : 0), 0);
}
