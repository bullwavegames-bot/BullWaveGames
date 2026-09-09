import { redis } from "../redis.js";
import { tooMany } from "./errors.js";

export async function hitRateLimit(key: string, limit: number, windowSec: number): Promise<void> {
  try {
    if (redis.status !== "ready") return;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    if (count > limit) throw tooMany();
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
  }
}
