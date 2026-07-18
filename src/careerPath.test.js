import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAREER_SL_MIN, CAREER_MIN_STATIONS, careerCandidates, careerStations, pickCareerIndex,
} from "./careerPath.js";

const mk = (n, sl, cp) => ({ n, ln: n, by: 1990, nat: ["GER"], clubs: [...new Set(cp.map((c) => c[0]))], sl, cp });

const POOL = [
  mk("Drei Stationen", 50, [["FCB", 2010, 2013], ["RMA", 2013, 2016], ["JUV", 2016, 0]]),
  mk("Zwei Stationen", 90, [["BAR", 2010, 2015], ["PSG", 2015, 2018]]),        // zu wenige Stationen
  mk("Unbekannt", 10, [["FCB", 2010, 2012], ["BVB", 2012, 2014], ["VFB", 2014, 2016]]), // sl zu klein
  mk("Rückkehrer", 60, [["MUN", 2003, 2009], ["RMA", 2009, 2018], ["MUN", 2021, 2022]]),
  mk("Ohne cp", 80, []),
];

test("careerCandidates: >=3 Stationen und sl >= Schwelle", () => {
  assert.equal(CAREER_MIN_STATIONS, 3);
  assert.equal(CAREER_SL_MIN, 40);
  const idx = careerCandidates(POOL);
  assert.deepEqual(idx.map((i) => POOL[i].n), ["Drei Stationen", "Rückkehrer"]);
});

test("careerStations: chronologisch, Mehrfach-Engagements getrennt, to=0 offen", () => {
  const st = careerStations(POOL[3]); // Rückkehrer
  assert.deepEqual(st, [
    { club: "MUN", from: 2003, to: 2009 },
    { club: "RMA", from: 2009, to: 2018 },
    { club: "MUN", from: 2021, to: 2022 },
  ]);
  const open = careerStations(POOL[0]);
  assert.equal(open[2].to, 0, "offenes Ende bleibt 0");
  assert.equal(careerStations({}).length, 0, "ohne cp leer");
});

test("pickCareerIndex: liefert deterministisch einen Kandidaten", () => {
  const first = pickCareerIndex(POOL, () => 0);
  const last = pickCareerIndex(POOL, () => 0.999);
  assert.equal(POOL[first].n, "Drei Stationen");
  assert.equal(POOL[last].n, "Rückkehrer");
});

test("Echtdaten: genug Kandidaten für abwechslungsreiches Spiel", async () => {
  const { PLAYERS } = await import("./players.js");
  const idx = careerCandidates(PLAYERS);
  assert.ok(idx.length > 100, `zu wenige Kandidaten: ${idx.length}`);
  const p = PLAYERS[idx[0]];
  assert.ok(careerStations(p).length >= CAREER_MIN_STATIONS);
});

test("careerStations: doppelte/überlappende Spells desselben Vereins verschmelzen", () => {
  // Wikidata-Artefakt: Leihe + Vertrag beim selben Verein
  const lennon = { sl: 50, cp: [["TOT", 2005, 2015], ["EVE", 2015, 2018], ["EVE", 2015, 2015]] };
  assert.deepEqual(careerStations(lennon), [
    { club: "TOT", from: 2005, to: 2015 },
    { club: "EVE", from: 2015, to: 2018 },
  ]);
  // Echte Rückkehr nach Lücke bleibt getrennt
  const cr7 = { sl: 99, cp: [["MUN", 2003, 2009], ["RMA", 2009, 2018], ["MUN", 2021, 2022]] };
  assert.equal(careerStations(cr7).length, 3);
  // Offenes Ende gewinnt beim Verschmelzen
  const open = { sl: 50, cp: [["PSG", 2021, 2023], ["PSG", 2022, 0]] };
  assert.deepEqual(careerStations(open), [{ club: "PSG", from: 2021, to: 0 }]);
});
