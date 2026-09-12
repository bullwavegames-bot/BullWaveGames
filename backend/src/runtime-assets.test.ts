import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("production build contains shared game modules and SQL migrations", async () => {
  const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await Promise.all([
    access(path.join(backendRoot, "shared/ludo.mjs")),
    access(path.join(backendRoot, "shared/questions.mjs")),
    access(path.join(backendRoot, "migrations/001_init.sql")),
    access(path.join(backendRoot, "migrations/002_supabase_identity.sql")),
    access(path.join(backendRoot, "migrations/003_identity_lifecycle.sql")),
    access(path.join(backendRoot, "migrations/004_subscription_idempotency.sql")),
    access(path.join(backendRoot, "migrations/005_durable_billing_events.sql")),
    access(path.join(backendRoot, "migrations/006_gameplay_delivery.sql")),
    access(path.join(backendRoot, "migrations/007_durable_room_snapshots.sql")),
  ]);
  assert.ok(true);
});
