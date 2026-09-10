import { config } from "./config.js";
import { sql } from "./db.js";
import { startWorkers } from "./jobs/workers.js";
import { logger } from "./logger.js";
import { connectRedis, redis, redisSub } from "./redis.js";

async function main() {
  if (config.isProd && config.serviceKind !== "worker") {
    throw new Error("The production worker requires SERVICE_KIND=worker.");
  }
  if (config.sentryDsn) {
    const Sentry = await import("@sentry/node");
    Sentry.init({ dsn: config.sentryDsn, environment: config.env });
  }
  let redisAvailable = true;
  try {
    await connectRedis();
  } catch (error) {
    redisAvailable = false;
    logger.warn({ err: error }, "Redis is unavailable; Redis-backed jobs are paused");
  }
  const stopWorkers = startWorkers({ redisAvailable });
  logger.info({ redisAvailable }, "Bullwave worker started");

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, "worker shutdown started");
    stopWorkers();
    await sql.end({ timeout: Math.max(1, Math.floor(config.shutdownTimeoutMs / 1000)) });
    redis.disconnect();
    redisSub.disconnect();
    logger.info("worker shutdown complete");
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error(error, "worker fatal");
  process.exit(1);
});
