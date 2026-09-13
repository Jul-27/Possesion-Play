#!/usr/bin/env node
/*
 * finde_doppel.mjs — sucht Doppel-Datensätze, die ein Lauf angelegt hat, und belegt
 * jede Paarung an Wikidata. SCHREIBT NICHTS.
 *
 *   node data-pipeline/finde_doppel.mjs .stand-vor-lauf/players.js
 *
 * ── WOZU ────────────────────────────────────────────────────────────────────
 * Der Schlüssel eines Spielers ist norm(name)|geburtsjahr. Ändert Wikidata das
 * Label — durch eine echte Umbenennung („Álex Grimaldo" → „Alejandro Grimaldo")
 * oder durch Vandalismus („Gareth Bale" → „Gareth Bal") —, dann passt der Schlüssel
 * nicht mehr, und der nächste Lauf legt einen ZWEITEN Datensatz an. Der neue bekommt
 * die frischen Titel und Stationen, der alte behält die Vereine. Im Spiel stehen
 * danach zwei Personen, von denen keine vollständig ist.
 *
 * Gemessen am Lauf vom 12.09.2026: 107 neue Datensätze, darunter ein „Lionel Andrés
 * Messi" mit sieben Titeln neben einem „Lionel Messi" ohne einen einzigen.
 *
 * ── DER BELEG ───────────────────────────────────────────────────────────────
 * Vorgeschlagen wird eine Paarung nur, wenn EINE Wikidata-Entität beide Namen
 * trägt: den neuen als Label oder Alias, den alten ebenso — und ihr Geburtsjahr
 * zu unserem Datensatz passt. Damit kann die Tabelle keine zwei verschiedenen
 * Personen zusammenlegen, bloss weil ihre Nachnamen gleich klingen.
 */
import { pathToFileURL } from "url";
import { norm } from "../src/gameData.js";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; duplicate check)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const letztes = (s) => norm(s).split(/\s+/).filter(Boolean).pop();

/** Kandidatenpaare: neuer Datensatz + Bestandsdatensatz, der dieselbe Person sein kann. */
export function kandidaten(vorher, nachher) {
  const key = (p) => `${norm(p.n)}|${p.by}`;
  const alt = new Set(vorher.map(key));
  const neu = nachher.filter((p) => !alt.has(key(p)));
  const bestand = nachher.filter((p) => alt.has(key(p)));
  const paare = [];
  for (const n of neu) {
    for (const b of bestand) {
      const gleicherJahrgang = b.by === n.by;
      const gleicherNachname = letztes(b.n) === letztes(n.n);
      const gleicherName = norm(b.n) === norm(n.n);
      /* Zwei Muster: gleicher Jahrgang mit gleichem Nachnamen (Rufname vs Vollname),
         oder derselbe Name mit kaputtem Jahrgang (Wikidata-Datum verunglückt). */
      const kaputtesJahr = gleicherName && (!n.by || n.by < 1880);
      if ((gleicherJahrgang && gleicherNachname) || kaputtesJahr) paare.push({ neu: n, alt: b });
    }
  }
  return paare;
}

/** Alle Namen einer Entität: Labels und Aliase in allen Sprachen, plus dewiki-Titel. */
async function namenVonQid(qid) {
  const u = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const d = (await (await fetch(u, { headers: { "User-Agent": UA } })).json()).entities?.[qid];
  if (!d) return null;
  const namen = new Set();
  for (const l of Object.values(d.labels || {})) namen.add(norm(l.value));
  for (const liste of Object.values(d.aliases || {})) for (const a of liste) namen.add(norm(a.value));
  const dewiki = d.sitelinks?.dewiki?.title || null;
  if (dewiki) namen.add(norm(dewiki));
  const jahr = (d.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time || "").match(/(\d{4})/)?.[1];
  return { namen, dewiki, jahr: jahr ? Number(jahr) : null };
}

async function sucheQid(name) {
  const u = "https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=de&uselang=de"
    + "&type=item&limit=8&search=" + encodeURIComponent(name);
  const d = await (await fetch(u, { headers: { "User-Agent": UA } })).json();
  return (d.search || []).map((s) => s.id);
}

async function main() {
  const vorherPfad = process.argv[2] || ".stand-vor-lauf/players.js";
  const vorher = (await import(pathToFileURL(vorherPfad).href)).PLAYERS;
  const nachher = (await import(new URL("../src/players.js", import.meta.url).href + "?t=" + Date.now())).PLAYERS;

  const paare = kandidaten(vorher, nachher);
  console.log(`${paare.length} Kandidatenpaare — jedes wird an Wikidata geprüft\n`);

  const belegt = [], offen = [];
  for (const { neu, alt } of paare) {
    let gefunden = null;
    for (const qid of [...new Set([...(await sucheQid(alt.n)), ...(await sucheQid(neu.n))])].slice(0, 8)) {
      const e = await namenVonQid(qid);
      await sleep(120);
      if (!e) continue;
      /* Beide Namen an EINER Entität, und ihr Geburtsjahr passt zu unserem gültigen
         Datensatz — sonst ist es nicht dieselbe Person. */
      if (e.namen.has(norm(neu.n)) && e.namen.has(norm(alt.n)) && e.jahr === alt.by) { gefunden = { qid, ...e }; break; }
    }
    const zeile = `  { from: ${JSON.stringify(neu.n)}, by: ${neu.by}, to: ${JSON.stringify(alt.n)},`
      + ` src: ${JSON.stringify(gefunden?.qid || "")} },`;
    if (gefunden) { belegt.push(zeile + `  // ${gefunden.dewiki || ""}`); }
    else offen.push(`  ${neu.n} | ${neu.by}  <->  ${alt.n} | ${alt.by}   (kein gemeinsamer Beleg)`);
    await sleep(200);
  }

  console.log(`── belegt (${belegt.length}) — fertig für NAME_OVERRIDES ──`);
  console.log(belegt.join("\n"));
  console.log(`\n── unbelegt (${offen.length}) — von Hand ansehen, NICHT übernehmen ──`);
  console.log(offen.join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
