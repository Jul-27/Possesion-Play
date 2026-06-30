import { test } from "node:test";
import assert from "node:assert/strict";
import { posBucket } from "./wikidata_positions.mjs";

test("posBucket mappt Positions-Labels auf Gruppen", () => {
  assert.equal(posBucket("goalkeeper"), "TW");
  assert.equal(posBucket("centre-back"), "ABW");
  assert.equal(posBucket("left-back"), "ABW");
  assert.equal(posBucket("defender"), "ABW");
  assert.equal(posBucket("central midfielder"), "MF");
  assert.equal(posBucket("attacking midfield"), "MF");
  assert.equal(posBucket("centre-forward"), "ST");
  assert.equal(posBucket("winger"), "ST");
  assert.equal(posBucket("striker"), "ST");
  assert.equal(posBucket("referee"), null);
});
