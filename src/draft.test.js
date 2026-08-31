import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baueZiehungen, baueKlassen, passung, darfAufPosition, verbundPaare, verbundBonus,
  bewerte, obergrenze, saisonMarke, bilanz, abzeichenFuer, ABZEICHEN, zieh, bedientSlots,
  PASSUNG_GENAU, PASSUNG_GRUPPE, VERBUND_MAX, WERTUNG_UNTEN, SPIELE, LIGA_NAME,
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

test("Klasse ist der Rangplatz, gestreckt auf 50 bis 99", () => {
  const z = baueZiehungen(P, CLUBS, "XL", 2012);
  const k = baueKlassen(P, z);
  const werte = [...k.values()];
  assert.equal(Math.min(...werte), 50);
  assert.equal(Math.max(...werte), 99);
  /* Bekannter heißt nie schlechter — sonst wäre die Zahl nicht erklärbar. */
  const sortiert = [...k.entries()].sort((a, b) => (P[a[0]].sl || 0) - (P[b[0]].sl || 0));
  for (let i = 1; i < sortiert.length; i++) assert.ok(sortiert[i][1] >= sortiert[i - 1][1]);
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

test("die Wertung ist der Klassenschnitt plus Verbund", () => {
  const players = [{ pos: "ABW", pp: ["IV"] }, { pos: "ABW", pp: ["IV"] }];
  const klassen = new Map([[0, 90], [1, 70]]);
  const ohne = bewerte([0, 1], ["IV", "IV"], players, klassen, netzAus([]));
  assert.equal(ohne.klasseSchnitt, 80);
  assert.equal(ohne.paare, 0);
  assert.equal(ohne.wertung, 80);
  const mit = bewerte([0, 1], ["IV", "IV"], players, klassen, netzAus([[0, 1]]));
  assert.equal(mit.paare, 1);
  assert.equal(mit.wertung, Math.round((80 + verbundBonus(1)) * 10) / 10);
});

test("ein Spieler auf einer fremden Feinposition wird abgewertet", () => {
  const players = [{ pos: "ABW", pp: ["IV"] }];
  const klassen = new Map([[0, 100]]);
  assert.equal(bewerte([0], ["IV"], players, klassen, netzAus([])).je[0].wert, 100);
  assert.equal(bewerte([0], ["LV"], players, klassen, netzAus([])).je[0].wert, 92);
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

test("die Saisonmarke liegt unter der Obergrenze, aber über der Untergrenze", () => {
  const o = 106;
  assert.ok(saisonMarke(o) < o);
  assert.ok(saisonMarke(o) > WERTUNG_UNTEN);
});

// ── Saison ───────────────────────────────────────────────────────────────────

test("die Bilanz geht auf", () => {
  for (const w of [40, 60, 80, 95, 104, 130]) {
    for (const spiele of [34, 38]) {
      const b = bilanz(w, spiele, 106);
      assert.equal(b.siege + b.remis + b.niederlagen, spiele, `Wertung ${w}`);
      assert.equal(b.punkte, b.siege * 3 + b.remis);
      assert.ok(b.siege >= 0 && b.remis >= 0 && b.niederlagen >= 0);
    }
  }
});

test("mehr Wertung heißt nie weniger Punkte", () => {
  let vorher = -1;
  for (let w = WERTUNG_UNTEN - 10; w <= 115; w += 0.5) {
    const p = bilanz(w, 38, 106).punkte;
    assert.ok(p >= vorher, `bei Wertung ${w} fiel die Punktzahl`);
    vorher = p;
  }
});

test("unter der Untergrenze gibt es keinen Sieg, an der Marke gibt es nur Siege", () => {
  assert.equal(bilanz(WERTUNG_UNTEN, 38, 106).siege, 0);
  assert.equal(bilanz(WERTUNG_UNTEN - 20, 38, 106).siege, 0);
  assert.equal(bilanz(saisonMarke(106), 38, 106).siege, 38);
  assert.equal(bilanz(999, 34, 106).siege, 34);
});

/* Die Ligen haben verschieden viele Spieltage — die Leistung darf davon nicht
   abhängen, sonst wäre dieselbe Elf in der Bundesliga schlechter als in England.
   Geprüft wird der PUNKTEANTEIL, nicht das Abzeichen: 34 und 38 Spiele runden
   verschieden, und dicht an einer Schwelle kippt das Abzeichen davon unweigerlich.
   Ein voller Rang Unterschied wäre ein Fehler, ein halber Punkt ist die Arithmetik. */
test("dieselbe Wertung bringt in jeder Liga denselben Punkteanteil", () => {
  const stufen = ABZEICHEN.map((a) => a.key);
  for (let w = 60; w <= 105; w += 0.5) {
    const bl = bilanz(w, SPIELE.BL, 106);
    const pl = bilanz(w, SPIELE.PL, 106);
    const anteil = (b) => b.punkte / (b.spiele * 3);
    assert.ok(Math.abs(anteil(bl) - anteil(pl)) < 0.01,
      `Wertung ${w}: ${(anteil(bl) * 100).toFixed(1)} % gegen ${(anteil(pl) * 100).toFixed(1)} %`);
    const abstand = Math.abs(stufen.indexOf(abzeichenFuer(bl).key) - stufen.indexOf(abzeichenFuer(pl).key));
    assert.ok(abstand <= 1, `Wertung ${w}: ${abzeichenFuer(bl).name} gegen ${abzeichenFuer(pl).name}`);
  }
});

test("Abzeichen werden von oben nach unten geprüft", () => {
  assert.equal(abzeichenFuer({ siege: 38, remis: 0, niederlagen: 0, punkte: 114, spiele: 38 }).key, "makellos");
  assert.equal(abzeichenFuer({ siege: 30, remis: 8, niederlagen: 0, punkte: 98, spiele: 38 }).key, "unbesiegt");
  assert.equal(abzeichenFuer({ siege: 0, remis: 0, niederlagen: 38, punkte: 0, spiele: 38 }).key, "abstieg");
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
          if (bedientSlots(kandidat, PLAYERS, slots, belegt)) z = kandidat;
          else gezogen.push(`${kandidat.key}|${kandidat.jahr}`);
        }
        assert.ok(z, `${LIGA_NAME[liga]} / ${formation.name}: keine brauchbare Ziehung in Runde ${runde + 1}`);
        gezogen.push(`${z.key}|${z.jahr}`);
        const wahl = z.spieler
          .filter((i) => !belegt.includes(i))
          .map((i) => ({ i, k: slots.findIndex((pos, k) => belegt[k] == null && darfAufPosition(PLAYERS[i], pos)) }))
          .filter((x) => x.k >= 0)
          .sort((a, b) => (klassen.get(b.i) || 0) - (klassen.get(a.i) || 0))[0];
        belegt[wahl.k] = wahl.i;
      }
      assert.ok(belegt.every((i) => i != null), `${LIGA_NAME[liga]} / ${formation.name} blieb unvollständig`);
      const w = bewerte(belegt, slots, PLAYERS, klassen, { nachbarn: new Map() });
      assert.ok(w.wertung > WERTUNG_UNTEN, `${LIGA_NAME[liga]} / ${formation.name}: Wertung ${w.wertung}`);
    }
  }
});

test("die makellose Saison ist in jeder Liga erreichbar, aber nicht geschenkt", () => {
  for (const liga of ["BL", "PL", "LL"]) {
    const ziehungen = baueZiehungen(PLAYERS, ECHTE_CLUBS, liga);
    const klassen = baueKlassen(PLAYERS, ziehungen);
    for (const formation of FORMATIONS) {
      const o = obergrenze(formationPositions(formation), PLAYERS, klassen);
      const marke = saisonMarke(o);
      /* Erreichbar: Die Marke muss unter der besten überhaupt aufstellbaren Elf
         liegen. Nicht geschenkt: deutlich über dem, was Mittelmaß hergibt. */
      assert.ok(marke < o, `${LIGA_NAME[liga]} / ${formation.name}: Marke ${marke} über der Obergrenze ${o}`);
      assert.ok(marke > 85, `${LIGA_NAME[liga]} / ${formation.name}: Marke ${marke} zu niedrig`);
    }
  }
});
