import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "./config.js";

function productionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    APP_URL: "https://bullwavegames.com",
    API_URL: "https://api.bullwavegames.com",
    CORS_ORIGINS: "https://bullwavegames.com,https://www.bullwavegames.com",
    TRUSTED_PROXIES: "10.0.0.0/8,127.0.0.1",
    DATABASE_URL: "postgres://app:secret@database.internal:5432/bullwave",
    REDIS_URL: "rediss://cache.internal:6379",
    AUTH_MODE: "supabase",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    JWT_ACCESS_SECRET: "production-access-secret-with-32-characters",
    PLAY_SESSION_SECRET: "production-play-secret-with-32-characters",
    SMTP_URL: "smtps://mailer.internal",
    BILLING_MODE: "razorpay",
    ALLOW_DEV_BILLING: "false",
    RAZORPAY_KEY_ID: "rzp_live_key",
    RAZORPAY_KEY_SECRET: "razorpay-secret",
    RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    RAZORPAY_PLAN_WAVE_MONTHLY: "plan_wave_month",
    RAZORPAY_PLAN_WAVE_ANNUAL: "plan_wave_year",
    RAZORPAY_PLAN_SURGE_MONTHLY: "plan_surge_month",
    RAZORPAY_PLAN_SURGE_ANNUAL: "plan_surge_year",
    RAZORPAY_PLAN_TIDE_MONTHLY: "plan_tide_month",
    RAZORPAY_PLAN_TIDE_ANNUAL: "plan_tide_year",
  };
}

test("development uses local-safe defaults", () => {
  const value = loadConfig({ NODE_ENV: "development" });
  assert.equal(value.host, "127.0.0.1");
  assert.equal(value.trustProxy, false);
  assert.equal(value.allowDevBilling, true);
});

test("production requires deployment secrets", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production" }), /DATABASE_URL/);
});

test("production uses an explicit proxy allowlist and public bind address", () => {
  const value = loadConfig(productionEnv());
  assert.equal(value.host, "0.0.0.0");
  assert.deepEqual(value.trustProxy, ["10.0.0.0/8", "127.0.0.1"]);
});

test("production rejects wildcard CORS and development billing", () => {
  assert.throws(() => loadConfig({ ...productionEnv(), CORS_ORIGINS: "*" }), /wildcard/);
  assert.throws(() => loadConfig({ ...productionEnv(), CORS_ORIGINS: "http://example.com" }), /HTTPS/);
  assert.throws(() => loadConfig({ ...productionEnv(), ALLOW_DEV_BILLING: "true" }), /ALLOW_DEV_BILLING/);
});

test("production permits explicit loopback origins for local frontend testing", () => {
  const value = loadConfig({
    ...productionEnv(),
    CORS_ORIGINS: "https://bullwavegames.com,http://localhost:5173,http://127.0.0.1:5173",
  });
  assert.deepEqual(value.corsOrigins, [
    "https://bullwavegames.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
});

test("only the production worker requires the Supabase service-role key", () => {
  const api = productionEnv();
  delete api.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal(loadConfig(api).serviceKind, "api");
  assert.throws(() => loadConfig({ ...api, SERVICE_KIND: "worker" }), /SERVICE_ROLE_KEY/);
});
