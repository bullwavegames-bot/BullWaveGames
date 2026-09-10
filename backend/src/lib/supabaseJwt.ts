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

function uuidSubject(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hasExpectedAudience(aud: JWTPayload["aud"]): boolean {
  if (!aud) return true;
  if (aud === config.supabaseJwtAudience) return true;
  return Array.isArray(aud) && aud.includes(config.supabaseJwtAudience);
}

async function verifyWithJwks(token: string): Promise<SupabaseClaims> {
  const { payload } = await jwtVerify(token, keys(), {
    issuer: [`${config.supabaseUrl}/auth/v1`, config.supabaseUrl],
    clockTolerance: 30,
  });
  if (!uuidSubject(payload.sub)) throw new Error("Invalid Supabase subject.");
  if (!hasExpectedAudience(payload.aud)) throw new Error("Invalid Supabase audience.");
  return payload as SupabaseClaims;
}

async function verifyWithAuthApi(token: string): Promise<SupabaseClaims> {
  if (!config.supabaseAnonKey) throw new Error("Supabase Auth API fallback needs SUPABASE_ANON_KEY.");
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.supabaseAnonKey,
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Supabase rejected the access token.");
  const body = await response.json() as { id?: string; email?: string };
  if (!uuidSubject(body.id)) throw new Error("Invalid Supabase subject.");
  return { sub: body.id, email: body.email };
}

export async function verifySupabaseAccessToken(token: string): Promise<SupabaseClaims> {
  try {
    return await verifyWithJwks(token);
  } catch (jwksError) {
    try {
      return await verifyWithAuthApi(token);
    } catch {
      throw jwksError;
    }
  }
}
