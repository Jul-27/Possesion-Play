#!/usr/bin/env node
/*
 * wikidata_career_path.mjs — datierte Karrierestationen für „Karriere-Pfad".
 * Schreibt src/careerPathClubs.js. Internet nötig. Idempotent.
 *
 *   node data-pipeline/wikidata_career_path.mjs            # sl >= 40 (Modus-Grenze)
 *   node data-pipeline/wikidata_career_path.mjs --min-sl 25
 *   node data-pipeline/wikidata_career_path.mjs --probe
 *
 * WARUM EINE EIGENE DATEI, obwohl careerClubs.js schon alle Vereine kennt: der
 * Karriere-Pfad deckt Stationen CHRONOLOGISCH auf, braucht also Jahreszahlen.
 * careerClubs.js führt nur Namen — Jahre dort mitzuführen verdreifachte die Datei
 * (0,65 MB gzip) für einen Modus, der sie gar nicht braucht.
 *
 * Umgekehrt braucht der Karriere-Pfad nur die ratbaren Spieler: er filtert ohnehin
 * auf sl >= 40. Diese Datei deckt genau diesen Ausschnitt ab und bleibt dadurch
 * klein genug, um sie beim Start des Modus nachzuladen.
 *
 * Bisher kam der Pfad aus `cp` in players.js — und das kennt nur die 47
 * Spielvereine. Gündoğans Pfad begann deshalb bei Dortmund statt bei Bochum und
 * Nürnberg.
 */
import { writeFileSync } from "fs";
import { pathToFileURL } from "url";
import { norm, CLUBS } from "../src/gameData.js";
import { istZweitteam } from "./wikidata_career_clubs.mjs";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const OUT = new URL("../src/careerPathClubs.js", import.meta.url);
const BATCH = 200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  for (let a = 0; a < 5; a++) {
    let res;
    try {
      res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        // charset=utf-8 zwingend, sonst finden Namen mit Sonderzeichen nichts.
        headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/sparql-query; charset=utf-8" },
        body: query,
      });
    } catch { await sleep(8000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(20000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch { await sleep(8000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/* Anders als bei careerClubs wird hier das STATEMENT gelesen (p:P54 statt wdt:),
   denn nur daran hängen die Qualifikatoren P580/P582 mit den Jahren. Ein Startjahr
   ist Pflicht — ohne es lässt sich die Station nicht einsortieren, und genau die
   Reihenfolge ist der Kern des Modus. */
const abfrage = (namen) => `SELECT ?pLabel ?by ?cLabel ?von ?bis WHERE {
  VALUES ?l { ${namen.flatMap((n) => [`"${esc(n)}"@de`, `"${esc(n)}"@en`]).join(" ")} }
  ?p rdfs:label|skos:altLabel ?l ; wdt:P106 wd:Q937857 ; wdt:P569 ?d .
  ?p p:P54 ?st . ?st ps:P54 ?c ; pq:P580 ?s .
  OPTIONAL { ?st pq:P582 ?e }
  MINUS { ?c wdt:P31 ?t1 . ?t1 wdt:P279* wd:Q6979593 }
  MINUS { ?c wdt:P31 wd:Q2412834 }
  MINUS { ?c wdt:P31 wd:Q28140340 }
  BIND(YEAR(?d) AS ?by) BIND(YEAR(?s) AS ?von) BIND(IF(BOUND(?e), YEAR(?e), 0) AS ?bis)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}`;

/** Ergebniszeilen den eigenen Spielern zuordnen: schluessel -> [[verein, von, bis]] */
export function ordneZu(rows, bekannt) {
  const treffer = new Map();
  for (const b of rows) {
    const name = b.pLabel?.value, by = b.by?.value ? Number(b.by.value) : null;
    const club = b.cLabel?.value, von = b.von?.value ? Number(b.von.value) : null;
    const bis = b.bis?.value != null ? Number(b.bis.value) : 0;
    if (!name || !by || !club || !von) continue;
    if (/^Q\d+$/.test(club) || istZweitteam(club)) continue;
    /* Datierungen aus dem Jugendbereich verzerren den Pfad: Wikidata führt bei
       manchen Spielern den Akademie-Eintritt mit 8 Jahren. */
    if (von < by + 14) continue;
    const k = norm(name) + "|" + by;
    if (!bekannt.has(k)) continue;
    const liste = treffer.get(k) || treffer.set(k, []).get(k);
    if (!liste.some((x) => x[0] === club && x[1] === von && x[2] === bis)) liste.push([club, von, bis]);
  }
  return treffer;
}

export function baueDatei(vereine, proSpieler) {
  const idx = new Map(vereine.map((n, i) => [n, i]));
  const zeilen = [...proSpieler.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, liste]) => {
    const s = liste.slice().sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([c, von, bis]) => `[${idx.get(c)},${von},${bis}]`).join(",");
    return `  ${JSON.stringify(k)}: [${s}]`;
  });
  return `// GENERIERT von data-pipeline/wikidata_career_path.mjs. Nicht von Hand editieren.
/* Datierte Karrierestationen für „Karriere-Pfad" — nur die ratbaren Spieler.

   CAREER_PATH_CLUBS   Namensliste aller Vereine
   CAREER_PATH_BY_KEY  "norm(name)|geburtsjahr" -> [[vereinsIndex, von, bis], …]
                       bis = 0 heißt „bis heute", die Liste ist nach von sortiert.

   Getrennt von careerClubs.js, weil dort die Jahre fehlen und sie dort mitzuführen
   die Datei für das Transferkarussell verdreifacht hätte, das sie nicht braucht. */
export const CAREER_PATH_CLUBS = ${JSON.stringify(vereine)};

export const CAREER_PATH_BY_KEY = {
${zeilen.join(",\n")}
};
`;
}

async function main() {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d; };
  const probe = process.argv.includes("--probe");
  // Standard = die Grenze, ab der der Modus überhaupt Spieler zulässt (CAREER_SL_MIN).
  const MIN_SL = arg("min-sl", 40);

  const { PLAYERS } = await import(new URL("../src/players.js", import.meta.url).href + "?t=" + Date.now());
  const ziel = PLAYERS.filter((p) => (p.sl || 0) >= MIN_SL);
  const bekannt = new Set(ziel.map((p) => norm(p.n) + "|" + p.by));
  console.log(`Hole datierte Stationen für ${ziel.length} Spieler (sl >= ${MIN_SL})\n`);

  const proSpieler = new Map();
  const namen = [...new Set(ziel.map((p) => p.n))];
  for (let i = 0; i < namen.length; i += BATCH) {
    const teil = namen.slice(i, i + BATCH);
    let rows;
    try { rows = await sparql(abfrage(teil)); }
    catch (e) { console.log(`  ${i}–${i + teil.length}: FEHLER ${e.message}`); continue; }
    for (const [k, liste] of ordneZu(rows, bekannt)) {
      const vorhanden = proSpieler.get(k) || proSpieler.set(k, []).get(k);
      for (const s of liste) if (!vorhanden.some((x) => x[0] === s[0] && x[1] === s[1] && x[2] === s[2])) vorhanden.push(s);
    }
    console.log(`  ${String(Math.min(i + BATCH, namen.length)).padStart(5)}/${namen.length} · ${rows.length} Zeilen · ${proSpieler.size} Spieler`);
    await sleep(1200);
  }

  const vereine = [...new Set([...proSpieler.values()].flat().map((s) => s[0]))].sort();
  const mit3 = [...proSpieler.values()].filter((l) => new Set(l.map((s) => s[0])).size >= 3).length;
  const summe = [...proSpieler.values()].reduce((a, l) => a + l.length, 0);
  console.log(`\nSpieler mit datierten Stationen: ${proSpieler.size} · davon mit >=3 Vereinen: ${mit3}`);
  console.log(`verschiedene Vereine: ${vereine.length} · Stationen je Spieler: Ø ${(summe / proSpieler.size).toFixed(1)}`);
  const spielVereine = new Set(CLUBS.map((c) => c.name));
  console.log(`darunter Nicht-Spielvereine: ${vereine.filter((v) => !spielVereine.has(v)).length}`);

  if (probe) return console.log("\n--probe: nichts geschrieben.");
  const inhalt = baueDatei(vereine, proSpieler);
  writeFileSync(OUT, inhalt);
  // Kein Stempel: die Datei liegt neben players.js, nicht darin.
  console.log(`\nFertig: src/careerPathClubs.js · ${(inhalt.length / 1024).toFixed(0)} KB roh`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
