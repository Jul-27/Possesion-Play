#!/usr/bin/env node
/*
 * hole_pokalfotos.mjs — holt je Wettbewerb ein Foto der ECHTEN Trophäe.
 *
 *   node data-pipeline/hole_pokalfotos.mjs [--probe]
 *
 * ── ACHTUNG: LIZENZ ─────────────────────────────────────────────────────────
 * Die meisten dieser Fotos sind NICHT frei lizenziert, und die Trophäen selbst
 * sind geschützte Entwürfe. Der Eigentümer dieses Spiels hat ausdrücklich
 * entschieden, sie trotzdem einzusetzen, weil das Spiel privat bleibt und nie
 * veröffentlicht wird. Steht eine Veröffentlichung an, müssen die Dateien unter
 * public/bilder/trophaee/titel/ ersatzlos weg — der Rückfall auf die erzeugten
 * Aufnahmen und die gezeichneten Formen greift dann von selbst.
 * Siehe public/bilder/trophaee/titel/LIZENZ.md.
 *
 * ── WIE GESUCHT WIRD ────────────────────────────────────────────────────────
 * Über die Wikipedia-Suche je Sprachversion: erst der Artikel, dann sein
 * Hauptbild (pageimages). Deutsch zuerst, Englisch als Rückfall — die
 * englische Wikipedia führt mehr Pokalfotos, die deutsche dafür die besseren
 * Artikel zu deutschen Wettbewerben.
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HERE, "..", "public", "bilder", "trophaee", "titel");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; private project)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Je Titelschlüssel die Suchbegriffe, beste zuerst. Sprache steckt im Präfix. */
export const SUCHE = {
  CL:  [["de", "UEFA Champions League Pokal"], ["en", "European Champion Clubs' Cup trophy"], ["en", "UEFA Champions League trophy"]],
  EL:  [["en", "UEFA Europa League Trophy"], ["de", "UEFA Europa League Pokal"]],
  WM:  [["de", "FIFA-WM-Pokal"], ["en", "FIFA World Cup Trophy"]],
  EM:  [["de", "Coupe Henri Delaunay"], ["en", "Henri Delaunay Trophy"]],
  CA:  [["en", "Copa América trophy"], ["es", "Copa América trofeo"]],
  BDO: [["de", "Ballon d’Or"], ["en", "Ballon d'Or"]],
  MBL: [["de", "Meisterschale"], ["en", "Meisterschale"]],
  MPL: [["en", "Premier League trophy"], ["en", "Premier League"]],
  MLL: [["en", "La Liga trophy"], ["es", "Trofeo de La Liga"]],
  MSA: [["it", "Coppa Campioni d'Italia"], ["en", "Scudetto"]],
  ML1: [["fr", "Hexagoal"], ["en", "Hexagoal"]],
  MPT: [["pt", "Taça da Primeira Liga"], ["en", "Primeira Liga trophy"]],
  MNL: [["nl", "Eredivisie schaal"], ["en", "Eredivisie trophy"]],
  MAT: [["de", "Österreichische Fußballmeisterschaft Trophäe"], ["de", "Österreichische Fußball-Bundesliga"]],
  MBR: [["pt", "Taça do Campeonato Brasileiro"], ["en", "Campeonato Brasileiro Série A trophy"]],
  MML: [["en", "Philip F. Anschutz Trophy"], ["en", "MLS Cup"]],
  MSP: [["en", "Saudi Pro League trophy"], ["en", "Saudi Professional League"]],
  MJP: [["en", "J1 League trophy"], ["ja", "J1リーグ"]],
  DFB: [["de", "DFB-Pokal Trophäe"], ["de", "DFB-Pokal"]],
  FAC: [["en", "FA Cup Trophy"], ["en", "FA Cup"]],
  CDR: [["es", "Trofeo Copa del Rey"], ["en", "Copa del Rey trophy"]],
  CIT: [["it", "Coppa Italia trofeo"], ["en", "Coppa Italia"]],
  CDF: [["fr", "Trophée Coupe de France"], ["en", "Coupe de France"]],
  TDP: [["pt", "Taça de Portugal troféu"], ["en", "Taça de Portugal"]],
  KNV: [["nl", "KNVB beker trofee"], ["en", "KNVB Cup"]],
  OFB: [["de", "ÖFB-Cup Trophäe"], ["de", "ÖFB-Cup"]],
};

async function api(sprache, params) {
  const url = `https://${sprache}.wikipedia.org/w/api.php?format=json&origin=*&` + new URLSearchParams(params);
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/** Das Hauptbild des besten Treffers — oder null. */
export async function bildFuer(sprache, begriff) {
  const suche = await api(sprache, {
    action: "query", list: "search", srsearch: begriff, srlimit: "3", prop: "",
  });
  for (const treffer of suche.query?.search || []) {
    const seite = await api(sprache, {
      action: "query", titles: treffer.title, prop: "pageimages", piprop: "original|thumbnail",
      pithumbsize: "600",
    });
    const s = Object.values(seite.query?.pages || {})[0];
    const quelle = s?.original?.source || s?.thumbnail?.source;
    if (quelle) return { titel: treffer.title, quelle, sprache };
    await sleep(200);
  }
  return null;
}

async function main() {
  const probe = process.argv.includes("--probe");
  if (!probe) mkdirSync(ZIEL, { recursive: true });
  const gefunden = [], leer = [];
  for (const [key, versuche] of Object.entries(SUCHE)) {
    let treffer = null;
    for (const [sprache, begriff] of versuche) {
      try { treffer = await bildFuer(sprache, begriff); } catch (e) { console.log(`  ${key}: ${e.message}`); }
      await sleep(350);
      if (treffer) break;
    }
    if (!treffer) { leer.push(key); console.log(`  ${key.padEnd(4)} — nichts gefunden`); continue; }
    console.log(`  ${key.padEnd(4)} ${treffer.sprache}:${treffer.titel} -> ${treffer.quelle.split("/").pop().slice(0, 50)}`);
    gefunden.push({ key, ...treffer });
    if (probe) continue;
    try {
      const bild = await fetch(treffer.quelle, { headers: { "User-Agent": UA } });
      const endung = (treffer.quelle.match(/\.(jpe?g|png|svg)$/i) || [".jpg"])[0].toLowerCase().replace("jpeg", "jpg");
      writeFileSync(join(ZIEL, key + endung), Buffer.from(await bild.arrayBuffer()));
    } catch (e) { console.log(`  ${key}: Download fehlgeschlagen (${e.message})`); }
    await sleep(300);
  }
  console.log(`\n${gefunden.length} gefunden, ${leer.length} ohne Bild: ${leer.join(" ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
