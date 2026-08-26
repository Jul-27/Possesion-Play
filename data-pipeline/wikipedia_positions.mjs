#!/usr/bin/env node
/*
 * wikipedia_positions.mjs — setzt das Feld `pp` (genaue Positionen) je Spieler in
 * src/players.js, gelesen aus dem Infobox-Feld „Position" der deutschen Wikipedia.
 *
 *   node data-pipeline/wikipedia_positions.mjs                # alle Spieler
 *   node data-pipeline/wikipedia_positions.mjs --probe 2000   # Stichprobe, schreibt nichts
 *   node data-pipeline/wikipedia_positions.mjs --ab-sl 40     # nur ab dieser Bekanntheit
 *
 * WARUM NICHT WIKIDATA: P413 kennt die genauen Positionen fast nicht. Gemessen an
 * allen 27.482 Spielern unserer Vereine tragen dort 82,4 % nur eine der vier groben
 * Gruppen, 11 % eine feine, 3,7 % überhaupt mehr als eine Angabe. Die deutsche
 * Wikipedia liefert bei den ratbaren Spielern (sl ≥ 40) zu 93 % ein Positionsfeld
 * und bei den bekanntesten zu 28 % mehrere Positionen.
 *
 * ADDITIV: `pos` (die grobe Gruppe) bleibt unangetastet. `pp` kommt daneben. Spieler
 * ohne deutschen Artikel — bei sl < 20 über drei Viertel — verlieren dadurch nichts.
 *
 * ZUORDNUNG ARTIKEL -> SPIELER über den Namen, gegengeprüft am GEBURTSJAHR. Es gibt
 * zwei Hannes Wolf; ohne diese Prüfung bekäme der eine die Position des anderen.
 * Stimmt das Jahr nicht, wird der Spieler übersprungen und gezählt — hier wird nicht
 * über eine Namenssuche geraten, wie es wikipedia_career.mjs für Einzelabfragen tut.
 */
import { readFileSync, writeFileSync } from "fs";
import { pathToFileURL } from "url";
import { recToString } from "./player_record.mjs";
import { positionsFeld, positionenAusFeld } from "./position_parse.mjs";
import { geburtsjahr } from "./wikipedia_career.mjs";
import { POSITIONEN } from "../src/positions.js";
import { stampFixes } from "./stamp.mjs";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; position enrichment)";
const PLAYERS_PATH = new URL("../src/players.js", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STAPEL = 20;          // Titel je Abruf — das Limit der Wikipedia-API für Nutzer ohne Bot-Recht

async function wp(params) {
  const url = "https://de.wikipedia.org/w/api.php?format=json&formatversion=2&"
    + new URLSearchParams(params);
  for (let a = 0; a < 5; a++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA } }); }
    catch { await sleep(4000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    try { return await res.json(); } catch { await sleep(4000); }
  }
  throw new Error("Abruf fehlgeschlagen (Retries erschöpft)");
}

/* Angefragter Name -> Artikeltext. Die API normalisiert Titel und folgt
   Weiterleitungen, gibt die Seiten aber unter dem ZIELtitel zurück; über die Ketten
   in `normalized` und `redirects` findet man zurück zum angefragten Namen. */
async function holeStapel(namen) {
  const r = await wp({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main",
    redirects: 1, titles: namen.join("|") });
  const textVonTitel = new Map();
  for (const s of r.query?.pages || []) {
    const txt = s.revisions?.[0]?.slots?.main?.content;
    if (txt) textVonTitel.set(s.title, txt);
  }
  const kette = [...(r.query?.redirects || []), ...(r.query?.normalized || [])];
  const out = new Map();
  for (const n of namen) {
    let titel = n;
    for (let i = 0; i < 4 && !textVonTitel.has(titel); i++) {
      const w = kette.find((k) => k.from === titel);
      if (!w) break;
      titel = w.to;
    }
    if (textVonTitel.has(titel)) out.set(n, textVonTitel.get(titel));
  }
  return out;
}

/* Häufige Namen führen nicht zum Spieler, sondern zu einer BEGRIFFSKLÄRUNGSSEITE:
   „Bruno Fernandes", „Ben Davies", „Carlos Sánchez". Die Geburtsjahrprüfung fängt das
   richtig ab — sie verhindert, dass ein Politiker die Position eines Stürmers
   bekommt. Ohne zweiten Anlauf verlöre der Lauf aber rund 9 % des Rätselpools.

   Die Seite nennt die richtige Variante selbst, samt Jahr:
     * [[Bruno Fernandes (Fußballspieler, 1994)]] (* 1994), portugiesischer Fußballspieler
   Gesucht wird die Zeile mit UNSEREM Geburtsjahr, die auch nach Fußball klingt. Gibt
   es mehr als eine, wird keine genommen — dann ist der Fall echt mehrdeutig. */
export function bkAufloesen(text, by) {
  if (!/\{\{Begriffskl(ä|ae)rung|<onlyinclude>/i.test(String(text || ""))) return null;
  const treffer = [];
  for (const zeile of String(text).split("\n")) {
    if (!/^\s*\*/.test(zeile)) continue;
    if (!/fu(ß|ss)ball/i.test(zeile)) continue;
    if (!new RegExp(`\\(\\s*\\*?\\s*${by}\\b|\\b${by}\\s*[–-]`).test(zeile)) continue;
    const link = zeile.match(/\[\[([^\]|]+)/);
    if (link) treffer.push(link[1].trim());
  }
  const eindeutig = [...new Set(treffer)];
  return eindeutig.length === 1 ? eindeutig[0] : null;
}

export function auswerten(text, by) {
  if (!text) return { grund: "kein Artikel" };
  const jahr = geburtsjahr(text);
  if (jahr !== by) return { grund: jahr ? "Geburtsjahr passt nicht" : "kein Geburtsjahr im Artikel" };
  const feld = positionsFeld(text);
  if (feld == null) return { grund: "kein Positionsfeld" };
  const { pp, grob, unbekannt } = positionenAusFeld(feld);
  if (!pp.length) return { grund: grob ? "nur grobe Gruppe" : "nichts Verwertbares", unbekannt, feld };
  return { pp, unbekannt, feld };
}

async function main() {
  const argv = process.argv.slice(2);
  const probeIdx = argv.indexOf("--probe");
  const probe = probeIdx >= 0 ? Number(argv[probeIdx + 1]) || 500 : 0;
  const slIdx = argv.indexOf("--ab-sl");
  const abSl = slIdx >= 0 ? Number(argv[slIdx + 1]) || 0 : 0;

  const mod = await import(PLAYERS_PATH.href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p }));

  let ziele = players.filter((p) => (p.sl || 0) >= abSl);
  if (probe) {
    // gleichmäßig über den ganzen Bestand, nicht die ersten N — sonst nur „A"
    const schritt = Math.max(1, Math.floor(ziele.length / probe));
    ziele = ziele.filter((_, i) => i % schritt === 0).slice(0, probe);
  }

  const gruende = new Map();
  const unbekannt = new Map();
  const verteilung = new Map();
  let gesetzt = 0, mehrfach = 0;

  console.log(`${ziele.length} Spieler${probe ? " (Stichprobe)" : ""}${abSl ? `, ab sl ${abSl}` : ""}`);
  for (let i = 0; i < ziele.length; i += STAPEL) {
    const teil = ziele.slice(i, i + STAPEL);
    let texte;
    try { texte = await holeStapel(teil.map((p) => p.n)); }
    catch (e) { console.error(`\nStapel ab ${i} fehlgeschlagen: ${e.message}`); continue; }

    /* Zweiter Anlauf für Begriffsklärungsseiten, gesammelt statt einzeln — ein
       Stapel mehr statt eines Abrufs je Fall. */
    const nachschlag = new Map();
    const offen = [];
    for (const p of teil) {
      const ziel = bkAufloesen(texte.get(p.n), p.by);
      if (ziel) offen.push([p.n, ziel]);
    }
    if (offen.length) {
      try {
        const zweite = await holeStapel(offen.map(([, ziel]) => ziel));
        for (const [name, ziel] of offen) if (zweite.has(ziel)) nachschlag.set(name, zweite.get(ziel));
      } catch { /* der erste Anlauf zählt weiter */ }
    }

    for (const p of teil) {
      const e = auswerten(nachschlag.get(p.n) ?? texte.get(p.n), p.by);
      for (const u of e.unbekannt || []) unbekannt.set(u, (unbekannt.get(u) || 0) + 1);
      if (!e.pp) { gruende.set(e.grund, (gruende.get(e.grund) || 0) + 1); continue; }
      p.pp = e.pp;
      gesetzt++;
      if (e.pp.length > 1) mehrfach++;
      for (const k of e.pp) verteilung.set(k, (verteilung.get(k) || 0) + 1);
    }
    if ((i / STAPEL) % 25 === 0) process.stdout.write(`\r  ${Math.min(i + STAPEL, ziele.length)}/${ziele.length}`);
    await sleep(120);
  }
  console.log(`\r  ${ziele.length}/${ziele.length}\n`);

  const anteil = (n) => `${String(n).padStart(6)}  ${(n / ziele.length * 100).toFixed(1).padStart(5)} %`;
  console.log(`mit genauer Position: ${anteil(gesetzt)}`);
  console.log(`davon mehrere:        ${anteil(mehrfach)}`);
  console.log("\nohne genaue Position:");
  for (const [g, n] of [...gruende.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${g.padEnd(26)}${anteil(n)}`);

  console.log("\nVerteilung:");
  for (const pos of POSITIONEN) {
    const n = verteilung.get(pos.key) || 0;
    console.log(`  ${pos.key.padEnd(4)}${pos.name.padEnd(26)}${String(n).padStart(6)}`);
  }

  /* Unverständliche Textstücke sind der Wegweiser fürs Vokabular: was oft vorkommt,
     gehört als Regel nach position_parse.mjs. Einzelfälle sind meist Tippfehler. */
  const haeufig = [...unbekannt.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  if (haeufig.length) {
    console.log(`\nNicht zugeordnet (ab 3×) — Kandidaten fürs Vokabular:`);
    for (const [t, n] of haeufig.slice(0, 40)) console.log(`  ${String(n).padStart(5)}  ${t.slice(0, 60)}`);
  }
  const einzeln = [...unbekannt.entries()].filter(([, n]) => n < 3).length;
  if (einzeln) console.log(`  (dazu ${einzeln} Einzelfälle, meist Tipp- oder Formatfehler)`);

  if (probe) { console.log("\n--probe: nichts geschrieben."); return; }
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampFixes();
  console.log(`\nGeschrieben: src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
