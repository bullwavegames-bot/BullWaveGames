import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

export type SupabaseClaims = JWTPayload & {
  sub: string;
  email?: string;
};

export function createSupabaseVerifier(supabaseUrl: string, audience: string) {
  const normalized = supabaseUrl.replace(/\/$/, "");
  const remoteKeys = createRemoteJWKSet(new URL(`${normalized}/auth/v1/.well-known/jwks.json`));
  return async (token: string): Promise<SupabaseClaims> => {
    const { payload } = await jwtVerify(token, remoteKeys, {
      issuer: `${normalized}/auth/v1`,
      audience,
    });
    if (!payload.sub || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sub)) {
      throw new Error("Invalid Supabase subject.");
    }
    return payload as SupabaseClaims;
  };
}

let defaultVerifier: ReturnType<typeof createSupabaseVerifier> | null = null;

export async function verifySupabaseAccessToken(token: string): Promise<SupabaseClaims> {
  if (!config.supabaseUrl) throw new Error("Supabase authentication is not configured.");
  defaultVerifier ??= createSupabaseVerifier(config.supabaseUrl, config.supabaseJwtAudience);
  return defaultVerifier(token);
}
