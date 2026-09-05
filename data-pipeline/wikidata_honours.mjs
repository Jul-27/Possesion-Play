#!/usr/bin/env node
/*
 * wikidata_honours.mjs — Setzt das Feld `t` (Honours) je Spieler in src/players.js
 * komplett aus Wikidata: Saison-Sieger je Wettbewerb (P1346) × Spieler-Vereins-
 * zeitraum (P54 mit P580/P582). Internet nötig. Idempotent. Läuft NACH dem Roster.
 *   node data-pipeline/wikidata_honours.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { stampDataInfo } from "./stamp.mjs";
import { LABEL_SERVICE, cleanName } from "./wikidata_label.mjs";
import { recToString } from "./player_record.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Honour-Key -> Wikidata-Wettbewerb (verifiziert: Label + vorhandene Saison-Sieger)
export const COMP_QID = {
  CL:"Q18756", WM:"Q19317",
  MBL:"Q82595", MPL:"Q9448", MLL:"Q324867", MSA:"Q15804", ML1:"Q13394",
  DFB:"Q150880", FAC:"Q11151", CDR:"Q483794", CIT:"Q169918",
};

/* Buchstaben, die lateinisch AUSSEHEN, aber griechisch oder kyrillisch sind. Sie
   kommen in Wikidata-Labels vor — teils Tippfehler, teils Vandalismus — und machen
   einen Namen für jeden Vergleich unauffindbar.

   GEMESSEN: Arda Gülers englisches Label begann mit einem griechischen Alpha
   („Αrda Güler", U+0391). Der Schlüssel „αrda guler" traf unseren „arda guler"
   nicht, und er verlor Meisterschaft und Champions League — obwohl beide Seiten
   auf dem Bildschirm identisch aussehen. */
const HOMOGLYPHEN = {
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0396": "Z", "\u0397": "H",
  "\u0399": "I", "\u039A": "K", "\u039C": "M", "\u039D": "N", "\u039F": "O",
  "\u03A1": "P", "\u03A4": "T", "\u03A5": "Y", "\u03A7": "X", "\u03BF": "o",
  "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041A": "K", "\u041C": "M",
  "\u041D": "H", "\u041E": "O", "\u0420": "P", "\u0421": "C", "\u0422": "T",
  "\u0423": "Y", "\u0425": "X", "\u0430": "a", "\u0435": "e", "\u043E": "o",
  "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x",
};

export function norm(s) {
  return String(s)
    /* Geschützte und schmale Leerzeichen zuerst — zwei unserer eigenen Namen tragen
       sie, und „Ezequiel\u00A0Fernández" ist sonst ein anderer Name als der mit
       gewöhnlichem Leerzeichen. */
    .replace(/[\u00A0\u2007\u202F\u200B-\u200D]/g, " ")
    .replace(/[\u0391-\u03BF\u0410-\u0445]/g, (c) => HOMOGLYPHEN[c] || c)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

// Kuratierte, vom Owner bestätigte Fakten, die Wikidata (noch) nicht liefert.
// Key: norm(name)|Geburtsjahr -> zusätzliche Honour-Keys (additiv).
export const HONOUR_OVERRIDES = {
  "florian wirtz|2003": ["DFB"],  // DFB-Pokal 2024 mit Leverkusen
  "harry kane|1993": ["DFB"],
  // Bayern-Meister 2020/21 + 2021/22; sein Bayern-Eintrag ist in Wikidata inzwischen
  // verschwunden (nur noch PSG, fälschlich offen), daher greift die Query nicht.
  "tanguy nianzou|2002": ["MBL"],
};

// Saison-Sieger, die Wikidata (noch) nicht als P1346 führt (Owner-bestätigt).
// Honour-Key -> [[Saisonstartjahr, Club-Key], ...]; angewandt über cp mit derselben
// Regel wie ZEITFILTER: von <= Saisonstart && bis >= Saisonende.
export const GAP_WINNERS = {
  DFB: [[2009, "FCB"], [2011, "BVB"], [2012, "FCB"], [2013, "FCB"],
        [2023, "B04"], [2024, "VFB"], [2025, "FCB"]],
  /* FA Cup 2003/04 (United) und 2004/05 (Arsenal, im Elfmeterschießen gegen United).
     Wikidata führt für beide Endspiele gar keine Saison mit Sieger — aufgefallen, weil
     van Persie den Pokal 2005 real gewann, unsere Quelle davon aber nichts weiß. */
  FAC: [[2003, "MUN"], [2004, "ARS"]],
  CDR: [[2024, "BAR"], [2022, "RMA"]], // Copa del Rey 2024/25 (Barça), 2022/23 (Real)
  MBL: [[2022, "FCB"]],                // Bundesliga 2022/23 (Bayern)
};

/* DER VEREINSSCHLÜSSEL KENNT KEIN GESCHLECHT. „ARS" steht für Arsenal, und im Bestand
   liegen auch Spielerinnen von Arsenal Women mit einer ARS-Station. Über cp allein
   bekämen sie den Männer-FA-Cup zugeschrieben — alle unsere Honour-Keys sind
   Männerwettbewerbe.

   Wikidata weiß es (P21), unser Bestand führt das Feld nicht. Deshalb steht es hier
   als kuratierte Ausnahme: abgefragt, nicht geraten. Geprüft wurden alle 43 Spieler,
   die der Arsenal-Eintrag unten trifft — 40 Männer, diese drei nicht. */
export const KEINE_MAENNERTITEL = new Set([
  "amber hearn|1984",   // Arsenal Women
  "ciara grant|1978",   // Arsenal Women
  "jayne ludlow|1979",  // Arsenal Women
]);

const gapEnd = (to) => (to === 0 ? 9999 : to);

/* Dieselbe Regel wie ZEITFILTER, nur in JavaScript und auf cp angewandt: Die Station
   muss im Startjahr der Saison bestehen und bis in deren Endjahr reichen. Hier steht
   sie als eigene Funktion, damit ein Test sie prüfen kann — die SPARQL-Fassung lässt
   sich nur gegen das Netz prüfen, diese hier gegen Ibrahimović auf dem Papier. */
export const imZeitraum = (von, bis, saisonStart, saisonEnde = saisonStart + 1) =>
  von <= saisonStart && gapEnd(bis) >= saisonEnde;

export function applyGapWinners(players) {
  let added = 0;
  for (const [key, seasons] of Object.entries(GAP_WINNERS)) {
    for (const [year, club] of seasons) {
      for (const p of players) {
        if (KEINE_MAENNERTITEL.has(norm(p.n) + "|" + p.by)) continue;
        if (!(p.cp || []).some(([k, f, t]) => k === club && imZeitraum(f, t, year))) continue;
        const set = new Set(p.t || []);
        if (!set.has(key)) { set.add(key); p.t = [...set].sort(); added++; }
      }
    }
  }
  return added;
}

/* WAR DER SPIELER IN DIESER SAISON WIRKLICH DA?
   Beide Seiten sind in Wikidata nur JAHRESGENAU: eine Saison hat ein Start- und ein
   Endjahr (2008/2009), eine Station ein Von- und ein Bis-Jahr (2009–2010). Die alte
   Fassung fragte, ob sich die beiden Zeiträume IRGENDWIE überschneiden — und weil ein
   gemeinsames Kalenderjahr dafür reichte, zählte jeder Sommerwechsel doppelt: wer im
   Juli 2009 kam, bekam den Titel vom Mai 2009 mit, und wer im Juli 2024 ging, bekam
   den der Saison 2024/25 dazu.

   GEMESSEN an den beiden gemeldeten Fällen:
     Ibrahimović · Champions League · Barcelona 2008/09 (kam erst 2009), Inter 2009/10
       (ging 2009), Barcelona 2010/11 (ging 2010) — drei Titel, keiner davon seiner.
     Mbappé · Champions League · Real 2023/24 (kam 2024), PSG 2024/25 (ging 2024).
   Beide haben die Champions League nie gewonnen.

   Richtig ist deshalb nicht Überschneidung, sondern UMSCHLIESSUNG: Die Station muss
   im Startjahr der Saison schon bestehen und mindestens bis in deren Endjahr reichen.
   Die beiden Jahre waren schlicht vertauscht.

   Warum das Endjahr über COALESCE läuft: Turniere ohne P582 (Weltmeisterschaft,
   Europameisterschaft) finden IM Startjahr statt. Für sie muss `>= ?ss` gelten, sonst
   verlöre jeder seinen Titel, der danach zurücktritt — Lahm etwa beendete seine
   Länderspiellaufbahn 2014 direkt nach dem Turnier.

   DER WINTERWECHSEL. Die Jahresregel kostet einen Fall, den sie nicht kosten darf:
   Beckham kam am 31.01.2013 zu PSG und wurde im Mai mit ihnen Meister — sein Startjahr
   2013 liegt aber nach dem Saisonstartjahr 2012. Wikidata schreibt zu jedem Datum
   dazu, WIE genau es ist (9 = nur das Jahr, 11 = auf den Tag). Nur bei taggenauen
   Angaben dürfen wir wirklich rechnen; die vielen „2003-01-01" sind Platzhalter für
   „irgendwann 2003" und würden jeden Vergleich in die Irre führen.

   Deshalb die Ausnahme: Ein taggenauer Wechsel MITTEN in die laufende Saison zählt.
   Für das Ende gibt es keine solche Ausnahme — wer im Winter geht, hat den Titel im
   Mai nicht gewonnen, und Beckhams Vertragsende (16.05.2013) fällt ohnehin ins
   Endjahr der Saison.

   GEMESSEN über vier Wettbewerbe: 19 solcher Winterwechsel gegenüber rund 900
   Zeitangaben, die nur das Jahr kennen. */
export const START_GENAUIGKEIT =
  "?st pqv:P580 [ wikibase:timeValue ?cs ; wikibase:timePrecision ?csP ] .";
export const ZEITFILTER =
  "FILTER( ( YEAR(?cs) <= YEAR(?ss) || ( ?csP >= 10 && ?cs <= COALESCE(?se, ?ss) ) )"
  + " && (!BOUND(?ce) || !isLiteral(?ce) || YEAR(?ce) >= YEAR(COALESCE(?se, ?ss))) )";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    } catch (e) { await sleep(5000); continue; }       // Netzwerkfehler -> retry
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; }
    catch (e) { await sleep(5000); continue; }          // unvollständige/abgeschnittene Antwort -> retry
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

/* Zeitfenster (Saison-Startjahr), um zu große WDQS-Antworten zu vermeiden.
   Früher waren das bis zu 70 Jahre breite Blöcke. Die kippen inzwischen zuverlässig
   ins Timeout — gemessen am 03.08.2026: von fünf Wettbewerben scheiterten vier,
   dasselbe Fenster in 4-Jahres-Schritten antwortet dagegen mit 200. Ursache ist die
   gewachsene Datenmenge (mit Schalke, HSV, Mainz, Freiburg und Hoffenheim allein
   ~1300 Spieler mehr). Feiner = mehr Abfragen, aber sie kommen durch. */
export const WINDOWS = [];
for (let y = 1890; y < 2032; y += 4) WINDOWS.push([y, y + 4]);

// Spieler, die im Titel-Saison-Zeitraum beim Sieger des Wettbewerbs waren (gefenstert).
async function fetchHonourPlayers(qid) {
  const out = [];
  for (const [from, to] of WINDOWS) {
    const q = `SELECT DISTINCT ?pLabel ?deLabel ?by WHERE {
      ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; (wdt:P580|wdt:P585) ?ss .
      FILTER( YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
      OPTIONAL { ?season wdt:P582 ?se. }
      # Der Saison-Sieger (P1346) ist bei neueren Titeln die „Herrenfußballmannschaft"
      # (eigene Entität), nicht der Verein, dem die Spieler per P54 zugeordnet sind.
      # P831 (Mutterverein) als Zero-or-One-Pfad brückt darauf; bei älteren Saisons ist
      # der Sieger direkt der Verein (kein P831) und ?club = ?winner. Ohne diese Brücke
      # fehlten z. B. die Leverkusen-Meister 2023/24 (Wirtz, Boniface) komplett.
      ?winner wdt:P831? ?club .
      ?p p:P54 ?st . ?st ps:P54 ?club .
      ${START_GENAUIGKEIT}
      # „UNBEKANNTER WERT" IST KEIN DATUM. Wikidata kennt neben „kein Wert" auch
      # „unbekannter Wert"; der kommt als anonymer Knoten zurück — die Variable ist
      # also GEBUNDEN, aber YEAR() scheitert daran, der Filter wird falsch und die
      # ganze Zeile fällt weg. Der Spieler verlor damit JEDEN Titel dieses Vereins.
      # Gemessen: 50 Stationen betroffen — Rüdiger bei Real (La Liga fehlte), Gnabry
      # bei Bayern (eine Meisterschaft statt sieben, Champions League gar nicht),
      # Andrich bei Leverkusen. Geprüft an La Liga 2020–2026: 194 Spieler ohne, 198
      # mit der Korrektur. Die Prüfung steht im ÄUSSEREN Filter und nicht im
      # OPTIONAL: Dort kostete es so viel, dass WDQS in den Zeitausfall lief.
      OPTIONAL { ?st pq:P582 ?ce. }
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
      # ZWEI LABEL STATT EINEM. Wir gleichen über Namen ab, und die ENGLISCHEN Labels
      # werden in Wikidata regelmäßig manipuliert: André Onana hieß dort „Andrcu
      # Onana", Wayne Rooney „El Perrito de la C", Juan Mata „Juan Mata Pata". Wer so
      # umbenannt ist, findet keinen Anschluss an unseren Bestand und verliert JEDEN
      # Titel. Das deutsche Label war in allen beobachteten Fällen sauber, also zählt
      # ein Treffer auf einer der beiden Schreibweisen.
      OPTIONAL { ?p rdfs:label ?deLabel . FILTER(LANG(?deLabel) = "de") }
      ${ZEITFILTER}
      ${LABEL_SERVICE}
    }`;
    const rows = await sparql(q);
    for (const b of rows) {
      out.push({
        name: cleanName(b.pLabel?.value),
        deName: cleanName(b.deLabel?.value),
        by: b.by?.value ? parseInt(b.by.value) : null,
      });
    }
    await sleep(700);
  }
  return out;
}

/* ── NACHFASSEN ÜBER DEN WIKIPEDIA-ARTIKEL ───────────────────────────────────
   Der Abgleich oben läuft über Labels, und Labels sind der wackligste Teil von
   Wikidata: Messi und Mbappé tragen derzeit WEDER ein deutsches NOCH ein englisches
   Label, obwohl ihre Einträge 133 Sprachversionen verlinken. Für den additiven Lauf
   war das nur eine Lücke; für einen Lauf, der Titel auch ENTFERNEN darf, wäre es eine
   Katastrophe: „kein Treffer" hieße „keine Titel".

   Der Sitelink auf die deutsche Wikipedia ist die stabilere Kennung — dort heißt der
   Artikel „Kylian Mbappé", auch wenn das Wikidata-Label leer ist. Ihn in die große
   Abfrage einzubauen war nicht möglich (gemessen: HTTP 502 nach 21 s); als eigene,
   kleine Abfrage über eine Namensliste kostet er 1,2 s für vier Spieler.

   Zwei Schritte, weil sie zwei verschiedene Fragen beantworten: `findeUeberWikipedia`
   klärt, ob wir den Spieler ÜBERHAUPT sicher identifizieren — nur dann dürfen wir
   seine Titel anfassen. `holeTitelFuer` liefert dann die Titel, notfalls die leere
   Menge. */
const stueckeln = (liste, n) => Array.from({ length: Math.ceil(liste.length / n) }, (_, i) => liste.slice(i * n, i * n + n));

/** Namen -> Menge der sicher identifizierten "norm|by"-Schlüssel. */
export async function findeUeberWikipedia(namen, chunk = 120) {
  const gefunden = new Set();
  for (const teil of stueckeln([...new Set(namen)], chunk)) {
    const q = `SELECT DISTINCT ?name ?by WHERE {
      VALUES ?name { ${teil.map((n) => JSON.stringify(n) + "@de").join(" ")} }
      ?art schema:about ?p ; schema:isPartOf <https://de.wikipedia.org/> ; schema:name ?name .
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
    }`;
    for (const b of await sparql(q)) gefunden.add(norm(b.name.value) + "|" + b.by.value);
    await sleep(700);
  }
  return gefunden;
}

/** Namen -> Map "norm|by" -> Set(Honour-Keys), über den Wikipedia-Artikel gefunden.
    `comps` ist die Wettbewerbstabelle; wikidata_honours_extra.mjs reicht seine eigene
    herein, damit die Europa League nach derselben Regel geprüft wird. */
export async function holeTitelFuer(namen, comps = COMP_QID, chunk = 60) {
  const out = new Map();
  const vonQid = Object.fromEntries(Object.entries(comps).map(([k, q]) => [q, k]));
  for (const teil of stueckeln([...new Set(namen)], chunk)) {
    const q = `SELECT DISTINCT ?name ?comp ?by WHERE {
      VALUES ?name { ${teil.map((n) => JSON.stringify(n) + "@de").join(" ")} }
      ?art schema:about ?p ; schema:isPartOf <https://de.wikipedia.org/> ; schema:name ?name .
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
      VALUES ?comp { ${Object.values(comps).map((x) => "wd:" + x).join(" ")} }
      ?season wdt:P3450 ?comp ; wdt:P1346 ?winner ; (wdt:P580|wdt:P585) ?ss .
      OPTIONAL { ?season wdt:P582 ?se. }
      ?winner wdt:P831? ?club .
      ?p p:P54 ?st . ?st ps:P54 ?club .
      ${START_GENAUIGKEIT}
      OPTIONAL { ?st pq:P582 ?ce. }
      ${ZEITFILTER}
    }`;
    for (const b of await sparql(q)) {
      const k = norm(b.name.value) + "|" + b.by.value;
      if (!out.has(k)) out.set(k, new Set());
      out.get(k).add(vonQid[b.comp.value.split("/").pop()]);
    }
    await sleep(700);
  }
  return out;
}

async function main() {
  // 1) Honours pro Spieler aus Wikidata: key "norm|by" -> Set(honourKeys)
  const hon = new Map();
  for (const [key, qid] of Object.entries(COMP_QID)) {
    /* Kein `continue` im Fehlerfall: ohne --additiv setzt dieser Lauf `t` neu, und
       ein übersprungener Wettbewerb löschte dann jeden Titel dieser Art bei jedem
       Spieler — still und großflächig. Lieber abbrechen und den alten Stand behalten. */
    let rows;
    try { rows = await fetchHonourPlayers(qid); }
    catch (e) { throw new Error(`${key} (${qid}) fehlgeschlagen: ${e.message} — Abbruch, damit kein Titel verloren geht.`); }
    let c = 0;
    for (const r of rows) {
      if (!r.by) continue;
      /* Beide Schreibweisen eintragen: Der Bestand kennt den Spieler unter einer von
         beiden, und welche das ist, wissen wir hier nicht. */
      for (const n of new Set([r.name, r.deName].filter(Boolean))) {
        const k = norm(n) + "|" + r.by;
        if (!hon.has(k)) hon.set(k, new Set());
        hon.get(k).add(key);
      }
      if (r.name || r.deName) c++;
    }
    console.log(`  ${key} (${qid}): ${rows.length} Zeilen, ${c} Zuordnungen`);
    await sleep(1300);
  }

  // 2) players.js laden, t neu setzen
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  /* --additiv: bereits eingetragene Titel bleiben stehen, es kommen nur welche dazu.
     Wikidata wird aktiv vandaliert — ein neu setzender Lauf hätte hier schon einmal
     38 real gewonnene Titel bei 20 Spielern still gelöscht. Wenn der Lauf nur dazu
     dient, neu aufgenommene Spieler zu versorgen, ist additiv die richtige Wahl. */
  const additiv = process.argv.includes("--additiv");
  /* --korrigiere: additiv, ABER bei Spielern, die wir sicher identifiziert haben,
     werden falsche Titel auch entfernt. „Sicher identifiziert" heißt: Der Lauf oben
     hat sie getroffen, oder das Nachfassen über die Wikipedia hat sie gefunden. Wen
     wir nicht sicher wiedererkennen, den fassen wir nicht an. */
  const korrigiere = process.argv.includes("--korrigiere");
  console.log(korrigiere ? "  Modus: korrigierend (falsche Titel werden entfernt, unbekannte Spieler bleiben unberührt)"
    : additiv ? "  Modus: additiv (vorhandene t bleiben erhalten)" : "  Modus: t wird neu gesetzt");

  const EIGENE = new Set(Object.keys(COMP_QID));
  /* EL, BDO, CA und EM kommen aus wikidata_honours_extra.mjs. Dieser Lauf weiß nichts
     über sie und darf sie deshalb auch im Korrekturmodus nicht anrühren. */
  const fremde = (p) => (p.t || []).filter((k) => !EIGENE.has(k));

  let sicher = hon;
  if (korrigiere) {
    /* Wer Titel trägt, den dieser Lauf nicht gefunden hat, ist der Verdachtsfall:
       entweder sind die Titel falsch, oder sein Label ist kaputt. Das trennt nur die
       Wikipedia. */
    const offen = players.filter((p) => (p.t || []).some((k) => EIGENE.has(k)) && !hon.has(norm(p.n) + "|" + p.by));
    console.log(`  Nachfassen über Wikipedia: ${offen.length} Spieler mit Titeln ohne Treffer`);
    const namen = offen.map((p) => p.n);
    const erkannt = await findeUeberWikipedia(namen);
    const nach = await holeTitelFuer(offen.filter((p) => erkannt.has(norm(p.n) + "|" + p.by)).map((p) => p.n));
    console.log(`  davon eindeutig wiedererkannt: ${[...erkannt].length} · mit Titeln: ${nach.size}`);
    sicher = new Map(hon);
    for (const p of offen) {
      const k = norm(p.n) + "|" + p.by;
      if (erkannt.has(k)) sicher.set(k, nach.get(k) || new Set());
    }
  }

  let withT = 0, entfernt = 0, unberuehrt = 0;
  for (const p of players) {
    const k = norm(p.n) + "|" + p.by;
    const keys = sicher.get(k);
    if (korrigiere) {
      if (!keys) { if ((p.t || []).some((x) => EIGENE.has(x))) unberuehrt++; continue; }
      const vorher = (p.t || []).filter((x) => EIGENE.has(x));
      entfernt += vorher.filter((x) => !keys.has(x)).length;
      const neu = [...new Set([...fremde(p), ...keys])].sort();
      if (neu.length) { p.t = neu; withT++; } else delete p.t;
    } else if (keys && keys.size) {
      p.t = [...new Set([...(additiv ? p.t || [] : []), ...keys])].sort(); withT++;
    } else if (!additiv) delete p.t;
  }
  if (korrigiere) console.log(`  ${entfernt} falsche Titel entfernt · ${unberuehrt} Spieler nicht wiedererkannt und deshalb unberührt`);

  // Wikidata-Sieger-Lücken über cp schließen
  console.log(`  GAP_WINNERS: ${applyGapWinners(players)} Zuordnungen`);

  // Kuratierte Overrides additiv anwenden
  for (const p of players) {
    const extra = HONOUR_OVERRIDES[norm(p.n) + "|" + p.by];
    if (extra) p.t = [...new Set([...(p.t || []), ...extra])].sort();
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${withT} Spieler mit Honours -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
