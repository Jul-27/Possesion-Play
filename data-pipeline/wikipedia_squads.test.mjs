import { test } from "node:test";
import assert from "node:assert/strict";
import { waehleAbschnitt, parseZeilen, seitJahr, saisonAus, mergeKader, KADER_MIN, KADER_MAX } from "./wikipedia_squads.mjs";

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
