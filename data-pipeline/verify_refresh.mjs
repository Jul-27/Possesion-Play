#!/usr/bin/env node
/*
 * verify_refresh.mjs — vergleicht src/players.js mit einem Stand VOR dem Lauf und
 * meldet auffällige Verluste. Kein Netz nötig.
 *
 * Hintergrund: Wikidata wird aktiv vandaliert. In dieser Codebasis ist das mehrfach
 * aufgeschlagen — De Bruynes Chelsea- und Man-City-Zeiten waren gelöscht, Nianzous
 * Bayern-Zeit verschwunden, Spielernamen durch Unsinn ersetzt. Ein roher Refresh
 * hätte still 38 real gewonnene Titel bei 20 Spielern entfernt. Dieser Prüflauf macht
 * so etwas sichtbar, BEVOR es live geht.
 *
 *   node data-pipeline/verify_refresh.mjs <vorher.js> [--max-loss-pct 2]
 *
 * Exit-Code 1, wenn eine Schwelle gerissen wird — damit taugt es für CI und die
 * monatliche Refresh-Action.
 */
import { pathToFileURL } from "url";
import { existsSync } from "fs";

const args = process.argv.slice(2);
const beforePath = args.find((a) => !a.startsWith("--"));
const pct = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
};
const MAX_LOSS_PCT = pct("max-loss-pct", 2);        // Anteil komplett verschwundener Spieler
/* Ein bekannter Spieler, der auf einen Schlag mehrere Werte verliert, ist das
   typische Vandalismus-Muster (De Bruyne verlor Vereine, Titel, Karriere und Ligen
   gleichzeitig). Deshalb zählt nicht nur die Gesamtmenge, sondern der Einzelfall. */
const MAX_PER_PLAYER = pct("max-per-player", 3);    // Feldverluste bei EINEM bekannten Spieler
const KNOWN_SL = pct("known-sl", 40);

if (!beforePath || !existsSync(beforePath)) {
  console.error("Aufruf: node data-pipeline/verify_refresh.mjs <vorher.js> [--max-loss-pct 2]");
  process.exit(2);
}

const key = (p) => `${p.n}|${p.by}`;
const FIELDS = ["clubs", "nat", "t", "cp", "lg"];

const [before, after] = await Promise.all([
  import(pathToFileURL(beforePath).href),
  import(new URL("../src/players.js", import.meta.url).href + "?t=" + Date.now()),
]);

const A = new Map(after.PLAYERS.map((p) => [key(p), p]));
const problems = [];
let verlorene = 0, feldVerluste = 0, feldGewinne = 0;
const beispiele = [];
const schwerVerlust = []; // bekannte Spieler mit auffällig vielen Verlusten

for (const b of before.PLAYERS) {
  const a = A.get(key(b));
  if (!a) { verlorene++; if (beispiele.length < 8) beispiele.push(`fehlt jetzt: ${b.n} (${b.by})`); continue; }
  let eigen = 0;
  for (const f of FIELDS) {
    const vor = new Set(b[f]?.map?.((x) => JSON.stringify(x)) || []);
    const nach = new Set(a[f]?.map?.((x) => JSON.stringify(x)) || []);
    const weg = [...vor].filter((x) => !nach.has(x));
    const neu = [...nach].filter((x) => !vor.has(x));
    feldGewinne += neu.length;
    if (weg.length) {
      feldVerluste += weg.length;
      eigen += weg.length;
      if (beispiele.length < 8) beispiele.push(`${b.n}: ${f} verliert ${weg.map((x) => x.replace(/"/g, "")).join(", ")}`);
    }
  }
  if (eigen > MAX_PER_PLAYER && (b.sl || 0) >= KNOWN_SL) schwerVerlust.push(`${b.n} (sl ${b.sl}): ${eigen} Werte`);
}

const gesamt = before.PLAYERS.length;
const verlustPct = (verlorene / gesamt) * 100;

console.log(`Spieler vorher ${gesamt} → nachher ${after.PLAYERS.length}`);
console.log(`  komplett verschwunden: ${verlorene} (${verlustPct.toFixed(2)} %)`);
console.log(`  Feldwerte verloren: ${feldVerluste} · dazugewonnen: ${feldGewinne}`);
if (beispiele.length) console.log("\nBeispiele:\n  " + beispiele.join("\n  "));

if (verlustPct > MAX_LOSS_PCT) problems.push(`${verlustPct.toFixed(2)} % der Spieler verschwunden (Grenze ${MAX_LOSS_PCT} %)`);
if (schwerVerlust.length) {
  problems.push(`${schwerVerlust.length} bekannte Spieler verlieren je mehr als ${MAX_PER_PLAYER} Werte:\n    ` + schwerVerlust.slice(0, 10).join("\n    "));
}

if (problems.length) {
  console.error("\n⚠️  Auffällig — bitte prüfen, bevor das live geht:\n  " + problems.join("\n  "));
  console.error("\nWenn die Verluste echt sind (z. B. Wikidata-Vandalismus), den alten Stand behalten oder\nWerte kuratiert nachtragen — siehe name_overrides.mjs / EXTRA_PLAYERS.");
  process.exit(1);
}
console.log("\n✓ Keine auffälligen Verluste.");
