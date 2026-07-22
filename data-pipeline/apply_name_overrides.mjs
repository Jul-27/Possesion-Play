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
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

const key = (p) => norm(p.n) + "|" + p.by;

/** Ausschlussliste: greift auf den aktuellen Namen und auf bekannte Aliasse. */
export function isExcluded(p, list = EXCLUDED_PLAYERS) {
  return list.some((x) => x.by === p.by && (x.n === p.n || (x.aliases || []).includes(p.n)));
}

/** b in a hineinverschmelzen: Mengen vereinigen, fehlende Skalare ergänzen. */
export function mergeInto(a, b) {
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
  return a;
}

export function applyOverrides(players, overrides = NAME_OVERRIDES, excluded = EXCLUDED_PLAYERS) {
  const stats = { renamed: 0, merged: 0, removed: 0 };

  let list = players.filter((p) => { const drop = isExcluded(p, excluded); if (drop) stats.removed++; return !drop; });

  const byFrom = new Map(overrides.map((o) => [o.from + "|" + o.by, o]));
  for (const p of list) {
    const o = byFrom.get(p.n + "|" + p.by);
    if (!o) continue;
    p.n = o.to;
    p.ln = deriveLastName(o.to);
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
  stampDataInfo();
  console.log(`Fertig: ${stats.renamed} umbenannt, ${stats.merged} verschmolzen, ${stats.removed} entfernt -> ${players.length} Spieler.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
