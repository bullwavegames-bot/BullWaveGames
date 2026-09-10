import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "../lib/jwt.js";
import { verifySupabaseAccessToken } from "../lib/supabaseJwt.js";
import { findUserById, provisionSupabaseUser } from "../services/users.js";
import { ensureGuest } from "../services/play.js";
import { ApiError, unauthorized, forbidden } from "../lib/errors.js";
import { config } from "../config.js";

export type AuthUser = { id: string; role: "player" | "admin" };

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
    guestId: string | null;
    rawBody?: string | Buffer;
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.decorateRequest("authUser", null);
  app.decorateRequest("guestId", null);

  app.addHook("preHandler", async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : request.cookies.bw_access;
    if (token) {
      try {
        const claims = config.authMode === "supabase"
          ? await verifySupabaseAccessToken(token)
          : await verifyAccessToken(token);
        const user = config.authMode === "supabase"
          ? await provisionSupabaseUser(claims, token)
          : await findUserById(claims.sub);
        if (user) request.authUser = { id: user.id, role: user.role };
      } catch (error) {
        request.authUser = null;
        if (error instanceof ApiError) throw error;
        request.log.warn({ err: error }, "authentication failed");
      }
    }
    if (request.url.startsWith("/api/play") || request.url.startsWith("/rooms")) {
      request.guestId = await ensureGuest(request.cookies.bw_guest).catch(() => null);
    }
  });

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.guestId && request.cookies.bw_guest !== request.guestId) {
      reply.setCookie("bw_guest", request.guestId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 400,
      });
    }
    return payload;
  });
}

export function requireUser(request: FastifyRequest): AuthUser {
  if (!request.authUser) throw unauthorized();
  return request.authUser;
}

export function requireAdmin(request: FastifyRequest): AuthUser {
  const user = requireUser(request);
  if (user.role !== "admin") throw forbidden("Operations tools are limited to authorized studio roles.");
  return user;
}

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  reply.setCookie("bw_access", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  reply.setCookie("bw_refresh", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie("bw_access", { path: "/" });
  reply.clearCookie("bw_refresh", { path: "/" });
}
