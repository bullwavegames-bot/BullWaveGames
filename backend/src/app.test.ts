import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./app.js";

test("liveness does not depend on external services", async () => {
  const app = await buildApp({
    roomsEnabled: false,
    readinessChecks: {
      database: async () => { throw new Error("database down"); },
      redis: async () => { throw new Error("redis down"); },
    },
  });
  const response = await app.inject({ method: "GET", url: "/health/live" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().ok, true);
  await app.close();
});

test("readiness reports dependency state and returns 503", async () => {
  const app = await buildApp({
    roomsEnabled: false,
    readinessChecks: {
      database: async () => undefined,
      redis: async () => { throw new Error("redis down"); },
    },
  });
  const response = await app.inject({ method: "GET", url: "/health/ready" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json().dependencies, { database: "up", redis: "down" });
  await app.close();
});

test("readiness returns 200 only when both dependencies respond", async () => {
  const app = await buildApp({
    roomsEnabled: false,
    readinessChecks: { database: async () => undefined, redis: async () => "PONG" },
  });
  const response = await app.inject({ method: "GET", url: "/health/ready" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().dependencies, { database: "up", redis: "up" });
  await app.close();
});
