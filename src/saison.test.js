import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rng, teamStaerke, spielplan, simuliereSpiel, simuliereSaison,
  tabelleNach, meineZeile, abzeichenFuer, hoehepunkte, spieltageFuer,
  echteLiga, ersetzeEinen, GEGNER_SL_MIN,
  TEAMS, TOR_BASIS, STAERKE_SKALA,
} from "./saison.js";
import { LIGA_VEREINE, NEUESTE_SAISON, LIGA_AB_JAHR } from "./leagueClubs.js";
import { PLAYERS } from "./players.js";
import { CLUBS } from "./gameData.js";
import { baueZiehungen, baueKlassen, LIGA_NAME, SPIELE, DRAFT_AB_JAHR } from "./draft.js";
import { EINSAETZE } from "./appearances.js";


/* Die Vereinsliste des Drafts wie in der Ansicht: Spielvereine plus Ligavereine. */
const ligaVereineFuer = (lg) => {
  const spielverein = new Set(CLUBS.map((c) => c.key));
  const frueher = [];
  for (let j = DRAFT_AB_JAHR; j < LIGA_AB_JAHR; j++) frueher.push(j);
  const paare = [
    ...CLUBS.filter((c) => c.lg === lg).map((c) => [c.key, { key: c.key, name: c.name, lg }]),
    ...LIGA_VEREINE[lg].map((v) => [v.key, { ...v, lg, jahre: spielverein.has(v.key) ? [...frueher, ...v.jahre] : v.jahre }]),
  ];
  return [...new Map(paare).values()];
};
const klassenFuer = (lg) => baueKlassen(PLAYERS, baueZiehungen(PLAYERS, ligaVereineFuer(lg), lg), EINSAETZE);
const gegnerFuer = (lg, seed) => {
  const alle = echteLiga(PLAYERS, klassenFuer(lg), LIGA_VEREINE[lg], NEUESTE_SAISON[lg]);
  return ersetzeEinen(alle, seed).gegner;
};

// ── Spielplan ────────────────────────────────────────────────────────────────

/* Der Spielplan ist die Grundlage von allem: Stimmt er nicht, ist die Tabelle
   Zufall. Geprüft wird, dass wirklich jeder zweimal gegen jeden spielt — einmal
   daheim, einmal auswärts — und dass an einem Spieltag niemand doppelt aufläuft. */
test("jeder spielt zweimal gegen jeden, einmal daheim", () => {
  for (const n of [4, 18, 20]) {
    const plan = spielplan(n);
    assert.equal(plan.length, spieltageFuer(n), `${n} Mannschaften`);
    const paarungen = new Map();
    for (const tag of plan) {
      assert.equal(tag.length, n / 2, "an einem Spieltag spielen alle");
      const dabei = new Set();
      for (const { h, a } of tag) {
        assert.ok(!dabei.has(h) && !dabei.has(a), `${n}: doppelter Einsatz an einem Spieltag`);
        dabei.add(h); dabei.add(a);
        const key = `${h}>${a}`;
        assert.ok(!paarungen.has(key), `${n}: ${key} kommt doppelt vor`);
        paarungen.set(key, true);
      }
      assert.equal(dabei.size, n);
    }
    assert.equal(paarungen.size, n * (n - 1), `${n}: nicht jede Paarung genau einmal`);
  }
});

test("die Saisonlängen sind die echten", () => {
  assert.equal(spieltageFuer(TEAMS.BL), SPIELE.BL, "Bundesliga: 18 Mannschaften, 34 Spieltage");
  assert.equal(spieltageFuer(TEAMS.PL), SPIELE.PL);
  assert.equal(spieltageFuer(TEAMS.LL), SPIELE.LL);
});

// ── Zufall ───────────────────────────────────────────────────────────────────

test("derselbe Startwert liefert dieselbe Saison", () => {
  const a = rng(42), b = rng(42), c = rng(43);
  const zieh = (f) => Array.from({ length: 8 }, () => f());
  assert.deepEqual(zieh(a), zieh(b));
  assert.notDeepEqual(zieh(rng(42)), zieh(c));
  for (const x of zieh(rng(7))) assert.ok(x >= 0 && x < 1);
});

// ── Ein Spiel ────────────────────────────────────────────────────────────────

test("der Stärkere gewinnt häufiger, aber nicht immer", () => {
  const zufall = rng(1);
  let starkGewinnt = 0, schwachGewinnt = 0, remis = 0;
  for (let n = 0; n < 4000; n++) {
    const { th, ta } = simuliereSpiel(85, 70, zufall);
    if (th > ta) starkGewinnt++; else if (th < ta) schwachGewinnt++; else remis++;
  }
  assert.ok(starkGewinnt > 2400, `nur ${starkGewinnt} Siege bei 15 Punkten Vorsprung`);
  assert.ok(schwachGewinnt > 200, "auch der Schwächere muss gewinnen können");
  assert.ok(remis > 200, "Unentschieden dürfen nicht verschwinden");
});

/* Ohne Deckel träfe Bayern 2014 (95,7) auf Werder 1996 (62,4) — 33 Punkte
   Unterschied — und es gäbe jede Woche ein zweistelliges Ergebnis. */
test("auch der krasseste Unterschied bleibt im Rahmen", () => {
  const zufall = rng(2);
  let tore = 0, hoechstes = 0;
  for (let n = 0; n < 2000; n++) {
    const { th, ta } = simuliereSpiel(96, 62, zufall);
    tore += th; hoechstes = Math.max(hoechstes, th);
  }
  assert.ok(tore / 2000 < 6, `im Schnitt ${(tore / 2000).toFixed(1)} Tore — zu viel`);
  assert.ok(hoechstes < 15, `höchstes Ergebnis ${hoechstes}`);
});

test("gleich starke Mannschaften treffen etwa gleich oft", () => {
  const zufall = rng(3);
  let h = 0, a = 0;
  for (let n = 0; n < 4000; n++) { const s = simuliereSpiel(75, 75, zufall); h += s.th; a += s.ta; }
  const jeSpiel = (h + a) / 4000;
  assert.ok(jeSpiel > 2.3 && jeSpiel < 3.4, `${jeSpiel.toFixed(2)} Tore je Spiel`);
  assert.ok(h > a, "der Heimvorteil muss sich zeigen");
  assert.ok(h < a * 1.5, "…aber nicht das Spiel entscheiden");
});

// ── Tabelle ──────────────────────────────────────────────────────────────────

const teamsAus = (...staerken) => staerken.map((s, i) => ({ name: `T${i}`, staerke: s, ich: i === 0 }));

test("die Tabelle rechnet Punkte und Tore richtig", () => {
  const teams = teamsAus(80, 75, 70, 65);
  const spieltage = [
    { nr: 1, spiele: [{ h: 0, a: 1, th: 2, ta: 1 }, { h: 2, a: 3, th: 0, ta: 0 }] },
    { nr: 2, spiele: [{ h: 1, a: 2, th: 3, ta: 4 }, { h: 3, a: 0, th: 1, ta: 1 }] },
  ];
  const tab = tabelleNach(teams, spieltage);
  const von = (n) => tab.find((z) => z.name === n);
  assert.equal(von("T0").punkte, 4, "Sieg und Unentschieden");
  assert.equal(von("T0").tore, 3);
  assert.equal(von("T0").gegentore, 2);
  assert.equal(von("T1").punkte, 0, "zwei Niederlagen");
  assert.equal(von("T2").punkte, 4);
  assert.equal(von("T3").punkte, 2);
  /* Jede Zeile hat so viele Spiele wie gespielt wurde, und die Plätze sind
     lückenlos von 1 an. */
  for (const z of tab) assert.equal(z.sp, 2);
  assert.deepEqual(tab.map((z) => z.platz), [1, 2, 3, 4]);
});

test("die Tabelle lässt sich bis zu jedem Spieltag lesen", () => {
  const teams = teamsAus(80, 75, 70, 65);
  const spieltage = [
    { nr: 1, spiele: [{ h: 0, a: 1, th: 5, ta: 0 }, { h: 2, a: 3, th: 0, ta: 0 }] },
    { nr: 2, spiele: [{ h: 1, a: 2, th: 0, ta: 9 }, { h: 3, a: 0, th: 0, ta: 0 }] },
  ];
  assert.equal(meineZeile(tabelleNach(teams, spieltage, 0)).sp, 0, "vor dem ersten Spieltag");
  assert.equal(meineZeile(tabelleNach(teams, spieltage, 1)).platz, 1);
  assert.equal(meineZeile(tabelleNach(teams, spieltage, 1)).punkte, 3);
  assert.equal(meineZeile(tabelleNach(teams, spieltage, 2)).punkte, 4);
});

/* Bei Gleichstand entscheidet die Tordifferenz, dann die Tore — und zuletzt der
   Name. Ohne das letzte Kriterium tauschten zwei punktgleiche Mannschaften
   zwischen zwei Spieltagen grundlos die Plätze und die Ansicht flackerte. */
test("Gleichstand wird stabil aufgelöst", () => {
  const teams = teamsAus(80, 80, 80, 80);
  const spieltage = [{ nr: 1, spiele: [{ h: 0, a: 1, th: 3, ta: 0 }, { h: 2, a: 3, th: 1, ta: 0 }] }];
  const tab = tabelleNach(teams, spieltage);
  assert.equal(tab[0].name, "T0", "mehr Tordifferenz steht oben");
  assert.equal(tab[1].name, "T2");
  const nochmal = tabelleNach(teams, spieltage);
  assert.deepEqual(tab.map((z) => z.name), nochmal.map((z) => z.name));
});

// ── Abzeichen ────────────────────────────────────────────────────────────────

const zeile = (o) => ({ platz: 10, sp: 34, s: 10, u: 10, n: 14, punkte: 40, ...o });

test("das Abzeichen kommt aus dem Tabellenplatz", () => {
  assert.equal(abzeichenFuer(zeile({ platz: 1, s: 34, u: 0, n: 0, punkte: 102 }), 18).key, "makellos");
  assert.equal(abzeichenFuer(zeile({ platz: 1, s: 20, u: 14, n: 0, punkte: 74 }), 18).key, "unbesiegt");
  assert.equal(abzeichenFuer(zeile({ platz: 1, s: 29, u: 2, n: 3, punkte: 89 }), 18).key, "rekord");
  assert.equal(abzeichenFuer(zeile({ platz: 1, punkte: 70 }), 18).key, "meister");
  assert.equal(abzeichenFuer(zeile({ platz: 4 }), 18).key, "cl");
  assert.equal(abzeichenFuer(zeile({ platz: 6 }), 18).key, "el");
  assert.equal(abzeichenFuer(zeile({ platz: 15 }), 18).key, "mitte");
  assert.equal(abzeichenFuer(zeile({ platz: 16 }), 18).key, "abstieg", "die letzten drei von 18");
  assert.equal(abzeichenFuer(zeile({ platz: 17 }), 20).key, "mitte", "…aber Platz 17 von 20 ist noch keiner");
  assert.equal(abzeichenFuer(zeile({ platz: 18 }), 20).key, "abstieg");
});

// ── Höhepunkte ───────────────────────────────────────────────────────────────

test("die Höhepunkte finden nur eigene Spiele", () => {
  const teams = teamsAus(80, 75, 70, 65);
  const spieltage = [
    { nr: 1, spiele: [{ h: 0, a: 1, th: 4, ta: 0 }, { h: 2, a: 3, th: 9, ta: 0 }] },
    { nr: 2, spiele: [{ h: 2, a: 0, th: 3, ta: 1 }, { h: 1, a: 3, th: 1, ta: 1 }] },
  ];
  const h = hoehepunkte(teams, spieltage);
  assert.equal(h.spiele.length, 2, "nur die eigenen zwei, nicht die 9:0 der anderen");
  assert.equal(h.bestes.gegner, "T1");
  assert.equal(h.bestes.eigene, 4);
  assert.equal(h.schlimmstes.gegner, "T2");
  assert.equal(h.schlimmstes.heim, false);
  assert.equal(h.serie, 1, "ein Sieg, dann eine Niederlage");
});

test("die Serie zählt Spiele ohne Niederlage", () => {
  const teams = teamsAus(80, 75);
  const erg = [[2, 0], [1, 1], [3, 1], [0, 2], [1, 0]];
  const spieltage = erg.map(([th, ta], n) => ({ nr: n + 1, spiele: [{ h: 0, a: 1, th, ta }] }));
  assert.equal(hoehepunkte(teams, spieltage).serie, 3);
});

// ── Mit den echten Daten ─────────────────────────────────────────────────────

test("jede Liga stellt genug Gegner, ohne dass ein Verein die Liga füllt", () => {
  for (const liga of ["BL", "PL", "LL"]) {
    const gegner = gegnerFuer(liga, `test:${liga}`);
    assert.equal(gegner.length, TEAMS[liga] - 1, `${LIGA_NAME[liga]}`);
    const keys = gegner.map((g) => g.key);
    assert.equal(new Set(keys).size, keys.length, `${LIGA_NAME[liga]}: ein Verein doppelt`);
  }
});

/* Eine Liga braucht Gefälle: Meister und Aufsteiger dürfen nicht gleich stark sein. */
test("jede Liga hat eine Spitze und einen Keller", () => {
  for (const liga of ["BL", "PL", "LL"]) {
    const kl = klassenFuer(liga);
    const s = echteLiga(PLAYERS, kl, LIGA_VEREINE[liga], NEUESTE_SAISON[liga]).map((v) => v.staerke);
    const spanne = Math.max(...s) - Math.min(...s);
    /* Zwölf und nicht achtzehn: Die Schwelle stammte aus einer Zeit, als Spieler
       ohne Klasseneintrag als 50 zählten und dünne Kader dadurch künstlich tief
       lagen. Mit dem richtigen Boden sind es Bundesliga 20,5, La Liga 15,4 und
       Premier League 14,8 — und das ist keine Schwäche der Rechnung, sondern die
       Liga: In England ist auch der Letzte noch stark. */
    assert.ok(spanne > 12, `${LIGA_NAME[liga]}: nur ${spanne.toFixed(1)} Punkte Spannweite`);
  }
});

test("die Stärke eines Kaders nimmt nur die besten elf", () => {
  const players = Array.from({ length: 20 }, (_, i) => ({ by: 1990 }));
  const klassen = new Map(players.map((_, i) => [i, i < 11 ? 80 : 50]));
  const ziehung = { spieler: players.map((_, i) => i), jahr: 2018 };
  /* Die neun Schwachen dürfen nicht mitzählen — sonst wäre ein tiefer Kader
     schlechter als ein knapper, obwohl er mehr Auswahl hat. */
  assert.ok(teamStaerke(ziehung, players, klassen) > 80);
});

/* Die Probe aufs Ganze: Eine simulierte Saison muss aussehen wie eine echte. */
test("eine simulierte Saison hat realistische Zahlen", () => {
  for (const liga of ["BL", "PL", "LL"]) {
    const z = baueZiehungen(PLAYERS, CLUBS, liga);
    const kl = baueKlassen(PLAYERS, z, EINSAETZE);
    const gegner = gegnerFuer(liga, `echt:${liga}`);
    const s = simuliereSaison({ meineStaerke: 80, gegner, seed: 5 });
    assert.equal(s.teams.length, TEAMS[liga]);
    assert.equal(s.spieltage.length, SPIELE[liga]);

    const tab = tabelleNach(s.teams, s.spieltage);
    for (const zl of tab) assert.equal(zl.sp, SPIELE[liga], `${zl.name} hat nicht alle Spiele`);
    /* Punkte und Ergebnisse müssen zueinander passen. */
    for (const zl of tab) {
      assert.equal(zl.s + zl.u + zl.n, zl.sp);
      assert.equal(zl.punkte, zl.s * 3 + zl.u);
    }
    /* Erzielte und kassierte Tore der ganzen Liga sind dieselbe Menge. */
    assert.equal(tab.reduce((a, x) => a + x.tore, 0), tab.reduce((a, x) => a + x.gegentore, 0));

    const jeSpiel = tab.reduce((a, x) => a + x.tore, 0) / (SPIELE[liga] * TEAMS[liga] / 2);
    assert.ok(jeSpiel > 2.4 && jeSpiel < 3.6, `${LIGA_NAME[liga]}: ${jeSpiel.toFixed(2)} Tore je Spiel`);
    /* Echte Meister holen 70 bis 100 Punkte, echte Letzte 15 bis 30. */
    assert.ok(tab[0].punkte > 60 && tab[0].punkte < 105, `${LIGA_NAME[liga]}: Meister ${tab[0].punkte} Punkte`);
    assert.ok(tab.at(-1).punkte < 40, `${LIGA_NAME[liga]}: Letzter ${tab.at(-1).punkte} Punkte`);
  }
});

/* Der eigentliche Test des Modells: Bessere Elf, bessere Platzierung. Ohne diese
   Zusicherung wäre der ganze Draft davor bedeutungslos. */
test("eine bessere Elf landet weiter oben", () => {
  const z = baueZiehungen(PLAYERS, CLUBS, "BL");
  const kl = baueKlassen(PLAYERS, z, EINSAETZE);
  const platzFuer = (staerke) => {
    let summe = 0;
    for (let n = 0; n < 25; n++) {
      const gegner = gegnerFuer("BL", `rang:${n}`);
      const s = simuliereSaison({ meineStaerke: staerke, gegner, seed: n * 13 + 1 });
      summe += meineZeile(tabelleNach(s.teams, s.spieltage)).platz;
    }
    return summe / 25;
  };
  /* Gemessen auf der Skala 65–96: Ein blind zusammengeklickter Draft landet im
     Median bei 73,5 (67,8 bis 79,1), ein gierig gespielter bei 85,4 (78 bis 92,8). */
  const schwach = platzFuer(72);
  const mittel = platzFuer(80);
  const stark = platzFuer(90);
  assert.ok(schwach > mittel + 2, `blind ${schwach.toFixed(1)} gegen mittel ${mittel.toFixed(1)}`);
  assert.ok(mittel > stark + 2, `mittel ${mittel.toFixed(1)} gegen stark ${stark.toFixed(1)}`);
  assert.ok(schwach > 14, "ein blinder Draft gehört nach unten");
  assert.ok(stark < 5, "ein sehr guter Draft gehört nach oben");
});

// ── Die echte Liga ───────────────────────────────────────────────────────────

/* Der Kern des Umbaus: Die Traumelf tritt nicht mehr gegen zusammengewürfelte
   Jahrgänge an („Bayern 2014" gegen „Werder 1996" in einer Tabelle), sondern in der
   Liga einer echten Saison gegen genau die Vereine, die damals dabei waren. */
test("jede Liga stellt in ihrer neuesten Saison eine vollständige Tabelle", () => {
  for (const lg of ["BL", "PL", "LL"]) {
    const jahr = NEUESTE_SAISON[lg];
    const z = baueZiehungen(PLAYERS, CLUBS, lg);
    const kl = baueKlassen(PLAYERS, z, EINSAETZE);
    const tabelle = echteLiga(PLAYERS, kl, LIGA_VEREINE[lg], jahr);
    assert.equal(tabelle.length, TEAMS[lg], `${LIGA_NAME[lg]} ${jahr}: ${tabelle.length} statt ${TEAMS[lg]} Vereine`);
    /* Jeder Verein braucht eine belastbare Stärke — ein Kader ohne Spieler stünde
       auf dem Boden der Skala und wäre in jedem Spiel chancenlos. */
    for (const v of tabelle) {
      assert.ok(v.staerke > 50, `${v.name}: Stärke ${v.staerke}`);
      /* Sechs, nicht elf: Ein frisch aufgestiegener Verein hat in unseren Daten
         manchmal nur eine Handvoll Spieler — St. Pauli 2025/26 hat neun. Dafür
         füllt `teamStaerke` auf elf auf, statt den Schnitt der wenigen zu nehmen. */
      assert.ok(v.spieler.length >= 6, `${v.name}: nur ${v.spieler.length} Spieler`);
    }
    /* Und eine Liga braucht Gefälle: Meister und Aufsteiger dürfen nicht gleich
       stark sein. */
    const s = tabelle.map((v) => v.staerke);
    assert.ok(Math.max(...s) - Math.min(...s) > 12, `${LIGA_NAME[lg]}: nur ${(Math.max(...s) - Math.min(...s)).toFixed(1)} Punkte Spannweite`);
  }
});

test("die stärksten Vereine sind die, die man erwartet", () => {
  const kl = baueKlassen(PLAYERS, baueZiehungen(PLAYERS, CLUBS, "BL"), EINSAETZE);
  const tabelle = echteLiga(PLAYERS, kl, LIGA_VEREINE.BL, NEUESTE_SAISON.BL)
    .sort((a, b) => b.staerke - a.staerke);
  assert.equal(tabelle[0].name, "FC Bayern München");
  assert.ok(tabelle.slice(0, 4).some((v) => v.name === "Borussia Dortmund"));
});

/* Ein dünner Kader darf nicht STÄRKER dastehen als ein voller. Ohne das Auffüllen
   auf elf hätte ein Aufsteiger mit sieben bekannten Spielern den Schnitt seiner
   sieben Bekannten — und stünde damit über einem vollen Kader. */
test("ein dünner Kader wird auf elf aufgefüllt", () => {
  const players = Array.from({ length: 12 }, () => ({ by: 1990 }));
  const klassen = new Map(players.map((_, i) => [i, 90]));
  const voll = teamStaerke({ spieler: players.map((_, i) => i), jahr: 2018 }, players, klassen);
  const duenn = teamStaerke({ spieler: [0, 1, 2], jahr: 2018 }, players, klassen);
  assert.ok(duenn < voll, `dünn ${duenn} müsste unter voll ${voll} liegen`);
});

test("die Traumelf verdrängt genau einen Verein", () => {
  const liga = Array.from({ length: 18 }, (_, i) => ({ key: `K${i}`, name: `Verein ${i}`, staerke: 70 }));
  const { gegner, ersetzt } = ersetzeEinen(liga, "test");
  assert.equal(gegner.length, 17);
  assert.ok(ersetzt);
  assert.ok(!gegner.some((g) => g.key === ersetzt.key));
  /* Deterministisch: dieselbe Partie hat dieselbe Liga. */
  assert.equal(ersetzeEinen(liga, "test").ersetzt.key, ersetzt.key);
  assert.notEqual(ersetzeEinen(liga, "anders").ersetzt.key, undefined);
  assert.deepEqual(ersetzeEinen([], "test"), { gegner: [], ersetzt: null });
});

test("mit der eigenen Elf ist die Liga wieder vollzählig", () => {
  for (const lg of ["BL", "PL", "LL"]) {
    const kl = baueKlassen(PLAYERS, baueZiehungen(PLAYERS, CLUBS, lg), EINSAETZE);
    const alle = echteLiga(PLAYERS, kl, LIGA_VEREINE[lg], NEUESTE_SAISON[lg]);
    const { gegner } = ersetzeEinen(alle, `${lg}:1`);
    const s = simuliereSaison({ meineStaerke: 80, gegner, seed: 3 });
    assert.equal(s.teams.length, TEAMS[lg]);
    assert.equal(s.spieltage.length, spieltageFuer(TEAMS[lg]));
  }
});
