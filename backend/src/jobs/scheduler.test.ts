import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createScheduler } from "./scheduler.js";

test("scheduler prevents overlap and shutdown waits for active jobs", async () => {
  const scheduler = createScheduler(() => assert.fail("unexpected failure"));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  scheduler.add("slow", 5, async () => { calls++; await gate; });
  try {
    await delay(25);
    assert.equal(calls, 1);
    let drained = false;
    const stopping = scheduler.stop().then(() => { drained = true; });
    await delay(10);
    assert.equal(drained, false);
    release();
    await stopping;
    await delay(10);
    assert.equal(calls, 1);
    assert.throws(() => scheduler.add("late", 5, async () => {}), /stopped/);
  } finally { release(); await scheduler.stop(); }
});

test("scheduler reports a failed job and allows the next run", async () => {
  let failures = 0;
  let calls = 0;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => { resolveDone = resolve; });
  const scheduler = createScheduler((name) => { assert.equal(name, "retry"); failures++; });
  scheduler.add("retry", 5, async () => {
    calls++;
    if (calls === 1) throw new Error("temporary");
    resolveDone();
  });
  try {
    await done;
    assert.equal(failures, 1);
    assert.ok(calls >= 2);
  } finally { await scheduler.stop(); }
});
