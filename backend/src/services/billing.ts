import crypto from "node:crypto";
import Razorpay from "razorpay";
import { sql } from "../db.js";
import { config, razorpayPlanId, type BillingInterval, type PlanId } from "../config.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { safeEqual } from "../lib/crypto.js";
import { logger } from "../logger.js";
import { writeAudit } from "./audit.js";
import { activateMembership, expireMembership, getMembership, markPastDue, setCancelAtPeriodEnd } from "./membership.js";

function client() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) return null;
  return new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
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
  autoRenew: boolean;
}) {
  const plan = await planRow(input.planId);
  const amount = amountFor(plan, input.billingInterval);
  const reference = `bw_${Date.now().toString(36)}`;
  const rz = client();

  const orderRows = await sql<{ id: string }[]>`
    INSERT INTO orders ${sql({
      user_id: input.userId,
      plan_id: input.planId,
      billing_interval: input.billingInterval,
      amount_paise: amount,
      status: "pending",
      reference,
    })}
    RETURNING id
  `;
  const orderId = orderRows[0].id;

  if (!rz) {
    if (!config.allowDevBilling || config.isProd) {
      throw badRequest("Checkout is not configured yet. Razorpay plan IDs are required.", "BILLING_UNCONFIGURED");
    }
    return {
      orderId,
      mode: "dev" as const,
      amountPaise: amount,
      currency: "INR",
      keyId: null,
      razorpayOrderId: null,
      razorpaySubscriptionId: null,
      autoRenew: input.autoRenew,
    };
  }

  const membership = await getMembership(input.userId);
  let customerId = membership?.razorpay_customer_id ?? null;
  if (!customerId) {
    const customer = await rz.customers.create({
      name: input.email.split("@")[0],
      email: input.email,
      notes: { userId: input.userId },
    });
    customerId = String(customer.id);
    const { ensureMembership } = await import("./membership.js");
    await ensureMembership(input.userId);
    await sql`UPDATE memberships SET razorpay_customer_id = ${customerId} WHERE user_id = ${input.userId}`;
  }

  if (input.autoRenew) {
    const planRzp = razorpayPlanId(input.planId, input.billingInterval);
    if (!planRzp) throw badRequest("Annual/monthly Razorpay plan IDs are not configured for this plan.");
    const sub = (await rz.subscriptions.create({
      plan_id: planRzp,
      customer_id: customerId,
      customer_notify: 1,
      total_count: input.billingInterval === "annual" ? 10 : 120,
      notes: { userId: input.userId, orderId, planId: input.planId, interval: input.billingInterval },
    } as never)) as { id: string; short_url?: string };
    await sql`
      UPDATE orders SET razorpay_subscription_id = ${String(sub.id)}, razorpay_order_id = ${sub.id}
      WHERE id = ${orderId}
    `;
    return {
      orderId,
      mode: "razorpay" as const,
      amountPaise: amount,
      currency: "INR",
      keyId: config.razorpay.keyId,
      razorpayOrderId: null,
      razorpaySubscriptionId: String(sub.id),
      shortUrl: (sub as { short_url?: string }).short_url ?? null,
      autoRenew: true,
    };
  }

  const rzOrder = await rz.orders.create({
    amount,
    currency: "INR",
    receipt: reference.slice(0, 40),
    notes: { userId: input.userId, orderId, planId: input.planId, interval: input.billingInterval },
  });
  await sql`UPDATE orders SET razorpay_order_id = ${String(rzOrder.id)} WHERE id = ${orderId}`;
  return {
    orderId,
    mode: "razorpay" as const,
    amountPaise: amount,
    currency: "INR",
    keyId: config.razorpay.keyId,
    razorpayOrderId: String(rzOrder.id),
    razorpaySubscriptionId: null,
    autoRenew: false,
  };
}

export async function fulfillOrder(orderId: string, paymentId?: string) {
  const rows = await sql<
    {
      id: string;
      user_id: string;
      plan_id: PlanId;
      billing_interval: BillingInterval;
      amount_paise: number;
      activated: boolean;
      status: string;
    }[]
  >`SELECT id, user_id, plan_id, billing_interval, amount_paise, activated, status FROM orders WHERE id = ${orderId}`;
  const order = rows[0];
  if (!order) throw notFound("Order not found.");
  if (order.activated) return order;
  await sql`
    UPDATE orders SET
      status = 'succeeded',
      activated = true,
      razorpay_payment_id = COALESCE(${paymentId ?? null}, razorpay_payment_id)
    WHERE id = ${order.id}
  `;
  const user = await sql<{ auto_renew: boolean }[]>`SELECT auto_renew FROM users WHERE id = ${order.user_id}`;
  await activateMembership({
    userId: order.user_id,
    planId: order.plan_id,
    interval: order.billing_interval,
    source: "payment",
    autoRenew: user[0]?.auto_renew ?? false,
    days: order.billing_interval === "annual" ? 365 : 30,
  });
  await sql`
    INSERT INTO invoices ${sql({
      user_id: order.user_id,
      order_id: order.id,
      plan_id: order.plan_id,
      amount_paise: order.amount_paise,
      status: "paid",
      paid_at: new Date(),
      razorpay_payment_id: paymentId ?? null,
    })}
  `;
  return order;
}

export async function devFulfill(userId: string, orderId: string) {
  if (config.isProd || !config.allowDevBilling) throw badRequest("Dev billing is disabled.");
  const rows = await sql<{ user_id: string }[]>`SELECT user_id FROM orders WHERE id = ${orderId}`;
  if (!rows[0] || rows[0].user_id !== userId) throw notFound("Order not found.");
  return fulfillOrder(orderId, "dev_pay");
}

export async function verifyCheckoutSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const expected = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");
  if (!safeEqual(expected, input.razorpaySignature)) throw badRequest("Payment signature mismatch.");
  const orders = await sql<{ id: string }[]>`SELECT id FROM orders WHERE razorpay_order_id = ${input.razorpayOrderId}`;
  if (!orders[0]) throw notFound("Order not found.");
  await sql`
    UPDATE orders SET razorpay_payment_id = ${input.razorpayPaymentId}, razorpay_signature = ${input.razorpaySignature}
    WHERE id = ${orders[0].id}
  `;
  return fulfillOrder(orders[0].id, input.razorpayPaymentId);
}

export function verifyWebhookSignature(rawBody: string, signature: string | undefined) {
  if (!config.razorpay.webhookSecret) throw badRequest("Webhook secret is not configured.");
  if (!signature) throw badRequest("Missing webhook signature.");
  const expected = crypto.createHmac("sha256", config.razorpay.webhookSecret).update(rawBody).digest("hex");
  if (!safeEqual(expected, signature)) throw badRequest("Invalid webhook signature.", "WEBHOOK_BAD_SIG");
}

export async function handleRazorpayEvent(eventId: string, eventType: string, payload: unknown) {
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO webhook_events ${sql({
      event_id: eventId,
      event_type: eventType,
      payload: sql.json(payload as never),
    })}
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id
  `;
  if (!inserted[0]) return { duplicate: true };

  const body = payload as {
    payload?: {
      payment?: { entity?: { id?: string; notes?: Record<string, string>; order_id?: string; email?: string } };
      subscription?: { entity?: { id?: string; notes?: Record<string, string>; status?: string; customer_id?: string } };
      invoice?: { entity?: { id?: string; subscription_id?: string; payment_id?: string; status?: string } };
    };
  };

  try {
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const notes = body.payload?.payment?.entity?.notes ?? {};
      if (notes.orderId) await fulfillOrder(notes.orderId, body.payload?.payment?.entity?.id);
    }
    if (eventType === "subscription.charged") {
      const sub = body.payload?.subscription?.entity;
      const notes = sub?.notes ?? {};
      const userId = notes.userId;
      const planId = notes.planId as PlanId | undefined;
      const interval = (notes.interval as BillingInterval | undefined) ?? "monthly";
      if (userId && planId) {
        await activateMembership({
          userId,
          planId,
          interval,
          source: "payment",
          autoRenew: true,
          subscriptionId: sub?.id,
          customerId: sub?.customer_id,
        });
      } else if (sub?.id) {
        const mem = await sql<{ user_id: string; plan_id: PlanId; billing_interval: BillingInterval }[]>`
          SELECT user_id, plan_id, billing_interval FROM memberships WHERE razorpay_subscription_id = ${sub.id}
        `;
        if (mem[0]?.plan_id) {
          await activateMembership({
            userId: mem[0].user_id,
            planId: mem[0].plan_id,
            interval: mem[0].billing_interval ?? "monthly",
            source: "payment",
            autoRenew: true,
            subscriptionId: sub.id,
          });
        }
      }
    }
    if (
      eventType === "subscription.pending" ||
      eventType === "subscription.halted" ||
      eventType === "payment.failed" ||
      eventType === "invoice.payment_failed"
    ) {
      const subId = body.payload?.subscription?.entity?.id ?? body.payload?.invoice?.entity?.subscription_id;
      const notes = body.payload?.subscription?.entity?.notes ?? body.payload?.payment?.entity?.notes ?? {};
      let userId = notes.userId;
      if (!userId && subId) {
        const mem = await sql<{ user_id: string }[]>`SELECT user_id FROM memberships WHERE razorpay_subscription_id = ${subId}`;
        userId = mem[0]?.user_id;
      }
      if (userId) {
        await markPastDue(userId);
        const planId = (await getMembership(userId))?.plan_id ?? "wave";
        await sql`
          INSERT INTO invoices ${sql({
            user_id: userId,
            plan_id: planId,
            amount_paise: 0,
            status: "failed",
          })}
        `;
      }
    }
    if (eventType === "subscription.cancelled" || eventType === "subscription.completed") {
      const subId = body.payload?.subscription?.entity?.id;
      if (subId) {
        const mem = await sql<{ user_id: string; access_end: Date | null }[]>`
          SELECT user_id, access_end FROM memberships WHERE razorpay_subscription_id = ${subId}
        `;
        if (mem[0]) {
          if (mem[0].access_end && mem[0].access_end.getTime() > Date.now()) {
            await sql`
              UPDATE memberships SET status = 'active_until', cancel_at_period_end = true, auto_renew = false, updated_at = now()
              WHERE user_id = ${mem[0].user_id}
            `;
          } else {
            await expireMembership(mem[0].user_id);
          }
        }
      }
    }
    await sql`UPDATE webhook_events SET processed_at = now() WHERE event_id = ${eventId}`;
  } catch (error) {
    logger.error({ err: error, eventType, eventId }, "webhook handler failed");
    throw error;
  }
  return { duplicate: false };
}

export async function cancelRenewal(userId: string) {
  const membership = await getMembership(userId);
  if (!membership?.plan_id) throw badRequest("No active membership to cancel.");
  const rz = client();
  if (rz && membership.razorpay_subscription_id) {
    try {
      await rz.subscriptions.cancel(membership.razorpay_subscription_id, false);
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
    await rz.subscriptions.update(membership.razorpay_subscription_id, {
      plan_id: planRzp,
      schedule_change_at: nextRank < currentRank ? "cycle_end" : "now",
    } as never);
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
