import assert from "node:assert/strict";
import test from "node:test";
import { issueRoomTicket, verifyRoomTicket } from "./tickets.js";

test("room ticket binds an opaque player identifier to the authenticated user", async () => {
  const issued = await issueRoomTicket("user-123");
  const verified = await verifyRoomTicket(issued.ticket);
  assert.equal(verified.userId, "user-123");
  assert.equal(verified.playerId, issued.playerId);
  assert.notEqual(verified.playerId, verified.userId);
  assert.ok(verified.expiresAt.getTime() > Date.now());
});

test("room ticket rejects a token issued for a different purpose", async () => {
  await assert.rejects(() => verifyRoomTicket("not-a-ticket"));
});
