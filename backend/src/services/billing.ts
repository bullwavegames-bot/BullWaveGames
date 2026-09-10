import crypto from "node:crypto";
import Razorpay from "razorpay";
import type postgres from "postgres";
import { sql } from "../db.js";
import { config, razorpayPlanId, type BillingInterval, type PlanId } from "../config.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { safeEqual } from "../lib/crypto.js";
import { logger } from "../logger.js";
import type { MembershipRow } from "../types.js";
import { writeAudit } from "./audit.js";
import { getMembership, setCancelAtPeriodEnd } from "./membership.js";
import { applySuccessfulPayment, fulfillOrderAtomically } from "./billingTransactions.js";

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: string;
  customer_id?: string | null;
  notes?: Record<string, string>;
  short_url?: string | null;
};

export type RazorpayPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
};

export interface BillingGateway {
  createSubscription(input: {
    planId: string;
    totalCount: number;
    notes: Record<string, string>;
  }): Promise<RazorpaySubscription>;
  fetchSubscription(id: string): Promise<RazorpaySubscription>;
  fetchPayment(id: string): Promise<RazorpayPayment>;
  cancelSubscription(id: string): Promise<unknown>;
  updateSubscription(id: string, input: { planId: string; scheduleChangeAt: "now" | "cycle_end" }): Promise<unknown>;
}

function client(): BillingGateway | null {
  if (config.billingMode === "local") return null;
  if (!config.razorpay.keyId || !config.razorpay.keySecret) return null;
  const rz = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  return {
    async createSubscription(input) {
      return (await rz.subscriptions.create({
        plan_id: input.planId,
        customer_notify: 1,
        total_count: input.totalCount,
        notes: input.notes,
      } as never)) as unknown as RazorpaySubscription;
    },
    async fetchSubscription(id) {
      return (await rz.subscriptions.fetch(id)) as unknown as RazorpaySubscription;
    },
    async fetchPayment(id) {
      return (await rz.payments.fetch(id)) as unknown as RazorpayPayment;
    },
    async cancelSubscription(id) {
      return rz.subscriptions.cancel(id, false);
    },
    async updateSubscription(id, input) {
      return rz.subscriptions.update(id, {
        plan_id: input.planId,
        schedule_change_at: input.scheduleChangeAt,
      } as never);
    },
  };
}

async function planRow(planId: PlanId) {
  const rows = await sql<{ id: PlanId; monthly_paise: number; annual_paise: number }[]>`
    SELECT id, monthly_paise, annual_paise FROM plans WHERE id = ${planId}
  `;
  if (!rows[0]) throw badRequest("Unknown plan.");
  return rows[0];
}

function amountFor(plan: { monthly_paise: number; annual_paise: number }, interval: BillingInterval) {
  return interval === "annual" ? plan.annual_paise : plan.monthly_paise;
}

export async function createSubscription(input: {
  userId: string;
  email: string;
  planId: PlanId;
  billingInterval: BillingInterval;
  idempotencyKey: string;
  gateway?: BillingGateway | null;
}) {
  const plan = await planRow(input.planId);
  const amount = amountFor(plan, input.billingInterval);
  const rz = input.gateway === undefined ? client() : input.gateway;
  type CheckoutOrder = {
    id: string;
    plan_id: PlanId;
    billing_interval: BillingInterval;
    amount_paise: number;
    currency: string;
    status: string;
    razorpay_subscription_id: string | null;
    safe_reason: string | null;
  };
  const claimed = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`${input.userId}:${input.idempotencyKey}`}))`;
    const existing = await tx<CheckoutOrder[]>`
      SELECT id, plan_id, billing_interval, amount_paise, currency, status,
             razorpay_subscription_id, safe_reason
      FROM orders WHERE user_id = ${input.userId} AND idempotency_key = ${input.idempotencyKey}
    `;
    if (existing[0]) return { order: existing[0], created: false };
    const reference = `bw_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const inserted = await tx<CheckoutOrder[]>`
      INSERT INTO orders ${tx({
        user_id: input.userId,
        plan_id: input.planId,
        billing_interval: input.billingInterval,
        amount_paise: amount,
        status: "creating",
        reference,
        idempotency_key: input.idempotencyKey,
      })}
      RETURNING id, plan_id, billing_interval, amount_paise, currency, status,
                razorpay_subscription_id, safe_reason
    `;
    return { order: inserted[0], created: true };
  });
  let order = claimed.order;
  if (
    order.plan_id !== input.planId ||
    order.billing_interval !== input.billingInterval ||
    Number(order.amount_paise) !== amount
  ) {
    throw conflict("This idempotency key was already used for a different checkout.", "IDEMPOTENCY_CONFLICT");
  }

  if (!claimed.created && order.status === "creating") {
    for (let attempt = 0; attempt < 20 && order.status === "creating"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const rows = await sql<CheckoutOrder[]>`
        SELECT id, plan_id, billing_interval, amount_paise, currency, status,
               razorpay_subscription_id, safe_reason
        FROM orders WHERE id = ${order.id}
      `;
      order = rows[0] ?? order;
    }
  }
  if (!claimed.created) {
    if (order.status === "creating") throw conflict("Checkout creation is still in progress.", "CHECKOUT_IN_PROGRESS");
    if (order.status === "declined" || order.status === "uncertain") {
      throw conflict(order.safe_reason ?? "The earlier checkout attempt could not be completed. Use a new idempotency key.", "CHECKOUT_RETRY_REQUIRES_NEW_KEY");
    }
    return checkoutResponse(order, rz ? "razorpay" : "dev");
  }

  if (!rz) {
    if (!config.allowDevBilling || config.isProd) {
      await recordProviderFailure(order.id, "declined", "BILLING_UNCONFIGURED", "Checkout is not configured yet.");
      throw badRequest("Checkout is not configured yet. Razorpay plan IDs are required.", "BILLING_UNCONFIGURED");
    }
    const rows = await sql<CheckoutOrder[]>`
      UPDATE orders SET status = 'pending', updated_at = now() WHERE id = ${order.id}
      RETURNING id, plan_id, billing_interval, amount_paise, currency, status,
                razorpay_subscription_id, safe_reason
    `;
    return checkoutResponse(rows[0], "dev");
  }

  const providerPlanId = razorpayPlanId(input.planId, input.billingInterval);
  if (!providerPlanId) {
    await recordProviderFailure(order.id, "declined", "PLAN_UNCONFIGURED", "The selected recurring plan is not configured.");
    throw badRequest("The selected recurring plan is not configured.", "BILLING_UNCONFIGURED");
  }
  try {
    const sub = await rz.createSubscription({
      planId: providerPlanId,
      totalCount: input.billingInterval === "annual" ? 10 : 120,
      notes: {
        userId: input.userId,
        orderId: order.id,
        planId: input.planId,
        interval: input.billingInterval,
        email: input.email,
      },
    });
    if (!sub.id || (sub.plan_id && sub.plan_id !== providerPlanId)) throw new Error("Razorpay returned an invalid subscription.");
    const rows = await sql<CheckoutOrder[]>`
      UPDATE orders SET status = 'pending', razorpay_subscription_id = ${sub.id}, updated_at = now()
      WHERE id = ${order.id}
      RETURNING id, plan_id, billing_interval, amount_paise, currency, status,
                razorpay_subscription_id, safe_reason
    `;
    return { ...checkoutResponse(rows[0], "razorpay"), shortUrl: sub.short_url ?? null };
  } catch (error) {
    const provider = classifyProviderError(error);
    await recordProviderFailure(order.id, provider.status, provider.code, provider.message);
    throw badRequest(provider.message, provider.status === "uncertain" ? "BILLING_PROVIDER_UNCERTAIN" : "BILLING_PROVIDER_REJECTED");
  }
}

function checkoutResponse(order: {
  id: string;
  amount_paise: number;
  currency: string;
  razorpay_subscription_id: string | null;
}, mode: "dev" | "razorpay") {
  return {
    orderId: order.id,
    mode,
    amountPaise: Number(order.amount_paise),
    currency: order.currency,
    keyId: mode === "razorpay" ? config.razorpay.keyId : null,
    razorpayOrderId: null,
    razorpaySubscriptionId: order.razorpay_subscription_id,
    autoRenew: mode === "razorpay",
  };
}

function classifyProviderError(error: unknown): { status: "declined" | "uncertain"; code: string; message: string } {
  const value = error as { statusCode?: number; status?: number; error?: { code?: string }; code?: string };
  const statusCode = Number(value?.statusCode ?? value?.status ?? 0);
  return {
    status: statusCode >= 400 && statusCode < 500 ? "declined" : "uncertain",
    code: String(value?.error?.code ?? value?.code ?? "PROVIDER_ERROR").slice(0, 100),
    message: statusCode >= 400 && statusCode < 500
      ? "Razorpay rejected the checkout request. Check the billing configuration and try again with a new request."
      : "Razorpay did not confirm checkout creation. Check billing status before retrying with a new request.",
  };
}

async function recordProviderFailure(orderId: string, status: "declined" | "uncertain", code: string, message: string) {
  await sql`
    UPDATE orders SET status = ${status}, provider_error_code = ${code}, provider_error_at = now(),
      safe_reason = ${message}, updated_at = now()
    WHERE id = ${orderId}
  `;
}

export async function fulfillOrder(orderId: string, paymentId?: string) {
  return fulfillOrderAtomically({ orderId, paymentId });
}

export async function devFulfill(userId: string, orderId: string) {
  if (config.isProd || !config.allowDevBilling) throw badRequest("Dev billing is disabled.");
  const rows = await sql<{ user_id: string }[]>`SELECT user_id FROM orders WHERE id = ${orderId}`;
  if (!rows[0] || rows[0].user_id !== userId) throw notFound("Order not found.");
  return fulfillOrder(orderId, `dev_pay_${orderId}`);
}

export async function devCancelMembership(userId: string) {
  if (config.isProd || !config.allowDevBilling || config.billingMode !== "local") {
    throw badRequest("Local test billing is disabled.", "DEV_BILLING_DISABLED");
  }
  const rows = await sql<MembershipRow[]>`
    UPDATE memberships SET
      plan_id = NULL,
      status = 'none',
      billing_interval = NULL,
      source = 'none',
      razorpay_customer_id = NULL,
      razorpay_subscription_id = NULL,
      access_start = NULL,
      access_end = NULL,
      grace_end = NULL,
      last_payment_failed_at = NULL,
      dunning_retry_count = 0,
      next_payment_at = NULL,
      cancel_at_period_end = false,
      auto_renew = false,
      granted_by = NULL,
      updated_at = now()
    WHERE user_id = ${userId}
    RETURNING *
  `;
  await sql`UPDATE users SET auto_renew = false, updated_at = now() WHERE id = ${userId}`;
  return rows[0] ?? null;
}

export function subscriptionCheckoutSignature(paymentId: string, subscriptionId: string, secret = config.razorpay.keySecret) {
  return crypto.createHmac("sha256", secret).update(`${paymentId}|${subscriptionId}`).digest("hex");
}

export async function verifyCheckoutSignature(input: {
  userId: string;
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  gateway?: BillingGateway;
}) {
  if (!config.razorpay.keySecret) throw badRequest("Checkout verification is not configured.", "BILLING_UNCONFIGURED");
  const orders = await sql<{
    id: string;
    user_id: string;
    plan_id: PlanId;
    billing_interval: BillingInterval;
    amount_paise: number;
    currency: string;
    razorpay_subscription_id: string;
  }[]>`
    SELECT id, user_id, plan_id, billing_interval, amount_paise, currency, razorpay_subscription_id
    FROM orders
    WHERE user_id = ${input.userId} AND razorpay_subscription_id = ${input.razorpaySubscriptionId}
  `;
  const order = orders[0];
  if (!order) throw notFound("Checkout not found.");
  const expected = subscriptionCheckoutSignature(input.razorpayPaymentId, order.razorpay_subscription_id);
  if (!safeEqual(expected, input.razorpaySignature)) throw badRequest("Payment signature mismatch.");
  const rz = input.gateway ?? client();
  if (!rz) throw badRequest("Checkout verification is not configured.", "BILLING_UNCONFIGURED");
  const [subscription, payment] = await Promise.all([
    rz.fetchSubscription(order.razorpay_subscription_id),
    rz.fetchPayment(input.razorpayPaymentId),
  ]);
  const expectedPlanId = razorpayPlanId(order.plan_id, order.billing_interval);
  const notes = subscription.notes ?? {};
  const validSubscription =
    subscription.id === order.razorpay_subscription_id &&
    subscription.plan_id === expectedPlanId &&
    (subscription.status === "authenticated" || subscription.status === "active") &&
    notes.userId === order.user_id &&
    notes.orderId === order.id &&
    notes.planId === order.plan_id &&
    notes.interval === order.billing_interval;
  const validPayment =
    payment.id === input.razorpayPaymentId &&
    payment.status === "captured" &&
    Number(payment.amount) === Number(order.amount_paise) &&
    String(payment.currency).toUpperCase() === order.currency;
  if (!validSubscription || !validPayment) {
    await recordProviderFailure(order.id, "declined", "PROVIDER_STATE_MISMATCH", "Razorpay checkout details did not match this order.");
    throw badRequest("Payment details could not be verified.", "PAYMENT_DETAILS_MISMATCH");
  }
  return sql.begin(async (tx) => {
    await tx`
      UPDATE orders SET razorpay_signature = ${input.razorpaySignature}, updated_at = now()
      WHERE id = ${order.id}
    `;
    return applySuccessfulPayment(tx, {
      orderId: order.id,
      paymentId: input.razorpayPaymentId,
      customerId: subscription.customer_id,
    });
  });
}

export function verifyWebhookSignature(rawBody: string, signature: string | undefined) {
  if (!config.razorpay.webhookSecret) throw badRequest("Webhook secret is not configured.");
  if (!signature) throw badRequest("Missing webhook signature.");
  const expected = crypto.createHmac("sha256", config.razorpay.webhookSecret).update(rawBody).digest("hex");
  if (!safeEqual(expected, signature)) throw badRequest("Invalid webhook signature.", "WEBHOOK_BAD_SIG");
}

export async function enqueueRazorpayEvent(eventId: string, eventType: string, payload: unknown, occurredAt = new Date()) {
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO webhook_events ${sql({
      event_id: eventId,
      event_type: eventType,
      payload: sql.json(payload as never),
      occurred_at: occurredAt,
    })}
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id
  `;
  return { duplicate: !inserted[0] };
}

type WebhookPayload = {
  created_at?: number;
  payload?: {
    payment?: { entity?: { id?: string; notes?: Record<string, string>; order_id?: string; status?: string; amount?: number; currency?: string } };
    subscription?: { entity?: { id?: string; notes?: Record<string, string>; status?: string; customer_id?: string; current_end?: number } };
    invoice?: { entity?: { id?: string; subscription_id?: string; payment_id?: string; status?: string; amount?: number; currency?: string } };
  };
};

async function processRazorpayEvent(
  tx: postgres.TransactionSql,
  event: { event_type: string; payload: unknown; occurred_at: Date },
) {
  const eventType = event.event_type;
  const body = event.payload as WebhookPayload;
  const payment = body.payload?.payment?.entity;
  const subscription = body.payload?.subscription?.entity;
  const invoice = body.payload?.invoice?.entity;
  const subscriptionId = subscription?.id ?? invoice?.subscription_id;

  if (eventType === "payment.captured" || eventType === "order.paid" || eventType === "subscription.charged") {
    const orderId = payment?.notes?.orderId;
    const orders = orderId
      ? await tx<{ id: string; amount_paise: number; currency: string; razorpay_subscription_id: string | null }[]>`
          SELECT id, amount_paise, currency, razorpay_subscription_id FROM orders WHERE id = ${orderId}
        `
      : subscriptionId
        ? await tx<{ id: string; amount_paise: number; currency: string; razorpay_subscription_id: string | null }[]>`
            SELECT id, amount_paise, currency, razorpay_subscription_id FROM orders WHERE razorpay_subscription_id = ${subscriptionId}
          `
        : [];
    const order = orders[0];
    if (!order) throw new Error("Webhook payment does not match a stored checkout.");
    if (subscriptionId && order.razorpay_subscription_id && subscriptionId !== order.razorpay_subscription_id) {
      throw new Error("Webhook subscription does not match the stored checkout.");
    }
    const amount = payment?.amount ?? invoice?.amount;
    const currency = payment?.currency ?? invoice?.currency;
    if (amount !== undefined && Number(amount) !== Number(order.amount_paise)) throw new Error("Webhook payment amount mismatch.");
    if (currency && currency.toUpperCase() !== order.currency) throw new Error("Webhook payment currency mismatch.");
    if (payment?.status && payment.status !== "captured") throw new Error("Webhook payment is not captured.");
    const paymentId = payment?.id ?? invoice?.payment_id;
    if (!paymentId) throw new Error("Webhook payment ID is missing.");
    const periodEnd = subscription?.current_end ? new Date(subscription.current_end * 1000) : null;
    await applySuccessfulPayment(tx, {
      orderId: order.id,
      paymentId,
      customerId: subscription?.customer_id,
      occurredAt: event.occurred_at,
      providerPeriodEnd: periodEnd,
    });
    return;
  }

  const membershipRows = subscriptionId
    ? await tx<{ user_id: string; plan_id: PlanId | null; access_end: Date | null; last_billing_event_at: Date | null }[]>`
        SELECT user_id, plan_id, access_end, last_billing_event_at
        FROM memberships WHERE razorpay_subscription_id = ${subscriptionId} FOR UPDATE
      `
    : [];
  const membership = membershipRows[0];
  if (!membership) {
    if (eventType.startsWith("subscription.") || eventType === "payment.failed" || eventType === "invoice.payment_failed") {
      throw new Error("Webhook subscription does not match a membership.");
    }
    return;
  }
  if (membership.last_billing_event_at && membership.last_billing_event_at.getTime() > event.occurred_at.getTime()) return;

  if (
    eventType === "subscription.pending" ||
    eventType === "subscription.halted" ||
    eventType === "payment.failed" ||
    eventType === "invoice.payment_failed"
  ) {
    await tx`
      UPDATE memberships SET status = 'past_due', last_payment_failed_at = ${event.occurred_at},
        dunning_retry_count = dunning_retry_count + 1,
        grace_end = COALESCE(grace_end, ${new Date(event.occurred_at.getTime() + config.graceDays * 86_400_000)}),
        last_billing_event_at = ${event.occurred_at}, updated_at = now()
      WHERE user_id = ${membership.user_id}
    `;
    if (membership.plan_id) {
      await tx`
        INSERT INTO invoices ${tx({
          user_id: membership.user_id,
          plan_id: membership.plan_id,
          amount_paise: payment?.amount ?? invoice?.amount ?? 0,
          status: "failed",
          razorpay_payment_id: payment?.id ?? invoice?.payment_id ?? null,
        })}
        ON CONFLICT (razorpay_payment_id) DO NOTHING
      `;
    }
    return;
  }

  if (eventType === "subscription.cancelled" || eventType === "subscription.completed") {
    const accessRemains = Boolean(membership.access_end && membership.access_end.getTime() > Date.now());
    await tx`
      UPDATE memberships SET status = ${accessRemains ? "active_until" : "expired"},
        cancel_at_period_end = true, auto_renew = false, next_payment_at = NULL,
        last_billing_event_at = ${event.occurred_at}, updated_at = now()
      WHERE user_id = ${membership.user_id}
    `;
    await tx`UPDATE users SET auto_renew = false, updated_at = now() WHERE id = ${membership.user_id}`;
  }
}

export async function processWebhookEvents(limit = 20): Promise<number> {
  const events = await sql.begin(async (tx) => {
    const rows = await tx<{ id: string; event_type: string; payload: unknown; occurred_at: Date; attempt_count: number }[]>`
      SELECT id, event_type, payload, occurred_at, attempt_count
      FROM webhook_events
      WHERE (status IN ('pending', 'failed') AND next_attempt_at <= now())
         OR (status = 'processing' AND processing_started_at < now() - interval '5 minutes')
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    for (const event of rows) {
      await tx`
        UPDATE webhook_events SET status = 'processing', processing_started_at = now(),
          attempt_count = attempt_count + 1, updated_at = now()
        WHERE id = ${event.id}
      `;
    }
    return rows;
  });

  for (const event of events) {
    try {
      await sql.begin(async (tx) => {
        await processRazorpayEvent(tx, event);
        await tx`
          UPDATE webhook_events SET status = 'completed', processed_at = now(), completed_at = now(),
            processing_started_at = NULL, last_error = NULL, updated_at = now()
          WHERE id = ${event.id}
        `;
      });
    } catch (error) {
      const attempts = event.attempt_count + 1;
      const dead = attempts >= 8;
      const delaySeconds = Math.min(3600, 15 * 2 ** Math.max(0, attempts - 1));
      await sql`
        UPDATE webhook_events SET status = ${dead ? "dead_letter" : "failed"},
          next_attempt_at = now() + (${delaySeconds} * interval '1 second'), processing_started_at = NULL,
          last_error = ${String(error instanceof Error ? error.message : error).slice(0, 500)}, updated_at = now()
        WHERE id = ${event.id}
      `;
      logger.warn({ err: error, eventType: event.event_type, eventId: event.id, attempts }, "webhook processing failed");
    }
  }
  return events.length;
}

export async function handleRazorpayEvent(eventId: string, eventType: string, payload: unknown) {
  const body = payload as WebhookPayload;
  const occurredAt = body.created_at ? new Date(body.created_at * 1000) : new Date();
  return enqueueRazorpayEvent(eventId, eventType, payload, occurredAt);
}

export async function cancelRenewal(userId: string) {
  const membership = await getMembership(userId);
  if (!membership?.plan_id) throw badRequest("No active membership to cancel.");
  const rz = client();
  if (rz && membership.razorpay_subscription_id) {
    try {
      await rz.cancelSubscription(membership.razorpay_subscription_id);
    } catch (error) {
      logger.warn({ err: error }, "razorpay cancel failed; marking local cancel_at_period_end");
    }
  }
  const row = await setCancelAtPeriodEnd(userId, true);
  return row;
}

export async function setAutoRenew(userId: string, autoRenew: boolean) {
  if (!autoRenew) return cancelRenewal(userId);
  const row = await setCancelAtPeriodEnd(userId, false);
  await sql`UPDATE users SET auto_renew = true WHERE id = ${userId}`;
  return row;
}

export async function changePlan(userId: string, planId: PlanId, interval: BillingInterval) {
  const membership = await getMembership(userId);
  if (!membership) throw notFound();
  const rz = client();
  const planRzp = razorpayPlanId(planId, interval);
  if (rz && membership.razorpay_subscription_id && planRzp) {
    const currentRank = { wave: 1, surge: 2, tide: 3 }[membership.plan_id ?? "wave"];
    const nextRank = { wave: 1, surge: 2, tide: 3 }[planId];
    await rz.updateSubscription(membership.razorpay_subscription_id, {
      planId: planRzp,
      scheduleChangeAt: nextRank < currentRank ? "cycle_end" : "now",
    });
  }
  if (!membership.razorpay_subscription_id) {
    throw conflict("Start checkout to change plan when no Razorpay subscription exists.");
  }
  await writeAudit(userId, "plan_change_requested", userId, { planId, interval });
  return getMembership(userId);
}

export async function listInvoices(userId: string) {
  return sql`
    SELECT id, created_at, plan_id, amount_paise, status, order_id, paid_at
    FROM invoices WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50
  `;
}

export async function getOrder(userId: string, orderId: string) {
  const rows = await sql`
    SELECT id, plan_id, amount_paise, status, created_at, activated, reference, safe_reason
    FROM orders WHERE id = ${orderId} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}
