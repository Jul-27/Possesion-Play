import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saeubern, zerlegen, deuten, positionenAusFeld, positionsFeld, seitenErgaenzen, UNBEKANNTE_REGELZIELE,
} from "./position_parse.mjs";
import { POSITIONEN, POS_BY_KEY, passtAufPosition, positionsText } from "../src/positions.js";

const pp = (feld) => positionenAusFeld(feld).pp;

test("Vokabular und Regeln zeigen aufeinander", () => {
  assert.deepEqual(UNBEKANNTE_REGELZIELE, [], "eine Regel zeigt auf einen Schlüssel, den es nicht gibt");
  assert.equal(new Set(POSITIONEN.map((p) => p.key)).size, POSITIONEN.length, "doppelter Schlüssel");
  for (const p of POSITIONEN) assert.ok(["TW", "ABW", "MF", "ST"].includes(p.gruppe), p.key);
});

// ── Die echten Schreibweisen aus der Stichprobe ──────────────────────────────

test("dieselbe Position in ihren verschiedenen Schreibweisen", () => {
  for (const s of ["Torwart", "Tor", "Torhüter", "Fußballtorwart"]) assert.deepEqual(pp(s), ["TW"], s);
  for (const s of ["Innenverteidiger", "Innenverteidigung", "Abwehr (Innenverteidiger)", "Vorstopper"]) {
    assert.deepEqual(pp(s), ["IV"], s);
  }
  for (const s of ["Rechtsverteidiger", "Rechter Außenverteidiger", "Rechter Verteidiger"]) {
    assert.deepEqual(pp(s), ["RV"], s);
  }
  assert.deepEqual(pp("Außenverteidigung (links)"), ["LV"]);
  assert.deepEqual(pp("Außenverteidigung"), ["AV"], "ohne Seite bleibt es offen");
});

test("Mittelfeld wird nach Aufgabe unterschieden", () => {
  assert.deepEqual(pp("Defensives Mittelfeld"), ["DM"]);
  assert.deepEqual(pp("Zentrales Mittelfeld"), ["ZM"]);
  assert.deepEqual(pp("Offensives Mittelfeld"), ["OM"]);
  assert.deepEqual(pp("offensives Mittelfeld"), ["OM"], "Kleinschreibung genauso");
  assert.deepEqual(pp("Spielmacher"), ["OM"]);
});

test("Flügel und Spitzen", () => {
  assert.deepEqual(pp("Rechtsaußen"), ["RA"]);
  assert.deepEqual(pp("Rechter Flügel"), ["RA"]);
  assert.deepEqual(pp("Linksaußen"), ["LA"]);
  assert.deepEqual(pp("Flügelspieler"), ["FL"], "ohne Seite offen");
  assert.deepEqual(pp("Mittelstürmer"), ["MS"]);
  assert.deepEqual(pp("Sturmspitze"), ["MS"]);
  assert.deepEqual(pp("Hängende Spitze"), ["HS"]);
});

/* Die Reihenfolge der Regeln trägt die Bedeutung: „Offensives Mittelfeld" enthält
   „Mittelfeld", „Rechter Außenverteidiger" enthält „Außenverteidiger". Stünde der
   allgemeine Begriff zuerst, gewänne er. */
test("der genauere Begriff sticht den allgemeinen", () => {
  assert.deepEqual(pp("Offensives Mittelfeld"), ["OM"], "nicht die grobe Gruppe");
  assert.deepEqual(pp("Rechter Außenverteidiger"), ["RV"], "nicht AV");
  assert.deepEqual(pp("Linker Flügelstürmer"), ["LA"], "nicht FL");
});

// ── Mehrere Positionen ───────────────────────────────────────────────────────

test("Mehrfachpositionen in allen vorkommenden Trennformen", () => {
  assert.deepEqual(pp("Mittelfeldspieler, Stürmer"), [], "zwei grobe Gruppen ergeben nichts Feines");
  assert.deepEqual(pp("Abwehr, Defensives Mittelfeld"), ["DM"], "Wataru Endō");
  assert.deepEqual(pp("Zentrales Mittelfeld<br />Libero"), ["ZM", "LIB"], "Lothar Matthäus");
  assert.deepEqual(pp("Rechter Flügel<br/>Sturm<br/>Offensives Mittelfeld"), ["RA", "OM"], "Lionel Messi");
  assert.deepEqual(pp("Rechtes/Linkes Mittelfeld"), ["RM", "LM"], "Ashley Young");
  assert.deepEqual(pp("Innenverteidiger und Libero"), ["IV", "LIB"]);
});

test("dieselbe Position zweimal genannt zählt einmal", () => {
  assert.deepEqual(pp("Innenverteidiger, Innenverteidigung"), ["IV"]);
});

// ── Müll ─────────────────────────────────────────────────────────────────────

/* Arjen Robbens Feld enthält eine komplette Transfermarkt-Quellenangabe. Ein naives
   Zerteilen an Satzzeichen machte daraus neun „Positionen" wie „url=https:" und
   „4360". Vorlagen müssen VOR dem Trennen raus. */
test("Vorlagen und Fußnoten werden entfernt, nicht zerteilt", () => {
  const robben = "[[Rechtsaußen|Rechter Flügel]]{{Internetquelle |url=https://www.transfermarkt.de/"
    + "arjen-robben/profil/spieler/4360 |titel=Arjen Robben – Spielerprofil {{!}} Transfermarkt"
    + " |werk=transfermarkt.de |abruf=2024-03-23}}";
  const e = positionenAusFeld(robben);
  assert.deepEqual(e.pp, ["RA"]);
  assert.deepEqual(e.unbekannt, [], "kein Vorlagenrest darf als Position durchgehen");
});

test("Fußnoten und Kommentare stören nicht", () => {
  assert.deepEqual(pp("Innenverteidiger<ref name=\"kicker\" />"), ["IV"]);
  assert.deepEqual(pp("Sturm<!-- laut Vereinsseite -->"), []);
});

test("Wikilinks liefern den Anzeigenamen", () => {
  assert.deepEqual(pp("[[Mittelfeldspieler#Defensives Mittelfeld|Defensives Mittelfeld]]"), ["DM"]);
  assert.deepEqual(pp("[[Torwart (Fußball)|Torwart]]"), ["TW"]);
});

test("Unverständliches wird gemeldet statt geraten", () => {
  const e = positionenAusFeld("Kapitän, Innenverteidiger");
  assert.deepEqual(e.pp, ["IV"]);
  assert.deepEqual(e.unbekannt, ["Kapitän"]);
});

test("grob unterscheidet sich von leer", () => {
  assert.equal(positionenAusFeld("Sturm").grob, true, "nur eine grobe Gruppe");
  assert.equal(positionenAusFeld("").grob, false, "gar nichts ist nicht grob");
  assert.equal(positionenAusFeld("Mittelstürmer").grob, false, "eine feine Position ist nicht grob");
});

test("positionsFeld findet das Feld in der Infobox", () => {
  const box = "{{Infobox Fußballspieler\n| kurzname = X\n| position = Innenverteidiger\n| nummer = 4\n}}";
  assert.equal(positionsFeld(box).trim(), "Innenverteidiger");
  assert.equal(positionsFeld("{{Infobox Fußballspieler\n| kurzname = X\n}}"), null);
});

// ── Die Brücke zum Spiel ─────────────────────────────────────────────────────

test("eine feine Position erfüllt ihre grobe Gruppe", () => {
  for (const p of POSITIONEN) assert.ok(POS_BY_KEY[p.key].gruppe, p.key);
  assert.equal(POS_BY_KEY.IV.gruppe, "ABW");
  assert.equal(POS_BY_KEY.OM.gruppe, "MF");
  assert.equal(POS_BY_KEY.RA.gruppe, "ST");
});

test("passtAufPosition: feine Angabe schlägt die grobe", () => {
  assert.equal(passtAufPosition(["IV"], "IV", "ABW"), true);
  assert.equal(passtAufPosition(["IV"], "LV", "ABW"), false, "Innen ist nicht außen");
  assert.equal(passtAufPosition(["IV", "DM"], "DM", "ABW"), true, "auch die Alternativposition zählt");
});

/* Die Quelle lässt die Seite oft weg. Wer „Linksverteidiger" sucht und nur
   seitengenaue Angaben zählt, verliert jeden, bei dem bloß „Außenverteidiger"
   steht — das ist die Mehrheit. */
test("passtAufPosition: die seitenlose Angabe deckt beide Seiten", () => {
  assert.equal(passtAufPosition(["AV"], "LV"), true);
  assert.equal(passtAufPosition(["AV"], "RV"), true);
  assert.equal(passtAufPosition(["AV"], "IV"), false, "aber nicht die Mitte");
  assert.equal(passtAufPosition(["FL"], "RA"), true);
  assert.equal(passtAufPosition(["AM"], "LM"), true);
  assert.equal(passtAufPosition(["LV"], "AV"), false, "umgekehrt nicht: links ist nicht „irgendaußen“");
});

test("passtAufPosition: ohne feine Angabe zählt die grobe Gruppe", () => {
  assert.equal(passtAufPosition(null, "IV", "ABW"), true, "Spieler ohne Wikipedia-Artikel bleiben spielbar");
  assert.equal(passtAufPosition([], "IV", "ABW"), true);
  assert.equal(passtAufPosition(null, "IV", "MF"), false);
  assert.equal(passtAufPosition(null, "IV", null), false);
  assert.equal(passtAufPosition(["IV"], "gibtsnicht", "ABW"), false);
});

test("positionsText zeigt die feinen Positionen, sonst die Gruppe", () => {
  assert.equal(positionsText(["IV", "DM"]), "Innenverteidiger · Defensives Mittelfeld");
  assert.equal(positionsText([], "Abwehr"), "Abwehr");
  assert.equal(positionsText(null, null), "");
});

/* „Rechtes/Linkes Mittelfeld": beim Trennen am Schrägstrich bleibt vom ersten Teil
   nur „Rechtes" übrig. Ohne Ergänzung stand Ashley Young nur als linkes Mittelfeld
   in den Daten — die halbe Angabe fiel weg. */
test("verkürzte Seitenangaben bekommen ihr Substantiv zurück", () => {
  assert.deepEqual(seitenErgaenzen(["Rechtes", "Linkes Mittelfeld"]), ["Rechtes Mittelfeld", "Linkes Mittelfeld"]);
  assert.deepEqual(seitenErgaenzen(["Links", "Rechtsverteidiger"]), ["Links verteidiger", "Rechtsverteidiger"]);
  assert.deepEqual(seitenErgaenzen(["Rechter"]), ["Rechter"], "ohne Folgestück bleibt es, wie es ist");
  assert.deepEqual(seitenErgaenzen(["Innenverteidiger", "Libero"]), ["Innenverteidiger", "Libero"]);
});

/* Aus dem vollen Lauf über 31.565 Spieler: Schreibweisen, die zunächst durchfielen. */
test("die Klammerform des Mittelfelds wird erkannt", () => {
  assert.deepEqual(pp("Mittelfeld (defensiv)"), ["DM"]);
  assert.deepEqual(pp("Mittelfeldspieler (defensiv)"), ["DM"]);
  assert.deepEqual(pp("Mittelfeld (offensiv)"), ["OM"]);
  assert.deepEqual(pp("Mittelfeldspieler (offensiv)"), ["OM"]);
  assert.deepEqual(pp("Mittelfeld (zentral)"), ["ZM"]);
  assert.deepEqual(pp("Mittelfeld (links)"), ["LM"]);
});

/* „Außenläufer" ist die Position des WM-Systems und entspricht heute dem äußeren
   Mittelfeld. Kam 72-mal vor, in drei Schreibweisen. */
test("der historische Außenläufer landet im äußeren Mittelfeld", () => {
  assert.deepEqual(pp("Außenläufer"), ["AM"]);
  assert.deepEqual(pp("Außenläufer (links)"), ["LM"]);
  assert.deepEqual(pp("Außenläufer (rechts)"), ["RM"]);
});

/* Kompakte Infoboxen schreiben mehrere Parameter in eine Zeile. Der nachfolgende
   Parametername landete dadurch als Scheinposition im Ergebnis — 75-mal. */
test("Infobox-Parameter in derselben Zeile sind keine Positionen", () => {
  const e = positionenAusFeld("Sturm | jugendvereine_tabelle =");
  assert.deepEqual(e.pp, []);
  assert.deepEqual(e.unbekannt, [], "der Parametername darf nicht als Lücke gemeldet werden");
  assert.equal(e.grob, true);
});

test("der Platzhalter ABFRAGE_WIKIDATA wird still verworfen", () => {
  const e = positionenAusFeld("ABFRAGE_WIKIDATA");
  assert.deepEqual(e.pp, []);
  assert.deepEqual(e.unbekannt, [], "kein Fehler, nur nichts zu holen");
});

test("weibliche Formen sind grobe Gruppen, keine Unbekannten", () => {
  for (const s of ["Stürmerin", "Mittelfeldspielerin", "Abwehrspielerin", "Torhüterin"]) {
    assert.deepEqual(positionenAusFeld(s).unbekannt, [], s);
  }
  assert.deepEqual(pp("Torhüterin"), ["TW"], "Torfrauen haben sehr wohl eine Position");
});

/* Kleiner Schwanz aus dem zweiten vollen Lauf — zusammen rund 30 Spieler. */
test("die Klammerform gibt es auch ohne „Außen“", () => {
  assert.deepEqual(pp("Verteidigung (links)"), ["LV"]);
  assert.deepEqual(pp("Verteidiger (rechts)"), ["RV"]);
  assert.deepEqual(pp("Außensturm"), ["FL"]);
});
