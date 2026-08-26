#!/usr/bin/env node
/*
 * wikipedia_career.mjs — volle Vereinskarriere eines Spielers aus de.wikipedia lesen
 * und mit unserem Datenstand vergleichen. SCHREIBT NICHTS.
 *
 *   node data-pipeline/wikipedia_career.mjs "Paul Wanner" "Junior Adamu"
 *   node data-pipeline/wikipedia_career.mjs --aus-report        # alle offenen Meldungen
 *
 * WOZU: Wikidata hinkt bei Leihen und jüngeren Wechseln Jahre hinterher — bei den
 * ersten sechs gemeldeten Zuordnungen führte es keine einzige. Die deutsche
 * Wikipedia hat sie in der Infobox-Karrieretabelle. Dieses Skript liest genau diese
 * Tabelle, wirft Jugend-, Zweit- und Nationalmannschaften weg und zeigt, was uns
 * fehlt — als fertige Zeilen für EXTRA_PLAYERS bzw. EXTRA_CAREER_CLUBS.
 *
 * BEWUSST NUR EIN VORSCHLAG: Die Zuordnung Artikel→Spieler geht über den Namen und
 * kann danebengreifen (es gibt zwei Hannes Wolf). Deshalb wird das Geburtsjahr
 * gegengeprüft und am Ende trotzdem nichts automatisch übernommen.
 */
import { readFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, CLUBS } from "../src/gameData.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; career lookup)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY_VON_NAME = new Map(CLUBS.map((c) => [norm(c.name), c.key]));

/* Zweit-, Jugend- und Frauenmannschaften erkennen. Dieselbe Absicht wie
   istZweitteam() in wikidata_career_clubs.mjs, hier auf Wikipedia-Schreibweisen:
   „SC Freiburg II", „FC Bayern München II", „…-Amateure", „… U19". */
export const istNebenteam = (name) =>
  /\b(II|III|B)\b|Amateure|Reserve|\bU\s?-?\s?\d{2}\b|Frauen|Juniorinnen/i.test(name);

export const istNationalteam = (name) => /nationalmannschaft|national team|olympia/i.test(name);

/* Die Infobox führt zwei Tabellen: vereine_jugend_tabelle und vereine_tabelle.
   Nur die zweite zählt — Jugendstationen sind keine Karrierestationen und würden
   das Transferkarussell mit Dorfvereinen fluten. */
export function stationenAusInfobox(wikitext) {
  const ab = wikitext.search(/\|\s*vereine_tabelle\s*=/i);
  if (ab < 0) return [];
  // bis zum nächsten Infobox-Feld auf oberster Ebene
  const rest = wikitext.slice(ab);
  const bis = rest.search(/\n\s*\|\s*(nationalmannschaft|trainerstationen|erfolge|stand)[a-z_]*\s*=/i);
  const block = bis > 0 ? rest.slice(0, bis) : rest;

  const gesehen = new Set();
  return [...block.matchAll(/\{\{Team-Station\s*\|([^}]*)\}\}/g)].map((m) => {
    const zeile = m[1];
    /* Den Vereinsnamen aus dem WIKILINK holen, nicht durch Zerteilen der Zeile am
       Pipe: „[[Hamburger SV#Zweite Mannschaft|Hamburger SV II]]" enthält selbst ein
       Pipe. Wer die Zeile zerteilt, bekommt den ARTIKELnamen „Hamburger SV" und
       übersieht die Zweitmannschaft — sie liefe als Profistation durch. Maßgeblich
       ist der ANZEIGEname hinter dem letzten Pipe. */
    const link = zeile.match(/\[\[([^\]]+)\]\]/);
    if (!link) return null;
    const inhalt = link[1];
    const name = (inhalt.includes("|") ? inhalt.split("|").pop() : inhalt.split("#")[0]).trim();
    const jahre = zeile.slice(0, zeile.indexOf("[[")).replace(/\|/g, "").trim();
    return { jahre, name, leihe: /leihe\s*=\s*1/.test(zeile) };
  }).filter((s) => {
    // Mehrere Spells beim selben Verein einmal führen — clubs[] kennt keine Jahre.
    if (!s?.name || gesehen.has(s.name)) return false;
    gesehen.add(s.name);
    return true;
  });
}

async function holeArtikel(titel) {
  const u = "https://de.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main"
    + "&format=json&formatversion=2&redirects=1&titles=" + encodeURIComponent(titel);
  const s = (await (await fetch(u, { headers: { "User-Agent": UA } })).json()).query?.pages?.[0];
  return s?.missing ? null : { titel: s.title, text: s.revisions[0].slots.main.content };
}

async function sucheArtikel(name) {
  const u = "https://de.wikipedia.org/w/api.php?action=query&list=search&srlimit=6&format=json"
    + "&formatversion=2&srsearch=" + encodeURIComponent(name + " Fußballspieler");
  return (await (await fetch(u, { headers: { "User-Agent": UA } })).json()).query.search.map((s) => s.title);
}

/* Das Geburtsjahr aus der Infobox. Der Feldname schwankt: die Spieler-Infobox nennt
   es `geburtstag`, andere `geburtsdatum`, manche setzen die Vorlage {{Geburtsdatum}}.
   Solange nur `geburtsdatum` geprüft wurde, fielen 7 % der Spieler durch die
   Jahresprüfung und bekamen keine Position — nicht weil das Jahr fehlte, sondern
   weil das Feld anders heißt. */
export const geburtsjahr = (text) => {
  const m = String(text || "").match(/geburts(?:datum|tag)\s*=\s*[^\n|]*?((?:1[89]|20)\d{2})/i)
    || String(text || "").match(/\{\{Geburtsdatum[^}]*\|((?:1[89]|20)\d{2})/i);
  return m ? Number(m[1]) : null;
};

/** Artikel finden, dessen Geburtsjahr zu unserem Spieler passt. */
async function findeArtikel(name, by) {
  const kandidaten = [name, ...(await sucheArtikel(name))];
  for (const t of [...new Set(kandidaten)].slice(0, 5)) {
    const a = await holeArtikel(t);
    await sleep(300);
    if (!a) continue;
    const jahr = geburtsjahr(a.text);
    if (jahr === by) return { ...a, jahr };
  }
  return null;
}

async function main() {
  const { PLAYERS } = await import(new URL("../src/players.js", import.meta.url).href);
  const cc = await import(new URL("../src/careerClubs.js", import.meta.url).href);
  const spielName = new Map(CLUBS.map((c) => [c.key, c.name]));

  let namen = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (process.argv.includes("--aus-report")) {
    const datei = join(HERE, "player-club-reports.json");
    namen = [...new Set(JSON.parse(readFileSync(datei, "utf8")).reports.map((r) => r.playerName))];
  }
  if (!namen.length) return console.log("Namen angeben oder --aus-report benutzen.");

  const vorschlag = { EXTRA_PLAYERS: [], EXTRA_CAREER_CLUBS: [] };

  for (const name of namen) {
    const p = PLAYERS.find((x) => x.n === name);
    if (!p) { console.log(`\n✗ ${name}: nicht in players.js`); continue; }
    const key = norm(p.n) + "|" + p.by;

    const art = await findeArtikel(name, p.by);
    if (!art) { console.log(`\n✗ ${name} (${p.by}): kein Artikel mit passendem Geburtsjahr`); continue; }

    const stationen = stationenAusInfobox(art.text)
      .filter((s) => !istNationalteam(s.name) && !istNebenteam(s.name));

    const habenSpiel = new Set((p.clubs || []).map((k) => spielName.get(k)));
    const habenKarriere = new Set((cc.CAREER_BY_KEY[key] || []).map((i) => cc.CAREER_CLUBS[i]));
    const fehlt = stationen.filter((s) => !habenSpiel.has(s.name) && !habenKarriere.has(s.name));

    console.log(`\n━━━ ${name} (${p.by}) · Artikel „${art.titel}"`);
    console.log(`   Wikipedia : ${stationen.map((s) => `${s.name} ${s.jahre}${s.leihe ? " (Leihe)" : ""}`).join(" | ")}`);
    console.log(`   haben wir : ${[...new Set([...habenSpiel, ...habenKarriere])].sort().join(", ") || "—"}`);
    if (!fehlt.length) { console.log(`   ⇒ vollständig`); continue; }
    console.log(`   ⇒ FEHLT: ${fehlt.map((s) => s.name).join(", ")}`);

    for (const s of fehlt) {
      const k = KEY_VON_NAME.get(norm(s.name));
      const ziel = k ? "EXTRA_PLAYERS" : "EXTRA_CAREER_CLUBS";
      vorschlag[ziel].push({ n: p.n, by: p.by, clubs: [k || s.name], jahre: s.jahre, leihe: s.leihe });
    }
    await sleep(400);
  }

  for (const [tabelle, eintraege] of Object.entries(vorschlag)) {
    if (!eintraege.length) continue;
    console.log(`\n\n── Vorschlag für ${tabelle} ──`);
    // je Spieler eine Zeile, Vereine gebündelt
    const proSpieler = new Map();
    for (const e of eintraege) {
      const v = proSpieler.get(e.n) || proSpieler.set(e.n, { by: e.by, clubs: [], noten: [] }).get(e.n);
      v.clubs.push(e.clubs[0]);
      v.noten.push(`${e.clubs[0]} ${e.jahre}${e.leihe ? ", Leihe" : ""}`);
    }
    for (const [n, v] of proSpieler) {
      console.log(`  { n: ${JSON.stringify(n)}, by: ${v.by}, clubs: ${JSON.stringify(v.clubs)} },`
        + `  // ${v.noten.join(" · ")}`);
    }
  }
  console.log("\nNichts geschrieben — Zeilen prüfen und von Hand übernehmen.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
