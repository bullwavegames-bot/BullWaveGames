import assert from "node:assert/strict";
import test from "node:test";
import { enqueueRoomAction } from "./serial.js";

test("room actions execute in arrival order for the same room", async () => {
  const events: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const first = enqueueRoomAction("ROOM01", async () => {
    events.push("first:start");
    await new Promise<void>((resolve) => { releaseFirst = resolve; });
    events.push("first:end");
  });
  const second = enqueueRoomAction("ROOM01", async () => { events.push("second"); });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["first:start"]);
  releaseFirst?.();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first:start", "first:end", "second"]);
});

test("different rooms do not block one another", async () => {
  const events: string[] = [];
  await Promise.all([
    enqueueRoomAction("ROOM01", async () => { events.push("one"); }),
    enqueueRoomAction("ROOM02", async () => { events.push("two"); }),
  ]);
  assert.deepEqual(events.sort(), ["one", "two"]);
});
