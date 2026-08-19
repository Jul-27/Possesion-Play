/* Statistik-Übersicht — reine Logik (kein React).

   Jeder Modus hat seinen eigenen Speicher mit eigener Form gewachsen: mal `solved`,
   mal `wins`, bei der Kette `best` als Höchstwert, im Hex-Training `bestMoves` als
   Tiefstwert. Diese Datei übersetzt alles in ein gemeinsames Format, damit die
   Übersicht nichts über die Einzelheiten wissen muss. */
import { challengeStats } from "./dailyChallenge.js";

const read = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };

// Ein Eintrag: { key, icon, name, solo, played, lines: [{ label, value }], streak }
function entry(key, icon, name, solo, raw, lines, streak) {
  return { key, icon, name, solo, played: raw?.played || 0, lines: lines.filter((l) => l.value != null), streak };
}

export function collectStats() {
  const daily = read("pp:dailyStats");
  const career = read("pp:careerStats");
  const odd = read("pp:oddStats");
  const chain = read("pp:chainStats");
  const eleven = read("pp:elevenStats");
  const solo = read("pp:soloStats");
  const heat = read("pp:heatBest");
  const carousel = read("pp:carouselStats");

  return [
    entry("daily", "🌟", "Daily-Star", null, daily, [
      { label: "gelöst", value: daily?.wins ?? null },
      { label: "Rekordserie", value: daily?.maxStreak || null },
    ], daily?.streak || 0),

    entry("eleven", "👕", "Elf des Tages", "eleven", eleven, [
      { label: "komplett", value: eleven?.solved ?? null },
    ], challengeStats("eleven")?.streak || 0),

    entry("career", "🧭", "Karriere-Pfad", "career", career, [
      { label: "gelöst", value: career?.solved ?? null },
      // best = wenigste Stationen bis zur Lösung, also je kleiner desto besser
      { label: "beste Lösung", value: career?.best ? `${career.best} Stat.` : null },
    ], challengeStats("career")?.streak || 0),

    entry("odd", "🧩", "Wer passt nicht?", "odd", odd, [
      { label: "richtig", value: odd?.solved ?? null },
      { label: "Rekordserie", value: odd?.best || null },
    ], challengeStats("odd")?.streak || 0),

    entry("chain", "⛓️", "Fußball-Kette", "chain", chain, [
      { label: "längste Kette", value: chain?.best || null },
      { label: "Glieder gesamt", value: chain?.total || null },
    ], challengeStats("chain")?.streak || 0),

    /* Heatmap und Transferkarussell fehlten hier von Anfang an — beide speichern
       längst Werte (pp:heatBest, pp:carouselStats), tauchten in der Übersicht aber
       nicht auf. */
    entry("heat", "🔥", "Heatmap", "heat", heat, [
      { label: "Bestwert", value: heat?.score ? `${heat.score} Punkte` : null },
      { label: "Dichte", value: heat?.density ? heat.density.toFixed(2) : null },
    ], challengeStats("heat")?.streak || 0),

    entry("carousel", "🎠", "Transferkarussell", "carousel", carousel, [
      { label: "gewonnen", value: carousel?.won ?? null },
      { label: "längste Kette", value: carousel?.bestChain || null },
    ], 0),

    entry("hex", "🎯", "Hex-Training", "hex", solo, [
      { label: "Bestwert", value: solo?.bestMoves ? `${solo.bestMoves} Züge` : null },
      { label: "perfekt", value: solo?.perfect || null },
    ], challengeStats("hex")?.streak || 0),
  ];
}

// Kopfzahlen über alle Modi.
export function totals(entries = collectStats()) {
  return {
    played: entries.reduce((s, e) => s + e.played, 0),
    modes: entries.filter((e) => e.played > 0).length,
    bestStreak: entries.reduce((m, e) => Math.max(m, e.streak || 0), 0),
  };
}

export const hasAnyStats = (entries = collectStats()) => entries.some((e) => e.played > 0);
