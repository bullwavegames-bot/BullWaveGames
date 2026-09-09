import { sql } from "../db.js";
import type { UserRow } from "../types.js";

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
