import { test } from "node:test";
import assert from "node:assert/strict";
import * as K from "./karriere.js";

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
  assert.deepEqual(mod.mod, { liga: 2, pokal: 1, europa: 0.5 });
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

const leer = () => ({ ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), vereine: ["A"], laender: ["XXX"] });

test("wer nichts gewonnen hat, bekommt genau eine Auszeichnung", () => {
  const a = K.erreichteAuszeichnungen(leer());
  assert.deepEqual(a.map((x) => x.key), ["unvollendet"]);
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
  const vier = { ...leer(), titel: { MBL: 1, MPL: 1, MLL: 1, MSA: 1 } };
  assert.ok(K.erreichteAuszeichnungen(vier).some((a) => a.key === "europas_erster"));
  const drei = { ...leer(), titel: { MBL: 1, MPL: 1, MLL: 1 } };
  assert.ok(!K.erreichteAuszeichnungen(drei).some((a) => a.key === "europas_erster"));
});

/* EINE AUSZEICHNUNG, DIE NIEMAND ERREICHEN KANN, IST EIN GEBROCHENES VERSPRECHEN.
   Deshalb wird für jede eine Laufbahn gebaut, die sie erfüllt — fällt eine durch,
   steht sie im Spiel und ist trotzdem tot. */
test("jede Auszeichnung ist erreichbar", () => {
  const beispiele = {
    fuenf_ohren:    { titel: { CL: 5 } },
    unvollendet:    {},
    europas_erster: { titel: { MBL: 1, MPL: 1, MLL: 1, MSA: 1 } },
    vereinstreue:   { vereine: ["A"], titel: { MBL: 1, DFB: 1, CL: 1 } },
    aus_der_zweiten:{ aufstiegMitMeister: true },
    riesentoeter:   { europaMitKleinem: true },
    das_triple:     { triple: true },
    wanderer:       { vereine: Array.from({ length: 10 }, (_, i) => "V" + i) },
    grenzgaenger:   { laender: ["GER", "ENG", "ESP", "ITA", "FRA", "POR", "NED"] },
    torfabrik:      { gesamt: { spiele: 700, tore: 300, vorlagen: 100 } },
    der_ewige:      { alter: 36, verein: { stufe: 5 } },
    goldjunge:      { bdoAlter: 22, titel: { BDO: 1 } },
    der_groesste:   { titel: { WM: 1, CL: 4, BDO: 6 } },
    doppelbuerger:  { verbandGewechselt: true, titel: { EM: 1 } },
    sammler:        { titel: { MBL: 13, DFB: 12 } },
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
    assert.deepEqual(K.nationalTitel({ ovr: K.NATIONALELF_AB - 1 }, { stufe: 5 }, zufall, 0), []);
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
function spieleDurch(seed, stil, welt) {
  const zufall = K.rng(seed * 7919 + 13);
  let k = K.neueKarriere({ name: "P", land: "XXX", nummer: 9, pos: "ST", tempo: "normal", seed });
  let verein = K.jugendAngebote(welt, "XXX", zufall)[0];
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
  assert.ok(texte.some((t) => t.includes("Meisterschaft") && t.includes("1.6")), texte.join(" | "));
  assert.ok(texte.some((t) => t.includes("Pokal") && t.includes("50")), texte.join(" | "));
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

test("der Rest geht nicht verloren — zwei halbe Schritte ergeben einen ganzen", () => {
  const halb = { ...K.neueKarriere({ name: "T", pos: "ZM", land: "GER", nummer: 9 }), rest: 0.5 };
  const a = K.wachstumGanz({ ...halb, rest: 0 }, 0, () => 0);
  const b = K.wachstumGanz({ ...halb, rest: a.rest }, 0, () => 0);
  assert.equal(Math.round((a.zuwachs + a.rest + b.zuwachs + b.rest) * 100) / 100,
    Math.round((a.zuwachs + a.rest) * 100) / 100 + Math.round((b.zuwachs + b.rest) * 100) / 100);
  assert.ok(Number.isInteger(a.zuwachs) && Number.isInteger(b.zuwachs));
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
