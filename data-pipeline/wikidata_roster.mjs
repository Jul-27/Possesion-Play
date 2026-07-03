#!/usr/bin/env node
/*
 * wikidata_roster.mjs — Baut src/players.js neu: ergänzt Vereine vorhandener
 * Spieler UND legt fehlende Spieler aus Wikidata an (Name, Nachname, Geburtsjahr,
 * Nation via P27->ISO-3, Vereine, Bekanntheit `sl` = Sitelinks). Internet nötig.
 * Idempotent.   node data-pipeline/wikidata_roster.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

export const CLUB_QID = {
  FCB:"Q15789", BVB:"Q41420", RBL:"Q702455", B04:"Q104761", SGE:"Q38245",
  BMG:"Q101959", VFB:"Q4512", WOB:"Q101859", SVW:"Q51976",
  MCI:"Q50602", MUN:"Q18656", LIV:"Q1130849", CHE:"Q9616", ARS:"Q9617",
  TOT:"Q18741", NEW:"Q18716", EVE:"Q5794", AVL:"Q18711",
  BAR:"Q7156", RMA:"Q8682", ATM:"Q8701", SEV:"Q10329", VAL:"Q10333", VIL:"Q12297",
  JUV:"Q1422", MIL:"Q1543", INT:"Q631", NAP:"Q2641", ROM:"Q2739", LAZ:"Q2609",
  PSG:"Q483020", ASM:"Q180305", OM:"Q132885", OL:"Q704", LIL:"Q19516",
  POR:"Q128446", SLB:"Q131499", SCP:"Q75729", AJA:"Q81888", PSV:"Q11938", FEY:"Q134241",
};

export const CLUB_OVERRIDES = {
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

// ISO-3-Codes unserer Spiel-Nationen (NATIONS in gameData.js)
export const NATION_KEYS = new Set(["FRA","GER","ESP","ITA","NED","BEL","CRO","ENG","PRT","JPN","BRA","ARG","MEX","NGA","CIV","SEN","COL","USA"]);

const PARTICLES = new Set(["van","von","de","del","della","di","da","dos","der","den","ten","ter","la","le"]);

export function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function deriveLastName(name) {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  let i = parts.length - 1;
  while (i > 0 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(" ");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    if (res.status === 429) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return (await res.json()).results.bindings;
  }
  throw new Error("429 wiederholt");
}

async function fetchClubRoster(qid) {
  // siso = sportliche Nation (P1532, bevorzugt), ciso = Staatsbürgerschaft (P27, Fallback)
  const q = `SELECT ?pLabel ?by ?sl ?siso ?ciso WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
    BIND(YEAR(?d) AS ?by)
    OPTIONAL { ?p wdt:P1532 ?sc . ?sc wdt:P298 ?siso . }
    OPTIONAL { ?p wdt:P27 ?c . ?c wdt:P298 ?ciso . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({
    name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null,
    sl: b.sl?.value ? parseInt(b.sl.value) : 0,
    siso: b.siso?.value || null, ciso: b.ciso?.value || null,
  }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`; // pos/cp erhalten (kamen nach diesem Skript dazu)
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

async function main() {
  // 1) Roster aus Wikidata aggregieren: key "norm|by" -> {name, by, clubs:Set, sl, iso}
  const roster = new Map();
  for (const [key, qid] of Object.entries(CLUB_QID)) {
    let rows;
    try { rows = await fetchClubRoster(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    for (const r of rows) {
      if (!r.name || !r.by) continue;
      const k = norm(r.name) + "|" + r.by;
      let e = roster.get(k);
      if (!e) { e = { name: r.name, by: r.by, clubs: new Set(), sl: 0, siso: null, ciso: null }; roster.set(k, e); }
      e.clubs.add(key);
      if (r.sl > e.sl) e.sl = r.sl;
      if (!e.siso && r.siso && NATION_KEYS.has(r.siso)) e.siso = r.siso; // sportliche Nation bevorzugt
      if (!e.ciso && r.ciso && NATION_KEYS.has(r.ciso)) e.ciso = r.ciso; // Staatsbürgerschaft Fallback
    }
    console.log(`  ${key} (${qid}): ${rows.length} Zeilen`);
    await sleep(1300);
  }

  // 2) Bestehende Spieler laden
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const existing = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const byKey = new Map(existing.map((p) => [norm(p.n) + "|" + p.by, p]));

  // 3) Merge: vorhandene ergänzen, fehlende neu anlegen
  let added = 0, enriched = 0;
  for (const [k, e] of roster) {
    const cur = byKey.get(k);
    if (cur) {
      const before = cur.clubs.length;
      cur.clubs = [...new Set([...cur.clubs, ...e.clubs])].sort();
      cur.sl = Math.max(cur.sl || 0, e.sl);
      if (cur.clubs.length > before) enriched++;
    } else {
      const iso = e.siso || e.ciso;
      const rec = {
        n: e.name, ln: deriveLastName(e.name), by: e.by,
        nat: iso ? [iso] : [], clubs: [...e.clubs].sort(), sl: e.sl,
      };
      existing.push(rec); byKey.set(k, rec); added++;
    }
  }

  // 4) Kuratierte Overrides anwenden (vorhandene + neue)
  for (const p of existing) {
    const ov = CLUB_OVERRIDES[p.n];
    if (ov) p.clubs = [...new Set([...p.clubs, ...ov])].sort();
  }

  // 5) Schreiben (sortiert nach Name)
  existing.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = existing.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  console.log(`\nFertig: ${existing.length} Spieler (${added} neu, ${enriched} ergänzt) -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
