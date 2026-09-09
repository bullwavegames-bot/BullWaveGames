import { sql } from "../db.js";

export async function writeAudit(
  actorId: string | null,
  action: string,
  target: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await sql`
    INSERT INTO audit_log ${sql({
      actor_id: actorId,
      action,
      target,
      payload: sql.json(payload as never),
    })}
  `;
}
