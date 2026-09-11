import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

const secret = new TextEncoder().encode(config.jwtAccessSecret);
const AUDIENCE = "bullwave-rooms";
const ISSUER = "bullwave-backend";
const TTL_SECONDS = 60;

export type RoomTicket = {
  userId: string;
  playerId: string;
  expiresAt: Date;
};

export async function issueRoomTicket(userId: string): Promise<{ ticket: string; playerId: string; expiresAt: string }> {
  const playerId = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  const ticket = await new SignJWT({ playerId, purpose: "room_connect" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret);
  return { ticket, playerId, expiresAt: expiresAt.toISOString() };
}

export async function verifyRoomTicket(token: string): Promise<RoomTicket> {
  const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
  if (
    payload.purpose !== "room_connect" ||
    typeof payload.sub !== "string" ||
    typeof payload.playerId !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Invalid room ticket.");
  }
  return { userId: payload.sub, playerId: payload.playerId, expiresAt: new Date(payload.exp * 1000) };
}

export function isAllowedRoomOrigin(origin: string | undefined): boolean {
  if (!origin) return !config.isProd;
  return config.corsOrigins.includes(origin);
}
