import type postgres from "postgres";
import { sql } from "../db.js";
import { notFound } from "../lib/errors.js";
import type { BillingInterval, PlanId } from "../types.js";

type Tx = postgres.TransactionSql;

type LockedOrder = {
  id: string;
  user_id: string;
  plan_id: PlanId;
  billing_interval: BillingInterval;
  amount_paise: number;
  currency: string;
  activated: boolean;
  status: string;
  razorpay_payment_id: string | null;
  razorpay_subscription_id: string | null;
};

export type SuccessfulPayment = {
  orderId: string;
  paymentId?: string | null;
  customerId?: string | null;
  occurredAt?: Date;
  providerPeriodEnd?: Date | null;
};

function addPeriod(from: Date, interval: BillingInterval): Date {
  return new Date(from.getTime() + (interval === "annual" ? 365 : 30) * 86_400_000);
}

export async function applySuccessfulPayment(tx: Tx, input: SuccessfulPayment): Promise<LockedOrder> {
  const orders = await tx<LockedOrder[]>`
    SELECT id, user_id, plan_id, billing_interval, amount_paise, currency, activated, status,
           razorpay_payment_id, razorpay_subscription_id
    FROM orders WHERE id = ${input.orderId} FOR UPDATE
  `;
  const order = orders[0];
  if (!order) throw notFound("Order not found.");

  const eventAt = input.occurredAt ?? new Date();
  const memberships = await tx<{ access_end: Date | null; last_billing_event_at: Date | null }[]>`
    SELECT access_end, last_billing_event_at FROM memberships WHERE user_id = ${order.user_id} FOR UPDATE
  `;
  const membership = memberships[0];
  if (membership?.last_billing_event_at && membership.last_billing_event_at.getTime() > eventAt.getTime()) return order;

  if (input.paymentId) {
    const duplicate = await tx<{ id: string }[]>`SELECT id FROM invoices WHERE razorpay_payment_id = ${input.paymentId}`;
    if (duplicate[0]) return order;
  } else if (order.activated) {
    return order;
  }

  const recurring = Boolean(order.razorpay_subscription_id);
  const base = membership?.access_end && membership.access_end.getTime() > Date.now() && order.activated
    ? membership.access_end
    : new Date();
  const accessEnd = input.providerPeriodEnd ?? addPeriod(base, order.billing_interval);

  await tx`
    UPDATE orders SET status = 'succeeded', activated = true,
      razorpay_payment_id = COALESCE(razorpay_payment_id, ${input.paymentId ?? null}), updated_at = now()
    WHERE id = ${order.id}
  `;
  if (recurring) await tx`UPDATE users SET auto_renew = true, updated_at = now() WHERE id = ${order.user_id}`;
  await tx`
    INSERT INTO memberships (user_id, status, source)
    VALUES (${order.user_id}, 'none', 'none')
    ON CONFLICT (user_id) DO NOTHING
  `;
  await tx`
    UPDATE memberships SET
      plan_id = ${order.plan_id}, status = ${recurring ? "active" : "active_until"},
      billing_interval = ${order.billing_interval}, source = 'payment',
      razorpay_subscription_id = ${order.razorpay_subscription_id},
      razorpay_customer_id = COALESCE(${input.customerId ?? null}, razorpay_customer_id),
      access_start = COALESCE(access_start, now()), access_end = ${accessEnd},
      grace_end = NULL, last_payment_failed_at = NULL, dunning_retry_count = 0,
      next_payment_at = ${recurring ? accessEnd : null}, cancel_at_period_end = ${!recurring},
      auto_renew = ${recurring}, last_billing_event_at = ${eventAt}, updated_at = now()
    WHERE user_id = ${order.user_id}
  `;
  await tx`
    INSERT INTO invoices ${tx({
      user_id: order.user_id,
      order_id: order.id,
      plan_id: order.plan_id,
      amount_paise: order.amount_paise,
      status: "paid",
      paid_at: eventAt,
      razorpay_payment_id: input.paymentId ?? null,
    })}
  `;
  return { ...order, activated: true, status: "succeeded" };
}

export async function fulfillOrderAtomically(input: SuccessfulPayment): Promise<LockedOrder> {
  return sql.begin((tx) => applySuccessfulPayment(tx, input));
}
