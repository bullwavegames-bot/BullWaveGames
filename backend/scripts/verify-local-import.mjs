import assert from 'node:assert/strict';
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to an isolated migrated and seeded database.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { sql } = await import('../dist/backend/src/db.js');
const { importLocalSaves } = await import('../dist/backend/src/services/localImport.js');
let userId;
try {
  const [user] = await sql`INSERT INTO users (email, password_hash, display_name)
    VALUES (${`${crypto.randomUUID()}@example.test`}, 'test', 'Import Test') RETURNING id`;
  userId = user.id;
  const games = await sql`SELECT id, slug FROM games ORDER BY slug LIMIT 2`;
  assert.equal(games.length, 2, 'Seed at least two games.');
  await assert.rejects(importLocalSaves(userId, { saves: [
    { slug: games[0].slug, payload: { level: 1 } },
    { slug: 'missing-import-game', payload: {} },
  ] }));
  assert.equal((await sql`SELECT * FROM game_saves WHERE user_id = ${userId}`).length, 0);
  assert.equal((await sql`SELECT * FROM local_save_imports WHERE user_id = ${userId}`).length, 0);
  await sql`INSERT INTO game_saves (user_id, game_id, payload, label)
    VALUES (${userId}, ${games[0].id}, '{"level":9}', 'Server save')`;
  const input = { saves: games.map(game => ({ slug: game.slug, payload: { level: 2 } })), cosmetics: ['unearned'] };
  const outcomes = await Promise.allSettled([importLocalSaves(userId, input), importLocalSaves(userId, input)]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  const success = outcomes.find(result => result.status === 'fulfilled');
  assert.deepEqual(success.value, { saves: 1, cosmetics: 0 });
  const failure = outcomes.find(result => result.status === 'rejected');
  assert.equal(failure.reason.code, 'ALREADY_IMPORTED');
  const [preserved] = await sql`SELECT payload, label FROM game_saves WHERE user_id = ${userId} AND game_id = ${games[0].id}`;
  assert.deepEqual(preserved.payload, { level: 9 });
  assert.equal(preserved.label, 'Server save');
  assert.equal((await sql`SELECT * FROM user_cosmetics WHERE user_id = ${userId}`).length, 0);
  console.log('local-import: passed');
} finally {
  if (userId) await sql`DELETE FROM users WHERE id = ${userId}`;
  await sql.end();
}
