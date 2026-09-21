import test from "node:test";
import assert from "node:assert/strict";
import { STAERKE_QUELLE, VEREINS_STAERKE } from "./careerStaerke.js";
import { WELT_LIGEN, WELT_VEREINE } from "./careerWorld.js";
import { fingerabdruck, EINGABEN } from "../data-pipeline/career_staerke_quelle.mjs";
import * as K from "./karriere.js";

/* Die Vereinsstärken liegen vorberechnet als Tabelle — warum, steht in
   vereinsStaerke.js (22 Sekunden bei jedem Öffnen des Modus). Eine vorberechnete
   Tabelle hat genau eine Schwäche: Sie kann veralten, ohne dass es jemand merkt.
   Diese Prüfungen sind dafür da, dass es jemand merkt. */

test("die Vereinsstärken passen zum aktuellen Datenstand", () => {
  const jetzt = fingerabdruck();
  const veraltet = EINGABEN.filter((f) => jetzt[f] !== STAERKE_QUELLE[f]);
  assert.deepEqual(veraltet, [],
    `careerStaerke.js ist veraltet — geändert seit der letzten Berechnung: ${veraltet.join(", ")}.\n`
    + "    Neu rechnen mit: node data-pipeline/career_staerke.mjs");
});

test("der Fingerabdruck deckt alle Eingaben ab", () => {
  /* Kommt eine Eingabe hinzu und wird im Fingerabdruck vergessen, prüft die
     Prüfung oben sie nie — und die Tabelle veraltet an genau dieser Stelle still. */
  assert.deepEqual(Object.keys(STAERKE_QUELLE).sort(), [...EINGABEN].sort());
});

test("jede Stärke gehört zu einem Verein der Welt und ist eine echte Zahl", () => {
  const bekannt = new Set(WELT_VEREINE.map((v) => v.key));
  for (const [key, s] of Object.entries(VEREINS_STAERKE)) {
    assert.ok(bekannt.has(key), `${key} steht nicht in careerWorld.js`);
    assert.ok(Number.isFinite(s) && s > 40 && s < 100, `${key}: Stärke ${s} ist unplausibel`);
  }
});

test("aus der Tabelle entsteht eine vollständige Welt", () => {
  const welt = K.baueWelt((v) => VEREINS_STAERKE[v.key] ?? NaN);
  assert.equal(welt.vereine.length, Object.keys(VEREINS_STAERKE).length);
  /* Jede Liga braucht Vereine, sonst gibt es dort weder Angebote noch Auf- und
     Abstieg. Eine Liga ohne einen einzigen auswertbaren Verein wäre ein Datenfehler,
     den man vor dem Spieler bemerken will. */
  const leer = WELT_LIGEN.filter((l) => !welt.vereine.some((v) => v.liga.key === l.key)).map((l) => l.key);
  assert.deepEqual(leer, [], `Ligen ohne einen Verein: ${leer.join(", ")}`);
  /* Und jede Rufstufe kommt vor — sonst fehlt der Welt ein ganzes Stockwerk. */
  const stufen = new Set(welt.vereine.map((v) => v.stufe));
  for (let s = 0; s <= 5; s++) assert.ok(stufen.has(s), `keine Vereine auf Rufstufe ${s}`);
});

test("der Karrieremodus lädt keine Spielerdaten mehr", async () => {
  /* Der eigentliche Gewinn: Der Modus braucht weder players.js (5 MB) noch
     appearances.js. Käme einer der Importe zurück, käme auch die Wartezeit zurück. */
  const { readFileSync } = await import("node:fs");
  const quelle = readFileSync(new URL("./Karriere.jsx", import.meta.url), "utf8");
  for (const verboten of ["playersStore", "appearancesStore", "baueZiehungen", "baueKlassen", "teamStaerke"]) {
    assert.ok(!quelle.includes(verboten), `Karriere.jsx greift wieder auf ${verboten} zu`);
  }
});
