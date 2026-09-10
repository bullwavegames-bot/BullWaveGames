import { config } from "../config.js";
import { sql } from "../db.js";
import { randomToken, sha256, verifyPassword } from "../lib/crypto.js";
import { conflict, forbidden, unauthorized } from "../lib/errors.js";
import type { SupabaseClaims } from "../lib/supabaseJwt.js";
import type { UserRow } from "../types.js";
import { resolveSupabaseProfile } from "./users.js";

const MIGRATION_TICKET_TTL_MS = 10 * 60 * 1000;
export const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

export function isRecentAuthentication(issuedAt: number | null, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  return issuedAt !== null && issuedAt <= nowSeconds + 30 && nowSeconds - issuedAt <= RECENT_AUTH_MAX_AGE_SECONDS;
}

export async function createLegacyMigrationTicket(emailInput: string, password: string, ip?: string) {
  const email = emailInput.trim().toLowerCase();
  const rows = await sql<UserRow[]>`
    SELECT * FROM users
    WHERE email = ${email} AND auth_provider = 'legacy' AND deleted_at IS NULL
    LIMIT 1
  `;
  const user = rows[0];
  if (!user?.password_hash || !(await verifyPassword(user.password_hash, password))) {
    throw unauthorized("Email or password is incorrect.", "BAD_CREDENTIALS");
  }
  const token = randomToken();
  const expiresAt = new Date(Date.now() + MIGRATION_TICKET_TTL_MS);
  await sql.begin(async (tx) => {
    await tx`
      UPDATE identity_migration_tickets SET used_at = now()
      WHERE user_id = ${user.id} AND used_at IS NULL
    `;
    await tx`
      INSERT INTO identity_migration_tickets ${tx({
        user_id: user.id,
        token_hash: sha256(token),
        expires_at: expiresAt,
        requested_ip: ip ?? null,
      })}
    `;
  });
  return { migrationTicket: token, expiresAt: expiresAt.toISOString() };
}

export async function linkLegacyIdentity(ticket: string, claims: SupabaseClaims) {
  const profile = await resolveSupabaseProfile(claims);
  if (!profile) throw unauthorized("Complete Supabase account setup before linking.", "PROFILE_MISSING");
  const profileEmail = (profile.email ?? claims.email ?? "").trim().toLowerCase();
  if (!profileEmail) throw unauthorized("The Supabase account has no verified email.", "EMAIL_MISSING");

  try {
    return await sql.begin(async (tx) => {
      const tickets = await tx<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }[]>`
        SELECT id, user_id, expires_at, used_at
        FROM identity_migration_tickets
        WHERE token_hash = ${sha256(ticket)}
        FOR UPDATE
      `;
      const row = tickets[0];
      if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
        throw unauthorized("The migration ticket is invalid or expired.", "MIGRATION_TICKET_INVALID");
      }
      const users = await tx<UserRow[]>`SELECT * FROM users WHERE id = ${row.user_id} FOR UPDATE`;
      const user = users[0];
      if (!user || user.deleted_at || user.auth_provider !== "legacy") {
        throw conflict("This account cannot be migrated.", "IDENTITY_MIGRATION_CONFLICT");
      }
      if (user.email.toLowerCase() !== profileEmail) {
        throw forbidden("The Supabase email must match the legacy account email.", "IDENTITY_EMAIL_MISMATCH");
      }
      const mapped = await tx<{ id: string }[]>`
        SELECT id FROM users WHERE supabase_user_id = ${claims.sub} AND id <> ${user.id} LIMIT 1
      `;
      if (mapped[0]) throw conflict("This Supabase identity is already linked.", "IDENTITY_CONFLICT");

      const updated = await tx<UserRow[]>`
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
        WHERE id = ${user.id}
        RETURNING *
      `;
      await tx`UPDATE identity_migration_tickets SET used_at = now() WHERE id = ${row.id}`;
      await tx`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${user.id} AND revoked_at IS NULL`;
      await tx`
        INSERT INTO audit_log ${tx({
          actor_id: user.id,
          action: "identity_linked",
          target: claims.sub,
          payload: tx.json({ provider: "supabase" }),
        })}
      `;
      return updated[0];
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw conflict("This identity is already linked.", "IDENTITY_CONFLICT");
    }
    throw error;
  }
}

export async function requestSupabaseAccountDeletion(userId: string, supabaseUserId: string) {
  await sql.begin(async (tx) => {
    const users = await tx<UserRow[]>`SELECT * FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = users[0];
    if (!user || user.supabase_user_id !== supabaseUserId) throw unauthorized();
    const membership = await tx<{ razorpay_subscription_id: string | null; auto_renew: boolean }[]>`
      SELECT razorpay_subscription_id, auto_renew FROM memberships WHERE user_id = ${userId} FOR UPDATE
    `;
    if (membership[0]?.razorpay_subscription_id && membership[0].auto_renew) {
      throw conflict("Cancel automatic renewal before deleting this account.", "ACTIVE_SUBSCRIPTION");
    }
    const deletedEmail = `deleted+${user.id}@invalid.local`;
    await tx`
      UPDATE users SET
        email = ${deletedEmail}, billing_email = ${deletedEmail}, display_name = 'Deleted player',
        avatar_id = 'lantern', password_hash = NULL, deleted_at = now(),
        deletion_status = 'pending', deletion_requested_at = now(), updated_at = now()
      WHERE id = ${userId}
    `;
    await tx`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
    await tx`
      UPDATE memberships SET status = 'expired', auto_renew = false, cancel_at_period_end = true, updated_at = now()
      WHERE user_id = ${userId}
    `;
    await tx`
      INSERT INTO identity_deletion_jobs ${tx({ user_id: userId, supabase_user_id: supabaseUserId })}
      ON CONFLICT (user_id) DO NOTHING
    `;
    await tx`
      INSERT INTO audit_log ${tx({ actor_id: userId, action: "account_deletion_requested", target: userId, payload: tx.json({}) })}
    `;
  });
}

type DeleteIdentity = (supabaseUserId: string) => Promise<void>;

async function deleteSupabaseIdentity(supabaseUserId: string): Promise<void> {
  if (!config.supabaseServiceRoleKey || !config.supabaseUrl) throw new Error("Supabase identity deletion is not configured.");
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${supabaseUserId}`, {
    method: "DELETE",
    headers: { apikey: config.supabaseServiceRoleKey, authorization: `Bearer ${config.supabaseServiceRoleKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Supabase identity deletion returned HTTP ${response.status}.`);
}

export async function processIdentityDeletionJobs(limit = 20, deleteIdentity: DeleteIdentity = deleteSupabaseIdentity): Promise<number> {
  if (deleteIdentity === deleteSupabaseIdentity && (!config.supabaseServiceRoleKey || !config.supabaseUrl)) return 0;
  const jobs = await sql.begin(async (tx) => {
    const rows = await tx<{ id: string; user_id: string; supabase_user_id: string; attempt_count: number }[]>`
      SELECT id, user_id, supabase_user_id, attempt_count
      FROM identity_deletion_jobs
      WHERE (status IN ('pending', 'failed') AND next_attempt_at <= now())
         OR (status = 'processing' AND processing_started_at < now() - interval '5 minutes')
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    for (const row of rows) {
      await tx`
        UPDATE identity_deletion_jobs SET status = 'processing', processing_started_at = now(),
          attempt_count = attempt_count + 1, updated_at = now()
        WHERE id = ${row.id}
      `;
    }
    return rows;
  });

  for (const job of jobs) {
    try {
      await deleteIdentity(job.supabase_user_id);
      await sql.begin(async (tx) => {
        await tx`
          UPDATE identity_deletion_jobs SET status = 'completed', completed_at = now(),
            processing_started_at = NULL, last_error = NULL, updated_at = now()
          WHERE id = ${job.id}
        `;
        await tx`UPDATE users SET deletion_status = 'completed', updated_at = now() WHERE id = ${job.user_id}`;
      });
    } catch (error) {
      const attempts = job.attempt_count + 1;
      const dead = attempts >= 8;
      const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
      await sql.begin(async (tx) => {
        await tx`
          UPDATE identity_deletion_jobs SET status = ${dead ? "dead_letter" : "failed"},
            next_attempt_at = now() + (${delaySeconds} * interval '1 second'), processing_started_at = NULL,
            last_error = ${String(error instanceof Error ? error.message : error).slice(0, 500)}, updated_at = now()
          WHERE id = ${job.id}
        `;
        await tx`UPDATE users SET deletion_status = ${dead ? "failed" : "pending"}, updated_at = now() WHERE id = ${job.user_id}`;
      });
    }
  }
  return jobs.length;
}
