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

test("die Titelchance steigt mit der Rufstufe", () => {
  const zufall = K.rng(21);
  const quote = (verein, key) => {
    let n = 0;
    for (let i = 0; i < 2000; i++) if (K.saisonTitel(verein, zufall).includes(key)) n++;
    return n / 2000;
  };
  const spitze = { lg: "BL", stufe: 5 }, mitte = { lg: "BL", stufe: 3 }, keller = { lg: "BL", stufe: 0 };
  assert.ok(quote(spitze, "MBL") > quote(mitte, "MBL"));
  assert.ok(quote(mitte, "MBL") > 0);
  assert.equal(quote(keller, "MBL"), 0, "Stufe null wird nie Meister");
  assert.ok(quote(keller, "DFB") > 0, "im Pokal ist auch unten etwas möglich");
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
    for (let i = 0; i < 2000; i++) if (K.saisonTitel({ lg: "BL", stufe: 4 }, zufall, mod).includes("MBL")) n++;
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
  const zufall = K.rng(29);
  const jung = { ...K.neueKarriere({ name: "T", land: "XXX", nummer: 1, pos: "ST" }), ovr: 80, alter: 26 };
  const alt = { ...jung, alter: K.SPAET_AB };
  assert.ok(K.angebote(welt, jung, zufall).length > K.angebote(welt, alt, zufall).length);
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
  const fast = { ...leer(), titel: { CL: 4 } };
  assert.ok(!K.erreichteAuszeichnungen(fast).some((a) => a.key === "fuenf_ohren"));
  const ganz = { ...leer(), titel: { CL: 5 } };
  assert.ok(K.erreichteAuszeichnungen(ganz).some((a) => a.key === "fuenf_ohren"));
  const alle = { ...leer(), titel: { MBL: 1, MPL: 1, MLL: 1, MSA: 1, ML1: 1 } };
  assert.ok(K.erreichteAuszeichnungen(alle).some((a) => a.key === "europas_erster"));
  const vier = { ...leer(), titel: { MBL: 1, MPL: 1, MLL: 1, MSA: 1 } };
  assert.ok(!K.erreichteAuszeichnungen(vier).some((a) => a.key === "europas_erster"));
});

/* EINE AUSZEICHNUNG, DIE NIEMAND ERREICHEN KANN, IST EIN GEBROCHENES VERSPRECHEN.
   Deshalb wird für jede eine Laufbahn gebaut, die sie erfüllt — fällt eine durch,
   steht sie im Spiel und ist trotzdem tot. */
test("jede Auszeichnung ist erreichbar", () => {
  const beispiele = {
    fuenf_ohren:    { titel: { CL: 5 } },
    unvollendet:    {},
    europas_erster: { titel: { MBL: 1, MPL: 1, MLL: 1, MSA: 1, ML1: 1 } },
    vereinstreue:   { vereine: ["A"], titel: { MBL: 1, DFB: 1, CL: 1 } },
    aus_der_zweiten:{ aufstiegMitMeister: true },
    riesentoeter:   { europaMitKleinem: true },
    das_triple:     { triple: true },
    wanderer:       { vereine: Array.from({ length: 15 }, (_, i) => "V" + i) },
    grenzgaenger:   { laender: ["GER", "ENG", "ESP", "ITA", "FRA", "POR", "NED"] },
    torfabrik:      { gesamt: { spiele: 700, tore: 500, vorlagen: 100 } },
    der_ewige:      { alter: 38 },
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
