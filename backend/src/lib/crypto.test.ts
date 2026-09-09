import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256, validPassword } from "./crypto.js";
import { isMemberNow, type MembershipRow } from "../types.js";

test("password policy matches the frontend", () => {
  assert.equal(validPassword("short1"), false);
  assert.equal(validPassword("longenough"), false);
  assert.equal(validPassword("validpass1"), true);
});

test("token hashes are stable", () => {
  assert.equal(sha256("abc"), sha256("abc"));
  assert.notEqual(sha256("abc"), sha256("abd"));
});

test("past_due is a member only during grace", () => {
  const base: MembershipRow = {
    user_id: "x",
    plan_id: "wave",
    status: "past_due",
    billing_interval: "monthly",
    source: "payment",
    razorpay_customer_id: null,
    razorpay_subscription_id: null,
    access_start: new Date(),
    access_end: new Date(Date.now() - 1000),
    grace_end: new Date(Date.now() + 60_000),
    last_payment_failed_at: new Date(),
    dunning_retry_count: 1,
    next_payment_at: null,
    cancel_at_period_end: false,
    auto_renew: true,
    granted_by: null,
  };
  assert.equal(isMemberNow(base), true);
  assert.equal(isMemberNow({ ...base, grace_end: new Date(Date.now() - 1000) }), false);
  assert.equal(isMemberNow({ ...base, status: "expired", grace_end: new Date(Date.now() + 60_000) }), false);
});

test("score bounds reject impossible values", () => {
  const rules = { min_score: 0, max_score: 500, min_duration_ms: 2500, max_duration_ms: 600000, max_score_per_second: 50, score_direction: "higher_better" };
  const check = (
    score: number,
    durationMs: number,
  ): string | null => {
    if (score < rules.min_score || score > rules.max_score) return "bounds";
    if (durationMs < rules.min_duration_ms || durationMs > rules.max_duration_ms) return "bounds";
    const cap = rules.max_score_per_second * Math.max(durationMs / 1000, 1);
    if (score > cap) return "bounds";
    return null;
  };
  assert.equal(check(8, 5000), null);
  assert.equal(check(501, 5000), "bounds");
  assert.equal(check(8, 100), "bounds");
  assert.equal(check(400, 3000), "bounds");
});
