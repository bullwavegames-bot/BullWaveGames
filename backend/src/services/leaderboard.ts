import { redis } from "../redis.js";
import { sql } from "../db.js";
import { logger } from "../logger.js";

type Direction = "higher_better" | "lower_better";
type Game = { id: string; slug: string; score_direction: Direction };

function key(slug: string): string {
  return `lb:${slug}:global`;
}

async function gameForSlug(slug: string): Promise<Game | null> {
  const rows = await sql<Game[]>`
    SELECT g.id, g.slug, r.score_direction
    FROM games g JOIN game_score_rules r ON r.game_id = g.id
    WHERE g.slug = ${slug}
  `;
  return rows[0] ?? null;
}

async function monotonicZadd(slug: string, userId: string, score: number, direction: Direction): Promise<void> {
  const script = `
    local current = redis.call('ZSCORE', KEYS[1], ARGV[1])
    if (not current) or (ARGV[3] == 'higher_better' and tonumber(ARGV[2]) > tonumber(current))
      or (ARGV[3] == 'lower_better' and tonumber(ARGV[2]) < tonumber(current)) then
      redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
      return 1
    end
    return 0
  `;
  await redis.eval(script, 1, key(slug), userId, String(score), direction);
}

export async function publishBest(slug: string, userId: string, _submittedScore?: number): Promise<void> {
  const rows = await sql<{ score: string; score_direction: Direction }[]>`
    SELECT p.score::text, r.score_direction
    FROM personal_bests p
    JOIN games g ON g.id = p.game_id
    JOIN game_score_rules r ON r.game_id = p.game_id
    WHERE g.slug = ${slug} AND p.user_id = ${userId}
  `;
  if (!rows[0]) return;
  await monotonicZadd(slug, userId, Number(rows[0].score), rows[0].score_direction);
  await sql`
    UPDATE leaderboard_outbox o SET published_at = now(), publishing_at = NULL, last_error = NULL
    FROM games g
    WHERE o.published_at IS NULL AND o.game_id = g.id AND g.slug = ${slug} AND o.user_id = ${userId}
  `;
  await invalidateFriendsBoards(userId);
}

export async function drainOutbox(limit = 100): Promise<number> {
  const rows = await sql.begin(async (tx) => {
    const claimed = await tx<{ id: string; slug: string; user_id: string; attempt_count: number }[]>`
      SELECT o.id, g.slug, o.user_id, o.attempt_count
      FROM leaderboard_outbox o JOIN games g ON g.id = o.game_id
      WHERE o.published_at IS NULL AND o.next_attempt_at <= now()
        AND (o.publishing_at IS NULL OR o.publishing_at < now() - interval '2 minutes')
      ORDER BY o.created_at
      FOR UPDATE OF o SKIP LOCKED
      LIMIT ${limit}
    `;
    for (const row of claimed) {
      await tx`
        UPDATE leaderboard_outbox SET publishing_at = now(), attempt_count = attempt_count + 1
        WHERE id = ${row.id}
      `;
    }
    return claimed;
  });
  for (const row of rows) {
    try {
      await publishBest(row.slug, row.user_id);
    } catch (error) {
      const delaySeconds = Math.min(300, 2 ** Math.min(row.attempt_count + 1, 8));
      await sql`
        UPDATE leaderboard_outbox SET publishing_at = NULL,
          next_attempt_at = now() + (${delaySeconds} * interval '1 second'),
          last_error = ${String(error instanceof Error ? error.message : error).slice(0, 500)}
        WHERE id = ${row.id}
      `;
      logger.warn({ err: error, id: row.id }, "outbox publish failed");
    }
  }
  return rows.length;
}

export async function rebuildLeaderboards(): Promise<void> {
  const games = await sql<Game[]>`
    SELECT g.id, g.slug, r.score_direction FROM games g JOIN game_score_rules r ON r.game_id = g.id
  `;
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

async function sqlBoard(game: Game, start: number, pageSize: number) {
  return game.score_direction === "lower_better"
    ? sql<{ user_id: string; display_name: string; score: string }[]>`
        SELECT p.user_id, u.display_name, p.score::text
        FROM personal_bests p JOIN users u ON u.id = p.user_id
        WHERE p.game_id = ${game.id}
        ORDER BY p.score ASC, p.achieved_at ASC, p.user_id ASC OFFSET ${start} LIMIT ${pageSize}
      `
    : sql<{ user_id: string; display_name: string; score: string }[]>`
        SELECT p.user_id, u.display_name, p.score::text
        FROM personal_bests p JOIN users u ON u.id = p.user_id
        WHERE p.game_id = ${game.id}
        ORDER BY p.score DESC, p.achieved_at ASC, p.user_id ASC OFFSET ${start} LIMIT ${pageSize}
      `;
}

export async function globalBoard(slug: string, page = 1, pageSize = 25, you?: string | null) {
  const game = await gameForSlug(slug);
  if (!game) return { page, pageSize, entries: [] };
  const start = (page - 1) * pageSize;
  const stop = start + pageSize - 1;
  try {
    const ids = game.score_direction === "lower_better"
      ? await redis.zrange(key(slug), String(start), String(stop), "WITHSCORES")
      : await redis.zrevrange(key(slug), start, stop, "WITHSCORES");
    if (ids.length) {
      const userIds = ids.filter((_, index) => index % 2 === 0);
      const users = await sql<{ id: string; display_name: string }[]>`
        SELECT id, display_name FROM users WHERE id IN ${sql(userIds)}
      `;
      const names = new Map(users.map((row) => [row.id, row.display_name]));
      return {
        page,
        pageSize,
        entries: userIds.map((userId, index) => ({
          rank: start + index + 1,
          userId,
          displayName: names.get(userId) ?? "Player",
          score: Number(ids[index * 2 + 1]),
          isYou: you === userId,
        })),
      };
    }
  } catch (error) {
    logger.warn({ err: error, slug }, "leaderboard cache unavailable; using PostgreSQL");
  }
  const rows = await sqlBoard(game, start, pageSize);
  return {
    page,
    pageSize,
    entries: rows.map((row, index) => ({
      rank: start + index + 1,
      userId: row.user_id,
      displayName: row.display_name,
      score: Number(row.score),
      isYou: you === row.user_id,
    })),
  };
}

export async function invalidateFriendsBoards(userId: string): Promise<void> {
  try {
    const friends = await sql<{ id: string }[]>`
      SELECT CASE WHEN user_low = ${userId} THEN user_high ELSE user_low END AS id
      FROM friendships
      WHERE status = 'accepted' AND (user_low = ${userId} OR user_high = ${userId})
    `;
    const pipeline = redis.multi();
    for (const id of [userId, ...friends.map((row) => row.id)]) pipeline.incr(`lb:friends-version:${id}`);
    await pipeline.exec();
  } catch (error) {
    logger.warn({ err: error, userId }, "friend leaderboard cache invalidation failed");
  }
}

export async function friendsBoard(slug: string, userId: string, page = 1, pageSize = 25) {
  let cacheKey: string | null = null;
  try {
    const version = (await redis.get(`lb:friends-version:${userId}`)) ?? "0";
    cacheKey = `lb:${slug}:friends:${userId}:${page}:${pageSize}:v${version}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as { page: number; pageSize: number; entries: unknown[] };
  } catch {
    cacheKey = null;
  }
  const game = await gameForSlug(slug);
  if (!game) return { page, pageSize, entries: [] };
  const friends = await sql<{ id: string }[]>`
    SELECT CASE WHEN user_low = ${userId} THEN user_high ELSE user_low END AS id
    FROM friendships
    WHERE status = 'accepted' AND (user_low = ${userId} OR user_high = ${userId})
  `;
  const ids = [userId, ...friends.map((row) => row.id)];
  const offset = (page - 1) * pageSize;
  const rows = game.score_direction === "lower_better"
    ? await sql<{ user_id: string; display_name: string; score: string }[]>`
        SELECT p.user_id, u.display_name, p.score::text FROM personal_bests p JOIN users u ON u.id = p.user_id
        WHERE p.game_id = ${game.id} AND p.user_id IN ${sql(ids)}
        ORDER BY p.score ASC, p.achieved_at ASC, p.user_id ASC OFFSET ${offset} LIMIT ${pageSize}
      `
    : await sql<{ user_id: string; display_name: string; score: string }[]>`
        SELECT p.user_id, u.display_name, p.score::text FROM personal_bests p JOIN users u ON u.id = p.user_id
        WHERE p.game_id = ${game.id} AND p.user_id IN ${sql(ids)}
        ORDER BY p.score DESC, p.achieved_at ASC, p.user_id ASC OFFSET ${offset} LIMIT ${pageSize}
      `;
  const payload = {
    page,
    pageSize,
    entries: rows.map((row, index) => ({
      rank: offset + index + 1,
      userId: row.user_id,
      displayName: row.display_name,
      score: Number(row.score),
      isYou: row.user_id === userId,
    })),
  };
  if (cacheKey) await redis.set(cacheKey, JSON.stringify(payload), "EX", 120).catch(() => undefined);
  return payload;
}
