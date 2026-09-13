import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { vereinigeListe, vereinigeDatiert } from "./keine_station_verlieren.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

test("eine verschwundene Station kommt zurück", () => {
  const { wert, fehlt } = vereinigeListe(["BVB", "CHE", "MCI"], ["BVB", "MCI"]);
  assert.deepEqual(fehlt, ["CHE"]);
  assert.deepEqual(wert, ["BVB", "CHE", "MCI"]);
});

test("neue Stationen bleiben erhalten und es entstehen keine Doppel", () => {
  const { wert, fehlt } = vereinigeListe(["BVB"], ["BVB", "NEW"]);
  assert.deepEqual(fehlt, []);
  assert.deepEqual(wert, ["BVB", "NEW"]);
});

test("ohne Verlust wird die neue Liste unverändert durchgereicht", () => {
  const neu = ["BVB", "MCI"];
  assert.equal(vereinigeListe(["BVB"], neu).wert, neu);
});

/* Der Fall, an dem eine naive Vereinigung scheitert: dieselbe Station mit
   aktualisiertem Endjahr. Über das ganze Tripel verglichen stünde der Verein
   zweimal da — einmal laufend, einmal beendet. */
test("aktualisierte Jahre erzeugen keinen zweiten Eintrag desselben Vereins", () => {
  const { wert, fehlt } = vereinigeDatiert([["HSV", 2022, 0]], [["HSV", 2022, 2026]]);
  assert.deepEqual(fehlt, []);
  assert.deepEqual(wert, [["HSV", 2022, 2026]]);
});

test("ein ganz fehlender Verein kommt mit seinen alten Jahren zurück", () => {
  const { wert, fehlt } = vereinigeDatiert([["CHE", 2013, 2014], ["MCI", 2015, 2022]], [["MCI", 2015, 2022]]);
  assert.deepEqual(fehlt, [["CHE", 2013, 2014]]);
  assert.deepEqual(wert, [["CHE", 2013, 2014], ["MCI", 2015, 2022]]);
});

test("die zurückgeholten Stationen stehen in der Reihenfolge der Jahre", () => {
  const { wert } = vereinigeDatiert([["A", 2010, 2012]], [["C", 2018, 0], ["B", 2014, 2018]]);
  assert.deepEqual(wert.map((e) => e[0]), ["A", "B", "C"]);
});

test("leere Eingaben laufen durch", () => {
  assert.deepEqual(vereinigeListe(undefined, undefined).wert, []);
  assert.deepEqual(vereinigeDatiert(undefined, undefined).wert, []);
});

/* ── Die Falle, die den Lauf blockiert hat ───────────────────────────────────
   `export { norm } from "…"` reicht einen Namen nach aussen weiter, legt ihn aber
   NICHT im eigenen Gültigkeitsbereich an. In wikidata_roster.mjs stand genau das,
   und main() benutzte `norm` — der komplette Datenlauf brach beim ersten Verein
   mit „ReferenceError: norm is not defined" ab. Kein Test hat das gesehen, weil
   der Fehler erst zur Laufzeit auftritt und der Lauf Stunden dauert.

   Die Prüfung ist bewusst eng: Sie sucht nach dieser einen Schreibweise und
   meldet sie, wenn der Name im Rumpf auch benutzt wird. */
test("kein Skript benutzt einen Namen, den es nur weiterreicht", () => {
  const treffer = [];
  for (const datei of readdirSync(HERE).filter((f) => f.endsWith(".mjs"))) {
    const text = readFileSync(join(HERE, datei), "utf8");
    for (const m of text.matchAll(/^export\s*\{([^}]*)\}\s*from\s*["'][^"']+["']/gm)) {
      for (const roh of m[1].split(",")) {
        const name = roh.trim().split(/\s+as\s+/).pop().trim();
        if (!name) continue;
        const ohneZeile = text.replace(m[0], "");
        const benutzt = new RegExp(`(?<![\\w.$])${name}\\s*\\(`).test(ohneZeile);
        const importiert = new RegExp(`^import\\s[^;]*\\b${name}\\b`, "m").test(text);
        if (benutzt && !importiert) treffer.push(`${datei}: ${name}`);
      }
    }
  }
  assert.deepEqual(treffer, [], "weitergereicht statt importiert — zur Laufzeit ein ReferenceError");
});

/* Ohne diese Regel liefe der Lauf gegen sich selbst: WRONG_CLUBS streicht einen
   Verein, den wir zu Unrecht führen, und die Vereinigung holte ihn zurück. */
test("kuratiert entfernte Vereine kommen nicht zurück", async () => {
  const { WRONG_CLUBS } = await import("./apply_extra_players.mjs");
  const beispiel = Object.entries(WRONG_CLUBS)[0];
  assert.ok(beispiel, "WRONG_CLUBS ist leer — die Regel wäre nicht prüfbar");
  const [, weg] = beispiel;
  const gefiltert = ["BVB", ...weg].filter((c) => !new Set(weg).has(c));
  const { fehlt } = vereinigeListe(gefiltert, ["BVB"]);
  assert.deepEqual(fehlt, [], "ein gestrichener Verein darf nicht als Verlust gelten");
});
