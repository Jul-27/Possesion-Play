import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alterAm, werte, vergleiche, sichtbareKacheln, vollstaendig, pool, zielDesTages,
  kandidatenListe, vorschlaege, hinweisText, shareGrid, shareText, VERSUCHE, KACHELN,
  MEIDEN_TAGE,
  flagge, keyOf, LIGA_NAME,
} from "./steckbrief.js";

/* Ein kleiner, aber echter Datenschnitt: zwei Ligen, vier Vereine, sechs Spieler.
   Die Felder heißen wie in squads.js — c = Vereinsindex, na = Nationsindex. */
const CLUBS = [["FC Bayern München", "BL"], ["Borussia Dortmund", "BL"],
  ["FC Arsenal", "PL"], ["Manchester City", "PL"]];
const NATIONS = [["DE", "Deutschland"], ["FR", "Frankreich"], ["GB-ENG", "England"]];

const P = {
  neuer:     { n: "Manuel Neuer",   ln: "Neuer",    by: 1986, c: 0, gb: "1986-03-27", nr: 1,  na: 0, po: "TW",  sl: 90 },
  upamecano: { n: "Dayot Upamecano", ln: "Upamecano", by: 1998, c: 0, gb: "1998-10-27", nr: 2, na: 1, po: "ABW", sl: 60 },
  kobel:     { n: "Gregor Kobel",   ln: "Kobel",    by: 1997, c: 1, gb: "1997-12-06", nr: 1,  na: 1, po: "TW",  sl: 40 },
  saka:      { n: "Bukayo Saka",    ln: "Saka",     by: 2001, c: 2, gb: "2001-09-05", nr: 7,  na: 2, po: "ST",  sl: 70 },
  rice:      { n: "Declan Rice",    ln: "Rice",     by: 1999, c: 2, gb: "1999-01-14", nr: 41, na: 2, po: "MF",  sl: 55 },
  luecke:    { n: "Ohne Angaben",   ln: "Angaben",  by: 2004, c: 3, sl: 5 },   // weder gb noch nr
};
const SPIELER = Object.values(P);
const IDX = Object.fromEntries(Object.keys(P).map((k, i) => [k, i]));

const ctx = (mehrere = true) => ({ clubs: CLUBS, nationen: NATIONS, stichtag: "2026-08-22", mehrere });
const kachel = (erg, key) => erg.find((k) => k.key === key);

// ── Alter ────────────────────────────────────────────────────────────────────

test("alterAm rechnet auf den Stichtag, nicht auf das Jahr", () => {
  assert.equal(alterAm(P.neuer, "2026-08-22"), 40, "Geburtstag im März war schon");
  assert.equal(alterAm(P.upamecano, "2026-08-22"), 27, "Geburtstag im Oktober kommt noch");
  assert.equal(alterAm(P.upamecano, "2026-10-27"), 28, "am Geburtstag selbst zählt er");
  assert.equal(alterAm(P.upamecano, "2026-10-26"), 27);
});

test("alterAm schätzt nicht: ohne Geburtsdatum kommt null", () => {
  assert.equal(alterAm(P.luecke, "2026-08-22"), null);
  assert.equal(alterAm({}, "2026-08-22"), null);
});

// ── Kacheln ──────────────────────────────────────────────────────────────────

test("werte löst Vereins- und Nationsindex auf", () => {
  assert.deepEqual(werte(P.saka, ctx()),
    { lg: "PL", club: "FC Arsenal", po: "ST", na: "England", alter: 24, nr: 7 });
});

test("die Liga-Kachel fehlt, wenn der Pool nur eine Liga hat", () => {
  assert.deepEqual(sichtbareKacheln(ctx(true)).map((k) => k.key), KACHELN.map((k) => k.key));
  assert.deepEqual(sichtbareKacheln(ctx(false)).map((k) => k.key),
    ["club", "po", "na", "alter", "nr"], "fünf statt sechs");
});

test("ein Treffer färbt alle sechs Kacheln grün", () => {
  const e = vergleiche(P.saka, P.saka, ctx());
  assert.ok(e.every((k) => k.stand === "treffer"));
  assert.ok(e.every((k) => k.pfeil === null), "beim Treffer zeigt kein Pfeil");
});

test("Vereinstreffer färbt Liga und Verein, nicht mehr", () => {
  const e = vergleiche(P.neuer, P.upamecano, ctx());   // beide FC Bayern
  assert.equal(kachel(e, "lg").stand, "treffer");
  assert.equal(kachel(e, "club").stand, "treffer");
  assert.equal(kachel(e, "po").stand, "daneben");
  assert.equal(kachel(e, "na").stand, "daneben");
});

test("gleiche Liga, anderer Verein: nur die Liga wird grün", () => {
  const e = vergleiche(P.neuer, P.kobel, ctx());       // Bayern vs. Dortmund
  assert.equal(kachel(e, "lg").stand, "treffer");
  assert.equal(kachel(e, "club").stand, "daneben");
  assert.equal(kachel(e, "po").stand, "treffer", "beide Torwart");
  assert.equal(kachel(e, "nr").stand, "treffer", "beide Nummer 1");
});

/* Der Grund für den Pfeil: ohne ihn bliebe die Alterskachel bei fast jedem Versuch
   grau und trüge nichts bei. Der Pfeil zeigt IMMER zum Gesuchten. */
test("das Alter zeigt zum Gesuchten", () => {
  const e = vergleiche(P.neuer, P.saka, ctx());        // Neuer 40, Saka 24
  assert.equal(kachel(e, "alter").pfeil, "runter", "der Gesuchte ist jünger");
  assert.equal(kachel(vergleiche(P.saka, P.neuer, ctx()), "alter").pfeil, "hoch");
});

/* Die Nummer bekommt bewusst KEINEN Pfeil. Zwei Zahlenpfeile machen aus dem Rätsel
   eine binäre Suche: gemessen an 2886 Kandidaten bleiben nach drei Zügen im Median
   4 Kandidaten übrig statt 17. Siehe Kopfkommentar von steckbrief.js. */
test("die Rückennummer bleibt grün oder grau, ohne Richtung", () => {
  const e = vergleiche(P.neuer, P.saka, ctx());        // Nr. 1 gegen Nr. 7
  assert.equal(kachel(e, "nr").stand, "daneben");
  assert.equal(kachel(e, "nr").pfeil, null);
  assert.equal(kachel(vergleiche(P.saka, P.neuer, ctx()), "nr").pfeil, null);
});

test("die genannte Zahl steht auf der Kachel, nicht die gesuchte", () => {
  const e = vergleiche(P.neuer, P.saka, ctx());
  assert.equal(kachel(e, "alter").text, "40", "Neuers Alter — Sakas wäre verraten");
  assert.equal(kachel(e, "nr").text, "1");
});

test("fehlende Angaben bleiben unbekannt und nie grün", () => {
  const e = vergleiche(P.luecke, P.luecke, ctx());
  assert.equal(kachel(e, "alter").stand, "unbekannt", "auch gegen sich selbst nicht grün");
  assert.equal(kachel(e, "alter").text, "?");
  assert.equal(kachel(e, "nr").stand, "unbekannt");
  assert.equal(kachel(e, "club").stand, "treffer", "was da ist, wird trotzdem verglichen");
});

test("Positionskürzel werden ausgeschrieben", () => {
  assert.equal(kachel(vergleiche(P.rice, P.saka, ctx()), "po").text, "Mittelfeld");
});

// ── Pool ─────────────────────────────────────────────────────────────────────

test("vollstaendig verlangt alle vier Zusatzangaben", () => {
  assert.equal(vollstaendig(P.neuer), true);
  assert.equal(vollstaendig(P.luecke), false);
  assert.equal(vollstaendig({ ...P.neuer, nr: null }), false);
  assert.equal(vollstaendig({ ...P.neuer, na: -1 }), false, "na = -1 heißt „keine Nation“");
});

test("pool filtert nach Liga und Vollständigkeit", () => {
  assert.deepEqual(pool(SPIELER, CLUBS), [IDX.neuer, IDX.upamecano, IDX.kobel, IDX.saka, IDX.rice],
    "der Unvollständige fehlt überall");
  assert.deepEqual(pool(SPIELER, CLUBS, ["PL"]), [IDX.saka, IDX.rice]);
  assert.deepEqual(pool(SPIELER, CLUBS, ["BL", "PL"]).length, 5);
});

test("pool: die Bekanntheitsschwelle gilt nur, wo sie gesetzt ist", () => {
  assert.deepEqual(pool(SPIELER, CLUBS, [], 60), [IDX.neuer, IDX.upamecano, IDX.saka]);
  assert.deepEqual(pool(SPIELER, CLUBS, [], 0).length, 5, "ohne Schwelle bleiben alle drin");
});

/* Rendezvous-Hashing statt „Index modulo Tag": die Kader ändern sich wöchentlich, und
   ein Positionsverfahren würde bei jedem Transfer alle künftigen Ziele verschieben. */
test("zielDesTages ist je Datum stabil und wechselt mit dem Tag", () => {
  const k = pool(SPIELER, CLUBS);
  const a = zielDesTages("2026-08-22", SPIELER, k);
  assert.equal(zielDesTages("2026-08-22", SPIELER, k), a, "zweimal derselbe Tag, dasselbe Ziel");
  const tage = new Set(Array.from({ length: 20 }, (_, i) =>
    zielDesTages(`2026-09-${String(i + 1).padStart(2, "0")}`, SPIELER, k)));
  assert.ok(tage.size > 1, "nicht jeden Tag derselbe Spieler");
});

test("zielDesTages überlebt das Entfernen eines anderen Spielers", () => {
  const alle = pool(SPIELER, CLUBS);
  const ziel = zielDesTages("2026-08-22", SPIELER, alle);
  const ohneAnderen = alle.filter((i) => i !== alle.find((x) => x !== ziel));
  assert.equal(zielDesTages("2026-08-22", SPIELER, ohneAnderen), ziel);
});

/* Der Tagestopf ist klein (386 Spieler mit Foto), Wiederholungen häufen sich also.
   Die Sperre schließt sie nicht aus — sie kennt die ungesperrten Vortagssieger, nicht
   deren tatsächliche Ziele — aber sie drückt sie deutlich. Am echten Topf gemessen:
   56 Wiederholungen im Jahr ohne, 16 mit Sperre. Der Test hält die Richtung fest,
   nicht die genaue Zahl. */
test("zielDesTages drückt Wiederholungen und bleibt dabei deterministisch", () => {
  const viele = Array.from({ length: 40 }, (_, i) =>
    ({ n: `Spieler ${i}`, ln: `Spieler ${i}`, by: 1990 + (i % 15), c: 0,
       gb: `${1990 + (i % 15)}-05-05`, nr: (i % 40) + 1, na: 0, po: "MF", sl: 50 }));
  const k = viele.map((_, i) => i);
  const tage = Array.from({ length: 60 }, (_, i) =>
    new Date(Date.parse("2026-09-01") + i * 86400000).toISOString().slice(0, 10));
  const wiederholungen = (ziele, fenster) => ziele.filter((z, i) =>
    ziele.slice(Math.max(0, i - fenster), i).includes(z)).length;

  const ohne = tage.map((d) => zielDesTages(d, viele, k));
  const mit = tage.map((d) => zielDesTages(d, viele, k, 10));
  assert.ok(wiederholungen(mit, 10) < wiederholungen(ohne, 10),
    `Sperre muss helfen: ${wiederholungen(mit, 10)} statt ${wiederholungen(ohne, 10)}`);
  assert.equal(zielDesTages(tage[5], viele, k, 10), mit[5], "zweimal gefragt, dieselbe Antwort");
});

test("zielDesTages fällt auf den vollen Topf zurück, wenn die Sperre ihn leert", () => {
  const zwei = [
    { n: "A", ln: "A", by: 1990, c: 0, gb: "1990-01-01", nr: 1, na: 0, po: "TW", sl: 9 },
    { n: "B", ln: "B", by: 1991, c: 0, gb: "1991-01-01", nr: 2, na: 0, po: "ST", sl: 9 },
  ];
  // 30 Sperrtage bei zwei Kandidaten: beide sind gesperrt, es muss trotzdem eins kommen.
  assert.ok(zielDesTages("2026-09-01", zwei, [0, 1], 30) >= 0);
});

test("zielDesTages liefert -1 statt zu raten, wenn der Pool leer ist", () => {
  assert.equal(zielDesTages("2026-08-22", SPIELER, []), -1);
});

// ── Vorschläge ───────────────────────────────────────────────────────────────

test("vorschlaege bleibt im Pool und lässt Genannte weg", () => {
  const liste = kandidatenListe(SPIELER, pool(SPIELER, CLUBS, ["PL"]));
  assert.deepEqual(vorschlaege(liste, "sa"), [IDX.saka]);
  assert.deepEqual(vorschlaege(liste, "sa", [IDX.saka]), [], "einmal genannt, nicht wieder");
  assert.deepEqual(vorschlaege(liste, "neu"), [], "Neuer ist Bundesliga, nicht im PL-Pool");
});

// ── Hinweis und Teilen ───────────────────────────────────────────────────────

test("hinweisText deckt genau eine Kachel des Gesuchten auf", () => {
  assert.equal(hinweisText("na", P.saka, ctx()), "Nation: England");
  assert.equal(hinweisText("alter", P.saka, ctx()), "Alter: 24");
  assert.equal(hinweisText("lg", P.saka, ctx(false)), null, "was nicht sichtbar ist, wird nicht verraten");
});

test("shareGrid überträgt Treffer und Richtung, nicht die Werte", () => {
  /* Drei Zeilen mit wechselndem Gesuchten — shareGrid kennt das Ziel nicht, es
     überträgt nur, was die Auswertung liefert. So kommen beide Richtungen vor,
     ohne dass der Testdatensatz einen jüngeren Spieler als Saka bräuchte. */
  const zeilen = [vergleiche(P.neuer, P.saka, ctx()), vergleiche(P.saka, P.neuer, ctx()),
    vergleiche(P.saka, P.saka, ctx())];
  const [z1, z2, z3] = shareGrid(zeilen).split("\n");
  assert.equal(z3, "🟩🟩🟩🟩🟩🟩");
  assert.equal([...z1].length, 6, "sechs Kacheln je Zeile");
  assert.ok(z1.includes("🔽"), "Neuer ist älter als Saka");
  assert.ok(z2.includes("🔼"), "Saka ist jünger als Neuer");
  assert.ok(!z1.includes("🔼"), "die Nummer trägt keine Richtung mehr");
});

// ── Flaggen und Schlüssel ────────────────────────────────────────────────────

test("flagge baut Regionalindikatoren aus zwei Buchstaben", () => {
  assert.equal(flagge("DE"), "\u{1F1E9}\u{1F1EA}");
  assert.equal(flagge("de"), "\u{1F1E9}\u{1F1EA}", "Kleinschreibung genauso");
  assert.equal(flagge(null), "", "ohne Code keine Flagge");
});

/* England, Schottland und Wales sind keine ISO-Länder; ihre Flagge braucht die
   Tag-Sequenz aus dem P300-Code. Ohne diesen Zweig stünde in der Premier League
   bei fast jedem zweiten Spieler nichts. */
test("flagge kennt die Untercodes des Vereinigten Königreichs", () => {
  assert.equal(flagge("GB-ENG"), "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}");
  assert.equal([...flagge("GB-WLS")].length, 7, "Fahne, fünf Tags, Abschluss");
});

test("keyOf ist derselbe Schlüssel wie überall im Projekt", () => {
  assert.equal(keyOf({ n: "Vítězslav Jaroš", by: 2001 }), "vitezslav jaros|2001");
  assert.equal(keyOf(null), "");
});

test("LIGA_NAME kommt aus gameData und deckt die Spielligen ab", () => {
  assert.equal(LIGA_NAME.BL, "Bundesliga");
  assert.equal(LIGA_NAME.PL, "Premier League");
  assert.equal(Object.keys(LIGA_NAME).length, 7);
});

test("shareText nennt Versuchszahl, Niederlage und Hinweisnutzung", () => {
  const eine = [vergleiche(P.saka, P.saka, ctx())];
  assert.match(shareText(7, eine, true, "u"), /^Steckbrief #7 1\/8\n/);
  assert.match(shareText(7, eine, false, "u"), /^Steckbrief #7 X\/8\n/);
  assert.match(shareText(7, eine, true, "u", true), /^Steckbrief #7 1\/8 💡\n/);
  assert.equal(VERSUCHE, 8);
});
