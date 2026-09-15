import assert from "node:assert/strict";
import test from "node:test";
import { recordHttpRequest, recordRoomAction, resetRuntimeMetricsForTest, roomSocketClosed, roomSocketOpened, runtimeMetrics } from "./runtimeMetrics.js";

test("runtime metrics track HTTP errors, latency percentiles, and room sockets", () => {
  resetRuntimeMetricsForTest();
  recordHttpRequest(10, 200);
  recordHttpRequest(50, 500);
  roomSocketOpened();
  roomSocketOpened();
  roomSocketClosed();
  recordRoomAction(12);
  recordRoomAction(70);
  assert.deepEqual(runtimeMetrics(), {
    http: { requests: 2, errors: 1, errorRate: 0.5, p50Ms: 10, p95Ms: 50, p99Ms: 50 },
    rooms: { activeSockets: 1, actionP50Ms: 12, actionP95Ms: 70, actionP99Ms: 70 },
    eventLoop: { p95Ms: 0, maxMs: 0 },
  });
});
