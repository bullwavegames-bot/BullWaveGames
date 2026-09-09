import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../plugins/auth.js";
import {
  allowanceRemaining,
  getProgress,
  saveProgress,
  startPlay,
  submitScore,
  todaysFreeSlugs,
} from "../services/play.js";
import { friendsBoard, globalBoard } from "../services/leaderboard.js";
import { sql } from "../db.js";
import { hitRateLimit } from "../lib/rate-limit.js";
import { kolkataDateKey } from "../lib/kolkata.js";

export async function playRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/games", async () => {
    const games = await sql`SELECT * FROM games WHERE published ORDER BY title`;
    const freeToday = await todaysFreeSlugs();
    return { ok: true, games, freeToday };
  });

  app.get("/api/games/:slug", async (request) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    const games = await sql`SELECT * FROM games WHERE slug = ${params.slug} LIMIT 1`;
    return { ok: true, game: games[0] ?? null };
  });

  app.get("/api/play/status", async (request) => {
    const remaining = await allowanceRemaining(request.authUser?.id, request.guestId);
    const freeToday = await todaysFreeSlugs();
    const challenge = await sql`
      SELECT d.id, g.slug, d.rules, d.date_key
      FROM daily_challenges d JOIN games g ON g.id = d.game_id
      WHERE d.date_key = ${kolkataDateKey()}
      LIMIT 1
    `;
    return { ok: true, remaining, freeToday, dailyChallenge: challenge[0] ?? null };
  });

  app.post("/api/play/:slug/start", async (request) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    await hitRateLimit(`rl:play:${request.authUser?.id ?? request.ip}`, 30, 60);
    const session = await startPlay({
      slug: params.slug,
      userId: request.authUser?.id,
      guestId: request.guestId,
      ip: request.ip,
    });
    return { ok: true, ...session };
  });

  app.post("/api/play/:slug/score", async (request) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    const body = z
      .object({
        token: z.string().min(16),
        score: z.number().int(),
        stars: z.number().int().min(0).max(5).default(0),
        metric: z.string().max(80).optional(),
        durationMs: z.number().int().positive(),
      })
      .parse(request.body);
    await hitRateLimit(`rl:score:${request.authUser?.id ?? request.ip}`, 40, 60);
    const result = await submitScore({
      slug: params.slug,
      token: body.token,
      score: body.score,
      stars: body.stars,
      metric: body.metric,
      durationMs: body.durationMs,
      userId: request.authUser?.id,
      guestId: request.guestId,
    });
    return { ok: true, ...result };
  });

  app.put("/api/play/:slug/save", async (request) => {
    const user = requireUser(request);
    const params = z.object({ slug: z.string() }).parse(request.params);
    const body = z.object({ payload: z.record(z.unknown()), label: z.string().max(80).default("Saved run") }).parse(request.body);
    await saveProgress(user.id, params.slug, body.payload, body.label);
    return { ok: true };
  });

  app.get("/api/play/:slug/save", async (request) => {
    const user = requireUser(request);
    const params = z.object({ slug: z.string() }).parse(request.params);
    const rows = await getProgress(user.id, params.slug);
    return { ok: true, save: rows[0] ?? null };
  });

  app.get("/api/leaderboards/:slug", async (request) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    const query = z
      .object({
        scope: z.enum(["global", "friends"]).default("global"),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(request.query);
    if (query.scope === "friends") {
      const user = requireUser(request);
      const board = await friendsBoard(params.slug, user.id, query.page, query.pageSize);
      return { ok: true, ...board };
    }
    const board = await globalBoard(params.slug, query.page, query.pageSize, request.authUser?.id);
    return { ok: true, ...board };
  });
}
