import assert from "node:assert/strict";

const { sql } = await import("../dist/backend/src/db.js");
const { enqueueRazorpayEvent, processWebhookEvents } = await import("../dist/backend/src/services/billing.js");
const { fulfillOrderAtomically } = await import("../dist/backend/src/services/billingTransactions.js");

const marker = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emails = ["webhook", "rollback", "blocker"].map((name) => `phase4-${name}-${marker}@example.com`);
const eventIds = [];
const users = await sql`
  INSERT INTO users (email, billing_email, password_hash, display_name)
  VALUES (${emails[0]}, ${emails[0]}, 'test-hash', 'Webhook Owner'),
         (${emails[1]}, ${emails[1]}, 'test-hash', 'Rollback Owner'),
         (${emails[2]}, ${emails[2]}, 'test-hash', 'Subscription Blocker')
  RETURNING id
`;
const ownerId = users[0].id;
const rollbackId = users[1].id;
const blockerId = users[2].id;

function eventPayload(subscriptionId, paymentId, amount, currentEnd) {
  return {
    payload: {
      subscription: { entity: { id: subscriptionId, customer_id: `cust_${marker}`, current_end: currentEnd } },
      payment: { entity: { id: paymentId, status: "captured", amount, currency: "INR" } },
    },
  };
}

async function enqueue(id, type, payload, occurredAt) {
  eventIds.push(id);
  return enqueueRazorpayEvent(id, type, payload, occurredAt);
}

try {
  const subscriptionId = `sub_webhook_${marker}`;
  const orders = await sql`
    INSERT INTO orders (user_id, plan_id, billing_interval, amount_paise, status, reference, razorpay_subscription_id)
    VALUES (${ownerId}, 'wave', 'monthly', 39900, 'pending', ${`phase4-${marker}`}, ${subscriptionId})
    RETURNING id
  `;
  const orderId = orders[0].id;
  const chargedAt = new Date(Date.now() - 10_000);
  const currentEnd = Math.floor((Date.now() + 30 * 86_400_000) / 1000);
  const chargedId = `evt_charged_${marker}`;
  const firstQueue = await enqueue(chargedId, "subscription.charged", eventPayload(subscriptionId, `pay_initial_${marker}`, 39900, currentEnd), chargedAt);
  const duplicateQueue = await enqueueRazorpayEvent(chargedId, "subscription.charged", {}, chargedAt);
  assert.deepEqual(firstQueue, { duplicate: false });
  assert.deepEqual(duplicateQueue, { duplicate: true });
  assert.equal(await processWebhookEvents(), 1);

  let membership = (await sql`SELECT status, last_billing_event_at FROM memberships WHERE user_id = ${ownerId}`)[0];
  assert.equal(membership.status, "active");
  assert.equal((await sql`SELECT count(*)::int AS count FROM invoices WHERE order_id = ${orderId}`)[0].count, 1);
  assert.equal((await sql`SELECT status FROM webhook_events WHERE event_id = ${chargedId}`)[0].status, "completed");

  const olderFailureId = `evt_old_failure_${marker}`;
  await enqueue(olderFailureId, "payment.failed", {
    payload: {
      subscription: { entity: { id: subscriptionId } },
      payment: { entity: { id: `pay_old_failed_${marker}`, amount: 39900, currency: "INR" } },
    },
  }, new Date(chargedAt.getTime() - 5_000));
  await processWebhookEvents();
  membership = (await sql`SELECT status, dunning_retry_count FROM memberships WHERE user_id = ${ownerId}`)[0];
  assert.equal(membership.status, "active", "an older failure must not regress a newer successful charge");
  assert.equal(membership.dunning_retry_count, 0);

  const failedAt = new Date(chargedAt.getTime() + 5_000);
  await enqueue(`evt_new_failure_${marker}`, "payment.failed", {
    payload: {
      subscription: { entity: { id: subscriptionId } },
      payment: { entity: { id: `pay_new_failed_${marker}`, amount: 39900, currency: "INR" } },
    },
  }, failedAt);
  await processWebhookEvents();
  membership = (await sql`SELECT status, dunning_retry_count, grace_end FROM memberships WHERE user_id = ${ownerId}`)[0];
  assert.equal(membership.status, "past_due");
  assert.equal(membership.dunning_retry_count, 1);
  assert.ok(membership.grace_end);

  const renewalAt = new Date(failedAt.getTime() + 5_000);
  await enqueue(`evt_renewal_${marker}`, "subscription.charged", eventPayload(subscriptionId, `pay_renewal_${marker}`, 39900, currentEnd + 2_592_000), renewalAt);
  await processWebhookEvents();
  membership = (await sql`SELECT status, dunning_retry_count, grace_end FROM memberships WHERE user_id = ${ownerId}`)[0];
  assert.equal(membership.status, "active");
  assert.equal(membership.dunning_retry_count, 0);
  assert.equal(membership.grace_end, null);
  assert.equal((await sql`SELECT count(*)::int AS count FROM invoices WHERE order_id = ${orderId} AND status = 'paid'`)[0].count, 2);

  await enqueue(`evt_old_cancel_${marker}`, "subscription.cancelled", {
    payload: { subscription: { entity: { id: subscriptionId } } },
  }, new Date(failedAt.getTime() + 1_000));
  await processWebhookEvents();
  assert.equal((await sql`SELECT status FROM memberships WHERE user_id = ${ownerId}`)[0].status, "active");

  const deadId = `evt_dead_${marker}`;
  await enqueue(deadId, "subscription.charged", eventPayload(`sub_missing_${marker}`, `pay_missing_${marker}`, 39900, currentEnd), new Date());
  await processWebhookEvents();
  let failedJob = (await sql`SELECT status, attempt_count, last_error FROM webhook_events WHERE event_id = ${deadId}`)[0];
  assert.equal(failedJob.status, "failed");
  assert.equal(failedJob.attempt_count, 1);
  assert.ok(failedJob.last_error);
  await sql`UPDATE webhook_events SET attempt_count = 7, next_attempt_at = now() WHERE event_id = ${deadId}`;
  await processWebhookEvents();
  failedJob = (await sql`SELECT status, attempt_count FROM webhook_events WHERE event_id = ${deadId}`)[0];
  assert.deepEqual(failedJob, { status: "dead_letter", attempt_count: 8 });

  const conflictingSubscriptionId = `sub_conflict_${marker}`;
  await sql`
    INSERT INTO memberships (user_id, plan_id, status, billing_interval, source, razorpay_subscription_id)
    VALUES (${blockerId}, 'wave', 'active', 'monthly', 'payment', ${conflictingSubscriptionId})
  `;
  const rollbackOrder = (await sql`
    INSERT INTO orders (user_id, plan_id, billing_interval, amount_paise, status, reference, razorpay_subscription_id)
    VALUES (${rollbackId}, 'wave', 'monthly', 39900, 'pending', ${`rollback-${marker}`}, ${conflictingSubscriptionId})
    RETURNING id
  `)[0];
  await assert.rejects(fulfillOrderAtomically({ orderId: rollbackOrder.id, paymentId: `pay_rollback_${marker}` }));
  assert.deepEqual(
    (await sql`SELECT status, activated, razorpay_payment_id FROM orders WHERE id = ${rollbackOrder.id}`)[0],
    { status: "pending", activated: false, razorpay_payment_id: null },
  );
  assert.equal((await sql`SELECT count(*)::int AS count FROM invoices WHERE order_id = ${rollbackOrder.id}`)[0].count, 0);
  assert.equal((await sql`SELECT count(*)::int AS count FROM memberships WHERE user_id = ${rollbackId}`)[0].count, 0);
  assert.equal((await sql`SELECT auto_renew FROM users WHERE id = ${rollbackId}`)[0].auto_renew, false);

  console.log("durable webhook replay, ordering, retry, dead-letter, renewal, and atomic rollback checks passed");
} finally {
  if (eventIds.length) await sql`DELETE FROM webhook_events WHERE event_id IN ${sql(eventIds)}`;
  await sql`DELETE FROM users WHERE email IN ${sql(emails)}`;
  await sql.end();
}
