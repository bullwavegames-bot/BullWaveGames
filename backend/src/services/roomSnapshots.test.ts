import assert from "node:assert/strict";
import test from "node:test";
import { roomSnapshotRetryDelaySeconds } from "./roomSnapshots.js";

test("room snapshot retry delay is bounded exponential backoff", () => {
  assert.equal(roomSnapshotRetryDelaySeconds(0), 2);
  assert.equal(roomSnapshotRetryDelaySeconds(3), 16);
  assert.equal(roomSnapshotRetryDelaySeconds(99), 256);
});
