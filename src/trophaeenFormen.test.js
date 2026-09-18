import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { TITEL_DATEN } from "./karriere.js";
import { GESTALTEN, MIT_BILD, METALL, koerper, kurve, henkel, BREITE, HOEHE, ACHSE }
  from "./trophaeenFormen.js";

/* Was diese Prüfungen abfangen sollen
   ═══════════════════════════════════════════════════════════════════════════
   Beim letzten Nachtragen von acht Meisterschaften und vier Ligen ist genau das
   passiert, was hier nicht mehr passieren soll: Eine Liste bekam den neuen
   Wettbewerb, die andere nicht, und die Titelfeier zeigte einen Henkelpokal für
   eine Meisterschaft. Ein fehlendes Bild sieht man erst, wenn man den Titel
   gewinnt — und das kann zwanzig Saisons dauern.

   `node --test` liest kein JSX. Die Profile stehen darum in trophaeenFormen.js;
   was zwingend in der .jsx steht — die fünf Sonderformen und die vier Einlagen —
   wird hier als Text gelesen und gegen die Flags gehalten. Das ist unschön, aber
   es ist der Unterschied zwischen „fällt beim Gewinnen auf" und „fällt beim
   Testlauf auf". */

const HIER = dirname(fileURLToPath(import.meta.url));

test("jeder Wettbewerb hat entweder ein Bild oder eine gezeichnete Gestalt", () => {
  const ohne = Object.keys(TITEL_DATEN).filter((k) => !MIT_BILD.has(k) && !(k in GESTALTEN));
  assert.deepEqual(ohne, [], `ohne Trophäe: ${ohne.join(" ")}`);
});

test("keine Gestalt für einen Titel, den es gar nicht gibt", () => {
  const fremd = [...Object.keys(GESTALTEN), ...MIT_BILD].filter((k) => !(k in TITEL_DATEN));
  assert.deepEqual(fremd, [], `unbekannter Titel: ${fremd.join(" ")}`);
});

test("kein Wettbewerb trägt Bild und Zeichnung zugleich", () => {
  const doppelt = [...MIT_BILD].filter((k) => k in GESTALTEN);
  assert.deepEqual(doppelt, []);
});

test("die vier freigestellten Bilder liegen auch wirklich da", () => {
  for (const k of MIT_BILD) {
    const pfad = join(HIER, "..", "public", "bilder", "trophaee", "titel", `${k}.png`);
    assert.ok(existsSync(pfad), `${k}.png fehlt`);
  }
});

test("jede Gestalt hat einen Körper — ein Profil oder eine eigene Form", () => {
  for (const [k, g] of Object.entries(GESTALTEN)) {
    assert.ok(g.profil || g.eigen, `${k} hat weder Profil noch eigene Form`);
  }
});

test("jedes Profil läuft von oben nach unten und bleibt auf der Leinwand", () => {
  for (const [k, g] of Object.entries(GESTALTEN)) {
    if (!g.profil) continue;
    let vorher = -1;
    for (const [y, b] of g.profil) {
      assert.ok(y > vorher || y === vorher, `${k}: Profil springt bei y=${y} zurück`);
      assert.ok(y >= 0 && y <= HOEHE, `${k}: y=${y} liegt ausserhalb`);
      assert.ok(b > 0 && ACHSE + b <= BREITE, `${k}: Halbbreite ${b} passt nicht`);
      vorher = y;
    }
  }
});

test("jede Trophäe steht auf dem Boden und füllt die Leinwand", () => {
  for (const [k, g] of Object.entries(GESTALTEN)) {
    if (!g.profil) continue;
    const oben = g.profil[0][0], unten = g.profil[g.profil.length - 1][0];
    assert.ok(unten >= 270, `${k} schwebt: endet bei y=${unten}`);
    /* Ein Deckel darf den oberen Teil übernehmen; ohne Deckel muss der Körper
       selbst weit genug hinaufreichen, sonst steht eine Briefmarke im Feld. */
    if (!g.deckel) assert.ok(oben <= 130, `${k} beginnt erst bei y=${oben}`);
  }
});

test("keine zwei Wettbewerbe tragen dieselbe Silhouette", () => {
  const gesehen = new Map();
  for (const [k, g] of Object.entries(GESTALTEN)) {
    if (!g.profil) continue;
    const d = koerper(g.profil);
    assert.ok(!gesehen.has(d), `${k} sieht aus wie ${gesehen.get(d)}`);
    gesehen.set(d, k);
  }
});

test("koerper liefert einen geschlossenen Pfad ohne NaN", () => {
  for (const [k, g] of Object.entries(GESTALTEN)) {
    if (!g.profil) continue;
    const d = koerper(g.profil);
    assert.ok(d.startsWith("M"), `${k}: Pfad beginnt nicht mit M`);
    assert.ok(d.endsWith("Z"), `${k}: Pfad ist nicht geschlossen`);
    assert.ok(!/NaN|undefined|Infinity/.test(d), `${k}: ${d.slice(0, 80)}`);
    assert.match(d, /^[MLCZ0-9 .,-]+$/, `${k}: unerwarteter Befehl im Pfad`);
  }
});

test("koerper spiegelt sauber an der Mittelachse", () => {
  const d = koerper([[10, 20, true], [90, 40, true]]);
  assert.equal(d, "M120 10L140 90L60 90L80 10Z");
});

test("ein harter Punkt bekommt eine Gerade, ein weicher einen Bogen", () => {
  assert.equal(kurve([[0, 0], [10, 10, true]]), "M0 0L10 10");
  assert.match(kurve([[0, 0], [10, 10], [20, 0]]), /^M0 0C/);
});

test("jeder Henkel setzt am Körper an, nicht daneben", () => {
  /* Der Henkel startet bei [Achse ± Halbbreite]; steht er woanders, klebt er in
     der Luft. Der Ansatz steckt als erste Zahl im Pfad. */
  for (const [k, g] of Object.entries(GESTALTEN)) {
    if (!g.griff || !g.profil) continue;
    const [rechts, links, staerke] = g.griff;
    const xr = Number(rechts.match(/^M(-?[\d.]+)/)[1]);
    const xl = Number(links.match(/^M(-?[\d.]+)/)[1]);
    assert.equal(xr + xl, 2 * ACHSE, `${k}: Henkel sind nicht spiegelbildlich`);
    const y = Number(rechts.match(/^M[\d.-]+ ([\d.-]+)/)[1]);
    /* Die Halbbreite des Körpers auf dieser Höhe, grob genähert über den
       nächstgelegenen Profilpunkt. */
    const nah = g.profil.reduce((a, p) => Math.abs(p[0] - y) < Math.abs(a[0] - y) ? p : a);
    assert.ok(Math.abs((xr - ACHSE) - nah[1]) <= 36,
      `${k}: Henkel setzt bei ${xr - ACHSE} an, der Körper ist dort ${nah[1]} breit`);
    assert.ok(staerke >= 5 && staerke <= 14, `${k}: Henkelstärke ${staerke}`);
  }
});

test("die Henkelvorlagen hängen an der übergebenen Höhe", () => {
  for (const bauen of Object.values(henkel)) {
    const [rechts] = bauen(100, 50);
    assert.match(rechts, /^M150 1[03]\d/);
  }
});

test("beide Metalle gehen von hell nach dunkel", () => {
  for (const [name, stufen] of Object.entries(METALL)) {
    assert.equal(stufen.length, 3, name);
    const helligkeit = stufen.map((f) => parseInt(f.slice(1, 3), 16) + parseInt(f.slice(3, 5), 16) + parseInt(f.slice(5, 7), 16));
    assert.ok(helligkeit[0] > helligkeit[1] && helligkeit[1] > helligkeit[2],
      `${name}: ${stufen.join(" ")} läuft nicht von hell nach dunkel`);
  }
});

/* ── Die Anzeigeseite, als Text gelesen ───────────────────────────────────── */

const JSX = readFileSync(join(HIER, "TrophaeenFormen.jsx"), "utf8");

/** Die Schlüssel eines `const NAME = { … }` im Quelltext. */
function schluessel(name) {
  const block = JSX.split(`const ${name} = {`)[1];
  assert.ok(block, `${name} steht nicht in TrophaeenFormen.jsx`);
  return [...block.split("\n};")[0].matchAll(/^ {2}([A-Z][A-Z0-9]*):/gm)].map((m) => m[1]);
}

test("zu jeder angekündigten Sonderform ist auch eine gezeichnet", () => {
  const erwartet = Object.entries(GESTALTEN).filter(([, g]) => g.eigen).map(([k]) => k).sort();
  assert.deepEqual(schluessel("EIGEN").sort(), erwartet);
});

test("zu jeder angekündigten Einlage ist auch eine gezeichnet", () => {
  const erwartet = Object.entries(GESTALTEN).filter(([, g]) => g.zier).map(([k]) => k).sort();
  assert.deepEqual(schluessel("ZIER").sort(), erwartet);
});

test("zu jedem zweiten Metall ist auch etwas gezeichnet", () => {
  const erwartet = Object.entries(GESTALTEN).filter(([, g]) => g.ueber).map(([k]) => k).sort();
  assert.deepEqual(schluessel("UEBER").sort(), erwartet);
});
