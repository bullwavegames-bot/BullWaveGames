import { PRODUCT, PLANS, planById } from "../config/product";
import { gameBySlug, GAMES } from "../data/games";
import { isFreeToday } from "./time";
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

export const ALWAYS_FREE_SLUGS: readonly string[] = PRODUCT.prototype.alwaysFreeSlugs;

export function isAlwaysFree(slug: string): boolean {
  return ALWAYS_FREE_SLUGS.includes(slug);
}

export function alwaysFreeGames(games: Game[] = GAMES): Game[] {
  const bySlug = new Map(games.map((game) => [game.slug, game]));
  return ALWAYS_FREE_SLUGS.map((slug) => bySlug.get(slug)).filter((game): game is Game => Boolean(game?.published && !game.maintenance));
}

export function trialPlaysUsed(counts: Record<string, number> | undefined, slug: string): number {
  return counts?.[slug] ?? 0;
}

export function trialPlaysRemaining(counts: Record<string, number> | undefined, slug: string): number {
  if (isAlwaysFree(slug)) return PRODUCT.prototype.freePlaysPerGame;
  return Math.max(0, PRODUCT.prototype.freePlaysPerGame - trialPlaysUsed(counts, slug));
}

export type AccessState =
  | { kind: "play-free"; label: string; remaining: number | null }
  | { kind: "play"; label: "Play"; remaining: null }
  | { kind: "locked"; label: "Unlock with membership"; remaining: 0 }
  | { kind: "capped"; label: "Membership required"; remaining: 0 }
  | { kind: "maintenance"; label: "Unavailable"; remaining: null }
  | { kind: "unsupported"; label: "Not supported here"; remaining: null };

export function accessForGame(game: Game, entitlement: Entitlement, playsUsed = 0): AccessState {
  if (game.maintenance || !game.published) return { kind: "maintenance", label: "Unavailable", remaining: null };
  if (game.unsupportedNote) return { kind: "unsupported", label: "Not supported here", remaining: null };
  if (isMember(entitlement)) return { kind: "play", label: "Play", remaining: null };
  if (isAlwaysFree(game.slug)) return { kind: "play-free", label: "Always free", remaining: null };
  if (isFreeToday(game.slug)) return { kind: "play-free", label: "Free today", remaining: null };
  const remaining = Math.max(0, PRODUCT.prototype.freePlaysPerGame - playsUsed);
  if (remaining > 0) {
    return {
      kind: "play-free",
      label: `${remaining} free play${remaining === 1 ? "" : "s"} left`,
      remaining,
    };
  }
  return { kind: "capped", label: "Membership required", remaining: 0 };
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
    const allowed = ["/play", "/games", "/membership", "/challenges", "/collection", "/profile", "/billing", "/welcome", "/settings", "/help", "/payment-return", "/friends", "/leaderboards"];
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
