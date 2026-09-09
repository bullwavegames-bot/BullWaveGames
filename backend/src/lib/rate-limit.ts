import { redis } from "../redis.js";
import { tooMany } from "./errors.js";

export async function hitRateLimit(key: string, limit: number, windowSec: number): Promise<void> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  if (count > limit) throw tooMany();
}
