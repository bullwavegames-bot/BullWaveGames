export type Role = "player" | "admin";
export type PlanId = "wave" | "surge" | "tide";
export type MembershipStatus = "none" | "pending" | "active" | "active_until" | "past_due" | "expired";
export type BillingInterval = "monthly" | "annual";

export type UserRow = {
  id: string;
  email: string;
  billing_email: string;
  password_hash: string | null;
  auth_provider: "legacy" | "supabase";
  supabase_user_id: string | null;
  display_name: string;
  avatar_id: string;
  email_verified_at: Date | null;
  role: Role;
  onboarding_complete: boolean;
  auto_renew: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deletion_status: "active" | "pending" | "completed" | "failed";
  deletion_requested_at: Date | null;
};

export type MembershipRow = {
  user_id: string;
  plan_id: PlanId | null;
  status: MembershipStatus;
  billing_interval: BillingInterval | null;
  source: "none" | "payment" | "admin_grant";
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  access_start: Date | null;
  access_end: Date | null;
  grace_end: Date | null;
  last_payment_failed_at: Date | null;
  dunning_retry_count: number;
  next_payment_at: Date | null;
  cancel_at_period_end: boolean;
  auto_renew: boolean;
  granted_by: string | null;
};

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    billingEmail: user.billing_email,
    displayName: user.display_name,
    avatarId: user.avatar_id,
    emailVerified: Boolean(user.email_verified_at),
    role: user.role,
    createdAt: user.created_at.toISOString(),
    onboardingComplete: user.onboarding_complete,
    autoRenew: user.auto_renew,
  };
}

export function isMemberNow(row: MembershipRow | null, now = new Date()): boolean {
  if (!row) return false;
  if (row.status === "active" || row.status === "active_until") {
    return Boolean(row.access_end && row.access_end.getTime() > now.getTime());
  }
  if (row.status === "past_due") {
    return Boolean(row.grace_end && row.grace_end.getTime() > now.getTime());
  }
  return false;
}

export function publicEntitlement(row: MembershipRow | null) {
  const member = isMemberNow(row);
  return {
    planId: member ? row?.plan_id ?? null : row?.status === "past_due" ? row.plan_id : row?.plan_id ?? null,
    status: row?.status ?? "none",
    accessEndDate: row?.access_end?.toISOString() ?? null,
    graceEnd: row?.grace_end?.toISOString() ?? null,
    nextPaymentDate: row?.next_payment_at?.toISOString() ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    source: row?.source === "admin_grant" ? "admin-grant" : row?.source ?? "none",
    orderId: null as string | null,
    autoRenew: row?.auto_renew ?? false,
    dunningRetryCount: row?.dunning_retry_count ?? 0,
  };
}
