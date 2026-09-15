import { config } from "./config.js";
import { sql } from "./db.js";
import { startWorkers } from "./jobs/workers.js";
import { logger } from "./logger.js";
import { redis, redisSub } from "./redis.js";

async function main() {
  if (config.isProd && config.serviceKind !== "worker") {
    throw new Error("The production worker requires SERVICE_KIND=worker.");
  }
  if (config.sentryDsn) {
    const Sentry = await import("@sentry/node");
    Sentry.init({ dsn: config.sentryDsn, environment: config.env });
  }
  const stopWorkers = startWorkers();
  logger.info("Bullwave worker started; dependency failures are retried by scheduled jobs");

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, "worker shutdown started");
    const forceTimer = setTimeout(() => {
      logger.error("worker shutdown timed out");
      process.exit(1);
    }, config.shutdownTimeoutMs);
    forceTimer.unref();
    await stopWorkers();
    await sql.end({ timeout: Math.max(1, Math.floor(config.shutdownTimeoutMs / 1000)) });
    redis.disconnect();
    redisSub.disconnect();
    clearTimeout(forceTimer);
    logger.info("worker shutdown complete");
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error(error, "worker fatal");
  process.exit(1);
});
