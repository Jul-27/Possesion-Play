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
    { club: "MUN", name: "Manchester United", from: 2003, to: 2009 },
    { club: "RMA", name: "Real Madrid", from: 2009, to: 2018 },
    { club: "MUN", name: "Manchester United", from: 2021, to: 2022 },
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
    { club: "TOT", name: "Tottenham Hotspur", from: 2005, to: 2015 },
    { club: "EVE", name: "Everton", from: 2015, to: 2018 },
  ]);
  // Echte Rückkehr nach Lücke bleibt getrennt
  const cr7 = { sl: 99, cp: [["MUN", 2003, 2009], ["RMA", 2009, 2018], ["MUN", 2021, 2022]] };
  assert.equal(careerStations(cr7).length, 3);
  // Offenes Ende gewinnt beim Verschmelzen
  const open = { sl: 50, cp: [["PSG", 2021, 2023], ["PSG", 2022, 0]] };
  assert.deepEqual(careerStations(open), [{ club: "PSG", name: "Paris Saint-Germain", from: 2021, to: 0 }]);
});

/* Der Kern der Umstellung: liegt die volle, datierte Karriere vor, sticht sie das
   cp-Feld. Vorher begann Gündoğans Pfad bei Dortmund — Bochum und Nürnberg fehlten,
   weil cp nur die 47 Spielvereine kennt. */
test("die volle Karriere sticht das cp-Feld", () => {
  const gundo = { n: "İlkay Gündoğan", by: 1990, sl: 70, cp: [["BVB", 2011, 2016], ["MCI", 2016, 2023]] };
  const dated = {
    clubs: ["1. FC Nürnberg", "Borussia Dortmund", "Manchester City", "FC Barcelona"],
    byKey: { "ilkay gundogan|1990": [[0, 2009, 2011], [1, 2011, 2016], [2, 2016, 2023], [3, 2023, 2024], [2, 2024, 0]] },
  };
  const st = careerStations(gundo, dated);
  assert.deepEqual(st.map((s) => s.name),
    ["1. FC Nürnberg", "Borussia Dortmund", "Manchester City", "FC Barcelona", "Manchester City"]);
  assert.equal(st[4].to, 0, "die Rückkehr läuft noch");
});

/* Ohne Treffer in Wikidata darf ein Spieler nicht aus dem Rätselpool fallen. */
test("ohne volle Karriere greift weiterhin das cp-Feld", () => {
  const p = { n: "Ohne Treffer", by: 1990, sl: 70, cp: [["FCB", 2010, 2013], ["RMA", 2013, 2016], ["JUV", 2016, 0]] };
  const dated = { clubs: ["1. FC Nürnberg"], byKey: { "jemand anders|1988": [[0, 2009, 2011]] } };
  assert.deepEqual(careerStations(p, dated).map((s) => s.club), ["FCB", "RMA", "JUV"]);
});

/* Das Kürzel entscheidet nur über das Wappen: die 47 Spielvereine haben eins, die
   übrigen 1655 erscheinen als schlichter Name. */
test("nur Spielvereine bekommen ein Kürzel", () => {
  const p = { n: "X Y", by: 1990, sl: 70, cp: [] };
  const dated = {
    clubs: ["1. FC Nürnberg", "Borussia Dortmund"],
    byKey: { "x y|1990": [[0, 2009, 2011], [1, 2011, 2016]] },
  };
  const st = careerStations(p, dated);
  assert.equal(st[0].club, null, "Nürnberg hat kein Wappen im Repo");
  assert.equal(st[1].club, "BVB", "Dortmund schon");
});

test("überlappende Spells verschmelzen auch in der vollen Karriere", () => {
  const p = { n: "X Y", by: 1990, sl: 70, cp: [] };
  const dated = {
    clubs: ["FC Everton", "Tottenham Hotspur"],
    byKey: { "x y|1990": [[1, 2005, 2015], [0, 2015, 2018], [0, 2015, 2015]] },
  };
  assert.deepEqual(careerStations(p, dated).map((s) => `${s.name} ${s.from}-${s.to}`),
    ["Tottenham Hotspur 2005-2015", "Everton 2015-2018"],
    "„FC Everton“ erscheint unter dem Spielnamen „Everton“");
});

/* careerPathClubs.js führt die Wikidata-Schreibweise, das Spiel den kürzeren Namen.
   Vor der Auflösung standen Gerrards Liverpool, Lampards Chelsea, Pirlos Milan und
   Juventus sowie Rooneys Everton ohne Wappen da — fünf der bekanntesten Vereine
   überhaupt. */
test("Wikidata-Schreibweisen finden ihr Wappen und ihren Spielnamen", () => {
  const dated = {
    clubs: ["FC Liverpool", "FC Chelsea", "AC Milan", "Juventus Turin", "FC Everton"],
    byKey: { "x y|1990": [[0, 2000, 2005], [1, 2005, 2008], [2, 2008, 2011], [3, 2011, 2014], [4, 2014, 2016]] },
  };
  const st = careerStations({ n: "X Y", by: 1990, sl: 70, cp: [] }, dated);
  assert.deepEqual(st.map((s) => s.club), ["LIV", "CHE", "MIL", "JUV", "EVE"], "alle fünf mit Wappen");
  assert.deepEqual(st.map((s) => s.name), ["Liverpool", "Chelsea", "AC Mailand", "Juventus", "Everton"]);
});

test("unbekannte Vereine bleiben unangetastet", () => {
  const dated = { clubs: ["Brescia Calcio"], byKey: { "x y|1990": [[0, 2000, 2005]] } };
  const [st] = careerStations({ n: "X Y", by: 1990, sl: 70, cp: [] }, dated);
  assert.equal(st.name, "Brescia Calcio");
  assert.equal(st.club, null);
});

test("Echtdaten: die volle Karriere vergrößert den Rätselpool deutlich", async () => {
  const { PLAYERS } = await import("./players.js");
  const { CAREER_PATH_CLUBS, CAREER_PATH_BY_KEY } = await import("./careerPathClubs.js");
  const dated = { clubs: CAREER_PATH_CLUBS, byKey: CAREER_PATH_BY_KEY };
  const ohne = careerCandidates(PLAYERS).length;
  const mit = careerCandidates(PLAYERS, dated).length;
  assert.ok(mit > ohne * 2, `Pool sollte deutlich wachsen: ${ohne} -> ${mit}`);
  const g = PLAYERS.find((p) => p.n === "İlkay Gündoğan");
  const namen = careerStations(g, dated).map((s) => s.name);
  assert.ok(namen.includes("1. FC Nürnberg"), `Nürnberg fehlt: ${namen.join(", ")}`);
});
