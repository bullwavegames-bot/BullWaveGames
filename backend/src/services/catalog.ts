import { redis } from "../redis.js";
import { sql } from "../db.js";

const TTL_SECONDS = 60;
const CATALOG_VERSION_KEY = "catalog:version";
const PLAN_VERSION_KEY = "plans:version";

async function version(key: string): Promise<string> {
  return (await redis.get(key)) ?? "0";
}

async function cached<T>(prefix: string, versionKey: string, load: () => Promise<T>): Promise<T> {
  try {
    const cacheKey = `${prefix}:v${await version(versionKey)}`;
    const hit = await redis.get(cacheKey);
    if (hit) return JSON.parse(hit) as T;
    const value = await load();
    await redis.set(cacheKey, JSON.stringify(value), "EX", TTL_SECONDS);
    return value;
  } catch {
    return load();
  }
}

export function listPublishedGames() {
  return cached("catalog:published", CATALOG_VERSION_KEY, () => sql`SELECT * FROM games WHERE published ORDER BY title`);
}

export function listPublicPlans() {
  return cached("plans:public", PLAN_VERSION_KEY, () => sql`
    SELECT id, name, monthly_paise, annual_paise, continue_cap, benefits FROM plans ORDER BY monthly_paise
  `);
}

export async function invalidateCatalog(): Promise<void> {
  await redis.incr(CATALOG_VERSION_KEY).catch(() => undefined);
}

export async function invalidatePlans(): Promise<void> {
  await redis.incr(PLAN_VERSION_KEY).catch(() => undefined);
}
