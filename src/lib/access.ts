import { PRODUCT, PLANS, planById } from "../config/product";
import { gameBySlug } from "../data/games";
import type { Entitlement, Game, PlanId, UserProfile } from "../types";

export function isMember(entitlement: Entitlement, now = Date.now()): boolean {
  if (!entitlement.planId) return false;
  if (entitlement.status === "active") return true;
  if (entitlement.status === "active_until" && entitlement.accessEndDate) {
    return new Date(entitlement.accessEndDate).getTime() > now;
  }
  return false;
}

export function continueCap(entitlement: Entitlement): number {
  if (!isMember(entitlement) || !entitlement.planId) return 0;
  return PRODUCT.prototype.continueCaps[entitlement.planId];
}

export type AccessState =
  | { kind: "play-free"; label: "Play free today" }
  | { kind: "play"; label: "Play" }
  | { kind: "locked"; label: "Unlock with membership" }
  | { kind: "capped"; label: "Free session used" }
  | { kind: "maintenance"; label: "Unavailable" }
  | { kind: "unsupported"; label: "Not supported here" };

export function accessForGame(
  game: Game,
  entitlement: Entitlement,
  freeSessionsRemaining: number,
  freeToday: boolean,
): AccessState {
  if (game.maintenance || !game.published) return { kind: "maintenance", label: "Unavailable" };
  if (game.unsupportedNote) return { kind: "unsupported", label: "Not supported here" };
  if (isMember(entitlement)) return { kind: "play", label: "Play" };
  if (freeToday && freeSessionsRemaining > 0) return { kind: "play-free", label: "Play free today" };
  if (freeToday) return { kind: "capped", label: "Free session used" };
  return { kind: "locked", label: "Unlock with membership" };
}

export function canLaunch(access: AccessState): boolean {
  return access.kind === "play" || access.kind === "play-free";
}

export function membershipChip(entitlement: Entitlement): string {
  if (isMember(entitlement) && entitlement.planId) {
    return planById(entitlement.planId).name;
  }
  if (entitlement.status === "pending") return "Payment pending";
  if (entitlement.status === "expired") return "Access ended";
  return "Free";
}

export function planFromQuery(value: string | null): PlanId | null {
  if (value === "wave" || value === "surge" || value === "tide") return value;
  return null;
}

export function checkoutPath(planId: PlanId): string {
  return `/membership/checkout?plan=${planId}`;
}

export function allowlistReturn(raw: string | null | undefined, fallback = "/play"): string {
  if (!raw) return fallback;
  try {
    const url = raw.startsWith("http") ? new URL(raw) : new URL(raw, "https://bullwavegames.com");
    const path = `${url.pathname}${url.search}`;
    if (path.startsWith("/membership/checkout")) {
      const plan = planFromQuery(url.searchParams.get("plan"));
      return plan ? checkoutPath(plan) : "/membership";
    }
    if (path.startsWith("/payment-return") || path.startsWith("/membership/payment-return")) return path;
    const allowed = ["/play", "/games", "/membership", "/challenges", "/collection", "/profile", "/billing", "/welcome", "/settings", "/help", "/payment-return"];
    if (allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return path;
  } catch {
    return fallback;
  }
  return fallback;
}

export function displayNameFor(user: UserProfile | null): string {
  return user?.displayName || "Player";
}

export function planName(id: PlanId | null): string {
  if (!id) return "None";
  return PLANS.find((plan) => plan.id === id)?.name ?? id;
}

export function gameTitle(slug: string): string {
  return gameBySlug(slug)?.title ?? slug;
}
