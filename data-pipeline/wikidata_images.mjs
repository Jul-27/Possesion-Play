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
import { NAME_OVERRIDES } from "./name_overrides.mjs";

/* Die kuratierten Namen gelten auch hier: Der Index ist über norm(name)|by verschlüsselt,
   und in Wikidata stehen bei einigen Spielern noch vandalierte oder fehlende englische
   Labels (z. B. Q294204 = "elpisha" statt Joaquín Sánchez). Ohne diese Abbildung würden
   die Schlüssel nicht zu den korrigierten Records in players.js passen. */
const NAME_BY_QID = new Map(NAME_OVERRIDES.map((o) => [o.src, o.to]));

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
  return (await sparql(q)).map((b) => {
    const qid = b.p.value.split("/").pop();
    return {
    qid,
    name: NAME_BY_QID.get(qid) || b.pLabel?.value,
    by: b.by?.value ? parseInt(b.by.value) : null,
    img: b.img?.value, // bereits eine Special:FilePath-URL
  };});
}

/* Direkte Thumbnail-URL auf dem Bild-CDN. Wikidata liefert P18 als Special:FilePath-Link,
   der über den MediaWiki-Applikationsserver läuft — der drosselt Massenabrufe hart (gemessen
   ~8 s/Datei). upload.wikimedia.org ist der CDN davor und liefert in ~80 ms. Der Pfad ergibt
   sich aus dem MD5 des Dateinamens (Unterstriche statt Leerzeichen). */
function commonsPath(filePathUrl) {
  const raw = decodeURIComponent(filePathUrl.split("/").pop()).replace(/ /g, "_");
  const md5 = createHash("md5").update(raw).digest("hex");
  return `${md5[0]}/${md5.slice(0, 2)}/${raw}`;
}

function thumbUrl(filePathUrl, width) {
  const p = commonsPath(filePathUrl);
  const i = p.lastIndexOf("/");
  const enc = encodeURIComponent(p.slice(i + 1));
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${p.slice(0, i)}/${enc}/${width}px-${enc}`;
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
    index[k] = { file, commons: commonsPath(r.img) };
    if (existsSync(join(OUT, file))) { skip++; continue; }
    todo.push({ k, file, url: r.img, name: r.name });
  }
  console.log(`Zu laden: ${todo.length} (${skip} bereits vorhanden, ${nomatch} ohne Record-Treffer)`);

  /* Zwei Karten: lokal vorhandene Dateien und der Rest als Commons-Pfad.
     Massen-Download scheitert an Wikimedias Limit (gemessen ~3,6 Dateien/min, für alle
     ~2.100 also ~9 h). Deshalb hybrid: was lokal liegt, wird lokal ausgeliefert; alles
     Übrige lädt der Browser des Spielers direkt von Commons — verteilte Einzelabrufe
     fallen nicht unter das Bulk-Limit. Der Index ist dadurch immer vollständig. */
  function writeIndex() {
    const local = {}, remote = {};
    for (const k of Object.keys(index).sort()) {
      const { file, commons } = index[k];
      if (existsSync(join(OUT, file))) local[k] = file;
      else remote[k] = commons;
    }
    const fmt = (o) => Object.keys(o).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(o[k])},`).join("\n");
    writeFileSync(INDEX,
      `// GENERIERT von data-pipeline/wikidata_images.mjs — Wikidata P18 via Wikimedia Commons.\n` +
      `// Schlüssel: norm(name)|geburtsjahr. Nicht von Hand editieren.\n\n` +
      `// Lokal unter public/players/ vorliegende Thumbnails.\n` +
      `export const PLAYER_IMG_LOCAL = {\n${fmt(local)}\n};\n\n` +
      `// Rest: Commons-Pfad "<md5[0]>/<md5[0..1]>/<Dateiname>" — die URL baut playerImage.js.\n` +
      `export const PLAYER_IMG_COMMONS = {\n${fmt(remote)}\n};\n`);
    return [Object.keys(local).length, Object.keys(remote).length];
  }

  /* Herunterladen nur auf ausdrücklichen Wunsch (IMAGES_DOWNLOAD=1), streng sequenziell
     mit 3 s Abstand. Ohne die Variable aktualisiert der Lauf nur den Index — das ist der
     schnelle Normalfall, weil fehlende Bilder ohnehin von Commons kommen. */
  let dl = 0, fail = 0;
  if (process.env.IMAGES_DOWNLOAD === "1") {
    for (const job of todo) {
      try {
        await download(job.url, join(OUT, job.file));
        if (++dl % 50 === 0) console.log(`  … ${dl}/${todo.length} geladen`);
      } catch (e) { fail++; console.log(`  FEHLER ${job.name}: ${e.message}`); }
      await sleep(3000);
    }
  } else {
    console.log("Kein Download (IMAGES_DOWNLOAD=1 setzt ihn in Gang) — fehlende Bilder kommen von Commons.");
  }
  const [nLocal, nRemote] = writeIndex();

  const files = readdirSync(OUT).length;
  console.log(`\nFertig: ${dl} geladen, ${fail} Fehler, ${nomatch} ohne Record-Treffer.`);
  console.log(`public/players/: ${files} Dateien · Index: ${nLocal} lokal + ${nRemote} von Commons = ${nLocal + nRemote}`);
}
main();
