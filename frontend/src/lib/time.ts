import { PRODUCT } from "../config/product";
import { GAMES } from "../data/games";
import type { Game } from "../types";

export function kolkataNow(date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRODUCT.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return new Date(
    `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}:${read("second")}+05:30`,
  );
}

export function kolkataDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PRODUCT.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function nextKolkataMidnight(date = new Date()): Date {
  const key = kolkataDateKey(date);
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day, 18, 30, 0) + 24 * 60 * 60 * 1000);
  return next;
}

export function formatKolkata(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: PRODUCT.timezone,
    ...options,
  }).format(date);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = Math.max(0, now - then);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatKolkata(new Date(iso), { dateStyle: "medium" });
}

export function consecutiveStreak(isoDates: string[]): number {
  const keys = [...new Set(isoDates.filter(Boolean).map((iso) => kolkataDateKey(new Date(iso))))].sort().reverse();
  if (!keys.length) return 0;
  let cursor = kolkataDateKey();
  if (!keys.includes(cursor)) {
    const yesterday = new Date(`${cursor}T12:00:00+05:30`);
    yesterday.setDate(yesterday.getDate() - 1);
    cursor = kolkataDateKey(yesterday);
    if (!keys.includes(cursor)) return 0;
  }
  let streak = 0;
  while (keys.includes(cursor)) {
    streak += 1;
    const previous = new Date(`${cursor}T12:00:00+05:30`);
    previous.setDate(previous.getDate() - 1);
    cursor = kolkataDateKey(previous);
  }
  return streak;
}

export function resetLabel(date = new Date()): string {
  const next = nextKolkataMidnight(date);
  return `${formatKolkata(next, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })} IST`;
}

/** Three always-free games, windowed by Kolkata date, so the daily run never burns catalog plays. */
export function todaysRotation(date = new Date()): Game[] {
  const free = new Set<string>(PRODUCT.prototype.alwaysFreeSlugs);
  const bySlug = new Map(GAMES.map((game) => [game.slug, game]));
  const published = PRODUCT.prototype.alwaysFreeSlugs
    .map((slug) => bySlug.get(slug))
    .filter((game): game is Game => Boolean(game?.published && !game.maintenance && free.has(game.slug)));
  if (!published.length) return [];
  const dayNumber = Math.floor(new Date(`${kolkataDateKey(date)}T00:00:00+05:30`).getTime() / 86400000);
  const start = ((dayNumber % published.length) + published.length) % published.length;
  const count = Math.min(3, published.length);
  return Array.from({ length: count }, (_, offset) => published[(start + offset) % published.length]);
}

export function isFreeToday(slug: string, date = new Date()): boolean {
  return todaysRotation(date).some((game) => game.slug === slug);
}
