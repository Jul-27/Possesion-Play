import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { person, titelJahr, ohneKlammer, siegerSchluessel, setzeTurniertitel, TURNIER_KEYS }
  from "./wikipedia_turniersieger.mjs";
import { COMP_QID } from "./wikidata_honours.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const zeit = (t, rank = "normal") => ({ rank, mainsnak: { datavalue: { value: { time: t } } } });
const geschlecht = (id) => ({ mainsnak: { datavalue: { value: { id } } } });

test("person: beide Labels, alle nicht veralteten Geburtsjahre, Geschlecht", () => {
  const p = person({
    labels: { en: { value: "Pepe" }, de: { value: "Pepe" } },
    claims: {
      P569: [zeit("+1984-02-26T00:00:00Z"), zeit("+1983-02-26T00:00:00Z"), zeit("+1980-01-01T00:00:00Z", "deprecated")],
      P21: [geschlecht("Q6581097")],
    },
  });
  assert.deepEqual([...p.namen], ["Pepe"]);
  assert.deepEqual([...p.jahre].sort(), [1983, 1984]);
  assert.equal(p.weiblich, false);
  assert.equal(person({ claims: { P21: [geschlecht("Q6581072")] } }).weiblich, true);
});

test("titelJahr liest das Geburtsjahr aus dem Klammerzusatz beider Wikipedias", () => {
  assert.equal(titelJahr("Pepe (Fußballspieler, 1983)"), 1983);
  assert.equal(titelJahr("Pepe (footballer, born February 1983)"), 1983);
  assert.equal(titelJahr("Alex (Fußballspieler, Juni 1982)"), 1982);
  assert.equal(titelJahr("Gavi (Fußballspieler)"), null);
  assert.equal(titelJahr("Jorge Acuña (Fußballspieler, I)"), null);
  assert.equal(ohneKlammer("Gavi (Fußballspieler)"), "Gavi");
});

test("siegerSchluessel: Männer über jede Schreibweise und jedes Jahr, Frauen nie", () => {
  const seiten = [
    { qid: "Q1", titel: ["Pepe (Fußballspieler, 1983)", "Pepe (footballer, born February 1983)"] },
    { qid: "Q2", titel: ["Alexandra Popp"] },
    { qid: "Q3", titel: ["Ohne Personendaten"] },
  ];
  const pers = new Map([
    ["Q1", { namen: new Set(["Pepe"]), jahre: new Set([1984]), weiblich: false }],
    ["Q2", { namen: new Set(["Alexandra Popp"]), jahre: new Set([1991]), weiblich: true }],
  ]);
  const s = siegerSchluessel(seiten, pers);
  assert.ok(s.has("pepe|1983"), "Jahr aus dem Titel, obwohl Wikidata nur 1984 führt");
  assert.ok(s.has("pepe|1984"));
  assert.ok(![...s].some((k) => k.startsWith("alexandra popp")));
  assert.equal(s.size, 2);
});

test("setzeTurniertitel setzt neu: fehlende dazu, unbelegte weg, andere Titel bleiben", () => {
  const players = [
    { n: "Ferran Torres", by: 2000, t: ["EM", "MLL", "WM"] },
    { n: "Aymeric Laporte", by: 1994, t: ["MPL"] },
    { n: "Ansu Fati", by: 2002, t: ["EM", "WM"] },
  ];
  const bericht = setzeTurniertitel(players, {
    WM: new Set(["ferran torres|2000", "aymeric laporte|1994"]),
    EM: new Set(["ferran torres|2000", "aymeric laporte|1994"]),
  });
  assert.deepEqual(players[0].t, ["EM", "MLL", "WM"]);
  assert.deepEqual(players[1].t, ["EM", "MPL", "WM"]);
  assert.equal(players[2].t, undefined, "ohne Titel fällt das Feld ganz weg");
  assert.deepEqual(bericht.WM, { dazu: ["Aymeric Laporte (1994)"], weg: ["Ansu Fati (2002)"] });
});

test("nicht genannte Turniere bleiben unberührt", () => {
  const players = [{ n: "Abel Balbo", by: 1966, t: ["CA", "WM"] }];
  setzeTurniertitel(players, { WM: new Set() });
  assert.deepEqual(players[0].t, ["CA"]);
});

test("die Wikidata-Regel vergibt WM, EM und CA nicht mehr", () => {
  for (const k of TURNIER_KEYS) assert.ok(!(k in COMP_QID), `${k} steht noch in COMP_QID`);
  const extra = readFileSync(join(HERE, "wikidata_honours_extra.mjs"), "utf8");
  assert.ok(!/^\s*(EM|CA):\s*\{ qid/m.test(extra), "EM/CA stehen noch in EXPECT");
});

test("die Titel-Rettung holt WM, EM und CA nicht zurück", () => {
  const quelle = readFileSync(join(HERE, "keine_station_verlieren.mjs"), "utf8");
  assert.match(quelle, /for \(const k of TURNIER_KEYS\) widerlegt\.add\(k\)/);
});

test("der Schritt läuft als letzter der Kette", () => {
  const quelle = readFileSync(join(HERE, "refresh_all.mjs"), "utf8");
  const kette = quelle.slice(quelle.indexOf("const CHAIN"), quelle.indexOf("];", quelle.indexOf("const CHAIN")));
  const schritte = [...kette.matchAll(/\["([a-z_]+\.mjs)"/g)].map((m) => m[1]);
  assert.equal(schritte.at(-1), "wikipedia_turniersieger.mjs");
});

/* Am Bestand, Stand 25.09.2026 — gemessen an den Kaderkategorien. */
test("Bestand: Weltmeister 2026 sind genau der Kader, nicht jeder Nationalspieler", async () => {
  const { PLAYERS } = await import("../src/players.js");
  const t = (n, by) => new Set(PLAYERS.find((p) => p.n === n && p.by === by)?.t || []);
  for (const [n, by] of [["Ferran Torres", 2000], ["Aymeric Laporte", 1994], ["Marcos Llorente", 1995], ["Marc Pubill", 2003]]) {
    assert.ok(t(n, by).has("WM"), `${n} ist Weltmeister 2026`);
  }
  for (const [n, by] of [["Ansu Fati", 2002], ["Adama Traoré", 1996], ["José Gayà", 1995], ["Pau Torres", 1997]]) {
    assert.ok(!t(n, by).has("WM"), `${n} stand nicht im Kader`);
  }
  const spanier = PLAYERS.filter((p) => (p.nat || []).includes("ESP") && (p.t || []).includes("WM"));
  assert.ok(spanier.length < 70, `${spanier.length} spanische Weltmeister — 2010 und 2026 hatten zusammen 49`);
  assert.ok(t("Pepe", 1983).has("EM"), "Pepe, Europameister 2016");
  assert.ok(!t("Diego Maradona", 1960).has("CA"), "Maradona gewann die Copa América nie");
  assert.ok(t("Paulo Nunes", 1971).has("CA"), "Copa América 1997, früher als „Sobrevalorado Nunes“ geführt");
});
