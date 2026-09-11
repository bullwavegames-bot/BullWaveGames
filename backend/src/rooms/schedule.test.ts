import assert from "node:assert/strict";
import test from "node:test";
import { deadlineForRoom, isRoomDue } from "./schedule.js";

test("only a positive numeric deadline is scheduled", () => {
  assert.equal(deadlineForRoom({ deadline: 123 }), 123);
  assert.equal(deadlineForRoom({ deadline: 0 }), null);
  assert.equal(deadlineForRoom({ deadline: "123" }), null);
});

test("room deadline becomes due at its scheduled instant", () => {
  assert.equal(isRoomDue({ deadline: 100 }, 99), false);
  assert.equal(isRoomDue({ deadline: 100 }, 100), true);
});
