#!/usr/bin/env node
/*
 * flaggenfarben.mjs — liest die Farben einer Nationalflagge AUS DER FLAGGE und
 * schlägt daraus ein Trikot vor. Internet nötig, schreibt nichts.
 *
 *   node data-pipeline/flaggenfarben.mjs                # alle noch fehlenden Länder
 *   node data-pipeline/flaggenfarben.mjs AF CW TZ       # nur diese
 *
 * ── WARUM NICHT EINFACH DIE TRIKOTS NACHTRAGEN ──────────────────────────────
 * src/trikots.js führt Heimtrikots, und zwar nur die, die ich sicher weiss. Für
 * die verbleibenden 68 Länder — Amerikanisch-Samoa, Kiribati, Turks- und Caicos —
 * weiss ich sie nicht, und ein geratenes Trikot ist schlechter als ein neutrales.
 *
 * Die Flagge dagegen ist nachprüfbar: Sie hängt als Bild an der Wikidata-Entität
 * des Landes (P41). Dieses Skript holt sie, ZÄHLT die Pixel und nimmt die beiden
 * häufigsten Farben. Das ist kein Trikot-Wissen, sondern eine Messung — und
 * „Trikot in den Landesfarben" ist eine Aussage, die stimmt.
 *
 * ── WIE GEMESSEN WIRD ───────────────────────────────────────────────────────
 * Commons liefert auf Wunsch ein kleines PNG. Node kann zlib, und mehr braucht ein
 * PNG nicht: Kopf lesen, IDAT-Blöcke zusammenhängen, entpacken, Zeilenfilter
 * rückgängig machen. Danach steht jedes Pixel da und lässt sich zählen.
 *
 * Wappen, Schriftzüge und Sterne verfälschen die Zählung kaum, weil sie wenige
 * Pixel ausmachen — genau deshalb wird gezählt und nicht der SVG-Quelltext
 * durchsucht, wo ein Wappen aus hundert Pfaden mit hundert Füllfarben besteht.
 */
import { inflateSync } from "zlib";
import { pathToFileURL } from "url";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; flag colours)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── PNG entpacken ──────────────────────────────────────────────────────────── */
export function pngPixel(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("kein PNG");
  let i = 8, breite = 0, hoehe = 0, tiefe = 0, art = 0;
  const idat = [];
  let palette = null;
  while (i < buf.length) {
    const laenge = buf.readUInt32BE(i);
    const typ = buf.toString("ascii", i + 4, i + 8);
    const daten = buf.subarray(i + 8, i + 8 + laenge);
    if (typ === "IHDR") {
      breite = daten.readUInt32BE(0); hoehe = daten.readUInt32BE(4);
      tiefe = daten[8]; art = daten[9];
      /* Art 0 = Graustufen, 2 = RGB, 3 = Palette, 6 = RGBA. Commons liefert mal das
         eine, mal das andere — Argentinien kam als Palette, Schweden als Graustufen
         mit Palette. Wer nur RGB liest, verliert die halbe Welt. */
      if (![0, 2, 3, 6].includes(art)) throw new Error(`PNG-Farbart ${art} nicht gelesen`);
      if (art !== 3 && tiefe !== 8) throw new Error(`PNG-Tiefe ${tiefe} nicht gelesen`);
    } else if (typ === "PLTE") palette = Buffer.from(daten);
    else if (typ === "IDAT") idat.push(daten);
    else if (typ === "IEND") break;
    i += 12 + laenge;
  }
  if (art === 3 && !palette) throw new Error("Palette fehlt");
  const kanaele = art === 6 ? 4 : art === 0 ? 1 : art === 3 ? 1 : 3;
  const roh = inflateSync(Buffer.concat(idat));
  /* Bei Paletten unter acht Bit stecken mehrere Punkte in einem Byte. */
  const zeile = art === 3 ? Math.ceil((breite * tiefe) / 8) : breite * kanaele;
  const out = Buffer.alloc(hoehe * zeile);
  /* Die fünf Zeilenfilter des Formats rückgängig machen. Ohne sie ist das Bild
     Rauschen — jede Zeile ist relativ zur vorherigen kodiert. */
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)];
    const ein = roh.subarray(y * (zeile + 1) + 1, y * (zeile + 1) + 1 + zeile);
    const ziel = out.subarray(y * zeile, (y + 1) * zeile);
    for (let x = 0; x < zeile; x++) {
      const a = x >= kanaele ? ziel[x - kanaele] : 0;
      const b = y > 0 ? out[(y - 1) * zeile + x] : 0;
      const c = x >= kanaele && y > 0 ? out[(y - 1) * zeile + x - kanaele] : 0;
      let v = ein[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      ziel[x] = v & 0xff;
    }
  }
  if (art === 3) {
    /* Indizes gegen die Palette auflösen — danach sieht es aus wie jedes RGB-Bild. */
    const rgb = Buffer.alloc(breite * hoehe * 3);
    const proByte = 8 / tiefe, maske = (1 << tiefe) - 1;
    for (let y = 0; y < hoehe; y++) {
      for (let x = 0; x < breite; x++) {
        const byte = out[y * zeile + Math.floor(x / proByte)];
        const schub = 8 - tiefe * ((x % proByte) + 1);
        const idx = (byte >> schub) & maske;
        rgb.set(palette.subarray(idx * 3, idx * 3 + 3), (y * breite + x) * 3);
      }
    }
    return { breite, hoehe, kanaele: 3, pixel: rgb };
  }
  if (art === 0) {
    const rgb = Buffer.alloc(breite * hoehe * 3);
    for (let p = 0; p < breite * hoehe; p++) rgb.fill(out[p], p * 3, p * 3 + 3);
    return { breite, hoehe, kanaele: 3, pixel: rgb };
  }
  return { breite, hoehe, kanaele, pixel: out };
}

const hex = (r, g, b) => "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join("");

/** Die häufigsten Farben eines Bildes, grob gerastert und nach Anteil sortiert. */
export function dominanteFarben({ breite, hoehe, kanaele, pixel }) {
  const eimer = new Map();
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const p = (y * breite + x) * kanaele;
      if (kanaele === 4 && pixel[p + 3] < 200) continue;          // durchsichtige Ränder
      /* Auf 24 Stufen je Kanal runden: Farbverläufe und Kantenglättung sollen nicht
         als eigene Farben zählen. */
      const k = [pixel[p], pixel[p + 1], pixel[p + 2]].map((v) => Math.round(v / 24) * 24);
      const s = k.join(",");
      eimer.set(s, (eimer.get(s) || 0) + 1);
    }
  }
  const gesamt = [...eimer.values()].reduce((a, b) => a + b, 0);
  return [...eimer.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => {
      const [r, g, b] = s.split(",").map(Number);
      return { hex: hex(Math.min(r, 255), Math.min(g, 255), Math.min(b, 255)), anteil: n / gesamt };
    });
}

/* Dieselbe Rechnung wie in src/trikots.js — hier noch einmal, damit das Skript
   ohne den Browserteil läuft. */
const lin = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
export const helligkeit = (h) => {
  const n = (i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return 0.2126 * lin(n(0)) + 0.7152 * lin(n(1)) + 0.0722 * lin(n(2));
};
export const kontrast = (a, b) => {
  const [h, d] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
};

/** Aus den Flaggenfarben ein Trikot: kräftigste Fläche als Grund, zweite als Besatz. */
export function trikotAus(farben) {
  const grund = farben[0].hex;
  /* Der Besatz muss sich vom Grund abheben, sonst sieht man ihn nicht. */
  /* Mindestens sechs Prozent Fläche: Ein Stern oder ein Schriftzug soll nicht zum
     Besatz werden, bloss weil er zufällig die erste kontrastreiche Farbe ist. */
  const besatz = farben.slice(1).find((f) => f.anteil >= 0.06 && kontrast(grund, f.hex) >= 1.6)?.hex
    || (helligkeit(grund) > 0.4 ? "#141414" : "#FFFFFF");
  /* Die Schrift wird nicht aus der Flagge genommen, sondern nach Lesbarkeit
     gewählt: Schwarz oder Weiss, je nachdem, was auf dem Grund besser steht. */
  const schrift = kontrast(grund, "#FFFFFF") >= kontrast(grund, "#141414") ? "#FFFFFF" : "#141414";
  return { grund, besatz, schrift };
}

async function flaggeVon(iso) {
  const q = `SELECT ?f WHERE { ?l wdt:P297 "${iso}" ; wdt:P41 ?f } LIMIT 1`;
  const u = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q);
  const d = await (await fetch(u, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } })).json();
  const url = d.results.bindings[0]?.f?.value;
  if (!url) return null;
  const datei = decodeURIComponent(url.split("/").pop());
  /* Commons rendert SVG auf Wunsch als PNG — 96 Pixel breit reichen zum Zählen. */
  const png = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(datei)}?width=96`;
  const r = await fetch(png, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  return { datei, buf: Buffer.from(await r.arrayBuffer()) };
}

async function main() {
  const { alleLaender } = await import("../src/laender.js");
  const { gefuehrteLaender } = await import("../src/trikots.js");
  const gewuenscht = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const hat = new Set(gefuehrteLaender());
  const ziel = alleLaender().filter((l) => (gewuenscht.length ? gewuenscht.includes(l.key) : !hat.has(l.key)));

  console.log(`${ziel.length} Länder\n`);
  const zeilen = [], offen = [];
  for (const l of ziel) {
    const iso = l.key.length === 2 ? l.key : null;
    try {
      const f = iso && (await flaggeVon(iso));
      if (!f) { offen.push(`${l.key} ${l.name} — keine Flagge gefunden`); continue; }
      const farben = dominanteFarben(pngPixel(f.buf)).filter((x) => x.anteil >= 0.03);
      if (farben.length < 1) { offen.push(`${l.key} ${l.name} — keine Fläche messbar`); continue; }
      const t = trikotAus(farben);
      zeilen.push(`  ${(l.key + ":").padEnd(5)} ["${t.grund}", "${t.besatz}", "${t.schrift}"],`
        + `   // ${l.name}, aus ${f.datei} (${farben.slice(0, 3).map((x) => `${x.hex} ${(x.anteil * 100).toFixed(0)}%`).join(", ")})`);
    } catch (e) {
      offen.push(`${l.key} ${l.name} — ${e.message}`);
    }
    await sleep(350);
  }
  console.log(`── ${zeilen.length} Vorschläge ──`);
  console.log(zeilen.join("\n"));
  if (offen.length) { console.log(`\n── ${offen.length} offen ──`); console.log("  " + offen.join("\n  ")); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
