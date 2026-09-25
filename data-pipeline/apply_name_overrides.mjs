#!/usr/bin/env node
/* Kuratierte Namenskorrekturen + Ausschlüsse auf src/players.js anwenden.
   Umbenannte Records, die dadurch auf einen bereits vorhandenen Spieler fallen
   (gleicher Name + Geburtsjahr), werden verschmolzen — sonst gingen die an einem
   der beiden Records hängenden Titel/Positionen/Karrieredaten verloren.
   Idempotent. Kein Netz.   node data-pipeline/apply_name_overrides.mjs */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { NAME_OVERRIDES, EXCLUDED_PLAYERS } from "./name_overrides.mjs";
import { stampFixes } from "./stamp.mjs";
import { recToString } from "./player_record.mjs";
import { REGELN, abbildungAus, umschluesselnText } from "./nebendateien_umschluesseln.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

const key = (p) => norm(p.n) + "|" + p.by;

/** Ausschlussliste: greift auf den aktuellen Namen und auf bekannte Aliasse. */
export function isExcluded(p, list = EXCLUDED_PLAYERS) {
  return list.some((x) => x.by === p.by && (x.n === p.n || (x.aliases || []).includes(p.n)));
}

/* Bei zwei Schreibweisen desselben Spielers gewinnt die mit den Sonderzeichen.
   Die Suche im Spiel normalisiert ł/ø/ð/æ/þ ohnehin weg — „Lukasz Fabianski"
   getippt findet also auch „Łukasz Fabiański". Die korrekte Schreibweise kostet
   damit nichts, während die alphabetische Reihenfolge sonst immer die ASCII-Variante
   gewinnen ließe. Bei Gleichstand bleibt es beim ersten. */
export function besserGeschrieben(a, b) {
  const sonder = (s) => [...String(s)].filter((c) => c.charCodeAt(0) > 127).length;
  return sonder(b) > sonder(a) ? b : a;
}

/** b in a hineinverschmelzen: Mengen vereinigen, fehlende Skalare ergänzen. */
export function mergeInto(a, b) {
  const name = besserGeschrieben(a.n, b.n);
  if (name !== a.n) { a.n = name; a.ln = deriveLastName(name); }
  a.nat = a.nat && a.nat.length ? a.nat : [...(b.nat || [])];
  a.clubs = [...new Set([...(a.clubs || []), ...(b.clubs || [])])].sort();
  const t = [...new Set([...(a.t || []), ...(b.t || [])])].sort();
  if (t.length) a.t = t;
  a.sl = Math.max(a.sl || 0, b.sl || 0);
  if (!a.pos && b.pos) a.pos = b.pos;
  const cp = [...(a.cp || []), ...(b.cp || [])];
  const seen = new Set();
  const uniq = cp.filter((c) => { const k = c.join("|"); if (seen.has(k)) return false; seen.add(k); return true; });
  if (uniq.length) a.cp = uniq.sort((x, y) => x[1] - y[1]);
  /* lg und span kamen später dazu (PR #45) und fehlten hier — beim Verschmelzen von
     Kostas Mitroglou gingen dadurch vier Ligen und die ganze Karriere-Spanne verloren,
     insgesamt bei 10 Spielern. Beide sind für die Liga- und Ära-Hexfelder zuständig. */
  const lg = [...new Set([...(a.lg || []), ...(b.lg || [])])].sort();
  if (lg.length) a.lg = lg;
  const spans = [a.span, b.span].filter((s) => s && s.length === 2);
  if (spans.length) {
    // 0 heißt „läuft noch" und schlägt jedes Enddatum.
    const ende = spans.some((s) => s[1] === 0) ? 0 : Math.max(...spans.map((s) => s[1]));
    a.span = [Math.min(...spans.map((s) => s[0])), ende];
  }
  return a;
}

/* KETTEN BIS ZUM ENDZIEL. Zwei Tabellen können sich verketten: Eine ältere Zeile
   benennt „Mykhaylo Mudryk" in „Mykhailo Mudryk" um, eine neuere diesen in
   „Mychajlo Mudryk". Jeder Datensatz wird nur einmal umbenannt — ohne das Verfolgen
   bliebe er beim Zwischennamen stehen, als eigene Person neben dem Endziel. */
export function endziele(overrides) {
  const byFrom = new Map(overrides.map((o) => [o.from + "|" + o.by, o]));
  return new Map(overrides.map((o) => {
    let n = o.to, by = o.byTo ?? o.by;
    const gesehen = new Set([o.from + "|" + o.by]);
    while (byFrom.has(n + "|" + by) && !gesehen.has(n + "|" + by)) {
      gesehen.add(n + "|" + by);
      const w = byFrom.get(n + "|" + by);
      n = w.to; by = w.byTo ?? w.by;
    }
    return [o.from + "|" + o.by, { ...o, to: n, ...(by !== o.by ? { byTo: by } : {}) }];
  }));
}

export function applyOverrides(players, overrides = NAME_OVERRIDES, excluded = EXCLUDED_PLAYERS) {
  const stats = { renamed: 0, merged: 0, removed: 0 };

  let list = players.filter((p) => { const drop = isExcluded(p, excluded); if (drop) stats.removed++; return !drop; });

  const byFrom = endziele(overrides);
  for (const p of list) {
    const o = byFrom.get(p.n + "|" + p.by);
    if (!o) continue;
    p.n = o.to;
    p.ln = deriveLastName(o.to);
    /* `byTo` korrigiert zusätzlich das Geburtsjahr. Umbenennen allein reicht nicht,
       wenn WIKIDATA SELBST das Datum verdirbt: Q188241 (Quaresma) führt derzeit das
       Jahr 1000, Q485697 (Pepe) das Jahr 1984, während der Wikipedia-Artikel „Pepe
       (Fußballspieler, 1983)" heißt. Der Schlüssel ist Name UND Jahr — ohne die
       Korrektur legt jeder Lauf erneut einen zweiten Datensatz an, und die Titel
       landen dort statt beim echten Spieler. */
    if (o.byTo) p.by = o.byTo;
    stats.renamed++;
  }

  // Umbenennungen können Dubletten erzeugt haben -> verschmelzen (erster gewinnt).
  const out = [];
  const seen = new Map();
  for (const p of list) {
    const k = key(p);
    const cur = seen.get(k);
    if (cur) { mergeInto(cur, p); stats.merged++; continue; }
    seen.set(k, p);
    out.push(p);
  }

  list = out.filter((p) => { const drop = isExcluded(p, excluded); if (drop) stats.removed++; return !drop; });
  return { players: list, stats };
}

async function main() {
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const input = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const { players, stats } = applyOverrides(input);
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampFixes(); // rein kuratiert — DATA_ASOF bleibt unberührt
  console.log(`Fertig: ${stats.renamed} umbenannt, ${stats.merged} verschmolzen, ${stats.removed} entfernt -> ${players.length} Spieler.`);

  /* Dieselben Umbenennungen in den Nebendateien, sonst hingen Foto, Einsätze und
     Karussell-Stationen am verschwundenen Datensatz. */
  const abbildung = abbildungAus([...endziele(NAME_OVERRIDES).values()]);
  for (const [datei, regel] of Object.entries(REGELN)) {
    const pfad = join(HERE, "..", "src", datei);
    const r = umschluesselnText(readFileSync(pfad, "utf8"), abbildung, regel);
    if (r.umbenannt || r.verschmolzen) writeFileSync(pfad, r.text);
    console.log(`  ${datei}: ${r.umbenannt} umbenannt, ${r.verschmolzen} verschmolzen`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
