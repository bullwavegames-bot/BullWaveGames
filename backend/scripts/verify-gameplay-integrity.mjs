import assert from "node:assert/strict";

const { sql } = await import("../dist/backend/src/db.js");
const { redis } = await import("../dist/backend/src/redis.js");
const { startPlay, submitScore, ensureGuest, todaysFreeSlugs } = await import("../dist/backend/src/services/play.js");
const { drainOutbox, friendsBoard, globalBoard, publishBest } = await import("../dist/backend/src/services/leaderboard.js");

await sql`DELETE FROM users WHERE email::text LIKE 'phase5-%@example.com'`;
await sql`DELETE FROM games WHERE slug LIKE 'phase5-%'`;
const marker = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const slug = `phase5-${marker}`;
const emails = ["fast", "slow"].map((name) => `phase5-${name}-${marker}@example.com`);
const users = await sql`
  INSERT INTO users (email, billing_email, password_hash, display_name)
  VALUES (${emails[0]}, ${emails[0]}, 'test-hash', 'Fast Player'),
         (${emails[1]}, ${emails[1]}, 'test-hash', 'Slow Player')
  RETURNING id
`;
const fastId = users[0].id;
const slowId = users[1].id;
let guestOne;
let guestTwo;
const game = (await sql`
  INSERT INTO games (slug, title, genre, session_minutes, published, rotation_eligible, member_access)
  VALUES (${slug}, 'Phase 5 Timing', 'Test', 5, true, false, true)
  RETURNING id
`)[0];
await sql`
  INSERT INTO game_score_rules (game_id, score_direction, min_score, max_score, min_duration_ms, max_duration_ms)
  VALUES (${game.id}, 'lower_better', 0, 10000, 1, 300000)
`;
await sql`
  INSERT INTO memberships (user_id, plan_id, status, billing_interval, source, access_start, access_end)
  VALUES (${fastId}, 'wave', 'active_until', 'monthly', 'payment', now(), now() + interval '1 day'),
         (${slowId}, 'wave', 'active_until', 'monthly', 'payment', now(), now() + interval '1 day')
`;

async function play(userId, score) {
  const session = await startPlay({ slug, userId });
  return submitScore({ slug, token: session.token, score, stars: 0, durationMs: 100, userId });
}

try {
  const owned = await startPlay({ slug, userId: fastId });
  await assert.rejects(
    submitScore({ slug, token: owned.token, score: 90, stars: 0, durationMs: 100, userId: slowId }),
    (error) => error?.statusCode === 403,
  );
  const validAfterMismatch = await submitScore({ slug, token: owned.token, score: 90, stars: 0, durationMs: 100, userId: fastId });
  assert.equal(validAfterMismatch.accepted, true);

  const impossibleDuration = await startPlay({ slug, userId: fastId });
  const durationResult = await submitScore({ slug, token: impossibleDuration.token, score: 90, stars: 0, durationMs: 10_000, userId: fastId });
  assert.equal(durationResult.accepted, false);
  assert.equal(durationResult.reason, "duration_ahead_of_session");

  const concurrent = await startPlay({ slug, userId: slowId });
  const results = await Promise.allSettled([
    submitScore({ slug, token: concurrent.token, score: 80, stars: 0, durationMs: 100, userId: slowId }),
    submitScore({ slug, token: concurrent.token, score: 80, stars: 0, durationMs: 100, userId: slowId }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && result.reason?.code === "REPLAY").length, 1);
  assert.equal((await sql`SELECT count(*)::int AS count FROM score_events WHERE play_session_id = ${concurrent.playSessionId}`)[0].count, 1);

  guestOne = await ensureGuest();
  guestTwo = await ensureGuest();
  const freeSlug = (await todaysFreeSlugs())[0];
  assert.ok(freeSlug);
  const guestSession = await startPlay({ slug: freeSlug, guestId: guestOne });
  await assert.rejects(
    submitScore({ slug: freeSlug, token: guestSession.token, score: 0, stars: 0, durationMs: 1000, guestId: guestTwo }),
    (error) => error?.statusCode === 403,
  );

  await play(fastId, 30);
  await play(slowId, 40);
  const board = await globalBoard(slug, 1, 10, fastId);
  assert.equal(board.entries[0].userId, fastId, "lower-is-better games must rank the smallest score first");
  assert.equal(board.entries[0].score, 30);
  const originalZrange = redis.zrange.bind(redis);
  redis.zrange = async () => { throw new Error("simulated Redis outage"); };
  try {
    const fallbackBoard = await globalBoard(slug, 1, 10, fastId);
    assert.equal(fallbackBoard.entries[0].userId, fastId, "PostgreSQL fallback must preserve score direction");
  } finally {
    redis.zrange = originalZrange;
  }

  await redis.zadd(`lb:${slug}:global`, 999, fastId);
  await publishBest(slug, fastId, 999);
  assert.equal(Number(await redis.zscore(`lb:${slug}:global`, fastId)), 30, "delayed publication must restore the authoritative best");

  const [low, high] = fastId < slowId ? [fastId, slowId] : [slowId, fastId];
  await sql`
    INSERT INTO friendships (user_low, user_high, initiated_by, status)
    VALUES (${low}, ${high}, ${fastId}, 'accepted')
  `;
  const pageOne = await friendsBoard(slug, fastId, 1, 1);
  const pageTwoSizes = await friendsBoard(slug, fastId, 1, 2);
  assert.equal(pageOne.entries.length, 1);
  assert.equal(pageTwoSizes.entries.length, 2, "friend cache keys must include page size");
  await play(slowId, 20);
  const refreshedFriends = await friendsBoard(slug, fastId, 1, 2);
  assert.equal(refreshedFriends.entries[0].userId, slowId, "a new friend score must invalidate cached friend boards");

  await redis.del(`lb:${slug}:global`);
  const pending = await sql`
    INSERT INTO leaderboard_outbox (game_id, user_id, score, score_event_id, created_at)
    SELECT game_id, user_id, score, score_event_id, '1970-01-01'::timestamptz FROM personal_bests
    WHERE game_id = ${game.id} AND user_id = ${fastId}
    RETURNING id
  `;
  assert.equal(await drainOutbox(1), 1);
  assert.equal(Number(await redis.zscore(`lb:${slug}:global`, fastId)), 30);
  const delivery = (await sql`SELECT published_at, attempt_count, publishing_at, last_error FROM leaderboard_outbox WHERE id = ${pending[0].id}`)[0];
  assert.ok(delivery.published_at);
  assert.equal(delivery.attempt_count, 1);
  assert.equal(delivery.publishing_at, null);
  assert.equal(delivery.last_error, null);

  console.log("score ownership, concurrent replay, directional ranking, cache pagination, monotonic publish, and outbox checks passed");
} finally {
  await redis.del(`lb:${slug}:global`, `lb:friends-version:${fastId}`, `lb:friends-version:${slowId}`).catch(() => undefined);
  if (guestOne && guestTwo) await sql`DELETE FROM guests WHERE id IN (${guestOne}, ${guestTwo})`;
  await sql`DELETE FROM users WHERE email IN ${sql(emails)}`;
  await sql`DELETE FROM games WHERE id = ${game.id}`;
  await sql.end();
  redis.disconnect();
}
