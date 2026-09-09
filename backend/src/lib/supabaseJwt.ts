import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config.js";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function keys() {
  if (!config.supabaseUrl) return null;
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

export async function verifySupabaseAccessToken(token: string): Promise<{ id: string; email: string } | null> {
  const set = keys();
  if (!set) return null;
  try {
    const { payload } = await jwtVerify(token, set);
    const id = typeof payload.sub === "string" ? payload.sub : "";
    if (!id) return null;
    const email =
      (typeof payload.email === "string" && payload.email) ||
      (typeof (payload.user_metadata as { email?: string } | undefined)?.email === "string"
        ? (payload.user_metadata as { email: string }).email
        : "") ||
      "";
    return { id, email };
  } catch {
    return null;
  }
}
