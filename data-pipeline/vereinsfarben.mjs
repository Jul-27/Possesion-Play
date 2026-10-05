#!/usr/bin/env node
/*
 * vereinsfarben.mjs — liest die Hauptfarbe jedes Vereinswappens aus und schreibt
 * src/vereinsFarben.js. Kein Netz, keine Abhängigkeit.
 *   node data-pipeline/vereinsfarben.mjs
 *
 * WOZU: Der Karrieremodus tönt Kopf, Tabellenzeilen und Angebotskacheln in den
 * Farben des Vereins. Gepflegte Farben gibt es nur für die 47 Spielvereine
 * (CLUBS.c1); die übrigen 433 Vereine der Karriere-Welt bekamen bisher eine
 * Zufallsfarbe aus dem Schlüssel. Ihre Wappen liegen aber vor (475 von 480) — die
 * Farbe wird daraus ABGELESEN, nicht erfunden.
 *
 * REGEL: Gezählt werden deckende Pixel. Weiß, Schwarz und Grautöne zählen nicht als
 * Hauptfarbe; es gewinnt die häufigste kräftige Farbe. Hat ein Wappen kaum Farbe
 * (Juventus, Newcastle), wird es Anthrazit. Die gepflegten CLUBS-Farben haben
 * Vorrang.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { inflateSync } from "zlib";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGOS = join(HERE, "..", "public", "logos", "club");
const OUT = join(HERE, "..", "src", "vereinsFarben.js");

/* ── Ein kleiner PNG-Leser ───────────────────────────────────────────────────
   Genug für die Wappen: 8 Bit je Kanal, Graustufen, RGB, Palette (mit tRNS),
   Grau+Alpha, RGBA, ohne Zeilensprung. Alles andere liefert null. */
export function lesePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let p = 8, breite = 0, hoehe = 0, tiefe = 0, typ = 0, zeilensprung = 0;
  const daten = [];
  let palette = null, transparenz = null;
  while (p < buf.length) {
    const laenge = buf.readUInt32BE(p), art = buf.toString("ascii", p + 4, p + 8);
    const inhalt = buf.subarray(p + 8, p + 8 + laenge);
    if (art === "IHDR") {
      breite = inhalt.readUInt32BE(0); hoehe = inhalt.readUInt32BE(4);
      tiefe = inhalt[8]; typ = inhalt[9]; zeilensprung = inhalt[12];
    } else if (art === "PLTE") palette = inhalt;
    else if (art === "tRNS") transparenz = inhalt;
    else if (art === "IDAT") daten.push(inhalt);
    else if (art === "IEND") break;
    p += 12 + laenge;
  }
  const kanaele = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[typ];
  if (tiefe !== 8 || zeilensprung || !kanaele) return null;
  const roh = inflateSync(Buffer.concat(daten));
  const zeile = breite * kanaele;
  const px = Buffer.alloc(zeile * hoehe);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)];
    const quelle = y * (zeile + 1) + 1, ziel = y * zeile;
    for (let x = 0; x < zeile; x++) {
      const a = x >= kanaele ? px[ziel + x - kanaele] : 0;
      const b = y > 0 ? px[ziel - zeile + x] : 0;
      const c = x >= kanaele && y > 0 ? px[ziel - zeile + x - kanaele] : 0;
      let v = roh[quelle + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[ziel + x] = v & 255;
    }
  }
  /* Einheitlich als RGBA. */
  const rgba = (i) => {
    if (typ === 6) return [px[i * 4], px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3]];
    if (typ === 2) return [px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255];
    if (typ === 4) return [px[i * 2], px[i * 2], px[i * 2], px[i * 2 + 1]];
    if (typ === 0) return [px[i], px[i], px[i], 255];
    const k = px[i];
    return [palette[k * 3], palette[k * 3 + 1], palette[k * 3 + 2], transparenz && k < transparenz.length ? transparenz[k] : 255];
  };
  return { breite, hoehe, rgba };
}

const zuHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = max === min ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s, l };
};
export const ANTHRAZIT = "#2B2F33";
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/** Hauptfarbe eines Bildes: häufigste kräftige Farbe — oder null, wenn es farblos ist. */
export function hauptfarbe(bild) {
  const eimer = new Map();
  let deckend = 0, kraeftig = 0;
  for (let i = 0; i < bild.breite * bild.hoehe; i += 3) {
    const [r, g, b, a] = bild.rgba(i);
    if (a < 200) continue;
    deckend++;
    const { h, s, l } = zuHsl(r, g, b);
    if (s < 0.25 || l > 0.9 || l < 0.1) continue;
    /* Dunkleres Gold (Kronen, Kränze) zählt nur zu 60 Prozent; reines, helles Gelb
       wie bei Dortmund, Villarreal oder Leeds bleibt voll. Betis: Grün statt Krone. */
    const zierde = h >= 30 && h <= 50 && l < 0.55 ? 0.6 : 1;
    kraeftig++;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = eimer.get(k) || { n: 0, w: 0, r: 0, g: 0, b: 0 };
    /* Gewicht = Sättigung. Kronen, Kränze und Bänder sind oft Beige — weniger
       kräftig als die eigentliche Vereinsfarbe. Gemessen: Braga hat 18 % Beige und
       16 % Rot; nach Anzahl gewann die Zierde. Quadriert war es zu viel: Dann schlug
       das kleine, grelle Gold der Krone das große Blau von Real Sociedad. */
    e.n++; e.w += s * zierde; e.r += r; e.g += g; e.b += b;
    eimer.set(k, e);
  }
  /* Unter 6 Prozent Farbe ist das Wappen schwarz-weiß — eine Spur Gold oder Rot im
     Kranz soll dann nicht zur Vereinsfarbe werden. */
  if (!deckend || kraeftig / deckend < 0.06) return null;
  /* Benachbarte Eimer zusammenfassen: Ein Rot verteilt sich über Kantenglättung auf
     mehrere Nachbarn und verlöre sonst gegen eine kleine, aber glatte Fläche. */
  let best = null, bestN = 0;
  for (const [k, e] of eimer) {
    const r = k >> 8, g = (k >> 4) & 15, b = k & 15;
    let n = 0;
    for (const [k2, e2] of eimer) {
      if (Math.abs((k2 >> 8) - r) <= 1 && Math.abs(((k2 >> 4) & 15) - g) <= 1 && Math.abs((k2 & 15) - b) <= 1) n += e2.w;
    }
    if (n > bestN) { bestN = n; best = e; }
  }
  return hex(best.r / best.n, best.g / best.n, best.b / best.n);
}

async function main() {
  const { CLUBS } = await import("../src/gameData.js");
  const { WELT_VEREINE } = await import("../src/careerWorld.js");
  /* Gepflegt zählt nur, was zum Tönen taugt: Ajax, Sevilla und Valencia führen Weiß
     als erste Farbe — dann die zweite, und ist auch die farblos, das Wappen. */
  const farbig = (c) => { if (!c) return false; const h = c.length === 4 ? c.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : c;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const { s, l } = zuHsl(r, g, b); return s >= 0.25 && l > 0.1 && l < 0.9; };
  const lang = (c) => (c.length === 4 ? c.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : c).toUpperCase();
  /* Reihenfolge: gepflegte Erstfarbe, wenn kräftig — sonst das Wappen — und erst
     wenn das farblos ist, die gepflegte Zweitfarbe (Ajax: Wappen schwarz-weiß,
     Zweitfarbe Rot). Newcastles Zweitfarbe ist nur fürs gezeichnete Ersatzwappen da
     und käme sonst als Hellblau heraus. */
  const club = new Map(CLUBS.map((c) => [c.key, c]));
  const gepflegt = new Map(CLUBS.filter((c) => farbig(c.c1)).map((c) => [c.key, lang(c.c1)]));
  const keys = [...new Set([...WELT_VEREINE.map((v) => v.key), ...CLUBS.map((c) => c.key)])].sort();
  const farben = {};
  let ausWappen = 0, ohne = [];
  for (const key of keys) {
    if (gepflegt.has(key)) { farben[key] = gepflegt.get(key); continue; }
    const pfad = join(LOGOS, `${key}.png`);
    const bild = existsSync(pfad) ? lesePng(readFileSync(pfad)) : null;
    if (!bild) { ohne.push(key); continue; }
    const c = club.get(key);
    /* Beide gepflegten Farben farblos (Newcastle, Juventus): Der Verein IST
       schwarz-weiß — ein Blau aus dem Wappen gehört nicht in seine Tönung. */
    if (c && !farbig(c.c2)) { farben[key] = ANTHRAZIT; continue; }
    farben[key] = hauptfarbe(bild) || (c && farbig(c.c2) ? lang(c.c2) : ANTHRAZIT);
    ausWappen++;
  }
  const zeilen = Object.entries(farben).map(([k, f]) => `  ${JSON.stringify(k)}: "${f}",`);
  writeFileSync(OUT, `// GENERIERT von data-pipeline/vereinsfarben.mjs — nicht von Hand ändern.
/* Hauptfarbe je Verein: für die 47 Spielvereine die gepflegte (CLUBS.c1), sonst aus
   dem Wappen abgelesen. Vereine ohne lesbares Wappen fehlen — dort bleibt der
   Rückfall des Karrieremodus. */
export const VEREINS_FARBE = {
${zeilen.join("\n")}
};
`);
  console.log(`${Object.keys(farben).length} Vereine: ${gepflegt.size} gepflegt (farbig), ${ausWappen} aus dem Wappen, ${ohne.length} ohne (${ohne.join(", ")})`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
