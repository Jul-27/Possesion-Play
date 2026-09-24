#!/usr/bin/env node
/*
 * wikipedia_turniersieger.mjs — setzt WM, EM und CA in `t` aus den Kategorien der
 * deutschen Wikipedia. Internet nötig. Idempotent. Läuft als LETZTER Schritt der
 * Kette, damit auch Spieler aus den späten Kaderläufen ihren Titel bekommen.
 *   node data-pipeline/wikipedia_turniersieger.mjs           # schreibt players.js
 *   node data-pipeline/wikipedia_turniersieger.mjs --print   # nur den Unterschied zeigen
 *
 * ── WARUM NICHT MEHR WIKIDATA ─────────────────────────────────────────────────
 * Bis hierhin kamen die drei Turniertitel nach derselben Regel wie ein Meistertitel:
 * Sieger des Turniers (P1346) × Zugehörigkeit zur Nationalmannschaft (P54) über das
 * Turnierjahr. Für einen Verein stimmt das — wer die Saison über im Kader stand, ist
 * Meister. Für eine Nationalmannschaft stimmt es nicht: Wikidata führt dort die
 * Zugehörigkeit als einen langen Zeitraum ohne Unterbrechung, und jeder, der das
 * Turnierjahr darin einschließt, wurde Weltmeister — auch ohne Kadernominierung.
 *
 * GEMESSEN am 25.09.2026 an Spanien 2026: 92 Spanier trugen „WM", der Kader hatte 26.
 * Ansu Fati, Adama Traoré, José Gayà und Pau Torres standen darunter, Aymeric Laporte,
 * Marcos Llorente und Marc Pubill (alle drei im Finalkader) fehlten.
 *
 * Die Wikipedia-Kategorien „Fußballweltmeister (Land)", „Fußballeuropameister (Land)"
 * und „Südamerikameister (Fußball)" führen genau die Kaderspieler, nur A-Mannschaft
 * (Götze: WM ja, EM nein; Ansu Fati: keins von beiden). Weltmeisterinnen stehen in
 * denselben Kategorien (Japan, Norwegen, USA, auch Deutschland und Spanien) — sie
 * fallen über das Geschlecht in Wikidata (P21) heraus, denn unser Bestand kennt nur
 * Männertitel.
 *
 * ── ABGLEICH ─────────────────────────────────────────────────────────────────
 * Über den Artikel zum Wikidata-Eintrag, von dort englisches und deutsches Label und
 * das Geburtsjahr — derselbe Schlüssel norm(name)|by wie überall. Der Artikeltitel
 * ohne Klammerzusatz zählt als dritte Schreibweise („Gavi (Fußballspieler)").
 *
 * ── DIESER SCHRITT IST MASSGEBLICH ───────────────────────────────────────────
 * Er setzt die drei Titel neu, statt zu ergänzen: Wer nicht in der Kategorie steht,
 * verliert ihn. keine_station_verlieren.mjs holt sie deshalb nicht zurück (TURNIER_KEYS).
 * Damit eine Netzstörung das nicht in einen Massenverlust verwandelt, bricht der Lauf
 * ab, sobald eine Kategorie leer bleibt oder ein Turnier unter MINDESTENS fällt.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm } from "./wikidata_honours.mjs";
import { cleanName } from "./wikidata_label.mjs";
import { recToString } from "./player_record.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const API = { de: "https://de.wikipedia.org/w/api.php", en: "https://en.wikipedia.org/w/api.php" };

/* Je Turnier die Quellen: Oberkategorie (ihre Unterkategorien je Land) oder die
   Kategorie selbst. Deutsche UND englische Wikipedia, vereinigt — keine ist allein
   vollständig. GEMESSEN: Denílson (Copa América 1997) fehlt in der deutschen
   Kategorie, steht aber in der englischen. Die englischen Namen schreiben einen
   Halbgeviertstrich („World Cup–winning"), keinen Bindestrich. */
export const TURNIERE = {
  WM: [{ wiki: "de", ober: "Kategorie:Fußballweltmeister" },
       { wiki: "en", kategorien: ["Category:FIFA World Cup–winning players"] }],
  EM: [{ wiki: "de", ober: "Kategorie:Europameister (Fußball)" },
       { wiki: "en", kategorien: ["Category:UEFA European Championship–winning players"] }],
  CA: [{ wiki: "de", kategorien: ["Kategorie:Südamerikameister (Fußball)"] },
       { wiki: "en", kategorien: ["Category:Copa América–winning players"] }],
};
export const TURNIER_KEYS = new Set(Object.keys(TURNIERE));

/* Untergrenzen für Männer mit Artikel — gemessen am 25.09.2026 und großzügig
   abgerundet. Darunter stimmt etwas mit der Abfrage nicht, nicht mit dem Fußball. */
const MINDESTENS = { WM: 450, EM: 300, CA: 400 };

const WEIBLICH = "Q6581072";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function holeJson(url, headers = {}) {
  for (let versuch = 0; versuch < 5; versuch++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, ...headers } }); }
    catch { await sleep(4000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} für ${url.slice(0, 120)}`);
    try { return await res.json(); } catch { await sleep(4000); }
  }
  throw new Error(`Abruf fehlgeschlagen (Retries erschöpft): ${url.slice(0, 120)}`);
}

/** Alle Seiten einer MediaWiki-Abfrage, über `continue` hinweg. */
async function alleSeiten(wiki, params) {
  const out = [];
  let weiter = {};
  do {
    const q = new URLSearchParams({ format: "json", action: "query", formatversion: "2", ...params, ...weiter });
    const j = await holeJson(`${API[wiki]}?${q}`);
    out.push(j.query || {});
    weiter = j.continue || null;
    await sleep(200);
  } while (weiter);
  return out;
}

async function unterkategorien(wiki, ober) {
  const teile = await alleSeiten(wiki, { list: "categorymembers", cmtitle: ober, cmtype: "subcat", cmlimit: "max" });
  return teile.flatMap((t) => (t.categorymembers || []).map((m) => m.title));
}

/** Artikel einer Kategorie -> [{ titel, qid }]. */
async function artikel(wiki, kategorie) {
  const teile = await alleSeiten(wiki, {
    generator: "categorymembers", gcmtitle: kategorie, gcmnamespace: "0", gcmlimit: "max",
    prop: "pageprops", ppprop: "wikibase_item",
  });
  const seiten = [];
  for (const t of teile) for (const p of t.pages || []) {
    const qid = p.pageprops?.wikibase_item;
    if (qid) seiten.push({ titel: p.title, qid });
  }
  return seiten;
}

/* Aus einer wbgetentities-Entität: { namen, jahre, weiblich }. Eigene Funktion, damit
   der Test sie ohne Netz prüfen kann.

   ALLE GEBURTSJAHRE, NICHT DAS ERSTE. Wikidata führt bei manchen Spielern mehrere
   Geburtsdaten nebeneinander. GEMESSEN: Pepe steht dort mit 1984 an erster Stelle,
   unser Bestand kennt ihn als 1983 — mit nur dem ersten Datum verlor er die EM 2016.
   Als veraltet markierte Angaben zählen nicht. */
export function person(e) {
  const namen = new Set([e.labels?.en?.value, e.labels?.de?.value].map(cleanName).filter(Boolean));
  const jahre = new Set((e.claims?.P569 || [])
    .filter((c) => c.rank !== "deprecated" && c.mainsnak?.datavalue)
    .map((c) => parseInt(c.mainsnak.datavalue.value.time.match(/^[+-]?(\d+)/)[1], 10)));
  const weiblich = (e.claims?.P21 || []).some((c) => c.mainsnak?.datavalue?.value?.id === WEIBLICH);
  return { namen, jahre, weiblich };
}

/* QIDs -> Map qid -> { namen, jahre, weiblich }.
   Über wbgetentities statt SPARQL: reine Nachschlage-Abfragen, und der Query-Dienst
   antwortete beim Bau dieses Schritts (25.09.2026) minutenlang nur mit 502. */
async function personen(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += 50) {
    const q = new URLSearchParams({
      action: "wbgetentities", format: "json", ids: qids.slice(i, i + 50).join("|"),
      props: "labels|claims", languages: "en|de",
    });
    const j = await holeJson(`https://www.wikidata.org/w/api.php?${q}`);
    for (const [qid, e] of Object.entries(j.entities || {})) out.set(qid, person(e));
    await sleep(300);
  }
  return out;
}

export const ohneKlammer = (titel) => titel.replace(/\s*\([^)]*\)\s*$/, "").trim();

/* Das Geburtsjahr im Klammerzusatz („Pepe (Fußballspieler, 1983)", „Pepe (footballer,
   born February 1983)"). GEMESSEN: Wikidata führt Pepe derzeit NUR mit 1984 — falsch,
   beide Artikeltitel sagen 1983. Der Titel ist hier die stabilere Angabe. */
export const titelJahr = (titel) => {
  const m = titel.match(/\((?:[^)]*\D)?((?:18|19|20)\d\d)\)\s*$/);
  return m ? parseInt(m[1], 10) : null;
};

/** Artikel + Personendaten -> Menge der Schlüssel norm(name)|by (nur Männer mit Geburtsjahr).
    Jede Seite trägt ihre Artikeltitel aus beiden Wikipedias (`titel`: Liste). */
export function siegerSchluessel(seiten, pers) {
  const out = new Set();
  for (const { titel, qid } of seiten) {
    const p = pers.get(qid);
    if (!p || p.weiblich) continue;
    const namen = new Set([...p.namen, ...titel.map(ohneKlammer)]);
    const jahre = new Set([...p.jahre, ...titel.map(titelJahr).filter(Boolean)]);
    for (const n of namen) for (const by of jahre) out.add(norm(n) + "|" + by);
  }
  return out;
}

/**
 * Setzt die Turniertitel neu. `sieger` ist { WM: Set(schlüssel), … }; nur die dort
 * genannten Turniere werden angefasst. Gibt je Turnier { dazu, weg } (Spielernamen) zurück.
 */
export function setzeTurniertitel(players, sieger) {
  const bericht = {};
  for (const key of Object.keys(sieger)) bericht[key] = { dazu: [], weg: [] };
  for (const p of players) {
    const k = norm(p.n) + "|" + p.by;
    const t = new Set(p.t || []);
    for (const [key, menge] of Object.entries(sieger)) {
      const soll = menge.has(k);
      if (soll && !t.has(key)) { t.add(key); bericht[key].dazu.push(`${p.n} (${p.by})`); }
      if (!soll && t.has(key)) { t.delete(key); bericht[key].weg.push(`${p.n} (${p.by})`); }
    }
    if (t.size) p.t = [...t].sort(); else delete p.t;
  }
  return bericht;
}

/** Holt je Turnier Artikel und Personen: { WM: { seiten, pers }, … }. Bricht bei Lücken ab. */
export async function holeSieger(log = console.log) {
  const roh = {};
  for (const [key, quellen] of Object.entries(TURNIERE)) {
    const seiten = new Map();
    let zahl = 0;
    for (const { wiki, ober, kategorien: feste } of quellen) {
      const kategorien = feste || await unterkategorien(wiki, ober);
      if (!kategorien.length) throw new Error(`${key}: keine Kategorien unter ${ober} — Abbruch, damit kein Titel verloren geht.`);
      for (const kat of kategorien) {
        const liste = await artikel(wiki, kat);
        if (!liste.length) throw new Error(`${key}: ${kat} ist leer — Abbruch, damit kein Titel verloren geht.`);
        for (const s of liste) {
          const e = seiten.get(s.qid) || { qid: s.qid, titel: [] };
          e.titel.push(s.titel);
          seiten.set(s.qid, e);
        }
      }
      zahl += kategorien.length;
    }
    const pers = await personen([...seiten.keys()]);
    const maenner = [...seiten.values()].filter((s) => pers.get(s.qid) && !pers.get(s.qid).weiblich).length;
    if (maenner < MINDESTENS[key]) {
      throw new Error(`${key}: nur ${maenner} Männer gefunden (erwartet ≥ ${MINDESTENS[key]}) — Abbruch.`);
    }
    roh[key] = { seiten: [...seiten.values()], pers };
    log(`  ${key}: ${zahl} Kategorie(n), ${seiten.size} Personen, ${maenner} Männer`);
  }
  return roh;
}

async function main() {
  const nurZeigen = process.argv.includes("--print");
  const roh = await holeSieger();
  const sieger = Object.fromEntries(Object.entries(roh).map(([k, r]) => [k, siegerSchluessel(r.seiten, r.pers)]));

  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p }));
  const bericht = setzeTurniertitel(players, sieger);
  for (const [key, { dazu, weg }] of Object.entries(bericht)) {
    console.log(`\n  ${key}: +${dazu.length} / −${weg.length}`);
    if (dazu.length) console.log(`    dazu: ${dazu.join(", ")}`);
    if (weg.length) console.log(`    weg:  ${weg.join(", ")}`);
  }
  if (nurZeigen) return console.log("\n--print: nichts geschrieben.");

  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const kopf = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, kopf + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  console.log("\nGeschrieben: src/players.js");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
