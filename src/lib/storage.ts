const KEY = "bullwave.v1";

export interface PersistedStore {
  users: import("../types").UserProfile[];
  sessionUserId: string | null;
  guestKey: string;
  age: "unknown" | "adult" | "under18";
  entitlementByUser: Record<string, import("../types").Entitlement>;
  orders: import("../types").PaymentOrder[];
  invoices: import("../types").Invoice[];
  sessionDays: Record<string, number>;
  saves: Record<string, import("../types").GameSave>;
  bests: Record<string, import("../types").PersonalBest>;
  achievements: Record<string, import("../types").Achievement[]>;
  ownedCosmetics: Record<string, string[]>;
  equipped: Record<string, { frameId: string | null; themeId: string | null; badgeId: string | null }>;
  settingsByUser: Record<
    string,
    {
      reducedMotion: boolean;
      uiSound: boolean;
      gameSound: boolean;
      reminderEnabled: boolean;
      reminderInterval: "tonight" | "tomorrow" | "weekend";
      soundConsent: boolean;
    }
  >;
  challengeEntered: Record<string, boolean>;
  challengeScores: Record<string, number>;
  onboarding: Record<string, { step: number; complete: boolean }>;
  tickets: { id: string; name: string; email: string; topic: string; message: string; paymentRef?: string; at: string }[];
  gamesOverride: import("../types").Game[];
  contentNotes: { id: string; title: string; type: string; status: string; updated: string; body: string }[];
  breakReminder: { until: number; label: string } | null;
  selectedPlan: import("../types").PlanId | null;
}

function empty(): PersistedStore {
  return {
    users: [],
    sessionUserId: null,
    guestKey: crypto.randomUUID(),
    age: "unknown",
    entitlementByUser: {},
    orders: [],
    invoices: [],
    sessionDays: {},
    saves: {},
    bests: {},
    achievements: {},
    ownedCosmetics: {},
    equipped: {},
    settingsByUser: {},
    challengeEntered: {},
    challengeScores: {},
    onboarding: {},
    tickets: [],
    gamesOverride: [],
    contentNotes: [
      {
        id: "story-1",
        title: "Paper, light, and the five-minute world",
        type: "journal",
        status: "published",
        updated: "2026-09-08",
        body: "Draft journal copy.",
      },
      {
        id: "help-1",
        title: "Playing today’s free games",
        type: "help",
        status: "published",
        updated: "2026-09-08",
        body: "Approved help draft.",
      },
    ],
    breakReminder: null,
    selectedPlan: null,
  };
}

export function loadStore(): PersistedStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

export function saveStore(store: PersistedStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export const emptyEntitlement = (): import("../types").Entitlement => ({
  planId: null,
  status: "none",
  accessEndDate: null,
  nextPaymentDate: null,
  cancelAtPeriodEnd: false,
  source: "none",
  orderId: null,
});
