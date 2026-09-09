import { sql } from "../db.js";

type Rule = { type: string; game?: string; n?: number };

export async function evaluateAchievements(userId: string, slug: string, score: number): Promise<string[]> {
  const defs = await sql<{ id: string; title: string; rule: Rule; cosmetic_id: string | null }[]>`
    SELECT id, title, rule, cosmetic_id FROM achievement_defs
  `;
  const unlocked: string[] = [];
  for (const def of defs) {
    const rule = def.rule;
    let ok = false;
    if (rule.type === "accepted_play" && rule.game === slug) ok = true;
    if (rule.type === "min_score" && rule.game === slug && score >= (rule.n ?? 0)) ok = true;
    if (rule.type === "plays" && rule.game) {
      const count = await sql<{ n: string }[]>`
        SELECT count(*)::text AS n
        FROM score_events e JOIN games g ON g.id = e.game_id
        WHERE e.user_id = ${userId} AND e.accepted AND g.slug = ${rule.game}
      `;
      ok = Number(count[0]?.n ?? 0) >= (rule.n ?? 1);
    }
    if (!ok) continue;
    const inserted = await sql<{ achievement_id: string }[]>`
      INSERT INTO user_achievements ${sql({ user_id: userId, achievement_id: def.id, evidence: sql.json({ slug, score }) })}
      ON CONFLICT DO NOTHING
      RETURNING achievement_id
    `;
    if (inserted[0]) {
      unlocked.push(def.id);
      if (def.cosmetic_id) {
        await sql`
          INSERT INTO user_cosmetics ${sql({ user_id: userId, cosmetic_id: def.cosmetic_id })}
          ON CONFLICT DO NOTHING
        `;
      }
    }
  }
  return unlocked;
}

export async function listAchievements(userId: string) {
  return sql`
    SELECT a.id, a.title, u.earned_at
    FROM user_achievements u
    JOIN achievement_defs a ON a.id = u.achievement_id
    WHERE u.user_id = ${userId}
    ORDER BY u.earned_at DESC
  `;
}
