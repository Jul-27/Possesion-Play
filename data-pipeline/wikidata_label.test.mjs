import { test } from "node:test";
import assert from "node:assert/strict";
import { LABEL_LANGS, LABEL_SERVICE, isQidLabel, cleanName } from "./wikidata_label.mjs";

test("LABEL_LANGS hat Englisch zuerst und mehrere Fallbacks", () => {
  const langs = LABEL_LANGS.split(",");
  assert.equal(langs[0], "en");
  for (const l of ["de", "es", "fr", "pt", "it"]) assert.ok(langs.includes(l), "Fallback fehlt: " + l);
});

test("LABEL_SERVICE bindet die Fallback-Kette in den Label-Service ein", () => {
  assert.match(LABEL_SERVICE, /SERVICE wikibase:label/);
  assert.ok(LABEL_SERVICE.includes(LABEL_LANGS), "Sprachkette fehlt im Service-Aufruf");
});

test("isQidLabel erkennt zurückgefallene QIDs", () => {
  assert.equal(isQidLabel("Q113704154"), true);
  assert.equal(isQidLabel("Q1"), true);
  assert.equal(isQidLabel("Lamine Yamal"), false);
  assert.equal(isQidLabel("Quique Sánchez Flores"), false);
  assert.equal(isQidLabel(undefined), false);
});

test("cleanName liefert null statt eines QID-Namens", () => {
  assert.equal(cleanName("Q113704154"), null);
  assert.equal(cleanName(""), null);
  assert.equal(cleanName(undefined), null);
  assert.equal(cleanName("  Lamine Yamal  "), "Lamine Yamal");
});
