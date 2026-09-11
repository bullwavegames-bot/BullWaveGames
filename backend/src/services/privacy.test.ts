import assert from "node:assert/strict";
import test from "node:test";
import { deletedIdentity } from "./privacy.js";

test("deleted identities use a non-deliverable deterministic address", () => {
  const identity = deletedIdentity("11111111-1111-1111-1111-111111111111");
  assert.equal(identity.email, "deleted+11111111-1111-1111-1111-111111111111@invalid.local");
  assert.equal(identity.displayName, "Deleted player");
});
