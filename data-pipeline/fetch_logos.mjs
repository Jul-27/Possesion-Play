#!/usr/bin/env node
/*
 * fetch_logos.mjs — lädt Vereins-Badges + Liga-Logos von TheSportsDB (Key "3")
 * nach public/logos/{club,league}/<KEY>.png. Verifikationspflicht: Land bzw.
 * Liga-Name muss zur Erwartung passen, sonst MISS (kein falsches Logo).
 * Idempotent, wiederholbar.   node data-pipeline/fetch_logos.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "logos");
const API = "https://www.thesportsdb.com/api/v1/json/3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Key -> [API-Suchname, erwartetes Land (String oder Liste)]
const CLUB_SEARCH = {
  FCB: ["Bayern Munich", "Germany"], BVB: ["Borussia Dortmund", "Germany"],
  RBL: ["RB Leipzig", "Germany"], B04: ["Bayer Leverkusen", "Germany"],
  SGE: ["Eintracht Frankfurt", "Germany"], BMG: ["Borussia Monchengladbach", "Germany"],
  VFB: ["VfB Stuttgart", "Germany"], WOB: ["VfL Wolfsburg", "Germany"], SVW: ["Werder Bremen", "Germany"],
  MCI: ["Manchester City", "England"], MUN: ["Manchester United", "England"],
  LIV: ["Liverpool", "England"], CHE: ["Chelsea", "England"], ARS: ["Arsenal", "England"],
  TOT: ["Tottenham Hotspur", "England"], NEW: ["Newcastle United", "England"],
  EVE: ["Everton", "England"], AVL: ["Aston Villa", "England"],
  BAR: ["Barcelona", "Spain"], RMA: ["Real Madrid", "Spain"], ATM: ["Atletico Madrid", "Spain"],
  SEV: ["Sevilla", "Spain"], VAL: ["Valencia", "Spain"], VIL: ["Villarreal", "Spain"],
  JUV: ["Juventus", "Italy"], MIL: ["AC Milan", "Italy"], INT: ["Inter Milan", "Italy"],
  NAP: ["Napoli", "Italy"], ROM: ["AS Roma", "Italy"], LAZ: ["Lazio", "Italy"],
  PSG: ["Paris SG", "France"], ASM: ["Monaco", ["France", "Monaco"]],
  OM: ["Marseille", "France"], OL: ["Lyon", "France"], LIL: ["Lille OSC", "France"],
  POR: ["Porto", "Portugal"], SLB: ["Benfica", "Portugal"], SCP: ["Sporting CP", "Portugal"],
  AJA: ["Ajax", ["Netherlands", "The Netherlands"]], PSV: ["PSV Eindhoven", ["Netherlands", "The Netherlands"]],
  FEY: ["Feyenoord", ["Netherlands", "The Netherlands"]],
};

// Liga-Key -> [TheSportsDB-Liga-ID, erwarteter Namensbestandteil]
const LEAGUE_IDS = {
  PL: [4328, "Premier League"], BL: [4331, "Bundesliga"], SA: [4332, "Serie A"],
  L1: [4334, "Ligue 1"], LL: [4335, "La Liga"], NL: [4337, "Eredivisie"], PT: [4344, "Primeira"],
};

// Rate-Limit-fest: bei 429 bis zu 3× je 65 s warten (freier Key: ~30 Req/min).
async function fetchOk(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url);
    if (r.status === 429) { console.log("    … 429, warte 65 s"); await sleep(65000); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  }
  throw new Error("HTTP 429 (Retries erschöpft)");
}
const getJson = async (url) => (await fetchOk(url)).json();
async function download(url, path) {
  writeFileSync(path, Buffer.from(await (await fetchOk(url)).arrayBuffer()));
}

async function main() {
  mkdirSync(join(OUT, "club"), { recursive: true });
  mkdirSync(join(OUT, "league"), { recursive: true });
  const miss = [];

  for (const [key, [name, country]] of Object.entries(CLUB_SEARCH)) {
    if (existsSync(join(OUT, "club", key + ".png"))) { console.log(`  club ${key}: vorhanden, übersprungen`); continue; }
    try {
      const j = await getJson(`${API}/searchteams.php?t=${encodeURIComponent(name)}`);
      const ok = [].concat(country);
      const team = (j.teams || []).find((t) => t.strSport === "Soccer" && ok.includes(t.strCountry) && t.strBadge);
      if (!team) { miss.push(`club ${key} (${name}): kein verifizierter Treffer`); continue; }
      await download(team.strBadge, join(OUT, "club", key + ".png"));
      console.log(`  club ${key}: ${team.strTeam} ✓`);
    } catch (e) { miss.push(`club ${key}: ${e.message}`); }
    await sleep(2500);
  }

  for (const [key, [id, expect]] of Object.entries(LEAGUE_IDS)) {
    if (existsSync(join(OUT, "league", key + ".png"))) { console.log(`  league ${key}: vorhanden, übersprungen`); continue; }
    try {
      const j = await getJson(`${API}/lookupleague.php?id=${id}`);
      const lg = j.leagues?.[0];
      if (!lg || !(lg.strLeague || "").includes(expect) || !lg.strBadge) {
        miss.push(`league ${key} (${id}): "${lg?.strLeague}" passt nicht zu "${expect}"`); continue;
      }
      await download(lg.strBadge, join(OUT, "league", key + ".png"));
      console.log(`  league ${key}: ${lg.strLeague} ✓`);
    } catch (e) { miss.push(`league ${key}: ${e.message}`); }
    await sleep(2500);
  }

  console.log(miss.length ? `\nMISS (${miss.length}):\n  ` + miss.join("\n  ") : "\nAlle 48 Logos geladen.");
}
main();
