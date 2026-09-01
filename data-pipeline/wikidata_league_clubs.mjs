#!/usr/bin/env node
/*
 * wikidata_league_clubs.mjs — welcher Verein spielte in welcher Saison in welcher
 * Liga? Schreibt src/leagueClubs.js. Internet nötig. Idempotent.
 *
 *   node data-pipeline/wikidata_league_clubs.mjs
 *   node data-pipeline/wikidata_league_clubs.mjs --ab 2010 --probe
 *
 * WOFÜR: Die Traumelf ließ ihre Elf bisher gegen zusammengewürfelte Verein-Saison-
 * Paare antreten — Bayern 2014 gegen Werder 1996 in derselben Tabelle. Mit dieser
 * Liste tritt sie stattdessen in einer ECHTEN Liga einer ECHTEN Saison an, mit genau
 * den Vereinen, die damals dabei waren.
 *
 * ── DIE DOPPELTEN VEREINE ───────────────────────────────────────────────────
 * Wikidata führt für viele Vereine ZWEI Einträge: den Verein („Sportverein",
 * „Fußballverein") und die Männermannschaft („Herrenfußballmannschaft"). Ältere
 * Saisons verlinken den einen, neuere den anderen. Gemessen:
 *
 *   FC Bayern München  Q15789     Fußballverein            824 Spieler
 *   FC Bayern München  Q97905919  Herrenfußballmannschaft    2 Spieler
 *   FC Augsburg        Q15755     Fußballverein            340 Spieler
 *   FC Augsburg        Q97905916  Herrenfußballmannschaft    0 Spieler
 *
 * Die Bundesliga 2025/26 verlinkt AUSSCHLIESSLICH die leeren Hüllen — ohne
 * Auflösung hätte die neueste Saison achtzehn Vereine ohne einen einzigen Spieler.
 *
 * Aufgelöst wird über den Namen: Unter allen Teilnehmern mit demselben deutschen
 * Label gewinnt der mit den meisten Spielern. Das ist robuster als P361 („Teil
 * von"), denn Augsburgs Mannschaftseintrag trägt das gar nicht.
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { norm } from "../src/gameData.js";
import { CLUB_QID } from "./wikidata_roster.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(HERE, "..", "src", "leagueClubs.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Die drei Ligen als Wikidata-Objekte. */
export const LIGA_QID = { BL: "Q82595", PL: "Q9448", LL: "Q324867" };

async function sparql(query) {
  for (let a = 0; a < 5; a++) {
    let res;
    try {
      res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
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

const qidVon = (uri) => (uri ? uri.split("/").pop() : null);

/* Hülle -> echter Verein, gefüllt von der Nachbesserung in main(). */
const ERSATZ = new Map();

/**
 * Aus Teilnehmerzeilen die aufgelöste Vereinsliste bauen.
 *
 * @param zeilen  { qid, label, jahr } je Teilnahme
 * @param spieler Map qid -> Spielerzahl
 */
export function loeseAuf(zeilen, spieler) {
  /* Nach Namen gruppieren — die Dubletten heißen gleich, das ist der Anker. */
  const proName = new Map();
  for (const z of zeilen) {
    const k = norm(z.label);
    if (!proName.has(k)) proName.set(k, { label: z.label, qids: new Set(), jahre: new Set() });
    const e = proName.get(k);
    e.qids.add(z.qid);
    e.jahre.add(z.jahr);
    /* Das längere Label gewinnt: „FC Bayern München" statt „Bayern München". */
    if (z.label.length > e.label.length) e.label = z.label;
  }
  const out = [];
  for (const e of proName.values()) {
    /* Der Eintrag mit den meisten Spielern ist der echte Verein; die
       Mannschafts-Hülle hat null bis zwei. */
    const beste = [...e.qids].sort((a, b) => (spieler.get(b) || 0) - (spieler.get(a) || 0))[0];
    out.push({ qid: ERSATZ.get(beste) || beste, name: e.label, jahre: [...e.jahre].sort((a, b) => a - b), qids: [...e.qids].sort() });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/* Übliche Kürzel für die Vereine, bei denen der Automat etwas Unbrauchbares
   erzeugt. Real Sociedad bekäme sonst „RS3" (hinter Racing Santander und Real
   Saragossa), Köln „KL", Stoke City „SC" — verwechselbar mit „SCF" für Freiburg.
   Die Schlüssel landen dauerhaft in `cp`, deshalb lohnt sich die Handarbeit. */
export const SCHLUESSEL_UEBERSTEUERUNG = {
  // Bundesliga
  "1. FC Köln": "KOE", "Hertha BSC": "BSC", "1. FC Nürnberg": "FCN",
  "1. FC Kaiserslautern": "FCK", "1. FC Union Berlin": "FCU", "FC St. Pauli": "STP",
  "Hannover 96": "H96", "Fortuna Düsseldorf": "F95", "SpVgg Greuther Fürth": "SGF",
  "SV Darmstadt 98": "SVD", "Arminia Bielefeld": "DSC", "Eintracht Braunschweig": "EBS",
  "Holstein Kiel": "KSV",
  // Premier League
  "Stoke City": "STK", "Swansea City": "SWA", "Wigan Athletic": "WIG",
  "Hull City": "HUL", "Leeds United": "LEE", "Leicester City": "LEI",
  "Nottingham Forest": "NFO", "Sheffield United": "SHU", "Birmingham City": "BIR",
  "Blackburn Rovers": "BLB", "Bolton Wanderers": "BOL", "Cardiff City": "CAR",
  "Huddersfield Town": "HUD", "Ipswich Town": "IPS", "Luton Town": "LUT",
  "Norwich City": "NOR", "Wolverhampton Wanderers": "WOL",
  // La Liga
  "Athletic Bilbao": "ATH", "Espanyol Barcelona": "ESP", "Real Sociedad": "RSO",
  "Racing de Santander": "RAC", "Real Saragossa": "ZAR", "Rayo Vallecano": "RAY",
  "Real Valladolid": "VLL", "Betis Sevilla": "BET", "Celta Vigo": "CEL",
  "Deportivo A Coruña": "DEP", "Deportivo Alavés": "ALA", "FC Cádiz": "CAD",
  "FC Córdoba": "COR", "FC Málaga": "MLG", "Hércules Alicante": "HER",
  "Real Oviedo": "OVI", "Sporting Gijón": "SPG", "UD Las Palmas": "LPA",
};

/**
 * Ein kurzer, eindeutiger Schlüssel je Verein.
 *
 * Bestehende Vereine behalten ihren Schlüssel aus CLUB_QID — `cp` in players.js ist
 * voll davon, und ein Wechsel würde jede Karriere zerreißen. Neue bekommen die
 * Anfangsbuchstaben ihrer bedeutungstragenden Wörter; bei Gleichstand wird
 * durchnummeriert.
 */
export function baueSchluessel(vereine, vorhanden = CLUB_QID) {
  const nachQid = new Map(Object.entries(vorhanden).map(([k, q]) => [q, k]));
  const belegt = new Set(Object.keys(vorhanden));
  /* Rechtsformen und Füllwörter tragen nichts zur Unterscheidung bei — „FC" steht
     vor jedem zweiten Verein. */
  const FUELL = /^(fc|sc|sv|vf[bl]|tsg|ac|as|ss|ssc|afc|cf|cd|ca|ud|rcd|sd|spvgg|1|04|05|07|96|98|99|de|of|the|und|and)$/i;
  const out = new Map();
  for (const v of vereine) {
    const alt = nachQid.get(v.qid);
    if (alt) { out.set(v.qid, alt); continue; }
    const fest = SCHLUESSEL_UEBERSTEUERUNG[v.name];
    if (fest && !belegt.has(fest)) { belegt.add(fest); out.set(v.qid, fest); continue; }
    const woerter = v.name.split(/[\s.\-']+/).filter((w) => w && !FUELL.test(w));
    let basis = (woerter.length >= 2
      ? woerter.map((w) => w[0]).join("")
      : (woerter[0] || v.name).slice(0, 3)
    ).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (basis.length < 2) basis = norm(v.name).replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
    let key = basis, n = 2;
    while (belegt.has(key)) key = `${basis}${n++}`.slice(0, 5);
    belegt.add(key);
    out.set(v.qid, key);
  }
  return out;
}

async function main() {
  const probe = process.argv.includes("--probe");
  const abIdx = process.argv.indexOf("--ab");
  const ab = abIdx > 0 ? parseInt(process.argv[abIdx + 1], 10) : 2010;

  const zeilen = [];
  const proLiga = {};
  for (const [lg, qid] of Object.entries(LIGA_QID)) {
    const r = await sparql(`
      SELECT ?team ?teamLabel ?jahr WHERE {
        ?saison wdt:P3450 wd:${qid} ; wdt:P580 ?start ; wdt:P1923 ?team .
        BIND(YEAR(?start) AS ?jahr) FILTER(?jahr >= ${ab})
        SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
      }`);
    proLiga[lg] = r.map((b) => ({ qid: qidVon(b.team.value), label: b.teamLabel.value, jahr: +b.jahr.value }));
    zeilen.push(...proLiga[lg]);
    console.log(`${lg}: ${r.length} Teilnahmen, ${new Set(proLiga[lg].map((x) => x.qid)).size} Einträge`);
    await sleep(1200);
  }

  /* Spielerzahl je Eintrag — das Unterscheidungsmerkmal zwischen Verein und Hülle. */
  const alle = [...new Set(zeilen.map((z) => z.qid))];
  const spieler = new Map();
  for (let i = 0; i < alle.length; i += 120) {
    const teil = alle.slice(i, i + 120);
    const r = await sparql(`
      SELECT ?team (COUNT(DISTINCT ?p) AS ?n) WHERE {
        VALUES ?team { ${teil.map((q) => "wd:" + q).join(" ")} }
        OPTIONAL { ?p p:P54/ps:P54 ?team }
      } GROUP BY ?team`);
    for (const b of r) spieler.set(qidVon(b.team.value), +b.n.value);
    console.log(`  Spielerzahlen ${Math.min(i + 120, alle.length)}/${alle.length}`);
    await sleep(1200);
  }

  /* NACHBESSERUNG: Vier Vereine tauchen nur in Saisons auf, die ausschließlich die
     Mannschafts-Hülle verlinken — Heidenheim, Arminia Bielefeld, Holstein Kiel und
     Bochum. Dort gibt es innerhalb der Teilnehmer nichts zu vergleichen, und der
     Namensabgleich wählt die leere Hülle, weil sie die einzige Wahl ist. Diese
     wenigen werden über ihren Namen direkt in Wikidata gesucht. */
  const vorlaeufig = Object.values(proLiga).flatMap((zs) => loeseAuf(zs, spieler));
  const duenn = vorlaeufig.filter((v) => (spieler.get(v.qid) || 0) < 30);
  if (duenn.length) {
    console.log(`\n${duenn.length} Vereine mit fast leerem Eintrag — Namenssuche:`);
    const r = await sparql(`
      SELECT ?club ?clubLabel (COUNT(DISTINCT ?p) AS ?n) WHERE {
        VALUES ?l { ${duenn.map((v) => `"${v.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"@de`).join(" ")} }
        ?club rdfs:label|skos:altLabel ?l ; wdt:P31/wdt:P279* wd:Q476028 .
        ?p p:P54/ps:P54 ?club .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
      } GROUP BY ?club ?clubLabel`);
    /* Erst P361 („Teil von"): Die Hülle zeigt meist auf ihren Verein, und das ist
       eine Aussage von Wikidata selbst statt eines Namensvergleichs. Heidenheims
       Verein heißt „1. FC Heidenheim 1846" und wäre über den Namen nie gefunden
       worden. */
    const ueberP361 = await sparql(`
      SELECT ?huelle ?club (COUNT(DISTINCT ?p) AS ?n) WHERE {
        VALUES ?huelle { ${duenn.map((v) => "wd:" + v.qid).join(" ")} }
        ?huelle wdt:P361 ?club .
        ?p p:P54/ps:P54 ?club .
      } GROUP BY ?huelle ?club`);
    for (const b of ueberP361) {
      const huelle = qidVon(b.huelle.value), club = qidVon(b.club.value);
      if (+b.n.value > 30) { ERSATZ.set(huelle, club); console.log(`  ${huelle} -> ${club} über P361 (${b.n.value} Spieler)`); }
    }
    await sleep(1200);

    const proName = new Map();
    for (const b of r) {
      const k = norm(b.clubLabel.value);
      const n = +b.n.value;
      if (!proName.has(k) || proName.get(k).n < n) proName.set(k, { qid: qidVon(b.club.value), n });
    }
    for (const v of duenn) {
      if (ERSATZ.has(v.qid)) continue;
      const treffer = proName.get(norm(v.name));
      if (treffer && treffer.n > (spieler.get(v.qid) || 0)) {
        /* Die Hülle bleibt als Alias bekannt: Die Saisonlisten verlinken weiter sie,
           und der Kaderabruf muss beide QIDs kennen. */
        console.log(`  ${v.name}: ${v.qid} (${spieler.get(v.qid) || 0}) -> ${treffer.qid} (${treffer.n})`);
        ERSATZ.set(v.qid, treffer.qid);
      } else {
        console.log(`  ${v.name}: kein besserer Eintrag gefunden`);
      }
    }
    await sleep(1200);
  }

  const ergebnis = {};
  let neu = 0;
  const schluessel = baueSchluessel(
    Object.values(proLiga).flatMap((zs) => loeseAuf(zs, spieler)),
  );
  for (const [lg, zs] of Object.entries(proLiga)) {
    const vereine = loeseAuf(zs, spieler);
    ergebnis[lg] = vereine.map((v) => ({ key: schluessel.get(v.qid), name: v.name, qid: v.qid, jahre: v.jahre }));
    const bekannt = new Set(Object.keys(CLUB_QID));
    neu += ergebnis[lg].filter((v) => !bekannt.has(v.key)).length;
    console.log(`${lg}: ${vereine.length} Vereine aufgelöst (${zs.length} Teilnahmen)`);
  }
  console.log(`\n${neu} neue Vereine gegenüber den ${Object.keys(CLUB_QID).length} Spielvereinen`);
  if (probe) {
    for (const [lg, v] of Object.entries(ergebnis)) console.log(`\n${lg}: ` + v.map((x) => `${x.key} ${x.name} [${x.jahre.length}]`).join(" · "));
    return;
  }
  schreibe(ergebnis, ab);
}

export function schreibe(ergebnis, ab, pfad = OUT_PATH) {
  const teile = Object.entries(ergebnis).map(([lg, v]) =>
    `  ${lg}: [\n` + v.map((x) => `    { key: ${JSON.stringify(x.key)}, name: ${JSON.stringify(x.name)}, qid: ${JSON.stringify(x.qid)}, jahre: [${x.jahre.join(",")}] },`).join("\n") + "\n  ],");
  writeFileSync(pfad, `/* Wer spielte wann in welcher Liga — aus Wikidata (P3450 Saison, P1923 Teilnehmer).
   Erzeugt von data-pipeline/wikidata_league_clubs.mjs — nicht von Hand ändern.

   \`jahre\` ist das ANFANGSJAHR der Saison: 2025 heißt 2025/26.

   Diese Vereine sind KEINE Spielvereine. Sie tragen keine Hexfelder, keine Wappen
   und keine Farben — sie existieren, damit die Traumelf in einer echten Liga
   antreten kann statt gegen zusammengewürfelte Jahrgänge. Die 47 Spielvereine in
   gameData.js bleiben davon unberührt; wo ein Verein beides ist, teilen sie sich
   den Schlüssel. */
export const LIGA_VEREINE = {
${teile.join("\n")}
};

/** Die neueste Saison je Liga, für die Wikidata Teilnehmer führt. */
export const NEUESTE_SAISON = {
${Object.entries(ergebnis).map(([lg, v]) => `  ${lg}: ${Math.max(...v.flatMap((x) => x.jahre))},`).join("\n")}
};

export const LIGA_AB_JAHR = ${ab};
`);
  console.log(`geschrieben: ${pfad}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
