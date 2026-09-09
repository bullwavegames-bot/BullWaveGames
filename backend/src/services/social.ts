import { randomBytes } from "node:crypto";
import { sql } from "../db.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { hitRateLimit } from "../lib/rate-limit.js";
import { gameBySlug } from "./play.js";

function pair(a: string, b: string) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export async function requestFriend(fromId: string, email: string, ip?: string) {
  await hitRateLimit(`rl:invite:${fromId}`, 10, 3600);
  await hitRateLimit(`rl:invite-ip:${ip ?? "x"}`, 30, 3600);
  const target = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${email.trim().toLowerCase()} AND deleted_at IS NULL
  `;
  if (!target[0]) throw notFound("No player with that email.");
  if (target[0].id === fromId) throw badRequest("You cannot add yourself.");
  const { low, high } = pair(fromId, target[0].id);
  await sql`
    INSERT INTO friendships ${sql({
      user_low: low,
      user_high: high,
      initiated_by: fromId,
      status: "pending",
    })}
    ON CONFLICT (user_low, user_high) DO UPDATE SET
      status = 'pending',
      initiated_by = EXCLUDED.initiated_by,
      updated_at = now()
    WHERE friendships.status IN ('declined', 'pending')
  `;
  return { toUserId: target[0].id, status: "pending" };
}

export async function respondFriend(userId: string, otherId: string, accept: boolean) {
  const { low, high } = pair(userId, otherId);
  const rows = await sql<{ initiated_by: string; status: string }[]>`
    SELECT initiated_by, status FROM friendships WHERE user_low = ${low} AND user_high = ${high}
  `;
  if (!rows[0] || rows[0].status !== "pending") throw notFound("No pending request.");
  if (rows[0].initiated_by === userId) throw forbidden("The other player needs to respond.");
  const status = accept ? "accepted" : "declined";
  await sql`
    UPDATE friendships SET status = ${status}, updated_at = now()
    WHERE user_low = ${low} AND user_high = ${high}
  `;
  return { status };
}

export async function listFriends(userId: string) {
  return sql`
    SELECT
      CASE WHEN f.user_low = ${userId} THEN f.user_high ELSE f.user_low END AS id,
      u.display_name,
      u.email,
      f.status,
      f.initiated_by,
      f.updated_at
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_low = ${userId} THEN f.user_high ELSE f.user_low END
    WHERE (f.user_low = ${userId} OR f.user_high = ${userId})
      AND f.status IN ('pending', 'accepted')
    ORDER BY f.updated_at DESC
  `;
}

export async function createChallengeLink(userId: string, slug: string, ip?: string) {
  await hitRateLimit(`rl:share:${userId}`, 20, 3600);
  await hitRateLimit(`rl:share-ip:${ip ?? "x"}`, 40, 3600);
  const game = await gameBySlug(slug);
  if (!game) throw notFound("Game not found.");
  const best = await sql<{ score: string; score_event_id: string }[]>`
    SELECT score::text, score_event_id FROM personal_bests
    WHERE user_id = ${userId} AND game_id = ${game.id}
  `;
  if (!best[0]) throw badRequest("Play this game first — challenge links use an accepted personal best.");
  const code = randomBytes(6).toString("hex");
  await sql`
    INSERT INTO challenge_links ${sql({
      code,
      from_user_id: userId,
      game_id: game.id,
      score: Number(best[0].score),
      score_event_id: best[0].score_event_id,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })}
  `;
  return { code, slug, score: Number(best[0].score), url: `/challenges?c=${code}` };
}

export async function resolveChallengeLink(code: string) {
  const rows = await sql<
    {
      code: string;
      score: string;
      expires_at: Date;
      slug: string;
      display_name: string;
      from_user_id: string;
    }[]
  >`
    SELECT c.code, c.score::text, c.expires_at, g.slug, u.display_name, c.from_user_id
    FROM challenge_links c
    JOIN games g ON g.id = c.game_id
    JOIN users u ON u.id = c.from_user_id
    WHERE c.code = ${code}
  `;
  const row = rows[0];
  if (!row || row.expires_at.getTime() < Date.now()) throw notFound("This challenge link has expired.");
  return {
    code: row.code,
    slug: row.slug,
    score: Number(row.score),
    displayName: row.display_name,
    fromUserId: row.from_user_id,
  };
}
