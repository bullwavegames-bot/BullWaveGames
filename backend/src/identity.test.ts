import assert from "node:assert/strict";
import test from "node:test";
import { isRecentAuthentication, RECENT_AUTH_MAX_AGE_SECONDS } from "./services/identity.js";

test("recent authentication accepts a token within five minutes", () => {
  assert.equal(isRecentAuthentication(10_000, 10_000 + RECENT_AUTH_MAX_AGE_SECONDS), true);
});

test("recent authentication rejects missing, old, and implausibly future tokens", () => {
  assert.equal(isRecentAuthentication(null, 10_000), false);
  assert.equal(isRecentAuthentication(10_000, 10_000 + RECENT_AUTH_MAX_AGE_SECONDS + 1), false);
  assert.equal(isRecentAuthentication(10_031, 10_000), false);
});
