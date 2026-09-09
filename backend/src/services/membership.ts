import { sql } from "../db.js";
import { addDays } from "../lib/kolkata.js";
import { config } from "../config.js";
import type { BillingInterval, MembershipRow, PlanId } from "../types.js";
import { isMemberNow } from "../types.js";

export async function ensureMembership(userId: string): Promise<MembershipRow> {
  const existing = await getMembership(userId);
  if (existing) return existing;
  const rows = await sql<MembershipRow[]>`
    INSERT INTO memberships ${sql({ user_id: userId, status: "none", source: "none" })}
    RETURNING *
  `;
  return rows[0];
}

export async function getMembership(userId: string): Promise<MembershipRow | null> {
  const rows = await sql<MembershipRow[]>`SELECT * FROM memberships WHERE user_id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function requireMember(userId: string): Promise<MembershipRow> {
  const row = await ensureMembership(userId);
  if (!isMemberNow(row)) {
    const error = new Error("Membership required.");
    (error as Error & { statusCode?: number; code?: string }).statusCode = 402;
    (error as Error & { statusCode?: number; code?: string }).code = "NOT_MEMBER";
    throw error;
  }
  return row;
}

export async function activateMembership(input: {
  userId: string;
  planId: PlanId;
  interval: BillingInterval;
  source: "payment" | "admin_grant";
  days?: number;
  subscriptionId?: string | null;
  customerId?: string | null;
  grantedBy?: string | null;
  autoRenew?: boolean;
}) {
  const days = input.days ?? (input.interval === "annual" ? 365 : 30);
  const start = new Date();
  const end = addDays(start, days);
  const nextPay = input.autoRenew ? end : null;
  await ensureMembership(input.userId);
  const rows = await sql<MembershipRow[]>`
    UPDATE memberships SET
      plan_id = ${input.planId},
      status = ${input.autoRenew ? "active" : "active_until"},
      billing_interval = ${input.interval},
      source = ${input.source},
      razorpay_subscription_id = ${input.subscriptionId ?? null},
      razorpay_customer_id = COALESCE(${input.customerId ?? null}, razorpay_customer_id),
      access_start = ${start},
      access_end = ${end},
      grace_end = NULL,
      last_payment_failed_at = NULL,
      dunning_retry_count = 0,
      next_payment_at = ${nextPay},
      cancel_at_period_end = ${!input.autoRenew},
      auto_renew = ${Boolean(input.autoRenew)},
      granted_by = ${input.grantedBy ?? null},
      updated_at = now()
    WHERE user_id = ${input.userId}
    RETURNING *
  `;
  return rows[0];
}

export async function markPastDue(userId: string) {
  const graceEnd = addDays(new Date(), config.graceDays);
  await sql`
    UPDATE memberships SET
      status = 'past_due',
      last_payment_failed_at = now(),
      dunning_retry_count = dunning_retry_count + 1,
      grace_end = COALESCE(grace_end, ${graceEnd}),
      updated_at = now()
    WHERE user_id = ${userId}
      AND status IN ('active', 'active_until', 'past_due', 'pending')
  `;
}

export async function expireMembership(userId: string) {
  await sql`
    UPDATE memberships SET
      status = 'expired',
      updated_at = now()
    WHERE user_id = ${userId}
  `;
}

export async function expireGraceWindows(): Promise<number> {
  const rows = await sql<{ user_id: string }[]>`
    UPDATE memberships SET status = 'expired', updated_at = now()
    WHERE status = 'past_due' AND grace_end IS NOT NULL AND grace_end < now()
    RETURNING user_id
  `;
  return rows.length;
}

export async function setCancelAtPeriodEnd(userId: string, cancel: boolean) {
  const rows = await sql<MembershipRow[]>`
    UPDATE memberships SET
      cancel_at_period_end = ${cancel},
      auto_renew = ${!cancel},
      updated_at = now()
    WHERE user_id = ${userId}
    RETURNING *
  `;
  await sql`UPDATE users SET auto_renew = ${!cancel}, updated_at = now() WHERE id = ${userId}`;
  return rows[0] ?? null;
}
