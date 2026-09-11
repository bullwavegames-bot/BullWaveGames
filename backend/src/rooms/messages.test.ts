import assert from "node:assert/strict";
import test from "node:test";
import { roomMessageSchema } from "./messages.js";

test("room message schemas accept valid actions and reject unknown payload fields", () => {
  assert.equal(roomMessageSchema.parse({ type: "guess", text: "apple", actionId: "act_1" }).type, "guess");
  assert.equal(roomMessageSchema.safeParse({ type: "guess", text: "apple", admin: true }).success, false);
  assert.equal(roomMessageSchema.safeParse({ type: "stroke", line: [0, 0, 1, 1, 2] }).success, false);
});
