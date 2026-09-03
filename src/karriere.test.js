import { test } from "node:test";
import assert from "node:assert/strict";
import * as K from "./karriere.js";
import { KLASSE_MIN, KLASSE_MAX } from "./draft.js";

/* Eine kleine Welt mit bekannter Rangfolge: drei Ligen, sieben Vereine. */
const ROH = [
  { key: "AAA", name: "Spitze A", lg: "XL" },
  { key: "BBB", name: "Mitte A", lg: "XL" },
  { key: "CCC", name: "Keller A", lg: "XL" },
  { key: "DDD", name: "Spitze B", lg: "YL" },
  { key: "EEE", name: "Keller B", lg: "YL" },
  { key: "FFF", name: "Ohne Daten", lg: "YL" },
  { key: "GGG", name: "Einzelverein", lg: "ZL" },
];
const STAERKE = { AAA: 96, BBB: 84, CCC: 74, DDD: 92, EEE: 76, GGG: 88 };
const welt = K.baueWelt(ROH, (v) => STAERKE[v.key] ?? NaN);
const vonKey = (key) => welt.vereine.find((v) => v.key === key);

const spieler = (o) => K.neueKarriere({ name: "Test", nation: "GER", nummer: 9, pos: "ST", verein: vonKey("BBB"), seed: 1, ...o });

// ── Welt ─────────────────────────────────────────────────────────────────────

test("das Niveau ist die Mannschaftsstärke ohne den Verbund", () => {
  /* Sonst verglichen wir einen Spielerwert mit einem Mannschaftswert: `teamStaerke`
     enthält den vollen Verbundbonus, den eine Mannschaft hat und ein Spieler nie. */
  assert.equal(vonKey("AAA").niveau, 96 - 9);
  assert.equal(vonKey("CCC").niveau, 74 - 9);
});

test("Vereine ohne Kaderdaten fallen aus der Welt", () => {
  assert.equal(welt.vereine.length, 6);
  assert.equal(vonKey("FFF"), undefined);
});

test("der Rang gilt je Liga, nicht über alle", () => {
  /* Der Beste ist Erster, der Schlechteste Letzter — dazwischen wird gestaucht. */
  assert.equal(vonKey("AAA").ligaRang, 1);
  assert.ok(vonKey("BBB").ligaRang > 1 && vonKey("BBB").ligaRang < vonKey("CCC").ligaRang);
  /* Der zweitstärkste Verein der Welt ist trotzdem Erster seiner Liga. */
  assert.equal(vonKey("DDD").ligaRang, 1);
  assert.equal(vonKey("GGG").ligaRang, 1);
});

/* DER FEHLER, DEN DAS FÄNGT: Unsere Welt kennt 31 Bundesligavereine aus sechzehn
   Jahren, eine Tabelle hat aber achtzehn Plätze — der 1. FC Nürnberg stand auf
   „Platz 21". */
test("Tabellenplätze gehen nie über die echte Ligagröße hinaus", () => {
  const viele = Array.from({ length: 31 }, (_, i) => ({ key: `V${i}`, name: `V${i}`, lg: "BL" }));
  const w = K.baueWelt(viele, (v) => 95 - Number(v.key.slice(1)) * 0.5);
  for (const v of w.vereine) {
    assert.equal(v.ligaGroesse, K.LIGA_PLAETZE.BL);
    assert.ok(v.ligaRang >= 1 && v.ligaRang <= 18, `${v.name}: Rang ${v.ligaRang}`);
  }
  assert.equal(w.vereine[0].ligaRang, 1);
  assert.equal(w.vereine.at(-1).ligaRang, 18);
});

// ── Einsatzzeit ──────────────────────────────────────────────────────────────

/* DER FEHLER, DEN DIESE PRÜFUNG FÄNGT: Ohne den Versatz in der Kurve stand ein
   Spieler auf Augenhöhe mit seinem Verein bei 0,5 und kam auf fünfzehn von 34
   Spielen. Wer das Niveau seines Vereins hat, ist Stammspieler. */
test("wer auf dem Niveau seines Vereins liegt, ist Stammspieler", () => {
  const gleich = K.einsatzAnteil(80, 80, 100, 100);
  /* Gemessen 69 % — also 23 von 34 Spielen. Das ist ein Stammspieler mit den
     üblichen Pausen, kein Ergänzungsspieler. Ohne den Versatz waren es 44 %. */
  assert.ok(gleich > 0.65, `nur ${(gleich * 100).toFixed(0)} % Einsatzzeit bei Gleichstand`);
  assert.ok(K.einsatzAnteil(88, 80, 100, 100) > gleich, "besser als der Verein heißt mehr Spiele");
  assert.ok(K.einsatzAnteil(70, 88, 100, 100) < 0.25, "acht Punkte darunter ist Bank");
});

test("Einsatzzeit steigt monoton mit der Stärke und bleibt im Rahmen", () => {
  let vorher = -1;
  for (let o = 60; o <= 99; o++) {
    const a = K.einsatzAnteil(o, 80);
    assert.ok(a >= vorher, `fällt bei ${o}`);
    assert.ok(a > 0 && a < 1);
    vorher = a;
  }
  /* Verletzt und ohne Form spielt auch ein Weltklassemann weniger. */
  assert.ok(K.einsatzAnteil(90, 75, 20, 10) < K.einsatzAnteil(90, 75, 100, 100));
});

// ── Saisonleistung ───────────────────────────────────────────────────────────

test("Tore hängen an Position, Stärke und Umfeld", () => {
  const zufall = K.rng(5);
  const schnitt = (k, niveau) => {
    let t = 0;
    for (let n = 0; n < 400; n++) t += K.saisonLeistung(k, niveau, zufall).tore;
    return t / 400;
  };
  /* Alle drei auf Augenhöhe mit ihrem Verein — sonst vergliche man Bankdrücker. */
  const auf = (pos) => ({ ...spieler({ pos }), overall: 82, form: 70, fitness: 90 });
  const stuermer = schnitt(auf("ST"), 80);
  const mittelfeld = schnitt(auf("MF"), 80);
  const abwehr = schnitt(auf("ABW"), 80);
  assert.ok(stuermer > mittelfeld && mittelfeld > abwehr, `${stuermer} / ${mittelfeld} / ${abwehr}`);
  /* Ein Verteidiger trifft selten, aber nicht nie. */
  assert.ok(abwehr > 0.3 && abwehr < 6, `Verteidiger ${abwehr}`);

  const stark = { ...auf("ST"), overall: 92 };
  const schwach = { ...auf("ST"), overall: 70 };
  assert.ok(schnitt(stark, 85) > schnitt(schwach, 85) * 2.5, "Stärke muss klar durchschlagen");
});

/* Die Größenordnung: Ein Spitzenstürmer bei einem Spitzenverein soll auf zwanzig bis
   dreißig Ligatore kommen, kein Dutzend und keine sechzig. */
test("ein Spitzenstürmer erreicht eine realistische Torausbeute", () => {
  const zufall = K.rng(11);
  const k = { ...spieler({ pos: "ST" }), overall: 92, form: 80, fitness: 90 };
  let tore = 0, spiele = 0;
  for (let n = 0; n < 300; n++) { const l = K.saisonLeistung(k, 86, zufall); tore += l.tore; spiele += l.spiele; }
  const jeSaison = tore / 300;
  assert.ok(jeSaison > 15 && jeSaison < 35, `${jeSaison.toFixed(1)} Tore je Saison`);
  assert.ok(spiele / 300 > 24, `nur ${(spiele / 300).toFixed(1)} Spiele je Saison`);
});

// ── Verein und Titel ─────────────────────────────────────────────────────────

test("der Tabellenplatz bleibt in der Liga und folgt dem Niveau", () => {
  const zufall = K.rng(3);
  const platz = (key) => {
    let s = 0;
    for (let n = 0; n < 400; n++) {
      const p = K.ligaPlatz(vonKey(key), spieler(), zufall);
      assert.ok(p >= 1 && p <= vonKey(key).ligaGroesse, `${key}: Platz ${p}`);
      s += p;
    }
    return s / 400;
  };
  assert.ok(platz("AAA") < platz("BBB"), "der stärkere Verein steht im Schnitt weiter oben");
  assert.ok(platz("BBB") < platz("CCC"));
});

test("nur der Erste wird Meister, und der Pokal ist ein Sonderweg", () => {
  const zufall = K.rng(4);
  const bl = { ...vonKey("AAA"), lg: "BL" };
  let meister = 0, pokal = 0;
  for (let n = 0; n < 500; n++) {
    const t = K.vereinsTitel(bl, 1, spieler(), zufall);
    if (t.includes("MBL")) meister++;
    if (t.includes("DFB")) pokal++;
  }
  assert.equal(meister, 500, "Platz eins ist immer der Titel");
  assert.ok(pokal > 60 && pokal < 250, `Pokal ${pokal} von 500`);
  assert.deepEqual(K.vereinsTitel(bl, 2, spieler(), K.rng(9)).filter((t) => t === "MBL"), []);
  /* Ligen ohne Meisterschlüssel (Portugal, Niederlande) vergeben keinen. */
  assert.deepEqual(K.vereinsTitel({ ...bl, lg: "NL" }, 1, spieler(), K.rng(9)), []);
});

test("Europapokal gibt es nur nach guter Vorsaison", () => {
  const zufall = K.rng(6);
  const stark = { ...vonKey("AAA"), lg: "BL" };
  assert.deepEqual(K.europaTitel(stark, null, spieler(), zufall), [], "ohne Vorsaison nichts");
  assert.deepEqual(K.europaTitel(stark, 12, spieler(), zufall), [], "Platz zwölf reicht nicht");
  let cl = 0, el = 0;
  for (let n = 0; n < 600; n++) {
    if (K.europaTitel(stark, 1, spieler(), zufall).includes("CL")) cl++;
    if (K.europaTitel(stark, 5, spieler(), zufall).includes("EL")) el++;
  }
  assert.ok(cl > 10 && cl < 250, `CL ${cl} von 600`);
  assert.ok(el > 10, `EL ${el} von 600`);
});

// ── Nationalmannschaft ───────────────────────────────────────────────────────

test("Turniere wechseln sich ab, Südamerika spielt die Copa", () => {
  assert.equal(K.turnierIn(4, "GER"), "WM");
  assert.equal(K.turnierIn(8, "BRA"), "WM");
  assert.equal(K.turnierIn(2, "GER"), "EM");
  assert.equal(K.turnierIn(2, "BRA"), "CA");
  assert.equal(K.turnierIn(2, "ARG"), "CA");
  assert.equal(K.turnierIn(3, "GER"), null, "in ungeraden Saisons ist Pause");
});

test("die Berufungsschwelle steigt mit der Stärke der Nation", () => {
  assert.ok(K.nationsSchwelle(90) > K.nationsSchwelle(40), "in Brasilien ist die Konkurrenz größer");
  assert.ok(K.nationsSchwelle(50) > 65 && K.nationsSchwelle(90) < 90);
});

test("ohne Turnier gibt es keinen Titel", () => {
  assert.deepEqual(K.nationalTitel(null, 90, spieler(), K.rng(1)), []);
});

// ── Einzelauszeichnungen ─────────────────────────────────────────────────────

test("der Ballon d'Or verlangt Weltklasse UND einen großen Titel", () => {
  const zufall = K.rng(8);
  const welt2 = { ...spieler(), overall: 94 };
  const grosseSaison = { tore: 34, vorlagen: 12, spiele: 33, anteil: 0.95 };
  let ohneTitel = 0, mitTitel = 0;
  for (let n = 0; n < 400; n++) {
    if (K.einzelTitel(welt2, grosseSaison, [], zufall).includes("BDO")) ohneTitel++;
    if (K.einzelTitel(welt2, grosseSaison, ["CL"], zufall).includes("BDO")) mitTitel++;
  }
  assert.equal(ohneTitel, 0, "ohne großen Titel niemals");
  assert.ok(mitTitel > 20, `mit Titel ${mitTitel} von 400`);
  /* Und selbst mit Titel nicht für einen Durchschnittsspieler. */
  const mittel = { ...spieler(), overall: 84 };
  assert.equal(K.einzelTitel(mittel, grosseSaison, ["CL"], K.rng(2)).includes("BDO"), false);
});

test("die Torjägerkanone hat je Position eine eigene Marke", () => {
  const zufall = K.rng(12);
  const wenig = { tore: 4, vorlagen: 2, spiele: 30, anteil: 0.9 };
  assert.equal(K.einzelTitel(spieler({ pos: "ST" }), wenig, [], zufall).includes("TSK"), false);
  let treffer = 0;
  for (let n = 0; n < 200; n++) {
    if (K.einzelTitel(spieler({ pos: "ABW" }), { tore: 9, vorlagen: 1, spiele: 34, anteil: 1 }, [], zufall).includes("TSK")) treffer++;
  }
  assert.ok(treffer > 40, "neun Tore sind für einen Verteidiger eine Kanone");
});

// ── Entscheidungen ───────────────────────────────────────────────────────────

test("jede Entscheidung kostet etwas und bringt etwas", () => {
  for (const e of K.EREIGNISSE) {
    assert.ok(e.frage && e.wahlen.length >= 2, e.key);
    for (const w of e.wahlen) {
      const werte = Object.values(w.wirkung || {});
      assert.ok(werte.length, `${e.key}: „${w.text}" wirkt gar nicht`);
    }
    /* KEINE WAHL DARF JEDE ANDERE SCHLAGEN. Eine Wahl mit lauter kleinen Vorteilen
       ist in Ordnung, solange eine andere auf irgendeiner Achse besser ist — sonst
       gäbe es nichts zu entscheiden. */
    const achsen = ["overall", "fitness", "moral", "ruf"];
    for (const a of e.wahlen) {
      const schlaegtAlle = e.wahlen.filter((b) => b !== a).every((b) =>
        achsen.every((x) => (a.wirkung[x] || 0) >= (b.wirkung[x] || 0)) && (a.risiko || 0) <= (b.risiko || 0));
      assert.ok(!schlaegtAlle, `${e.key}: „${a.text}" ist jeder anderen Wahl überlegen`);
    }
  }
});

test("Werte bleiben in ihren Grenzen", () => {
  const hart = { ...spieler(), overall: K.OVERALL_MAX, fitness: 100, moral: 100, ruf: 100 };
  const nachOben = K.entscheide(hart, { wirkung: { overall: 9, fitness: 40, moral: 40, ruf: 40 } });
  assert.equal(nachOben.overall, K.OVERALL_MAX);
  assert.equal(nachOben.fitness, 100);
  assert.equal(nachOben.ruf, 100);
  const schwach = { ...spieler(), overall: K.OVERALL_START, fitness: 5, moral: 5 };
  const nachUnten = K.entscheide(schwach, { wirkung: { overall: -9, fitness: -40, moral: -40 } });
  assert.equal(nachUnten.overall, K.OVERALL_START, "unter den Skalenboden geht es nicht");
  assert.ok(nachUnten.fitness >= 5);
});

test("Ereignisse wiederholen sich nicht, solange es neue gibt", () => {
  const k = spieler();
  const gesehen = [];
  for (let i = 0; i < K.EREIGNISSE.length; i++) {
    const e = K.ziehEreignis(k, gesehen);
    assert.ok(!gesehen.includes(e.key), `${e.key} kam doppelt`);
    gesehen.push(e.key);
  }
});

// ── Transfers ────────────────────────────────────────────────────────────────

test("Angebote kommen von Vereinen auf dem eigenen Niveau", () => {
  const zufall = K.rng(21);
  const k = { ...spieler(), overall: 76, ruf: 30, alter: 25 };
  const ang = K.angebote(k, welt, zufall, 3);
  for (const a of ang) {
    assert.notEqual(a.verein.key, k.verein.key, "der eigene Verein bietet nicht");
    assert.ok(Math.abs(a.verein.niveau - k.overall) < 14, `${a.verein.name} auf ${a.verein.niveau} für einen ${k.overall}er`);
    assert.ok(a.jahre >= 2 && a.jahre <= 5);
  }
  /* DER FEHLER, DEN DAS FÄNGT: Eine frühere Formel schob einem 80er-Spieler
     Angebote von 91er-Vereinen zu. Wer annahm, saß auf der Bank und schoss in einer
     ganzen Laufbahn 54 Tore. */
  const spitze = K.angebote({ ...spieler(), overall: 94, ruf: 90, alter: 27 }, welt, zufall, 3);
  const mittel = K.angebote({ ...spieler(), overall: 72, ruf: 10, alter: 27 }, welt, zufall, 3);
  if (spitze.length && mittel.length) {
    assert.ok(spitze[0].verein.niveau > mittel[0].verein.niveau, "wer besser ist, bekommt bessere Angebote");
  }
});

// ── Entwicklung ──────────────────────────────────────────────────────────────

test("jung wächst, alt verliert", () => {
  assert.ok(K.alterswachstum(18) > K.alterswachstum(25));
  assert.ok(K.alterswachstum(25) > K.alterswachstum(31));
  assert.ok(K.alterswachstum(36) < 0);
  const zufall = K.rng(30);
  const jung = K.alterePlayer({ ...spieler(), alter: 19, overall: 70 }, { anteil: 0.9 }, zufall, 80);
  assert.ok(jung.overall > 70, "ein spielender Neunzehnjähriger wird besser");
  const alt = K.alterePlayer({ ...spieler(), alter: 36, overall: 85 }, { anteil: 0.9 }, zufall, 80);
  assert.ok(alt.overall < 85, "mit 36 geht es abwärts");
  assert.equal(jung.saison, 2);
  assert.equal(jung.alter, 20);
});

/* DER ENTWURFSFEHLER, DEN DAS FÄNGT: Hing das Wachstum allein an der Spielzeit, war
   Faulheit die beste Strategie — beim kleinen Verein spielte man immer und
   entwickelte sich schneller als beim Spitzenklub. Gemessen: Höchstwert 88 beim
   Bleiben gegen 82,5 beim Wechseln. */
test("das Niveau, auf dem man spielt, treibt die Entwicklung mit", () => {
  const zufall = K.rng(31);
  const mittel = (niveau, anteil) => {
    let s = 0;
    for (let n = 0; n < 200; n++) s += K.alterePlayer({ ...spieler(), alter: 20, overall: 75 }, { anteil }, zufall, niveau).overall;
    return s / 200;
  };
  assert.ok(mittel(90, 0.9) > mittel(66, 0.9), "gleich viel spielen, höheres Niveau: mehr Fortschritt");
  /* Und beide Wege müssen sich ungefähr die Waage halten — sonst gibt es nur einen. */
  const bank = mittel(90, 0.4), stamm = mittel(66, 1.0);
  assert.ok(Math.abs(bank - stamm) < 1.2, `Bank oben ${bank.toFixed(2)} gegen Stamm unten ${stamm.toFixed(2)}`);
});

test("irgendwann ist Schluss", () => {
  assert.equal(K.trittZurueck({ ...spieler(), alter: 24, overall: 85 }, K.rng(1)), false);
  assert.equal(K.trittZurueck({ ...spieler(), alter: 40 }, K.rng(1)), true);
  const zufall = K.rng(40);
  let n = 0;
  while (!K.trittZurueck({ ...spieler(), alter: 34, overall: 78 }, zufall) && n < 200) n++;
  assert.ok(n < 200, "mit 34 muss das Ende irgendwann kommen");
});

// ── Das Urteil ───────────────────────────────────────────────────────────────

test("mehr Titel heißt nie ein schlechteres Urteil", () => {
  const stufen = K.STUFEN.map((s) => s.key);
  const leer = { titel: {}, overall: 70 };
  const viel = { titel: { CL: 3, WM: 1, BDO: 2, MBL: 5, DFB: 3, TSK: 4 }, overall: 94, hoechsterOverall: 94 };
  assert.ok(K.karrierePunkte(viel) > K.karrierePunkte(leer));
  assert.equal(K.stufeFuer(leer).key, "gescheit");
  assert.equal(K.stufeFuer(viel).key, "legende");
  /* Die Stufen müssen absteigend geordnet sein, sonst greift `find` die falsche. */
  for (let i = 1; i < K.STUFEN.length; i++) assert.ok(K.STUFEN[i].ab < K.STUFEN[i - 1].ab);
  assert.equal(stufen.at(-1), "gescheit");
});

// ── Die ganze Laufbahn ───────────────────────────────────────────────────────

/* Die Probe aufs Ganze: Eine Laufbahn muss enden, plausible Zahlen liefern und auf
   Entscheidungen reagieren. Ohne das wäre alles darüber Zahlenspielerei. */
function laufbahn(seed, klug) {
  const zufall = K.rng(K.hashStr("t" + seed));
  const klein = welt.vereine.filter((v) => v.niveau < 72);
  let k = K.neueKarriere({ name: "T", nation: "GER", nummer: 9, pos: "ST", seed,
    verein: klein[0] || welt.vereine.at(-1) });
  let hoechster = k.overall, vorplatz = null, runden = 0;
  while (!k.beendet && runden++ < 40) {
    if (klug) k = K.entscheide(k, K.ziehEreignis(k, []).wahlen[0]);
    const l = K.saisonLeistung(k, k.verein.niveau, zufall);
    const platz = K.ligaPlatz(k.verein, k, zufall);
    for (const t of [...K.vereinsTitel(k.verein, platz, k, zufall), ...K.europaTitel(k.verein, vorplatz, k, zufall)]) {
      k.titel[t] = (k.titel[t] || 0) + 1;
    }
    k.gesamt = { spiele: k.gesamt.spiele + l.spiele, tore: k.gesamt.tore + l.tore, vorlagen: k.gesamt.vorlagen + l.vorlagen };
    vorplatz = platz;
    k = K.alterePlayer(k, l, zufall, k.verein.niveau);
    if (klug) {
      const a = K.angebote(k, welt, zufall, 3);
      if (a[0] && a[0].verein.niveau > k.verein.niveau + 1) k = { ...k, verein: a[0].verein };
    }
    hoechster = Math.max(hoechster, k.overall);
    if (K.trittZurueck(k, zufall)) k.beendet = true;
  }
  return { ...k, hoechsterOverall: hoechster };
}

test("eine Laufbahn endet und liefert plausible Zahlen", () => {
  for (let s = 0; s < 30; s++) {
    const k = laufbahn(s, true);
    assert.ok(k.beendet, `Lauf ${s} endete nicht`);
    assert.ok(k.alter >= K.RUECKTRITT_AB && k.alter <= 41, `Rücktritt mit ${k.alter}`);
    assert.ok(k.saison >= 10 && k.saison <= 26, `${k.saison} Saisons`);
    assert.ok(k.overall >= K.OVERALL_START && k.overall <= K.OVERALL_MAX);
    assert.ok(k.gesamt.spiele > 0 && k.gesamt.tore >= 0);
    /* Nicht mehr Tore als Spiele — das wäre für einen Ligabetrieb absurd. */
    assert.ok(k.gesamt.tore <= k.gesamt.spiele, `${k.gesamt.tore} Tore in ${k.gesamt.spiele} Spielen`);
  }
});

test("wer entscheidet und wechselt, kommt weiter", () => {
  let klug = 0, passiv = 0;
  for (let s = 0; s < 40; s++) {
    klug += K.karrierePunkte(laufbahn(s, true));
    passiv += K.karrierePunkte(laufbahn(s, false));
  }
  assert.ok(klug > passiv * 2, `klug ${(klug / 40).toFixed(1)} gegen passiv ${(passiv / 40).toFixed(1)}`);
});
