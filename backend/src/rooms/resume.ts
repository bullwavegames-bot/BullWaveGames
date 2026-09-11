import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { redis } from "../redis.js";

const RESERVATION_TTL_SECONDS = 30;
const CREDENTIAL_TTL_SECONDS = 6 * 60 * 60;

function key(code: string, playerId: string): string {
  return `room:${code}:resume:${playerId}`;
}

export function hashResumeCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

export function resumeReservationExpiry(): number {
  return Date.now() + RESERVATION_TTL_SECONDS * 1000;
}

export async function createResumeCredential(code: string, playerId: string, userId: string) {
  const credential = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + CREDENTIAL_TTL_SECONDS * 1000;
  await redis.set(key(code, playerId), JSON.stringify({ userId, credentialHash: hashResumeCredential(credential), expiresAt }), "EX", CREDENTIAL_TTL_SECONDS);
  return { credential, expiresAt };
}

export async function consumeResumeCredential(code: string, playerId: string, userId: string, credential: string): Promise<boolean> {
  const raw = await redis.get(key(code, playerId));
  if (!raw) return false;
  const stored = JSON.parse(raw) as { userId?: unknown; credentialHash?: unknown; expiresAt?: unknown };
  const expected = typeof stored.credentialHash === "string" ? Buffer.from(stored.credentialHash, "hex") : null;
  const actual = Buffer.from(hashResumeCredential(credential), "hex");
  const valid = stored.userId === userId && typeof stored.expiresAt === "number" && stored.expiresAt > Date.now()
    && expected !== null && expected.length === actual.length && timingSafeEqual(expected, actual);
  if (valid) await redis.del(key(code, playerId));
  return valid;
}

export async function clearResumeCredential(code: string, playerId: string): Promise<void> {
  await redis.del(key(code, playerId));
}
