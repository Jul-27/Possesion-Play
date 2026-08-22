#!/usr/bin/env node
/*
 * league_squads.mjs — baut src/squads.js: die AKTUELLEN Kader aller Vereine der
 * sieben Spielligen, mit Rückennummer, Nationalität, Position und Geburtsdatum.
 *
 *   node data-pipeline/league_squads.mjs             # alle Ligen
 *   node data-pipeline/league_squads.mjs BL PL       # nur diese
 *   node data-pipeline/league_squads.mjs --probe     # nichts schreiben, nur melden
 *
 * WOFÜR: der Modus „Steckbrief" rät einen Spieler über sechs Kacheln — Liga, Verein,
 * Position, Alter, Nationalität, Rückennummer. Vier davon kann players.js nicht
 * liefern:
 *   Rückennummer  gibt es dort überhaupt nicht.
 *   Nationalität  kennt dort nur 19 Länder; Achraf Hakimi steht als „ESP", weil
 *                 Marokko nicht dazugehört. Als Kachel wäre das schlicht falsch.
 *   Alter         nur als Geburtsjahr, nicht als Datum.
 *   Verein/Liga   ableitbar, aber aus Wikidatas P54 — und das hinkt bei Transfers
 *                 nach (siehe Kopf von wikipedia_squads.mjs).
 * Alle vier stehen in der Kadertabelle der deutschen Wikipedia, in derselben Tabelle,
 * die wikipedia_squads.mjs ohnehin schon liest. Dieses Skript liest sie mit demselben
 * Parser, nur für ~130 statt 47 Vereine, und schreibt eine eigene Datei.
 *
 * WARUM EINE EIGENE DATEI und kein neues Feld in players.js: die Angaben gelten für
 * die laufende Saison, nicht für die Person. Sie veralten im Wochentakt, während
 * players.js Karrieredaten hält, die stehenbleiben. Getrennte Dateien heißt getrennte
 * Aktualisierung — und squads.js wird wie careerClubs.js erst geladen, wenn der Modus
 * startet, statt im Hauptbundle mitzureisen.
 *
 * Die Datei ist bewusst SELBSTTRAGEND (Name, Geburtsjahr, Bekanntheit stehen darin,
 * obwohl players.js sie auch führt): ein Teil der Kaderspieler ist so neu, dass
 * players.js sie gar nicht kennt. Ohne eigene Kopie fielen genau die Neuzugänge aus
 * dem Spiel, die man am ehesten errät. Der Schlüssel norm(name)|geburtsjahr ist
 * derselbe wie überall, Fotos finden sich also weiterhin über playerImage.js.
 *
 * VEREINSAUSWAHL: Kandidaten kommen aus Wikidata (P118 auf die Liga, ohne Enddatum),
 * die Entscheidung fällt aber die Infobox des Vereinsartikels. Wikidatas P118 ist bei
 * Auf- und Absteigern träge; die Infobox nennt die laufende Liga. Nennt sie eine
 * ANDERE unserer Ligen, fliegt der Verein raus. Nennt sie nichts Erkennbares, bleibt
 * er drin — lieber ein Verein zu viel als eine halbe Liga zu wenig.
 */
import { readFileSync, writeFileSync } from "fs";
import { pathToFileURL } from "url";
import { norm } from "../src/gameData.js";
import { deriveLastName } from "./wikidata_roster.mjs";
import {
  waehleAbschnitt, kaderTabellen, titelZuQid, spielerDaten, ohneKlammer,
  KADER_MIN, KADER_MAX,
} from "./wikipedia_squads.mjs";
import { stampFixes } from "./stamp.mjs";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const OUT = new URL("../src/squads.js", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Liga-QID (für die Kandidatensuche) und der Artikeltitel, den die Vereins-Infobox
   im Feld „Liga" verlinkt (für die Prüfung). Beide sind belegt, nicht geraten. */
export const LIGEN = [
  { code: "BL", qid: "Q82595",  infobox: "Fußball-Bundesliga" },
  { code: "PL", qid: "Q9448",   infobox: "Premier League" },
  { code: "LL", qid: "Q324867", infobox: "Primera División" },
  { code: "SA", qid: "Q15804",  infobox: "Serie A" },
  { code: "L1", qid: "Q13394",  infobox: "Ligue 1" },
  { code: "PT", qid: "Q182994", infobox: "Primeira Liga" },
  { code: "NL", qid: "Q167541", infobox: "Eredivisie" },
];

/* Liga-Code aus dem Infobox-Feld „Liga".
   null       = keine Liga-Zeile oder eine unbekannte Liga -> im Zweifel behalten.
   "MEHRERE"  = die Zeile nennt mehrere Ligen. Das tut kein Verein, wohl aber
                Sammelartikel wie „Kader der deutschen Fußball-Bundesliga 2009/10",
                die sonst als Verein durchgingen. Passt zu keinem Liga-Code und
                fliegt damit automatisch raus. */
export function ligaAusInfobox(wikitext) {
  const zeile = String(wikitext).match(/^\s*\|\s*Liga\s*=\s*(.+)$/mi)?.[1] || "";
  const ziele = [...zeile.matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1].trim());
  if (ziele.length > 1) return "MEHRERE";
  return LIGEN.find((l) => l.infobox === ziele[0])?.code || null;
}

// ─────────────────────────── Netzwerk ───────────────────────────

async function hole(url, params, art = "json") {
  const voll = url + "?format=json&" + new URLSearchParams(params);
  for (let a = 0; a < 5; a++) {
    let res;
    try { res = await fetch(voll, { headers: { "User-Agent": UA, Accept: art === "sparql" ? "application/sparql-results+json" : "application/json" } }); }
    catch { await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(10000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    /* Auch das Lesen des Körpers kann abbrechen („terminated") — dann ist die Antwort
       verloren, obwohl der Statuscode in Ordnung war. Im ersten Lauf kostete das den
       FC Everton. Der Versuch gehört deshalb mit in die Wiederholschleife. */
    try { return await res.json(); } catch { await sleep(5000); }
  }
  throw new Error("Abruf fehlgeschlagen (Retries erschöpft)");
}
const wp = (p) => hole("https://de.wikipedia.org/w/api.php", { origin: "*", ...p });
const wd = (p) => hole("https://www.wikidata.org/w/api.php", p);
const sparql = async (query) =>
  (await hole("https://query.wikidata.org/sparql", { query }, "sparql")).results.bindings;

async function chunked(ids, fn, size = 45) {
  for (let i = 0; i < ids.length; i += size) await fn(ids.slice(i, i + size));
}

/* Vereinskandidaten einer Liga: deutscher Artikel vorhanden, kein Mensch. Der
   Typfilter „ist ein Fußballverein" wäre naheliegend, schließt aber Chelsea und
   Barcelona aus — beide sind in Wikidata anders modelliert. */
async function vereinsKandidaten(qid) {
  const rows = await sparql(`SELECT DISTINCT ?de WHERE {
    ?club p:P118 ?st . ?st ps:P118 wd:${qid} .
    FILTER NOT EXISTS { ?st pq:P582 ?e }
    FILTER NOT EXISTS { ?club wdt:P31 wd:Q5 }
    ?de schema:about ?club ; schema:isPartOf <https://de.wikipedia.org/> .
  }`);
  return rows.map((r) => decodeURIComponent(r.de.value.split("/wiki/")[1]).replace(/_/g, " ")).sort();
}

/** Wikitext mehrerer Artikel auf einmal — für die Liga-Prüfung. */
async function wikitexte(titel) {
  const map = new Map();
  await chunked(titel, async (c) => {
    const r = await wp({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles: c.join("|") });
    for (const p of Object.values(r.query?.pages || {})) {
      const t = p.revisions?.[0]?.slots?.main?.["*"];
      if (t) map.set(p.title, t);
    }
    for (const n of r.query?.normalized || []) { const t = map.get(n.to); if (t) map.set(n.from, t); }
    for (const n of r.query?.redirects || []) { const t = map.get(n.to); if (t) map.set(n.from, t); }
  }, 20);
  return map;
}

/* Nationsartikel -> { iso, name }. ISO kommt aus P297, der Name aus dem Artikeltitel.
   Die Codes holt SPARQL und nicht wbgetentities: Länder tragen Tausende Aussagen, und
   ein Stapel von 45 solcher Entitäten kommt unvollständig zurück — Dänemark und
   Luxemburg fehlten dadurch still, obwohl beide einen Code haben.

   Zwei Fallstricke stecken in der Abfrage selbst:
   `p:P297/ps:P297` statt `wdt:P297`, sonst fehlen die Niederlande — dieselbe Regel,
   die im Projekt schon für P54 gilt. Und England, Schottland, Wales und Nordirland
   sind keine ISO-3166-1-Länder; ihr Code steht in P300 („GB-ENG"). Ohne diesen
   Rückgriff hätte ausgerechnet die häufigste Nation der Premier League keine Flagge. */
async function nationen(titel) {
  const qidVon = await titelZuQid(titel);
  const qids = [...new Set(qidVon.values())];
  const isoVon = new Map();
  await chunked(qids, async (c) => {
    const rows = await sparql(`SELECT ?item ?iso ?sub WHERE {
      VALUES ?item { ${c.map((q) => "wd:" + q).join(" ")} }
      OPTIONAL { ?item p:P297/ps:P297 ?iso } OPTIONAL { ?item p:P300/ps:P300 ?sub } }`);
    for (const r of rows) {
      const iso = r.iso?.value || r.sub?.value;
      if (iso) isoVon.set(r.item.value.split("/").pop(), iso);
    }
  }, 100);
  const out = new Map();
  for (const t of titel) {
    const iso = isoVon.get(qidVon.get(t));
    if (iso) out.set(t, { iso, name: t });
  }
  return out;
}

// ─────────────────────────── Ausgabe ───────────────────────────

/* Zeile je Spieler, feste Feldreihenfolge — sonst rauscht jeder Lauf den Diff voll.
   Weggelassen wird, was fehlt; die Ansicht kommt mit null zurecht. */
export function spielerZeile(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "c": ${r.c}`;
  if (r.gb) s += `, "gb": ${JSON.stringify(r.gb)}`;
  if (r.nr) s += `, "nr": ${r.nr}`;
  if (r.na >= 0) s += `, "na": ${r.na}`;
  if (r.po) s += `, "po": ${JSON.stringify(r.po)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  return s + "}";
}

export function dateiInhalt(clubs, nats, spieler, stand) {
  return `// GENERIERT von data-pipeline/league_squads.mjs. Nicht von Hand editieren.
/* Aktuelle Kader der sieben Spielligen — Grundlage für den Modus „Steckbrief".

   SQUAD_STAND    Tag des letzten Laufs. Die Datei veraltet mit jedem Transferfenster.
   SQUAD_CLUBS    [Vereinsname, Liga-Code]
   SQUAD_NATIONS  [ISO-3166-Code, deutscher Ländername]
   SQUAD_PLAYERS  { n, ln, by, c (Index in SQUAD_CLUBS), gb (Geburtsdatum),
                    nr (Rückennummer), na (Index in SQUAD_NATIONS), po, sl }

   Quelle ist ausschließlich die Kadertabelle des deutschen Wikipedia-Artikels;
   Name, Geburtsjahr und Bekanntheit kommen über die QID des verlinkten Artikels aus
   Wikidata. Nichts davon ist aus Fließtext geraten.

   Der Schlüssel norm(n)|by ist derselbe wie in players.js und playerImages.js —
   Fotos und Karrieredaten sind darüber erreichbar, soweit vorhanden. */
export const SQUAD_STAND = ${JSON.stringify(stand)};

export const SQUAD_CLUBS = [
  ${clubs.map((c) => JSON.stringify(c)).join(",\n  ")}
];

export const SQUAD_NATIONS = [
  ${nats.map((n) => JSON.stringify(n)).join(",\n  ")}
];

export const SQUAD_PLAYERS = [
  ${spieler.map(spielerZeile).join(",\n  ")}
];
`;
}

// ─────────────────────────── Ablauf ───────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const probe = argv.includes("--probe");
  const nur = argv.filter((a) => !a.startsWith("--"));
  const ligen = nur.length ? LIGEN.filter((l) => nur.includes(l.code)) : LIGEN;
  if (nur.length && ligen.length !== nur.length) {
    console.error(`Unbekannte Liga: ${nur.filter((n) => !LIGEN.some((l) => l.code === n)).join(", ")}`);
    process.exit(2);
  }

  // 1. Vereine je Liga bestimmen und über die Infobox bestätigen.
  const vereine = [];         // { name, lg }
  const verworfen = [];
  for (const liga of ligen) {
    const kandidaten = await vereinsKandidaten(liga.qid);
    const texte = await wikitexte(kandidaten);
    for (const name of kandidaten) {
      const laut = ligaAusInfobox(texte.get(name) || "");
      if (laut && laut !== liga.code) { verworfen.push(`${name}: Wikidata sagt ${liga.code}, Infobox sagt ${laut}`); continue; }
      vereine.push({ name, lg: liga.code });
    }
    console.log(`${liga.code}: ${vereine.filter((v) => v.lg === liga.code).length} Vereine`);
  }
  vereine.sort((a, b) => a.lg.localeCompare(b.lg) || a.name.localeCompare(b.name, "de"));

  /* Die Vereins-QID wird gebraucht, um den Trainerstab auszusortieren: fast jeder
     Trainer ist Ex-Profi und trägt daher „Fußballspieler" als Beruf. Trennscharf ist
     erst „Trainer von GENAU DIESEM Verein" (P6087). */
  const clubQid = await titelZuQid(vereine.map((v) => v.name));
  for (const v of vereine) v.qid = clubQid.get(v.name) || null;

  // 2. Je Verein den Kader lesen.
  const roh = [];             // { n, by, gb, nr, nation, po, sl, club }
  const uebersprungen = [];
  console.log("\nVerein                             Kader  mit Nr.  mit Nation");
  for (const v of vereine) {
    try {
      const sec = await wp({ action: "parse", page: v.name, prop: "sections" });
      const abschnitt = waehleAbschnitt(sec.parse?.sections || []);
      if (!abschnitt) { uebersprungen.push(`${v.name}: kein Profikader-Abschnitt`); continue; }
      const html = (await wp({ action: "parse", page: v.name, section: abschnitt.index, prop: "text" })).parse?.text?.["*"] || "";
      const zeilen = kaderTabellen(html);
      const qidVon = await titelZuQid([...new Set(zeilen.flatMap((z) => z.titel))]);
      const daten = await spielerDaten([...new Set([...qidVon.values()])]);

      const kader = [];
      const gesehen = new Set();
      let ohneArtikel = 0;
      for (const z of zeilen) {
        /* Steht in der Flaggenspalte ein Spieler statt eines Landes, hat die Tabelle
           ein Spielerfoto vor dem Namen. Dann lieber keine Nation als eine falsche. */
        const nation = z.nation && daten.has(qidVon.get(z.nation)) ? null : z.nation;
        let fertig = false;
        for (const t of z.titel) {
          const q = qidVon.get(t);
          const d = q && daten.get(q);
          if (!d || gesehen.has(q)) continue;
          gesehen.add(q);
          if (v.qid && d.trainerVon?.has(v.qid)) { fertig = true; break; }   // Trainerstab
          /* Beim DATUM schlägt Wikidata die Tabelle — anders als beim Kader selbst.
             Grund: das Geburtsjahr `by` stammt aus Wikidata und bildet den Schlüssel;
             ein abweichendes Tabellendatum ließe Alter und Identität auseinanderlaufen.
             Passt die Tabelle nicht zum Jahr und hat Wikidata kein volles Datum, bleibt
             das Feld leer und der Spieler fällt aus dem Rätselpool — lieber das als
             eine falsche Alterskachel. */
          const tabellenDatum = z.geb && Number(z.geb.slice(0, 4)) === d.by ? z.geb : null;
          kader.push({ n: d.n, by: d.by, sl: d.sl, gb: d.gb || tabellenDatum, nr: z.nr, nation, po: z.gruppe, club: v });
          fertig = true;
          break;
        }
        if (fertig) continue;
        /* Kein verlinkter Spieler in der Zeile: dann steht sein Name hinter einem
           Rotlink, und die Tabelle ist die einzige Quelle. Das Geburtsdatum ist dabei
           Pflicht — ohne Jahr fehlt der halbe Schlüssel norm(name)|geburtsjahr, und
           zwei gleichnamige Spieler wären nicht mehr zu trennen. */
        // „Aitor Fernández (Fußballspieler, 1991)" ist ein Artikeltitel, kein Name.
        const name = ohneKlammer(z.rot[0] || "") || null;
        if (!name || !z.geb || !z.nr) { if (name) ohneArtikel++; continue; }
        const by = Number(z.geb.slice(0, 4));
        const schluessel = norm(name) + "|" + by;
        if (gesehen.has(schluessel)) continue;
        gesehen.add(schluessel);
        kader.push({ n: name, by, sl: 0, gb: z.geb, nr: z.nr, nation, po: z.gruppe, club: v });
      }
      if (ohneArtikel) uebersprungen.push(`${v.name}: ${ohneArtikel} Rotlink-Spieler ohne Geburtsdatum oder Nummer`);
      if (kader.length < KADER_MIN || kader.length > KADER_MAX) {
        uebersprungen.push(`${v.name} („${abschnitt.line}"): ${kader.length} Spieler — außerhalb ${KADER_MIN}–${KADER_MAX}`);
        continue;
      }
      roh.push(...kader);
      const mitNr = kader.filter((k) => k.nr).length, mitNat = kader.filter((k) => k.nation).length;
      console.log(`${v.lg} ${v.name.slice(0, 29).padEnd(30)}${String(kader.length).padStart(5)}${String(mitNr).padStart(9)}${String(mitNat).padStart(12)}`);
    } catch (e) {
      uebersprungen.push(`${v.name}: ${e.message}`);
    }
    await sleep(200);
  }

  // 3. Nationen auflösen.
  const natTitel = [...new Set(roh.map((r) => r.nation).filter(Boolean))].sort();
  const natVon = await nationen(natTitel);
  const natListe = [...natVon.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const natIndex = new Map(natListe.map((n, i) => [n.name, i]));
  const ohneIso = natTitel.filter((t) => !natVon.has(t));

  // 4. Zusammenbauen. Ein Spieler kann in zwei Kadern stehen (Leihe, Transfer im
  //    Fenster) — dann gilt der zuerst gelesene, damit der Lauf reproduzierbar ist.
  /* Nur Vereine, von denen wirklich ein Kader gelesen wurde — sonst stünden die
     übersprungenen als leere Einträge in der Datei und wären im Spiel wählbar. */
  const benutzt = new Set(roh.map((r) => r.club.name));
  const clubListe = vereine.filter((v) => benutzt.has(v.name)).map((v) => [v.name, v.lg]);
  const clubIndex = new Map(clubListe.map(([n], i) => [n, i]));
  const gesehen = new Set();
  const doppelt = [];
  const spieler = [];
  for (const r of roh) {
    const k = norm(r.n) + "|" + r.by;
    if (gesehen.has(k)) { doppelt.push(`${r.n} (auch ${r.club.name})`); continue; }
    gesehen.add(k);
    spieler.push({
      n: r.n, ln: deriveLastName(r.n), by: r.by, c: clubIndex.get(r.club.name),
      gb: r.gb, nr: r.nr, na: r.nation && natIndex.has(r.nation) ? natIndex.get(r.nation) : -1,
      po: r.po, sl: r.sl,
    });
  }
  spieler.sort((a, b) => a.n.localeCompare(b.n, "en"));

  const zahl = (f) => spieler.filter(f).length;
  console.log(`\n${spieler.length} Spieler in ${clubListe.length} Vereinen`);
  console.log(`  mit Rückennummer: ${zahl((s) => s.nr)} · mit Nation: ${zahl((s) => s.na >= 0)}`
    + ` · mit Position: ${zahl((s) => s.po)} · mit Geburtsdatum: ${zahl((s) => s.gb)}`);
  console.log(`  ohne Wikidata-Eintrag (nur aus der Kadertabelle): ${zahl((s) => !s.sl)}`);
  console.log(`  vollständig (alle sechs Kacheln): ${zahl((s) => s.gb && s.nr && s.po && s.na >= 0)}`);
  console.log(`  ${natListe.length} Nationen`);
  if (ohneIso.length) console.log(`  ohne ISO-Code (Kachel bleibt leer): ${ohneIso.join(", ")}`);
  if (doppelt.length) console.log(`  in zwei Kadern, erster gilt (${doppelt.length}): ${doppelt.slice(0, 10).join(", ")}`);
  if (verworfen.length) console.log(`\nVereine verworfen (${verworfen.length}):\n  ` + verworfen.join("\n  "));
  if (uebersprungen.length) console.log(`\nÜbersprungen (${uebersprungen.length}):\n  ` + uebersprungen.join("\n  "));

  if (probe) { console.log("\n--probe: nichts geschrieben."); return; }
  const stand = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, dateiInhalt(clubListe, natListe.map((n) => [n.iso, n.name]), spieler, stand));
  stampFixes();
  console.log(`\nFertig: src/squads.js (${(readFileSync(OUT, "utf8").length / 1024).toFixed(0)} KB)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
