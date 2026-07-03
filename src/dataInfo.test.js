import { test } from "node:test";
import assert from "node:assert/strict";
import { DATA_ASOF } from "./dataInfo.js";

test("DATA_ASOF ist gültiges YYYY-MM-DD", () => {
  assert.match(DATA_ASOF, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(DATA_ASOF)));
});
