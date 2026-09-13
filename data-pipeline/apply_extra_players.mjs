#!/usr/bin/env node
/* Kuratierte Spieler, die Wikidata nicht/kaum kennt, additiv in src/players.js.
   Anlegen oder Felder ergänzen (clubs/nat/cp union; sl/pos/by setzen falls leer).
   Kein Netz. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampFixes } from "./stamp.mjs";
import { recToString } from "./player_record.mjs";

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

  /* Ricardo Quaresma, Lauf vom 12.09.2026. Wikidata führt für Q188241 derzeit
     P569 = +1000-00-00, also gar kein brauchbares Geburtsdatum. Der Titel-Lauf legte
     dadurch einen Datensatz „Ricardo Quaresma|1000" an und schrieb IHM diese vier
     Titel zu, während der echte Datensatz (1983, belegt durch de.wikipedia:
     26. September 1983) leer zurückblieb.

     Die Titel sind also nicht geraten — sie stammen aus demselben Wikidata-Lauf wie
     alle anderen, nur unter dem falschen Schlüssel. NAME_OVERRIDES korrigiert das
     Jahr künftig über `byTo`; hier stehen sie, weil der falsch geschlüsselte
     Datensatz zum Zeitpunkt der Korrektur bereits entfernt war. */
  { n: "Ricardo Quaresma", by: 1983, t: ["CIT", "CL", "EM", "MSA"] },

  /* ── Aus „Fehler melden", Durchsicht vom 13.09.2026 ────────────────────────
     Acht Meldungen waren anwendbar; drei davon (Dedić→Newcastle, Bouaddi→Man City,
     Diallo→Mainz) hat der Datenlauf selbst geschlossen. Die übrigen stehen hier.

     Jede ist an ZWEI Quellen belegt — de.wikipedia und en.wikipedia, jeweils die
     Karrieretabelle der Infobox, mit abgeglichenem Geburtsjahr. Die Zeiträume
     stammen aus derselben Tabelle. */
  { n: "Jacob Bruun Larsen",  by: 1998, clubs: ["TSG"], cp: [["TSG", 2020, 2025]] },
  { n: "Gonçalo Paciência",   by: 1994, clubs: ["S04"], cp: [["S04", 2020, 2021]] },
  { n: "Sejad Salihović",     by: 1984, clubs: ["HSV"], cp: [["HSV", 2017, 2018]] },
  { n: "Mads Bidstrup",       by: 2001, clubs: ["RBS"], cp: [["RBS", 2023, 2026]] },
  { n: "Robert Glatzel",      by: 1994, clubs: ["M05", "HSV"], cp: [["M05", 2021, 2021], ["HSV", 2021, 2026]] },
  /* Capaldo steht bei uns unter 1997, Wikidata und beide Wikipedias nennen den
     14.09.1998. Der Eintrag folgt dem Schlüssel, der im Bestand existiert — sonst
     liefe er ins Leere. Das falsche Jahr ist gesondert zu klären; es hat schon
     einmal dazu geführt, dass eine Prüfung Capaldo mit Guilherme Ramos verwechselt
     hat, weil beide Namen zu einem Artikel mit Jahrgang 1997 führten. */
  { n: "Nicolás Capaldo",     by: 1997, clubs: ["RBS"], cp: [["RBS", 2021, 2025]] },

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

  /* Zweite Ladung aus „Fehler melden" (26.08.2026). Jede Station steht in der
     Infobox-Karrieretabelle der deutschen Wikipedia; Wikidata führt keine davon.
     Vier der sechs sind Leihen — genau die Kategorie, die dort jahrelang fehlt. */
  { n: "Ransford-Yeboah Königsdörffer", by: 2001, clubs: ["HSV"] },  // 2022–2026
  { n: "Ishak Belfodil",    by: 1992, clubs: ["TSG"] },              // 2018–2021
  { n: "Patrick Farkas",    by: 1992, clubs: ["RBS"] },              // 2017–2021
  { n: "Sepp van den Berg", by: 2001, clubs: ["S04", "M05"] },       // 2022–2023 · 2023–2024, beide Leihe
  { n: "Alexander Schwolow", by: 1992, clubs: ["S04"] },             // 2022–2023, Leihe
  { n: "Guido Burgstaller", by: 1989, clubs: ["S04"] },              // 2017–2020
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
  /* Beim Nachtragen der gemeldeten Vereine aufgefallen (13.09.2026): Salihovićs
     Karriere führt Hertha BSC, Hoffenheim, Guizhou/Beijing Renhe, St. Gallen, den
     HSV und Frankenthal — auf beiden Wikipedias, in dieser Reihenfolge. Inter
     Mailand kommt in keiner der beiden vor. */
  "sejad salihovic|1984":    ["INT"],
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
