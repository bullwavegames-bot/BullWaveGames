import assert from "node:assert/strict";
import test from "node:test";
import { priorAction, rememberAction } from "./actions.js";

test("room action history returns the original version for a replay", () => {
  const actions = rememberAction([], { playerId: "player-a", actionId: "act-1", version: 7 });
  assert.equal(priorAction(actions, "player-a", "act-1")?.version, 7);
  assert.equal(priorAction(actions, "player-b", "act-1"), undefined);
});
