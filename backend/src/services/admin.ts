import { sql } from "../db.js";
import { badRequest, notFound } from "../lib/errors.js";
import { writeAudit } from "./audit.js";
import { activateMembership, expireMembership } from "./membership.js";
import type { PlanId } from "../types.js";
import { invalidateCatalog } from "./catalog.js";

export async function adminStats() {
  const members = await sql<{ n: string }[]>`
    SELECT count(*)::text AS n FROM memberships
    WHERE status IN ('active', 'active_until', 'past_due')
      AND (
        (status IN ('active', 'active_until') AND access_end > now())
        OR (status = 'past_due' AND grace_end > now())
      )
  `;
  const failed = await sql<{ n: string }[]>`
    SELECT count(*)::text AS n FROM invoices WHERE status = 'failed'
  `;
  const games = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM games WHERE published`;
  const tickets = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM support_tickets`;
  return {
    activeMembers: Number(members[0]?.n ?? 0),
    failedPayments: Number(failed[0]?.n ?? 0),
    publishedGames: Number(games[0]?.n ?? 0),
    tickets: Number(tickets[0]?.n ?? 0),
  };
}

export async function listMembers(q: string, page = 1, pageSize = 50) {
  const like = `%${q.toLowerCase()}%`;
  const rows = await sql`
    SELECT u.id, u.email, u.display_name, u.role, u.created_at,
           m.plan_id, m.status, m.access_end, m.source
    FROM users u
    LEFT JOIN memberships m ON m.user_id = u.id
    WHERE u.deleted_at IS NULL
      AND (${q} = '' OR u.email ILIKE ${like} OR u.id::text ILIKE ${like})
    ORDER BY u.created_at DESC
    OFFSET ${(page - 1) * pageSize}
    LIMIT ${pageSize}
  `;
  return rows;
}

export async function memberDetail(id: string) {
  const users = await sql`
    SELECT id, email, billing_email, display_name, role, created_at, email_verified_at, auto_renew
    FROM users WHERE id = ${id} AND deleted_at IS NULL
  `;
  if (!users[0]) throw notFound("Missing member.");
  const membership = await sql`SELECT * FROM memberships WHERE user_id = ${id}`;
  const invoices = await sql`
    SELECT id, created_at, plan_id, amount_paise, status FROM invoices
    WHERE user_id = ${id} ORDER BY created_at DESC LIMIT 20
  `;
  return { user: users[0], membership: membership[0] ?? null, invoices };
}

export async function grantPlan(
  actorId: string,
  userId: string,
  planId: PlanId,
  days: number,
  reason: string,
) {
  if (!reason.trim()) throw badRequest("Reason is required.");
  if (days < 1 || days > 366) throw badRequest("Grant days must be between 1 and 366.");
  await activateMembership({
    userId,
    planId,
    interval: "monthly",
    source: "admin_grant",
    days,
    autoRenew: false,
    grantedBy: actorId,
  });
  await writeAudit(actorId, "grant_membership", userId, { planId, days, reason });
}

export async function revokePlan(actorId: string, userId: string, reason: string) {
  if (!reason.trim()) throw badRequest("Reason is required.");
  await expireMembership(userId);
  await sql`
    UPDATE memberships SET plan_id = NULL, source = 'none', razorpay_subscription_id = NULL, updated_at = now()
    WHERE user_id = ${userId}
  `;
  await writeAudit(actorId, "revoke_membership", userId, { reason });
}

export async function saveGame(actorId: string, body: Record<string, unknown>) {
  const slug = String(body.slug ?? "").trim();
  if (!slug) throw badRequest("slug is required.");
  const row = {
    slug,
    title: String(body.title ?? slug),
    genre: String(body.genre ?? "Puzzle"),
    session_minutes: Number(body.sessionMinutes ?? body.session_minutes ?? 5),
    fantasy: String(body.fantasy ?? ""),
    description: String(body.description ?? ""),
    how_to_play: sql.json((body.howToPlay ?? body.how_to_play ?? []) as never),
    cover: String(body.cover ?? ""),
    cover_alt: String(body.coverAlt ?? body.cover_alt ?? ""),
    preview_alt: String(body.previewAlt ?? body.preview_alt ?? ""),
    controls: sql.json((body.controls ?? { desktop: [], touch: [] }) as never),
    member_access: Boolean(body.memberAccess ?? body.member_access ?? true),
    rotation_eligible: Boolean(body.rotationEligible ?? body.rotation_eligible ?? true),
    published: Boolean(body.published ?? true),
    maintenance: Boolean(body.maintenance ?? false),
    is_new: Boolean(body.isNew ?? body.is_new ?? false),
    unsupported_note: body.unsupportedNote ? String(body.unsupportedNote) : null,
  };
  const saved = await sql<{ id: string }[]>`
    INSERT INTO games ${sql(row)}
    ON CONFLICT (slug) DO UPDATE SET
      title = CASE WHEN ${body.title !== undefined} THEN EXCLUDED.title ELSE games.title END,
      genre = CASE WHEN ${body.genre !== undefined} THEN EXCLUDED.genre ELSE games.genre END,
      session_minutes = CASE WHEN ${body.sessionMinutes !== undefined || body.session_minutes !== undefined} THEN EXCLUDED.session_minutes ELSE games.session_minutes END,
      fantasy = CASE WHEN ${body.fantasy !== undefined} THEN EXCLUDED.fantasy ELSE games.fantasy END,
      description = CASE WHEN ${body.description !== undefined} THEN EXCLUDED.description ELSE games.description END,
      how_to_play = CASE WHEN ${body.howToPlay !== undefined || body.how_to_play !== undefined} THEN EXCLUDED.how_to_play ELSE games.how_to_play END,
      cover = CASE WHEN ${body.cover !== undefined} THEN EXCLUDED.cover ELSE games.cover END,
      cover_alt = CASE WHEN ${body.coverAlt !== undefined || body.cover_alt !== undefined} THEN EXCLUDED.cover_alt ELSE games.cover_alt END,
      preview_alt = CASE WHEN ${body.previewAlt !== undefined || body.preview_alt !== undefined} THEN EXCLUDED.preview_alt ELSE games.preview_alt END,
      controls = CASE WHEN ${body.controls !== undefined} THEN EXCLUDED.controls ELSE games.controls END,
      member_access = CASE WHEN ${body.memberAccess !== undefined || body.member_access !== undefined} THEN EXCLUDED.member_access ELSE games.member_access END,
      rotation_eligible = CASE WHEN ${body.rotationEligible !== undefined || body.rotation_eligible !== undefined} THEN EXCLUDED.rotation_eligible ELSE games.rotation_eligible END,
      published = CASE WHEN ${body.published !== undefined} THEN EXCLUDED.published ELSE games.published END,
      maintenance = CASE WHEN ${body.maintenance !== undefined} THEN EXCLUDED.maintenance ELSE games.maintenance END,
      is_new = CASE WHEN ${body.isNew !== undefined || body.is_new !== undefined} THEN EXCLUDED.is_new ELSE games.is_new END,
      unsupported_note = CASE WHEN ${body.unsupportedNote !== undefined} THEN EXCLUDED.unsupported_note ELSE games.unsupported_note END,
      updated_at = now()
    RETURNING id
  `;
  await sql`
    INSERT INTO game_score_rules ${sql({
      game_id: saved[0].id,
      min_score: 0,
      max_score: 1000000,
      min_duration_ms: 2500,
      max_duration_ms: Number(row.session_minutes) * 60 * 1000 * 3,
    })}
    ON CONFLICT (game_id) DO NOTHING
  `;
  await writeAudit(actorId, "game_publish", saved[0].id, { slug });
  await invalidateCatalog();
  return { id: saved[0].id, slug };
}

export async function listGamesAdmin() {
  return sql`SELECT * FROM games ORDER BY title`;
}

export async function listNotes() {
  return sql`SELECT * FROM content_notes ORDER BY updated_at DESC`;
}

export async function saveNote(actorId: string, note: { id?: string; title: string; type: string; status: string; body: string }) {
  if (note.id) {
    await sql`
      UPDATE content_notes SET
        title = ${note.title}, type = ${note.type}, status = ${note.status}, body = ${note.body}, updated_at = now()
      WHERE id = ${note.id}
    `;
    await writeAudit(actorId, "content_update", note.id, { title: note.title });
    return { id: note.id };
  }
  const rows = await sql<{ id: string }[]>`
    INSERT INTO content_notes ${sql({ title: note.title, type: note.type, status: note.status, body: note.body })}
    RETURNING id
  `;
  await writeAudit(actorId, "content_create", rows[0].id, { title: note.title });
  return { id: rows[0].id };
}

export async function listTickets() {
  return sql`SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 100`;
}

export async function updateTicket(actorId: string, id: string, input: {
  status: 'open' | 'in_progress' | 'resolved';
  assignedTo?: string | null;
  resolution?: string;
}) {
  if (input.status === 'resolved' && !input.resolution?.trim()) {
    throw badRequest('A resolution is required.');
  }
  return sql.begin(async (tx) => {
    const existing = await tx`SELECT id FROM support_tickets WHERE id = ${id} FOR UPDATE`;
    if (!existing[0]) throw notFound('Missing support ticket.');
    if (input.assignedTo) {
      const admins = await tx`SELECT id FROM users WHERE id = ${input.assignedTo} AND role = 'admin' AND deleted_at IS NULL FOR SHARE`;
      if (!admins[0]) throw badRequest('Assign tickets to an active administrator.');
    }
    const rows = await tx`
      UPDATE support_tickets SET status = ${input.status},
        assigned_to = CASE WHEN ${input.assignedTo !== undefined} THEN ${input.assignedTo ?? null}::uuid ELSE assigned_to END,
        resolution = ${input.status === 'resolved' ? input.resolution!.trim() : null},
        resolved_at = CASE WHEN ${input.status === 'resolved'} THEN now() ELSE NULL END,
        updated_at = now()
      WHERE id = ${id} RETURNING *
    `;
    await tx`INSERT INTO audit_log (actor_id, action, target, payload)
      VALUES (${actorId}, 'support_ticket_update', ${id}, ${tx.json({ status: input.status, assignedTo: rows[0].assigned_to })})`;
    return rows[0];
  });
}

export async function createTicket(input: {
  userId?: string | null;
  name: string;
  email: string;
  topic: string;
  message: string;
  paymentRef?: string;
}) {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO support_tickets ${sql({
      user_id: input.userId ?? null,
      name: input.name,
      email: input.email.toLowerCase(),
      topic: input.topic,
      message: input.message,
      payment_ref: input.paymentRef ?? null,
    })}
    RETURNING id
  `;
  return rows[0].id;
}
