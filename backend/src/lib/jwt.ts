import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

const secret = new TextEncoder().encode(config.jwtAccessSecret);

export type AccessClaims = {
  sub: string;
  role: "player" | "admin";
  jti: string;
};

export async function signAccessToken(userId: string, role: "player" | "admin"): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTokenTtlSec}s`)
    .sign(secret);
  return { token, jti };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret);
  if (!payload.sub || (payload.role !== "player" && payload.role !== "admin") || !payload.jti) {
    throw new Error("invalid token");
  }
  return { sub: payload.sub, role: payload.role, jti: payload.jti };
}
