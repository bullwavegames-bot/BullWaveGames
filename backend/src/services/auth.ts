import { sql } from "../db.js";
import { config } from "../config.js";
import { hashPassword, randomToken, sha256, validPassword, verifyPassword } from "../lib/crypto.js";
import { ApiError, badRequest, conflict, unauthorized } from "../lib/errors.js";
import { signAccessToken } from "../lib/jwt.js";
import { kolkataDateKey } from "../lib/kolkata.js";
import { sendMail } from "../mailer.js";
import { hitRateLimit } from "../lib/rate-limit.js";
import { findUserByEmail, findUserById, touchLoginStreak } from "./users.js";
import { ensureMembership, getMembership } from "./membership.js";
import { publicEntitlement, publicUser, type UserRow } from "../types.js";

const AVATARS = new Set(["kite", "lantern", "tide", "gharial", "rangoli", "fold"]);

function issueVerifyUrl(token: string): string {
  return `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

function issueResetUrl(token: string): string {
  return `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

async function issueEmailToken(userId: string, kind: "verify" | "reset"): Promise<string> {
  const token = randomToken();
  const ttl = kind === "verify" ? config.emailTokenTtlSec : config.resetTokenTtlSec;
  await sql`
    INSERT INTO email_tokens ${sql({
      user_id: userId,
      kind,
      token_hash: sha256(token),
      expires_at: new Date(Date.now() + ttl * 1000),
    })}
  `;
  return token;
}

async function issueRefresh(userId: string, familyId: string, ip?: string, userAgent?: string) {
  const token = randomToken();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO refresh_tokens ${sql({
      user_id: userId,
      family_id: familyId,
      token_hash: sha256(token),
      expires_at: new Date(Date.now() + config.refreshTokenTtlSec * 1000),
      ip: ip ?? null,
      user_agent: userAgent ?? null,
    })}
    RETURNING id
  `;
  return { token, id: rows[0].id };
}

async function sessionPayload(user: UserRow, ip?: string, userAgent?: string) {
  const familyId = crypto.randomUUID();
  const access = await signAccessToken(user.id, user.role);
  const refresh = await issueRefresh(user.id, familyId, ip, userAgent);
  const membership = await getMembership(user.id);
  await touchLoginStreak(user.id, kolkataDateKey());
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    expiresIn: config.accessTokenTtlSec,
    user: publicUser(user),
    entitlement: publicEntitlement(membership),
  };
}

export async function register(input: {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}) {
  await hitRateLimit(`rl:auth:register:${input.ip ?? "x"}`, 8, 15 * 60);
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw badRequest("Enter a valid email.");
  if (!validPassword(input.password)) {
    throw badRequest("Use 8+ characters with a letter and a number.");
  }
  if (await findUserByEmail(email)) {
    throw conflict("An account with this email already exists. Log in instead.", "EMAIL_TAKEN");
  }
  const displayName = email.split("@")[0] || "Player";
  const rows = await sql<UserRow[]>`
    INSERT INTO users ${sql({
      email,
      billing_email: email,
      password_hash: await hashPassword(input.password),
      display_name: displayName,
      avatar_id: "lantern",
    })}
    RETURNING *
  `;
  const user = rows[0];
  await ensureMembership(user.id);
  await sql`
    INSERT INTO user_cosmetics ${sql({ user_id: user.id, cosmetic_id: "frame-standard" })}
    ON CONFLICT DO NOTHING
  `;
  const token = await issueEmailToken(user.id, "verify");
  await sendMail(
    email,
    "Verify your Bullwave Games email",
    `Open this link to verify your email:\n${issueVerifyUrl(token)}\n\nIf you did not create an account, ignore this message.`,
  );
  return sessionPayload(user, input.ip, input.userAgent);
}

export async function login(input: { email: string; password: string; ip?: string; userAgent?: string }) {
  await hitRateLimit(`rl:auth:login:${input.ip ?? "x"}`, 12, 15 * 60);
  const user = await findUserByEmail(input.email.trim().toLowerCase());
  if (!user || !user.password_hash || !(await verifyPassword(user.password_hash, input.password))) {
    throw unauthorized("Email or password is incorrect.", "BAD_CREDENTIALS");
  }
  return sessionPayload(user, input.ip, input.userAgent);
}

export async function refresh(input: { refreshToken: string; ip?: string; userAgent?: string }) {
  const hash = sha256(input.refreshToken);
  const rows = await sql<
    {
      id: string;
      user_id: string;
      family_id: string;
      expires_at: Date;
      revoked_at: Date | null;
      replaced_by: string | null;
    }[]
  >`
    SELECT id, user_id, family_id, expires_at, revoked_at, replaced_by
    FROM refresh_tokens WHERE token_hash = ${hash} LIMIT 1
  `;
  const current = rows[0];
  if (!current) throw unauthorized("Session expired. Log in again.", "REFRESH_INVALID");

  if (current.revoked_at) {
    await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = ${current.family_id} AND revoked_at IS NULL`;
    throw unauthorized("This session was revoked. Log in again.", "REFRESH_REUSE");
  }
  if (current.expires_at.getTime() < Date.now()) {
    throw unauthorized("Session expired. Log in again.", "REFRESH_EXPIRED");
  }

  const next = await issueRefresh(current.user_id, current.family_id, input.ip, input.userAgent);
  await sql`
    UPDATE refresh_tokens
    SET revoked_at = now(), replaced_by = ${next.id}
    WHERE id = ${current.id}
  `;
  const user = await findUserById(current.user_id);
  if (!user) throw unauthorized("Session expired. Log in again.");
  const access = await signAccessToken(user.id, user.role);
  const membership = await getMembership(user.id);
  return {
    accessToken: access.token,
    refreshToken: next.token,
    expiresIn: config.accessTokenTtlSec,
    user: publicUser(user),
    entitlement: publicEntitlement(membership),
  };
}

export async function logout(refreshToken: string | undefined, userId: string) {
  if (refreshToken) {
    const hash = sha256(refreshToken);
    const rows = await sql<{ family_id: string }[]>`SELECT family_id FROM refresh_tokens WHERE token_hash = ${hash}`;
    if (rows[0]) {
      await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = ${rows[0].family_id} AND revoked_at IS NULL`;
      return;
    }
  }
  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
}

export async function requestVerify(userId: string, ip?: string) {
  await hitRateLimit(`rl:auth:verify:${userId}`, 3, 60);
  await hitRateLimit(`rl:auth:verify-ip:${ip ?? "x"}`, 10, 15 * 60);
  const user = await findUserById(userId);
  if (!user) throw unauthorized();
  if (user.email_verified_at) return { ok: true as const, already: true };
  const token = await issueEmailToken(user.id, "verify");
  await sendMail(user.email, "Verify your Bullwave Games email", `Open this link:\n${issueVerifyUrl(token)}`);
  return { ok: true as const, cooldown: 30 };
}

export async function verifyEmail(token: string) {
  const rows = await sql<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }[]>`
    SELECT id, user_id, expires_at, used_at FROM email_tokens
    WHERE token_hash = ${sha256(token)} AND kind = 'verify'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
    throw badRequest("This verification link is no longer valid.", "VERIFY_INVALID");
  }
  await sql`UPDATE email_tokens SET used_at = now() WHERE id = ${row.id}`;
  await sql`UPDATE users SET email_verified_at = now(), updated_at = now() WHERE id = ${row.user_id}`;
  const user = await findUserById(row.user_id);
  return { user: user ? publicUser(user) : null };
}

export async function requestReset(email: string, ip?: string) {
  await hitRateLimit(`rl:auth:reset:${ip ?? "x"}`, 6, 15 * 60);
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user) return;
  const token = await issueEmailToken(user.id, "reset");
  await sendMail(
    user.email,
    "Reset your Bullwave Games password",
    `Open this link to choose a new password:\n${issueResetUrl(token)}\n\nIf you did not ask for this, ignore the email.`,
  );
}

export async function resetPassword(token: string, password: string) {
  if (!validPassword(password)) throw badRequest("Use 8+ characters with a letter and a number.");
  const rows = await sql<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }[]>`
    SELECT id, user_id, expires_at, used_at FROM email_tokens
    WHERE token_hash = ${sha256(token)} AND kind = 'reset'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
    throw badRequest("This reset link is invalid or has expired.", "RESET_INVALID");
  }
  await sql`UPDATE email_tokens SET used_at = now() WHERE id = ${row.id}`;
  await sql`UPDATE users SET password_hash = ${await hashPassword(password)}, updated_at = now() WHERE id = ${row.user_id}`;
  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${row.user_id} AND revoked_at IS NULL`;
}

export async function changePassword(userId: string, current: string, next: string) {
  if (!validPassword(next)) throw badRequest("Use 8+ characters with a letter and a number.");
  const user = await findUserById(userId);
  if (!user) throw unauthorized();
  if (!user.password_hash || !(await verifyPassword(user.password_hash, current))) {
    throw unauthorized("Current password is incorrect.");
  }
  await sql`UPDATE users SET password_hash = ${await hashPassword(next)}, updated_at = now() WHERE id = ${userId}`;
  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
}

export async function updateMe(
  userId: string,
  patch: { displayName?: string; avatarId?: string; billingEmail?: string; autoRenew?: boolean; onboardingComplete?: boolean },
) {
  if ("role" in patch) throw new ApiError(400, "Role cannot be set.", "ROLE_LOCKED");
  const user = await findUserById(userId);
  if (!user) throw unauthorized();
  const displayName = patch.displayName?.trim() || user.display_name;
  if (displayName.length < 2) throw badRequest("Use at least two characters, or leave the default.");
  const avatarId = patch.avatarId ?? user.avatar_id;
  if (!AVATARS.has(avatarId)) throw badRequest("Unknown avatar.");
  const billingEmail = patch.billingEmail?.trim().toLowerCase() || user.billing_email;
  if (!billingEmail.includes("@")) throw badRequest("Enter a valid billing email.");
  const autoRenew = patch.autoRenew ?? user.auto_renew;
  const onboarding = patch.onboardingComplete ?? user.onboarding_complete;
  const rows = await sql<UserRow[]>`
    UPDATE users SET
      display_name = ${displayName},
      avatar_id = ${avatarId},
      billing_email = ${billingEmail},
      auto_renew = ${autoRenew},
      onboarding_complete = ${onboarding},
      updated_at = now()
    WHERE id = ${userId}
    RETURNING *
  `;
  if (typeof patch.autoRenew === "boolean") {
    await sql`UPDATE memberships SET auto_renew = ${patch.autoRenew}, updated_at = now() WHERE user_id = ${userId}`;
  }
  return publicUser(rows[0]);
}

export async function changeEmail(userId: string, email: string, ip?: string) {
  await hitRateLimit(`rl:auth:email:${userId}`, 4, 60 * 60);
  const next = email.trim().toLowerCase();
  if (!next.includes("@")) throw badRequest("Enter a valid email.");
  const existing = await findUserByEmail(next);
  if (existing && existing.id !== userId) throw conflict("That email is already in use.");
  await sql`
    UPDATE users SET email = ${next}, email_verified_at = NULL, updated_at = now() WHERE id = ${userId}
  `;
  const token = await issueEmailToken(userId, "verify");
  await sendMail(next, "Verify your Bullwave Games email", `Open this link:\n${issueVerifyUrl(token)}`);
}

export async function deleteAccount(userId: string) {
  await sql`UPDATE users SET deleted_at = now(), email = ('deleted+' || id::text || '@invalid.local')::citext, updated_at = now() WHERE id = ${userId}`;
  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
  await sql`UPDATE memberships SET status = 'expired', plan_id = NULL, razorpay_subscription_id = NULL, updated_at = now() WHERE user_id = ${userId}`;
}
