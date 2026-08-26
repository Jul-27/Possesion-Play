#!/usr/bin/env node
/*
 * wikidata_career_clubs.mjs — holt die VOLLSTÄNDIGE Vereinsliste je Spieler und
 * schreibt src/careerClubs.js. Internet nötig. Idempotent.
 *
 *   node data-pipeline/wikidata_career_clubs.mjs            # alle Spieler
 *   node data-pipeline/wikidata_career_clubs.mjs --min-sl 40
 *   node data-pipeline/wikidata_career_clubs.mjs --probe    # nichts schreiben
 *   node data-pipeline/wikidata_career_clubs.mjs --kein-nachlauf
 *
 * WARUM: `clubs[]` in players.js kennt nur die 47 Spielvereine — die tragen die
 * Hexfelder und brauchen Wappen, also bleibt die Menge klein. Für das
 * Transferkarussell ist genau das falsch: der Reiz besteht darin, dem Gegner einen
 * schwierigen Verein zuzuwerfen. Gündoğan ohne Nürnberg und Galatasaray, Klose ohne
 * Kaiserslautern — das Spiel wirkte dadurch unvollständig. Gemessen: Wikidata führt
 * im Schnitt 8,3 Vereine je Spieler, wir 1,9.
 *
 * ABRUF: nicht über Kader (zu viele Vereine) und nicht über Geburtsjahrgänge (läuft
 * in den WDQS-Timeout), sondern über den LABEL-INDEX — die Namen werden der Abfrage
 * direkt mitgegeben. 500 Namen je POST in etwa 24 s; die URL-Variante scheitert ab
 * ~250 Namen an HTTP 431, deshalb POST.
 */
import { readFileSync, writeFileSync } from "fs";
import { pathToFileURL } from "url";
import { norm, CLUBS } from "../src/gameData.js";
import { kanonischerVereinsname } from "../src/clubNames.js";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const OUT = new URL("../src/careerClubs.js", import.meta.url);
const BATCH = 300;   // mit Aliassen kommen ~2,5× so viele Zeilen zurück
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Typen, die keine Profivereine sind. Nationalmannschaften erwischt der
   Unterklassen-Pfad; Zweitmannschaften und Frauenteams tragen eigene Typen. */
const KEIN_VEREIN_TYP = {
  national: "Q6979593",   // Fußballnationalmannschaft (samt Unterklassen)
  zweit: "Q2412834",      // Zweitmannschaft
  frauen: "Q28140340",    // Frauenfußballmannschaft
};

/* Der Typ allein reicht nicht: Borussia Dortmund II trägt nur „Fußballmannschaft".
   Deshalb zusätzlich das Namensmuster — bewusst eng gehalten, damit kein echter
   Verein durchs Raster fällt (Athletic Bilbao darf „Athletic" heißen). */
export function istZweitteam(name) {
  const s = String(name || "");
  if (/\s(II|III|IV|B|C)$/.test(s)) return true;
  /* „Johor Darul Ta'zim II FC" trägt die Ziffer in der Mitte. Willem II Tilburg ist
     dagegen ein echter Verein und muss bleiben — daher die Ausnahme. */
  if (/\s(II|III)\s/.test(s) && !/willem/i.test(s)) return true;
  if (/\bU-?\s?\d{2}\b/i.test(s)) return true;
  /* Castilla und Mestalla heißen die Zweitmannschaften von Real und Valencia; sie
     tragen weder Ziffer noch den Typ „Zweitmannschaft" in Wikidata. */
  if (/(jugend|youth|academy|akademie|reserve|amateure|amateurs|next gen|futuro|castilla|mestalla|juvenil|primavera)\b/i.test(s)) return true;
  return false;
}

async function sparql(query) {
  for (let a = 0; a < 5; a++) {
    let res;
    try {
      res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        /* charset=utf-8 ist ZWINGEND. Ohne die Angabe liest WDQS den Body nicht als
           UTF-8, und jeder Name mit Sonderzeichen findet nichts: „İlkay Gündoğan"
           lieferte 0 statt 13 Zeilen. Bei einem Fußball-Datensatz wäre das der
           größere Teil aller Spieler — und zwar lautlos. */
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

async function api(params) {
  const url = "https://www.wikidata.org/w/api.php?format=json&" + new URLSearchParams(params);
  for (let a = 0; a < 4; a++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA } }); } catch { await sleep(4000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(10000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  throw new Error("Wikidata-API fehlgeschlagen");
}

/* Nachlauf für alles, was der Label-Weg nicht trifft. Manche Namen stehen in Wikidata
   ganz anders („Adriano" heißt dort „Adriano Leite Ribeiro"), da hilft weder Label noch
   Alias. Diese Spieler bekommen ihre QID über die Suche und danach ihre Vereine über
   eine QID-Abfrage — genau, aber mit rund 0,8 s je Spieler auch langsam. */
async function nachlaufUeberQid(offen, indexNachSchluessel, proSpieler) {
  const qidVon = new Map();
  const alle = new Set();
  for (let i = 0; i < offen.length; i++) {
    const p = offen[i];
    try {
      const s = await api({ action: "wbsearchentities", search: p.n, language: "de", uselang: "de", type: "item", limit: 3 });
      const ids = (s.search || []).map((x) => x.id);
      if (ids.length) { qidVon.set(norm(p.n) + "|" + p.by, ids); ids.forEach((x) => alle.add(x)); }
    } catch { /* eine gescheiterte Suche darf den Lauf nicht kippen */ }
    if ((i + 1) % 500 === 0) console.log(`  Nachlauf-Suche ${i + 1}/${offen.length} …`);
    await sleep(110);
  }
  // Vereine der Kandidaten-QIDs in einem Rutsch
  const proQid = new Map();
  const ids = [...alle];
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    /* Jede Portion einzeln absichern. Der Nachlauf ist eine Zugabe — ein WDQS-Ausfall
       darin darf nicht die Stunde Arbeit aus dem Hauptdurchlauf mitreißen. Genau das
       ist einmal passiert: Portion 2100 von 3605 scheiterte, und der Lauf brach ab,
       bevor irgendetwas geschrieben war. */
    let rows;
    try {
      rows = await sparql(`SELECT ?p ?by ?cLabel WHERE {
      VALUES ?p { ${chunk.map((q) => "wd:" + q).join(" ")} }
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; p:P54/ps:P54 ?c .
      MINUS { ?c wdt:P31 ?t1 . ?t1 wdt:P279* wd:${KEIN_VEREIN_TYP.national} }
      MINUS { ?c wdt:P31 wd:${KEIN_VEREIN_TYP.zweit} }
      MINUS { ?c wdt:P31 wd:${KEIN_VEREIN_TYP.frauen} }
      BIND(YEAR(?d) AS ?by)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". } }`);
    } catch (e) { console.log(`  Nachlauf-Portion ${i} übersprungen: ${e.message}`); continue; }
    for (const b of rows) {
      const qid = b.p.value.split("/").pop();
      const club = b.cLabel?.value;
      if (!club || /^Q\d+$/.test(club) || istZweitteam(club)) continue;
      const e = proQid.get(qid) || proQid.set(qid, { by: Number(b.by.value), clubs: new Set() }).get(qid);
      e.clubs.add(club);
    }
    console.log(`  Nachlauf-Vereine ${Math.min(i + 300, ids.length)}/${ids.length} …`);
    await sleep(1200);
  }
  // Nur bei exakt passendem Geburtsjahr übernehmen — lieber nichts als der Falsche.
  let gefunden = 0;
  for (const [k, kandidaten] of qidVon) {
    const p = indexNachSchluessel.get(k);
    for (const q of kandidaten) {
      const e = proQid.get(q);
      if (!e || e.by !== p.by || !e.clubs.size) continue;
      const set = proSpieler.get(k) || proSpieler.set(k, new Set()).get(k);
      for (const c of e.clubs) set.add(c);
      gefunden++;
      break;
    }
  }
  return gefunden;
}

/* Eine Namensportion abfragen.

   `rdfs:label|skos:altLabel` ist entscheidend: unsere Namen sind teils diakritikfrei
   („Marko Arnautovic"), Wikidatas Label trägt die Zeichen („Marko Arnautović"), und
   rdfs:label vergleicht exakt. Ohne die Aliasse fehlten 5251 Spielern (17 %) sämtliche
   Karrierestationen — darunter Arnautović ohne Stoke City, Hakimi, Adriano, Golovin.
   Das Geburtsjahr filtert die Fehlgriffe, die ein geteilter Alias mitbringen kann.

   Der MINUS-Block wirft Nationalteams, Zweit- und Frauenmannschaften schon
   serverseitig raus — das spart rund ein Viertel der Zeilen. */
const abfrage = (namen) => `SELECT ?pLabel ?by ?c ?cLabel WHERE {
  VALUES ?l { ${namen.flatMap((n) => [`"${esc(n)}"@de`, `"${esc(n)}"@en`]).join(" ")} }
  ?p rdfs:label|skos:altLabel ?l ; wdt:P106 wd:Q937857 ; wdt:P569 ?d ; p:P54/ps:P54 ?c .
  MINUS { ?c wdt:P31 ?t1 . ?t1 wdt:P279* wd:${KEIN_VEREIN_TYP.national} }
  MINUS { ?c wdt:P31 wd:${KEIN_VEREIN_TYP.zweit} }
  MINUS { ?c wdt:P31 wd:${KEIN_VEREIN_TYP.frauen} }
  BIND(YEAR(?d) AS ?by)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}`;

/* Ergebniszeilen den eigenen Spielern zuordnen. Ein Name kann mehrere Personen
   treffen (zwei „Michael Owen"), deshalb entscheidet erst das Geburtsjahr. */
export function ordneZu(rows, indexNachSchluessel) {
  const treffer = new Map();   // schluessel -> Set(clubLabel)
  for (const b of rows) {
    const name = b.pLabel?.value, by = b.by?.value ? Number(b.by.value) : null;
    const club = b.cLabel?.value;
    if (!name || !by || !club) continue;
    if (/^Q\d+$/.test(club)) continue;          // Label-Service auf QID zurückgefallen
    if (istZweitteam(club)) continue;
    const k = norm(name) + "|" + by;
    if (!indexNachSchluessel.has(k)) continue;
    (treffer.get(k) || treffer.set(k, new Set()).get(k)).add(club);
  }
  return treffer;
}

/* Ausgabeformat: eine Namensliste plus je Spieler die Indizes darin. Indizes statt
   wiederholter Namen, weil derselbe Verein im Schnitt bei vielen Spielern steht —
   ausgeschrieben wäre die Datei ein Vielfaches groß. */
export function baueDatei(vereine, proSpieler) {
  const idx = new Map(vereine.map((n, i) => [n, i]));
  const zeilen = [...proSpieler.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, set]) => `  ${JSON.stringify(k)}: [${[...set].map((n) => idx.get(n)).filter((i) => i != null).sort((a, b) => a - b).join(",")}]`);
  return `// GENERIERT von data-pipeline/wikidata_career_clubs.mjs. Nicht von Hand editieren.
/* Vollständige Vereinsstationen je Spieler — die Grundlage für „Transferkarussell".
   Getrennt von players.js und bewusst NICHT im Hauptbundle: die Datei wird erst
   geladen, wenn das Karussell startet.

   CAREER_CLUBS  Namensliste aller Vereine
   CAREER_BY_KEY "norm(name)|geburtsjahr" -> Indizes in CAREER_CLUBS

   Nationalmannschaften, Zweitmannschaften und Frauenteams sind ausgeschlossen. */
export const CAREER_CLUBS = ${JSON.stringify(vereine)};

export const CAREER_BY_KEY = {
${zeilen.join(",\n")}
};
`;
}

async function main() {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d; };
  const probe = process.argv.includes("--probe");
  const MIN_SL = arg("min-sl", 0);

  const { PLAYERS } = await import(new URL("../src/players.js", import.meta.url).href + "?t=" + Date.now());
  const ziel = PLAYERS.filter((p) => (p.sl || 0) >= MIN_SL);
  const indexNachSchluessel = new Map(ziel.map((p) => [norm(p.n) + "|" + p.by, p]));
  console.log(`Hole Vereinsstationen für ${ziel.length} Spieler (sl >= ${MIN_SL})\n`);

  const proSpieler = new Map();
  const namen = [...new Set(ziel.map((p) => p.n))];
  let zeilenGesamt = 0;
  for (let i = 0; i < namen.length; i += BATCH) {
    const teil = namen.slice(i, i + BATCH);
    let rows;
    try { rows = await sparql(abfrage(teil)); }
    catch (e) { console.log(`  ${i}–${i + teil.length}: FEHLER ${e.message}`); continue; }
    zeilenGesamt += rows.length;
    for (const [k, set] of ordneZu(rows, indexNachSchluessel)) {
      const vorhanden = proSpieler.get(k) || proSpieler.set(k, new Set()).get(k);
      for (const c of set) vorhanden.add(c);
    }
    console.log(`  ${String(Math.min(i + BATCH, namen.length)).padStart(6)}/${namen.length} · ${rows.length} Zeilen · ${proSpieler.size} Spieler mit Stationen`);
    await sleep(1200);
  }

  /* Wer über Label und Alias nicht gefunden wurde, bekommt eine zweite Chance über
     die QID. Vorher fehlten 5251 Spielern (17 %) sämtliche Stationen. */
  const nurSpielvereine = ziel.filter((p) => !proSpieler.has(norm(p.n) + "|" + p.by));
  if (!process.argv.includes("--kein-nachlauf") && nurSpielvereine.length) {
    console.log(`\nNachlauf über QID für ${nurSpielvereine.length} Spieler ohne Treffer …`);
    try {
      const n = await nachlaufUeberQid(nurSpielvereine, indexNachSchluessel, proSpieler);
      console.log(`  davon ${n} nachträglich gefunden`);
    } catch (e) { console.log(`  Nachlauf abgebrochen (${e.message}) — der Hauptdurchlauf bleibt erhalten.`); }
  }

  /* Die 47 Spielvereine immer mitführen: sie sind kuratiert und teils reicher als
     Wikidata (Salzburg, Matthäus, die Kader aus der Wikipedia). Sonst verlöre das
     Karussell ausgerechnet die Stationen, die wir mühsam nachgetragen haben.

     ERST KANONISIEREN, DANN ERGÄNZEN. Genau hier entstand die Dublette: Wikidata
     liefert „FC Liverpool", unser Spielverein heißt „Liverpool", und die Vereinigung
     lief über den NAMEN. Beide landeten in der Datei, 4.119 Spieler trugen dadurch
     zwei Formen desselben Vereins — und die Verbrannte-Vereine-Regel des Karussells
     ließ sich damit umgehen. Sechs Vereine waren betroffen: Liverpool, Chelsea,
     Arsenal, Everton, Juventus, AC Mailand. */
  for (const [k, set] of proSpieler) {
    const kanonisch = new Set([...set].map(kanonischerVereinsname));
    if (kanonisch.size !== set.size) proSpieler.set(k, kanonisch);
  }

  const nameVonKey = Object.fromEntries(CLUBS.map((c) => [c.key, c.name]));
  let ausSpiel = 0;
  for (const p of ziel) {
    const k = norm(p.n) + "|" + p.by;
    const set = proSpieler.get(k) || proSpieler.set(k, new Set()).get(k);
    for (const c of p.clubs || []) { if (nameVonKey[c] && !set.has(nameVonKey[c])) { set.add(nameVonKey[c]); ausSpiel++; } }
    if (!set.size) proSpieler.delete(k);
  }

  const vereine = [...new Set([...proSpieler.values()].flatMap((s) => [...s]))].sort();
  const summe = [...proSpieler.values()].reduce((a, s) => a + s.size, 0);
  console.log(`\nZeilen gesamt: ${zeilenGesamt}`);
  console.log(`Spieler mit Stationen: ${proSpieler.size} · verschiedene Vereine: ${vereine.length}`);
  console.log(`Stationen je Spieler: Ø ${(summe / proSpieler.size).toFixed(1)} · aus den 47 Spielvereinen ergänzt: ${ausSpiel}`);

  if (probe) return console.log("\n--probe: nichts geschrieben.");
  const inhalt = baueDatei(vereine, proSpieler);
  writeFileSync(OUT, inhalt);
  /* KEIN Stempel. DATA_ASOF und FIXES_ASOF beschreiben den Stand von players.js —
     dieses Skript schreibt eine eigene Datei und lässt players.js unangetastet.
     Stempelte es doch, sähe der Spielerdatenstand frischer aus, als er ist, und die
     Reihenfolge in refresh_all (dieser Lauf kommt NACH den Korrekturen) würde die
     Regel „Korrekturen liegen nie vor dem Abruf" bei jedem Lauf verletzen. */
  console.log(`\nFertig: src/careerClubs.js · ${(inhalt.length / 1048576).toFixed(2)} MB roh`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
