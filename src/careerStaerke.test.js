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

/* ── Schritt 4: fehlende Vereine ──────────────────────────────────────────── */

test("keine Liga führt denselben Verein zweimal", () => {
  /* Wikidata führt für viele Vereine neben dem Verein die „erste Herrenmannschaft"
     als eigenes Objekt. VfL Bochum, Holstein Kiel und Hansa Rostock standen deshalb
     doppelt in der Welt — einmal mit Kader, einmal als leere Hülle. */
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const gesehen = new Map(), doppelt = [];
  for (const v of WELT_VEREINE) {
    const k = `${v.lg}|${norm(v.name)}`;
    if (gesehen.has(k)) doppelt.push(`${v.name} (${gesehen.get(k)} und ${v.key})`);
    else gesehen.set(k, v.key);
  }
  assert.deepEqual(doppelt, []);
});

test("der zweite Anlauf holt dünn erfasste Vereine zurück, ohne andere anzufassen", async () => {
  const { ZWEITER_ANLAUF } = await import("./careerStaerke.js");
  assert.ok(ZWEITER_ANLAUF.length > 0);
  for (const key of ZWEITER_ANLAUF) {
    assert.ok(key in VEREINS_STAERKE, `${key} steht im zweiten Anlauf, hat aber keine Stärke`);
    /* Dünn erfasst heisst: am unteren Ende. Kein Verein aus dem zweiten Anlauf darf
       in die Spitze rutschen, weil fünf bekannte Namen einen Schnitt verzerren. */
    assert.ok(VEREINS_STAERKE[key] < 80, `${key}: ${VEREINS_STAERKE[key]}`);
  }
  /* Die Saudi Pro League war mit vier Vereinen praktisch leer. */
  const welt = K.baueWelt((v) => VEREINS_STAERKE[v.key] ?? NaN);
  assert.ok(welt.vereine.filter((v) => v.liga.key === "SAU").length >= 8);
});
