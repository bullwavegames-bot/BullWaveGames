import { sql } from "../db.js";
import { config } from "../config.js";
import type { UserRow } from "../types.js";
import type { SupabaseClaims } from "../lib/supabaseJwt.js";
import { conflict, unauthorized } from "../lib/errors.js";

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    SELECT * FROM users WHERE email = ${email} AND deleted_at IS NULL LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    SELECT * FROM users WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `;
  return rows[0] ?? null;
}

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string;
  avatar_id: string;
  onboarding_complete: boolean;
  role: "player" | "admin";
};

async function loadSupabaseProfile(claims: SupabaseClaims, accessToken: string): Promise<ProfileRow | null> {
  if (config.supabaseAnonKey) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/profiles`);
    url.searchParams.set("id", `eq.${claims.sub}`);
    url.searchParams.set("select", "id,email,display_name,avatar_id,onboarding_complete,role");
    const response = await fetch(url, {
      headers: {
        apikey: config.supabaseAnonKey,
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) {
      throw unauthorized("Sign in to continue.", "PROFILE_UNAVAILABLE");
    }
    if (!response.ok) return null;
    const profiles = await response.json() as ProfileRow[];
    return profiles[0] ?? null;
  }
  try {
    const profiles = await sql<ProfileRow[]>`
      SELECT id, email, display_name, avatar_id, onboarding_complete, role
      FROM public.profiles WHERE id = ${claims.sub} LIMIT 1
    `;
    return profiles[0] ?? null;
  } catch {
    return null;
  }
}

function profileFromClaims(claims: SupabaseClaims, profile: ProfileRow | null): ProfileRow {
  const email = (profile?.email ?? claims.email ?? "").trim().toLowerCase();
  return {
    id: profile?.id ?? claims.sub,
    email: email || null,
    display_name: profile?.display_name || email.split("@")[0] || "Player",
    avatar_id: profile?.avatar_id || "lantern",
    onboarding_complete: profile?.onboarding_complete ?? false,
    role: profile?.role === "admin" ? "admin" : "player",
  };
}

export async function provisionSupabaseUser(claims: SupabaseClaims, accessToken: string): Promise<UserRow> {
  const profile = profileFromClaims(claims, await loadSupabaseProfile(claims, accessToken));
  const email = (profile.email ?? "").trim().toLowerCase();
  if (!email) throw unauthorized("Your account does not have an email address.", "EMAIL_MISSING");

  try {
    return await sql.begin(async (tx) => {
      const existing = await tx<UserRow[]>`
        SELECT * FROM users WHERE supabase_user_id = ${claims.sub} AND deleted_at IS NULL LIMIT 1
      `;
      if (existing[0]) {
        const rows = await tx<UserRow[]>`
          UPDATE users SET
            email = ${email},
            display_name = ${profile.display_name},
            avatar_id = ${profile.avatar_id},
            onboarding_complete = ${profile.onboarding_complete},
            role = ${profile.role},
            email_verified_at = COALESCE(email_verified_at, now()),
            updated_at = now()
          WHERE id = ${existing[0].id}
          RETURNING *
        `;
        return rows[0];
      }

      const emailOwner = await tx<UserRow[]>`
        SELECT * FROM users WHERE email = ${email} LIMIT 1
      `;
      if (emailOwner[0]) {
        if (emailOwner[0].deleted_at || emailOwner[0].supabase_user_id) {
          throw conflict(
            "This email belongs to an existing account and requires an explicit identity migration.",
            "IDENTITY_LINK_REQUIRED",
          );
        }
        const linked = await tx<UserRow[]>`
          UPDATE users SET
            auth_provider = 'supabase',
            supabase_user_id = ${claims.sub},
            password_hash = NULL,
            display_name = ${profile.display_name},
            avatar_id = ${profile.avatar_id},
            onboarding_complete = ${profile.onboarding_complete},
            role = ${profile.role},
            email_verified_at = COALESCE(email_verified_at, now()),
            updated_at = now()
          WHERE id = ${emailOwner[0].id}
          RETURNING *
        `;
        return linked[0];
      }

      const rows = await tx<UserRow[]>`
        INSERT INTO users ${tx({
          id: profile.id,
          email,
          billing_email: email,
          password_hash: null,
          auth_provider: "supabase",
          supabase_user_id: claims.sub,
          display_name: profile.display_name,
          avatar_id: profile.avatar_id,
          email_verified_at: new Date(),
          role: profile.role,
          onboarding_complete: profile.onboarding_complete,
        })}
        RETURNING *
      `;
      await tx`
        INSERT INTO memberships ${tx({ user_id: rows[0].id, status: "none", source: "none" })}
        ON CONFLICT (user_id) DO NOTHING
      `;
      await tx`
        INSERT INTO user_cosmetics ${tx({ user_id: rows[0].id, cosmetic_id: "frame-standard" })}
        ON CONFLICT DO NOTHING
      `;
      return rows[0];
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw conflict("This Supabase identity is already mapped.", "IDENTITY_CONFLICT");
    }
    throw error;
  }
}

export async function touchLoginStreak(userId: string, dateKey: string): Promise<void> {
  const rows = await sql<{ last_login_date_key: string | null; current_streak: number; longest_streak: number }[]>`
    SELECT last_login_date_key::text, current_streak, longest_streak FROM login_streaks WHERE user_id = ${userId}
  `;
  const prev = rows[0];
  let current = 1;
  if (prev?.last_login_date_key === dateKey) return;
  if (prev?.last_login_date_key) {
    const last = new Date(`${prev.last_login_date_key}T00:00:00+05:30`);
    const today = new Date(`${dateKey}T00:00:00+05:30`);
    const diff = (today.getTime() - last.getTime()) / 86400000;
    current = diff === 1 ? prev.current_streak + 1 : 1;
  }
  const longest = Math.max(current, prev?.longest_streak ?? 0);
  await sql`
    INSERT INTO login_streaks ${sql({
      user_id: userId,
      current_streak: current,
      longest_streak: longest,
      last_login_date_key: dateKey,
    })}
    ON CONFLICT (user_id) DO UPDATE SET
      current_streak = EXCLUDED.current_streak,
      longest_streak = EXCLUDED.longest_streak,
      last_login_date_key = EXCLUDED.last_login_date_key
  `;
}
