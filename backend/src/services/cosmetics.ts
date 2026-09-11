import { sql } from "../db.js";
import { forbidden } from "../lib/errors.js";

export type LoadoutInput = { frameId?: string | null; themeId?: string | null; badgeId?: string | null };
type Loadout = { frame_id: string | null; theme_id: string | null; badge_id: string | null };

export function resolveLoadout(current: Loadout | undefined, input: LoadoutInput) {
  return {
    frame_id: input.frameId === undefined ? current?.frame_id ?? null : input.frameId,
    theme_id: input.themeId === undefined ? current?.theme_id ?? null : input.themeId,
    badge_id: input.badgeId === undefined ? current?.badge_id ?? null : input.badgeId,
  };
}

export async function cosmeticsForUser(userId: string) {
  const [owned, loadout] = await Promise.all([
    sql`
      SELECT c.id, c.kind, c.name, c.requirement, c.artwork, u.owned_at
      FROM user_cosmetics u JOIN cosmetics c ON c.id = u.cosmetic_id
      WHERE u.user_id = ${userId} ORDER BY c.kind, c.name
    `,
    sql<Loadout[]>`SELECT frame_id, theme_id, badge_id FROM user_loadout WHERE user_id = ${userId}`,
  ]);
  return { owned, equipped: loadout[0] ?? { frame_id: null, theme_id: null, badge_id: null } };
}

export async function equipCosmetics(userId: string, input: LoadoutInput) {
  const currentRows = await sql<Loadout[]>`SELECT frame_id, theme_id, badge_id FROM user_loadout WHERE user_id = ${userId}`;
  const target = resolveLoadout(currentRows[0], input);
  const requested = [
    [target.frame_id, "frame"],
    [target.theme_id, "theme"],
    [target.badge_id, "badge"],
  ].filter((item): item is [string, string] => typeof item[0] === "string");
  if (requested.length) {
    const ids = requested.map(([id]) => id);
    const owned = await sql<{ id: string; kind: string }[]>`
      SELECT c.id, c.kind FROM user_cosmetics u JOIN cosmetics c ON c.id = u.cosmetic_id
      WHERE u.user_id = ${userId} AND c.id IN ${sql(ids)}
    `;
    const kinds = new Map(owned.map((item) => [item.id, item.kind]));
    if (requested.some(([id, kind]) => kinds.get(id) !== kind)) throw forbidden("You can equip only cosmetics you own.", "COSMETIC_NOT_OWNED");
  }
  await sql`
    INSERT INTO user_loadout ${sql({ user_id: userId, ...target })}
    ON CONFLICT (user_id) DO UPDATE SET
      frame_id = EXCLUDED.frame_id, theme_id = EXCLUDED.theme_id, badge_id = EXCLUDED.badge_id
  `;
  return cosmeticsForUser(userId);
}
