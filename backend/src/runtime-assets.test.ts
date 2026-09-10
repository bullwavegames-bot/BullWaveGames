import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("production build contains shared game modules and SQL migrations", async () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const outputRoot = path.resolve(sourceDir, "../..");
  await Promise.all([
    access(path.join(outputRoot, "shared/ludo.mjs")),
    access(path.join(outputRoot, "shared/questions.mjs")),
    access(path.join(outputRoot, "backend/migrations/001_init.sql")),
    access(path.join(outputRoot, "backend/migrations/002_supabase_identity.sql")),
    access(path.join(outputRoot, "backend/migrations/003_identity_lifecycle.sql")),
    access(path.join(outputRoot, "backend/migrations/004_subscription_idempotency.sql")),
    access(path.join(outputRoot, "backend/migrations/005_durable_billing_events.sql")),
    access(path.join(outputRoot, "backend/migrations/006_gameplay_delivery.sql")),
  ]);
  assert.ok(true);
});
