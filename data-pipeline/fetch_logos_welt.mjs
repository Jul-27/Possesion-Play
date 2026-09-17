#!/usr/bin/env node
/*
 * fetch_logos_welt.mjs — holt die Vereinswappen für die Karriere-Welt
 * (src/careerWorld.js) von TheSportsDB nach public/logos/club/<KEY>.png.
 *
 *   node data-pipeline/fetch_logos_welt.mjs
 *   node data-pipeline/fetch_logos_welt.mjs --probe        # nichts schreiben
 *   node data-pipeline/fetch_logos_welt.mjs --nur BL2      # eine Liga
 *
 * VERHÄLTNIS ZU fetch_logos.mjs: Jenes Skript versorgt die 47 Spielvereine über
 * eine von Hand gepflegte Tabelle aus Suchname und erwartetem Land. Für 361
 * Vereine ist das nicht zu pflegen, deshalb leitet dieses Skript die Suchbegriffe
 * ab — aus dem Vereinsnamen, dem Land seiner Liga und einer kleinen Liste
 * deutscher Ortsformen. Beide schreiben in dasselbe Verzeichnis, und beide
 * überspringen, was schon da ist.
 *
 * ── DIE REGEL: LIEBER EINE LÜCKE ALS EIN FALSCHES WAPPEN ────────────────────
 * Ein Verein ohne Datei bekommt in der Oberfläche den gezeichneten Farbkreis —
 * das fällt kaum auf. Ein FALSCHES Wappen fällt jedem auf, der den Verein kennt.
 * Deshalb wird jeder Treffer geprüft, bevor er geladen wird:
 *
 *   Fußball · Land passt zur Liga · Wappen vorhanden · KEINE Frauenmannschaft ·
 *   keine Jugend-, Reserve- oder Zweitmannschaft
 *
 * Die Geschlechtsprüfung ist nicht theoretisch: Die Suche nach „AFC Bournemouth"
 * liefert als einzigen Treffer „AFC Bournemouth Women". Ohne sie stünde auf dem
 * Spielfeld das Wappen der Frauenmannschaft.
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { WELT_VEREINE, WELT_LIGEN } from "../src/careerWorld.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "logos", "club");
const API = "https://www.thesportsdb.com/api/v1/json/3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Unser Ligaland -> die Länder, die TheSportsDB dafür führt. Monaco steht bei
   Frankreich, weil die AS Monaco in der Ligue 1 spielt, aber in Monaco liegt. */
export const LAND = {
  GER: ["Germany"], ENG: ["England", "Wales"], ESP: ["Spain", "Andorra"], ITA: ["Italy"],
  FRA: ["France", "Monaco"], PRT: ["Portugal"], NED: ["Netherlands", "The Netherlands"],
  AUT: ["Austria"],
  /* Die vier Ligen ausserhalb Europas, nachgetragen am 16.09.2026. Ohne Eintrag
     scheiterte jeder Treffer an der Länderprüfung, und alle 97 neuen Vereine
     blieben ohne Wappen — nicht weil die Quelle sie nicht kennt, sondern weil wir
     ihr Land nicht kannten. Kanada steht bei USA, weil Toronto, Montreal und
     Vancouver in der MLS spielen. */
  BRA: ["Brazil"], USA: ["USA", "United States", "Canada"],
  SAU: ["Saudi Arabia"], JPN: ["Japan"],
};
/* Andorra steht bei ESP, Monaco bei FRA und Wales bei ENG: Diese Vereine spielen in
   der Liga des Nachbarlandes, und die Quelle führt sie unter ihrem eigenen Land.
   Ohne die Ausnahme fiel der FC Andorra durch die Länderprüfung und blieb ohne
   Wappen, obwohl die Quelle ihn kennt. */

/* Deutsche Ortsformen, die TheSportsDB nicht kennt. Gemessen: siebzehn unserer
   Vereinsnamen tragen eine — fast alle italienisch, weil dort die deutsche
   Schreibweise die Stadt übersetzt („AC Florenz" statt „Fiorentina"). */
export const EXONYME = {
  "AC Florenz": "Fiorentina", "AS Rom": "Roma", "Lazio Rom": "Lazio",
  "Inter Mailand": "Inter Milan", "Juventus Turin": "Juventus", "FC Turin": "Torino",
  "SSC Neapel": "Napoli", "Atalanta Bergamo": "Atalanta", "CFC Genua": "Genoa",
  "Sampdoria Genua": "Sampdoria", "FC Venedig": "Venezia",
  "Benfica Lissabon": "Benfica", "Sporting Lissabon": "Sporting CP",
  "Belenenses Lissabon": "Belenenses", "Real Saragossa": "Real Zaragoza",
  "OGC Nizza": "Nice", "Girondins Bordeaux": "Bordeaux",
  /* Nachgetragen nach dem ersten Lauf — jeder Eintrag hier ist geprüft, nicht
     geraten: Die Suche wurde einzeln ausgeführt und der Treffer angesehen. */
  "Betis Sevilla": "Real Betis", "Sporting Braga": "Braga",
  "Racing Straßburg": "Strasbourg", "CD Teneriffa": "Tenerife",
  "Willem II Tilburg": "Willem II",

  /* Zweiter Nachtrag (14.09.2026): die zehn Vereine, die nach dem Lauf ohne Wappen
     dastanden. Jeder Begriff wurde einzeln gegen die Quelle probiert und der Treffer
     angesehen — „Brighton" allein liefert das Frauenteam, „Nottingham Forest" eine
     Netball-Mannschaft, „Red Star FC" den belgischen SK Beveren. Die Länderprüfung
     hat diese Fehlgriffe abgefangen; hier stehen die Begriffe, die treffen. */
  "Brighton & Hove Albion": "Brighton and Hove Albion",
  "Red Star Paris": "Red Star",
  "FC Oss": "TOP Oss",
  "Roda JC Kerkrade": "Roda JC",
  "Nacional Funchal": "Clube Desportivo Nacional",
  "Real SC Queluz": "Real SC",
  "SC União Torreense": "Torreense",

  /* Dritter Nachtrag (17.09.2026): die Ligen ausserhalb Europas. Wieder jeder Begriff
     einzeln gegen die Quelle probiert und der Treffer angesehen — „Al Hilal" allein
     liefert Al Hilal Wau aus dem Südsudan, „Al Ahli" den Verein aus Amman, „Al
     Wahda" den aus Abu Dhabi. Al-Shabab, al-Shoulla und Najran SC waren mit keinem
     Begriff zu finden; sie behalten den gezeichneten Farbkreis. */
  "Sport Club Internacional": "Internacional",
  "al-Hilal": "Al Hilal Saudi",
  "Al-Nasr": "Al Nassr",
  "Al-Ittihad": "Al Ittihad Club",
  "Al-Ahli": "Al Ahli Saudi",
  "Al-Tai FC": "Al Taee",
  "Al-Wahda": "Al Wehda",
};

/* NICHT ERREICHBAR, und zwar belegt: Nottingham Forest führt die Quelle nur als
   Netball-Mannschaft (die Liga-Liste der Premier League gibt im freien Zugang
   lediglich zehn Vereine aus), SC Freamunde gar nicht — der Verein hat sich 2018
   aufgelöst. Beide haben auch in Wikidata kein P154-Logo. Sie bleiben ohne Wappen,
   und das ist besser als ein falsches. */
export const OHNE_WAPPEN = ["Nottingham Forest", "SC Freamunde"];

/* Vorangestellte Vereinsformen. NUR generische Kürzel — „Real" oder „Athletic"
   stehen bewusst nicht hier, die sind Teil des Namens. */
const FORMEN = new Set(["1.", "AC", "ACR", "AD", "AFC", "AJ", "AS", "ASD", "ASG", "BV", "CA",
  "CD", "CF", "CFC", "CS", "FC", "FSV", "MSV", "OGC", "RC", "RCD", "SC", "SD", "SpVgg", "SS",
  "SSC", "SSD", "SV", "TSG", "TSV", "U.S.", "UD", "US", "USL", "VfB", "VfL", "VfR"]);

/** Suchbegriffe in der Reihenfolge, in der sie versucht werden. */
export function suchbegriffe(name) {
  const out = [];
  if (EXONYME[name]) out.push(EXONYME[name]);
  out.push(name);
  /* Ohne die vorangestellte Vereinsform: „AFC Sunderland" findet nichts,
     „Sunderland" schon. Bei „1. FC Köln" fallen zwei Formen weg. */
  let teile = name.split(/\s+/);
  while (teile.length > 1 && FORMEN.has(teile[0])) teile = teile.slice(1);
  /* Und ohne eine angehängte Form: „Académico de Viseu FC". */
  while (teile.length > 1 && FORMEN.has(teile.at(-1))) teile = teile.slice(0, -1);
  /* Gründungsjahre stehen bei uns im Namen, dort nicht: „ACR Siena 1904" ist
     schlicht „Siena", „U.S. Salernitana 1919" ist „Salernitana". */
  if (teile.length > 1 && /^\d{4}$/.test(teile.at(-1))) teile = teile.slice(0, -1);
  const gekuerzt = teile.join(" ");
  if (gekuerzt && gekuerzt !== name) out.push(gekuerzt);
  /* Letzter Rückfall: das erste Wort. „Albacete Balompié" und „Boavista Porto"
     finden sich nur so. NICHT bei Namen, die mit einem allgemeinen Beiwort
     beginnen — „Real" allein träfe Betis, Sociedad oder Valladolid ebenso wie
     Madrid, und ein falsches Wappen ist schlimmer als gar keines. */
  const kopf = teile[0];
  if (teile.length > 1 && kopf && !BEIWORT.has(kopf)) out.push(kopf);
  /* BINDESTRICHE BRECHEN DIE SUCHE. Gemessen: „VVV-Venlo" findet nichts,
     „VVV Venlo" findet den Verein. Betrifft auch Arles-Avignon und
     Bourg-Péronnas. Dasselbe gilt für das Undzeichen. */
  for (const b of [...out]) {
    const ohne = b.replace(/[-&]/g, " ").replace(/\s+/g, " ").trim();
    if (ohne !== b) out.push(ohne);
  }
  return [...new Set(out)];
}

/* Wörter, die viele Vereine teilen — als alleiniger Suchbegriff wertlos. */
const BEIWORT = new Set(["Real", "Athletic", "Atlético", "Atletico", "Sporting", "Deportivo",
  "Racing", "Olympique", "Union", "Borussia", "Eintracht", "Fortuna", "Hertha", "Bayer",
  "Bayern", "Werder", "Stade", "Standard", "Club", "Association"]);

/* Namensteile, die eine Mannschaft als Frauen-, Jugend- oder Reserveteam ausweisen. */
const UNERWUENSCHT = /\b(women|ladies|frauen|feminin\w*|femminile|u1\d|u2\d|youth|academy|reserves?|castilla)\b|\bII\b|\bB\b$/i;

/** Ist dieser Treffer der Verein, den wir suchen?
    `unserName` verhindert einen Eigentor-Fall: „II" weist normalerweise eine
    Zweitmannschaft aus („Ajax II"), aber Willem II Tilburg heißt einfach so — und
    wurde von der eigenen Regel verworfen, obwohl der Treffer richtig war. Was schon
    in unserem Namen steht, darf kein Ausschlussgrund sein. */
export function passt(team, laender, unserName = "") {
  if (!team || team.strSport !== "Soccer" || !team.strBadge) return false;
  if (!laender.includes(team.strCountry)) return false;
  if ((team.strGender || "").toLowerCase() === "female") return false;
  const treffer = (team.strTeam || "").match(UNERWUENSCHT);
  if (treffer && !new RegExp(`\\b${treffer[0]}\\b`, "i").test(unserName)) return false;
  return true;
}

async function fetchOk(url) {
  for (let versuch = 0; versuch < 4; versuch++) {
    const r = await fetch(url);
    if (r.status === 429) { console.log("    … 429, warte 65 s"); await sleep(65000); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  }
  throw new Error("HTTP 429 (Retries erschöpft)");
}

async function main() {
  const probe = process.argv.includes("--probe");
  const nurIdx = process.argv.indexOf("--nur");
  const nurLiga = nurIdx > 0 ? process.argv[nurIdx + 1] : null;
  mkdirSync(OUT, { recursive: true });

  const ligaVon = new Map(WELT_LIGEN.map((l) => [l.key, l]));
  const vereine = WELT_VEREINE.filter((v) => !nurLiga || v.lg === nurLiga);
  const fehlt = [];
  let geladen = 0, vorhanden = 0;

  for (let i = 0; i < vereine.length; i++) {
    const v = vereine[i];
    if (existsSync(join(OUT, v.key + ".png"))) { vorhanden++; continue; }
    const laender = LAND[ligaVon.get(v.lg)?.land] || [];
    let gefunden = null;
    for (const begriff of suchbegriffe(v.name)) {
      try {
        const j = await (await fetchOk(`${API}/searchteams.php?t=${encodeURIComponent(begriff)}`)).json();
        gefunden = (j.teams || []).find((t) => passt(t, laender, v.name));
      } catch (e) { fehlt.push(`${v.key} ${v.name}: ${e.message}`); break; }
      await sleep(2200);
      if (gefunden) break;
    }
    if (!gefunden) { fehlt.push(`${v.key} ${v.name} (${v.lg})`); continue; }
    if (!probe) {
      const bild = await fetchOk(gefunden.strBadge);
      writeFileSync(join(OUT, v.key + ".png"), Buffer.from(await bild.arrayBuffer()));
      await sleep(1200);
    }
    geladen++;
    console.log(`  ${v.key.padEnd(5)} ${v.name.padEnd(30)} -> ${gefunden.strTeam}   (${i + 1}/${vereine.length})`);
  }

  console.log(`\n${geladen} geladen · ${vorhanden} schon vorhanden · ${fehlt.length} ohne Wappen`);
  if (fehlt.length) console.log("Ohne Wappen (bekommen den gezeichneten Farbkreis):\n  " + fehlt.join("\n  "));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
