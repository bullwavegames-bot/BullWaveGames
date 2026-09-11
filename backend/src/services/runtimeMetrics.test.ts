import assert from "node:assert/strict";
import test from "node:test";
import { recordHttpRequest, resetRuntimeMetricsForTest, roomSocketClosed, roomSocketOpened, runtimeMetrics } from "./runtimeMetrics.js";

test("runtime metrics track HTTP errors, latency percentiles, and room sockets", () => {
  resetRuntimeMetricsForTest();
  recordHttpRequest(10, 200);
  recordHttpRequest(50, 500);
  roomSocketOpened();
  roomSocketOpened();
  roomSocketClosed();
  assert.deepEqual(runtimeMetrics(), {
    http: { requests: 2, errors: 1, errorRate: 0.5, p50Ms: 10, p95Ms: 50, p99Ms: 50 },
    rooms: { activeSockets: 1 },
  });
});
