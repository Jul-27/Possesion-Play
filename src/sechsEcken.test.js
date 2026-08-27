import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ueberlappt, baueNetz, gemeinsameStation, sindMitspieler, kuerzesterWeg, abstaende,
  paarDesTages, pruefeSchritt, stationText, shareText, ECKEN_SL_MIN,
} from "./sechsEcken.js";

/* Ein kleiner Datensatz mit bekannter Struktur: A–B bei Verein 0, B–C bei Verein 1,
   C–D bei Verein 2. D ist von A also drei Schritte entfernt. E stand zwar auch bei
   Verein 0, aber zwanzig Jahre früher — er ist mit niemandem verbunden. */
const CLUBS = ["FC Bayern München", "AC Milan", "FC Arsenal", "Hamburger SV"];
const P = [
  { n: "Anna Alt",   ln: "Alt",   by: 1990, sl: 80 },
  { n: "Bea Berg",   ln: "Berg",  by: 1991, sl: 80 },
  { n: "Cem Cakir",  ln: "Cakir", by: 1992, sl: 80 },
  { n: "Dana Dorn",  ln: "Dorn",  by: 1993, sl: 80 },
  { n: "Emil Elb",   ln: "Elb",   by: 1960, sl: 80 },
  { n: "Finn Fels",  ln: "Fels",  by: 1994, sl: 10 },   // zu unbekannt für den Pool
];
const dated = {
  clubs: CLUBS,
  byKey: {
    "anna alt|1990":  [[0, 2010, 2015]],
    "bea berg|1991":  [[0, 2013, 2018], [1, 2018, 2021]],
    "cem cakir|1992": [[1, 2020, 2024], [2, 2024, 0]],
    "dana dorn|1993": [[2, 2025, 0]],
    "emil elb|1960":  [[0, 1985, 1990]],
    "finn fels|1994": [[0, 2010, 2015]],
  },
};
const netz = baueNetz(P, dated);
const I = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };

// ── Die Kante ────────────────────────────────────────────────────────────────

/* Ohne die Jahresprüfung wäre Beckenbauer ein Mitspieler von Musiala und jeder mit
   jedem über zwei Ecken verbunden. Das ist die Regel, an der alles hängt. */
test("verbunden ist nur, wer sich zeitlich überschneidet", () => {
  const bayern = (von, bis) => ({ club: 0, von, bis });
  assert.equal(ueberlappt(bayern(2010, 2015), bayern(2013, 2018)), true);
  assert.equal(ueberlappt(bayern(2010, 2015), bayern(2016, 2020)), false);
  assert.equal(ueberlappt(bayern(2010, 2015), bayern(2015, 2019)), true, "ein gemeinsames Jahr genügt");
  assert.equal(ueberlappt(bayern(2010, 0), bayern(2020, 2022)), true, "bis heute läuft weiter");
  assert.equal(ueberlappt({ club: 0, von: 2010, bis: 2015 }, { club: 1, von: 2010, bis: 2015 }), false,
    "gleiche Jahre, anderer Verein");
});

test("das Netz verbindet nur, wer zusammen gespielt hat", () => {
  assert.equal(sindMitspieler(netz, I.A, I.B), true);
  assert.equal(sindMitspieler(netz, I.B, I.C), true);
  assert.equal(sindMitspieler(netz, I.A, I.C), false, "nie zusammen");
  assert.equal(sindMitspieler(netz, I.A, I.E), false, "derselbe Verein, zwanzig Jahre auseinander");
});

test("zu unbekannte Spieler kommen nicht ins Netz", () => {
  assert.ok(!netz.knoten.includes(I.F), `sl unter ${ECKEN_SL_MIN}`);
  assert.equal(sindMitspieler(netz, I.A, I.F), false);
});

test("gemeinsameStation nennt Verein und Zeitraum", () => {
  assert.deepEqual(gemeinsameStation(netz, I.A, I.B), { club: "FC Bayern München", von: 2013, bis: 2015 });
  assert.equal(gemeinsameStation(netz, I.A, I.C), null);
  // „AC Milan" ist Wikidatas Schreibweise; im Spiel heißt der Verein anders
  assert.equal(gemeinsameStation(netz, I.B, I.C).club, "AC Mailand");
});

test("stationText schreibt laufende Zeiträume aus", () => {
  assert.equal(stationText({ club: "AC Mailand", von: 2018, bis: 2021 }), "AC Mailand, 2018–2021");
  assert.equal(stationText({ club: "FC Arsenal", von: 2024, bis: 0 }), "FC Arsenal, seit 2024");
  assert.equal(stationText(null), "");
});

// ── Wege ─────────────────────────────────────────────────────────────────────

test("kuerzesterWeg findet die Kette", () => {
  assert.deepEqual(kuerzesterWeg(netz, I.A, I.D), [I.A, I.B, I.C, I.D]);
  assert.deepEqual(kuerzesterWeg(netz, I.A, I.B), [I.A, I.B]);
  assert.deepEqual(kuerzesterWeg(netz, I.A, I.A), [I.A]);
  assert.deepEqual(kuerzesterWeg(netz, I.A, I.E), [], "unerreichbar");
});

test("abstaende misst vom Startpunkt aus", () => {
  const d = abstaende(netz, I.A);
  assert.equal(d.get(I.A), 0);
  assert.equal(d.get(I.B), 1);
  assert.equal(d.get(I.D), 3);
  assert.equal(d.has(I.E), false, "Unerreichbares fehlt");
});

// ── Ein Zug ──────────────────────────────────────────────────────────────────

test("pruefeSchritt nimmt nur echte Mitspieler an", () => {
  const e = pruefeSchritt(netz, [I.A], I.B, I.D);
  assert.equal(e.ok, true);
  assert.equal(e.station.club, "FC Bayern München");
  assert.equal(e.schliesst, false, "B ist noch kein Mitspieler von D");
});

test("pruefeSchritt erkennt den letzten Schritt", () => {
  assert.equal(pruefeSchritt(netz, [I.A, I.B], I.C, I.D).schliesst, true, "C spielte mit D");
});

test("pruefeSchritt weist ab, was nicht geht", () => {
  assert.equal(pruefeSchritt(netz, [I.A], I.C, I.D).fehler, "kein-mitspieler");
  assert.match(pruefeSchritt(netz, [I.A, I.B], I.B, I.D).fehler, /schon/);
  assert.match(pruefeSchritt(netz, [I.A], I.D, I.D).fehler, /schon/, "das Ziel nennt man nicht selbst");
  assert.match(pruefeSchritt(netz, [I.A], null, I.D).fehler, /Pool/);
});

// ── Teilen ───────────────────────────────────────────────────────────────────

test("shareText verrät die Länge, nicht den Weg", () => {
  const t = shareText(7, "Ronaldinho", "Jordan Henderson", 3, 3, "u");
  assert.match(t, /Sechs Ecken #7/);
  assert.match(t, /Ronaldinho → Jordan Henderson/);
  assert.match(t, /Bestweg/);
  assert.ok(!/Dani Alves/.test(t), "kein Zwischenschritt darf im Text stehen");
  assert.match(shareText(7, "A", "B", 5, 3, "u"), /5 Schritte \(Bestweg 3\)/);
  assert.match(shareText(7, "A", "B", null, 3, "u"), /aufgegeben/);
});

// ── Echtdaten ────────────────────────────────────────────────────────────────

test("Echtdaten: das Netz ist dicht und schnell gebaut", async () => {
  const { PLAYERS } = await import("./players.js");
  const { CAREER_PATH_CLUBS, CAREER_PATH_BY_KEY } = await import("./careerPathClubs.js");
  const echt = baueNetz(PLAYERS, { clubs: CAREER_PATH_CLUBS, byKey: CAREER_PATH_BY_KEY });
  assert.ok(echt.knoten.length > 800, `nur ${echt.knoten.length} Spieler im Netz`);
  const grade = echt.knoten.map((i) => echt.nachbarn.get(i).size).sort((a, b) => a - b);
  assert.ok(grade[Math.floor(grade.length / 2)] > 20, "der Median der Mitspielerzahl ist zu klein");
});

/* Ein Rätsel ohne Lösung wäre der schlimmste Fehler dieses Modus — anders als bei
   einem Ratespiel merkt man es erst nach Minuten vergeblicher Suche. */
test("Echtdaten: 30 aufeinanderfolgende Tage sind lösbar und der Bestweg stimmt", async () => {
  const { PLAYERS } = await import("./players.js");
  const { CAREER_PATH_CLUBS, CAREER_PATH_BY_KEY } = await import("./careerPathClubs.js");
  const echt = baueNetz(PLAYERS, { clubs: CAREER_PATH_CLUBS, byKey: CAREER_PATH_BY_KEY });
  for (let d = 1; d <= 30; d++) {
    const datum = `2026-09-${String(d).padStart(2, "0")}`;
    const paar = paarDesTages(datum, PLAYERS, echt);
    assert.ok(paar, `${datum}: kein Paar gefunden`);
    const weg = kuerzesterWeg(echt, paar.von, paar.nach);
    assert.ok(weg.length > 1, `${datum}: unlösbar`);
    assert.equal(weg.length - 1, paar.par, `${datum}: par ${paar.par}, echter Weg ${weg.length - 1}`);
    assert.notEqual(paar.von, paar.nach);
  }
});

test("Echtdaten: dasselbe Datum liefert dasselbe Paar", async () => {
  const { PLAYERS } = await import("./players.js");
  const { CAREER_PATH_CLUBS, CAREER_PATH_BY_KEY } = await import("./careerPathClubs.js");
  const echt = baueNetz(PLAYERS, { clubs: CAREER_PATH_CLUBS, byKey: CAREER_PATH_BY_KEY });
  const a = paarDesTages("2026-10-05", PLAYERS, echt);
  const b = paarDesTages("2026-10-05", PLAYERS, echt);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, paarDesTages("2026-10-06", PLAYERS, echt));
});
