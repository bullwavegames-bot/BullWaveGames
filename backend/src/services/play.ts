import { config } from "../config.js";
import { hmacHex, randomToken, sha256 } from "../lib/crypto.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { kolkataDateKey } from "../lib/kolkata.js";
import { sql } from "../db.js";
import { getMembership } from "./membership.js";
import { isMemberNow } from "../types.js";
import { evaluateAchievements } from "./achievements.js";
import { publishBest } from "./leaderboard.js";
import type postgres from "postgres";

type GameRow = {
  id: string;
  slug: string;
  session_minutes: number;
  published: boolean;
  maintenance: boolean;
  rotation_eligible: boolean;
  member_access: boolean;
};

export async function gameBySlug(slug: string): Promise<GameRow | null> {
  const rows = await sql<GameRow[]>`
    SELECT id, slug, session_minutes, published, maintenance, rotation_eligible, member_access
    FROM games WHERE slug = ${slug} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function todaysFreeSlugs(now = new Date()): Promise<string[]> {
  const published = await sql<{ slug: string }[]>`
    SELECT slug FROM games
    WHERE published AND rotation_eligible AND NOT maintenance
    ORDER BY slug
  `;
  if (!published.length) return [];
  const key = kolkataDateKey(now);
  const dayNumber = Math.floor(new Date(`${key}T00:00:00+05:30`).getTime() / 86400000);
  const start = ((dayNumber % published.length) + published.length) % published.length;
  return [0, 1, 2].map((offset) => published[(start + offset) % published.length].slug);
}

async function allowanceUsed(kind: "user" | "guest", id: string, dateKey: string): Promise<number> {
  const rows = await sql<{ used: number }[]>`
    SELECT used FROM session_allowance
    WHERE subject_kind = ${kind} AND subject_id = ${id} AND date_key = ${dateKey}
  `;
  return rows[0]?.used ?? 0;
}

async function bumpAllowance(kind: "user" | "guest", id: string, dateKey: string): Promise<void> {
  await sql`
    INSERT INTO session_allowance ${sql({ subject_kind: kind, subject_id: id, date_key: dateKey, used: 1 })}
    ON CONFLICT (subject_kind, subject_id, date_key) DO UPDATE SET used = session_allowance.used + 1
  `;
}

export async function startPlay(input: {
  slug: string;
  userId?: string | null;
  guestId?: string | null;
  ip?: string;
}) {
  const game = await gameBySlug(input.slug);
  if (!game || !game.published) throw notFound("Game not found.");
  if (game.maintenance) throw forbidden("This game is unavailable.");

  const membership = input.userId ? await getMembership(input.userId) : null;
  const member = isMemberNow(membership);
  const dateKey = kolkataDateKey();
  const free = (await todaysFreeSlugs()).includes(game.slug);

  if (!member) {
    if (!free) throw forbidden("Unlock with membership.", "MEMBERSHIP_REQUIRED");
    const kind = input.userId ? "user" : "guest";
    const subject = input.userId ?? input.guestId;
    if (!subject) throw badRequest("Missing guest session.");
    const used = await allowanceUsed(kind, subject, dateKey);
    if (used >= config.freeSessionAllowance) throw forbidden("Allowance used.", "ALLOWANCE_USED");
    await bumpAllowance(kind, subject, dateKey);
  }

  const raw = randomToken(32);
  const token = `${hmacHex(config.playSessionSecret, raw)}.${raw}`;
  const expires = new Date(Date.now() + (game.session_minutes * 60 * 1000 + 2 * 60 * 1000));
  const rows = await sql<{ id: string }[]>`
    INSERT INTO play_sessions ${sql({
      user_id: input.userId ?? null,
      guest_id: input.userId ? null : input.guestId ?? null,
      game_id: game.id,
      token_hash: sha256(token),
      expires_at: expires,
      ip: input.ip ?? null,
    })}
    RETURNING id
  `;
  return { playSessionId: rows[0].id, token, expiresAt: expires.toISOString(), slug: game.slug };
}

function boundsOk(
  rules: {
    min_score: number;
    max_score: number;
    min_duration_ms: number;
    max_duration_ms: number;
    max_score_per_second: string | number | null;
    score_direction: string;
  },
  score: number,
  durationMs: number,
): string | null {
  if (score < rules.min_score || score > rules.max_score) return "bounds";
  if (durationMs < rules.min_duration_ms || durationMs > rules.max_duration_ms) return "bounds";
  if (rules.max_score_per_second != null) {
    const cap = Number(rules.max_score_per_second) * Math.max(durationMs / 1000, 1);
    if (score > cap) return "bounds";
  }
  return null;
}

export async function submitScore(input: {
  slug: string;
  token: string;
  score: number;
  stars: number;
  metric?: string;
  durationMs: number;
  userId?: string | null;
  guestId?: string | null;
}) {
  const game = await gameBySlug(input.slug);
  if (!game) throw notFound("Game not found.");
  const sessions = await sql<
    {
      id: string;
      user_id: string | null;
      guest_id: string | null;
      game_id: string;
      status: string;
      expires_at: Date;
      started_at: Date;
    }[]
  >`
    SELECT id, user_id, guest_id, game_id, status, expires_at, started_at
    FROM play_sessions WHERE token_hash = ${sha256(input.token)} LIMIT 1
  `;
  const session = sessions[0];
  if (!session) throw badRequest("Play session is missing or invalid.", "NO_SESSION");
  if (session.game_id !== game.id) throw badRequest("Session does not match this game.", "NO_SESSION");
  if ((session.user_id ?? null) !== (input.userId ?? null)) throw forbidden("Session belongs to another account.");
  if (!session.user_id && (session.guest_id ?? null) !== (input.guestId ?? null)) throw forbidden("Session belongs to another guest.");
  if (session.status === "submitted") throw conflict("This session already has a score.", "REPLAY");
  if (session.status !== "open" || session.expires_at.getTime() < Date.now()) {
    const event = await sql.begin(async (tx) => {
      const claimed = await tx<{ id: string }[]>`
        UPDATE play_sessions SET status = 'expired', submitted_at = now()
        WHERE id = ${session.id} AND status = 'open' RETURNING id
      `;
      if (!claimed[0]) throw conflict("This session already has a score.", "REPLAY");
      return insertEvent(tx, session, game.id, input, false, "expired_session");
    });
    return { accepted: false, reason: "expired_session", eventId: event.id };
  }

  const rules = (
    await sql<
      {
        min_score: string;
        max_score: string;
        min_duration_ms: number;
        max_duration_ms: number;
        max_score_per_second: string | null;
        score_direction: string;
      }[]
    >`SELECT min_score::text, max_score::text, min_duration_ms, max_duration_ms, max_score_per_second::text, score_direction FROM game_score_rules WHERE game_id = ${game.id}`
  )[0];
  if (!rules) throw badRequest("Scoring rules missing for this game.");
  const reject = boundsOk(
    {
      ...rules,
      min_score: Number(rules.min_score),
      max_score: Number(rules.max_score),
    },
    input.score,
    input.durationMs,
  ) ?? (input.durationMs > Date.now() - session.started_at.getTime() + 5_000 ? "duration_ahead_of_session" : null);
  if (reject) {
    const event = await sql.begin(async (tx) => {
      const claimed = await tx<{ id: string }[]>`
        UPDATE play_sessions SET status = 'rejected', submitted_at = now()
        WHERE id = ${session.id} AND status = 'open' RETURNING id
      `;
      if (!claimed[0]) throw conflict("This session already has a score.", "REPLAY");
      return insertEvent(tx, session, game.id, input, false, reject);
    });
    return { accepted: false, reason: reject, eventId: event.id };
  }

  const event = await sql.begin(async (tx) => {
    const claimed = await tx<{ id: string }[]>`
      UPDATE play_sessions SET status = 'submitted', submitted_at = now()
      WHERE id = ${session.id} AND status = 'open' AND expires_at >= now()
      RETURNING id
    `;
    if (!claimed[0]) throw conflict("This session already has a score.", "REPLAY");
    const created = await tx<{ id: string }[]>`
      INSERT INTO score_events ${tx({
        play_session_id: session.id,
        user_id: session.user_id,
        guest_id: session.guest_id,
        game_id: game.id,
        score: input.score,
        stars: input.stars,
        metric: input.metric ?? null,
        duration_ms: input.durationMs,
        accepted: true,
        reject_reason: null,
      })}
      RETURNING id
    `;
    const eventId = created[0].id;
    if (session.user_id) {
      const direction = rules.score_direction;
      const better =
        direction === "lower_better"
          ? tx`
            INSERT INTO personal_bests ${tx({
              user_id: session.user_id,
              game_id: game.id,
              score: input.score,
              stars: input.stars,
              metric: input.metric ?? null,
              achieved_at: new Date(),
              score_event_id: eventId,
            })}
            ON CONFLICT (user_id, game_id) DO UPDATE SET
              score = EXCLUDED.score,
              stars = EXCLUDED.stars,
              metric = EXCLUDED.metric,
              achieved_at = EXCLUDED.achieved_at,
              score_event_id = EXCLUDED.score_event_id
            WHERE personal_bests.score > EXCLUDED.score
            RETURNING score
          `
          : tx`
            INSERT INTO personal_bests ${tx({
              user_id: session.user_id,
              game_id: game.id,
              score: input.score,
              stars: input.stars,
              metric: input.metric ?? null,
              achieved_at: new Date(),
              score_event_id: eventId,
            })}
            ON CONFLICT (user_id, game_id) DO UPDATE SET
              score = EXCLUDED.score,
              stars = EXCLUDED.stars,
              metric = EXCLUDED.metric,
              achieved_at = EXCLUDED.achieved_at,
              score_event_id = EXCLUDED.score_event_id
            WHERE personal_bests.score < EXCLUDED.score
            RETURNING score
          `;
      const pb = await better;
      if (pb[0]) {
        await tx`
          INSERT INTO leaderboard_outbox ${tx({
            game_id: game.id,
            user_id: session.user_id,
            score: input.score,
            score_event_id: eventId,
          })}
        `;
      }
    }
    return { id: eventId };
  });

  if (session.user_id) {
    await publishBest(game.slug, session.user_id, input.score).catch(() => undefined);
    await evaluateAchievements(session.user_id, game.slug, input.score).catch(() => undefined);
    const challenge = await sql<{ id: string }[]>`
      SELECT id FROM daily_challenges WHERE date_key = ${kolkataDateKey()} AND game_id = ${game.id} LIMIT 1
    `;
    if (challenge[0]) {
      await sql`
        INSERT INTO daily_challenge_completions ${sql({
          user_id: session.user_id,
          challenge_id: challenge[0].id,
          score: input.score,
          play_session_id: session.id,
        })}
        ON CONFLICT DO NOTHING
      `;
    }
  }
  return { accepted: true, eventId: event.id, score: input.score };
}

async function insertEvent(
  tx: postgres.TransactionSql,
  session: { id: string; user_id: string | null; guest_id: string | null },
  gameId: string,
  input: { score: number; stars: number; metric?: string; durationMs: number },
  accepted: boolean,
  reason: string,
) {
  const rows = await tx<{ id: string }[]>`
    INSERT INTO score_events ${tx({
      play_session_id: session.id,
      user_id: session.user_id,
      guest_id: session.guest_id,
      game_id: gameId,
      score: input.score,
      stars: input.stars,
      metric: input.metric ?? null,
      duration_ms: input.durationMs,
      accepted,
      reject_reason: reason,
    })}
    ON CONFLICT (play_session_id) DO UPDATE SET reject_reason = EXCLUDED.reject_reason
    RETURNING id
  `;
  return rows[0];
}

export async function saveProgress(userId: string, slug: string, payload: unknown, label: string) {
  const game = await gameBySlug(slug);
  if (!game) throw notFound("Game not found.");
  await sql`
    INSERT INTO game_saves ${sql({
      user_id: userId,
      game_id: game.id,
      payload: sql.json((payload ?? {}) as never),
      label,
    })}
    ON CONFLICT (user_id, game_id) DO UPDATE SET
      payload = EXCLUDED.payload,
      label = EXCLUDED.label,
      updated_at = now()
  `;
}

export async function getProgress(userId: string, slug?: string) {
  if (slug) {
    const game = await gameBySlug(slug);
    if (!game) return [];
    return sql`
      SELECT g.slug, s.label, s.payload, s.updated_at
      FROM game_saves s JOIN games g ON g.id = s.game_id
      WHERE s.user_id = ${userId} AND s.game_id = ${game.id}
    `;
  }
  return sql`
    SELECT g.slug, s.label, s.payload, s.updated_at
    FROM game_saves s JOIN games g ON g.id = s.game_id
    WHERE s.user_id = ${userId}
  `;
}

export async function getBests(userId: string) {
  return sql`
    SELECT g.slug, p.score, p.stars, p.metric, p.achieved_at
    FROM personal_bests p JOIN games g ON g.id = p.game_id
    WHERE p.user_id = ${userId}
    ORDER BY p.achieved_at DESC
  `;
}

export async function ensureGuest(existingId?: string | null): Promise<string> {
  if (existingId) {
    const rows = await sql<{ id: string }[]>`SELECT id FROM guests WHERE id = ${existingId}`;
    if (rows[0]) return rows[0].id;
  }
  const rows = await sql<{ id: string }[]>`INSERT INTO guests DEFAULT VALUES RETURNING id`;
  return rows[0].id;
}

export async function allowanceRemaining(userId?: string | null, guestId?: string | null): Promise<number> {
  if (userId) {
    const membership = await getMembership(userId);
    if (isMemberNow(membership)) return config.freeSessionAllowance;
  }
  const kind = userId ? "user" : "guest";
  const id = userId ?? guestId;
  if (!id) return config.freeSessionAllowance;
  const used = await allowanceUsed(kind, id, kolkataDateKey());
  return Math.max(0, config.freeSessionAllowance - used);
}
