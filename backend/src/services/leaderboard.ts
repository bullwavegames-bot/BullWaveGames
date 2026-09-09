import { redis } from "../redis.js";
import { sql } from "../db.js";
import { logger } from "../logger.js";

function key(slug: string): string {
  return `lb:${slug}:global`;
}

export async function publishBest(slug: string, userId: string, score: number): Promise<void> {
  await redis.zadd(key(slug), score, userId);
  await sql`
    UPDATE leaderboard_outbox o
    SET published_at = now()
    FROM games g
    WHERE o.published_at IS NULL AND o.game_id = g.id AND g.slug = ${slug} AND o.user_id = ${userId}
  `;
}

export async function drainOutbox(): Promise<number> {
  const rows = await sql<{ id: string; slug: string; user_id: string; score: string }[]>`
    SELECT o.id, g.slug, o.user_id, o.score::text
    FROM leaderboard_outbox o
    JOIN games g ON g.id = o.game_id
    WHERE o.published_at IS NULL
    ORDER BY o.created_at
    LIMIT 100
  `;
  for (const row of rows) {
    try {
      await redis.zadd(key(row.slug), Number(row.score), row.user_id);
      await sql`UPDATE leaderboard_outbox SET published_at = now() WHERE id = ${row.id}`;
    } catch (error) {
      logger.warn({ err: error, id: row.id }, "outbox publish failed");
    }
  }
  return rows.length;
}

export async function rebuildLeaderboards(): Promise<void> {
  const games = await sql<{ slug: string; id: string }[]>`SELECT id, slug FROM games`;
  for (const game of games) {
    const bests = await sql<{ user_id: string; score: string }[]>`
      SELECT user_id, score::text FROM personal_bests WHERE game_id = ${game.id}
    `;
    const pipeline = redis.multi();
    pipeline.del(key(game.slug));
    for (const row of bests) pipeline.zadd(key(game.slug), Number(row.score), row.user_id);
    await pipeline.exec();
  }
}

export async function globalBoard(slug: string, page = 1, pageSize = 25, you?: string | null) {
  const start = (page - 1) * pageSize;
  const stop = start + pageSize - 1;
  let ids = await redis.zrevrange(key(slug), start, stop, "WITHSCORES");
  if (!ids.length) {
    const game = await sql<{ id: string }[]>`SELECT id FROM games WHERE slug = ${slug}`;
    if (game[0]) {
      const rows = await sql<{ user_id: string; score: string }[]>`
        SELECT user_id, score::text FROM personal_bests WHERE game_id = ${game[0].id}
        ORDER BY score DESC OFFSET ${start} LIMIT ${pageSize}
      `;
      ids = rows.flatMap((row) => [row.user_id, row.score]);
    }
  }
  const entries = [];
  for (let i = 0; i < ids.length; i += 2) {
    const userId = ids[i];
    const score = Number(ids[i + 1]);
    const user = await sql<{ display_name: string }[]>`SELECT display_name FROM users WHERE id = ${userId}`;
    entries.push({
      rank: start + i / 2 + 1,
      userId,
      displayName: user[0]?.display_name ?? "Player",
      score,
      isYou: you === userId,
    });
  }
  return { page, pageSize, entries };
}

export async function friendsBoard(slug: string, userId: string, page = 1, pageSize = 25) {
  const cacheKey = `lb:${slug}:friends:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as { page: number; pageSize: number; entries: unknown[] };
  const game = await sql<{ id: string }[]>`SELECT id FROM games WHERE slug = ${slug}`;
  if (!game[0]) return { page, pageSize, entries: [] };
  const friends = await sql<{ id: string }[]>`
    SELECT CASE WHEN user_low = ${userId} THEN user_high ELSE user_low END AS id
    FROM friendships
    WHERE status = 'accepted' AND (user_low = ${userId} OR user_high = ${userId})
  `;
  const ids = [userId, ...friends.map((row) => row.id)];
  const rows = await sql<{ user_id: string; display_name: string; score: string }[]>`
    SELECT p.user_id, u.display_name, p.score::text
    FROM personal_bests p
    JOIN users u ON u.id = p.user_id
    WHERE p.game_id = ${game[0].id} AND p.user_id IN ${sql(ids)}
    ORDER BY p.score DESC
    OFFSET ${(page - 1) * pageSize}
    LIMIT ${pageSize}
  `;
  const payload = {
    page,
    pageSize,
    entries: rows.map((row, index) => ({
      rank: (page - 1) * pageSize + index + 1,
      userId: row.user_id,
      displayName: row.display_name,
      score: Number(row.score),
      isYou: row.user_id === userId,
    })),
  };
  await redis.set(cacheKey, JSON.stringify(payload), "EX", 120);
  return payload;
}
