import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

export type SupabaseClaims = JWTPayload & {
  sub: string;
  email?: string;
};

const SUBJECT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asClaims(payload: JWTPayload): SupabaseClaims {
  if (!payload.sub || !SUBJECT.test(payload.sub)) throw new Error("Invalid Supabase subject.");
  return payload as SupabaseClaims;
}

export function createSupabaseVerifier(supabaseUrl: string, audience: string, jwtSecret = "") {
  const normalized = supabaseUrl.replace(/\/$/, "");
  const issuer = `${normalized}/auth/v1`;
  const remoteKeys = createRemoteJWKSet(new URL(`${normalized}/auth/v1/.well-known/jwks.json`));
  const hmacKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

  const verifyWith = (key: Parameters<typeof jwtVerify>[1]) => async (token: string): Promise<SupabaseClaims> => {
    try {
      const { payload } = await jwtVerify(token, key, { issuer, audience, clockTolerance: 60 });
      return asClaims(payload);
    } catch {
      const { payload } = await jwtVerify(token, key, { issuer, clockTolerance: 60 });
      return asClaims(payload);
    }
  };

  const verifyJwks = verifyWith(remoteKeys);
  const verifyHmac = hmacKey ? verifyWith(hmacKey) : null;

  return async (token: string): Promise<SupabaseClaims> => {
    const alg = decodeProtectedHeader(token).alg ?? "";
    if (alg.startsWith("HS")) {
      if (!verifyHmac) throw new Error("HS256_SECRET_MISSING");
      return verifyHmac(token);
    }
    try {
      return await verifyJwks(token);
    } catch (jwksError) {
      if (!verifyHmac) throw jwksError;
      return verifyHmac(token);
    }
  };
}

let defaultVerifier: ReturnType<typeof createSupabaseVerifier> | null = null;

export async function verifySupabaseAccessToken(token: string): Promise<SupabaseClaims> {
  if (!config.supabaseUrl) throw new Error("Supabase authentication is not configured.");
  defaultVerifier ??= createSupabaseVerifier(config.supabaseUrl, config.supabaseJwtAudience, config.supabaseJwtSecret);
  return defaultVerifier(token);
}
