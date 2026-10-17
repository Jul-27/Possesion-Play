import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYERS } from "./players.js";
import { RUNDEN, besterSpieler, BEKANNT_AB, MIN_BESTER_TREFFER } from "./vier.js";
import {
  MAX_PUNKTE, GELOEST_AB, tagesRunden, rundenErgebnis, summe, geloest, bestenlistenPunkte,
  leererTag, tagFortsetzen, rundeBegonnen, rundeBeendet, tagFertig, teilenText,
} from "./vierTag.js";

globalThis.window = { location: { origin: "https://pp.test", pathname: "/" } };

test("tagesRunden: fünf spielbare Gruppen, gleicher Tag ⇒ gleiche Gruppen", () => {
  const a = tagesRunden(PLAYERS, "2026-10-18");
  const b = tagesRunden(PLAYERS, "2026-10-18");
  const c = tagesRunden(PLAYERS, "2026-10-19");
  assert.equal(a.length, RUNDEN);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  const bekannt = PLAYERS.filter((p) => (p.sl || 0) >= BEKANNT_AB);
  for (const r of a) assert.ok(besterSpieler(bekannt, r).treffer >= MIN_BESTER_TREFFER);
});

test("tagesRunden: über einen Monat nie weniger als fünf Runden", () => {
  for (let t = 1; t <= 30; t++) assert.equal(tagesRunden(PLAYERS, `2026-11-${String(t).padStart(2, "0")}`).length, RUNDEN);
});

test("rundenErgebnis, summe, geloest", () => {
  const p = { n: "Test", clubs: ["FCB", "BVB", "RMA"] };
  assert.deepEqual(rundenErgebnis(p, ["FCB", "BVB", "JUV", "PSG"], "test|1990"), { key: "test|1990", name: "Test", punkte: 2 });
  assert.deepEqual(rundenErgebnis(null, ["FCB"]), { key: null, name: null, punkte: 0 });
  assert.equal(summe([{ punkte: 3 }, { punkte: 0 }, null, { punkte: 4 }]), 7);
  assert.equal(MAX_PUNKTE, 20);
  assert.ok(!geloest(GELOEST_AB - 1));
  assert.ok(geloest(GELOEST_AB));
});

test("bestenlistenPunkte: 0–100 wie die anderen Tagesrätsel", () => {
  assert.equal(bestenlistenPunkte(0), 0);
  assert.equal(bestenlistenPunkte(10), 50);
  assert.equal(bestenlistenPunkte(20), 100);
  assert.equal(bestenlistenPunkte(99), 100);
});

test("Fortschritt: Runde begonnen und neu geladen ⇒ null Punkte, weiter mit der nächsten", () => {
  let t = leererTag();
  t = rundeBegonnen(t, 0);
  t = rundeBeendet(t, { key: "a|1", name: "A", punkte: 3 });
  t = rundeBegonnen(t, 1);
  // Neu laden mitten in Runde 2
  const weiter = tagFortsetzen(JSON.parse(JSON.stringify(t)));
  assert.equal(weiter.ergebnisse.length, 2);
  assert.equal(weiter.ergebnisse[1].punkte, 0);
  assert.ok(weiter.ergebnisse[1].abgebrochen);
  assert.equal(weiter.begonnen, null);
  // Ein zweites Laden zählt die Runde nicht noch einmal
  assert.equal(tagFortsetzen(weiter).ergebnisse.length, 2);
});

test("Fortschritt: kaputter oder fehlender Speicherstand fängt leer an", () => {
  assert.deepEqual(tagFortsetzen(null), leererTag());
  assert.deepEqual(tagFortsetzen({ unsinn: 1 }), leererTag());
});

test("tagFertig nach fünf Runden", () => {
  let t = leererTag();
  for (let i = 0; i < RUNDEN; i++) { assert.ok(!tagFertig(t)); t = rundeBeendet(t, { punkte: 1 }); }
  assert.ok(tagFertig(t));
});

test("teilenText verrät die Punkte je Runde, nicht die Spieler", () => {
  const txt = teilenText(42, [{ name: "Christian Vieri", punkte: 3 }, { punkte: 0 }, { punkte: 4 }, { punkte: 2 }, { punkte: 1 }]);
  assert.match(txt, /Vier Wappen #42 · 10\/20/);
  assert.match(txt, /🟩🟩🟩⬛ ⬛⬛⬛⬛ 🟩🟩🟩🟩 🟩🟩⬛⬛ 🟩⬛⬛⬛/);
  assert.match(txt, /\?solo=vier$/);
  assert.doesNotMatch(txt, /Vieri/);
});
