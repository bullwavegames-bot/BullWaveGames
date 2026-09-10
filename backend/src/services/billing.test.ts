import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { subscriptionCheckoutSignature } from "./billing.js";

test("subscription checkout signature uses payment id followed by subscription id", () => {
  const expected = crypto.createHmac("sha256", "test-secret").update("pay_123|sub_456").digest("hex");
  assert.equal(subscriptionCheckoutSignature("pay_123", "sub_456", "test-secret"), expected);
});

test("subscription checkout signature is order-sensitive", () => {
  assert.notEqual(
    subscriptionCheckoutSignature("pay_123", "sub_456", "test-secret"),
    subscriptionCheckoutSignature("sub_456", "pay_123", "test-secret"),
  );
});
