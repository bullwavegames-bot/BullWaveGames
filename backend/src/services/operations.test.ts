import assert from "node:assert/strict";
import test from "node:test";
import { needsOperationalAlert } from "./operations.js";

test("operational alert triggers for dead letters or stale durable work", () => {
  assert.equal(needsOperationalAlert({ pending: 2, failed: 0, deadLetter: 0, oldestAgeSeconds: 60 }), false);
  assert.equal(needsOperationalAlert({ pending: 0, failed: 0, deadLetter: 1, oldestAgeSeconds: 0 }), true);
  assert.equal(needsOperationalAlert({ pending: 1, failed: 0, deadLetter: 0, oldestAgeSeconds: 61 }), true);
});
