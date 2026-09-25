import test from "node:test";
import assert from "node:assert/strict";
import { kandidatenImBestand, entitaet, zuordnen, besterName } from "./finde_doppel.mjs";
import { umschluesseln, umschluesselnText, REGELN, abbildungAus } from "./nebendateien_umschluesseln.mjs";

const sp = (n, by, clubs = [], extra = {}) => ({ n, by, clubs, ...extra });
const paar = (liste) => kandidatenImBestand(liste).map(({ neu, alt }) => [neu.n, alt.n].sort().join(" ↔ "));

test("Kandidaten: Rufname im Vollnamen, gleicher Nachname mit gemeinsamem Verein, Jahrgangsfehler", () => {
  const liste = [
    sp("Falcao", 1986, ["ATM"]), sp("Radamel Falcao", 1986, ["MON"]),
    sp("Jonny Otto", 1994, ["WOL"]), sp("Jonathan Castro Otto", 1994, ["WOL"]),
    sp("Didi", 1928, ["RMA"]), sp("Didi", 1929, ["RMA"]),
    sp("Heung-min Son", 1992, ["TOT"]), sp("Son Heung-min", 1992, []),
  ];
  const p = paar(liste);
  assert.ok(p.includes("Falcao ↔ Radamel Falcao"));
  assert.ok(p.includes("Jonathan Castro Otto ↔ Jonny Otto"));
  assert.ok(p.includes("Didi ↔ Didi"));
  assert.ok(p.includes("Heung-min Son ↔ Son Heung-min"), "vertauschte Reihenfolge");
});

test("Kandidaten: gleicher Nachname ohne gemeinsamen Verein ist kein Paar, anderer Jahrgang auch nicht", () => {
  const liste = [
    sp("Luuk de Jong", 1990, ["PSV"]), sp("Frenkie de Jong", 1997, ["BAR"]),
    sp("Mario Gómez", 1985, ["FCB"]), sp("Papu Gómez", 1988, ["ATA"]),
    sp("Thomas Müller", 1989, ["FCB"]), sp("Gerd Müller", 1945, ["FCB"]),
  ];
  assert.deepEqual(paar(liste), []);
});

const ent = (q, { labels = {}, aliases = {}, jahre = [], dewiki, enwiki } = {}) => [q, entitaet({
  labels: Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, { value: v }])),
  aliases: Object.fromEntries(Object.entries(aliases).map(([k, v]) => [k, v.map((value) => ({ value }))])),
  claims: { P569: jahre.map((j) => ({ rank: "normal", mainsnak: { datavalue: { value: { time: `+${j}-01-01T00:00:00Z` } } } })) },
  sitelinks: { ...(dewiki ? { dewiki: { title: dewiki } } : {}), ...(enwiki ? { enwiki: { title: enwiki } } : {}) },
})];

test("zuordnen: Label vor Alias — Raúl bleibt bei Raúl González, auch wenn Tamudo den Alias trägt", () => {
  const e = new Map([
    ent("Q1", { labels: { en: "Raúl" }, jahre: [1977], dewiki: "Raúl (Fußballspieler)" }),
    ent("Q2", { labels: { en: "Raúl Tamudo" }, aliases: { es: ["Raúl"] }, jahre: [1977] }),
  ]);
  assert.equal(zuordnen(sp("Raúl", 1977), e), "Q1");
  assert.equal(zuordnen(sp("Raúl Tamudo", 1977), e), "Q2");
});

test("zuordnen: nur über den Alias, wenn kein Label passt; Geburtsjahr muss stimmen; mehrdeutig ist null", () => {
  const e = new Map([
    ent("Q3", { labels: { en: "Radamel Falcao" }, aliases: { en: ["Falcao"] }, jahre: [1986] }),
    ent("Q4", { labels: { en: "Falcão" }, jahre: [1977] }),
  ]);
  assert.equal(zuordnen(sp("Falcao", 1986), e), "Q3");
  assert.equal(zuordnen(sp("Falcao", 1990), e), null);
  const zwei = new Map([ent("Q5", { labels: { en: "Neto" }, jahre: [1989] }), ent("Q6", { labels: { pt: "Neto" }, jahre: [1989] })]);
  assert.equal(zuordnen(sp("Neto", 1989), zwei), null);
});

test("zuordnen: der deutsche Artikeltitel zählt als Name, auch mit Klammerzusatz", () => {
  const e = new Map([ent("Q7", { labels: { en: "Fred" }, jahre: [1983], dewiki: "Fred (Fußballspieler, 1983)" })]);
  assert.equal(zuordnen(sp("Fred (Fußballspieler, 1983)", 1983), e), "Q7");
});

test("besterName: deutscher Artikel vor englischem Label, sonst der kürzere Name", () => {
  const [, onana] = ent("Q8", { labels: { en: "Andrcu Onana" }, dewiki: "André Onana" });
  assert.deepEqual(besterName(sp("Andrcu Onana", 1996), sp("André Onana", 1996), onana).p.n, "André Onana",
    "vandaliertes englisches Label verliert gegen den deutschen Artikel");
  const [, fred] = ent("Q9", { labels: { en: "Fred" }, dewiki: "Fred (Fußballspieler, 1983)" });
  const r = besterName(sp("Fred (Fußballspieler, 1983)", 1983), sp("Fred", 1983), fred);
  assert.equal(r.p.n, "Fred");
  assert.equal(r.regel, "dewiki", "der Klammerzusatz zählt nicht zum Namen");
  const [, x] = ent("Q10", { labels: { en: "Pablo Íñiguez de Heredia" } });
  const k = besterName(sp("Pablo Íñiguez de Heredia Larraz", 1994, [], { sl: 20 }), sp("Pablo Iñiguez", 1994, [], { sl: 5 }), x);
  assert.deepEqual([k.p.n, k.regel], ["Pablo Iñiguez", "rufname"]);
  const [, y] = ent("Q11", { labels: { en: "Marcelo Martins Moreno" } });
  const m = besterName(sp("Marcelo Moreno Martins", 1987), sp("Marcelo Martins Moreno", 1987), y);
  assert.deepEqual([m.p.n, m.regel], ["Marcelo Martins Moreno", "en"], "gleiche Namensteile: das Label entscheidet");
});

test("umschluesseln: umbenennen, wo das Ziel fehlt; vereinigen, wo beide stehen", () => {
  const text = [
    "export const CAREER_BY_KEY = {",
    '  "falcao|1986": [1,4],',
    '  "radamel falcao|1986": [4,9],',
    '  "xavi hernandez|1980": [2]',
    "};",
  ].join("\n");
  const abb = new Map([["falcao|1986", "radamel falcao|1986"], ["xavi hernandez|1980", "xavi|1980"]]);
  const r = umschluesseln(text, abb, REGELN["careerClubs.js"]);
  assert.equal(r.umbenannt, 1);
  assert.equal(r.verschmolzen, 1);
  assert.match(r.text, /"radamel falcao\|1986": \[1,4,9\],/);
  assert.match(r.text, /"xavi\|1980": \[2\]\n\};/);
  assert.doesNotMatch(r.text, /"falcao\|1986"/);
});

test("umschluesselnText behandelt jeden export-Block für sich", () => {
  const text = 'export const A = {\n  "a|1": "x.jpg",\n};\nexport const B = {\n  "a|1": "y.jpg",\n  "b|1": "z.jpg",\n};\n';
  const r = umschluesselnText(text, new Map([["a|1", "b|1"]]), REGELN["playerImages.js"]);
  assert.equal(r.text, 'export const A = {\n  "b|1": "x.jpg",\n};\nexport const B = {\n  "b|1": "z.jpg",\n};\n');
});

test("Einsätze: je Verein der größere Wert, Tore ebenso", () => {
  const m = REGELN["appearances.js"]({ ATM: 90, __tore: { ATM: 70 } }, { ATM: 91, MON: 140, __tore: { MON: 83 } });
  assert.deepEqual(m, { ATM: 91, MON: 140, __tore: { ATM: 70, MON: 83 } });
});

test("abbildungAus nutzt byTo, wenn das Jahr korrigiert wird", () => {
  const a = abbildungAus([{ from: "Didi", by: 1929, to: "Didi", byTo: 1928 }]);
  assert.equal(a.get("didi|1929"), "didi|1928");
});

test("kettenAufloesen: jeder zeigt aufs Endziel, doppelte Quellen fallen weg", async () => {
  const { kettenAufloesen } = await import("./finde_doppel.mjs");
  const r = kettenAufloesen([
    { from: "Marcelo da Silva Júnior", by: 1988, to: "Marcelo Vieira" },
    { from: "Marcelo Vieira", by: 1988, to: "Marcelo" },
    { from: "Marcelo da Silva Júnior", by: 1988, to: "Marcelo" },
    { from: "Didi", by: 1929, to: "Didi", byTo: 1928 },
  ]);
  assert.deepEqual(r.map((o) => `${o.from}→${o.to}${o.byTo ? "/" + o.byTo : ""}`).sort(),
    ["Didi→Didi/1928", "Marcelo Vieira→Marcelo", "Marcelo da Silva Júnior→Marcelo"]);
  assert.throws(() => kettenAufloesen([{ from: "A", by: 1, to: "B" }, { from: "B", by: 1, to: "A" }]), /Kreis/);
});

test("ausTiteln: eindeutige ID mit passendem Jahr, sonst null", async () => {
  const { ausTiteln } = await import("./finde_doppel.mjs");
  const ents = new Map([ent("Q1", { jahre: [1986] }), ent("Q2", { jahre: [1986] }), ent("Q3", { jahre: [1970] })]);
  assert.equal(ausTiteln(["Q1", "Q1"], ents, [1986]), "Q1");
  assert.equal(ausTiteln(["Q1", "Q3"], ents, [1986]), "Q1", "falsches Jahr fällt weg");
  assert.equal(ausTiteln(["Q1", "Q2"], ents, [1986]), null, "en und de uneins");
  assert.equal(ausTiteln([], ents, [1986]), null);
});

test("Kandidaten: verschiedene Apostrophe sind derselbe Name", () => {
  assert.deepEqual(paar([sp("Samuel Eto'o", 1981, ["BAR"]), sp("Samuel Eto’o", 1981, ["INT"])]),
    ["Samuel Eto'o ↔ Samuel Eto’o"]);
});

test("kandidatenAusLabels: englisches und deutsches Label derselben Person auf zwei Datensätzen", async () => {
  const { kandidatenAusLabels } = await import("./finde_doppel.mjs");
  const players = [sp("Andriy Yarmolenko", 1989), sp("Andrij Jarmolenko", 1989), sp("Andriy Shevchenko", 1976)];
  const p = kandidatenAusLabels(players, [
    { namen: ["Andriy Yarmolenko", "Andrij Jarmolenko"], by: 1989 },
    { namen: ["Andriy Shevchenko", "Andrij Schewtschenko"], by: 1976 },   // nur einer im Bestand
    { namen: ["Andriy Yarmolenko", "Andrij Jarmolenko"], by: 1990 },      // falsches Jahr
  ]);
  assert.deepEqual(p.map(({ neu, alt }) => `${neu.n} ↔ ${alt.n}`), ["Andrij Jarmolenko ↔ Andriy Yarmolenko"]);
});

test("besterName: eintippbarer Apostroph vor deutschem Artikel, Sperrliste vor allem", async () => {
  const { besterName } = await import("./finde_doppel.mjs");
  const [, eto] = ent("Q12", { labels: { en: "Samuel Eto'o" }, dewiki: "Samuel Eto’o" });
  assert.deepEqual(Object.values(besterName(sp("Samuel Eto’o", 1981), sp("Samuel Eto'o", 1981), eto)).map((x) => x.n ?? x),
    ["Samuel Eto'o", "tippbar"]);
  const [, ito] = ent("Q13", { dewiki: "Jun’ya Itō" });
  assert.equal(besterName(sp("Jun’ya Itō", 1993), sp("Junya Itō", 1993), ito).p.n, "Junya Itō");
  const [, warley] = ent("Q14", { labels: { en: "Zé cuscuz da pimba" } });
  assert.equal(besterName(sp("Warley Silva dos Santos", 1978), sp("Zé cuscuz da pimba", 1978), warley).p.n,
    "Warley Silva dos Santos");
});

test("besterName: ein von Hand gepflegter Zielname wird nie wegbenannt", async () => {
  const { besterName } = await import("./finde_doppel.mjs");
  const [, e] = ent("Q15", { labels: { en: "Javier Hernández" }, dewiki: "Chicharito" });
  const r = besterName(sp("Javier Hernández", 1988), sp("Chicharito", 1988), e, new Set(["Javier Hernández|1988"]));
  assert.deepEqual([r.p.n, r.regel], ["Javier Hernández", "kuratiert"]);
});

test("besterName: ein deutscher Titel mit Vatersnamen verliert gegen den tippbaren Namen", async () => {
  const { besterName } = await import("./finde_doppel.mjs");
  const [, e] = ent("Q16", { labels: { en: "Andrey Arshavin" }, dewiki: "Andrei Sergejewitsch Arschawin" });
  assert.equal(besterName(sp("Andrei Sergejewitsch Arschawin", 1981), sp("Andrey Arshavin", 1981), e).p.n, "Andrey Arshavin");
  const [, f] = ent("Q17", { labels: { en: "Andriy Yarmolenko" }, dewiki: "Andrij Jarmolenko" });
  assert.equal(besterName(sp("Andriy Yarmolenko", 1989), sp("Andrij Jarmolenko", 1989), f).p.n, "Andrij Jarmolenko",
    "ohne Vatersnamen bleibt die deutsche Umschrift");
});
