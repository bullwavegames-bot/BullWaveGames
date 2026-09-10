import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export type SupabaseClaims = JWTPayload & {
  sub: string;
  email?: string;
};

function keys() {
  if (!config.supabaseUrl) throw new Error("Supabase authentication is not configured.");
  jwks ??= createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`));
  return jwks;
}

export async function verifySupabaseAccessToken(token: string): Promise<SupabaseClaims> {
  const { payload } = await jwtVerify(token, keys(), {
    issuer: `${config.supabaseUrl}/auth/v1`,
    audience: config.supabaseJwtAudience,
  });
  if (!payload.sub || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sub)) {
    throw new Error("Invalid Supabase subject.");
  }
  return payload as SupabaseClaims;
}
