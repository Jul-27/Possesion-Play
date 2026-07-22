#!/usr/bin/env node
/*
 * wikidata_images.mjs — lädt Spielerfotos (Wikidata P18) als 120px-Thumbnails von
 * Wikimedia Commons nach public/players/<QID>.<ext> und schreibt den Index
 * src/playerImages.js ("norm(name)|geburtsjahr" -> Dateiname).
 *
 * Die Records haben keine QID, der Abgleich läuft daher über norm(name)|by — denselben
 * Schlüssel, den auch wikidata_roster.mjs zum Aggregieren benutzt. norm() wird bewusst aus
 * src/gameData.js importiert, damit Pipeline und App exakt dieselbe Normalisierung nutzen
 * (die Pipeline-eigene norm() in wikidata_roster.mjs behandelt ø/ł/ß NICHT).
 *
 *   node data-pipeline/wikidata_images.mjs
 * Idempotent: vorhandene Dateien werden übersprungen, der Lauf ist wiederholbar.
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createHash } from "crypto";
import { norm } from "../src/gameData.js";
import { PLAYERS } from "../src/players.js";
import { CLUB_QID } from "./wikidata_roster.mjs";
import { NAT_TEAM_QID } from "./wikidata_national.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "players");
const INDEX = join(HERE, "..", "src", "playerImages.js");
const UA = "PossessionPlay/1.0 (privates Hobbyprojekt; Kontakt via GitHub Jul-27/Possesion-Play)";
const SL_MIN = 40;   // Spieler, für die Bilder vorgehalten werden
// Commons rastet auf Standard-Stufen ein: ?width=100 liefert 120px (~8 KB), ?width=160
// schon 250px (~29 KB). 120px reicht für Avatare bis 64px (auch auf Retina) — gemessen.
const WIDTH = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyOf = (name, by) => `${norm(name)}|${by}`;

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } });
    if (res.status === 429) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return (await res.json()).results.bindings;
  }
  throw new Error("429 wiederholt");
}

// Spieler eines Teams mit Foto. sitelinks-Filter hält die Antwort klein.
async function fetchTeamImages(qid) {
  const q = `SELECT ?p ?pLabel ?by ?img WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl ; wdt:P18 ?img .
    BIND(YEAR(?d) AS ?by)
    FILTER(?sl >= ${SL_MIN})
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({
    qid: b.p.value.split("/").pop(),
    name: b.pLabel?.value,
    by: b.by?.value ? parseInt(b.by.value) : null,
    img: b.img?.value, // bereits eine Special:FilePath-URL
  }));
}

/* Direkte Thumbnail-URL auf dem Bild-CDN. Wikidata liefert P18 als Special:FilePath-Link,
   der über den MediaWiki-Applikationsserver läuft — der drosselt Massenabrufe hart (gemessen
   ~8 s/Datei). upload.wikimedia.org ist der CDN davor und liefert in ~80 ms. Der Pfad ergibt
   sich aus dem MD5 des Dateinamens (Unterstriche statt Leerzeichen). */
function thumbUrl(filePathUrl, width) {
  const raw = decodeURIComponent(filePathUrl.split("/").pop()).replace(/ /g, "_");
  const md5 = createHash("md5").update(raw).digest("hex");
  const enc = encodeURIComponent(raw);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/${width}px-${enc}`;
}

async function get(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status === 429) { await sleep(30000); continue; }
    return r;
  }
  return null;
}

// Erst das CDN-Thumbnail; schlägt das fehl (exotische Formate), Rückfall auf Special:FilePath.
async function download(filePathUrl, path) {
  let r = await get(thumbUrl(filePathUrl, WIDTH));
  if (!r || !r.ok) r = await get(`${filePathUrl}?width=${WIDTH}`);
  if (!r || !r.ok) throw new Error("HTTP " + (r ? r.status : "kein Ergebnis"));
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // 1) Gewünschte Schlüssel aus den echten Records. Mehrdeutige (gleicher Name + Jahrgang)
  //    fliegen raus — lieber Initialen-Fallback als das Foto des falschen Spielers.
  const count = new Map();
  for (const p of PLAYERS) {
    if ((p.sl || 0) < SL_MIN) continue;
    const k = keyOf(p.n, p.by);
    count.set(k, (count.get(k) || 0) + 1);
  }
  const wanted = new Set();
  let ambiguous = 0;
  for (const [k, c] of count) { if (c === 1) wanted.add(k); else ambiguous++; }
  console.log(`Records sl>=${SL_MIN}: ${count.size} Schlüssel, davon ${ambiguous} mehrdeutig (ausgeschlossen)`);

  // 2) Wikidata abfragen: Vereine + Nationalteams (dieselben Quellen wie der Roster)
  const found = new Map(); // qid -> {name, by, img}
  const teams = [...Object.entries(CLUB_QID), ...Object.entries(NAT_TEAM_QID)];
  for (const [key, qid] of teams) {
    try {
      const rows = await fetchTeamImages(qid);
      for (const r of rows) if (r.name && r.by && r.img) found.set(r.qid, r);
      console.log(`  ${key} (${qid}): ${rows.length} mit Foto`);
    } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); }
    await sleep(400);
  }
  console.log(`\nEindeutige Wikidata-Spieler mit Foto: ${found.size}`);

  // 3) Auf Records abbilden und die Arbeitsliste bilden.
  const index = {};
  const takenKey = new Set();
  const todo = [];
  let skip = 0, nomatch = 0;
  for (const [qid, r] of found) {
    const k = keyOf(r.name, r.by);
    if (!wanted.has(k)) { nomatch++; continue; }
    if (takenKey.has(k)) continue; // zwei QIDs auf denselben Record -> ersten behalten
    const ext = (r.img.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (ext === "svg") continue; // Vektorgrafik ist kein Porträt
    const file = `${qid}.${ext}`;
    takenKey.add(k);
    index[k] = file;
    if (existsSync(join(OUT, file))) { skip++; continue; }
    todo.push({ k, file, url: r.img, name: r.name });
  }
  console.log(`Zu laden: ${todo.length} (${skip} bereits vorhanden, ${nomatch} ohne Record-Treffer)`);

  /* Index immer aus dem tatsächlichen Dateibestand schreiben — dann ist auch ein
     abgebrochener Lauf konsistent, und die App zeigt für alles Übrige Initialen. */
  function writeIndex() {
    const have = {};
    for (const k of Object.keys(index).sort()) if (existsSync(join(OUT, index[k]))) have[k] = index[k];
    const body = Object.keys(have).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(have[k])},`).join("\n");
    writeFileSync(INDEX,
      `// GENERIERT von data-pipeline/wikidata_images.mjs — Wikidata P18 via Wikimedia Commons.\n` +
      `// Schlüssel: norm(name)|geburtsjahr. Nicht von Hand editieren.\n` +
      `export const PLAYER_IMAGES = {\n${body}\n};\n`);
    return Object.keys(have).length;
  }
  writeIndex(); // sofort, damit der Bestand auch bei Abbruch nutzbar ist

  /* Streng sequenziell mit 3 s Abstand. Wikimedia drosselt per Token-Bucket: Bursts
     (auch 1 Worker ohne Pause) liefern ~90 % HTTP 429, 3 s Abstand läuft sauber durch.
     Gemessen — nicht raten. Der Lauf ist idempotent und jederzeit fortsetzbar. */
  let dl = 0, fail = 0;
  for (const job of todo) {
    try {
      await download(job.url, join(OUT, job.file));
      if (++dl % 50 === 0) console.log(`  … ${dl}/${todo.length} geladen (Index: ${writeIndex()})`);
    } catch (e) {
      fail++; delete index[job.k]; // ohne Datei kein Index-Eintrag
      console.log(`  FEHLER ${job.name}: ${e.message}`);
    }
    await sleep(3000);
  }
  writeIndex();

  const files = readdirSync(OUT).length;
  console.log(`\nFertig: ${dl} geladen, ${skip} vorhanden, ${fail} Fehler, ${nomatch} ohne Record-Treffer.`);
  console.log(`public/players/: ${files} Dateien · Index: ${Object.keys(index).length} Einträge`);
}
main();
