import { test } from "node:test";
import assert from "node:assert/strict";
import { bar, buildShare, shareCareer, shareOdd, shareChain, shareEleven, shareSolo } from "./share.js";

// buildShare liest window.location — im Test genügt ein Minimal-Stub.
globalThis.window = { location: { origin: "https://possesion-play.vercel.app", pathname: "/" } };

test("bar: füllt und begrenzt korrekt", () => {
  assert.equal(bar(3, 5), "🟩🟩🟩⬜⬜");
  assert.equal(bar(0, 3), "⬜⬜⬜");
  assert.equal(bar(9, 3), "🟩🟩🟩", "über dem Maximum wird gekappt");
  assert.equal(bar(-2, 2), "⬜⬜", "negative Werte werfen nicht");
});

test("buildShare: Titel, Zeilen und Link — leere Zeilen fallen weg", () => {
  const t = buildShare({ title: "Titel", lines: ["a", null, "b"], solo: "chain" });
  assert.deepEqual(t.split("\n"), ["Titel", "a", "b", "https://possesion-play.vercel.app/?solo=chain"]);
});

test("Jeder Modus liefert Titel, Kennzahl und den passenden Link", () => {
  const cases = [
    [shareCareer(3, 2, true), "career", "🧭"],
    [shareOdd(4, 7), "odd", "🧩"],
    [shareChain(12, 12, true), "chain", "⛓️"],
    [shareEleven(25, 1, "4-3-3"), "eleven", "👕"],
    [shareSolo(9, 0), "hex", "🎯"],
  ];
  for (const [text, solo, icon] of cases) {
    assert.ok(text.startsWith(icon), `Titel sollte mit ${icon} beginnen: ${text}`);
    assert.ok(text.endsWith(`?solo=${solo}`), `Link fehlt oder falsch: ${text}`);
    assert.ok(text.split("\n").length >= 2, `zu wenige Zeilen: ${text}`);
  }
});

test("Formulierungen: Singular/Plural und Sonderfälle", () => {
  assert.match(shareCareer(1, 1, true), /1 Station\b/);
  assert.match(shareCareer(1, 1, true), /1 Fehlversuch\b/);
  assert.match(shareCareer(2, 2, true), /2 Stationen/);
  assert.match(shareCareer(2, 2, true), /2 Fehlversuche/);
  assert.match(shareCareer(3, 0, true), /ohne Fehlversuch/);
  assert.match(shareCareer(3, 1, false), /aufgelöst/);
  // nach dem Auflösen ohne Rateversuch darf kein Lob stehen
  assert.doesNotMatch(shareCareer(3, 0, false), /ohne Fehlversuch/);
  assert.match(shareChain(12, 12, true), /neuer Rekord/, "eigener Rekord wird gefeiert");
  assert.match(shareChain(5, 12, false), /Rekord 12/, "sonst steht der Bestwert da");
  // Sofortiges Aufgeben darf keinen Rekord behaupten (Bestwert ist da schon geschrieben)
  assert.match(shareChain(1, 1, false), /Rekord 1/);
  assert.doesNotMatch(shareChain(1, 1, false), /neuer Rekord/);
  assert.match(shareSolo(1, 0), /1 Zug\b/);
  assert.match(shareSolo(9, 0), /9 Zügen/, "Umlaut im Plural");
  assert.match(shareSolo(9, 0), /perfektes Board/);
});

test("Teilen-Text enthält keine personenbezogenen Daten", () => {
  // Der Text landet in fremden Chats — er darf nur Ergebnis und Link enthalten.
  for (const t of [shareCareer(3, 1, true), shareOdd(2, 5), shareChain(7, 9), shareEleven(1, 0), shareSolo(8, 2)]) {
    assert.ok(!/[A-Za-zÄÖÜäöü]+@/.test(t), "keine Mailadresse");
    assert.ok(!/pp:/.test(t), "keine Speicherschlüssel");
  }
});
