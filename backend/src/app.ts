import Fastify, { type FastifyBaseLogger, type FastifyError } from "fastify";
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
import { sql } from "./db.js";
import { redis } from "./redis.js";

type ReadinessChecks = { database: () => Promise<unknown>; redis: () => Promise<unknown> };

async function bounded(check: () => Promise<unknown>, timeoutMs = 2_000): Promise<unknown> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      check(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Dependency check timed out.")), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function buildApp(options: { roomsEnabled?: boolean; readinessChecks?: ReadinessChecks } = {}) {
  const readinessChecks = options.readinessChecks ?? {
    database: () => sql`SELECT 1`,
    redis: () => redis.ping(),
  };
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 64,
    forceCloseConnections: "idle",
    return503OnClosing: true,
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

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept", "X-Requested-With", "Idempotency-Key"],
    maxAge: 86400,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });
  await app.register(websocket, { options: { maxPayload: 8192 } });
  await registerAuth(app);

  const live = () => ({
    ok: true,
    service: "bullwave-backend",
    brand: "Bullwave Games",
    gambling: false,
    time: new Date().toISOString(),
  });
  app.get("/health/live", async () => live());
  app.get("/health/ready", async (_request, reply) => {
    const [database, redisResult] = await Promise.allSettled([
      bounded(readinessChecks.database),
      bounded(readinessChecks.redis),
    ]);
    const dependencies = {
      database: database.status === "fulfilled" ? "up" : "down",
      redis: redisResult.status === "fulfilled" ? "up" : "down",
    };
    const ready = database.status === "fulfilled" && redisResult.status === "fulfilled";
    return reply.code(ready ? 200 : 503).send({ ...live(), ok: ready, dependencies });
  });
  app.get("/health", async () => live());
  app.get("/api/health", async () => live());

  await app.register(authRoutes);
  await app.register(billingRoutes);
  await app.register(playRoutes);
  await app.register(socialRoutes);
  await app.register(adminRoutes);
  if (options.roomsEnabled ?? true) await attachRooms(app);

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
      error: status >= 500 && config.isProd ? "Something went wrong." : error.message || "Something went wrong.",
      code: "ERROR",
    });
  });

  return app;
}
