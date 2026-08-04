#!/usr/bin/env node
/*
 * audit_clubs.mjs — Diagnose, kein Schreibzugriff. Meldet Spieler, bei denen wir
 * einen Spielverein führen, den Wikidata heute nicht (mehr) kennt.
 *
 *   node data-pipeline/audit_clubs.mjs [--min-sl 40] [--limit 500]
 *
 * WICHTIG bei der Auswertung: ein Treffer ist ein VERDACHT, kein Befund. Die
 * Gegenrichtung ist genauso häufig — Wikidata löscht laufend echte Vereinszeiten
 * (De Bruynes Chelsea- und City-Jahre waren zeitweise weg). Ein gemeldeter Spieler
 * kann also ebenso gut korrekt bei uns und kaputt in Wikidata sein. Deshalb wandert
 * von hier nichts automatisch nach WRONG_CLUBS, sondern nur nach Sichtung.
 *
 * Spieler, für die Wikidata GAR KEINEN unserer Vereine führt, werden deshalb erst gar
 * nicht gemeldet. Genau daran ist die erste Fassung dieses Gedankens gescheitert:
 * Merlin Röhls Wikidata-Eintrag ist leer, woraufhin sein Everton fälschlich als
 * Falscheintrag galt — er spielt dort tatsächlich. Ein schweigender Eintrag
 * widerlegt nichts.
 */
import { pathToFileURL } from "url";
import { CLUB_QID, norm } from "./wikidata_roster.mjs";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const CANDS = 3;
const CHUNK = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY_BY_QID = Object.fromEntries(Object.entries(CLUB_QID).map(([k, q]) => [q, k]));

async function api(params) {
  const url = "https://www.wikidata.org/w/api.php?format=json&" + new URLSearchParams(params);
  for (let a = 0; a < 5; a++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA } }); } catch { await sleep(3000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(10000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  throw new Error("API fehlgeschlagen");
}

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let a = 0; a < 5; a++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } }); }
    catch { await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(15000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch { await sleep(5000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen");
}

// QID -> { by, clubs: Set(Spielvereins-Keys) } für die Kandidaten
async function fetchClubs(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += CHUNK) {
    const chunk = qids.slice(i, i + CHUNK);
    const rows = await sparql(`SELECT ?p ?by ?c WHERE {
      VALUES ?p { ${chunk.map((q) => "wd:" + q).join(" ")} }
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d .
      OPTIONAL { ?p wdt:P54 ?c }
      BIND(YEAR(?d) AS ?by)
    }`);
    for (const b of rows) {
      const qid = b.p.value.split("/").pop();
      let e = out.get(qid);
      if (!e) { e = { by: b.by?.value ? parseInt(b.by.value) : null, clubs: new Set() }; out.set(qid, e); }
      const key = KEY_BY_QID[b.c?.value?.split("/").pop()];
      if (key) e.clubs.add(key);
    }
    console.log(`  Vereine ${Math.min(i + CHUNK, qids.length)}/${qids.length} …`);
    await sleep(1200);
  }
  return out;
}

async function main() {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d; };
  const MIN_SL = arg("min-sl", 40);
  const LIMIT = arg("limit", Infinity);

  const { PLAYERS } = await import(new URL("../src/players.js", import.meta.url).href + "?t=" + Date.now());
  const ziel = PLAYERS.filter((p) => (p.sl || 0) >= MIN_SL && (p.clubs || []).length).slice(0, LIMIT);
  console.log(`Prüfe ${ziel.length} Spieler (sl >= ${MIN_SL}, mind. ein Spielverein)\n`);

  const cands = new Map();
  const alle = new Set();
  for (let i = 0; i < ziel.length; i++) {
    const p = ziel[i];
    try {
      const s = await api({ action: "wbsearchentities", search: p.n, language: "de", uselang: "de", type: "item", limit: CANDS });
      const ids = (s.search || []).map((x) => x.id);
      if (ids.length) { cands.set(norm(p.n) + "|" + p.by, ids); ids.forEach((id) => alle.add(id)); }
    } catch { /* einzelne Suche darf scheitern */ }
    if ((i + 1) % 250 === 0) console.log(`  Suche ${i + 1}/${ziel.length} …`);
    await sleep(110);
  }
  const clubsByQid = await fetchClubs([...alle]);

  let geprueft = 0, sauber = 0, nichtAufloesbar = 0, ohneVereinInWikidata = 0;
  const verdacht = [];
  for (const p of ziel) {
    const ids = cands.get(norm(p.n) + "|" + p.by) || [];
    const hit = ids.map((id) => clubsByQid.get(id)).find((e) => e && e.by === p.by);
    if (!hit) { nichtAufloesbar++; continue; }
    /* Führt Wikidata für den Spieler keinen einzigen unserer Vereine, ist der Eintrag
       dort unvollständig — daraus folgt nichts über unsere Daten. Vergleichbar wird es
       erst, wenn beide Seiten etwas zu sagen haben. */
    if (!hit.clubs.size) { ohneVereinInWikidata++; continue; }
    geprueft++;
    const fehlen = (p.clubs || []).filter((c) => !hit.clubs.has(c));
    if (!fehlen.length) { sauber++; continue; }
    verdacht.push({ p, fehlen, wikidata: [...hit.clubs] });
  }

  verdacht.sort((a, b) => (b.p.sl || 0) - (a.p.sl || 0));
  console.log(`\n───────── Ergebnis ─────────`);
  console.log(`  geprüft (QID + Geburtsjahr eindeutig): ${geprueft}`);
  console.log(`  deckungsgleich mit Wikidata:          ${sauber}`);
  console.log(`  mit Verein, den Wikidata nicht führt: ${verdacht.length}`);
  console.log(`  nicht auflösbar (Name/Jahr):          ${nichtAufloesbar}`);
  console.log(`  Wikidata führt keinen unserer Vereine (nicht vergleichbar): ${ohneVereinInWikidata}`);

  console.log(`\nDie 30 bekanntesten Verdachtsfälle:`);
  for (const v of verdacht.slice(0, 30)) {
    console.log(`  ${v.p.n} (${v.p.by}, sl ${v.p.sl}): wir ${JSON.stringify(v.p.clubs)} · Wikidata ${JSON.stringify(v.wikidata)} · fehlt ${JSON.stringify(v.fehlen)}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
