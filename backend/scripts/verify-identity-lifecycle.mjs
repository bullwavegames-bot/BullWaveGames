import crypto from "node:crypto";
import { sql } from "../dist/backend/src/db.js";
import { hashPassword } from "../dist/backend/src/lib/crypto.js";
import { provisionSupabaseUser } from "../dist/backend/src/services/users.js";
import {
  createLegacyMigrationTicket,
  linkLegacyIdentity,
  requestSupabaseAccountDeletion,
  processIdentityDeletionJobs,
} from "../dist/backend/src/services/identity.js";

const legacyId = crypto.randomUUID();
const supabaseId = crypto.randomUUID();
const email = `phase2-${legacyId}@example.test`;
const password = "Migration-test-123";
const profileTable = await sql`
  SELECT to_regclass('public.profiles') IS NOT NULL AS exists
`;
const createdProfileTable = !profileTable[0]?.exists;

try {
  if (createdProfileTable) {
    await sql.unsafe(`
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY,
        email citext,
        display_name text NOT NULL,
        avatar_id text NOT NULL DEFAULT 'lantern',
        onboarding_complete boolean NOT NULL DEFAULT false,
        role text NOT NULL DEFAULT 'player'
      )
    `);
  }
  await sql`
    INSERT INTO users ${sql({
      id: legacyId,
      email,
      billing_email: email,
      password_hash: await hashPassword(password),
      display_name: "Legacy player",
      avatar_id: "lantern",
      email_verified_at: new Date(),
    })}
  `;
  await sql`
    INSERT INTO public.profiles (id, email, display_name, avatar_id, onboarding_complete, role)
    VALUES (${supabaseId}, ${email}, 'Supabase player', 'kite', true, 'player')
  `;

  const issued = await createLegacyMigrationTicket(email, password, "127.0.0.1");
  const linked = await linkLegacyIdentity(issued.migrationTicket, { sub: supabaseId, email, iat: Math.floor(Date.now() / 1000) });
  if (linked.id !== legacyId || linked.supabase_user_id !== supabaseId || linked.password_hash !== null) {
    throw new Error("Legacy identity was not linked correctly.");
  }
  let replayRejected = false;
  try {
    await linkLegacyIdentity(issued.migrationTicket, { sub: supabaseId, email });
  } catch {
    replayRejected = true;
  }
  if (!replayRejected) throw new Error("Migration ticket replay was accepted.");

  await requestSupabaseAccountDeletion(legacyId, supabaseId);
  const state = await sql`
    SELECT deletion_status, deleted_at, email::text FROM users WHERE id = ${legacyId}
  `;
  const jobs = await sql`SELECT status FROM identity_deletion_jobs WHERE user_id = ${legacyId}`;
  if (state[0]?.deletion_status !== "pending" || !state[0].deleted_at || !state[0].email.startsWith("deleted+")) {
    throw new Error("Account was not anonymized and marked pending.");
  }
  if (jobs[0]?.status !== "pending") throw new Error("Identity deletion job was not queued.");
  let deletedSubjectRejected = false;
  try {
    await provisionSupabaseUser({ sub: supabaseId, email });
  } catch (error) {
    deletedSubjectRejected = error?.code === "ACCOUNT_DELETED";
  }
  if (!deletedSubjectRejected) throw new Error("A deleted Supabase subject was reprovisioned.");
  await processIdentityDeletionJobs(20, async () => {
    throw new Error("simulated Supabase outage");
  });
  const failed = await sql`SELECT status, attempt_count FROM identity_deletion_jobs WHERE user_id = ${legacyId}`;
  if (failed[0]?.status !== "failed" || failed[0]?.attempt_count !== 1) {
    throw new Error("Identity deletion failure was not scheduled for retry.");
  }
  await sql`UPDATE identity_deletion_jobs SET next_attempt_at = now() WHERE user_id = ${legacyId}`;
  await processIdentityDeletionJobs(20, async (subject) => {
    if (subject !== supabaseId) throw new Error("Deletion worker received the wrong Supabase identity.");
  });
  const completed = await sql`SELECT status FROM identity_deletion_jobs WHERE user_id = ${legacyId}`;
  const completedUser = await sql`SELECT deletion_status FROM users WHERE id = ${legacyId}`;
  if (completed[0]?.status !== "completed" || completedUser[0]?.deletion_status !== "completed") {
    throw new Error("Identity deletion job did not complete.");
  }
  process.stdout.write("identity-lifecycle: passed\n");
} finally {
  await sql`DELETE FROM audit_log WHERE actor_id = ${legacyId}`;
  await sql`DELETE FROM identity_deletion_jobs WHERE user_id = ${legacyId}`;
  await sql`DELETE FROM users WHERE id = ${legacyId}`;
  if (!createdProfileTable) await sql`DELETE FROM public.profiles WHERE id = ${supabaseId}`;
  if (createdProfileTable) await sql`DROP TABLE public.profiles`;
  await sql.end();
}
