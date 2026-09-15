import { z } from 'zod';
import { sql } from '../db.js';
import { conflict, notFound } from '../lib/errors.js';

export const localImportSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  saves: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
    label: z.string().trim().min(1).max(120).optional(),
    payload: z.record(z.unknown()),
  }).strict()).max(100).optional(),
  // Accepted for compatibility, never trusted as proof of ownership.
  cosmetics: z.array(z.string().max(120)).max(100).optional(),
}).strict().refine(value => new Set(value.saves?.map(save => save.slug)).size === (value.saves?.length ?? 0),
  'Each game may be imported only once.');

export async function importLocalSaves(userId: string, input: z.infer<typeof localImportSchema>) {
  return sql.begin(async tx => {
    const claimed = await tx`INSERT INTO local_save_imports (user_id) VALUES (${userId})
      ON CONFLICT DO NOTHING RETURNING user_id`;
    if (!claimed[0]) throw conflict('Local saves have already been imported.', 'ALREADY_IMPORTED');
    let imported = 0;
    for (const save of input.saves ?? []) {
      const games = await tx`SELECT id FROM games WHERE slug = ${save.slug}`;
      if (!games[0]) throw notFound(`Unknown game: ${save.slug}`);
      const inserted = await tx`INSERT INTO game_saves (user_id, game_id, payload, label)
        VALUES (${userId}, ${games[0].id}, ${tx.json(save.payload as never)}, ${save.label ?? 'Imported save'})
        ON CONFLICT (user_id, game_id) DO NOTHING RETURNING game_id`;
      imported += inserted.length;
    }
    if (input.displayName) await tx`UPDATE users SET display_name = ${input.displayName}, updated_at = now() WHERE id = ${userId}`;
    return { saves: imported, cosmetics: 0 };
  });
}
