import { test } from "node:test";
import assert from "node:assert/strict";
import * as K from "./karriere.js";
import { WELT_LIGEN } from "./careerWorld.js";
import { alleLaender } from "./laender.js";

/* Eine kleine Welt mit bekannten Stärken: zwei Länder, je zwei Spielklassen. */
const LIGEN = [
  { key: "XL",  name: "Erste X",  land: "XXX", stufe: 1, plaetze: 18 },
  { key: "XL2", name: "Zweite X", land: "XXX", stufe: 2, plaetze: 18 },
  { key: "YL",  name: "Erste Y",  land: "YYY", stufe: 1, plaetze: 20 },
];
const VEREINE = [
  { key: "SPI", name: "Spitze",     qid: "Q1", lg: "XL"  },
  { key: "MIT", name: "Mittelmaß",  qid: "Q2", lg: "XL"  },
  { key: "KEL", name: "Keller",     qid: "Q3", lg: "XL"  },
  { key: "ZWA", name: "Zweite A",   qid: "Q4", lg: "XL2" },
  { key: "ZWB", name: "Zweite B",   qid: "Q5", lg: "XL2" },
  { key: "AUS", name: "Ausland",    qid: "Q6", lg: "YL"  },
  { key: "OHN", name: "Ohne Daten", qid: "Q7", lg: "XL"  },
];
const STAERKE = { SPI: 93, MIT: 84, KEL: 74, ZWA: 88, ZWB: 71, AUS: 91 };
const welt = K.baueWelt((v) => STAERKE[v.key] ?? NaN, VEREINE, LIGEN);
const v = (key) => welt.vereine.find((x) => x.key === key);

// ── Die Welt ─────────────────────────────────────────────────────────────────

test("Vereine ohne Kaderdaten fallen aus der Welt", () => {
  assert.equal(welt.vereine.length, 6);
  assert.equal(v("OHN"), undefined);
});

/* DER FEHLER, DEN DAS FÄNGT: Ein Zweitligist mit starkem Kader bekäme sonst die
   höchste Rufstufe und damit eine Meisterschaftschance — aus der zweiten Liga
   gewinnt man aber keine Meisterschaft. */
test("die zweite Liga ist bei Stufe zwei gedeckelt", () => {
  assert.equal(v("SPI").stufe, 5, "93 ist Spitzenstufe");
  assert.equal(v("ZWA").stufe, K.STUFE_MAX_2_LIGA, "88 in der zweiten Liga bleibt Stufe 2");
  assert.ok(v("ZWA").staerke > v("MIT").staerke, "obwohl der Kader stärker ist als der des Erstligisten");
  assert.ok(v("MIT").stufe > v("ZWA").stufe);
});

test("die Rufstufe folgt der Stärke", () => {
  assert.ok(v("SPI").stufe > v("MIT").stufe && v("MIT").stufe > v("KEL").stufe);
  assert.equal(K.stufeVon(60), 0, "unter jeder Schwelle ist Stufe null");
});

// ── Entwicklung ──────────────────────────────────────────────────────────────

test("Entwicklungstypen werden im erwarteten Verhältnis gezogen", () => {
  const zufall = K.rng(7);
  const zahl = { frueh: 0, normal: 0, spaet: 0 };
  for (let i = 0; i < 4000; i++) zahl[K.entwicklungstyp(zufall, "ST")]++;
  assert.ok(zahl.frueh / 4000 > 0.07 && zahl.frueh / 4000 < 0.13, `früh ${zahl.frueh}`);
  assert.ok(zahl.spaet / 4000 > 0.07 && zahl.spaet / 4000 < 0.13, `spät ${zahl.spaet}`);
  assert.ok(zahl.normal / 4000 > 0.75);
});

test("Torhüter reifen immer normal", () => {
  const zufall = K.rng(3);
  for (let i = 0; i < 200; i++) assert.equal(K.entwicklungstyp(zufall, "TW"), "normal");
});

test("jung wächst man, alt verliert man", () => {
  const zufall = K.rng(11);
  const schnitt = (typ, alter) => {
    let s = 0;
    for (let i = 0; i < 500; i++) s += K.wachstum(typ, alter, zufall);
    return s / 500;
  };
  for (const typ of ["frueh", "normal", "spaet"]) {
    assert.ok(schnitt(typ, 18) > 0, `${typ} mit 18`);
    assert.ok(schnitt(typ, 36) < 0, `${typ} mit 36`);
    assert.ok(schnitt(typ, 18) > schnitt(typ, 26), `${typ}: mit 18 mehr als mit 26`);
  }
  /* Der Frühentwickler ist mit 18 vorn und mit 26 schon hinten. */
  assert.ok(schnitt("frueh", 18) > schnitt("spaet", 18));
  assert.ok(schnitt("spaet", 26) > schnitt("frueh", 26));
});

test("ein Alter zwischen den Stufen bekommt trotzdem einen Wert", () => {
  const zufall = K.rng(5);
  for (let alter = 16; alter <= 40; alter++)
    assert.equal(typeof K.wachstum("normal", alter, zufall), "number", `Alter ${alter}`);
});

// ── Einsatzzeit ──────────────────────────────────────────────────────────────

/* Wer genau die Anforderung seiner Stufe erfüllt, ist Stammspieler — ein Verein,
   der einen Spieler holt, lässt ihn auch spielen. */
test("wer die Anforderung erfüllt, spielt regelmäßig", () => {
  const genau = K.einsatzAnteil(K.STUFE_MINDEST_OVR[3], 3);
  assert.ok(genau > 0.65, `nur ${(genau * 100).toFixed(0)} % bei genauer Passung`);
  assert.ok(K.einsatzAnteil(K.STUFE_MINDEST_OVR[3] - 8, 3) < 0.35, "acht Punkte darunter ist Bank");
  assert.ok(K.einsatzAnteil(90, 3) > genau);
});

test("die Rolle drückt die Einsatzzeit", () => {
  const o = 80;
  assert.ok(K.einsatzAnteil(o, 3, "stamm") > K.einsatzAnteil(o, 3, "rotation"));
  assert.ok(K.einsatzAnteil(o, 3, "rotation") > K.einsatzAnteil(o, 3, "kader"));
});

// ── Leistung ─────────────────────────────────────────────────────────────────

test("Tore hängen an Position, Stärke und Umfeld", () => {
  const zufall = K.rng(9);
  const schnitt = (pos, ovr, stufe) => {
    let t = 0;
    const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 9, pos }), ovr, rolle: "stamm" };
    for (let i = 0; i < 400; i++) t += K.saisonLeistung(k, stufe, zufall).tore;
    return t / 400;
  };
  const st = schnitt("ST", 84, 4), zm = schnitt("ZM", 84, 4), iv = schnitt("IV", 84, 4);
  assert.ok(st > zm && zm > iv, `${st} / ${zm} / ${iv}`);
  assert.ok(iv > 0.2 && iv < 6, `Innenverteidiger ${iv}`);
  assert.ok(schnitt("ST", 92, 5) > schnitt("ST", 70, 5) * 2, "Stärke muss durchschlagen");
});

test("ein Spitzenstürmer erreicht eine realistische Ausbeute", () => {
  const zufall = K.rng(13);
  const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 9, pos: "ST" }), ovr: 92, rolle: "stamm" };
  let tore = 0, spiele = 0;
  for (let i = 0; i < 300; i++) { const l = K.saisonLeistung(k, 5, zufall); tore += l.tore; spiele += l.spiele; }
  assert.ok(tore / 300 > 14 && tore / 300 < 38, `${(tore / 300).toFixed(1)} Tore je Saison`);
  assert.ok(spiele / 300 > 24, `nur ${(spiele / 300).toFixed(1)} Spiele`);
});

// ── Titel ────────────────────────────────────────────────────────────────────

/* Ein Ligafeld nachbauen. Seit die Meisterschaft IM FELD ausgespielt wird, ist ein
   Verein ohne Gegner sinnlos — er gewänne jede Saison. Die Verteilung unten ist die
   gemessene Bundesliga: zwei Vereine auf Stufe 0, zwei auf 1, zwei auf 2, zwölf auf
   3, vier auf 4 und einer auf 5. */
const BUNDESLIGA_FELD = [2, 2, 2, 12, 4, 1];
const feldAus = (stufen) => ({
  liga: stufen.reduce((s, n, i) => s + n * K.LIGA_GEWICHT[i], 0),
  pokal: stufen.reduce((s, n, i) => s + n * K.POKAL_GEWICHT[i], 0),
});
const blVerein = (stufe) => ({ lg: "BL", stufe, liga: { key: "BL", feld: feldAus(BUNDESLIGA_FELD) } });

test("die Titelchance steigt mit der Rufstufe", () => {
  const zufall = K.rng(21);
  const quote = (verein, key) => {
    let n = 0;
    for (let i = 0; i < 2000; i++) if (K.saisonTitel(verein, zufall).includes(key)) n++;
    return n / 2000;
  };
  assert.ok(quote(blVerein(5), "MBL") > quote(blVerein(3), "MBL"));
  assert.ok(quote(blVerein(3), "MBL") > 0);
  assert.equal(quote(blVerein(0), "MBL"), 0, "Stufe null wird nie Meister");
  assert.ok(quote(blVerein(0), "DFB") > 0, "im Pokal ist auch unten etwas möglich");
});

/* DIE MESSUNG, DIE DEN FEHLER GEFANGEN HÄTTE: Vorher würfelte jeder Verein für sich,
   und die Premier League brachte 5,24 Meister pro Saison hervor. Eine Liga hat einen. */
test("eine Liga vergibt im Mittel genau eine Meisterschaft je Saison", () => {
  const summe = BUNDESLIGA_FELD.reduce((s, anzahl, stufe) =>
    s + anzahl * K.titelAnteil({ stufe, liga: { feld: feldAus(BUNDESLIGA_FELD) } }, "liga"), 0);
  assert.ok(Math.abs(summe - 1) < 1e-9, `Erwartete Meister je Saison: ${summe}`);
});

/* Und die zweite Hälfte der Rückmeldung: Ein Verein wie Mainz — Stufe 3 — darf
   vereinzelt Meister werden, nicht regelmäßig. */
test("ein Mittelfeldverein gewinnt die Meisterschaft nur vereinzelt", () => {
  const anteil = K.titelAnteil(blVerein(3), "liga");
  assert.ok(anteil > 0.005 && anteil < 0.03, `Stufe 3 kommt auf ${(anteil * 100).toFixed(1)} % je Saison`);
  const spitze = K.titelAnteil(blVerein(5), "liga");
  assert.ok(spitze > anteil * 15, `Spitze ${(spitze * 100).toFixed(0)} % vs Mitte ${(anteil * 100).toFixed(1)} %`);
});

/* DER FEHLER, DEN DAS FÄNGT: Ohne Meisterschlüssel je Liga bekäme ein Zweitligist
   oder ein Verein aus Portugal einen Titel, den es bei uns gar nicht gibt. */
test("nur Ligen mit Titelschlüssel vergeben Meisterschaften", () => {
  const zufall = K.rng(4);
  for (const lg of ["BL2", "PL2", "PT", "NL"]) {
    let n = 0;
    for (let i = 0; i < 500; i++) n += K.saisonTitel({ lg, stufe: 5 }, zufall).filter((t) => t.startsWith("M")).length;
    assert.equal(n, 0, `${lg} darf keinen Meistertitel vergeben`);
  }
});

test("Modifikatoren aus Entscheidungen wirken auf die Titelchance", () => {
  const zufall = K.rng(6);
  const quote = (mod) => {
    let n = 0;
    for (let i = 0; i < 2000; i++) if (K.saisonTitel(blVerein(4), zufall, mod).includes("MBL")) n++;
    return n / 2000;
  };
  assert.ok(quote({ liga: 2 }) > quote({}) * 1.4, "Priorität Liga verdoppelt die Chance");
  assert.ok(quote({ liga: 0.5 }) < quote({}));
});

test("den Ballon d'Or gibt es nur ganz oben und selten", () => {
  const zufall = K.rng(8);
  const quote = (ovr) => {
    let n = 0;
    for (let i = 0; i < 2000; i++) n += K.einzelTitel({ ovr }, { tore: 20 }, zufall).length;
    return n / 2000;
  };
  assert.equal(quote(85), 0, "unter 88 gar nicht");
  assert.ok(quote(95) > quote(89) && quote(95) < 0.6, `bei 95: ${quote(95)}`);
});

// ── Marktwert ────────────────────────────────────────────────────────────────

test("der Marktwert steigt streng mit dem Wert", () => {
  let vorher = -1;
  for (let o = 45; o <= 99; o++) {
    const w = K.marktwert(o);
    assert.ok(w >= vorher, `fällt bei ${o}`);
    vorher = w;
  }
  assert.equal(K.marktwert(50), 1e5);
  assert.equal(K.marktwert(99), 2.5e8);
  assert.ok(K.marktwert(72) > K.marktwert(70) && K.marktwert(72) < K.marktwert(75), "dazwischen wird geschätzt");
});

test("Werte werden lesbar geschrieben", () => {
  assert.match(K.werteText(1e5), /Tsd/);
  assert.match(K.werteText(3e7), /Mio/);
});

// ── Entscheidungen ───────────────────────────────────────────────────────────

/* DAS HERZSTÜCK: Jede Option nennt ihre Quote, und die Quote muss stimmen. */
test("eine Option mit Quote trifft sie auch", () => {
  const zufall = K.rng(17);
  const option = { label: "x", chance: 0.6, wirkung: { ovr: 3 }, sonst: { ovr: -2 } };
  const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), ovr: 70 };
  let gelungen = 0;
  for (let i = 0; i < 4000; i++) if (K.entscheide(k, option, zufall).gelungen) gelungen++;
  assert.ok(Math.abs(gelungen / 4000 - 0.6) < 0.03, `gemessen ${(gelungen / 4000).toFixed(3)} statt 0,6`);
});

test("eine Option ohne Quote wirkt sicher", () => {
  const zufall = K.rng(2);
  const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), ovr: 70 };
  const r = K.entscheide(k, { label: "x", wirkung: { ovr: 2 } }, zufall);
  assert.equal(r.gelungen, true);
  assert.equal(r.karriere.ovr, 72);
});

test("Wirkungen greifen und bleiben in den Grenzen", () => {
  const zufall = K.rng(1);
  const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), ovr: 98 };
  assert.equal(K.entscheide(k, { label: "x", wirkung: { ovr: 9 } }, zufall).karriere.ovr, K.OVR_MAX);
  const tief = { ...k, ovr: 41 };
  assert.equal(K.entscheide(tief, { label: "x", wirkung: { ovr: -9 } }, zufall).karriere.ovr, K.OVR_MIN);
  const rolle = K.entscheide(k, { label: "x", wirkung: { rolle: "rotation" } }, zufall);
  assert.equal(rolle.karriere.rolle, "rotation");
  const mod = K.entscheide(k, { label: "x", wirkung: { liga: 2, europa: 0.5 } }, zufall);
  assert.deepEqual(mod.mod, { liga: 2, pokal: 1, europa: 0.5, klasse: 1 });
});

/* Jede Karte muss spielbar sein: mindestens zwei Optionen, jede mit Beschriftung,
   und wo eine Quote steht, muss es auch den Gegenfall geben. */
test("alle Ereigniskarten sind vollständig", () => {
  assert.ok(K.EREIGNISSE.length >= 12, `nur ${K.EREIGNISSE.length} Karten`);
  const keys = K.EREIGNISSE.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length, "doppelte Schlüssel");
  for (const e of K.EREIGNISSE) {
    assert.ok(e.titel && e.text, `${e.key} braucht Titel und Text`);
    assert.ok(e.optionen.length >= 2, `${e.key} braucht eine Wahl`);
    for (const o of e.optionen) {
      assert.ok(o.label, `${e.key}: Option ohne Beschriftung`);
      assert.ok(o.wirkung, `${e.key}/${o.label}: keine Wirkung`);
      if (o.chance !== undefined) {
        assert.ok(o.chance > 0 && o.chance < 1, `${e.key}/${o.label}: unmögliche Quote`);
        assert.ok(o.sonst, `${e.key}/${o.label}: Quote ohne Gegenfall`);
      }
    }
  }
});

test("Ereignisse passen zum Zeitpunkt", () => {
  const zufall = K.rng(23);
  const alt = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), alter: 30, verein: v("SPI") };
  for (let i = 0; i < 300; i++) {
    const e = K.ziehEreignis(alt, zufall);
    assert.notEqual(e.key, "schule", "mit dreißig nicht mehr die Schule");
    assert.notEqual(e.key, "grossvater", "und kein Verbandswechsel mehr");
  }
  const klein = { ...alt, verein: v("KEL") };
  for (let i = 0; i < 300; i++)
    assert.notEqual(K.ziehEreignis(klein, zufall).key, "endspiel", "ohne Spitzenverein kein Endspiel");
});

// ── Angebote ─────────────────────────────────────────────────────────────────

/* DER FEHLER, DEN DAS FÄNGT: Ohne eigene Regel für den Anfang bekäme ein
   Sechzehnjähriger Angebote von Spitzenvereinen — und die zweite Liga, für die wir
   die halbe Datenwelt gebaut haben, käme im Spiel nie vor. */
test("die ersten Angebote kommen aus der Heimat und meist von unten", () => {
  const zufall = K.rng(31);
  for (let i = 0; i < 40; i++) {
    const a = K.jugendAngebote(welt, "XXX", zufall);
    assert.ok(a.length >= 2, "mindestens zwei Angebote");
    for (const x of a) assert.equal(x.liga.land, "XXX", `${x.name} ist nicht aus der Heimat`);
    assert.ok(a.some((x) => x.liga.stufe === 2), "eines muss aus der zweiten Liga sein");
    for (const x of a) assert.ok(x.stufe <= 3, `${x.name}: kein Spitzenverein für einen Jugendlichen`);
  }
});

test("Angebote überspringen nie zwei Stufen", () => {
  const zufall = K.rng(19);
  for (const ovr of [55, 65, 75, 85]) {
    const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), ovr, alter: 24 };
    for (const a of K.angebote(welt, k, zufall))
      assert.ok(a.stufe <= K.hoechsteErreichbareStufe(ovr), `${ovr}: ${a.name} (Stufe ${a.stufe}) ist zu hoch`);
  }
});

test("ab zweiunddreißig werden die Angebote weniger", () => {
  /* Eine breitere Welt als die sechs Vereine oben: Mit dem Angebotsband bleibt dort
     fuer einen 80er nur ein einziger Verein uebrig, und an einem Verein laesst sich
     kein Unterschied in der ANZAHL zeigen. */
  const viele = Array.from({ length: 12 }, (_, i) => ({ key: `B${i}`, name: `B${i}`, qid: `Q${i}`, lg: "XL" }));
  const breit = K.baueWelt((v) => 80 + (Number(v.key.slice(1)) % 4), viele, LIGEN);
  const zufall = K.rng(29);
  const jung = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), ovr: 80, alter: 26 };
  const alt = { ...jung, alter: K.SPAET_AB };
  assert.equal(K.angebote(breit, jung, zufall).length, K.ANGEBOTE_NORMAL);
  assert.equal(K.angebote(breit, alt, zufall).length, K.ANGEBOTE_SPAET);
  assert.ok(K.ANGEBOTE_NORMAL > K.ANGEBOTE_SPAET);
});

test("man bekommt kein Angebot vom eigenen Verein", () => {
  const zufall = K.rng(37);
  const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), ovr: 80, alter: 26, verein: v("MIT") };
  for (let i = 0; i < 30; i++)
    assert.ok(!K.angebote(welt, k, zufall).some((a) => a.key === "MIT"));
});

// ── Auszeichnungen ───────────────────────────────────────────────────────────

/* Vierhundert Spiele, weil „Der Unvollendete" seit dem Talentwurf die lange
   titellose Laufbahn meint und nicht mehr jede titellose. */
const leer = () => ({ ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }),
  vereine: ["A"], laender: ["XXX"], gesamt: { spiele: 420, tore: 0, vorlagen: 0 } });

test("wer nichts gewonnen hat, bekommt genau eine Auszeichnung", () => {
  const a = K.erreichteAuszeichnungen(leer());
  assert.deepEqual(a.map((x) => x.key), ["unvollendet"]);
});

/* Wer nur kurz dabei war, hat nichts VERSÄUMT — der Titel der Auszeichnung wäre
   sonst bei jedem Abbruch nach zwei Saisons zu haben. */
test("eine kurze Laufbahn ohne Titel ist nicht die unvollendete", () => {
  const kurz = { ...leer(), gesamt: { spiele: 120, tore: 4, vorlagen: 1 } };
  assert.deepEqual(K.erreichteAuszeichnungen(kurz).map((x) => x.key), []);
});

test("ein einziger Titel nimmt dem Unvollendeten seinen Namen", () => {
  const k = { ...leer(), titel: { DFB: 1 } };
  assert.ok(!K.erreichteAuszeichnungen(k).some((a) => a.key === "unvollendet"));
  /* Der Ballon d'Or ist kein Mannschaftstitel — er zählt hier nicht. */
  const nurBdo = { ...leer(), titel: { BDO: 2 } };
  assert.ok(K.erreichteAuszeichnungen(nurBdo).some((a) => a.key === "unvollendet"));
});

test("die großen Auszeichnungen verlangen wirklich viel", () => {
  const fast = { ...leer(), titel: { CL: 2 } };
  assert.ok(!K.erreichteAuszeichnungen(fast).some((a) => a.key === "fuenf_ohren"));
  const ganz = { ...leer(), titel: { CL: 3 } };
  assert.ok(K.erreichteAuszeichnungen(ganz).some((a) => a.key === "fuenf_ohren"));
  const drei = { ...leer(), titel: { MBL: 1, MPL: 1, MLL: 1 } };
  assert.ok(K.erreichteAuszeichnungen(drei).some((a) => a.key === "europas_erster"));
  const zwei = { ...leer(), titel: { MBL: 1, MPL: 1 } };
  assert.ok(!K.erreichteAuszeichnungen(zwei).some((a) => a.key === "europas_erster"));
  /* Zweimal derselbe Titel ist EINE Liga, nicht zwei. */
  const doppelt = { ...leer(), titel: { MBL: 3 } };
  assert.ok(!K.erreichteAuszeichnungen(doppelt).some((a) => a.key === "europas_erster"));
});

/* EINE AUSZEICHNUNG, DIE NIEMAND ERREICHEN KANN, IST EIN GEBROCHENES VERSPRECHEN.
   Deshalb wird für jede eine Laufbahn gebaut, die sie erfüllt — fällt eine durch,
   steht sie im Spiel und ist trotzdem tot. */
test("jede Auszeichnung ist erreichbar", () => {
  const beispiele = {
    fuenf_ohren:    { titel: { CL: 5 } },
    unvollendet:    {},
    europas_erster: { titel: { MBL: 1, MPL: 1, MLL: 1 } },
    vereinstreue:   { vereine: ["A"], titel: { MBL: 1, DFB: 1, CL: 1 } },
    aus_der_zweiten:{ aufstiegMitMeister: true },
    riesentoeter:   { europaMitKleinem: true },
    das_triple:     { triple: true },
    wanderer:       { vereine: Array.from({ length: 10 }, (_, i) => "V" + i) },
    grenzgaenger:   { laender: ["GER", "ENG", "ESP", "ITA", "FRA", "POR", "NED"] },
    torfabrik:      { gesamt: { spiele: 700, tore: 250, vorlagen: 100 } },
    der_ewige:      { alter: 36, verein: { stufe: 5 } },
    goldjunge:      { bdoAlter: 26, titel: { BDO: 1 } },
    der_groesste:   { titel: { WM: 1, BDO: 1 } },
    doppelbuerger:  { verbandGewechselt: true, titel: { EM: 1 } },
    sammler:        { titel: { MBL: 8, DFB: 7 } },
  };
  for (const a of K.AUSZEICHNUNGEN) {
    const bsp = beispiele[a.key];
    assert.ok(bsp, `für ${a.key} fehlt ein Beispiel — Auszeichnung ungeprüft`);
    assert.ok(a.pruefe({ ...leer(), ...bsp }), `${a.name} ist nicht erreichbar`);
  }
});

test("jede Auszeichnung hat Namen und Erklärung", () => {
  const keys = K.AUSZEICHNUNGEN.map((a) => a.key);
  assert.equal(new Set(keys).size, keys.length, "doppelte Schlüssel");
  for (const a of K.AUSZEICHNUNGEN) {
    assert.ok(a.name && a.name.length < 30, `${a.key}: Name fehlt oder ist zu lang`);
    assert.ok(a.text && a.text.endsWith("."), `${a.key}: Erklärung fehlt`);
  }
});

// ── Auf- und Abstieg ─────────────────────────────────────────────────────────

test("die Schwesterliga ist die andere Spielklasse desselben Landes", () => {
  const erste = LIGEN[0], zweite = LIGEN[1];
  assert.equal(K.schwesterLiga(erste, LIGEN).key, zweite.key);
  assert.equal(K.schwesterLiga(zweite, LIGEN).key, erste.key);
  assert.equal(K.schwesterLiga(LIGEN[2], LIGEN), null, "ein Land ohne zweite Liga hat keine");
});

/* DER FEHLER, DEN DAS FÄNGT: Ein Aufsteiger behielte sonst die Deckelung der zweiten
   Liga und bliebe für immer bei Rufstufe 2 — er dürfte also auch als Erstligist nie
   Meister werden. */
test("ein Aufsteiger darf wachsen", () => {
  const zwa = v("ZWA");
  assert.equal(zwa.stufe, 2, "in der zweiten Liga gedeckelt");
  const oben = K.mitLiga(zwa, LIGEN[0]);
  assert.equal(oben.lg, "XL");
  assert.ok(oben.stufe > 2, `nach dem Aufstieg Stufe ${oben.stufe}`);
  assert.equal(oben.staerke, zwa.staerke, "die Mannschaft ist dieselbe");
});

test("aufgestiegen wird nach oben, abgestiegen nach unten", () => {
  const zufall = K.rng(41);
  const richtungen = (verein) => {
    const zahl = { auf: 0, ab: 0, keine: 0 };
    for (let i = 0; i < 3000; i++) zahl[K.ligaWechsel(verein, zufall, LIGEN).richtung || "keine"]++;
    return zahl;
  };
  const zweite = richtungen(v("ZWA"));
  assert.ok(zweite.auf > 0 && zweite.ab === 0, "aus der zweiten Liga geht es nur hoch");
  const schwach = richtungen(v("KEL"));
  assert.ok(schwach.ab > 0 && schwach.auf === 0, "aus der ersten nur runter");
  const stark = richtungen(v("SPI"));
  assert.equal(stark.ab, 0, "ein Spitzenverein steigt nicht ab");
});

test("ohne zweite Liga passiert nichts", () => {
  const zufall = K.rng(43);
  for (let i = 0; i < 200; i++) assert.equal(K.ligaWechsel(v("AUS"), zufall, LIGEN).richtung, null);
});

// ── Leihe ────────────────────────────────────────────────────────────────────

/* Wofür die zweite Spielklasse gebaut wurde: Ein Siebzehnjähriger bei einem
   Spitzenverein sitzt. Eine Leihe nach unten gibt ihm Spiele. */
test("verliehen wird nur, wer jung ist und nicht spielt", () => {
  const jung = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 9, pos: "ST" }), alter: 18, ovr: 55 };
  assert.equal(K.leiheMoeglich(jung, v("SPI")), true, "zu schwach für den Spitzenverein");
  assert.equal(K.leiheMoeglich(jung, v("KEL")), false, "beim kleinen Verein spielt er");
  const stark = { ...jung, ovr: 90 };
  assert.equal(K.leiheMoeglich(stark, v("SPI")), false, "wer gut genug ist, wird nicht verliehen");
  const alt = { ...jung, alter: K.LEIHE_BIS_ALTER + 1 };
  assert.equal(K.leiheMoeglich(alt, v("SPI")), false, "zu alt für eine Leihe");
  const schon = { ...jung, leiheVon: v("SPI") };
  assert.equal(K.leiheMoeglich(schon, v("SPI")), false, "nicht zweimal hintereinander");
});

test("geliehen wird nach unten, nie nach oben", () => {
  const zufall = K.rng(47);
  const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 9, pos: "ST" }), alter: 18, ovr: 60 };
  for (let i = 0; i < 30; i++)
    for (const ziel of K.leihAngebote(welt, k, v("SPI"), zufall)) {
      assert.ok(ziel.stufe < v("SPI").stufe, `${ziel.name} ist nicht schwächer`);
      assert.ok(k.ovr >= K.STUFE_MINDEST_OVR[ziel.stufe], `${ziel.name} nähme ihn gar nicht`);
      assert.notEqual(ziel.key, "SPI");
    }
});

// ── Turnier-Takt ─────────────────────────────────────────────────────────────

/* DER FEHLER, DEN DAS FÄNGT: Zuerst wurde in jeder Saison auf beide Turniere
   gewürfelt. Im Spiel wurde ein Spieler dadurch zweimal binnen zwei Saisons
   Weltmeister — es gibt aber alle vier Jahre eine WM. */
test("Turniere folgen dem Vierjahrestakt", () => {
  const takt = Array.from({ length: 12 }, (_, i) => K.turnierIn(i));
  assert.deepEqual(takt, ["WM", null, "EM", null, "WM", null, "EM", null, "WM", null, "EM", null]);
});

/* DER FEHLER, DEN DAS FÄNGT: Es gab nur die EM, und die bekam jeder — ein
   Brasilianer wurde Europameister. */
test("die Kontinentalmeisterschaft richtet sich nach dem Erdteil", () => {
  assert.equal(K.turnierIn(2, "GER"), "EM");
  assert.equal(K.turnierIn(2, "AUT"), "EM");
  assert.equal(K.turnierIn(2, "BR"), "CA", "Brasilien spielt die Copa América, nicht die EM");
  assert.equal(K.turnierIn(2, "AR"), "CA");
  assert.equal(K.turnierIn(2, "JP"), null, "für Asien führt das Spiel keine Trophäe");
  assert.equal(K.turnierIn(0, "JP"), "WM", "an der WM nimmt jeder teil");
  const zufall = K.rng(71);
  for (let i = 0; i < 400; i++)
    assert.deepEqual(K.nationalTitel({ ovr: 95, land: "BR" }, { stufe: 5 }, zufall, 2).filter((x) => x === "EM"), []);
});

/* DER FEHLER, DEN DAS FÄNGT: Das Land kam in der Titelrechnung nicht vor. Im Spiel
   wurde ein Spieler zweimal Weltmeister mit Österreich. */
test("eine kleine Auswahl gewinnt deutlich seltener als eine grosse", () => {
  const zufall = K.rng(83);
  const quote = (land) => {
    let n = 0;
    for (let i = 0; i < 20000; i++) n += K.nationalTitel({ ovr: 92, land }, { stufe: 5 }, zufall, 0).length;
    return n / 20000;
  };
  const br = quote("BR"), at = quote("AUT"), mt = quote("MT");
  /* Seit das Turnier im Feld ausgespielt wird, liegt die Spitze bei gut 5 % je WM
     — neun Nationen teilen sich die oberste Gruppe, und es gibt EINEN Weltmeister. */
  assert.ok(br > 0.03 && br < 0.12, `Brasilien gewinnt ${(br * 100).toFixed(1)} % der Weltmeisterschaften`);
  assert.ok(at < br / 8, `Österreich ${(at * 100).toFixed(2)} % gegen Brasilien ${(br * 100).toFixed(1)} %`);
  assert.ok(mt < at, "Malta muss noch seltener gewinnen als Österreich");
  assert.ok(mt > 0, "unmöglich soll es aber nirgends sein");
});

test("ohne Turnier gibt es keinen Länderpokal", () => {
  const zufall = K.rng(53);
  const k = { ovr: 95 };
  for (const saison of [1, 3, 5, 7]) {
    for (let i = 0; i < 200; i++)
      assert.deepEqual(K.nationalTitel(k, { stufe: 5 }, zufall, saison), [], `Saison ${saison}`);
  }
  /* Und in einem Turnierjahr kommt höchstens EIN Titel heraus, nie beide. */
  for (let i = 0; i < 300; i++) {
    const t = K.nationalTitel(k, { stufe: 5 }, zufall, 0);
    assert.ok(t.length <= 1 && (t.length === 0 || t[0] === "WM"));
  }
});

test("wer zu schwach ist, spielt nicht in der Nationalelf", () => {
  const zufall = K.rng(59);
  for (let i = 0; i < 300; i++)
    assert.deepEqual(K.nationalTitel({ ovr: K.berufungsSchwelle("GER") - 1, land: "GER" }, { stufe: 5 }, zufall, 0), []);
});

// ── Der Wächter ──────────────────────────────────────────────────────────────

/* WARUM ES DIESE PRÜFUNG BRAUCHT, obwohl es oben schon eine zu den Auszeichnungen
   gibt: Jene baut sich die Laufbahn, die sie erfüllt, selbst zusammen. Sie zeigt,
   dass eine Bedingung ERFÜLLBAR ist — nicht, dass das Spiel sie je hervorbringt.

   Genau diese Lücke war teuer. Nach der ersten Fassung fielen in 600 gespielten
   Laufbahnen ACHT der fünfzehn Auszeichnungen kein einziges Mal, eine fiel in
   100 %. Beides ist dasselbe Versagen: eine Auszeichnung, die nichts aussagt.

   Diese Prüfung spielt deshalb echte Laufbahnen durch — mit festen Startwerten,
   also immer dieselben — und verlangt, dass jede Auszeichnung mindestens einmal
   vorkommt und keine in mehr als der Hälfte aller Läufe.

   SCHLÄGT SIE FEHL, ist nicht die Prüfung schuld, sondern die Auszeichnung oder
   eine Kurve: Dann liegt eine Schwelle außerhalb dessen, was das Spiel erzeugt. */
/* DAS LAND IST NICHT MEHR EGAL. Solange die Titelchance der Auswahl nur am Rating
   hing, war „XXX" ein brauchbarer Platzhalter. Jetzt trägt jedes Land einen Faktor,
   und ein unbekanntes fällt in die schwächste Gruppe — mit „XXX" gäbe es in 1500
   Laufbahnen praktisch keinen Länderpokal mehr, und „Der Größte" und „Doppelbürger"
   wären tot, ohne dass an ihnen etwas falsch wäre. */
function spieleDurch(seed, stil, welt) {
  const zufall = K.rng(seed * 7919 + 13);
  let k = K.neueKarriere({ name: "P", land: "GER", nummer: 9, pos: "ST", tempo: "normal", seed });
  let verein = K.jugendAngebote(welt, "GER", zufall)[0];
  if (!verein) return null;
  let mod = { liga: 1, pokal: 1, europa: 1 };
  for (let schritt = 0; schritt < 11 && k.alter < 39; schritt++) {
    const neu = [];
    for (let s = 0; s < 2; s++) {
      const l = K.saisonLeistung(k, verein.stufe, zufall);
      k.gesamt = { spiele: k.gesamt.spiele + l.spiele, tore: k.gesamt.tore + l.tore, vorlagen: k.gesamt.vorlagen + l.vorlagen };
      k.saisonNr++;
      neu.push(...K.saisonTitel(verein, zufall, mod), ...K.einzelTitel(k, l, zufall),
               ...K.nationalTitel(k, verein, zufall, k.saisonNr));
      k.alter++;
      k.ovr = K.grenze(k.ovr + K.wachstumImVerein(k, verein.stufe, zufall), K.OVR_MIN, K.OVR_MAX);
      /* welt.ligen, NICHT die kleine Testwelt oben: Mit der falschen Liste findet
         schwesterLiga nichts, und es steigt nie jemand auf. */
      const w = K.ligaWechsel(verein, zufall, welt.ligen);
      if (w.richtung === "auf") k.aufgestiegenMit = verein.key;
      verein = w.verein;
    }
    mod = { liga: 1, pokal: 1, europa: 1 };
    const lk = K.LIGA_TITEL[verein.lg], pk = K.POKAL_TITEL[verein.lg];
    for (const t of neu) { k.titel[t] = (k.titel[t] || 0) + 1; if (t === "BDO" && k.bdoAlter === undefined) k.bdoAlter = k.alter; }
    if (lk && pk && neu.includes(lk) && neu.includes(pk) && (neu.includes("CL") || neu.includes("EL"))) k.triple = true;
    if (verein.stufe <= 3 && (neu.includes("CL") || neu.includes("EL"))) k.europaMitKleinem = true;
    if (lk && neu.includes(lk) && k.aufgestiegenMit === verein.key) k.aufstiegMitMeister = true;
    if (!k.vereine.includes(verein.key)) k.vereine.push(verein.key);
    if (!k.laender.includes(verein.liga.land)) k.laender.push(verein.liga.land);

    if (stil === "treu") { const r = K.entscheide(k, K.ziehEreignis(k, zufall).optionen[0], zufall); k = { ...r.karriere }; mod = r.mod; continue; }
    const a = K.angebote(welt, k, zufall);
    if (stil === "ehrgeizig" && a.length) { verein = a.reduce((x, y) => (y.stufe > x.stufe ? y : x)); continue; }
    if (zufall() < 0.5 && a.length) { verein = a[Math.floor(zufall() * a.length)]; continue; }
    const e = K.ziehEreignis(k, zufall);
    const r = K.entscheide(k, e.optionen[Math.floor(zufall() * e.optionen.length)], zufall);
    k = { ...r.karriere }; mod = r.mod;
  }
  k.verein = verein;
  return k;
}

test("jede Auszeichnung kommt im gespielten Spiel wirklich vor", () => {
  /* Eine breitere Welt als die Handvoll oben — sonst gäbe es weder fünf große
     Meisterschaften noch sieben Länder zu holen. */
  const ligen = [];
  const vereine = [];
  for (const [lg, lg2, land] of [["BL", "BL2", "GER"], ["PL", "PL2", "ENG"], ["LL", "LL2", "ESP"],
                                 ["SA", "SA2", "ITA"], ["L1", "L2", "FRA"], ["PT", "PT2", "PRT"], ["NL", "NL2", "NED"]]) {
    ligen.push({ key: lg, name: lg, land, stufe: 1, plaetze: 18 }, { key: lg2, name: lg2, land, stufe: 2, plaetze: 18 });
    for (let i = 0; i < 6; i++) vereine.push({ key: `${lg}${i}`, name: `${lg} ${i}`, qid: `Q${lg}${i}`, lg });
    for (let i = 0; i < 6; i++) vereine.push({ key: `${lg2}${i}`, name: `${lg2} ${i}`, qid: `Q${lg2}${i}`, lg: lg2 });
  }
  /* Die Spanne muss die echte treffen: Gemessen laufen die Mannschaftsstaerken von
     74 bis 98. Mit einer Kunstwelt, die bei 93 endet, gaebe es keine Vereine der
     Stufe 5 — und Auszeichnungen, die einen Spitzenverein brauchen, waeren hier tot,
     obwohl sie im Spiel fallen. */
  const staerke = (v) => 74 + ((v.key.length * 7 + v.key.charCodeAt(v.key.length - 1) * 3) % 25);
  const w = K.baueWelt(staerke, vereine, ligen);

  const zahl = new Map(K.AUSZEICHNUNGEN.map((a) => [a.key, 0]));
  let laeufe = 0;
  for (const stil of ["ehrgeizig", "treu", "zufall"]) {
    for (let n = 0; n < 500; n++) {
      const k = spieleDurch(n, stil, w);
      if (!k) continue;
      laeufe++;
      for (const a of K.erreichteAuszeichnungen(k)) zahl.set(a.key, zahl.get(a.key) + 1);
    }
  }
  assert.ok(laeufe > 1000, `nur ${laeufe} Laufbahnen gespielt`);
  const tot = K.AUSZEICHNUNGEN.filter((a) => zahl.get(a.key) === 0);
  assert.deepEqual(tot.map((a) => a.name), [], `unerreichbar in ${laeufe} Laufbahnen`);
  const zuLeicht = K.AUSZEICHNUNGEN.filter((a) => zahl.get(a.key) > laeufe * 0.5);
  assert.deepEqual(zuLeicht.map((a) => a.name), [], "fällt in über der Hälfte aller Laufbahnen");
});

// ── Das Angebotsband ─────────────────────────────────────────────────────────

/* DER FEHLER, DEN DAS FÄNGT: Es gab nur eine Obergrenze. Ein Spieler mit 85 bekam
   deshalb weiterhin Angebote von Kellervereinen — die Auswahl stellte Weltklasse
   und Abstiegskampf nebeneinander. Der eigene Wert muss das ganze Fenster
   verschieben, nicht nur seine Decke. */
test("Angebote kommen aus einem Band um das eigene Niveau", () => {
  const zufall = K.rng(61);
  const stufen = (ovr) => {
    const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 9, pos: "ST" }), ovr, alter: 26 };
    const alle = new Set();
    for (let i = 0; i < 60; i++) for (const a of K.angebote(welt, k, zufall)) alle.add(a.stufe);
    return [...alle].sort();
  };
  const stark = stufen(90);
  assert.ok(stark.length, "ein Spitzenspieler bekommt Angebote");
  assert.ok(Math.min(...stark) >= K.eigeneStufe(90) - K.BAND_UNTEN,
    `ein 90er bekommt Angebote der Stufen ${stark} — zu weit unten`);
  const schwach = stufen(58);
  assert.ok(Math.max(...schwach) <= K.eigeneStufe(58) + K.BAND_OBEN,
    `ein 58er bekommt Angebote der Stufen ${schwach} — zu weit oben`);
  /* Und die Bänder duerfen sich nicht decken: Oben und unten ist es woanders. */
  assert.ok(Math.min(...stark) > Math.min(...schwach), "das Fenster verschiebt sich mit dem Wert");
});

test("das eigene Niveau folgt den Anforderungen der Stufen", () => {
  for (let s = 0; s < K.STUFE_MINDEST_OVR.length; s++)
    assert.equal(K.eigeneStufe(K.STUFE_MINDEST_OVR[s]), s, `bei genau ${K.STUFE_MINDEST_OVR[s]}`);
  assert.equal(K.eigeneStufe(40), 0, "unter jeder Anforderung ist es Stufe null");
  assert.equal(K.eigeneStufe(99), 5);
});

test("wer nichts im Band findet, steht trotzdem nicht ohne Angebot da", () => {
  /* Eine Welt mit nur einem sehr schwachen Verein: Das Band eines starken Spielers
     ist leer, ein Angebot muss es trotzdem geben. */
  const klein = K.baueWelt(() => 70, [{ key: "EIN", name: "Einziger", qid: "Q9", lg: "XL" }], LIGEN);
  const zufall = K.rng(67);
  const k = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 9, pos: "ST" }), ovr: 95, alter: 26 };
  assert.equal(K.angebote(klein, k, zufall).length, 1);
});

/* ── Die Folgen einer Entscheidung ───────────────────────────────────────────
   Sie werden dem Spieler wörtlich gezeigt. Also darf dort nur stehen, was
   tatsächlich eingetreten ist. */
test("die Folge nennt die neue Stärke, nicht die versprochene", () => {
  const k = { ...K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 }), ovr: K.OVR_MAX - 1 };
  const r = K.entscheide(k, { label: "x", wirkung: { ovr: 6 } }, () => 0);
  assert.equal(r.karriere.ovr, K.OVR_MAX);
  assert.deepEqual(r.folgen.map((f) => f.text), [`Stärke ${K.OVR_MAX - 1} → ${K.OVR_MAX}`]);
});

test("ein Zuwachs, der an der Decke verpufft, wird nicht als Zuwachs gemeldet", () => {
  const k = { ...K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 }), ovr: K.OVR_MAX };
  const r = K.entscheide(k, { label: "x", wirkung: { ovr: 4 } }, () => 0);
  assert.deepEqual(r.folgen.map((f) => f.text), ["Es bleibt alles, wie es war"]);
});

test("eine Wahl ohne Risiko gilt nicht als gelungene Wette", () => {
  const k = K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 });
  assert.equal(K.entscheide(k, { label: "x", wirkung: {} }, () => 0).gewagt, false);
  assert.equal(K.entscheide(k, { label: "x", chance: 0.5, wirkung: {} }, () => 0).gewagt, true);
});

test("Rollenwechsel, Verletzung und Titelaussicht stehen im Klartext", () => {
  const k = K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 });
  const r = K.entscheide(k, { label: "x", wirkung: { rolle: "rotation", verletzt: 1, liga: 1.6, pokal: 0.5 } }, () => 0);
  const texte = r.folgen.map((f) => f.text);
  assert.ok(texte.some((t) => t.includes("Stammspieler → Rotation")), texte.join(" | "));
  assert.ok(texte.some((t) => t.includes("verletzt")), texte.join(" | "));
  assert.ok(texte.some((t) => t.includes("Meisterschaft") && t.includes("1,6")), texte.join(" | "));
  assert.ok(texte.some((t) => t.includes("den Pokal") && t.includes("50")), texte.join(" | "));
});

/* DER FEHLER, DEN DAS FÄNGT: „Aussicht auf die Pokal", „die Europapokal" und
   „1.6-fach" standen so im Spiel. */
test("die Titelaussicht steht in richtigem Deutsch", () => {
  const k = K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 });
  const r = K.entscheide(k, { label: "x", wirkung: { liga: 1.6, pokal: 1.6, europa: 1.6 } }, () => 0);
  const texte = r.folgen.map((f) => f.text).join(" | ");
  assert.ok(texte.includes("auf die Meisterschaft"), texte);
  assert.ok(texte.includes("auf den Pokal"), texte);
  assert.ok(texte.includes("auf den Europapokal"), texte);
  assert.ok(!/die Pokal|die Europapokal|\d\.\d/.test(texte), texte);
});

/* DER FEHLER, DEN DAS FÄNGT: Bei Al-Hilal kam „Drei Wettbewerbe — Liga, Pokal,
   Europa", in der 2. Bundesliga „Aussicht auf die Meisterschaft ×1,5". Beides
   verspricht etwas, das es dort nicht gibt. */
test("Karten und Folgen kennen nur die Wettbewerbe des Vereins", () => {
  const liga = (key) => WELT_LIGEN.find((l) => l.key === key);
  const verein = (lg, stufe) => ({ key: "X", name: "X", lg, stufe, liga: liga(lg) });
  assert.deepEqual(K.wettbewerbe(verein("BL", 5)), { liga: true, pokal: true, europa: true });
  assert.deepEqual(K.wettbewerbe(verein("SAU", 4)), { liga: true, pokal: false, europa: false });
  assert.deepEqual(K.wettbewerbe(verein("BL2", 2)), { liga: false, pokal: false, europa: false });

  const basis = (v) => ({ ...K.neueKarriere({ name: "T", land: "GER", nummer: 9, pos: "ST", seed: 3 }),
    alter: 30, ovr: 82, rolle: "stamm", verein: v });
  const moeglich = (k) => K.EREIGNISSE.filter((e) => !e.wenn || e.wenn(k)).map((e) => e.key);
  const riad = moeglich(basis(verein("SAU", 4)));
  assert.ok(!riad.includes("dreifach"), "bei Al-Hilal gibt es keine drei Wettbewerbe");
  assert.ok(!riad.includes("prioritaet"), "und keinen Europapokal, auf den man setzen könnte");
  const zweite = moeglich(basis(verein("BL2", 2)));
  assert.ok(!zweite.includes("prioritaet") && !zweite.includes("talent"));

  /* Die Folge verschweigt, was es nicht gibt. */
  const k = basis(verein("BL2", 2));
  const r = K.entscheide(k, { label: "x", wirkung: { liga: 1.5, pokal: 1.5, europa: 1.5 } }, () => 0);
  assert.deepEqual(r.folgen.map((f) => f.text), ["Es bleibt alles, wie es war"]);

  /* Und keine Karte trägt eine Titelwirkung, die ihre Bedingung nie erfüllen kann. */
  const aufstieg = K.EREIGNISSE.find((e) => e.key === "aufstiegsrennen");
  for (const o of aufstieg.optionen) assert.equal(o.wirkung.liga, undefined, "in der zweiten Liga gibt es keine Meisterschaft");
});

test("jede Option jeder Ereigniskarte erzeugt eine beschreibbare Folge", () => {
  const k = K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 });
  for (const e of K.EREIGNISSE)
    for (const o of e.optionen)
      for (const zufall of [() => 0, () => 0.999]) {
        const r = K.entscheide({ ...k, ovr: 70 }, o, zufall);
        assert.ok(r.folgen.length >= 1, `${e.key} / ${o.label}`);
        for (const f of r.folgen) {
          assert.ok(f.text && f.text.length > 3, `${e.key}: leerer Folgentext`);
          assert.ok(["gut", "schlecht", "neutral"].includes(f.art), `${e.key}: ${f.art}`);
          assert.ok(!/undefined|NaN/.test(f.text), `${e.key}: ${f.text}`);
        }
      }
});

/* ── Ganze Ratings ─────────────────────────────────────────────────────────── */
test("das Rating bleibt über eine ganze Laufbahn ganzzahlig", () => {
  const zufall = K.rng(4711);
  let k = { ...K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 }) };
  for (let i = 0; i < 40; i++) {
    const g = K.wachstumGanz(k, i % 6, zufall);
    k = { ...k, rest: g.rest, ovr: K.grenze(k.ovr + g.zuwachs, K.OVR_MIN, K.OVR_MAX), alter: k.alter + 1 };
    assert.equal(k.ovr, Math.round(k.ovr), `Rating ${k.ovr} ist nicht ganzzahlig`);
  }
});

/* Fester Talentwert statt des gezogenen: `neueKarriere` zieht ohne Saatkorn aus der
   Uhr, und mit einem krummen Faktor wie 0,731 unterscheiden sich die beiden Seiten
   der Gleichung um ein Hundertstel — nicht weil der Rest verloren ginge, sondern
   weil Gleitkommazahlen sich so verhalten. Die Prüfung soll den Übertrag zeigen,
   nicht die Darstellung von Zahlen. */
test("der Rest geht nicht verloren — zwei halbe Schritte ergeben einen ganzen", () => {
  const halb = { ...K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9, seed: 7 }), talent: 1, rest: 0.5 };
  const a = K.wachstumGanz({ ...halb, rest: 0 }, 0, () => 0);
  const b = K.wachstumGanz({ ...halb, rest: a.rest }, 0, () => 0);
  assert.equal(Math.round((a.zuwachs + a.rest + b.zuwachs + b.rest) * 100) / 100,
    Math.round((a.zuwachs + a.rest) * 100) / 100 + Math.round((b.zuwachs + b.rest) * 100) / 100);
  assert.ok(Number.isInteger(a.zuwachs) && Number.isInteger(b.zuwachs));
});

/* Und derselbe Übertrag mit einem krummen Talentfaktor: Über zwanzig Schritte darf
   sich nichts ansammeln, was verloren geht. */
test("auch mit krummem Talent summiert sich der Übertrag richtig", () => {
  const k = { ...K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9, seed: 7 }), talent: 0.731, rest: 0, alter: 19 };
  const zufall = K.rng(101);
  let gewachsen = 0, roh = 0;
  for (let i = 0; i < 20; i++) {
    const vorher = k.rest;
    const g = K.wachstumGanz(k, 2, zufall);
    roh += g.zuwachs + g.rest - vorher;
    gewachsen += g.zuwachs;
    k.rest = g.rest;
  }
  assert.ok(Math.abs(gewachsen + k.rest - roh) < 0.05,
    `in ganzen Schritten ${gewachsen} + Rest ${k.rest}, ungerundet ${roh.toFixed(2)}`);
});

test("beim Abbau bleibt der Rest negativ liegen, statt zu viel abzuziehen", () => {
  const k = { ...K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 }), rest: -0.5, ovr: 80, alter: 34 };
  const g = K.wachstumGanz(k, 3, () => 0);
  assert.ok(Number.isInteger(g.zuwachs));
  assert.ok(g.rest > -1 && g.rest <= 0, `Rest ${g.rest} ausserhalb der Spanne`);
});

/* ── Wie oft kommt eine Ereigniskarte? ──────────────────────────────────────── */
test("nach sechs Ereignissen kommt keines mehr", () => {
  const immer = () => 0;
  assert.equal(K.ereignisFaellig({ gespielt: K.EREIGNISSE_JE_LAUFBAHN, seitLetztem: 99 }, immer), false);
  assert.equal(K.ereignisFaellig({ gespielt: K.EREIGNISSE_JE_LAUFBAHN - 1, seitLetztem: 99 }, immer), true);
});

test("zwei Ereignisse hintereinander gibt es nicht", () => {
  const immer = () => 0;
  assert.equal(K.ereignisFaellig({ gespielt: 1, seitLetztem: 1 }, immer), false);
  assert.equal(K.ereignisFaellig({ gespielt: 1, seitLetztem: K.EREIGNIS_ABSTAND }, immer), true);
});

/* Die eigentliche Rückmeldung war die Häufigkeit. Also wird sie gemessen, nicht
   nur die Grenze geprüft. */
test("über eine ganze Laufbahn bleiben es höchstens sechs", () => {
  for (const schritte of [11, 22]) {
    const zufall = K.rng(99 + schritte);
    let gespielt = 0, seit = Infinity;
    for (let i = 0; i < schritte; i++) {
      if (K.ereignisFaellig({ gespielt, seitLetztem: seit }, zufall)) { gespielt++; seit = 0; }
      else seit++;
    }
    assert.ok(gespielt <= K.EREIGNISSE_JE_LAUFBAHN, `${schritte} Schritte ergaben ${gespielt} Ereignisse`);
    assert.ok(gespielt >= 3, `${schritte} Schritte ergaben nur ${gespielt} Ereignisse — zu wenige`);
  }
});

/* DER FEHLER, DEN DAS FÄNGT: Der Aufsteiger nahm das Feld seiner alten Liga mit und
   rechnete in der Bundesliga gegen die Zweitliga-Konkurrenz. Ein Stufe-1-Verein kam
   damit auf 6,5 % Meisterchance — im ersten Probelauf prompt Deutscher Meister. */
test("ein Aufsteiger rechnet gegen sein neues Feld, nicht gegen das alte", () => {
  const zweite = { key: "BL2", name: "2. Bundesliga", stufe: 2, feld: { liga: 31, pokal: 60 } };
  const erste = { key: "BL", name: "Bundesliga", stufe: 1, feld: { liga: 700, pokal: 222 } };
  const verein = { key: "AAC", staerke: 76, stufe: 1, lg: "BL2", liga: zweite };
  const vorher = K.titelAnteil(verein, "liga");
  const nachher = K.titelAnteil(K.mitLiga(verein, erste), "liga");
  assert.ok(nachher < vorher / 5, `vorher ${(vorher * 100).toFixed(1)} %, nachher ${(nachher * 100).toFixed(1)} %`);
  assert.ok(nachher < 0.01, `ein Aufsteiger kommt auf ${(nachher * 100).toFixed(2)} % — zu viel`);
});

/* ── Die Auswahl ────────────────────────────────────────────────────────────
   Titel gab es schon, Länderspiele nicht — und ein Titel ohne Einsätze wirkt wie
   ein Zufallsfund. */
test("wer zu schwach ist, spielt nicht für sein Land", () => {
  const k = { ...K.neueKarriere({ name: "T", pos: "ST", land: "GER", nummer: 9 }), ovr: K.berufungsSchwelle("GER") - 1 };
  assert.deepEqual(K.nationalLeistung(k, K.rng(1)), { spiele: 0, tore: 0, vorlagen: 0 });
});

test("die Zahl der Länderspiele wächst mit dem Wert", () => {
  const mach = (ovr) => K.nationalLeistung(
    { ...K.neueKarriere({ name: "T", pos: "ST", land: "GER", nummer: 9 }), ovr }, K.rng(7)).spiele;
  const frisch = mach(K.berufungsSchwelle("GER")), spitze = mach(96);
  assert.ok(frisch > 0, "ein gerade Berufener spielt auch");
  assert.ok(spitze > frisch, `Spitze ${spitze} muss über frisch ${frisch} liegen`);
  assert.ok(spitze <= K.LAENDERSPIELE_JE_SAISON, "nie mehr als es Spiele gibt");
});

test("ein Torwart trifft für sein Land so wenig wie im Verein", () => {
  const zufall = K.rng(3);
  const tw = { ...K.neueKarriere({ name: "T", pos: "TW", land: "GER", nummer: 1 }), ovr: 90 };
  let tore = 0;
  for (let i = 0; i < 30; i++) tore += K.nationalLeistung(tw, zufall).tore;
  assert.equal(tore, 0, "ein Torwart schiesst keine Länderspieltore");
});

/* ── Die Laufgeschwindigkeit des Ratingzählers ──────────────────────────────
   Die Forderung war: kleine Änderung gemächlich, grosse rasant. Das ist eine
   Aussage über die Zeit JE ZIFFER, nicht über die Gesamtdauer — und genau die
   Verwechslung fängt der zweite Test. */
test("ein grösserer Sprung dauert insgesamt länger", () => {
  assert.ok(K.zaehlerDauer(15) > K.zaehlerDauer(2), "15 Punkte müssen länger laufen als 2");
  assert.equal(K.zaehlerDauer(0), 900, "ohne Sprung bleibt die Grunddauer");
  assert.equal(K.zaehlerDauer(-7), K.zaehlerDauer(7), "ein Absturz läuft wie ein Anstieg");
});

test("je grösser der Sprung, desto schneller rollt eine Ziffer durch", () => {
  const jeZiffer = (s) => K.zaehlerDauer(s) / Math.abs(s);
  assert.ok(jeZiffer(2) > jeZiffer(5), "2 Punkte müssen gemächlicher ticken als 5");
  assert.ok(jeZiffer(5) > jeZiffer(15), "5 Punkte müssen gemächlicher ticken als 15");
  assert.ok(jeZiffer(2) > 450, `bei 2 Punkten steht eine Ziffer nur ${jeZiffer(2).toFixed(0)} ms`);
  assert.ok(jeZiffer(15) < 200, `bei 15 Punkten steht eine Ziffer noch ${jeZiffer(15).toFixed(0)} ms`);
});

test("auch ein unsinnig grosser Sprung bleibt unter drei Sekunden", () => {
  assert.equal(K.zaehlerDauer(999), 3000);
});

/* Erst wenn die Zahl steht, geht es weiter — sonst klickt man an der eigenen
   Saison vorbei. Die Sperre muss den ganzen Lauf abdecken und danach enden. */
test("die Sperre deckt Wartezeit und Zählerlauf ab", () => {
  for (const sprung of [0, 2, 8, 15]) {
    const s = K.sperrDauer(sprung);
    assert.ok(s > K.ZAEHLER_WARTEN + K.zaehlerDauer(sprung), `${sprung}: ${s} ms zu kurz`);
    assert.ok(s < 4500, `${sprung}: ${s} ms — so lange wartet niemand`);
  }
  assert.ok(K.sperrDauer(12) > K.sperrDauer(2), "ein grösserer Sprung sperrt länger");
});

/* Erst die Zeile, dann die Zahl: Laufen beide gleichzeitig, sieht man keines von
   beiden. Die Wartezeit muss deshalb lang genug sein, dass die Tabelle rechts ihren
   Auftritt hat — und kurz genug, dass es nicht wie ein Hänger wirkt. */
test("der Zähler wartet, bevor er losläuft", () => {
  assert.ok(K.ZAEHLER_WARTEN >= 400 && K.ZAEHLER_WARTEN <= 900, `${K.ZAEHLER_WARTEN} ms`);
});

// ── Talent ───────────────────────────────────────────────────────────────────

test("der Talentfaktor bleibt in seiner Spanne", () => {
  const zufall = K.rng(17);
  for (let i = 0; i < 5000; i++) {
    const t = K.zieheTalent(zufall);
    assert.ok(t >= K.TALENT_MIN && t <= K.TALENT_MAX, `${t} liegt ausserhalb`);
  }
});

/* Die Schiefe ist der ganze Zweck: Wäre die Ziehung gleichverteilt, läge die Mitte
   bei 0,85 und die Hälfte aller Spieler hätte grosses Talent. */
test("die Talentziehung drückt die Masse nach unten", () => {
  const zufall = K.rng(19);
  const werte = Array.from({ length: 20000 }, () => K.zieheTalent(zufall)).sort((a, b) => a - b);
  const mitte = (K.TALENT_MIN + K.TALENT_MAX) / 2;
  const median = werte[10000];
  assert.ok(median < mitte - 0.1, `Median ${median} liegt nicht deutlich unter der Mitte ${mitte}`);
  const oben = werte.filter((v) => v >= 1.0).length / werte.length;
  assert.ok(oben > 0.01 && oben < 0.12, `${(oben * 100).toFixed(1)} % über 1,0 — die Spitze ist keine Spitze mehr`);
});

/* Die Wörter müssen zu den Zahlen passen: „Jahrhunderttalent" bei jedem Dritten
   wäre eine Lüge, bei einem von tausend eine Zeile, die niemand je liest. */
test("die Veranlagungsstufen teilen die Laufbahnen sinnvoll auf", () => {
  const zufall = K.rng(31);
  const zahl = new Map(K.TALENT_STUFEN.map(([, n]) => [n, 0]));
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const n = K.talentName(K.zieheTalent(zufall));
    zahl.set(n, zahl.get(n) + 1);
  }
  const anteil = (n) => zahl.get(n) / N;
  assert.ok(anteil("Jahrhunderttalent") > 0.02 && anteil("Jahrhunderttalent") < 0.08,
    `Jahrhunderttalent: ${(anteil("Jahrhunderttalent") * 100).toFixed(1)} %`);
  assert.ok(anteil("harter Arbeiter") > 0.35 && anteil("harter Arbeiter") < 0.62,
    `harter Arbeiter: ${(anteil("harter Arbeiter") * 100).toFixed(1)} %`);
  for (const [, name] of K.TALENT_STUFEN) assert.ok(zahl.get(name) > 0, `${name} kommt nie vor`);
});

test("Talent streckt den Zuwachs, nicht den Abbau", () => {
  const jung = (talent) => {
    const zufall = K.rng(23);
    let summe = 0;
    for (let i = 0; i < 4000; i++) summe += K.wachstumImVerein({ typ: "normal", alter: 19, ovr: 60, rolle: "stamm", talent }, 2, zufall);
    return summe / 4000;
  };
  assert.ok(jung(1.1) > jung(0.6) * 1.5, "ein grosses Talent muss deutlich schneller wachsen");
  const alt = (talent) => {
    const zufall = K.rng(29);
    let summe = 0;
    for (let i = 0; i < 4000; i++) summe += K.wachstumImVerein({ typ: "normal", alter: 36, ovr: 80, rolle: "stamm", talent }, 4, zufall);
    return summe / 4000;
  };
  assert.ok(alt(1.1) < 0, "mit 36 geht es abwärts");
  assert.ok(Math.abs(alt(1.1) - alt(0.6)) < 0.05, "der Abbau darf nicht am Talent hängen");
});

/* ── DIE PRÜFUNG, UM DIE ES GEHT ──────────────────────────────────────────────
   Gemeldet wurde: „Es ist aktuell etwas zu einfach, eine Top-Karriere zu spielen."
   Gemessen an 4000 Laufbahnen, die immer zum besten erreichbaren Verein wechseln,
   lag der Höchstwert im Median bei 87 und 48 % kamen über die Ballon-d'Or-Schwelle
   von 88. Diese Prüfung hält fest, dass die Spitze die Ausnahme bleibt — und dass
   sie erreichbar bleibt, denn eine Laufbahn, in der nie etwas Grosses möglich ist,
   wäre der entgegengesetzte Fehler. */
test("die Spitze ist die Ausnahme — und bleibt möglich", () => {
  const zufall = K.rng(20260915);
  const besteStufe = (ovr) => {
    let s = 0;
    for (let i = 5; i >= 0; i--) if (ovr >= K.STUFE_MINDEST_OVR[i]) { s = i; break; }
    return s;
  };
  const hoechstwerte = [];
  for (let n = 0; n < 3000; n++) {
    const k = { ...K.neueKarriere({ name: "T", land: "GER", nummer: 9, pos: "ST", seed: n }), talent: K.zieheTalent(zufall) };
    let stufe = 0, hoechste = k.ovr;
    for (let s = 0; k.alter < K.ALTERSGRENZE; s++) {
      if (s % 2 === 0) stufe = besteStufe(k.ovr);        // immer der beste Verein, der ihn nimmt
      k.alter += 1;
      const g = K.wachstumGanz(k, stufe, zufall);
      k.rest = g.rest;
      k.ovr = K.grenze(k.ovr + g.zuwachs, K.OVR_MIN, K.OVR_MAX);
      if (k.ovr > hoechste) hoechste = k.ovr;
    }
    hoechstwerte.push(hoechste);
  }
  hoechstwerte.sort((a, b) => a - b);
  const median = hoechstwerte[1500];
  const anteil = (g) => hoechstwerte.filter((v) => v >= g).length / hoechstwerte.length;
  assert.ok(median >= 71 && median <= 78, `Median-Höchstwert ${median} — eine gewöhnliche Laufbahn soll gewöhnlich bleiben`);
  assert.ok(anteil(88) < 0.15, `${(anteil(88) * 100).toFixed(1)} % erreichen die Ballon-d'Or-Schwelle — zu viele`);
  assert.ok(anteil(88) > 0.02, `${(anteil(88) * 100).toFixed(1)} % erreichen 88 — zu wenige, die Spitze wäre tot`);
  assert.ok(anteil(95) > 0.001, "auch die 95 muss vereinzelt fallen");
});

// ── Titel ────────────────────────────────────────────────────────────────────

/* DER FEHLER, DEN DAS FÄNGT: Portugal, die Niederlande und Österreich hatten
   keinen Meistertitel und Frankreich keinen Pokal — 52 beziehungsweise 70 Vereine,
   bei denen die halbe Titelmechanik abgeschaltet war, ohne dass es irgendwo stand. */
test("jede erste Liga vergibt eine Meisterschaft", () => {
  const ohne = WELT_LIGEN.filter((l) => l.stufe === 1 && !K.LIGA_TITEL[l.key]);
  assert.deepEqual(ohne.map((l) => l.name), [], "erste Liga ohne Meistertitel");
});

test("keine zweite Liga vergibt eine Meisterschaft", () => {
  const falsch = WELT_LIGEN.filter((l) => l.stufe === 2 && (K.LIGA_TITEL[l.key] || K.POKAL_TITEL[l.key]));
  assert.deepEqual(falsch.map((l) => l.name), [], "aus der zweiten Liga gewinnt man keinen Titel");
});

test("jede europäische erste Liga vergibt einen Pokal", () => {
  const europa = WELT_LIGEN.filter((l) => l.stufe === 1 && ["GER","ENG","ESP","ITA","FRA","PRT","NED","AUT"].includes(l.land));
  const ohne = europa.filter((l) => !K.POKAL_TITEL[l.key]);
  assert.deepEqual(ohne.map((l) => l.name), [], "europäische erste Liga ohne Pokal");
});

test("alle vergebenen Titel sind auch beschrieben", () => {
  const vergeben = new Set([...Object.values(K.LIGA_TITEL), ...Object.values(K.POKAL_TITEL),
    "CL", "EL", "WM", "EM", "CA", "BDO"]);
  for (const key of vergeben) {
    assert.ok(K.TITEL_DATEN[key], `${key} wird vergeben, hat aber keinen Eintrag`);
    assert.ok(K.TITEL_DATEN[key].name, `${key} hat keinen Namen`);
    assert.ok(K.TITEL_REIHE.includes(key), `${key} fehlt in der Reihenfolge`);
  }
  /* Und umgekehrt: kein Eintrag, den niemand gewinnen kann. */
  for (const key of Object.keys(K.TITEL_DATEN))
    assert.ok(vergeben.has(key), `${key} ist beschrieben, wird aber nie vergeben`);
});

test("jeder Titel trägt eine der sieben Trophäenformen", () => {
  const formen = new Set(["schale", "pokal", "ohren", "amphore", "globus", "kelch", "ball"]);
  for (const [key, d] of Object.entries(K.TITEL_DATEN))
    assert.ok(formen.has(d.form), `${key}: unbekannte Form ${d.form}`);
});

/* „Europas Erster" meint die fünf großen Ligen. Würde es aus LIGA_TITEL abgeleitet,
   hätten die acht neuen Meisterschaften die Auszeichnung still verwässert. */
test("Europas Erster zählt nur die fünf großen Ligen", () => {
  const leer5 = () => ({ ...K.neueKarriere({ name: "T", land: "GER", nummer: 1, pos: "ST" }),
    vereine: ["A"], laender: ["GER"], gesamt: { spiele: 420, tore: 0, vorlagen: 0 } });
  const klein = { ...leer5(), titel: { MPT: 1, MNL: 1, MAT: 1, MBR: 1 } };
  assert.ok(!K.erreichteAuszeichnungen(klein).some((a) => a.key === "europas_erster"));
  const gross = { ...leer5(), titel: { MBL: 1, MPL: 1, MLL: 1 } };
  assert.ok(K.erreichteAuszeichnungen(gross).some((a) => a.key === "europas_erster"));
});

// ── Torwart ──────────────────────────────────────────────────────────────────

/* DER FEHLER, DEN DAS FÄNGT: Eine ganze Torwartlaufbahn zeigte Spiele, 0 Tore und
   0 Vorlagen — zwei Spalten Nullen und nichts, woran man eine gute Saison erkennt. */
test("ein Torwart bekommt eigene Zahlen, ein Feldspieler nicht", () => {
  const zufall = K.rng(101);
  const tw = K.saisonLeistung({ pos: "TW", ovr: 80, rolle: "stamm" }, 4, zufall);
  assert.ok(Number.isInteger(tw.gegentore) && tw.gegentore > 0, "ein Torwart kassiert Gegentore");
  assert.ok(Number.isInteger(tw.westen), "und hält zu null");
  const st = K.saisonLeistung({ pos: "ST", ovr: 80, rolle: "stamm" }, 4, zufall);
  assert.equal(st.gegentore, undefined, "ein Stürmer führt keine Gegentore");
  assert.equal(K.istTorwart("TW"), true);
  assert.equal(K.istTorwart("IV"), false);
});

test("weiße Westen können nie mehr sein als Spiele", () => {
  const zufall = K.rng(103);
  for (let i = 0; i < 500; i++) {
    const l = K.saisonLeistung({ pos: "TW", ovr: 50 + (i % 45), rolle: "stamm" }, i % 6, zufall);
    assert.ok(l.westen <= l.spiele, `${l.westen} Westen bei ${l.spiele} Spielen`);
    assert.ok(l.gegentore >= 0);
  }
});

/* Die Zahlen müssen wie Fußball aussehen: Ein Weltklassetorwart bei einem
   Spitzenverein liegt unter einem Gegentor je Spiel, ein schwacher darüber. */
test("der Gegentorschnitt hängt an Klasse und Verein", () => {
  const schnitt = (ovr, stufe) => {
    const zufall = K.rng(107);
    let sp = 0, gt = 0;
    for (let i = 0; i < 600; i++) { const l = K.saisonLeistung({ pos: "TW", ovr, rolle: "stamm" }, stufe, zufall); sp += l.spiele; gt += l.gegentore; }
    return gt / sp;
  };
  const spitze = schnitt(90, 5), unten = schnitt(58, 1);
  assert.ok(spitze < 1.1, `Weltklasse kassiert ${spitze.toFixed(2)} je Spiel`);
  assert.ok(unten > 1.4, `ein schwacher Torwart kassiert nur ${unten.toFixed(2)} je Spiel`);
  assert.ok(unten > spitze + 0.3, "der Unterschied muss deutlich sein");
});

// ── Verbandswechsel ──────────────────────────────────────────────────────────

/* DER FEHLER, DEN DAS FÄNGT: Die Karte versprach „Du wärest dort sofort gesetzt"
   und setzte nur ein Merkmal — das Land blieb, die Flagge blieb, die Titelchance
   blieb. Die wirksamste Entscheidung des Spiels tat gar nichts. */
test("der Verbandswechsel wechselt das Land", () => {
  const k = { ...K.neueKarriere({ name: "T", land: "GER", nummer: 9, pos: "ST", seed: 5 }), alter: 22, ovr: 80 };
  const r = K.entscheide(k, { label: "x", wirkung: { verbandswechsel: "AUT" } }, K.rng(11));
  assert.equal(r.karriere.land, "AUT", "das Land muss wirklich wechseln");
  assert.equal(r.karriere.verbandGewechselt, true);
  assert.ok(r.folgen.some((f) => /Deutschland → Österreich/.test(f.text)), JSON.stringify(r.folgen));
});

test("wer den Verband wechselt, wird früher berufen", () => {
  const ohne = { ovr: 70, land: "GER" };
  const mit = { ovr: 70, land: "AUT", verbandGewechselt: true };
  assert.equal(K.berufungAb(ohne), K.berufungsSchwelle("GER"));
  assert.equal(K.berufungAb(mit), K.berufungsSchwelle("AUT") - K.VERBAND_BONUS);
  assert.equal(K.nationalLeistung(ohne, K.rng(13)).spiele, 0, "mit 70 ist er noch nicht dabei");
  assert.ok(K.nationalLeistung(mit, K.rng(13)).spiele > 0, "nach dem Wechsel schon");
});

test("das angebotene Land liegt im selben Erdteil und hat eine andere Stärke", () => {
  const zufall = K.rng(17);
  for (const land of ["GER", "BR", "AUT", "JP", "MA", "US"]) {
    for (let i = 0; i < 40; i++) {
      const ziel = K.verbandsAngebot({ land }, zufall);
      if (!ziel) continue;
      assert.equal(K.erdteil(ziel), K.erdteil(land), `${land} → ${ziel} überspringt einen Erdteil`);
      assert.notEqual(K.nationStaerke(ziel), K.nationStaerke(land), `${land} → ${ziel} ändert nichts`);
    }
  }
  assert.equal(K.verbandsAngebot({ land: "NZ" }, zufall), null, "ohne Erdteil kein Angebot");
});

test("die Karte nennt das Land, das anklopft", () => {
  const k = { ...K.neueKarriere({ name: "T", land: "GER", nummer: 9, pos: "ST", seed: 5 }), alter: 20, ovr: 70 };
  const zufall = K.rng(19);
  /* Alle anderen Karten ausschliessen, indem wir gezielt die eine ziehen. */
  const andere = K.EREIGNISSE.filter((e) => e.key !== "grossvater").map((e) => e.key);
  const e = K.ziehEreignis(k, zufall, andere);
  assert.equal(e.key, "grossvater");
  assert.ok(e.ziel, "die Karte muss ein Land mitbringen");
  const wahl = e.optionen[0];
  assert.ok(wahl.label.includes(K.landName(e.ziel)), `Option heisst „${wahl.label}"`);
  assert.ok(e.text.includes(K.landName(e.ziel)), "das Land muss auch im Text stehen");
  assert.equal(wahl.wirkung.verbandswechsel, e.ziel);
  /* Nach dem Doppelpunkt, nie als „für X" — sonst fehlt bei der Hälfte der Länder
     der Artikel („für die Slowakei"). */
  assert.ok(!/für \S/.test(wahl.label), `Option „${wahl.label}" braucht einen Artikel`);
  assert.deepEqual(e.optionen[1].wirkung, {}, "die zweite Option ändert nichts");
});

// ── Ereigniskarten ───────────────────────────────────────────────────────────

test("jede Karte ist vollständig", () => {
  const keys = new Set();
  for (const e of K.EREIGNISSE) {
    assert.ok(e.key && !keys.has(e.key), `doppelter Schlüssel ${e.key}`);
    keys.add(e.key);
    assert.ok(e.titel && e.text, `${e.key}: Titel oder Text fehlt`);
    assert.ok(e.optionen.length >= 2, `${e.key}: braucht mindestens zwei Optionen`);
    for (const o of e.optionen) {
      assert.ok(o.label, `${e.key}: Option ohne Beschriftung`);
      assert.ok(o.wirkung, `${e.key}/${o.label}: keine Wirkung`);
      if (o.chance !== undefined) {
        assert.ok(o.chance > 0 && o.chance < 1, `${e.key}/${o.label}: Chance ${o.chance}`);
        assert.ok(o.sonst, `${e.key}/${o.label}: Chance ohne Gegenteil`);
      }
    }
    if (e.wenn) assert.equal(typeof e.wenn, "function", `${e.key}: wenn ist keine Funktion`);
  }
});

/* DER FEHLER, DEN DAS FÄNGT: Fünfzehn Karten, sechs je Laufbahn — ab der dritten
   Laufbahn kannte man alle, und keine hatte mit der eigenen Lage zu tun. */
test("die Karten sind an die Lage gebunden", () => {
  const basis = (x) => ({ ...K.neueKarriere({ name: "T", land: "GER", nummer: 9, pos: "ST", seed: 3 }), ...x });
  const moeglich = (k) => K.EREIGNISSE.filter((e) => !e.wenn || e.wenn(k)).map((e) => e.key);

  const jung = moeglich(basis({ alter: 17, ovr: 55 }));
  assert.ok(jung.includes("internat"), "mit siebzehn gehört das Internat dazu");
  assert.ok(!jung.includes("knie"), "mit siebzehn meldet sich kein Knie");
  assert.ok(!jung.includes("trainerschein"));

  const alt = moeglich(basis({ alter: 34, ovr: 74, abschluss: true, verein: { stufe: 3, liga: { land: "GER", stufe: 1 } } }));
  assert.ok(alt.includes("knie") && alt.includes("trainerschein"), "mit 34 schon");
  assert.ok(!alt.includes("internat") && !alt.includes("debuet"));
  /* Der Trainerschein setzt den Schulabschluss voraus — wer mit zwanzig nur
     gespielt hat, bekommt die Karte nie zu sehen. */
  const ohneSchule = moeglich(basis({ alter: 34, ovr: 74, verein: { stufe: 3, liga: { land: "GER", stufe: 1 } } }));
  assert.ok(!ohneSchule.includes("trainerschein"), "ohne Abschluss kein Schein");

  const feld = moeglich(basis({ alter: 26, pos: "ST" }));
  assert.ok(!feld.includes("patzer"), "ein Stürmer patzt nicht beim Abschlag");
  const tw = moeglich(basis({ alter: 26, pos: "TW", verein: { stufe: 4, liga: { land: "GER", stufe: 1 } } }));
  assert.ok(tw.includes("patzer") && tw.includes("elfmeterschiessen"));

  const daheim = moeglich(basis({ alter: 24, verein: { stufe: 3, liga: { land: "GER", stufe: 1 } } }));
  assert.ok(!daheim.includes("sprache"), "wer zu Hause spielt, hat kein Sprachproblem");
  const fremd = moeglich(basis({ alter: 24, verein: { stufe: 3, liga: { land: "ITA", stufe: 1 } } }));
  assert.ok(fremd.includes("sprache") && fremd.includes("heimweh"));

  const nachTitel = moeglich(basis({ alter: 27, verlauf: [{ titel: ["MBL"], spiele: 30, tore: 12, vorlagen: 5 }] }));
  assert.ok(nachTitel.includes("titelverteidigung"), "nach einem Titel steht die Wiederholung an");
  const ohneTitel = moeglich(basis({ alter: 27, verlauf: [{ titel: [], spiele: 30, tore: 12, vorlagen: 5 }] }));
  assert.ok(!ohneTitel.includes("titelverteidigung"));
});

/* Es muss IMMER eine Karte geben — auch für den ungewöhnlichsten Stand. Ein leerer
   Topf hiesse: kein Ereignis, und der Schritt fiele stumm aus. */
test("für jede Lage findet sich eine Karte", () => {
  const zufall = K.rng(23);
  const staende = [];
  for (const alter of [16, 19, 24, 31, 37]) {
    for (const pos of ["TW", "IV", "ZM", "ST"]) {
      for (const stufe of [0, 3, 5]) {
        staende.push({ ...K.neueKarriere({ name: "T", land: "GER", nummer: 1, pos, seed: alter }),
          alter, ovr: 50 + alter, verein: { stufe, liga: { land: "GER", stufe: stufe <= 2 ? 2 : 1 } } });
      }
    }
  }
  for (const k of staende) {
    const e = K.ziehEreignis(k, zufall);
    assert.ok(e && e.optionen?.length >= 2, `kein Ereignis für ${k.pos} mit ${k.alter}`);
    /* Und auch dann noch, wenn die letzten fünf gesperrt sind. */
    const gesperrt = K.EREIGNISSE.slice(0, 5).map((x) => x.key);
    assert.ok(K.ziehEreignis(k, zufall, gesperrt)?.optionen?.length >= 2);
  }
});

// ── Ein Turnier, ein Sieger ──────────────────────────────────────────────────

/* DER FEHLER, DEN DAS FÄNGT: Jede Nation würfelte für sich, mit 22 % je WM für die
   neun der obersten Gruppe — rechnerisch rund zwei Weltmeister je Turnier. */
test("über alle Nationen gibt es höchstens einen Sieger je Turnier", () => {
  const laender = [...new Set(alleLaender().map((l) => l.key))];
  for (const [turnier, erdteil] of [["WM", null], ["EM", "EU"], ["CA", "SA"]]) {
    const teilnehmer = laender.filter((l) => !erdteil || K.erdteil(l) === erdteil);
    const summe = teilnehmer.reduce((s, l) => s + K.siegChance(l, turnier), 0);
    assert.ok(summe <= 1.0001, `${turnier}: ${summe.toFixed(3)} Sieger je Turnier`);
    assert.ok(summe > 0.6, `${turnier}: nur ${summe.toFixed(3)} — das Feld ist aufgebläht`);
  }
});

/* DER FEHLER, DEN DAS FÄNGT: Ein Portugiese, der nie über Clermont und Burnley
   hinauskam, wurde im Spiel zweimal Weltmeister und einmal Europameister. Gemessen
   holte eine solche Laufbahn in 24 % aller Fälle einen Länderpokal. */
test("eine gewöhnliche Laufbahn einer grossen Nation gewinnt selten einen Länderpokal", () => {
  const zufall = K.rng(311);
  const verlauf = (peak) => Array.from({ length: 21 }, (_, i) => {
    const alter = 16 + i;
    return Math.round(alter <= 26 ? 50 + (peak - 50) * (alter - 16) / 10 : alter <= 30 ? peak : peak - (alter - 30) * 2);
  });
  const quote = (land, peak) => {
    let mit = 0;
    for (let n = 0; n < 3000; n++) {
      let t = 0;
      verlauf(peak).forEach((ovr, s) => { t += K.nationalTitel({ ovr, land }, { stufe: 3 }, zufall, s + 1).length; });
      if (t) mit++;
    }
    return mit / 3000;
  };
  const normal = quote("PRT", 74), spitze = quote("PRT", 90);
  assert.ok(normal < 0.10, `Höchstwert 74: ${(normal * 100).toFixed(1)} % holen einen Länderpokal`);
  assert.ok(spitze > 0.25 && spitze < 0.55, `Höchstwert 90: ${(spitze * 100).toFixed(1)} %`);
  assert.ok(quote("AUT", 90) < 0.06, "Österreich bleibt die Ausnahme");
});

test("im Turnierkader steht, wer deutlich über der Berufung liegt", () => {
  assert.equal(K.imKader({ ovr: K.berufungsSchwelle("GER"), land: "GER" }), K.KADER_SOCKEL);
  assert.equal(K.imKader({ ovr: K.berufungsSchwelle("GER") + K.KADER_SPANNE + 5, land: "GER" }), 1);
  assert.ok(K.imKader({ ovr: 78, land: "GER" }) < K.imKader({ ovr: 84, land: "GER" }));
});

// ── Der Lauf der Auswahl ─────────────────────────────────────────────────────

/* Nach dem Klick springt die Auswahl zwischen den beiden Ausgängen hin und her und
   bleibt auf einem stehen. Gelost wird dabei nichts: Der Ausgang steht vorher fest,
   der Lauf zeigt ihn nur. Diese Prüfung hält genau das fest. */
test("der Lauf endet immer auf dem wahren Ausgang", () => {
  for (const ziel of [0, 1]) {
    const lauf = K.wahlLauf(ziel);
    assert.equal(lauf.at(-1).feld, ziel, `Ziel ${ziel}: endet auf ${lauf.at(-1).feld}`);
    assert.ok(lauf.length >= 6, `nur ${lauf.length} Sprünge — das sieht nach nichts aus`);
  }
});

test("die Auswahl springt wirklich hin und her", () => {
  for (const ziel of [0, 1]) {
    const felder = K.wahlLauf(ziel).map((s) => s.feld);
    for (let i = 1; i < felder.length; i++)
      assert.notEqual(felder[i], felder[i - 1], `Sprung ${i} bleibt stehen: ${felder.join("")}`);
    assert.ok(felder.includes(0) && felder.includes(1), "beide Felder müssen vorkommen");
  }
});

/* Sie wird langsamer, nicht schneller — sonst wirkt das Stehenbleiben wie ein
   Abbruch statt wie ein Auslaufen. */
test("der Lauf wird langsamer und dauert nicht zu lang", () => {
  for (const ziel of [0, 1]) {
    const dauern = K.wahlLauf(ziel).map((s) => s.dauer);
    for (let i = 1; i < dauern.length; i++)
      assert.ok(dauern[i] >= dauern[i - 1], `Sprung ${i} ist schneller als der davor: ${dauern.join(",")}`);
    assert.equal(dauern.at(-1), K.WAHL_LETZT);
    const gesamt = K.wahlDauer(ziel);
    assert.ok(gesamt > 900 && gesamt < 2200, `${gesamt} ms — zu kurz zum Mitfiebern oder zu lang zum Warten`);
  }
});

/* Jede Option braucht ein Motiv, sonst steht die Kachel ohne Bild da. */
test("jede Option trägt ein Bildmotiv", () => {
  const ohne = [];
  for (const e of K.EREIGNISSE) for (const o of e.optionen) if (!o.bild) ohne.push(`${e.key}/${o.label}`);
  assert.deepEqual(ohne, [], "Option ohne Motiv");
});

/* ── Leere Kacheln, Gruppe für Gruppe ──────────────────────────────────────────
   Eine sichere Kachel mit `wirkung: {}` zeigt im Spiel „nichts ändert sich". Dann
   ist die Rechnung immer dieselbe: Die Wette daneben hat einen Erwartungswert über
   null, das Ablehnen keinen — es gibt nichts zu entscheiden.

   Alle vierzig Karten sind durchgegangen, die Liste ist leer, und sie soll leer
   bleiben. Kommt eine neue Karte mit einer leeren sicheren Kachel dazu, schlägt
   die Prüfung an.

   Eine WETTE mit leerem Gelingen ist etwas anderes und bleibt erlaubt: Bei „Auf die
   Zähne beissen" heisst der gute Ausgang, dass nichts passiert. Das ist eine
   Aussage, keine Lücke. */
const KACHELN_OHNE_WIRKUNG = [];

test("keine sichere Kachel ohne Wirkung", () => {
  const leer = [];
  for (const e of K.EREIGNISSE)
    for (const o of e.optionen)
      if (o.chance === undefined && !Object.keys(o.wirkung).filter((f) => f !== "text").length) leer.push(`${e.key}/${o.label}`);
  assert.deepEqual(leer.sort(), [...KACHELN_OHNE_WIRKUNG].sort());
});

test("die drei Trainingskarten sind drei verschiedene Wetten", () => {
  const drei = ["ernaehrung", "extraschicht", "trainer"].map((k) => K.EREIGNISSE.find((e) => e.key === k));
  for (const e of drei) {
    const [wette, sicher] = e.optionen;
    assert.ok(wette.chance > 0 && wette.chance < 1, `${e.key}: keine Wette`);
    assert.ok(Object.keys(sicher.wirkung).length, `${e.key}: sichere Kachel ist leer`);
    assert.equal(sicher.chance, undefined, `${e.key}: die zweite Kachel soll sicher sein`);
  }
  /* Jede trägt ein eigenes Risiko: die kleine Wette, die grosse (eine Saison weg),
     und die, die nicht die Stärke, sondern den Platz in der Elf betrifft. */
  const [ern, extra, trainer] = drei;
  assert.equal(extra.optionen[0].sonst.verletzt, 1);
  assert.equal(trainer.optionen[0].wirkung.rolle, "stamm");
  assert.equal(ern.optionen[0].sonst.verletzt, undefined);
  assert.equal(ern.optionen[0].wirkung.rolle, undefined);
});

test("das Präparat kostet eine Sperre, keine Verletzung", () => {
  const karte = K.EREIGNISSE.find((e) => e.key === "mittel");
  const [nehmen, lassen] = karte.optionen;
  assert.equal(nehmen.wirkung.ovr, 5);
  assert.equal(nehmen.sonst.ovr, -2);
  assert.equal(nehmen.sonst.gesperrt, 1);
  assert.equal(nehmen.sonst.verletzt, undefined, "eine Sperre ist keine Verletzung");
  /* Sauber bleiben ist nicht gratis — sonst wäre die moralische Wahl keine. */
  assert.ok(Object.keys(lassen.wirkung).length, "„Finger weg\" darf nicht leer sein");
});

test("eine Sperre fällt aus wie eine Verletzung, heisst aber anders", () => {
  const k = { ovr: 70, rolle: "stamm", alter: 24, land: "GER", verein: null };
  const sperre = K.entscheide(k, { label: "x", chance: 1, wirkung: { gesperrt: 1 } }, () => 0);
  assert.equal(sperre.ausfall, 1);
  assert.equal(sperre.grund, "gesperrt");
  const texte = sperre.folgen.map((f) => f.text);
  assert.ok(texte.some((t) => t.includes("gesperrt")), texte.join(" | "));
  assert.ok(!texte.some((t) => t.includes("verletzt")), texte.join(" | "));

  const riss = K.entscheide(k, { label: "x", wirkung: { verletzt: 2 } }, () => 0);
  assert.equal(riss.ausfall, 2);
  assert.equal(riss.grund, "verletzt");
  assert.ok(riss.folgen.some((f) => f.text.includes("verletzt")));

  /* Ohne Ausfall gibt es keinen Grund zu nennen. */
  const nichts = K.entscheide(k, { label: "x", wirkung: { ovr: 1 } }, () => 0);
  assert.equal(nichts.ausfall, 0);
});

/* ── Gruppe 2 ──────────────────────────────────────────────────────────────── */

test("Pfiffe kommen nur nach einer Saison, die dazu passt", () => {
  const karte = K.EREIGNISSE.find((e) => e.key === "pfiffe");
  const zeile = (ovr, titel = [], spiele = 30) => ({ ovr, titel, spiele });
  const bau = (verlauf) => ({ alter: 25, ovr: 70, verlauf });

  /* Gespielt, nichts gewonnen, Wert gefallen — die Pfiffe passen. */
  assert.equal(karte.wenn(bau([zeile(72), zeile(70)])), true);
  /* Wert gestiegen: kein Grund zu pfeifen. */
  assert.equal(karte.wenn(bau([zeile(68), zeile(72)])), false);
  /* Titel gewonnen: erst recht nicht. */
  assert.equal(karte.wenn(bau([zeile(72), zeile(70, ["MBL"])])), false);
  /* Kaum gespielt: dann pfeift niemand nach dir. */
  assert.equal(karte.wenn(bau([zeile(72), zeile(70, [], 3)])), false);
  /* Erste Saison: es gibt noch keinen Trend. */
  assert.equal(karte.wenn(bau([zeile(70)])), false);
  assert.equal(karte.wenn({ alter: 25, ovr: 70, verlauf: [] }), false);
});

test("ratingTrend vergleicht die beiden letzten Zeilen", () => {
  assert.equal(K.ratingTrend({ verlauf: [{ ovr: 60 }, { ovr: 64 }] }), 4);
  assert.equal(K.ratingTrend({ verlauf: [{ ovr: 64 }, { ovr: 60 }] }), -4);
  assert.equal(K.ratingTrend({ verlauf: [{ ovr: 64 }] }), 0);
  assert.equal(K.ratingTrend({}), 0);
});

test("Auskurieren ist nicht mehr die dumme Wahl", () => {
  const [auskurieren, beissen] = K.EREIGNISSE.find((e) => e.key === "verletzung").optionen;
  assert.equal(auskurieren.verletzt, undefined);
  assert.equal(auskurieren.wirkung.verletzt, 1);
  assert.ok(auskurieren.wirkung.ovr > 0, "die Reha muss etwas zurückgeben");
  /* Und die Gegenseite kostet weiterhin mehr, wenn sie schiefgeht. */
  assert.equal(beissen.sonst.verletzt, 1);
  assert.ok(beissen.sonst.ovr < 0);
});

test("wer im Endspiel abbricht, kostet die Mannschaft den Titel", () => {
  const [spielen] = K.EREIGNISSE.find((e) => e.key === "endspiel").optionen;
  for (const feld of ["liga", "pokal", "europa"]) {
    assert.ok(spielen.wirkung[feld] > 1, `${feld}: Gelingen muss helfen`);
    assert.ok(spielen.sonst[feld] < 1, `${feld}: der Rückschlag muss auch die Mannschaft treffen`);
  }
});

test("der Elfmeter kommt nur, wo es einen Pokal gibt", () => {
  const karte = K.EREIGNISSE.find((e) => e.key === "elfmeter");
  assert.equal(karte.wenn({ verein: { lg: "BL", liga: { land: "GER", stufe: 1 } } }), true);
  /* Saudi-Arabien führt in diesem Spiel keinen Pokal — dort verspräche die Karte
     einen Titel, den es nicht gibt. */
  assert.equal(karte.wenn({ verein: { lg: "SAU", liga: { land: "SA", stufe: 1 } } }), false);
  /* Und in der zweiten Liga genauso wenig — dort gibt es keinen Pokaltitel. */
  assert.equal(karte.wenn({ verein: { lg: "BL2", liga: { land: "GER", stufe: 2 } } }), false);
  /* Und beide Kacheln sagen etwas. */
  for (const o of karte.optionen) assert.ok(Object.keys(o.wirkung).length, o.label);
});

test("der Schulabschluss öffnet den Trainerschein und ist nicht dasselbe", () => {
  const schule = K.EREIGNISSE.find((e) => e.key === "schule");
  const schein = K.EREIGNISSE.find((e) => e.key === "trainerschein");
  /* Zwei verschiedene Dinge, zwei verschiedene Felder. Vorher setzten beide
     Karten `abschluss`, und der Trainerschein trug sich als Schulabschluss ein. */
  assert.equal(schule.optionen[0].wirkung.abschluss, true);
  assert.equal(schule.optionen[0].wirkung.trainerschein, undefined);
  assert.equal(schein.optionen[0].wirkung.trainerschein, true);
  assert.equal(schein.optionen[0].wirkung.abschluss, undefined);

  /* Ohne Abschluss kein Schein — mit ihm schon, und nur einmal. */
  assert.equal(schein.wenn({ alter: 34, abschluss: false }), false);
  assert.equal(schein.wenn({ alter: 34, abschluss: true }), true);
  assert.equal(schein.wenn({ alter: 34, abschluss: true, trainerschein: true }), false);
  assert.equal(schein.wenn({ alter: 30, abschluss: true }), false);

  /* Und die Schulkarte verschwindet, sobald der Abschluss da ist. */
  assert.equal(schule.wenn({ alter: 18, abschluss: false }), true);
  assert.equal(schule.wenn({ alter: 18, abschluss: true }), false);
});

test("entscheide trägt Abschluss und Schein getrennt ein", () => {
  const k = { ovr: 70, rolle: "stamm", alter: 20, land: "GER", verein: null };
  const a = K.entscheide(k, { label: "x", wirkung: { abschluss: true } }, () => 0);
  assert.equal(a.karriere.abschluss, true);
  assert.equal(a.karriere.trainerschein, undefined);
  const b = K.entscheide({ ...k, abschluss: true }, { label: "x", wirkung: { trainerschein: true } }, () => 0);
  assert.equal(b.karriere.trainerschein, true);
  assert.ok(b.folgen.some((f) => f.text.includes("Trainerschein")));
});

/* ── Gruppe 3 und der Rückhalt ─────────────────────────────────────────────── */

/* Ein grober, aber wirksamer Maßstab: Wie viel bringt eine Kachel im Schnitt, wenn
   man Stärke, Rolle und Titelaussicht in eine Zahl zwingt? Er taugt nicht, um
   Karten fein auszubalancieren — aber er zeigt die Karten, bei denen eine Kachel
   die andere in JEDER Hinsicht schlägt. Genau die sind keine Entscheidung. */
/* Eine Rolle in einer Wirkung ist eine ZUWEISUNG, kein Zuwachs — wohin sie führt,
   hängt davon ab, wo man herkommt. Gemessen wird sie darum gegen die Mitte:
   Stammplatz ist ein Gewinn, Rotation neutral, „nur im Kader" ein Verlust. */
const ROLLE_WERT = { stamm: 2, rotation: 0, kader: -2 };
function kachelWert(o) {
  const teil = (w) => {
    if (!w) return 0;
    let x = w.ovr ?? 0;
    if (w.rolle) x += ROLLE_WERT[w.rolle];
    for (const f of ["liga", "pokal", "europa"]) if (w[f]) x += (w[f] - 1) * 3;
    x -= (w.verletzt ?? 0) * 6;
    x -= (w.gesperrt ?? 0) * 6;
    x += (w.schutz ?? 0) * 1.5;
    if (w.klasse) x += (w.klasse - 1) * 4;   // Auf- oder Abstieg wiegt schwer
    /* Abschluss und Trainerschein kosten in der Laufbahn und zahlen danach — auf
       der Urkunde und, im Fall des Abschlusses, als Voraussetzung. Ohne diesen
       Posten meldet das Maß beide Karten als schief, obwohl sie es nicht sind. */
    if (w.abschluss || w.trainerschein) x += 1;
    return x;
  };
  if (o.chance === undefined) return teil(o.wirkung);
  return o.chance * teil(o.wirkung) + (1 - o.chance) * teil(o.sonst);
}

const EREIGNISSE_MIT_ZWEI = K.EREIGNISSE.filter((e) => e.optionen.length === 2);

/* Bei diesen Karten IST die Schieflage der Inhalt. „Ein Anruf, den man nicht
   annimmt" bietet Geld für eine gelbe Karte zur richtigen Minute — dass Auflegen
   die richtige Antwort ist, soll man nicht abwägen müssen. Eine solche Karte
   auszubalancieren hiesse, sie kaputtzumachen. */
const ABSICHTLICH_SCHIEF = new Set(["wetten"]);

test("keine Karte, bei der eine Kachel die andere deutlich schlägt", () => {
  /* Zwei Punkte Abstand sind der Rahmen, in dem eine Karte noch eine Wahl ist.
     Darüber hinaus gibt es keinen Grund mehr, die schwächere zu nehmen. */
  const schief = [];
  for (const e of EREIGNISSE_MIT_ZWEI.filter((x) => !ABSICHTLICH_SCHIEF.has(x.key))) {
    const [a, b] = e.optionen.map(kachelWert);
    if (Math.abs(a - b) > 2) schief.push(`${e.key} (${a.toFixed(2)} gegen ${b.toFixed(2)})`);
  }
  assert.deepEqual(schief, [], `eine Kachel dominiert: ${schief.join(", ")}`);
});

test("der Ausrüster ist wieder eine Wette", () => {
  const [ja, nein] = K.EREIGNISSE.find((e) => e.key === "ausruester").optionen;
  /* Vorher gewann „Unterschreiben" im besten Fall genau das, was „Absagen" sicher
     gab — es gab keinen Grund, jemals zu unterschreiben. */
  assert.ok(ja.wirkung.ovr > nein.wirkung.ovr, "der gute Ausgang muss die sichere Wahl schlagen");
  assert.ok(ja.sonst.ovr < 0, "und der schlechte muss wehtun");
});

test("Abwarten und Zuschauen kosten jetzt auch etwas", () => {
  const bank = K.EREIGNISSE.find((e) => e.key === "bank");
  assert.ok(bank.optionen[1].sonst.ovr < 0, "Im Training antworten war ohne Risiko");
  const wechsel = K.EREIGNISSE.find((e) => e.key === "trainerwechsel");
  assert.equal(wechsel.optionen[1].chance, undefined, "Abwarten ist jetzt die sichere Kachel");
  assert.ok(Object.keys(wechsel.optionen[1].wirkung).length);
  const debuet = K.EREIGNISSE.find((e) => e.key === "debuet");
  assert.equal(debuet.optionen[0].sonst.rolle, "kader", "ein missratenes Debüt kostet Ansehen");
});

test("Rückhalt fängt genau einen Rückschlag ab und ist dann weg", () => {
  const k = { ovr: 70, rolle: "stamm", alter: 24, land: "GER", verein: null };
  const wette = { label: "x", chance: 0.5, wirkung: { ovr: 3 }, sonst: { ovr: -5, verletzt: 1 } };
  const misslingt = () => 0.99, gelingt = () => 0.01;

  /* Ohne Polster trifft der Rückschlag voll. */
  const ohne = K.entscheide(k, wette, misslingt);
  assert.equal(ohne.abgefangen, false);
  assert.equal(ohne.karriere.ovr, 65);
  assert.equal(ohne.ausfall, 1);

  /* Mit Polster bleibt alles stehen — und das Polster ist verbraucht. */
  const mit = K.entscheide({ ...k, schutz: 1 }, wette, misslingt);
  assert.equal(mit.abgefangen, true);
  assert.equal(mit.gelungen, false, "schiefgegangen ist es trotzdem");
  assert.equal(mit.karriere.ovr, 70);
  assert.equal(mit.ausfall, 0);
  assert.equal(mit.karriere.schutz, 0);
  assert.ok(mit.folgen.some((f) => f.text.includes("Rückhalt")));

  /* Beim zweiten Rückschlag hilft es nicht mehr. */
  const zweiter = K.entscheide(mit.karriere, wette, misslingt);
  assert.equal(zweiter.abgefangen, false);
  assert.equal(zweiter.karriere.ovr, 65);

  /* Ein gelungener Einsatz verbraucht nichts. */
  const heil = K.entscheide({ ...k, schutz: 1 }, wette, gelingt);
  assert.equal(heil.abgefangen, false);
  assert.equal(heil.karriere.schutz, 1);
  assert.equal(heil.karriere.ovr, 73);
});

test("Rückhalt schützt nicht vor dem Preis einer sicheren Wahl", () => {
  /* „Finger weg" kostet einen Punkt. Das ist kein Rückschlag, sondern der Preis —
     wer ihn wegpolstert, nimmt der moralischen Entscheidung ihr Gewicht. */
  const k = { ovr: 70, rolle: "stamm", alter: 24, land: "GER", verein: null, schutz: 1 };
  const r = K.entscheide(k, { label: "x", wirkung: { ovr: -1 } }, () => 0.99);
  assert.equal(r.abgefangen, false);
  assert.equal(r.karriere.ovr, 69);
  assert.equal(r.karriere.schutz, 1);
});

test("der Familienberater ist der einzige, der Rückhalt gibt", () => {
  const geber = [];
  for (const e of K.EREIGNISSE)
    for (const o of e.optionen)
      if (o.wirkung.schutz || o.sonst?.schutz) geber.push(`${e.key}/${o.label}`);
  assert.deepEqual(geber, ["berater/Beim Familienberater bleiben"]);
});

test("die Binde nützt der Mannschaft, auch wenn ein anderer sie trägt", () => {
  const [, lassen] = K.EREIGNISSE.find((e) => e.key === "binde").optionen;
  assert.ok(lassen.wirkung.liga > 1 && lassen.wirkung.pokal > 1);
  assert.equal(lassen.wirkung.ovr, undefined, "persönlich gewinnt man nichts");
});

/* ── Gruppe 4: der Kampf um die Liga ───────────────────────────────────────── */

test("der Klassenfaktor bewegt Auf- und Abstieg wirklich", async () => {
  /* Mit echten Vereinen aus der echten Welt: Die Chance hängt jetzt am Feld der
     Liga, und das gibt es nur für Vereine, die durch baueWelt gingen. */
  const { VEREINS_STAERKE } = await import("./careerStaerke.js");
  const w = K.baueWelt((x) => VEREINS_STAERKE[x.key] ?? NaN);
  const zweite = w.vereine.find((x) => x.liga.key === "BL2" && x.stufe === 1);
  const erste = w.vereine.find((x) => x.liga.key === "BL" && x.stufe === 1);
  const auf = K.aufstiegsChance(zweite), ab = K.abstiegsChance(erste);
  assert.ok(auf > 0 && auf < 0.5 && ab > 0 && ab < 0.5, `auf ${auf}, ab ${ab}`);

  /* Knapp über der Grundchance: ohne Faktor kein Aufstieg, mit 1,8 schon. */
  const knapp = () => auf * 1.2;
  assert.equal(K.ligaWechsel(zweite, knapp, w.ligen).richtung, null);
  assert.equal(K.ligaWechsel(zweite, knapp, w.ligen, 1.8).richtung, "auf");
  /* Unter eins wird es schwerer. */
  assert.equal(K.ligaWechsel(zweite, () => auf * 0.9, w.ligen).richtung, "auf");
  assert.equal(K.ligaWechsel(zweite, () => auf * 0.9, w.ligen, 0.75).richtung, null);

  /* Abstieg: die Gefahr geteilt durch den Faktor. */
  assert.equal(K.ligaWechsel(erste, () => ab * 0.9, w.ligen).richtung, "ab");
  assert.equal(K.ligaWechsel(erste, () => ab * 0.9, w.ligen, 1.8).richtung, null);
  assert.equal(K.ligaWechsel(erste, () => ab * 1.2, w.ligen, 0.75).richtung, "ab");

  /* Ohne Schwesterliga gibt es nichts zu bewegen. */
  const allein = w.vereine.find((x) => x.liga.key === "MLS");
  assert.equal(K.ligaWechsel(allein, () => 0, w.ligen, 3).richtung, null);
});

/* ── Jede Liga hat ihre Plätze ──────────────────────────────────────────────── */

test("in jeder Liga steigen so viele ab und auf, wie es Plätze gibt", async () => {
  /* Vorher würfelte jeder Verein für sich: Österreich 2,5 Absteiger je Saison bei
     zehn Vereinen, LaLiga 0,3, aus der Championship 3,3 Aufsteiger. */
  const { VEREINS_STAERKE } = await import("./careerStaerke.js");
  const w = K.baueWelt((x) => VEREINS_STAERKE[x.key] ?? NaN);
  for (const liga of w.ligen) {
    const schwester = K.schwesterLiga(liga, w.ligen);
    if (!schwester) continue;
    const vs = w.vereine.filter((x) => x.liga.key === liga.key);
    const erwartet = vs.reduce((a, x) => a + (liga.stufe === 1 ? K.abstiegsChance(x) : K.aufstiegsChance(x)), 0);
    const plaetze = K.WECHSEL_PLAETZE[liga.land] ?? K.WECHSEL_PLAETZE_SONST;
    /* Der Deckel kann eine Liga mit einem einzigen, klar schwächsten Verein etwas
       unter ihre Plätze drücken — mehr als einen halben Platz aber nicht. */
    assert.ok(erwartet <= plaetze + 1e-9 && erwartet >= plaetze - 0.6,
      `${liga.key}: ${erwartet.toFixed(2)} je Saison bei ${plaetze} Plätzen`);
  }
});

test("wer stark ist, steigt nicht ab; wer schwach ist, eher als andere", async () => {
  const { VEREINS_STAERKE } = await import("./careerStaerke.js");
  const w = K.baueWelt((x) => VEREINS_STAERKE[x.key] ?? NaN);
  const bayern = w.vereine.find((x) => x.name.includes("Bayern"));
  assert.equal(K.abstiegsChance(bayern), 0);
  /* Innerhalb einer Liga fällt die Gefahr mit der Rufstufe, und keiner steigt sicher ab. */
  for (const key of ["BL", "PL", "AT", "PT"]) {
    const vs = w.vereine.filter((x) => x.liga.key === key).sort((a, b) => a.stufe - b.stufe);
    for (let i = 1; i < vs.length; i++) assert.ok(K.abstiegsChance(vs[i]) <= K.abstiegsChance(vs[i - 1]), key);
    for (const x of vs) assert.ok(K.abstiegsChance(x) <= K.WECHSEL_DECKEL, `${x.name}: ${K.abstiegsChance(x)}`);
  }
});

test("der Klassenfaktor wird genannt, wie er beim Verein ankommt", () => {
  const zweite = { liga: { land: "GER", stufe: 2 } };
  const erste = { liga: { land: "GER", stufe: 1 } };
  assert.equal(K.klasseText(1.8, zweite), "Aussicht auf den Aufstieg ×1,8");
  assert.equal(K.klasseText(0.8, zweite), "Aussicht auf den Aufstieg auf 80 %");
  assert.equal(K.klasseText(1.8, erste), "Abstiegsgefahr auf 56 %");
  assert.equal(K.klasseText(0.75, erste), "Abstiegsgefahr ×1,33");
  /* Kein Faktor, kein Verein, keine Schwesterliga: kein Satz. */
  assert.equal(K.klasseText(1, erste), null);
  assert.equal(K.klasseText(1.8, null), null);
  assert.equal(K.klasseText(1.8, { liga: { land: "SA", stufe: 1 } }), null);
});

test("Abstiegskampf und Aufstiegsrennen berühren die Tabelle", () => {
  for (const key of ["abstiegskampf", "aufstiegsrennen"]) {
    const e = K.EREIGNISSE.find((x) => x.key === key);
    const mit = e.optionen.filter((o) => o.wirkung.klasse || o.sonst?.klasse);
    assert.equal(mit.length, 2, `${key}: beide Kacheln müssen die Tabelle bewegen`);
    const [a, b] = e.optionen;
    assert.ok(a.wirkung.klasse > 1, `${key}: die mutige Kachel muss helfen`);
    assert.ok(b.wirkung.klasse < 1, `${key}: die bequeme Kachel muss kosten`);
  }
  /* Und keine von beiden erscheint, wo es gar keine Schwesterliga gibt. */
  const ab = K.EREIGNISSE.find((x) => x.key === "abstiegskampf");
  assert.equal(ab.wenn({ verein: { stufe: 1, liga: { key: "SAU", land: "SA", stufe: 1 } } }), false);
  assert.equal(ab.wenn({ verein: { stufe: 1, liga: { key: "BL", land: "GER", stufe: 1 } } }), true);
});

test("entscheide reicht den Klassenfaktor weiter", () => {
  const verein = { liga: { land: "GER", stufe: 1 } };
  const k = { ovr: 70, rolle: "stamm", alter: 28, land: "GER", verein };
  const r = K.entscheide(k, { label: "x", wirkung: { klasse: 1.8 } }, () => 0);
  assert.equal(r.mod.klasse, 1.8);
  assert.ok(r.folgen.some((f) => f.text.includes("Abstiegsgefahr")), r.folgen.map((f) => f.text).join(" | "));
  /* Ohne Faktor steht dort eine schlichte Eins — ligaWechsel rechnet damit. */
  assert.equal(K.entscheide(k, { label: "x", wirkung: { ovr: 1 } }, () => 0).mod.klasse, 1);
});

test("die Titelverteidigung kommt nur, wo es einen Titel zu verteidigen gibt", () => {
  const karte = K.EREIGNISSE.find((e) => e.key === "titelverteidigung");
  const nachTitel = (verein) => karte.wenn({ verein, verlauf: [{ ovr: 80, titel: ["WM"] }] });
  assert.equal(nachTitel({ lg: "BL", liga: { land: "GER", stufe: 1 } }), true);
  /* Weltmeister geworden, aber bei einem Zweitligisten: Dort gibt es weder eine
     Meisterschaft noch einen Pokal zu verteidigen. */
  assert.equal(nachTitel({ lg: "BL2", liga: { land: "GER", stufe: 2 } }), false);
});

/* ── Gruppe 5 ──────────────────────────────────────────────────────────────── */

test("die trotzige Kachel hat die höhere Decke", () => {
  /* Bei Sprache und Heimweh stand 35 bzw. 45 Prozent auf einen Punkt gegen 70 bis
     75 Prozent auf zwei — die zweite Kachel war nur Dekoration. Wer den harten Weg
     geht, muss dafür mehr gewinnen können als der, der den bequemen nimmt. */
  for (const key of ["sprache", "heimweh"]) {
    const [leicht, hart] = K.EREIGNISSE.find((e) => e.key === key).optionen;
    assert.ok(hart.chance < leicht.chance, `${key}: der harte Weg muss unwahrscheinlicher sein`);
    assert.ok(hart.wirkung.ovr > leicht.wirkung.ovr, `${key}: dafür muss er mehr bringen`);
  }
});

test("das Knie zu operieren lohnt sich wieder", () => {
  const [op, spritzen] = K.EREIGNISSE.find((e) => e.key === "knie").optionen;
  assert.equal(op.wirkung.verletzt, 1);
  /* Die Operation kostet sicher eine Saison. Gäbe sie weniger zurück als das
     Durchspritzen im Schnitt kostet, wäre die vernünftige Wahl, ein kaputtes Knie
     nicht behandeln zu lassen. */
  const spritzenSchaden = (1 - spritzen.chance) * Math.abs(spritzen.sonst.ovr);
  assert.ok(op.wirkung.ovr >= spritzenSchaden - 1, `Operation gibt nur ${op.wirkung.ovr} zurück`);
});

test("das Richtige ist bei der Kinderstation auch das Bessere", () => {
  const [zusagen, absagen] = K.EREIGNISSE.find((e) => e.key === "stiftung").optionen;
  assert.ok(zusagen.chance * zusagen.wirkung.ovr > (absagen.wirkung.ovr ?? 0),
    "Absagen darf nicht das bessere Geschäft sein");
});

test("das Abschiedsspiel verspricht nichts, was der Verein nicht spielt", () => {
  const karte = K.EREIGNISSE.find((e) => e.key === "abschiedsspiel");
  const alt = (verein) => karte.wenn({ alter: 34, vereine: ["a", "b", "c"], verein });
  assert.equal(alt({ lg: "BL", liga: { land: "GER", stufe: 1 } }), true);
  assert.equal(alt({ lg: "BL2", liga: { land: "GER", stufe: 2 } }), false);
});

test("alle vierzig Karten sind durchgegangen", () => {
  /* Der Schlusspunkt der fünf Gruppen: keine leere sichere Kachel, jede Karte mit
     zwei Optionen, jede Option mit Beschriftung und Motiv. */
  assert.equal(K.EREIGNISSE.length, 40);
  assert.deepEqual(KACHELN_OHNE_WIRKUNG, []);
  for (const e of K.EREIGNISSE) {
    assert.equal(e.optionen.length, 2, e.key);
    for (const o of e.optionen) {
      assert.ok(o.label && o.bild, `${e.key}: Kachel ohne Beschriftung oder Motiv`);
      assert.ok(Object.keys(o.wirkung).filter((f) => f !== "text").length || o.chance !== undefined,
        `${e.key}/${o.label}: sichere Kachel ohne Wirkung`);
    }
  }
});

test("alle Motive gibt es auch als Datei", async () => {
  const { readdirSync } = await import("node:fs");
  const da = new Set(readdirSync("public/bilder/wahl").map((f) => f.replace(/\.[a-z]+$/, "")));
  const genutzt = [...new Set(K.EREIGNISSE.flatMap((e) => e.optionen.map((o) => o.bild)))];
  const fehlen = genutzt.filter((m) => !da.has(m));
  assert.deepEqual(fehlen, [], "Motiv ohne Bilddatei");
  /* Und umgekehrt: kein Bild, das niemand zeigt. */
  const tot = [...da].filter((m) => !genutzt.includes(m));
  assert.deepEqual(tot, [], "Bilddatei, die keine Option verwendet");
});

/* ── Aus dem Durchspielen am 21.09.2026 ───────────────────────────────────── */

test("die Rolle gilt nur für den Verein, bei dem man sie bekam", () => {
  const bremen = { key: "SVW" }, kobe = { key: "VIS" };
  const k = { verein: bremen, rolle: "rotation" };
  /* Neuer Verein: neuer Anfang. */
  assert.equal(K.rolleNachWechsel(k, kobe), "stamm");
  /* Derselbe Verein — auch nach einem Abstieg, der nur die Liga tauscht. */
  assert.equal(K.rolleNachWechsel(k, { key: "SVW", liga: { stufe: 2 } }), "rotation");
  assert.equal(K.rolleNachWechsel({ verein: bremen, rolle: "kader" }, bremen), "kader");
  /* Der erste Verein einer Laufbahn. */
  assert.equal(K.rolleNachWechsel({ verein: null, rolle: "rotation" }, kobe), "stamm");
});

test("jeder Vereinswechsel läuft durch rolleNachWechsel", async () => {
  /* Die Regel nützt nichts, wenn der Schritt sie nicht aufruft. Alle Wechsel —
     Angebot, Leihe, Rückkehr, Bleiben — gehen durch spieleSchritt, und dort wird
     der Stand für den neuen Verein gebaut. */
  const { readFileSync } = await import("node:fs");
  const quelle = readFileSync(new URL("./Karriere.jsx", import.meta.url), "utf8");
  const schritt = quelle.split("function spieleSchritt")[1].split("\n  function ")[0];
  assert.match(schritt, /rolle:\s*K\.rolleNachWechsel\(basis,\s*verein\)/);
});

test("der Bestwert ist der höchste Wert der Laufbahn, nicht der letzte", () => {
  const k = { ovr: 67, verlauf: [{ ovr: 52 }, { ovr: 70 }, { ovr: 69 }] };
  assert.equal(K.bestwert(k), 70);
  /* Steht der Spieler gerade auf seinem Höchstwert, zählt der. */
  assert.equal(K.bestwert({ ovr: 72, verlauf: [{ ovr: 70 }] }), 72);
  assert.equal(K.bestwert({ ovr: 50, verlauf: [] }), 50);
});

/* ── Die Berufung hängt am Land ───────────────────────────────────────────── */

test("ein Land mit tiefem Kader beruft später", () => {
  assert.equal(K.berufungsSchwelle("GER"), K.BERUFUNG_A);
  assert.equal(K.berufungsSchwelle("BR"), K.BERUFUNG_A);
  assert.equal(K.berufungsSchwelle("JP"), K.BERUFUNG_B);
  assert.equal(K.berufungsSchwelle("AUT"), K.BERUFUNG_C);
  assert.equal(K.berufungsSchwelle("AT"), K.BERUFUNG_C, "beide Schreibweisen Österreichs");
  assert.equal(K.berufungsSchwelle("LU"), K.BERUFUNG_REST);
  /* Die Reihenfolge ist der Kern: Wer schwächer ist, beruft früher. */
  assert.ok(K.BERUFUNG_A > K.BERUFUNG_B && K.BERUFUNG_B > K.BERUFUNG_C && K.BERUFUNG_C > K.BERUFUNG_REST);
});

test("der Österreicher aus dem Durchspielen wird jetzt berufen", () => {
  /* Höchstwert 70, 178 Spiele in England — vorher kein einziges Länderspiel. */
  const at = { ovr: 70, land: "AUT", pos: "OM" };
  assert.ok(K.nationalLeistung(at, K.rng(3)).spiele > 0);
  /* Ein Deutscher mit demselben Wert bleibt zu Hause. */
  assert.equal(K.nationalLeistung({ ...at, land: "GER" }, K.rng(3)).spiele, 0);
});

test("der Verbandswechsel nennt die alte Schwelle als Vergleich, nicht eine feste", () => {
  const k = { ovr: 70, rolle: "stamm", alter: 22, land: "GER", verein: null };
  const r = K.entscheide(k, { label: "x", wirkung: { verbandswechsel: "PL" } }, () => 0);
  const zeile = r.folgen.find((f) => /berufen ab/.test(f.text));
  assert.ok(zeile, r.folgen.map((f) => f.text).join(" | "));
  assert.match(zeile.text, new RegExp(`berufen ab ${K.berufungsSchwelle("PL") - K.VERBAND_BONUS} statt ${K.BERUFUNG_A}`));
});

/* ── Kein leerer Stammplatz ───────────────────────────────────────────────── */

test("wer schon Stammspieler ist, gewinnt bei keiner Karte nur den Stammplatz", () => {
  /* Für einen Stammspieler ist „Stammplatz" kein Gewinn. Eine Wette, deren guter
     Ausgang nur daraus besteht, hätte für ihn keine Seite nach oben. Geprüft wird
     jede Karte, die einem gewöhnlichen Stammspieler begegnen kann. */
  const verlauf = [{ ovr: 70, titel: [], spiele: 30 }, { ovr: 69, titel: [], spiele: 30 }];
  const k = { alter: 25, ovr: 69, rolle: "stamm", land: "GER", pos: "ST", vereine: ["A", "B", "C"], verlauf,
    verein: { key: "X", stufe: 3, lg: "BL", liga: { key: "BL", land: "GER", stufe: 1 } }, national: { spiele: 3 } };
  const hohl = [];
  for (const e of K.EREIGNISSE) {
    let passt;
    try { passt = !e.wenn || e.wenn(k); } catch { passt = false; }
    if (!passt) continue;
    for (const o of e.optionen) {
      const gewinn = Object.keys(o.wirkung).filter((f) => !(f === "rolle" && o.wirkung.rolle === "stamm"));
      if (o.wirkung.rolle === "stamm" && !gewinn.length) hohl.push(`${e.key}/${o.label}`);
    }
  }
  assert.deepEqual(hohl, []);
});

test("Konkurrenz und Talent kommen nur, wenn man einen Platz zu verteidigen hat", () => {
  const verein = { key: "X", stufe: 3, lg: "BL", liga: { key: "BL", land: "GER", stufe: 1 } };
  for (const key of ["konkurrenz", "talent"]) {
    const e = K.EREIGNISSE.find((x) => x.key === key);
    assert.equal(e.wenn({ rolle: "stamm", verein }), true, key);
    assert.equal(e.wenn({ rolle: "rotation", verein }), false, key);
  }
});

test("für einen Stammspieler ist Sich-Anbieten wieder eine echte Wahl", () => {
  const [anbieten, abwarten] = K.EREIGNISSE.find((e) => e.key === "trainerwechsel").optionen;
  /* Stammplatz zählt für ihn nicht; es bleibt die Stärke. */
  assert.ok(anbieten.wirkung.ovr > abwarten.wirkung.ovr, "der Mutige muss mehr gewinnen können");
});

/* ── Kein stummer Ausgang ─────────────────────────────────────────────────── */

test("jeder Ausgang ohne Zahlen hat einen Satz", () => {
  /* „▲ nichts ändert sich" nach einem gewonnenen Einsatz klang nicht nach Glück. */
  const stumm = [];
  for (const e of K.EREIGNISSE) for (const o of e.optionen) {
    if (o.chance === undefined) continue;
    for (const [seite, w] of [["gelingt", o.wirkung], ["misslingt", o.sonst || {}]])
      if (!Object.keys(w).length) stumm.push(`${e.key}/${o.label} (${seite})`);
  }
  assert.deepEqual(stumm, []);
});

test("der Satz steht in der Folge — grün beim Gelingen, neutral beim Rückschlag", () => {
  const k = { ovr: 70, rolle: "stamm", alter: 31, land: "GER", verein: null };
  const knie = K.EREIGNISSE.find((e) => e.key === "knie").optionen[1];
  const glueck = K.entscheide(k, knie, () => 0.01);
  assert.deepEqual(glueck.folgen, [{ text: "Das Knie hält", art: "gut" }]);
  const stift = K.EREIGNISSE.find((e) => e.key === "stiftung").optionen[0];
  const pech = K.entscheide(k, stift, () => 0.99);
  assert.deepEqual(pech.folgen, [{ text: "Es kostet nur freie Tage", art: "neutral" }]);
});

test("ein Satz ist keine Wirkung: er ändert keine Zahl", () => {
  const k = { ovr: 70, rolle: "stamm", alter: 31, land: "GER", verein: null, schutz: 0 };
  const r = K.entscheide(k, { label: "x", wirkung: { text: "Nur Worte" } }, () => 0);
  assert.equal(r.karriere.ovr, 70);
  assert.equal(r.karriere.rolle, "stamm");
  assert.equal(r.ausfall, 0);
  assert.deepEqual(r.mod, { liga: 1, pokal: 1, europa: 1, klasse: 1 });
});
