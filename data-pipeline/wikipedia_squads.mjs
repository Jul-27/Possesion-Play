#!/usr/bin/env node
/*
 * wikipedia_squads.mjs — ergänzt die AKTUELLEN Kader aus der deutschen Wikipedia.
 *
 *   node data-pipeline/wikipedia_squads.mjs              # alle Vereine
 *   node data-pipeline/wikipedia_squads.mjs TSG S04      # nur diese
 *   node data-pipeline/wikipedia_squads.mjs --probe      # nichts schreiben, nur melden
 *
 * WARUM ES DAS BRAUCHT: Wikidata hinkt bei Transfers hinterher, und zwar sehr
 * ungleichmäßig. Gemessen am 04.08.2026 an Hoffenheim: von 31 Kaderspielern kannte
 * Wikidata bei 19 die Vereinszugehörigkeit überhaupt nicht — Fisnik Asllani und Leon
 * Avdullahu haben dort gar keinen einzigen Verein (P54 leer), Tim Lemperle nur Köln.
 * Bei den englischen und italienischen Vereinen ist die Abdeckung dagegen nahezu
 * vollständig. Unsere Roster-Pipeline ist der Quelle treu; die Quelle ist lückenhaft.
 *
 * WAS WOHER KOMMT — die Trennung ist der Kern des Entwurfs:
 *   Wikipedia liefert AUSSCHLIESSLICH die Behauptung „dieser Spieler gehört zum Kader"
 *   (plus das Jahr aus der Spalte „im Verein seit").
 *   Alle Personendaten — Name, Geburtsjahr, Nation, Position, Bekanntheit — kommen
 *   weiterhin aus Wikidata, aufgelöst über die QID des verlinkten Artikels. Es wird
 *   also nichts aus Fließtext geraten und nichts aus Namen erschlossen.
 *
 * Der Abgleich läuft über die Artikel-Verlinkung, nicht über Namensähnlichkeit:
 * Artikeltitel -> pageprops.wikibase_item -> QID. Damit gibt es keine Verwechslung
 * zwischen Fisnik und Kristjan Asllani.
 *
 * Additiv: vorhandene Vereine und Zeiträume werden nie überschrieben.
 */
import { readFileSync, writeFileSync } from "fs";
import { pathToFileURL } from "url";
import { CLUB_QID, NATION_QID, norm as rosterNorm, deriveLastName } from "./wikidata_roster.mjs";
import { posBucket, pickBucket } from "./wikidata_positions.mjs";
import { recToString } from "./add_clubs.mjs";
import { LABEL_LANGS, cleanName } from "./wikidata_label.mjs";
import { NAME_OVERRIDES, EXCLUDED_PLAYERS } from "./name_overrides.mjs";
import { stampFixes } from "./stamp.mjs";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const PLAYERS_PATH = new URL("../src/players.js", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GAME_BY_QID = Object.fromEntries(Object.entries(NATION_QID).map(([g, q]) => [q, g]));

/* Ein glaubhafter Profikader liegt zwischen diesen Grenzen. Reißt ein Verein sie,
   wurde mit hoher Wahrscheinlichkeit der falsche Abschnitt erwischt — dann lieber
   diesen Verein auslassen und melden, als 200 Jugendspieler einzutragen. */
export const KADER_MIN = 10;
export const KADER_MAX = 45;

/* Überschriften, die NICHT den Profikader bezeichnen — geprüft wird der Titel selbst
   UND die Kette seiner Über-Überschriften. Genau daran hängt die Auswahl: beim VfB
   heißt der Zweitmannschafts-Abschnitt schlicht „Kader in der Saison 2026/27" und ist
   nur an seiner Elternüberschrift „Zweite Mannschaft" zu erkennen. */
const KEIN_PROFIKADER = /zweite|2\.\s*mannschaft|frauen|damen|junior|jugend|nachwuchs|tradition|reserve|amateur|next gen|futuro|regionalliga|u\s?\d\d|meisterkader|125-jahre|kaderver|kaderpolitik/i;

/* Falls die Automatik bei einem Verein danebengreift: hier den exakten Abschnittstitel
   eintragen. Bewusst leer — am 04.08.2026 fand die Hierarchie-Auswahl bei 47 von 47
   Vereinen den richtigen Abschnitt. */
export const ABSCHNITT_OVERRIDES = {};

/** Wählt den Profikader-Abschnitt aus der Abschnittsliste der Wikipedia-API. */
export function waehleAbschnitt(sections, override) {
  if (override) return sections.find((s) => s.line === override) || null;
  const byNum = new Map(sections.map((s) => [s.number, s]));
  const ahnen = (s) => {
    const teile = String(s.number || "").split(".");
    const out = [];
    for (let i = 1; i < teile.length; i++) {
      const a = byNum.get(teile.slice(0, i).join("."));
      if (a) out.push(a.line);
    }
    return out;
  };
  return sections.find((s) =>
    /kader/i.test(s.line) && !KEIN_PROFIKADER.test(s.line) && !ahnen(s).some((a) => KEIN_PROFIKADER.test(a)),
  ) || null;
}

/** Saison-Startjahr aus einer Abschnittsüberschrift („Kader 2026/27" -> 2026). */
export function saisonAus(titel, jetzt = new Date().getFullYear()) {
  const m = String(titel || "").match(/\b(19|20)(\d{2})\b/);
  return m ? Number(m[0]) : jetzt;
}

/** Tabellenzeilen des Abschnitts: je Zeile die verlinkten Artikel und alle Jahreszahlen. */
export function parseZeilen(html) {
  return String(html).split(/<tr[\s>]/).slice(1).map((zeile) => {
    const titel = [...zeile.matchAll(/href="\/wiki\/([^"#:]+)"/g)]
      .map((m) => decodeURIComponent(m[1]).replace(/_/g, " "));
    const text = zeile.replace(/<[^>]+>/g, " ");
    const jahre = [...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => Number(m[0]));
    return { titel, jahre };
  }).filter((z) => z.titel.length);
}

/* „im Verein seit" aus den Jahreszahlen einer Zeile. Eine Zeile enthält typischerweise
   Geburtsjahr, Beitrittsjahr und Vertragsende (Neuer: 1986 · 2011 · 2027). Das
   Geburtsjahr kennen wir aus Wikidata und ziehen es ab; vom Rest ist das Beitrittsjahr
   das kleinste, das nach dem 14. Geburtstag und nicht in der Zukunft liegt.
   Ohne brauchbaren Kandidaten bleibt die Saison des Abschnitts. */
export function seitJahr(jahre, geburtsjahr, saison) {
  const kandidaten = jahre.filter((j) => j !== geburtsjahr && j >= geburtsjahr + 14 && j <= saison + 1);
  return kandidaten.length ? Math.min(...kandidaten) : saison;
}

/** Kader in die Spielerliste einarbeiten. Rein funktional, ohne Netz testbar. */
export function mergeKader(players, key, kader) {
  const idx = new Map(players.map((p) => [rosterNorm(p.n) + "|" + p.by, p]));
  const res = { neu: 0, vereinErgaenzt: 0, cpErgaenzt: 0, schonDa: 0 };
  for (const k of kader) {
    const cur = idx.get(rosterNorm(k.n) + "|" + k.by);
    if (cur) {
      const hatte = (cur.clubs || []).includes(key);
      if (!hatte) { cur.clubs = [...new Set([...(cur.clubs || []), key])].sort(); res.vereinErgaenzt++; }
      else res.schonDa++;
      // Vorhandene Zeiträume nie anfassen — Wikidata datiert genauer als eine Kadertabelle.
      if (!(cur.cp || []).some((c) => c[0] === key)) {
        cur.cp = [...(cur.cp || []), [key, k.seit, 0]].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
        res.cpErgaenzt++;
      }
      if (!(cur.nat || []).length && k.nat) cur.nat = [k.nat];
      if (!cur.pos && k.pos) cur.pos = k.pos;
      if (!cur.sl && k.sl) cur.sl = k.sl;
    } else {
      const rec = { n: k.n, ln: deriveLastName(k.n), by: k.by, nat: k.nat ? [k.nat] : [], clubs: [key], sl: k.sl || 0 };
      if (k.pos) rec.pos = k.pos;
      rec.cp = [[key, k.seit, 0]];
      players.push(rec);
      idx.set(rosterNorm(k.n) + "|" + k.by, rec);
      res.neu++;
    }
  }
  return res;
}

// ─────────────────────────── Netzwerk ───────────────────────────

async function hole(url, params) {
  const voll = url + "?format=json&" + new URLSearchParams(params);
  for (let a = 0; a < 5; a++) {
    let res;
    try { res = await fetch(voll, { headers: { "User-Agent": UA } }); }
    catch { await sleep(4000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(10000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  throw new Error("Abruf fehlgeschlagen (Retries erschöpft)");
}
const wp = (p) => hole("https://de.wikipedia.org/w/api.php", { origin: "*", ...p });
const wd = (p) => hole("https://www.wikidata.org/w/api.php", p);

const LANGS = LABEL_LANGS.split(",");

/* Kuratierte Namen gelten auch hier. Wikidatas Label ist teils verstümmelt oder
   vandaliert — „Calvin Ramsey" statt Ramsay, QIDs statt Namen. Ohne diesen Schritt
   legt der Lauf eine zweite Karteileiche neben dem korrigierten Datensatz an, und der
   Spieler taucht doppelt in der Autovervollständigung auf. Dieselbe Regel befolgt
   wikidata_images.mjs, aus demselben Grund. */
const KORREKTUR = new Map(NAME_OVERRIDES.map((o) => [rosterNorm(o.from) + "|" + o.by, o.to]));
const AUSGESCHLOSSEN = new Set();
for (const x of EXCLUDED_PLAYERS) for (const n of [x.n, ...(x.aliases || [])]) AUSGESCHLOSSEN.add(rosterNorm(n) + "|" + x.by);

export function korrigierterName(name, by) {
  return KORREKTUR.get(rosterNorm(name) + "|" + by) || name;
}
export function istAusgeschlossen(name, by, qid) {
  return AUSGESCHLOSSEN.has(rosterNorm(name) + "|" + by) || AUSGESCHLOSSEN.has(rosterNorm(qid || "") + "|" + by);
}

const bestesLabel = (labels) => {
  for (const l of LANGS) { const n = cleanName(labels?.[l]?.value); if (n) return n; }
  return null;
};

async function chunked(ids, fn, size = 45) {
  for (let i = 0; i < ids.length; i += size) await fn(ids.slice(i, i + size));
}

/** Artikeltitel -> QID, exakt über pageprops (keine Namenssuche). */
async function titelZuQid(titel) {
  const map = new Map();
  await chunked(titel, async (c) => {
    const r = await wp({ action: "query", prop: "pageprops", ppprop: "wikibase_item", titles: c.join("|") });
    for (const p of Object.values(r.query?.pages || {})) {
      if (p.pageprops?.wikibase_item) map.set(p.title, p.pageprops.wikibase_item);
    }
    // Weiterleitungen: Wikipedia liefert sie unter „normalized"/„redirects"
    for (const n of r.query?.normalized || []) { const q = map.get(n.to); if (q) map.set(n.from, q); }
    for (const n of r.query?.redirects || []) { const q = map.get(n.to); if (q) map.set(n.from, q); }
  });
  return map;
}

/** QID -> Personendaten aus Wikidata. Nicht-Fußballer und Datenlose fallen raus. */
async function spielerDaten(qids) {
  const out = new Map();
  await chunked(qids, async (c) => {
    const e = await wd({ action: "wbgetentities", ids: c.join("|"), props: "claims|labels|sitelinks", languages: LANGS.join("|") });
    for (const [id, ent] of Object.entries(e.entities || {})) {
      const cl = ent.claims || {};
      if (!(cl.P106 || []).some((x) => x.mainsnak?.datavalue?.value?.id === "Q937857")) continue;
      const by = cl.P569?.[0]?.mainsnak?.datavalue?.value?.time?.slice(1, 5);
      const roh = bestesLabel(ent.labels);
      if (!by || !roh) continue;
      if (istAusgeschlossen(roh, Number(by), id)) continue;
      const n = korrigierterName(roh, Number(by));
      const nat = (cl.P27 || []).map((x) => GAME_BY_QID[x.mainsnak?.datavalue?.value?.id]).find(Boolean) || null;
      const posQids = (cl.P413 || []).map((x) => x.mainsnak?.datavalue?.value?.id).filter(Boolean);
      out.set(id, { n, by: Number(by), sl: Object.keys(ent.sitelinks || {}).length, nat, posQids });
    }
  });
  return out;
}

/** Positions-QIDs -> Gruppe, über die englischen Labels (dieselbe Zuordnung wie sonst). */
async function positionen(qids) {
  const map = new Map();
  if (!qids.length) return map;
  await chunked([...new Set(qids)], async (c) => {
    const e = await wd({ action: "wbgetentities", ids: c.join("|"), props: "labels", languages: "en" });
    for (const [id, ent] of Object.entries(e.entities || {})) {
      const b = posBucket(ent.labels?.en?.value || "");
      if (b) map.set(id, b);
    }
  });
  return map;
}

async function main() {
  const argv = process.argv.slice(2);
  const probe = argv.includes("--probe");
  const nur = argv.filter((a) => !a.startsWith("--"));
  const keys = nur.length ? nur : Object.keys(CLUB_QID);
  const unbekannt = keys.filter((k) => !CLUB_QID[k]);
  if (unbekannt.length) { console.error(`Unbekannte Vereinsschlüssel: ${unbekannt.join(", ")}`); process.exit(2); }

  // Vereins-QID -> deutscher Wikipedia-Artikel
  const artikel = {};
  await chunked(keys, async (c) => {
    const e = await wd({ action: "wbgetentities", ids: c.map((k) => CLUB_QID[k]).join("|"), props: "sitelinks", sitefilter: "dewiki" });
    for (const k of c) { const t = e.entities?.[CLUB_QID[k]]?.sitelinks?.dewiki?.title; if (t) artikel[k] = t; }
  });

  const mod = await import(PLAYERS_PATH.href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])], cp: p.cp ? p.cp.map((c) => [...c]) : undefined }));
  const vorher = players.length;

  const summe = { neu: 0, vereinErgaenzt: 0, cpErgaenzt: 0, schonDa: 0 };
  const uebersprungen = [];
  console.log("Verein                        Kader  schon da  Verein neu  Spieler neu");

  for (const key of keys) {
    const seite = artikel[key];
    if (!seite) { uebersprungen.push(`${key}: kein deutscher Wikipedia-Artikel`); continue; }
    try {
      const sec = await wp({ action: "parse", page: seite, prop: "sections" });
      const abschnitt = waehleAbschnitt(sec.parse?.sections || [], ABSCHNITT_OVERRIDES[key]);
      if (!abschnitt) { uebersprungen.push(`${key} (${seite}): kein Profikader-Abschnitt gefunden`); continue; }

      const html = (await wp({ action: "parse", page: seite, section: abschnitt.index, prop: "text" })).parse?.text?.["*"] || "";
      const zeilen = parseZeilen(html);
      const qidVon = await titelZuQid([...new Set(zeilen.flatMap((z) => z.titel))]);
      const daten = await spielerDaten([...new Set([...qidVon.values()])]);
      const posMap = await positionen([...daten.values()].flatMap((d) => d.posQids));
      const saison = saisonAus(abschnitt.line);

      // Je Zeile den ersten verlinkten Fußballspieler nehmen — die übrigen Links einer
      // Kaderzeile sind Land, Verein oder Position.
      const kader = [];
      const gesehen = new Set();
      for (const z of zeilen) {
        for (const t of z.titel) {
          const q = qidVon.get(t);
          const d = q && daten.get(q);
          if (!d || gesehen.has(q)) continue;
          gesehen.add(q);
          kader.push({ ...d, pos: pickBucket(new Set(d.posQids.map((x) => posMap.get(x)).filter(Boolean))), seit: seitJahr(z.jahre, d.by, saison) });
          break;
        }
      }

      if (kader.length < KADER_MIN || kader.length > KADER_MAX) {
        uebersprungen.push(`${key} (${seite}, „${abschnitt.line}"): ${kader.length} Spieler — außerhalb ${KADER_MIN}–${KADER_MAX}, vermutlich falscher Abschnitt`);
        continue;
      }

      const r = probe ? { neu: 0, vereinErgaenzt: 0, cpErgaenzt: 0, schonDa: 0 } : mergeKader(players, key, kader);
      if (probe) {
        const idx = new Map(players.map((p) => [rosterNorm(p.n) + "|" + p.by, p]));
        for (const k of kader) {
          const cur = idx.get(rosterNorm(k.n) + "|" + k.by);
          if (!cur) r.neu++; else if ((cur.clubs || []).includes(key)) r.schonDa++; else r.vereinErgaenzt++;
        }
      }
      for (const f of Object.keys(summe)) summe[f] += r[f];
      console.log(`${key.padEnd(5)}${seite.slice(0, 24).padEnd(25)}${String(kader.length).padStart(5)}${String(r.schonDa).padStart(10)}${String(r.vereinErgaenzt).padStart(12)}${String(r.neu).padStart(13)}`);
    } catch (e) {
      uebersprungen.push(`${key} (${seite}): ${e.message}`);
    }
    await sleep(250);
  }

  console.log(`\nSumme: ${summe.schonDa} bereits vorhanden · ${summe.vereinErgaenzt} Vereine ergänzt · ${summe.neu} Spieler neu · ${summe.cpErgaenzt} Zeiträume`);
  if (uebersprungen.length) console.log(`\nÜbersprungen (${uebersprungen.length}):\n  ` + uebersprungen.join("\n  "));

  if (probe) { console.log("\n--probe: nichts geschrieben."); return; }
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampFixes(); // Vereinszugehörigkeit aus Wikipedia = kuratierte Korrektur, kein Wikidata-Abzug
  console.log(`\nFertig: ${vorher} -> ${players.length} Spieler in src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
