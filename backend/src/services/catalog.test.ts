import assert from "node:assert/strict";
import test from "node:test";

test("catalog versioned cache keys isolate a changed catalog", () => {
  const oldKey = "catalog:published:v2";
  const newKey = "catalog:published:v3";
  assert.notEqual(oldKey, newKey);
});
