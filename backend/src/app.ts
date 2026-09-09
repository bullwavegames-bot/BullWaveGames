import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { ApiError } from "./lib/errors.js";
import { registerAuth } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { playRoutes } from "./routes/play.js";
import { socialRoutes } from "./routes/social.js";
import { adminRoutes } from "./routes/admin.js";
import { attachRooms } from "./rooms/ws.js";

export async function buildApp() {
  const app = Fastify({
    logger: logger as never,
    trustProxy: true,
    bodyLimit: 1024 * 64,
  });

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    try {
      const raw = body.toString("utf8");
      (req as { rawBody?: string }).rawBody = raw;
      done(null, raw ? JSON.parse(raw) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      cb(null, config.corsOrigins.includes(origin));
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });
  await app.register(websocket, { options: { maxPayload: 8192 } });
  await registerAuth(app);

  app.get("/health", async () => ({
    ok: true,
    service: "bullwave-backend",
    brand: "Bullwave Games",
    gambling: false,
    time: new Date().toISOString(),
  }));
  app.get("/api/health", async () => ({
    ok: true,
    service: "bullwave-backend",
    brand: "Bullwave Games",
    gambling: false,
    time: new Date().toISOString(),
  }));

  await app.register(authRoutes);
  await app.register(billingRoutes);
  await app.register(playRoutes);
  await app.register(socialRoutes);
  await app.register(adminRoutes);
  await attachRooms(app);

  app.setErrorHandler((error: FastifyError | ZodError | ApiError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ ok: false, error: "Invalid request.", code: "VALIDATION", details: error.flatten() });
    }
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ ok: false, error: error.message, code: error.code });
    }
    const status = (error as FastifyError).statusCode ?? 500;
    if (status === 429) {
      return reply.code(429).send({ ok: false, error: "Too many attempts. Try again shortly.", code: "RATE_LIMIT" });
    }
    request.log.error({ err: error }, "unhandled");
    return reply.code(status >= 400 ? status : 500).send({
      ok: false,
      error: status >= 500 ? "Something went wrong." : error.message,
      code: "ERROR",
    });
  });

  return app;
}
