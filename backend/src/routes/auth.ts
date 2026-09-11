import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  login,
  logout,
  refresh,
  register,
  requestReset,
  requestVerify,
  resetPassword,
  updateMe,
  verifyEmail,
} from "../services/auth.js";
import { getMembership } from "../services/membership.js";
import { listAchievements } from "../services/achievements.js";
import { getBests, getProgress } from "../services/play.js";
import { publicEntitlement, publicUser } from "../types.js";
import { findUserById } from "../services/users.js";
import { sql } from "../db.js";
import { cosmeticsForUser, equipCosmetics } from "../services/cosmetics.js";
import { clearAuthCookies, requireUser, setAuthCookies } from "../plugins/auth.js";
import { hitRateLimit } from "../lib/rate-limit.js";
import { config } from "../config.js";
import { unauthorized } from "../lib/errors.js";
import {
  createLegacyMigrationTicket,
  isRecentAuthentication,
  linkLegacyIdentity,
  requestSupabaseAccountDeletion,
} from "../services/identity.js";

const passwordSchema = z.string().min(8);
const emailSchema = z.string().email();

export async function authRoutes(app: FastifyInstance): Promise<void> {
  if (config.authMode === "legacy") {
  app.post("/api/auth/register", async (request, reply) => {
    const body = z.object({ email: emailSchema, password: passwordSchema }).strict().parse(request.body);
    const session = await register({
      email: body.email,
      password: body.password,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    setAuthCookies(reply, session.accessToken, session.refreshToken);
    return { ok: true, ...session };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = z.object({ email: emailSchema, password: z.string() }).parse(request.body);
    const session = await login({
      email: body.email,
      password: body.password,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    setAuthCookies(reply, session.accessToken, session.refreshToken);
    return { ok: true, ...session };
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
    const token = body.refreshToken ?? request.cookies.bw_refresh;
    if (!token) return reply.code(401).send({ ok: false, error: "Session expired. Log in again." });
    const session = await refresh({ refreshToken: token, ip: request.ip, userAgent: request.headers["user-agent"] });
    setAuthCookies(reply, session.accessToken, session.refreshToken);
    return { ok: true, ...session };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const user = request.authUser;
    if (user) {
      const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
      await logout(body.refreshToken ?? request.cookies.bw_refresh, user.id);
    }
    clearAuthCookies(reply);
    return { ok: true };
  });

  app.post("/api/auth/verify-email", async (request) => {
    const body = z.object({ token: z.string().min(8) }).parse(request.body);
    const result = await verifyEmail(body.token);
    return { ok: true, ...result };
  });

  app.post("/api/auth/resend-verify", async (request) => {
    const user = requireUser(request);
    const result = await requestVerify(user.id, request.ip);
    return result.already ? { ok: true, already: true } : { ok: true, cooldown: result.cooldown };
  });

  app.post("/api/auth/forgot-password", async (request) => {
    const body = z.object({ email: emailSchema }).parse(request.body);
    await requestReset(body.email, request.ip);
    return { ok: true };
  });

  app.post("/api/auth/reset-password", async (request) => {
    const body = z.object({ token: z.string().min(8), password: passwordSchema }).parse(request.body);
    await resetPassword(body.token, body.password);
    return { ok: true };
  });

  app.post("/api/auth/change-password", async (request) => {
    const user = requireUser(request);
    const body = z.object({ current: z.string(), next: passwordSchema }).parse(request.body);
    await changePassword(user.id, body.current, body.next);
    return { ok: true };
  });
  }

  if (config.authMode === "supabase") {
    app.post("/api/auth/logout", async (_request, reply) => {
      clearAuthCookies(reply);
      return { ok: true };
    });
  }

  app.post("/api/auth/migrations/legacy-ticket", async (request) => {
    await hitRateLimit(`rl:identity-migration:${request.ip}`, 5, 15 * 60);
    const body = z.object({ email: emailSchema, password: z.string().min(1) }).strict().parse(request.body);
    return { ok: true, ...(await createLegacyMigrationTicket(body.email, body.password, request.ip)) };
  });

  app.post("/api/auth/migrations/supabase-link", async (request) => {
    await hitRateLimit(`rl:identity-link:${request.ip}`, 10, 15 * 60);
    if (config.authMode !== "supabase" || !request.supabaseClaims) {
      throw unauthorized("A valid Supabase session is required.");
    }
    const body = z.object({ migrationTicket: z.string().min(32) }).strict().parse(request.body);
    const linked = await linkLegacyIdentity(body.migrationTicket, request.supabaseClaims);
    return { ok: true, user: publicUser(linked) };
  });

  app.get("/api/me", async (request) => {
    const user = requireUser(request);
    const row = await findUserById(user.id);
    const membership = await getMembership(user.id);
    const settings = await sql`SELECT * FROM user_settings WHERE user_id = ${user.id}`;
    const streak = await sql`SELECT current_streak, longest_streak, last_login_date_key FROM login_streaks WHERE user_id = ${user.id}`;
    return {
      ok: true,
      user: row ? publicUser(row) : null,
      entitlement: publicEntitlement(membership),
      settings: settings[0] ?? null,
      streak: streak[0] ?? { current_streak: 0, longest_streak: 0 },
    };
  });

  app.patch("/api/me", async (request) => {
    const user = requireUser(request);
    const body = z
      .object({
        displayName: z.string().optional(),
        avatarId: z.string().optional(),
        billingEmail: z.string().email().optional(),
        autoRenew: z.boolean().optional(),
        onboardingComplete: z.boolean().optional(),
      })
      .strict()
      .parse(request.body);
    const updated = await updateMe(user.id, body);
    return { ok: true, user: updated };
  });

  if (config.authMode === "legacy") {
    app.post("/api/me/email", async (request) => {
      const user = requireUser(request);
      const body = z.object({ email: emailSchema }).parse(request.body);
      await changeEmail(user.id, body.email, request.ip);
      return { ok: true };
    });
  }

  app.patch("/api/me/settings", async (request) => {
    const user = requireUser(request);
    const body = z
      .object({
        reducedMotion: z.boolean().optional(),
        uiSound: z.boolean().optional(),
        gameSound: z.boolean().optional(),
        reminderEnabled: z.boolean().optional(),
        reminderInterval: z.enum(["tonight", "tomorrow", "weekend"]).optional(),
        soundConsent: z.boolean().optional(),
      })
      .parse(request.body);
    await sql`
      INSERT INTO user_settings ${sql({
        user_id: user.id,
        reduced_motion: body.reducedMotion ?? false,
        ui_sound: body.uiSound ?? false,
        game_sound: body.gameSound ?? false,
        reminder_enabled: body.reminderEnabled ?? false,
        reminder_interval: body.reminderInterval ?? "tomorrow",
        sound_consent: body.soundConsent ?? false,
      })}
      ON CONFLICT (user_id) DO UPDATE SET
        reduced_motion = COALESCE(${body.reducedMotion ?? null}, user_settings.reduced_motion),
        ui_sound = COALESCE(${body.uiSound ?? null}, user_settings.ui_sound),
        game_sound = COALESCE(${body.gameSound ?? null}, user_settings.game_sound),
        reminder_enabled = COALESCE(${body.reminderEnabled ?? null}, user_settings.reminder_enabled),
        reminder_interval = COALESCE(${body.reminderInterval ?? null}, user_settings.reminder_interval),
        sound_consent = COALESCE(${body.soundConsent ?? null}, user_settings.sound_consent)
    `;
    return { ok: true };
  });

  app.delete("/api/me", async (request, reply) => {
    const user = requireUser(request);
    if (config.authMode === "supabase") {
      if (!request.supabaseClaims || !isRecentAuthentication(request.authIssuedAt)) {
        throw unauthorized("Reauthenticate before deleting this account.", "RECENT_AUTH_REQUIRED");
      }
      await requestSupabaseAccountDeletion(user.id, request.supabaseClaims.sub);
      clearAuthCookies(reply);
      return reply.code(202).send({ ok: true, status: "pending" });
    }
    await deleteAccount(user.id);
    clearAuthCookies(reply);
    return { ok: true };
  });

  app.get("/api/me/progress", async (request) => {
    const user = requireUser(request);
    const query = z.object({ slug: z.string().optional() }).parse(request.query);
    const saves = await getProgress(user.id, query.slug);
    const bests = await getBests(user.id);
    const achievements = await listAchievements(user.id);
    const cosmetics = await cosmeticsForUser(user.id);
    return { ok: true, saves, bests, achievements, cosmetics };
  });

  app.put("/api/me/cosmetics/equipped", async (request) => {
    const user = requireUser(request);
    const body = z.object({
      frameId: z.string().min(1).max(120).nullable().optional(),
      themeId: z.string().min(1).max(120).nullable().optional(),
      badgeId: z.string().min(1).max(120).nullable().optional(),
    }).strict().refine((value) => Object.keys(value).length > 0, "Choose at least one loadout slot.").parse(request.body);
    const cosmetics = await equipCosmetics(user.id, body);
    return { ok: true, cosmetics };
  });

  app.post("/api/migrations/local-v1", async (request) => {
    const user = requireUser(request);
    await hitRateLimit(`rl:migrate:${user.id}`, 3, 3600);
    const body = z
      .object({
        displayName: z.string().optional(),
        saves: z
          .array(z.object({ slug: z.string(), label: z.string().optional(), payload: z.record(z.unknown()) }))
          .optional(),
        cosmetics: z.array(z.string()).optional(),
      })
      .parse(request.body);
    if (body.displayName) await updateMe(user.id, { displayName: body.displayName });
    if (body.saves) {
      const { saveProgress } = await import("../services/play.js");
      for (const save of body.saves) {
        await saveProgress(user.id, save.slug, save.payload, save.label ?? "Imported save");
      }
    }
    if (body.cosmetics?.length) {
      for (const id of body.cosmetics) {
        await sql`
          INSERT INTO user_cosmetics ${sql({ user_id: user.id, cosmetic_id: id })}
          ON CONFLICT DO NOTHING
        `.catch(() => undefined);
      }
    }
    return {
      ok: true,
      imported: { saves: body.saves?.length ?? 0, cosmetics: body.cosmetics?.length ?? 0 },
      note: "Personal bests and admin role were not imported. Ranked scores require a new accepted play session.",
    };
  });
}
