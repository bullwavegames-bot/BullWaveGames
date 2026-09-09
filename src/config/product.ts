import type { Plan, PlanId } from "../types";

/**
 * Single source of truth for configured vs prototype facts.
 * Numeric allowances and continue caps are CONFIGURABLE prototype values,
 * not contractual promises.
 */
export const PRODUCT = {
  brand: "Bullwave Games",
  legalEntity: "CAPITAL BULL WAVE PRIVATE LIMITED",
  domain: "bullwavegames.com",
  language: "English",
  currency: "INR",
  currencySymbol: "₹",
  audience: "India-first",
  positioning: "Play every published browser game free. Membership adds optional studio perks.",
  timezone: "Asia/Kolkata",
  ageMinimum: 18,
  soundMutedByDefault: true,
  maxContentWidth: 1200,
  /**
   * Prototype configuration — replace from server product config.
   * Do not treat these numbers as legal entitlements.
   */
  prototype: {
    dataLabel: "Sample prototype data",
    isLivePayment: false,
    paymentProviderName: "Razorpay (test mode)",
    autoRenewalEnabled: false,
    taxIncludedInDisplayedPrice: true,
    taxBreakdownAvailable: false,
    googleSignInConfigured: false,
    phoneRequired: false,
    mfaEnabled: false,
    referralPrompt: false,
    emailVerificationRequiredForPlay: true,
    crossDeviceReminders: false,
    deletionImmediate: true,
    refundProcessingNote:
      "Refund eligibility follows the approved refund policy and payment-provider configuration. This prototype does not process live payments.",
    /** Historical prototype login. Do not seed this account. Promote admins in Supabase SQL. */
    adminEmail: "operations@bullwavegames.com",
    sampleBillingDate: "2026-10-08",
    freeDailyGameCount: 3,
    freeSessionAllowance: 3,
    continueCaps: {
      wave: 1,
      surge: 3,
      tide: 5,
    } as Record<PlanId, number>,
    accessPeriodDays: 30,
    dailyResetHourLabel: "00:00",
  },
} as const;

export const PLANS: Plan[] = [
  {
    id: "wave",
    name: "Wave",
    monthlyPriceInr: 399,
    benefits: ["Full catalog", "No ads", "Standard frames", "Extra continue"],
  },
  {
    id: "surge",
    name: "Surge",
    monthlyPriceInr: 799,
    benefits: [
      "Everything in Wave",
      "Extra continues",
      "Weekly cosmetics",
      "Early access to new games",
    ],
  },
  {
    id: "tide",
    name: "Tide",
    monthlyPriceInr: 1499,
    benefits: [
      "Everything in Surge",
      "Exclusive themes",
      "Tide badge",
      "Highest continue cap",
    ],
  },
];

export function planById(id: PlanId): Plan {
  const plan = PLANS.find((item) => item.id === id);
  if (!plan) throw new Error(`Unknown plan ${id}`);
  return plan;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export const COMPARISON_ROWS: { feature: string; wave: string; surge: string; tide: string }[] = [
  { feature: "Today’s free rotation", wave: "Included", surge: "Included", tide: "Included" },
  { feature: "Full studio catalog", wave: "Yes", surge: "Yes", tide: "Yes" },
  { feature: "Ad-free access", wave: "Yes", surge: "Yes", tide: "Yes" },
  { feature: "Standard frames", wave: "Yes", surge: "Yes", tide: "Yes" },
  {
    feature: "Continues",
    wave: "Standard cap (configurable)",
    surge: "Extra continues (configurable)",
    tide: "Highest continue cap (configurable)",
  },
  { feature: "Weekly challenge cosmetics", wave: "No", surge: "Yes", tide: "Yes" },
  { feature: "Early access", wave: "No", surge: "Yes", tide: "Yes" },
  { feature: "Exclusive themes", wave: "No", surge: "No", tide: "Yes" },
  { feature: "Tide badge", wave: "No", surge: "No", tide: "Yes" },
];

export const SAFE_RETURN_PREFIXES = [
  "/play",
  "/games",
  "/membership",
  "/challenges",
  "/collection",
  "/profile",
  "/billing",
  "/welcome",
  "/friends",
  "/leaderboards",
] as const;
