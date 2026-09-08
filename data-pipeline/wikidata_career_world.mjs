#!/usr/bin/env node
/*
 * wikidata_career_world.mjs — baut src/careerWorld.js: die Vereinswelt des
 * Karriere-Modus, nach Land und Spielklasse geordnet.
 *
 *   node data-pipeline/wikidata_career_world.mjs [--probe]
 *
 * ── WARUM EINE EIGENE WELT ───────────────────────────────────────────────────
 * Die Traumelf braucht zu wissen, WANN ein Verein in welcher Liga spielte — sie
 * tritt in der echten Bundesliga 2019/20 an. Der Karriere-Modus braucht das nicht:
 * seine Saisons sind abstrakt und ohne Jahreszahl. Er braucht nur „welcher Verein
 * gehört zu welcher Liga und welcher Spielklasse".
 *
 * Das ist ein Glücksfall, denn die Jahresdaten sind außerhalb der großen drei Ligen
 * löchrig (gemessen: Portugals zweite Liga und LaLiga 2 haben in Wikidata je EINE
 * Saison mit Teilnehmerliste, die Eerste Divisie keine). Ohne Jahre reicht die
 * Vereinigung aller Jahrgänge — und wo auch die fehlt, die Ligazugehörigkeit am
 * Verein selbst (P118).
 *
 * ── ZWEI QUELLEN, WEIL KEINE ALLEIN TRÄGT ────────────────────────────────────
 * 1. SAISON-TEILNEHMER (P3450 + P1923). Sauber, aber nur für Ligen vorhanden, die
 *    jemand gepflegt hat. Für BL/PL/LL steht das Ergebnis schon in leagueClubs.js.
 * 2. LIGAZUGEHÖRIGKEIT AM VEREIN (P118). Vollständiger bei den kleinen Ligen, aber
 *    bei den großen unbrauchbar roh: Für die Bundesliga liefert P118 6089 Vereine,
 *    weil dort jede Amateurmannschaft der Pyramide ihre Ligageschichte führt.
 *    Deshalb der KADERTEST: Nur Vereine mit mindestens KADER_MIN Spielern, die nach
 *    KADER_AB dort unter Vertrag standen, zählen als Profiverein dieser Liga.
 *
 * Österreich fehlt bewusst: Rapid und Salzburg tragen überhaupt kein P118, und
 * Saisonlisten gibt es auch nicht. Die österreichischen Spielvereine aus
 * gameData.js bleiben trotzdem in der Welt — sie kommen aus einer anderen Quelle.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { stampDataInfo } from "./stamp.mjs";
import { CLUB_QID } from "./wikidata_roster.mjs";
import { loeseAuf } from "./wikidata_league_clubs.mjs";
import { LIGA_VEREINE } from "../src/leagueClubs.js";
import { cleanName } from "./wikidata_label.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HERE, "..", "src", "careerWorld.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

/* Die Ligen der Welt. `stufe` ist die Spielklasse: 1 = oberste, 2 = zweite.
   `plaetze` ist die echte Größe der Tabelle — danach richtet sich, um welche
   Positionen gespielt wird. `quelle` sagt, welcher Weg oben gemeint ist. */
export const WELT_LIGEN = [
  { key: "BL",  name: "Bundesliga",      land: "GER", stufe: 1, plaetze: 18, qid: "Q82595",  quelle: "saison" },
  { key: "BL2", name: "2. Bundesliga",   land: "GER", stufe: 2, plaetze: 18, qid: "Q152665", quelle: "saison" },
  { key: "PL",  name: "Premier League",  land: "ENG", stufe: 1, plaetze: 20, qid: "Q9448",   quelle: "saison" },
  { key: "PL2", name: "Championship",    land: "ENG", stufe: 2, plaetze: 24, qid: "Q19510",  quelle: "beide"  },
  { key: "LL",  name: "LaLiga",          land: "ESP", stufe: 1, plaetze: 20, qid: "Q324867", quelle: "saison" },
  { key: "LL2", name: "LaLiga 2",        land: "ESP", stufe: 2, plaetze: 22, qid: "Q35615",  quelle: "beide"  },
  { key: "SA",  name: "Serie A",         land: "ITA", stufe: 1, plaetze: 20, qid: "Q15804",  quelle: "p118"   },
  { key: "SA2", name: "Serie B",         land: "ITA", stufe: 2, plaetze: 20, qid: "Q194052", quelle: "beide"  },
  { key: "L1",  name: "Ligue 1",         land: "FRA", stufe: 1, plaetze: 18, qid: "Q13394",  quelle: "beide"  },
  { key: "L2",  name: "Ligue 2",         land: "FRA", stufe: 2, plaetze: 18, qid: "Q217374", quelle: "beide"  },
  { key: "PT",  name: "Primeira Liga",   land: "PRT", stufe: 1, plaetze: 18, qid: "Q182994", quelle: "beide"  },
  { key: "PT2", name: "Liga Portugal 2", land: "PRT", stufe: 2, plaetze: 18, qid: "Q754488", quelle: "beide"  },
  { key: "NL",  name: "Eredivisie",      land: "NED", stufe: 1, plaetze: 18, qid: "Q167541", quelle: "beide"  },
  { key: "NL2", name: "Eerste Divisie",  land: "NED", stufe: 2, plaetze: 20, qid: "Q610823", quelle: "p118"   },
];

/* Der Kadertest gegen die P118-Schwemme: So viele Spieler muss ein Verein seit
   diesem Jahr gehabt haben, um als Profiverein dieser Liga zu gelten. */
export const KADER_MIN = 12;
export const KADER_AB = 2015;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let versuch = 0; versuch < 6; versuch++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } }); }
    catch { await sleep(6000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(10000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    try { return JSON.parse(await res.text()).results.bindings; } catch { await sleep(6000); }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

const qidVon = (uri) => String(uri).split("/").pop();

/* P118 heißt „spielt in dieser Liga" ohne Jahr — also heute. Damit die Zuordnung
   unten beide Quellen vergleichen kann, bekommt sie ein Jahr, das jedes Saisonjahr
   schlägt. */
export const JETZT = 9999;

/** Vereine über die Saison-Teilnehmerlisten (P3450 + P1923), je Teilnahme ein Jahr. */
export async function ueberSaisons(qid, ab = 2010) {
  const r = await sparql(`SELECT ?team ?teamLabel ?jahr WHERE {
    ?saison wdt:P3450 wd:${qid} ; wdt:P580 ?start ; wdt:P1923 ?team .
    BIND(YEAR(?start) AS ?jahr) FILTER(?jahr >= ${ab})
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
  }`);
  return r.map((b) => ({ qid: qidVon(b.team.value), label: b.teamLabel.value, jahr: +b.jahr.value }));
}

/** Vereine über die Ligazugehörigkeit am Verein (P118), mit Kadertest. */
export async function ueberP118(qid) {
  const r = await sparql(`SELECT ?team ?teamLabel (COUNT(DISTINCT ?p) AS ?kader) WHERE {
    ?team wdt:P118 wd:${qid} .
    ?p p:P54 ?st . ?st ps:P54 ?team ; pq:P580 ?von .
    FILTER(YEAR(?von) >= ${KADER_AB})
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
  } GROUP BY ?team ?teamLabel HAVING(COUNT(DISTINCT ?p) >= ${KADER_MIN})`);
  return r.map((b) => ({ qid: qidVon(b.team.value), label: b.teamLabel.value, jahr: JETZT }));
}

/** Spielerzahl je Eintrag — das Unterscheidungsmerkmal zwischen Verein und Hülle. */
export async function spielerzahlen(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += 140) {
    const teil = qids.slice(i, i + 140);
    const r = await sparql(`SELECT ?team (COUNT(DISTINCT ?p) AS ?n) WHERE {
      VALUES ?team { ${teil.map((q) => "wd:" + q).join(" ")} }
      OPTIONAL { ?p p:P54/ps:P54 ?team }
    } GROUP BY ?team`);
    for (const b of r) out.set(qidVon(b.team.value), +b.n.value);
    await sleep(1100);
  }
  return out;
}

/* ── ZWEITMANNSCHAFTEN ────────────────────────────────────────────────────────
   Benfica B, Jong Ajax, Barça Atlètic: eigene Wikidata-Einträge, eigene Kader, und
   sie stehen wirklich in den zweiten Ligen. Für eine Laufbahn taugen sie trotzdem
   nicht — niemand „wechselt zu Porto B".

   Zwei Signale, und beide müssen eng sein.

   NICHT BRAUCHBAR IST P361 („Teil von"). Der Gedanke lag nahe — eine B-Mannschaft
   ist Teil ihres Vereins —, aber deutsche Fußballvereine sind in Wikidata Teil ihres
   GESAMTVEREINS, und der zählt ebenfalls als Fußballverein. Gemessen: Das Merkmal
   warf Kaiserslautern, Nürnberg, Hannover 96, den Karlsruher SC, 1860 München,
   Dynamo Dresden und Hansa Rostock hinaus, 37 Vereine insgesamt, und ließ die
   2. Bundesliga mit zwei Vereinen zurück.

   Bleiben P31 „Zweitmannschaft" und der Namenszusatz. Letzterer greift NUR, wenn der
   Mutterverein tatsächlich in unserer Welt steht — sonst verlöre „Willem II Tilburg"
   seinen Platz. Zusammen fangen sie die neun B-Mannschaften, die wirklich in den
   zweiten Ligen stehen. */
export const ZWEITMANNSCHAFT_QID = "Q2412834";

export async function zweitmannschaften(qids) {
  const out = new Set();
  for (let i = 0; i < qids.length; i += 140) {
    const teil = qids.slice(i, i + 140);
    const r = await sparql(`SELECT DISTINCT ?team WHERE {
      VALUES ?team { ${teil.map((q) => "wd:" + q).join(" ")} }
      ?team wdt:P31 wd:${ZWEITMANNSCHAFT_QID} .
    }`);
    for (const b of r) out.add(qidVon(b.team.value));
    await sleep(1100);
  }
  return out;
}

/** Namenszusatz als drittes Signal — nur gültig, wenn es den Mutterverein gibt. */
export function ueberName(name, namenInWelt) {
  const m = name.match(/^(.*?)\s+(?:B|II)$/) || name.match(/^Jong\s+(.*)$/);
  if (!m) return false;
  const mutter = m[1].trim().toLowerCase();
  return [...namenInWelt].some((n) => {
    const k = n.toLowerCase();
    return k !== name.toLowerCase() && (k === mutter || k.includes(mutter));
  });
}

/* ALLE Schlüssel, die es schon gibt: die 47 Spielvereine UND die Vereine aus
   leagueClubs.js. Letztere fehlten zuerst, und das war teuer: 41 Vereine bekamen ein
   neues Kürzel, obwohl die Spielerdaten sie unter dem alten führen — `cp` ist über
   den Schlüssel verknüpft, ein neuer trifft ins Leere, und der Verein steht ohne
   Kader da. */
export function alleBekanntenSchluessel() {
  const out = { ...CLUB_QID };
  for (const vs of Object.values(LIGA_VEREINE)) for (const v of vs) if (v.qid) out[v.key] = v.qid;
  return out;
}

/* Schlüssel: Wo ein Verein schon einen hat, behält er ihn. */
export function schluesselFuer(vereine, vorhanden = alleBekanntenSchluessel()) {
  const vonQid = new Map(Object.entries(vorhanden).map(([k, q]) => [q, k]));
  const belegt = new Set(Object.keys(vorhanden));
  const roh = (name) => (name.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().match(/[A-Z0-9]+/g) || ["X"]).join("");
  return vereine.map((v) => {
    if (vonQid.has(v.qid)) return { ...v, key: vonQid.get(v.qid) };
    const b = roh(v.label);
    for (const kand of [b.slice(0, 3), b.slice(0, 2) + b.slice(-1), b.slice(0, 4)]) {
      if (kand.length >= 2 && !belegt.has(kand)) { belegt.add(kand); return { ...v, key: kand }; }
    }
    let i = 1, kand;
    do { kand = b.slice(0, 2) + i++; } while (belegt.has(kand));
    belegt.add(kand);
    return { ...v, key: kand };
  });
}

async function main() {
  const probe = process.argv.includes("--probe");

  // 1) Rohzeilen je Liga aus beiden Quellen
  const zeilenProLiga = new Map();
  for (const liga of WELT_LIGEN) {
    const zeilen = [];
    if (liga.quelle !== "p118") { zeilen.push(...await ueberSaisons(liga.qid)); await sleep(1200); }
    if (liga.quelle !== "saison") { zeilen.push(...await ueberP118(liga.qid)); await sleep(1200); }
    zeilenProLiga.set(liga.key, zeilen);
    console.log(`  ${liga.key.padEnd(4)} ${liga.name.padEnd(16)} ${String(zeilen.length).padStart(4)} Zeilen, ${new Set(zeilen.map((z) => z.qid)).size} Einträge (${liga.quelle})`);
  }

  // 2) Spielerzahlen — Grundlage für Hülle-gegen-Verein
  const alleQids = [...new Set([...zeilenProLiga.values()].flat().map((z) => z.qid))];
  console.log(`\nSpielerzahlen für ${alleQids.length} Einträge …`);
  const spieler = await spielerzahlen(alleQids);

  /* 3) Je Liga entdoppeln: „FC Bayern München" steht als Verein UND als
     Herrenfußballmannschaft in den Listen. loeseAuf gruppiert nach Namen und behält
     den Eintrag mit den meisten Spielern — dieselbe Regel wie in leagueClubs.js. */
  const proLiga = new Map();
  for (const liga of WELT_LIGEN) proLiga.set(liga.key, loeseAuf(zeilenProLiga.get(liga.key), spieler));

  /* 4) Ein Verein gehört in GENAU EINE Liga — in die, in der er ZULETZT spielte.
     Die naheliegende Regel „höhere Spielklasse gewinnt" ist falsch: Jeder Verein,
     der seit 2010 einmal oben war, landete damit in der ersten Liga, und die
     Championship behielt 12 Vereine für 24 Plätze. */
  const nachName = new Map();
  for (const liga of WELT_LIGEN) {
    for (const v of proLiga.get(liga.key)) {
      const letztes = Math.max(...v.jahre);
      const bisher = nachName.get(v.name);
      if (!bisher || letztes > bisher.letztes || (letztes === bisher.letztes && liga.stufe < bisher.stufe))
        nachName.set(v.name, { ...v, lg: liga.key, stufe: liga.stufe, letztes });
    }
  }

  /* 5) Aussortieren: Zweitmannschaften und Einträge ohne brauchbaren Namen. Ein
     Label der Form „Q123456" darf nie als Vereinsname in die Datei. */
  const kandidaten = [...nachName.values()].filter((v) => cleanName(v.name));
  console.log(`\n${nachName.size - kandidaten.length} Einträge ohne brauchbaren Namen verworfen`);
  const namen = new Set(kandidaten.map((v) => v.name));
  const zweit = await zweitmannschaften(kandidaten.map((v) => v.qid));
  const istZweit = (v) => zweit.has(v.qid) || ueberName(v.name, namen);
  const raus = kandidaten.filter(istZweit);
  const behalten = kandidaten.filter((v) => !istZweit(v));
  console.log(`${raus.length} Zweitmannschaften aussortiert: ${raus.map((v) => v.name).join(", ") || "keine"}`);

  const vereine = schluesselFuer(behalten.map((v) => ({ ...v, label: v.name })))
    .sort((a, b) => a.lg.localeCompare(b.lg) || a.label.localeCompare(b.label, "de"));
  console.log(`\n${vereine.length} Vereine insgesamt, ${new Set(vereine.map((v) => v.key)).size} eindeutige Schlüssel`);
  for (const liga of WELT_LIGEN)
    console.log(`  ${liga.key.padEnd(4)} Stufe ${liga.stufe} · ${String(vereine.filter((v) => v.lg === liga.key).length).padStart(3)} von ${liga.plaetze} Plätzen`);
  if (probe) { console.log(vereine.slice(0, 15)); return; }

  const kopf = `/* Die Vereinswelt des Karriere-Modus — erzeugt von
   data-pipeline/wikidata_career_world.mjs, nicht von Hand ändern.

   Anders als LIGA_VEREINE in leagueClubs.js trägt diese Liste KEINE Jahre: Die
   Saisons des Karriere-Modus sind abstrakt. Ein Verein steht in genau einer Liga —
   bei Auf- und Absteigern in der höheren, in der er zuletzt spielte.

   \`stufe\` ist die Spielklasse. Sie ist der Grund, warum es diese Datei gibt:
   Ohne zweite Ligen gäbe es keine Leihe nach unten und keinen Aufstieg. */\n`;
  const ligenText = WELT_LIGEN.map((l) =>
    `  { key: ${JSON.stringify(l.key)}, name: ${JSON.stringify(l.name)}, land: ${JSON.stringify(l.land)}, stufe: ${l.stufe}, plaetze: ${l.plaetze} },`).join("\n");
  const vereineText = vereine.map((v) =>
    `  { key: ${JSON.stringify(v.key)}, name: ${JSON.stringify(v.label)}, qid: ${JSON.stringify(v.qid)}, lg: ${JSON.stringify(v.lg)} },`).join("\n");
  writeFileSync(ZIEL,
    `${kopf}export const WELT_LIGEN = [\n${ligenText}\n];\n\nexport const WELT_VEREINE = [\n${vereineText}\n];\n`);
  stampDataInfo();
  console.log(`-> src/careerWorld.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
