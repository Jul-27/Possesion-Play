import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLastName } from "./wikidata_roster.mjs";

test("deriveLastName", () => {
  assert.equal(deriveLastName("Zinedine Zidane"), "Zidane");
  assert.equal(deriveLastName("Thierry Henry"), "Henry");
  assert.equal(deriveLastName("Robin van Persie"), "van Persie");
  assert.equal(deriveLastName("Ronaldinho"), "Ronaldinho");
  assert.equal(deriveLastName("Rafael van der Vaart"), "van der Vaart");
});
