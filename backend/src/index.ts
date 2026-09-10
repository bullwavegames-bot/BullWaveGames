import { config } from "./config.js";
import { logger } from "./logger.js";
import { sql } from "./db.js";
import { connectRedis, redis, redisSub } from "./redis.js";
import { migrate } from "./sql/migrate.js";
import { seed } from "./sql/seed.js";
import { buildApp } from "./app.js";
import { startWorkers } from "./jobs/workers.js";

async function main() {
  if (config.sentryDsn) {
    const Sentry = await import("@sentry/node");
    Sentry.init({ dsn: config.sentryDsn, environment: config.env });
  }
  await migrate();
  await seed();
  let redisAvailable = true;
  try {
    await connectRedis();
  } catch (error) {
    redisAvailable = false;
    logger.warn({ err: error }, "Redis is not available; rooms and rate limits are degraded");
  }
  const app = await buildApp({ roomsEnabled: redisAvailable });
  const stopWorkers = startWorkers({ redisAvailable });
  await app.listen({ port: config.port, host: config.host });
  logger.info({ port: config.port }, "Bullwave backend listening");

  const shutdown = async () => {
    stopWorkers();
    await app.close();
    await sql.end({ timeout: 5 });
    redis.disconnect();
    redisSub.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  logger.error(error, "fatal");
  process.exit(1);
});
