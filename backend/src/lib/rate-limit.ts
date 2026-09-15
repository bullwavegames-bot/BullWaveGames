import { redis } from "../redis.js";
import { ApiError, tooMany } from "./errors.js";

const incrementWithExpiry = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`;

export async function hitRateLimit(key: string, limit: number, windowSec: number): Promise<void> {
  try {
    const count = Number(await redis.eval(incrementWithExpiry, 1, key, windowSec));
    if (count > limit) throw tooMany();
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw new ApiError(503, "Request protection is temporarily unavailable. Please retry shortly.", "RATE_LIMIT_UNAVAILABLE");
  }
}
