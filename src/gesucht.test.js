import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYERS } from "./players.js";
import { mulberry32 } from "./dailyChallenge.js";
import {
  BRETT, HINWEISE, THEMEN, THEMA_SPITZE, VERBAND, spielerKey, verbandVon, taugtFuersBrett, themenPool,
  gilt, hinweisText, belegText, kandidaten, baueRaetsel, pruefeRaetsel, tagesRaetsel, punkteFuer,
  naechsterHinweisKostet, bestenlistenPunkte, teilenText, mitspielerBei, kartenNamen,
} from "./gesucht.js";

globalThis.window = { location: { origin: "https://pp.test", pathname: "/" } };
const nk = new Map(PLAYERS.map((p) => [spielerKey(p), p]));
const finde = (n, by) => PLAYERS.find((p) => p.n === n && p.by === by);

test("Verbände: jede unserer 39 Nationen gehört zu genau einem", () => {
  const alle = Object.values(VERBAND).flatMap((v) => v.nationen);
  assert.equal(alle.length, 39);
  assert.equal(new Set(alle).size, 39);
  assert.equal(verbandVon("AUS"), "AFC", "Australien spielt in Asien");
  assert.equal(verbandVon("XXX"), null);
});

test("Brett-Tauglichkeit: Foto, Position, genau eine Nation, mindestens ein Spielverein", () => {
  for (const p of themenPool(PLAYERS, "alle")) {
    assert.ok(taugtFuersBrett(p), p.n);
    assert.equal(p.nat.length, 1, `${p.n} hat zwei Nationen`);
  }
});

test("Themen: jedes hat genug Spieler, aus den Bekanntesten gezogen", () => {
  for (const t of Object.keys(THEMEN)) {
    const pool = themenPool(PLAYERS, t);
    assert.equal(pool.length, THEMA_SPITZE, `${t} hat nur ${pool.length}`);
    assert.ok(pool.every((p) => THEMEN[t].test(p)));
  }
  assert.ok(themenPool(PLAYERS, "legenden").every((p) => p.by < 1982));
});

test("Harry Kane: Weltmeister nein, Ballon d'Or nach dem Datenstand, Bundesliga ja", () => {
  const kane = finde("Harry Kane", 1993);
  assert.equal(gilt({ art: "titel", wert: "WM", ja: false }, kane), true);
  assert.equal(gilt({ art: "liga", wert: "BL", ja: true }, kane), true);
  assert.equal(gilt({ art: "verband", wert: "UEFA", ja: true }, kane), true);
  assert.equal(gilt({ art: "geboren", wert: 1990, ja: false }, kane), true, "1993 ist nicht vor 1990");
  assert.equal(gilt({ art: "position", wert: "ST", ja: true }, kane), true);
});

test("Mitspieler: nur bei einem der 47 Vereine und zeitgleich", () => {
  const kane = finde("Harry Kane", 1993), musiala = finde("Jamal Musiala", 2003);
  const z = mitspielerBei(kane, musiala);
  assert.ok(z.some((x) => x.club === "FCB"));
  const h = { art: "mitspieler", wert: spielerKey(musiala), ja: true };
  assert.equal(gilt(h, kane, nk), true);
  assert.equal(gilt(h, musiala, nk), false, "niemand ist sein eigener Mitspieler");
  assert.equal(gilt(h, kane, new Map()), null, "unbekannter Mitspieler: keine Aussage");
  assert.match(hinweisText(h, nk), /mit Jamal Musiala zusammengespielt/);
  assert.match(belegText(h, kane, nk), /FC Bayern München/);
});

test("Texte: ja und nein lesen sich richtig", () => {
  assert.equal(hinweisText({ art: "liga", wert: "LL", ja: true }), "Ich habe in La Liga gespielt.");
  assert.equal(hinweisText({ art: "liga", wert: "SA", ja: false }), "Ich habe nie in der Serie A gespielt.");
  assert.equal(hinweisText({ art: "verband", wert: "CONMEBOL", ja: false }), "Meine Nationalmannschaft kommt nicht aus Südamerika.");
  assert.equal(hinweisText({ art: "geboren", wert: 1990, ja: true }), "Ich bin vor 1990 geboren.");
  assert.equal(hinweisText({ art: "geboren", wert: 1990, ja: false }), "Ich bin 1990 oder später geboren.");
  assert.equal(hinweisText({ art: "verein", wert: "BVB", ja: false }), "Ich habe nie für Borussia Dortmund gespielt.");
});

test("Kandidaten: jeder trifft auf den Gesuchten zu", () => {
  const brett = themenPool(PLAYERS, "alle").slice(0, BRETT);
  const ziel = brett[7];
  for (const h of kandidaten(brett, ziel, PLAYERS, nk)) assert.equal(gilt(h, ziel, nk), true, JSON.stringify(h));
});

test("Generator: in jedem Thema 25 Rätsel, alle regelkonform", () => {
  for (const t of Object.keys(THEMEN)) {
    for (let s = 1; s <= 25; s++) {
      const r = baueRaetsel(PLAYERS, mulberry32(s * 104729 + t.length), t, nk);
      assert.ok(r, `${t}/${s}: kein Rätsel`);
      assert.equal(pruefeRaetsel(r, nk), null, `${t}/${s}`);
      assert.equal(new Set(r.brett).size, BRETT, "keine Karte doppelt");
      assert.ok(r.brett.includes(r.ziel));
    }
  }
});

test("pruefeRaetsel erkennt einen verratenden Hinweis", () => {
  const r = baueRaetsel(PLAYERS, mulberry32(3), "alle", nk);
  const ziel = nk.get(r.ziel);
  const verraeter = { ...r, hinweise: [...r.hinweise.slice(0, 5), { art: "nation", wert: ziel.nat[0], ja: true }] };
  // Nur falsch, wenn die Nation auf dem Brett einzigartig ist — dann muss die Prüfung es merken.
  const gleicheNation = r.brett.filter((k) => nk.get(k).nat[0] === ziel.nat[0]).length;
  if (gleicheNation === 1) assert.match(pruefeRaetsel(verraeter, nk), /verrät allein/);
  assert.match(pruefeRaetsel({ ...r, hinweise: r.hinweise.slice(0, 5) }, nk), /nicht sechs/);
});

test("Tagesrätsel: gleicher Tag ⇒ gleiches Rätsel, anderer Tag ⇒ anderes", () => {
  const a = tagesRaetsel(PLAYERS, "2026-10-28", nk), b = tagesRaetsel(PLAYERS, "2026-10-28", nk);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, tagesRaetsel(PLAYERS, "2026-10-29", nk));
  assert.equal(a.thema, "alle");
});

test("Punkte: 1000, je Hinweis −100, je Fehler −150, gelöst mindestens 100", () => {
  assert.equal(punkteFuer({ hinweise: 1, fehler: 0, geloest: true }), 1000);
  assert.equal(punkteFuer({ hinweise: 6, fehler: 0, geloest: true }), 500);
  assert.equal(punkteFuer({ hinweise: 5, fehler: 1, geloest: true }), 450);
  assert.equal(punkteFuer({ hinweise: 6, fehler: 2, geloest: true }), 200);
  assert.equal(punkteFuer({ hinweise: 6, fehler: 0, geloest: false }), 0);
  assert.equal(punkteFuer({ hinweise: 6, fehler: 9, geloest: true }), 100);
  assert.equal(naechsterHinweisKostet(3), 100);
  assert.equal(naechsterHinweisKostet(HINWEISE), 0);
  assert.equal(bestenlistenPunkte(850), 85);
});

test("Teilen verrät Hinweise und Fehler, nicht den Namen", () => {
  const t = teilenText(12, { hinweise: 4, fehler: 1, geloest: true, punkte: 550 });
  assert.match(t, /Der Gesuchte #12 · 550 Punkte/);
  assert.match(t, /💡💡💡💡⬛⬛ ❌/);
  assert.match(t, /\?solo=gesucht$/);
  assert.match(teilenText(3, { hinweise: 6, fehler: 3, geloest: false, punkte: 0 }), /nicht gefunden/);
});

test("Kartennamen: Nachname, bei Gleichheit mit Anfangsbuchstaben, notfalls voll", () => {
  const sp = [
    { n: "Thomas Müller", ln: "Müller" }, { n: "Gerd Müller", ln: "Müller" },
    { n: "Cristiano Ronaldo", ln: "Ronaldo" }, { n: "Ronaldo", ln: "Ronaldo" },
    { n: "Lionel Messi", ln: "Messi" },
  ];
  assert.deepEqual(kartenNamen(sp), ["T. Müller", "G. Müller", "C. Ronaldo", "Ronaldo", "Messi"]);
  assert.deepEqual(kartenNamen([{ n: "Tom Ab", ln: "Ab" }, { n: "Tim Ab", ln: "Ab" }]), ["Tom Ab", "Tim Ab"]);
});
