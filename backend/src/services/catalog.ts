import { redis } from "../redis.js";
import { sql } from "../db.js";

const TTL_SECONDS = 60;
const CATALOG_VERSION_KEY = "catalog:version";
const PLAN_VERSION_KEY = "plans:version";

type GameRecord = Record<string, unknown>;
type PlanRecord = Record<string, unknown>;

export function publicGame(game: GameRecord) {
  return {
    slug: String(game.slug), title: String(game.title), genre: String(game.genre),
    sessionMinutes: Number(game.session_minutes), fantasy: String(game.fantasy ?? ""),
    description: String(game.description ?? ""), howToPlay: game.how_to_play ?? [],
    cover: String(game.cover ?? ""), coverAlt: String(game.cover_alt ?? ""), previewAlt: String(game.preview_alt ?? ""),
    controls: game.controls ?? { desktop: [], touch: [] }, memberAccess: Boolean(game.member_access),
    rotationEligible: Boolean(game.rotation_eligible), maintenance: Boolean(game.maintenance),
    isNew: Boolean(game.is_new), unsupportedNote: game.unsupported_note ?? null,
  };
}

export function publicPlan(plan: PlanRecord) {
  return {
    id: String(plan.id), name: String(plan.name), monthlyPaise: Number(plan.monthly_paise),
    annualPaise: Number(plan.annual_paise), continueCap: Number(plan.continue_cap), benefits: plan.benefits ?? [],
  };
}

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
  return cached("catalog:published", CATALOG_VERSION_KEY, async () => {
    const rows = await sql<GameRecord[]>`SELECT * FROM games WHERE published ORDER BY title`;
    return rows.map(publicGame);
  });
}

export async function publishedGameBySlug(slug: string) {
  const rows = await sql<GameRecord[]>`SELECT * FROM games WHERE slug = ${slug} AND published LIMIT 1`;
  return rows[0] ? publicGame(rows[0]) : null;
}

export function listPublicPlans() {
  return cached("plans:public", PLAN_VERSION_KEY, async () => {
    const rows = await sql<PlanRecord[]>`
      SELECT id, name, monthly_paise, annual_paise, continue_cap, benefits FROM plans ORDER BY monthly_paise
    `;
    return rows.map(publicPlan);
  });
}

export async function invalidateCatalog(): Promise<void> {
  await redis.incr(CATALOG_VERSION_KEY).catch(() => undefined);
}

export async function invalidatePlans(): Promise<void> {
  await redis.incr(PLAN_VERSION_KEY).catch(() => undefined);
}
