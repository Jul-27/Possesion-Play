import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baueZiehungen, baueKlassen, passung, darfAufPosition, verbundPaare, verbundBonus,
  bewerte, obergrenze, zieh, bedientSlots, klassenKurve, formFaktor, klasseIn,
  PASSUNG_GENAU, PASSUNG_GRUPPE, VERBUND_MAX, SPIELE, LIGA_NAME,
  DRAFT_SL_MIN, DRAFT_MIN_KADER, DRAFT_AB_JAHR,
} from "./draft.js";
import { PLAYERS } from "./players.js";
import { CLUBS as ECHTE_CLUBS } from "./gameData.js";
import { FORMATIONS, formationPositions } from "./eleven.js";

/* Ein Miniverein-Universum: zwei Ligen, drei Vereine. Der Kader von AAA 2010 ist
   vollständig (alle vier Gruppen, elf Spieler), BBB hat keinen Torwart, CCC steht in
   der anderen Liga. */
const CLUBS = [
  { key: "AAA", name: "Verein A", lg: "XL" },
  { key: "BBB", name: "Verein B", lg: "XL" },
  { key: "CCC", name: "Verein C", lg: "YL" },
];

const spieler = (n, pos, pp, sl, cp) => ({ n, ln: n, by: 1990, pos, pp, sl, cp });
const bei = (key, von, bis) => [key, von, bis];

const P = [
  spieler("Tor Eins", "TW", ["TW"], 90, [bei("AAA", 2008, 2014)]),
  spieler("Tor Zwei", "TW", ["TW"], 40, [bei("CCC", 2008, 2014)]),
  ...["Abw A", "Abw B", "Abw C", "Abw D"].map((n, k) =>
    spieler(n, "ABW", [["LV", "IV", "IV", "RV"][k]], 80 - k, [bei("AAA", 2008, 2014), bei("BBB", 2008, 2014)])),
  ...["Mit A", "Mit B", "Mit C", "Mit D"].map((n, k) =>
    spieler(n, "MF", [["LM", "ZM", "ZM", "RM"][k]], 70 - k, [bei("AAA", 2008, 2014), bei("BBB", 2008, 2014)])),
  ...["Ang A", "Ang B"].map((n, k) =>
    spieler(n, "ST", [["MS", "MS"][k]], 60 - k, [bei("AAA", 2008, 2014), bei("BBB", 2008, 2014)])),
  spieler("Zu Unbekannt", "MF", ["ZM"], DRAFT_SL_MIN - 1, [bei("AAA", 2008, 2014)]),
  spieler("Ohne Gruppe", null, ["ZM"], 95, [bei("AAA", 2008, 2014)]),
];
const IDX = Object.fromEntries(P.map((p, i) => [p.n, i]));

// ── Ziehungen ────────────────────────────────────────────────────────────────

test("eine Ziehung braucht elf bekannte Spieler und alle vier Gruppen", () => {
  const z = baueZiehungen(P, CLUBS, "XL", 2012);
  assert.ok(z.length > 0);
  assert.ok(z.every((x) => x.key === "AAA"), "BBB hat keinen Torwart und darf nicht gezogen werden");
  for (const x of z) {
    assert.ok(x.spieler.length >= DRAFT_MIN_KADER);
    const gruppen = new Set(x.spieler.map((i) => P[i].pos));
    for (const g of ["TW", "ABW", "MF", "ST"]) assert.ok(gruppen.has(g), `${g} fehlt in ${x.name} ${x.jahr}`);
  }
});

test("Ziehungen bleiben in ihrer Liga und im Zeitraum", () => {
  const z = baueZiehungen(P, CLUBS, "YL", 2012);
  assert.deepEqual(z, [], "CCC hat allein keinen vollständigen Kader");
  const xl = baueZiehungen(P, CLUBS, "XL", 2012);
  assert.ok(xl.every((x) => x.jahr >= DRAFT_AB_JAHR && x.jahr <= 2012));
});

/* Zu unbekannt oder ohne Positionsgruppe: beides schließt aus dem Kader aus. Ohne
   diese Prüfung stünden Spieler zur Wahl, die im Rest des Spiels gar nicht vorkommen. */
test("zu unbekannte und gruppenlose Spieler stehen nicht im Kader", () => {
  const [z] = baueZiehungen(P, CLUBS, "XL", 2012);
  assert.ok(!z.spieler.includes(IDX["Zu Unbekannt"]));
  assert.ok(!z.spieler.includes(IDX["Ohne Gruppe"]));
});

// ── Klasse ───────────────────────────────────────────────────────────────────

test("Klasse ist der Rangplatz auf der Klassenkurve", () => {
  const z = baueZiehungen(P, CLUBS, "XL", 2012);
  const k = baueKlassen(P, z);
  const werte = [...k.values()];
  assert.equal(Math.min(...werte), 50);
  assert.equal(Math.max(...werte), 98);
  /* Bekannter heißt nie schlechter — sonst wäre die Zahl nicht erklärbar. */
  const sortiert = [...k.entries()].sort((a, b) => (P[a[0]].sl || 0) - (P[b[0]].sl || 0));
  for (let i = 1; i < sortiert.length; i++) assert.ok(sortiert[i][1] >= sortiert[i - 1][1]);
});

/* DER FEHLER, DEN DIESE PRÜFUNG FÄNGT: Die erste Fassung streckte den Rangplatz
   linear auf 50 bis 99 — damit lagen 19 % des Pools über 90 und Mario Balotelli
   stand auf 98. Die Kurve muss die Spitze knapp halten. */
test("die Klassenkurve lässt nur die äußerste Spitze über 90", () => {
  assert.equal(Math.round(klassenKurve(0)), 50);
  assert.equal(Math.round(klassenKurve(1)), 98);
  assert.ok(klassenKurve(0.5) < 60, "der Median liegt unten, nicht in der Mitte der Skala");
  assert.ok(klassenKurve(0.9) < 72, "auch die besten 10 % sind noch keine Weltklasse");
  assert.ok(klassenKurve(0.99) < 90, "das oberste Prozent reicht noch nicht für 90");
  assert.ok(klassenKurve(0.999) > 90);
  /* Steigend über den ganzen Bereich, sonst wäre ein Rangplatz mehr wert als der
     nächsthöhere. */
  let vorher = -1;
  for (let p = 0; p <= 1; p += 0.001) {
    const k = klassenKurve(p);
    assert.ok(k >= vorher, `Kurve fällt bei ${p.toFixed(3)}`);
    vorher = k;
  }
});

/* Bekanntheit gilt karriereweit. Ohne die Formkurve wäre ein 17-Jähriger mit zwei
   Einwechslungen so stark wie derselbe Spieler zehn Jahre später. */
test("die Form senkt Talente und Routiniers, nicht die besten Jahre", () => {
  assert.equal(formFaktor(21), 1);
  assert.equal(formFaktor(28), 1);
  assert.equal(formFaktor(32), 1);
  assert.ok(formFaktor(17) < 0.7, "mit 17 ist niemand auf seinem Höhepunkt");
  assert.ok(formFaktor(19) < 0.9);
  assert.ok(formFaktor(36) < 0.8);
  assert.ok(formFaktor(40) < formFaktor(36), "nach 39 geht es nicht wieder hinauf");
  /* Die Form wirkt nur auf den Teil ÜBER 50 — 50 ist der Boden der Skala, kein
     Können, das einem Talent fehlte. */
  const basis = new Map([[0, 90]]);
  const spieler = [{ by: 2000 }];
  assert.equal(klasseIn(basis, spieler, 0, 2028), 90, "mit 28 die volle Grundklasse");
  assert.ok(klasseIn(basis, spieler, 0, 2018) > 65, "mit 18 gedämpft, aber nicht halbiert");
  assert.ok(klasseIn(basis, spieler, 0, 2018) < 85);
  assert.ok(klasseIn(basis, spieler, 0, 2038) < klasseIn(basis, spieler, 0, 2028));
});

// ── Passung ──────────────────────────────────────────────────────────────────

test("die genaue Position zählt voll, die grobe Gruppe weniger, fremde Gruppen gar nicht", () => {
  const iv = { pos: "ABW", pp: ["IV"] };
  assert.equal(passung(iv, "IV"), PASSUNG_GENAU);
  assert.equal(passung(iv, "LV"), PASSUNG_GRUPPE, "Innenverteidiger darf notfalls außen");
  assert.equal(passung(iv, "MS"), 0);
  assert.equal(passung(null, "IV"), 0);
  assert.equal(darfAufPosition(iv, "MS"), false);
});

/* Der Torwart ist die harte Grenze: Wer keiner ist, darf nie ins Tor, auch nicht
   über die grobe Gruppe. */
test("nur Torhüter dürfen ins Tor, und Torhüter nur dorthin", () => {
  const tw = { pos: "TW", pp: ["TW"] };
  const ms = { pos: "ST", pp: ["MS"] };
  assert.ok(passung(tw, "TW") > 0);
  assert.equal(passung(ms, "TW"), 0);
  assert.equal(passung(tw, "MS"), 0);
});

test("ohne Feinposition entscheidet die grobe Gruppe", () => {
  const roh = { pos: "MF", pp: null };
  assert.equal(passung(roh, "ZM"), PASSUNG_GRUPPE);
  assert.equal(passung(roh, "TW"), 0);
});

// ── Verbund ──────────────────────────────────────────────────────────────────

const netzAus = (paare) => {
  const nachbarn = new Map();
  const dazu = (i, j) => { if (!nachbarn.has(i)) nachbarn.set(i, new Set()); nachbarn.get(i).add(j); };
  for (const [i, j] of paare) { dazu(i, j); dazu(j, i); }
  return { nachbarn };
};

test("Verbund zählt jedes Paar einmal und überspringt leere Plätze", () => {
  const netz = netzAus([[0, 1], [1, 2], [0, 2]]);
  assert.equal(verbundPaare([0, 1, 2], netz), 3);
  assert.equal(verbundPaare([0, 1, null, 2], netz), 3);
  assert.equal(verbundPaare([0, 1], netz), 1);
  assert.equal(verbundPaare([3, 4], netz), 0);
});

test("der Verbundbonus wächst, aber gedeckelt", () => {
  assert.equal(verbundBonus(0), 0);
  assert.ok(verbundBonus(4) > verbundBonus(1));
  assert.ok(verbundBonus(1) > 0);
  assert.equal(verbundBonus(55), VERBUND_MAX, "auch die vollständig verbundene Elf sprengt die Decke nicht");
});

// ── Wertung ──────────────────────────────────────────────────────────────────

/* Die Elf führt je Platz `{ i, jahr }`. Ohne das Jahr bekäme Lewandowski 2014 und
   2026 dieselbe Zahl, und die ganze Formkurve liefe ins Leere. */
const auf = (...paare) => paare.map(([i, jahr]) => (i == null ? null : { i, jahr }));

test("die Wertung ist der Klassenschnitt plus Verbund", () => {
  const players = [{ pos: "ABW", pp: ["IV"], by: 1990 }, { pos: "ABW", pp: ["IV"], by: 1990 }];
  const klassen = new Map([[0, 90], [1, 70]]);
  const elf = auf([0, 2018], [1, 2018]);   // beide 28, also volle Form
  const ohne = bewerte(elf, ["IV", "IV"], players, klassen, netzAus([]));
  assert.equal(ohne.klasseSchnitt, 80);
  assert.equal(ohne.paare, 0);
  assert.equal(ohne.wertung, 80);
  const mit = bewerte(elf, ["IV", "IV"], players, klassen, netzAus([[0, 1]]));
  assert.equal(mit.paare, 1);
  assert.equal(mit.wertung, Math.round((80 + verbundBonus(1)) * 10) / 10);
});

test("dieselbe Elf ist in schlechten Jahren weniger wert", () => {
  const players = [{ pos: "ABW", pp: ["IV"], by: 1990 }];
  const klassen = new Map([[0, 90]]);
  const jung = bewerte(auf([0, 2008]), ["IV"], players, klassen, netzAus([])).wertung;
  const reif = bewerte(auf([0, 2018]), ["IV"], players, klassen, netzAus([])).wertung;
  const alt = bewerte(auf([0, 2028]), ["IV"], players, klassen, netzAus([])).wertung;
  assert.equal(reif, 90);
  assert.ok(jung < reif, "mit 18 noch nicht");
  assert.ok(alt < reif, "mit 38 nicht mehr");
});

test("ein Spieler auf einer fremden Feinposition wird abgewertet", () => {
  const players = [{ pos: "ABW", pp: ["IV"], by: 1990 }];
  const klassen = new Map([[0, 100]]);
  assert.equal(bewerte(auf([0, 2018]), ["IV"], players, klassen, netzAus([])).je[0].wert, 100);
  assert.equal(bewerte(auf([0, 2018]), ["LV"], players, klassen, netzAus([])).je[0].wert, 92);
});

// ── Obergrenze ───────────────────────────────────────────────────────────────

/* Der Fehler, den diese Prüfung fängt: Eine frühere Fassung nahm je Position den
   besten Spieler OHNE Rücksicht darauf, dass er nur einmal aufgestellt werden kann.
   Ein einziger Weltklassemann hob damit die Marke für alle Positionen an, die er
   spielen konnte — und die makellose Saison wurde unerreichbar. */
test("die Obergrenze stellt jeden Spieler nur einmal auf", () => {
  const players = [
    { pos: "ABW", pp: ["IV", "LV"] },   // passt auf beide Slots
    { pos: "ABW", pp: ["LV"] },
  ];
  const klassen = new Map([[0, 99], [1, 50]]);
  const o = obergrenze(["IV", "LV"], players, klassen);
  assert.equal(o, Math.round(((99 + 50) / 2 + VERBUND_MAX) * 10) / 10);
});

// ── Ziehen ───────────────────────────────────────────────────────────────────

test("derselbe Seed zieht dasselbe, und Gezogenes kommt nicht wieder", () => {
  const z = baueZiehungen(P, CLUBS, "XL", 2012);
  const a = zieh(z, "tag#1");
  assert.deepEqual(zieh(z, "tag#1"), a);
  const gezogen = z.slice(0, z.length - 1).map((x) => `${x.key}|${x.jahr}`);
  assert.equal(zieh(z, "egal", gezogen), z[z.length - 1]);
});

test("sind alle Ziehungen verbraucht, wird trotzdem eine geliefert", () => {
  const z = baueZiehungen(P, CLUBS, "XL", 2012);
  const alle = z.map((x) => `${x.key}|${x.jahr}`);
  assert.ok(z.includes(zieh(z, "tag#9", alle)));
});

test("ein Kader bedient nur offene Stellen mit noch freien Spielern", () => {
  const z = { spieler: [IDX["Tor Eins"]] };
  assert.equal(bedientSlots(z, P, ["TW", "MS"], [null, null]), true);
  assert.equal(bedientSlots(z, P, ["TW", "MS"], [IDX["Tor Eins"], null]), false, "Torwart schon aufgestellt");
  assert.equal(bedientSlots(z, P, ["MS"], [null]), false);
});

// ── Mit den echten Daten ─────────────────────────────────────────────────────

/* Diese Prüfungen laufen gegen players.js. Sie sind der Grund, warum der Modus
   überhaupt tragfähig ist: Ein Draft, der in eine Sackgasse läuft, wäre unspielbar. */
test("alle drei Ligen haben genug Ziehungen", () => {
  for (const liga of ["BL", "PL", "LL"]) {
    const z = baueZiehungen(PLAYERS, ECHTE_CLUBS, liga);
    assert.ok(z.length >= 100, `${LIGA_NAME[liga]}: nur ${z.length} Ziehungen`);
    assert.ok(SPIELE[liga] > 0);
  }
});

test("ein Draft läuft in keiner Liga und keiner Formation in eine Sackgasse", () => {
  for (const liga of ["BL", "PL", "LL"]) {
    const ziehungen = baueZiehungen(PLAYERS, ECHTE_CLUBS, liga);
    const klassen = baueKlassen(PLAYERS, ziehungen);
    for (const formation of FORMATIONS) {
      const slots = formationPositions(formation);
      const belegt = slots.map(() => null);
      const gezogen = [];
      for (let runde = 0; runde < slots.length; runde++) {
        /* So spielt ein Mensch: spinnen, bis ein Kader eine offene Stelle bedient. */
        let z = null;
        for (let versuch = 0; versuch < 200 && !z; versuch++) {
          const kandidat = zieh(ziehungen, `${liga}#${formation.name}#${runde}#${versuch}`, gezogen);
          if (bedientSlots(kandidat, PLAYERS, slots, belegt.map((e) => (e ? e.i : null)))) z = kandidat;
          else gezogen.push(`${kandidat.key}|${kandidat.jahr}`);
        }
        assert.ok(z, `${LIGA_NAME[liga]} / ${formation.name}: keine brauchbare Ziehung in Runde ${runde + 1}`);
        gezogen.push(`${z.key}|${z.jahr}`);
        const drin = new Set(belegt.filter(Boolean).map((e) => e.i));
        const wahl = z.spieler
          .filter((i) => !drin.has(i))
          .map((i) => ({ i, k: slots.findIndex((pos, k) => belegt[k] == null && darfAufPosition(PLAYERS[i], pos)) }))
          .filter((x) => x.k >= 0)
          .sort((a, b) => (klassen.get(b.i) || 0) - (klassen.get(a.i) || 0))[0];
        belegt[wahl.k] = { i: wahl.i, jahr: z.jahr };
      }
      assert.ok(belegt.every((e) => e != null), `${LIGA_NAME[liga]} / ${formation.name} blieb unvollständig`);
      const w = bewerte(belegt, slots, PLAYERS, klassen, { nachbarn: new Map() });
      assert.ok(w.wertung > 60, `${LIGA_NAME[liga]} / ${formation.name}: Wertung ${w.wertung}`);
    }
  }
});
