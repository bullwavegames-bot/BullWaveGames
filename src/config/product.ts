import type { Plan, PlanId } from "../types";

/**
 * Single source of truth for configured vs prototype facts.
 * Numeric allowances and continue caps are CONFIGURABLE prototype values,
 * not contractual promises.
 */
export const PRODUCT = {
  brand: "Bullwave Games",
  legalEntity: "BULL WAVE CLUB",
  domain: "bullwavegames.com",
  language: "English",
  currency: "INR",
  currencySymbol: "₹",
  audience: "India-first",
    positioning: "Play selected always-free games anytime. Membership unlocks the rest of the studio.",
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
    freeDailyGameCount: 5,
    freePlaysPerGame: 0,
    alwaysFreeSlugs: [
      "sudoku",
      "solitaire",
      "2048",
      "chess",
      "snake-arena",
    ] as const,
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
    tagline: "Unlock the studio catalog without extra fuss.",
    bestFor: "Players who want unlimited access to the full catalog.",
    benefits: ["Unlimited game catalog", "Ad-free sessions", "Standard frames", "1 extra continue per session"],
  },
  {
    id: "surge",
    name: "Surge",
    monthlyPriceInr: 799,
    tagline: "Extra continues and weekly cosmetics. The most chosen plan.",
    bestFor: "Regular players who want more continues and weekly fold rewards.",
    featured: true,
    benefits: [
      "Everything in Wave",
      "3 extra continues per session",
      "Weekly challenge cosmetics",
      "Early access to new games",
    ],
  },
  {
    id: "tide",
    name: "Tide",
    monthlyPriceInr: 1499,
    tagline: "Highest continue cap, exclusive themes, and the Tide badge.",
    bestFor: "Players who want every cosmetic perk in the current catalog.",
    benefits: [
      "Everything in Surge",
      "5 extra continues per session",
      "Exclusive Tide themes",
      "Tide badge",
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
  { feature: "Always-free games", wave: "8, no play cap", surge: "8, no play cap", tide: "8, no play cap" },
  { feature: "Other catalog titles", wave: "Unlimited", surge: "Unlimited", tide: "Unlimited" },
  { feature: "Ad-free access", wave: "Yes", surge: "Yes", tide: "Yes" },
  { feature: "Access period", wave: "30 days", surge: "30 days", tide: "30 days" },
  { feature: "Auto-renew", wave: "Off", surge: "Off", tide: "Off" },
  { feature: "Wallet or buy-in", wave: "None", surge: "None", tide: "None" },
  { feature: "Paid ranking advantage", wave: "None", surge: "None", tide: "None" },
  { feature: "Continues per session", wave: "1", surge: "3", tide: "5" },
  { feature: "Standard frames", wave: "Yes", surge: "Yes", tide: "Yes" },
  { feature: "Weekly fold cosmetics", wave: "No", surge: "Yes", tide: "Yes" },
  { feature: "Early access to new games", wave: "No", surge: "Yes", tide: "Yes" },
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
