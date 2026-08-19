#!/usr/bin/env node
/* Kuratierte Spieler, die Wikidata nicht/kaum kennt, additiv in src/players.js.
   Anlegen oder Felder ergänzen (clubs/nat/cp union; sl/pos/by setzen falls leer).
   Kein Netz. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampFixes } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

// Bestätigte Fakten (vom Owner gemeldet), die Wikidata nicht sauber liefert.
export const EXTRA_PLAYERS = [
  { n: "Gernot Trauner", by: 1992, nat: ["AUT"], clubs: ["FEY"], sl: 35, pos: "ABW", cp: [["FEY", 2021, 0]] },
  { n: "Oscar Gloukh",   by: 2004, clubs: ["AJA"], cp: [["AJA", 2025, 0]] },     // Ajax seit 2025
  { n: "Diego",          by: 1985, clubs: ["SVW"], cp: [["SVW", 2006, 2009]] },  // Werder Bremen
  { n: "Arturo Vidal",   by: 1987, clubs: ["B04"], cp: [["B04", 2007, 2011]] },  // Bayer Leverkusen
  { n: "Adam Daghim",    by: 2005, clubs: ["RBS"], cp: [["RBS", 2023, 2024]] },  // RB Salzburg
  { n: "Sergio Agüero",  by: 1988, clubs: ["ATM"], cp: [["ATM", 2006, 2011]] },  // Atlético Madrid

  // RB Salzburg: Wikidata führt bei diesen fünf gar keinen Salzburg-Eintrag (P54),
  // obwohl alle dort spielten. Nur der Vereins-Bezug wird gesetzt (das HEX-Club-Feld
  // prüft clubs[], keine Jahre); cp bleibt weg, weil sich die Spielzeiträume nicht
  // aus Wikidata belegen lassen — fehlend ist besser als geraten.
  { n: "Janis Blaswich",    by: 1991, clubs: ["RBS"] },
  { n: "Brenden Aaronson",  by: 2000, clubs: ["RBS"] },
  { n: "Noah Okafor",       by: 2000, clubs: ["RBS"] },
  { n: "Rasmus Kristensen", by: 1997, clubs: ["RBS"] },
  { n: "Maximilian Wöber",  by: 1998, clubs: ["RBS"] },

  /* Gemeldet nach einem HEX-Duell (03.08.2026), vom Owner bestätigt. Wikidata liefert
     diese Stationen nicht — nachgeprüft am Live-Stand, nicht nur in unserem Snapshot:
       Merlin Röhl (Q99752352)     führt überhaupt keinen Verein (P54 leer)
       Fábio Vieira (Q63032399)    führt Arsenal und Porto, aber keinen HSV
       Marin Pongračić (Q29427316) führt nur Bayern — Salzburg fehlt
     Die neuen Vereine (SCF/HSV) allein reparieren das also nicht; es braucht diese
     Einträge. Zeiträume (cp) bleiben weg, wo sie sich nicht belegen lassen — das
     HEX-Vereinsfeld prüft ohnehin nur clubs[]. */
  { n: "Merlin Röhl",     by: 2002, nat: ["GER"], clubs: ["SCF", "EVE"] },  // Freiburg, inzwischen Everton
  { n: "Fábio Vieira",    by: 2000, clubs: ["HSV"] },
  { n: "Marin Pongracic", by: 1997, clubs: ["RBS"] },

  /* Gemeldet über „Fehler melden" aus dem Transferkarussell-Duell (18.08.2026).
     Wikidata führt ihn als „Chikwubuike Adamu" (Q58170823) und kennt dort nur den
     FC Liefering — auch ein Voll-Refresh brächte Freiburg also nicht. de.wikipedia
     führt SC Freiburg 2023–2026 in der Karrieretabelle. */
  { n: "Junior Adamu",    by: 2001, clubs: ["SCF", "RBS"] },   // Freiburg 2023–26, Salzburg 2020–23

  /* Beim Nachziehen der vollen Karriere (wikipedia_career.mjs, 19.08.2026) gefunden:
     Waldschmidt fehlten gleich zwei Spielvereine, obwohl nur Köln gemeldet war. */
  { n: "Luca Waldschmidt", by: 1996, clubs: ["HSV", "SCF"] },  // HSV 2016–18, Freiburg 2018–20

  // Lothar Matthäus fehlte komplett: sein Wikidata-Eintrag führt als Beruf nur
  // „Fußballtrainer", nicht „Fußballspieler" (P106=Q937857) — der Roster-Filter
  // schließt ihn dadurch aus. Vereine/Titel/cp sind aus Wikidata belegt (P54 + die
  // Wettbewerbssieger seiner Spells; UEFA-Cup zählt nicht, da das Spiel nur die
  // moderne Europa League ab 2009 kennt, ebenso keine CL — die hat er nie gewonnen).
  { n: "Lothar Matthäus", by: 1961, nat: ["GER"], clubs: ["BMG", "FCB", "INT"],
    t: ["BDO", "DFB", "EM", "MBL", "MSA", "WM"], sl: 85, pos: "MF",
    cp: [["BMG", 1979, 1984], ["FCB", 1984, 1988], ["INT", 1988, 1992], ["FCB", 1992, 2000]] },
];

/* Vereine, die bei einem Spieler nachweislich falsch stehen. Gegenstück zu
   EXTRA_PLAYERS: das ergänzt, das hier nimmt weg. Schlüssel ist norm(name)|jahr —
   norm() entfernt Diakritika, „Röhl" wird also zu „rohl".

   Ein Eintrag kommt nur hinein, wenn ein Verein POSITIV WIDERLEGT ist — nicht, wenn
   eine Quelle bloß schweigt. Hier stand nämlich kurzzeitig Merlin Röhl mit Everton,
   weil sein Wikidata-Eintrag gar keinen Verein führt. Genau dieser Schluss ist falsch:
   ein leerer Eintrag belegt nicht, dass unser Wert falsch ist. Röhl spielt tatsächlich
   bei Everton; dass Freiburg fehlte, lag allein daran, dass Freiburg damals kein
   Spielverein war.

   Die folgenden sechs stammen aus der Durchsicht der Audit-Liste vom 04.08.2026
   (45 Zuordnungen, die Wikidata nicht führt) und sind vom Owner als falsch bestätigt.
   Die übrigen 39 aus derselben Liste bleiben bewusst unangetastet — darunter De Bruynes
   Chelsea-/City-Jahre und Magaths fünf Bundesliga-Stationen, die Wikidata verloren hat. */
export const WRONG_CLUBS = {
  "jay-jay okocha|1973":     ["MUN"],
  "mason greenwood|2001":    ["ARS", "PSG"],
  "nico schlotterbeck|1999": ["RBL", "SVW"],
  "nelson valdez|1983":      ["RMA"],
};

// Entfernt die Vereine aus clubs[] und die zugehörigen cp-Einträge.
export function stripWrongClubs(players, table = WRONG_CLUBS) {
  let n = 0;
  for (const p of players) {
    const weg = table[norm(p.n) + "|" + p.by];
    if (!weg) continue;
    const vorher = (p.clubs || []).length;
    p.clubs = (p.clubs || []).filter((c) => !weg.includes(c));
    if (p.cp) p.cp = p.cp.filter((c) => !weg.includes(c[0]));
    n += vorher - p.clubs.length;
  }
  return n;
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  if (r.lg && r.lg.length) s += `, "lg": ${JSON.stringify(r.lg)}`;
  if (r.span && r.span.length) s += `, "span": ${JSON.stringify(r.span)}`;
  return s + "}";
}

// Kuratierte Einträge einarbeiten. Rein funktional, damit es ohne Netz testbar bleibt.
export function applyExtras(players, extras = EXTRA_PLAYERS, wrong = WRONG_CLUBS) {
  const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
  let added = 0, merged = 0;
  for (const x of extras) {
    const cur = byKey.get(norm(x.n) + "|" + x.by);
    if (cur) {
      if (x.nat && !(cur.nat || []).length) cur.nat = [...x.nat];
      if (x.clubs) cur.clubs = [...new Set([...(cur.clubs || []), ...x.clubs])].sort();
      if (x.t) cur.t = [...new Set([...(cur.t || []), ...x.t])].sort();
      if (x.cp) cur.cp = [...(cur.cp || []).filter((c) => !x.cp.some((y) => y[0] === c[0])), ...x.cp].sort((a, b) => a[1] - b[1]);
      if (x.pos && !cur.pos) cur.pos = x.pos;
      if (x.sl && !cur.sl) cur.sl = x.sl;
      merged++;
    } else {
      const rec = { n: x.n, ln: deriveLastName(x.n), by: x.by, nat: x.nat || [], clubs: x.clubs || [], t: x.t, sl: x.sl || 0, pos: x.pos, cp: x.cp };
      players.push(rec);
      byKey.set(norm(x.n) + "|" + x.by, rec);
      added++;
    }
  }
  const removed = stripWrongClubs(players, wrong);
  return { added, merged, removed };
}

async function main() {
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const { added, merged, removed } = applyExtras(players);
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampFixes(); // rein kuratiert — DATA_ASOF bleibt unberührt
  console.log(`Fertig: ${added} neu, ${merged} ergänzt, ${removed} falsche Vereine entfernt.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
