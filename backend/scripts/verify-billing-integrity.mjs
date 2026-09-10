import assert from "node:assert/strict";

process.env.BILLING_MODE = "razorpay";
process.env.RAZORPAY_KEY_ID = "rzp_test_phase3";
process.env.RAZORPAY_KEY_SECRET = "phase3-test-secret";
process.env.RAZORPAY_PLAN_WAVE_MONTHLY = "plan_wave_monthly_test";
process.env.RAZORPAY_PLAN_SURGE_MONTHLY = "plan_surge_monthly_test";
process.env.RAZORPAY_PLAN_TIDE_MONTHLY = "plan_tide_monthly_test";
process.env.RAZORPAY_PLAN_WAVE_ANNUAL = "plan_wave_annual_test";
process.env.RAZORPAY_PLAN_SURGE_ANNUAL = "plan_surge_annual_test";
process.env.RAZORPAY_PLAN_TIDE_ANNUAL = "plan_tide_annual_test";

const { sql } = await import("../dist/backend/src/db.js");
const { createSubscription, subscriptionCheckoutSignature, verifyCheckoutSignature } = await import("../dist/backend/src/services/billing.js");

const marker = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emails = [`phase3-owner-${marker}@example.com`, `phase3-other-${marker}@example.com`];
const users = await sql`
  INSERT INTO users (email, billing_email, password_hash, display_name)
  VALUES (${emails[0]}, ${emails[0]}, 'test-hash', 'Phase 3 Owner'),
         (${emails[1]}, ${emails[1]}, 'test-hash', 'Phase 3 Other')
  RETURNING id
`;
const ownerId = users[0].id;
const otherId = users[1].id;

await sql`
  INSERT INTO plans (id, name, monthly_paise, annual_paise, continue_cap, benefits)
  VALUES ('wave', 'Wave', 39900, 399000, 4, '[]'),
         ('surge', 'Surge', 79900, 799000, 8, '[]'),
         ('tide', 'Tide', 149900, 1499000, 12, '[]')
  ON CONFLICT (id) DO NOTHING
`;

let createCalls = 0;
const subscriptions = new Map();
const payments = new Map();
const gateway = {
  async createSubscription(input) {
    createCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    const id = `sub_${marker}_${createCalls}`;
    const value = { id, plan_id: input.planId, status: "authenticated", customer_id: `cust_${marker}`, notes: input.notes };
    subscriptions.set(id, value);
    return value;
  },
  async fetchSubscription(id) {
    return subscriptions.get(id);
  },
  async fetchPayment(id) {
    return payments.get(id);
  },
  async cancelSubscription() {},
  async updateSubscription() {},
};

try {
  const duplicateKey = `phase3:duplicate:${marker}`;
  const checkoutInput = {
    userId: ownerId,
    email: emails[0],
    planId: "wave",
    billingInterval: "monthly",
    idempotencyKey: duplicateKey,
    gateway,
  };
  const firstPromise = createSubscription(checkoutInput);
  await new Promise((resolve) => setTimeout(resolve, 25));
  const secondPromise = createSubscription(checkoutInput);
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(createCalls, 1, "concurrent duplicate checkout must call Razorpay once");
  assert.equal(first.orderId, second.orderId);
  assert.equal(first.razorpaySubscriptionId, second.razorpaySubscriptionId);

  await assert.rejects(
    createSubscription({ ...checkoutInput, planId: "surge", gateway }),
    (error) => error?.code === "IDEMPOTENCY_CONFLICT",
  );

  const failingGateway = {
    ...gateway,
    async createSubscription() {
      const error = new Error("network timeout");
      error.statusCode = 503;
      throw error;
    },
  };
  const failureKey = `phase3:failure:${marker}`;
  await assert.rejects(
    createSubscription({ ...checkoutInput, idempotencyKey: failureKey, gateway: failingGateway }),
    (error) => error?.code === "BILLING_PROVIDER_UNCERTAIN",
  );
  const failed = await sql`SELECT status, provider_error_code, provider_error_at FROM orders WHERE user_id = ${ownerId} AND idempotency_key = ${failureKey}`;
  assert.equal(failed[0].status, "uncertain");
  assert.ok(failed[0].provider_error_code);
  assert.ok(failed[0].provider_error_at);

  const subscriptionId = first.razorpaySubscriptionId;
  const paymentId = `pay_${marker}_valid`;
  payments.set(paymentId, { id: paymentId, status: "captured", amount: 39900, currency: "INR" });
  const signature = subscriptionCheckoutSignature(paymentId, subscriptionId);
  await assert.rejects(
    verifyCheckoutSignature({
      userId: otherId,
      razorpaySubscriptionId: subscriptionId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
      gateway,
    }),
    (error) => error?.code === "NOT_FOUND",
  );
  await verifyCheckoutSignature({
    userId: ownerId,
    razorpaySubscriptionId: subscriptionId,
    razorpayPaymentId: paymentId,
    razorpaySignature: signature,
    gateway,
  });
  const activated = await sql`SELECT status, activated FROM orders WHERE id = ${first.orderId}`;
  const membership = await sql`SELECT status, plan_id, auto_renew, razorpay_subscription_id, razorpay_customer_id FROM memberships WHERE user_id = ${ownerId}`;
  assert.deepEqual(activated[0], { status: "succeeded", activated: true });
  assert.equal(membership[0].status, "active");
  assert.equal(membership[0].plan_id, "wave");
  assert.equal(membership[0].auto_renew, true);
  assert.equal(membership[0].razorpay_subscription_id, subscriptionId);
  assert.equal(membership[0].razorpay_customer_id, `cust_${marker}`);

  const mismatch = await createSubscription({
    ...checkoutInput,
    idempotencyKey: `phase3:mismatch:${marker}`,
    gateway,
  });
  const mismatchPaymentId = `pay_${marker}_mismatch`;
  payments.set(mismatchPaymentId, { id: mismatchPaymentId, status: "captured", amount: 1, currency: "INR" });
  await assert.rejects(
    verifyCheckoutSignature({
      userId: ownerId,
      razorpaySubscriptionId: mismatch.razorpaySubscriptionId,
      razorpayPaymentId: mismatchPaymentId,
      razorpaySignature: subscriptionCheckoutSignature(mismatchPaymentId, mismatch.razorpaySubscriptionId),
      gateway,
    }),
    (error) => error?.code === "PAYMENT_DETAILS_MISMATCH",
  );
  const mismatchOrder = await sql`SELECT status, activated, provider_error_code FROM orders WHERE id = ${mismatch.orderId}`;
  assert.deepEqual(mismatchOrder[0], { status: "declined", activated: false, provider_error_code: "PROVIDER_STATE_MISMATCH" });

  console.log("billing idempotency, ownership, provider validation, and activation checks passed");
} finally {
  await sql`DELETE FROM users WHERE email IN ${sql(emails)}`;
  await sql.end();
}
