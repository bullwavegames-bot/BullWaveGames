import { Redis } from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
export const redisSub = new Redis(config.redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });

redis.on("error", (error: Error) => logger.warn({ err: error }, "redis error"));
redisSub.on("error", (error: Error) => logger.warn({ err: error }, "redis subscriber error"));

export async function connectRedis(): Promise<void> {
  if (redis.status === "wait") await redis.connect();
  if (redisSub.status === "wait") await redisSub.connect();
}
