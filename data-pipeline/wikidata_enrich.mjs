#!/usr/bin/env node
/*
 * wikidata_enrich.mjs — Ergänzt fehlende Vereine in ../src/players.js aus Wikidata.
 *
 * Hintergrund: Der Transfermarkt-Datensatz (davidcariboo) enthält Einsätze erst
 * ~2012 und alte Transfers oft gar nicht, daher fehlen bei vielen Spielern frühere
 * Vereinsstationen (z. B. Cristiano Ronaldo → Sporting). Wikidata hat die volle
 * Vereinshistorie (Eigenschaft P54, CC0). Dieses Skript holt pro Spiel-Verein den
 * kompletten historischen Kader und matcht ihn über Name + Geburtsjahr auf unsere
 * Spieler — fehlende Vereins-Keys werden ergänzt. Es werden nur Vereine aus unseren
 * 40 Spiel-Keys gesetzt; kein Erfinden von Daten.
 *
 * Nutzung (Internet nötig):  node data-pipeline/wikidata_enrich.mjs
 * Idempotent: mehrfaches Ausführen ändert nichts Zusätzliches.
 *
 * Hinweis: Reicht praktisch ~ab den Stationen, die Wikidata kennt; Spieler, die
 * NICHT im Datensatz/Pool sind, können nicht ergänzt werden.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Verifizierte Wikidata-IDs der 40 Spiel-Vereine (Männer-Profimannschaft).
const CLUB_QID = {
  FCB:"Q15789", BVB:"Q41420", RBL:"Q702455", B04:"Q104761", SGE:"Q38245",
  BMG:"Q101959", VFB:"Q4512", WOB:"Q101859", SVW:"Q51976",
  MCI:"Q50602", MUN:"Q18656", LIV:"Q1130849", CHE:"Q9616", ARS:"Q9617",
  TOT:"Q18741", NEW:"Q18716", EVE:"Q5794", AVL:"Q18711",
  BAR:"Q7156", RMA:"Q8682", ATM:"Q8701", SEV:"Q10329", VAL:"Q10333", VIL:"Q12297",
  JUV:"Q1422", MIL:"Q1543", INT:"Q631", NAP:"Q2641", ROM:"Q2739", LAZ:"Q2609",
  PSG:"Q483020", ASM:"Q180305", OM:"Q132885", OL:"Q704", LIL:"Q19516",
  POR:"Q128446", SLB:"Q131499", SCP:"Q75729", AJA:"Q81888", PSV:"Q11938", FEY:"Q134241",
};

// Belegte Stationen, die selbst Wikidata-Matching verfehlen kann (Schreibweisen).
// Garantierte Ergänzung für prominente Fälle. Name == players.n.
const CLUB_OVERRIDES = {
  "Cristiano Ronaldo": ["SCP"],
  "David Beckham": ["MUN", "RMA", "MIL"],
  "Zlatan Ibrahimović": ["AJA", "JUV", "INT", "BAR"],
  "Wesley Sneijder": ["AJA", "RMA"],
  "Arjen Robben": ["PSV", "CHE", "RMA"],
  "Xabi Alonso": ["LIV"],
  "Andrea Pirlo": ["MIL", "INT"],
  "Samuel Eto'o": ["BAR", "INT"],
  "Fernando Torres": ["LIV"],
};

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function members(qid) {
  const q = `SELECT ?pLabel ?by WHERE { ?p p:P54 ?st . ?st ps:P54 wd:${qid} . ?p wdt:P106 wd:Q937857 . OPTIONAL { ?p wdt:P569 ?d. BIND(YEAR(?d) AS ?by) } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    if (res.status === 429) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    return d.results.bindings.map((b) => ({ n: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null }));
  }
  throw new Error("429 wiederholt");
}

async function main() {
  // Index: "normname|geburtsjahr" -> Set(spiel-keys)
  const add = new Map();
  for (const [key, qid] of Object.entries(CLUB_QID)) {
    let m;
    try { m = await members(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    for (const { n, by } of m) {
      if (!n || !by) continue;
      const k = norm(n) + "|" + by;
      if (!add.has(k)) add.set(k, new Set());
      add.get(k).add(key);
    }
    console.log(`  ${key} (${qid}): ${m.length} WD-Spieler`);
    await sleep(1300);
  }

  // Anwenden (zeilenweise, nur geänderte Zeilen -> minimaler Diff)
  let lines = readFileSync(PLAYERS_PATH, "utf8").split("\n");
  const reClubs = /"clubs": \[([^\]]*)\]/;
  const reN = /"n": "((?:[^"\\]|\\.)*)"/;
  const reBy = /"by": (\d+)/;
  let changed = 0, added = 0;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.includes('"n":') || !ln.includes('"clubs":')) continue;
    const mn = ln.match(reN), mb = ln.match(reBy), mc = ln.match(reClubs);
    if (!mn || !mb || !mc) continue;
    const name = JSON.parse('"' + mn[1] + '"'), by = parseInt(mb[1]);
    const adds = new Set([...(add.get(norm(name) + "|" + by) || []), ...(CLUB_OVERRIDES[name] || [])]);
    if (!adds.size) continue;
    const cur = mc[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
    const merged = [...new Set([...cur, ...adds])].sort();
    if (merged.length === cur.length) continue;
    added += merged.length - cur.length;
    lines[i] = ln.replace(reClubs, '"clubs": [' + merged.map((k) => `"${k}"`).join(", ") + "]");
    changed++;
  }
  writeFileSync(PLAYERS_PATH, lines.join("\n"));
  console.log(`\nFertig: ${changed} Spieler ergänzt, ${added} neue Vereins-Einträge -> src/players.js`);
}

main();
