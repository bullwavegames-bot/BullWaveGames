import assert from "node:assert/strict";
import test from "node:test";
import { nextVersion } from "./version.js";

test("room mutation advances only from the version it read", () => {
  assert.equal(nextVersion(7, 7), 8);
  assert.throws(() => nextVersion(8, 7), /Room version changed/);
});
