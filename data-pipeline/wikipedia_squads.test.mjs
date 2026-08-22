import { test } from "node:test";
import assert from "node:assert/strict";
import { waehleAbschnitt, parseZeilen, parseDatum, kaderTabellen, istGeburtsdatum, ohneKlammer, seitJahr, saisonAus, mergeKader, KADER_MIN, KADER_MAX } from "./wikipedia_squads.mjs";

// Abschnittsliste wie sie die Wikipedia-API liefert (index/line/number)
const sec = (num, line) => ({ index: String(num).replace(/\D/g, "") || "1", number: num, line });

/* Der teuerste Fehler in diesem Skript wäre der falsche Abschnitt. Beim VfB heißt der
   Kader der ZWEITEN Mannschaft schlicht „Kader in der Saison 2026/27" — am Titel allein
   nicht von einem Profikader zu unterscheiden. Erkennbar ist er nur an der
   Elternüberschrift. Genau daran ist eine frühere Fassung gescheitert. */
test("Zweitmannschafts-Kader wird über die Elternüberschrift ausgeschlossen", () => {
  const s = [
    sec("5", "Profimannschaft"), sec("5.1", "Profikader 2026/27"),
    sec("6", "Zweite Mannschaft"), sec("6.1", "Kader in der Saison 2026/27"),
  ];
  assert.equal(waehleAbschnitt(s).line, "Profikader 2026/27");
});

test("Frauen- und Jugendkader werden ausgeschlossen", () => {
  const s = [
    sec("1", "Frauenfußball"), sec("1.1", "Kader 2026/27"),
    sec("2", "Junioren"), sec("2.1", "Kader der Saison 2026/27"),
    sec("3", "Erste Mannschaft"), sec("3.1", "Aktueller Kader 2026/27"),
  ];
  assert.equal(waehleAbschnitt(s).line, "Aktueller Kader 2026/27");
});

test("„Kaderpolitik“ ist kein Kader", () => {
  const s = [sec("1", "Kaderpolitik"), sec("2", "Kader der Profimannschaft (2026/27)")];
  assert.equal(waehleAbschnitt(s).line, "Kader der Profimannschaft (2026/27)");
});

test("abweichende Überschriften werden trotzdem gefunden", () => {
  // Leverkusen heißt „Mannschaftskader“, PSV „Eredivisie-Kader 2025/26“.
  assert.equal(waehleAbschnitt([sec("1", "Profimannschaft"), sec("1.1", "Mannschaftskader")]).line, "Mannschaftskader");
  assert.equal(waehleAbschnitt([sec("1", "Eredivisie-Kader 2025/26")]).line, "Eredivisie-Kader 2025/26");
});

test("ohne Kaderabschnitt kommt null statt eines beliebigen Treffers", () => {
  assert.equal(waehleAbschnitt([sec("1", "Geschichte"), sec("2", "Stadion")]), null);
});

test("ein Override sticht die Automatik", () => {
  const s = [sec("1", "Kader A"), sec("2", "Kader B")];
  assert.equal(waehleAbschnitt(s, "Kader B").line, "Kader B");
  assert.equal(waehleAbschnitt(s, "Gibt es nicht"), null, "ein falscher Override darf nicht still auf die Automatik zurückfallen");
});

test("saisonAus liest das Startjahr aus der Überschrift", () => {
  assert.equal(saisonAus("Kader 2026/27"), 2026);
  assert.equal(saisonAus("Kader der Saison 2025/26"), 2025);
  assert.equal(saisonAus("Aktueller Kader", 2026), 2026, "ohne Jahr gilt das laufende");
});

test("parseZeilen liefert je Tabellenzeile Artikel und Jahreszahlen", () => {
  const html = `<table><tr><td>27</td><td><a href="/wiki/Kroatien">Kroatien</a></td>
    <td><a href="/wiki/Andrej_Kramari%C4%87">Andrej Kramarić</a></td><td>19. Juni 1991</td><td>2016</td></tr></table>`;
  const z = parseZeilen(html);
  assert.equal(z.length, 1);
  assert.deepEqual(z[0].titel, ["Kroatien", "Andrej Kramarić"], "Titel werden URL-dekodiert");
  assert.deepEqual(z[0].jahre, [1991, 2016]);
});

test("parseZeilen überspringt Zeilen ohne Verlinkung und Namensraum-Links", () => {
  const html = `<tr><td>Kopfzeile</td></tr><tr><td><a href="/wiki/Datei:Foo.png">x</a></td></tr>`;
  assert.deepEqual(parseZeilen(html), []);
});

/* ── Rückennummer, Nation, Position, Geburtsdatum ────────────────────────────
   Die Zeilen unten sind gekürzte, aber unveränderte Ausschnitte aus de.wikipedia
   (Stand 21.08.2026). Sie decken die drei Eigenheiten ab, an denen eine naive
   Fassung scheitert: unsichtbare Sortier-Spans, die per rowspan fehlende
   Positionsspalte und Vereine mit zusätzlichen Zahlenspalten. */
const FLAGGE = (land) => `<td><span style="display:none;">${land}</span><span typeof="mw:File">`
  + `<a href="/wiki/${land}" title="${land}"><img alt="" class="mw-file-element" /></a></span></td>`;

test("parseZeilen liest Nummer, Nation, Position und Geburtsdatum", () => {
  const html = `<tr><td data-sort-value="1" rowspan="2"><b>Tor</b></td>`
    + `<td><span style="visibility:hidden;">0</span>1</td>${FLAGGE("Deutschland")}`
    + `<td style="text-align:left"><a href="/wiki/Manuel_Neuer">Manuel Neuer</a></td>`
    + `<td style="text-align:right">27.&#160;März 1986</td><td>2011</td><td>2027</td></tr>`;
  const [z] = parseZeilen(html);
  assert.equal(z.nr, 1, "der versteckte Sortier-Span macht aus 1 kein 01");
  assert.equal(z.nation, "Deutschland");
  assert.equal(z.gruppe, "TW");
  assert.equal(z.geb, "1986-03-27");
});

test("parseZeilen trägt die Positionsgruppe über rowspan-Zeilen hinweg mit", () => {
  const html = `<tr><td rowspan="2"><b>Abwehr</b></td><td>4</td>${FLAGGE("Frankreich")}`
    + `<td><a href="/wiki/Dayot_Upamecano">Dayot Upamecano</a></td><td>27. Oktober 1998</td></tr>`
    + `<tr><td>2</td>${FLAGGE("Israel")}<td><a href="/wiki/Sacha_Boey">Sacha Boey</a></td>`
    + `<td>13. September 2000</td></tr>`;
  const z = parseZeilen(html);
  assert.deepEqual(z.map((r) => r.gruppe), ["ABW", "ABW"]);
  assert.deepEqual(z.map((r) => r.nr), [4, 2]);
});

/* Dortmund schiebt „BL-Spiele" und „Tore" zwischen Name und Beitrittsjahr. Beide
   Spalten sind einstellig bis dreistellig — eine Nummernsuche über die ganze Zeile
   würde dort die Torzahl als Rückennummer eintragen. Anker ist die Flaggenspalte. */
test("parseZeilen nimmt nur die Zahl VOR der Flagge als Rückennummer", () => {
  const html = `<tr><td rowspan="4"><b>Sturm</b></td><td>9</td>${FLAGGE("Deutschland")}`
    + `<td><a href="/wiki/Serhou_Guirassy">Serhou Guirassy</a></td><td>12.3.1996</td>`
    + `<td>34</td><td>21</td><td>2024</td></tr>`;
  const [z] = parseZeilen(html);
  assert.equal(z.nr, 9, "34 Spiele und 21 Tore dürfen die Nummer nicht überschreiben");
  assert.equal(z.geb, "1996-03-12", "auch die rein numerische Schreibweise");
});

test("parseZeilen liefert null statt geratener Werte, wenn Spalten fehlen", () => {
  const html = `<tr><td><a href="/wiki/Erling_Haaland">Erling Haaland</a></td></tr>`;
  const [z] = parseZeilen(html);
  assert.deepEqual([z.nr, z.nation, z.geb], [null, null, null]);
});

/* Spanische, italienische und englische Vereine verlinken die Position je Zeile
   („[[Torwart|TW]]") statt sie als Gruppenüberschrift zu setzen. Ohne diesen Zweig
   stand die halbe Primera División ohne Position da. */
test("parseZeilen liest die Position auch aus dem verlinkten Positionsartikel", () => {
  const html = `<tr><td>1</td>${FLAGGE("Italien")}<td><a href="/wiki/Torwart">TW</a></td>`
    + `<td class="fn"><a href="/wiki/Elia_Caprile">Elia Caprile</a></td></tr>`
    + `<tr><td>4</td>${FLAGGE("Spanien")}<td><a href="/wiki/Abwehrspieler">AB</a></td>`
    + `<td class="fn"><a href="/wiki/Pau_Cubars%C3%AD">Pau Cubarsí</a></td></tr>`;
  assert.deepEqual(parseZeilen(html).map((z) => z.gruppe), ["TW", "ABW"]);
});

/* Sergio Herrera (Osasuna) hat keinen deutschen Artikel — sein Name steht hinter
   einem Rotlink. Vor dieser Erweiterung fehlten dadurch ganze Kader aus Spanien und
   Portugal, weil in ihren Zeilen kein einziger /wiki/-Spielerlink steckt. */
test("parseZeilen sammelt die Namen hinter Rotlinks", () => {
  const html = `<tr><td>1</td>${FLAGGE("Spanien")}`
    + `<td><a href="/w/index.php?title=Sergio_Herrera&amp;action=edit&amp;redlink=1" class="new"`
    + ` title="Sergio Herrera (Seite nicht vorhanden)">Sergio Herrera</a></td>`
    + `<td data-sort-value="5.6.1993">5.&#160;Juni 1993</td></tr>`;
  const [z] = parseZeilen(html);
  assert.deepEqual(z.rot, ["Sergio Herrera"]);
  assert.deepEqual(z.titel, ["Spanien"], "der Rotlink taucht nicht als Artikel auf");
  assert.equal(z.geb, "1993-06-05");
});

/* Zwei Layouts, ein Verfahren: Köln hängt Abgänge und Trainerstab als eigene Tabellen
   an (nur die erste ist der Kader), Villarreal und Cagliari verteilen den Kader auf
   zwei nebeneinanderstehende Tabellen (beide gehören dazu). Unterschieden wird am
   Inhalt — Kaderzeilen tragen Nummer und Flagge, Abgangszeilen nicht. */
const KADERZEILE = (nr, land, name) =>
  `<tr><td>${nr}</td>${FLAGGE(land)}<td><a href="/wiki/${name.replace(/ /g, "_")}">${name}</a></td></tr>`;
const ABGANGSZEILE = (name, verein) =>
  `<tr><td><a href="/wiki/${name.replace(/ /g, "_")}">${name}</a></td><td><a href="/wiki/${verein}">${verein}</a></td></tr>`;

test("kaderTabellen nimmt fortlaufende Kadertabellen und hört bei den Abgängen auf", () => {
  const kader = (n, ab) => "<table>" + Array.from({ length: n }, (_, i) =>
    KADERZEILE(ab + i, "Spanien", `Spieler ${ab + i}`)).join("") + "</table>";
  const abgaenge = "<table>" + Array.from({ length: 5 }, (_, i) =>
    ABGANGSZEILE(`Weg ${i}`, "FC Bologna")).join("") + "</table>";

  assert.equal(kaderTabellen(kader(14, 1) + kader(13, 15)).length, 27, "zwei Hälften eines Kaders");
  assert.equal(kaderTabellen(kader(28, 1) + abgaenge).length, 28, "Abgänge bleiben draußen");
  assert.equal(kaderTabellen(abgaenge).length, 0, "ohne Kadertabelle nichts");
});

test("parseDatum kennt volle und abgekürzte Monatsnamen und weist Unsinn ab", () => {
  assert.equal(parseDatum("3. August 1988"), "1988-08-03");
  assert.equal(parseDatum("6. Dez. 1997"), "1997-12-06");
  assert.equal(parseDatum("29.7.2001"), "2001-07-29");
  assert.equal(parseDatum("im Verein seit 2016"), null);
  assert.equal(parseDatum("13.13.1990"), null, "Monat 13 gibt es nicht");
});

/* Eine Kaderzeile enthält Geburtsjahr, Beitrittsjahr und oft das Vertragsende
   (Neuer: 1986 · 2011 · 2027). Das Geburtsjahr kennen wir aus Wikidata. */
test("seitJahr trennt Beitrittsjahr von Geburtsjahr und Vertragsende", () => {
  assert.equal(seitJahr([1986, 2011, 2027], 1986, 2026), 2011, "Neuer");
  assert.equal(seitJahr([1991, 2016], 1991, 2026), 2016, "Kramarić, ohne Vertragsspalte");
  assert.equal(seitJahr([2001, 2023, 2028], 2001, 2026), 2023, "Stiller, Vertrag in der Zukunft");
});

test("seitJahr fällt auf die Saison zurück, wenn kein Jahr taugt", () => {
  assert.equal(seitJahr([2005], 2005, 2026), 2026, "nur das Geburtsjahr in der Zeile");
  assert.equal(seitJahr([], 2000, 2026), 2026);
  assert.equal(seitJahr([2010], 2005, 2026), 2026, "mit 5 Jahren im Profikader — verworfen");
});

test("seitJahr nimmt den Neuzugang der laufenden Saison", () => {
  assert.equal(seitJahr([2004, 2026, 2030], 2004, 2026), 2026);
});

test("mergeKader ergänzt Verein und Zeitraum bei vorhandenen Spielern", () => {
  const players = [{ n: "Andrej Kramaric", ln: "Kramaric", by: 1991, nat: ["CRO"], clubs: ["LEI"], cp: [["LEI", 2015, 2016]] }];
  const r = mergeKader(players, "TSG", [{ n: "Andrej Kramaric", by: 1991, sl: 54, nat: "CRO", pos: "ST", seit: 2016 }]);
  assert.deepEqual(r, { neu: 0, vereinErgaenzt: 1, cpErgaenzt: 1, cpRepariert: 0, schonDa: 0 });
  assert.deepEqual(players[0].clubs, ["LEI", "TSG"]);
  assert.deepEqual(players[0].cp, [["LEI", 2015, 2016], ["TSG", 2016, 0]]);
});

/* Wikidata datiert genauer als eine Kadertabelle: steht dort bereits ein Zeitraum für
   diesen Verein, bleibt er unangetastet. Sonst überschriebe der Kaderlauf jedes Jahr
   echte Anfangsjahre mit dem Saisonjahr. */
test("mergeKader fasst vorhandene Zeiträume desselben Vereins nicht an", () => {
  const players = [{ n: "Oliver Baumann", ln: "Baumann", by: 1990, nat: ["GER"], clubs: ["TSG"], cp: [["TSG", 2014, 0]] }];
  const r = mergeKader(players, "TSG", [{ n: "Oliver Baumann", by: 1990, sl: 39, nat: "GER", pos: "TW", seit: 2026 }]);
  assert.deepEqual(r, { neu: 0, vereinErgaenzt: 0, cpErgaenzt: 0, cpRepariert: 0, schonDa: 1 });
  assert.deepEqual(players[0].cp, [["TSG", 2014, 0]]);
});

test("mergeKader legt unbekannte Spieler mit allen Feldern an", () => {
  const players = [];
  const r = mergeKader(players, "TSG", [{ n: "Fisnik Asllani", by: 2002, sl: 16, nat: null, pos: "ST", seit: 2025 }]);
  assert.equal(r.neu, 1);
  assert.deepEqual(players[0], {
    n: "Fisnik Asllani", ln: "Asllani", by: 2002, nat: [], clubs: ["TSG"], sl: 16, pos: "ST", cp: [["TSG", 2025, 0]],
  });
});

test("mergeKader überschreibt vorhandene Position und Nation nicht", () => {
  const players = [{ n: "X Y", ln: "Y", by: 1995, nat: ["GER"], clubs: [], pos: "MF", sl: 20 }];
  mergeKader(players, "TSG", [{ n: "X Y", by: 1995, sl: 99, nat: "BRA", pos: "ST", seit: 2026 }]);
  assert.deepEqual(players[0].nat, ["GER"]);
  assert.equal(players[0].pos, "MF");
  assert.equal(players[0].sl, 20);
});

test("mergeKader unterscheidet Namensvettern über das Geburtsjahr", () => {
  const players = [{ n: "Kristjan Asllani", ln: "Asllani", by: 2002, nat: ["ALB"], clubs: ["INT"] }];
  const r = mergeKader(players, "TSG", [{ n: "Fisnik Asllani", by: 2002, sl: 16, nat: null, pos: "ST", seit: 2025 }]);
  assert.equal(r.neu, 1, "Fisnik ist ein anderer Spieler als Kristjan");
  assert.deepEqual(players[0].clubs, ["INT"], "Kristjan bleibt unberührt");
});

test("die Plausibilitätsgrenzen umfassen jeden realen Profikader", () => {
  assert.ok(KADER_MIN <= 18 && KADER_MAX >= 33, `${KADER_MIN}–${KADER_MAX} schließt reale Kader aus`);
});

/* Wikidatas Label ist teils verstümmelt. Ohne die kuratierten Namen legt der Lauf eine
   Dublette neben den bereits korrigierten Datensatz — beim ersten Durchlauf ist genau
   das mit „Calvin Ramsey" passiert, der als zweiter Liverpool-Spieler neben
   „Calvin Ramsay" landete. */
test("Wikidata-Labels werden über NAME_OVERRIDES korrigiert", async () => {
  const { korrigierterName } = await import("./wikipedia_squads.mjs");
  assert.equal(korrigierterName("Calvin Ramsey", 2003), "Calvin Ramsay");
  assert.equal(korrigierterName("Calvin Ramsey", 1990), "Calvin Ramsey", "anderes Geburtsjahr = anderer Spieler");
  assert.equal(korrigierterName("Harry Kane", 1993), "Harry Kane", "unbekannte Namen bleiben unverändert");
});

test("jeder Eintrag aus NAME_OVERRIDES wird auch angewandt", async () => {
  const { korrigierterName } = await import("./wikipedia_squads.mjs");
  const { NAME_OVERRIDES } = await import("./name_overrides.mjs");
  for (const o of NAME_OVERRIDES) {
    assert.equal(korrigierterName(o.from, o.by), o.to, `Override greift nicht: ${o.from} (${o.by})`);
  }
});

test("kuratierte Ausschlüsse kommen nicht über die Kaderliste zurück", async () => {
  const { istAusgeschlossen } = await import("./wikipedia_squads.mjs");
  const { EXCLUDED_PLAYERS } = await import("./name_overrides.mjs");
  for (const x of EXCLUDED_PLAYERS) {
    assert.equal(istAusgeschlossen(x.n, x.by), true, `nicht ausgeschlossen: ${x.n}`);
    for (const a of x.aliases || []) assert.equal(istAusgeschlossen(a, x.by, a), true, `Alias nicht ausgeschlossen: ${a}`);
  }
  assert.equal(istAusgeschlossen("Harry Kane", 1993), false);
});

/* Kadertabellen listen den Trainerstab mit, und fast jeder Trainer ist Ex-Profi —
   der Berufsfilter allein lässt ihn durch. Beim ersten Lauf landeten so Carlos
   Corberán als Valencia-Spieler und Marcelino García Toral als Villarreal-Spieler. */
test("ein Beitrittsjahr kann nie in der Zukunft liegen", () => {
  // Zeile ohne „im Verein seit“: übrig bleibt nur das Vertragsende 2027.
  assert.equal(seitJahr([2007, 2027], 2007, 2026), 2026, "Felipe Chávez, FCB");
  assert.equal(seitJahr([2008, 2027], 2008, 2026), 2026, "Wael Mohya, BMG");
});

test("mergeKader schreibt kein Beitrittsjahr in der Zukunft", () => {
  const players = [];
  mergeKader(players, "FCB", [{ n: "Neu Zugang", by: 2007, sl: 3, nat: null, pos: null, seit: 2027 }], 2026);
  assert.deepEqual(players[0].cp, [["FCB", 2026, 0]]);
});

test("mergeKader repariert ein früher geschriebenes Zukunftsjahr", () => {
  const players = [{ n: "Felipe Chávez", ln: "Chávez", by: 2007, nat: [], clubs: ["FCB"], cp: [["FCB", 2027, 0]] }];
  const r = mergeKader(players, "FCB", [{ n: "Felipe Chávez", by: 2007, sl: 10, nat: null, pos: null, seit: 2026 }], 2026);
  assert.equal(r.cpRepariert, 1);
  assert.deepEqual(players[0].cp, [["FCB", 2026, 0]]);
});

test("mergeKader lässt einen plausiblen Zeitraum aus der Vergangenheit in Ruhe", () => {
  const players = [{ n: "Manuel Neuer", ln: "Neuer", by: 1986, nat: ["GER"], clubs: ["FCB"], cp: [["FCB", 2011, 0]] }];
  const r = mergeKader(players, "FCB", [{ n: "Manuel Neuer", by: 1986, sl: 90, nat: "GER", pos: "TW", seit: 2026 }], 2026);
  assert.equal(r.cpRepariert, 0);
  assert.deepEqual(players[0].cp, [["FCB", 2011, 0]]);
});

/* PSG überschreibt seine Gruppen mit „Torhüter" und „Abwehrspieler". Eine frühere
   Fassung verlangte exakt „Abwehr“ — die Überschrift griff nicht, die Gruppe blieb
   auf Torwart stehen, und 491 Spieler in 20 Vereinen standen als Torhüter in den
   Daten. Der Test hält beide Schreibweisen fest. */
test("Gruppenüberschriften werden in allen gängigen Schreibweisen erkannt", () => {
  const kopf = (wort) => `<tr><th colspan="6">${wort}</th></tr>`;
  const zeile = (nr, name) => `<tr><td>${nr}</td>${FLAGGE("Frankreich")}`
    + `<td><a href="/wiki/${name}">${name}</a></td></tr>`;
  const html = kopf("Torhüter") + zeile(30, "Lucas_Chevalier")
    + kopf("Abwehrspieler") + zeile(2, "Achraf_Hakimi")
    + kopf("Mittelfeldspieler") + zeile(17, "Vitinha")
    + kopf("Angriff") + zeile(10, "Ousmane_Dembele");
  assert.deepEqual(parseZeilen(html).map((z) => z.gruppe), ["TW", "ABW", "MF", "ST"]);
});

/* Beim Link darf NICHT auf Präfixe geprüft werden: Dortmunds Kadertabelle verlinkt
   den vorherigen Verein mit, und „SK Sturm Graz" machte sonst jeden Zugang von dort
   zum Stürmer. */
test("ein verlinkter Verein wird nicht als Position gelesen", () => {
  const html = `<tr><td>9</td>${FLAGGE("Österreich")}`
    + `<td><a href="/wiki/Ein_Spieler">Ein Spieler</a></td>`
    + `<td><a href="/wiki/SK_Sturm_Graz">SK Sturm Graz</a></td></tr>`;
  assert.equal(parseZeilen(html)[0].gruppe, null);
});

/* Manche Tabellen führen „im Verein seit" und „Vertrag bis" ebenfalls tagesgenau, und
   sie stehen mal vor, mal hinter dem Geburtstag. Das erste Datum der Zeile zu nehmen
   ergab Spieler mit Geburtsdatum 2026 — also null Jahre alt. */
test("parseZeilen nimmt das Datum, das ein Profialter ergibt", () => {
  const html = `<tr><td>7</td>${FLAGGE("Israel")}`
    + `<td><a href="/wiki/Anan_Khalaili">Anan Khalaili</a></td>`
    + `<td>18.8.2026</td><td>3. Mai 2004</td></tr>`;
  assert.equal(parseZeilen(html)[0].geb, "2004-05-03", "das Beitrittsdatum steht zuerst");
});

test("istGeburtsdatum grenzt Profialter ein", () => {
  assert.equal(istGeburtsdatum("2004-05-03", 2026), true);
  assert.equal(istGeburtsdatum("2026-08-18", 2026), false, "null Jahre alt");
  assert.equal(istGeburtsdatum("1960-01-01", 2026), false, "66 Jahre alt");
  assert.equal(istGeburtsdatum(null, 2026), false);
});

/* Rotlink-Namen sind Artikeltitel. „Aitor Fernández (Fußballspieler, 1991)" stand so
   im Spiel — 54-mal. */
test("ohneKlammer macht aus dem Artikeltitel einen Namen", () => {
  assert.equal(ohneKlammer("Aitor Fernández (Fußballspieler, 1991)"), "Aitor Fernández");
  assert.equal(ohneKlammer("Stürmer (Fußball)"), "Stürmer");
  assert.equal(ohneKlammer("Harry Kane"), "Harry Kane");
  assert.equal(ohneKlammer("Borussia Mönchengladbach"), "Borussia Mönchengladbach");
});

test("der Positionsartikel wird auch mit Klammerzusatz erkannt", () => {
  const html = `<tr><td>9</td>${FLAGGE("England")}`
    + `<td><a href="/wiki/St%C3%BCrmer_(Fu%C3%9Fball)">ST</a></td>`
    + `<td><a href="/wiki/Liam_Delap">Liam Delap</a></td></tr>`;
  assert.equal(parseZeilen(html)[0].gruppe, "ST");
});
