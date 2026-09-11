import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SOCKET_BUFFER_BYTES, socketIsTooSlow, validActionId } from "./delivery.js";

test("slow socket delivery is bounded", () => {
  assert.equal(socketIsTooSlow(MAX_SOCKET_BUFFER_BYTES - 20, 20), false);
  assert.equal(socketIsTooSlow(MAX_SOCKET_BUFFER_BYTES - 20, 21), true);
});

test("action IDs are short opaque client identifiers", () => {
  assert.equal(validActionId("act_123-xyz"), true);
  assert.equal(validActionId("has spaces"), false);
  assert.equal(validActionId("x".repeat(65)), false);
});
