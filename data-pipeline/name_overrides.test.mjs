import { test } from "node:test";
import assert from "node:assert/strict";
import { NAME_OVERRIDES, EXCLUDED_PLAYERS } from "./name_overrides.mjs";

test("NAME_OVERRIDES: jeder Eintrag ist vollständig und belegt", () => {
  for (const o of NAME_OVERRIDES) {
    assert.ok(o.from, "from fehlt: " + JSON.stringify(o));
    assert.ok(o.to, "to fehlt: " + JSON.stringify(o));
    assert.equal(typeof o.by, "number", "by fehlt: " + JSON.stringify(o));
    assert.match(o.src || "", /^Q\d+$/, "Wikidata-Beleg (QID) fehlt: " + JSON.stringify(o));
  }
});

test("NAME_OVERRIDES: Zielnamen sind echte Namen, keine QIDs", () => {
  for (const o of NAME_OVERRIDES) {
    assert.ok(!/^Q\d+$/.test(o.to), "Zielname ist eine QID: " + o.to);
    assert.notEqual(o.to, o.from, "Override ohne Wirkung: " + o.from);
  }
});

test("NAME_OVERRIDES: keine doppelten Schlüssel (from|by)", () => {
  const seen = new Set();
  for (const o of NAME_OVERRIDES) {
    const k = o.from + "|" + o.by;
    assert.ok(!seen.has(k), "doppelter Schlüssel: " + k);
    seen.add(k);
  }
});

test("NAME_OVERRIDES: kein Zielname steht auf der Ausschlussliste", () => {
  const excl = new Set(EXCLUDED_PLAYERS.map((x) => x.n + "|" + x.by));
  for (const o of NAME_OVERRIDES) {
    assert.ok(!excl.has(o.to + "|" + o.by), "Override zeigt auf Ausschluss: " + o.to);
  }
});

test("EXCLUDED_PLAYERS: jeder Ausschluss ist begründet", () => {
  for (const x of EXCLUDED_PLAYERS) {
    assert.ok(x.n, "n fehlt: " + JSON.stringify(x));
    assert.equal(typeof x.by, "number", "by fehlt: " + JSON.stringify(x));
    assert.ok(x.reason && x.reason.length > 10, "Begründung fehlt: " + JSON.stringify(x));
  }
});

test("EXCLUDED_PLAYERS: keine doppelten Schlüssel (n|by)", () => {
  const seen = new Set();
  for (const x of EXCLUDED_PLAYERS) {
    const k = x.n + "|" + x.by;
    assert.ok(!seen.has(k), "doppelter Schlüssel: " + k);
    seen.add(k);
  }
});
