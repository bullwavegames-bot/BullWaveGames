import assert from 'node:assert/strict';
if (!process.env.TEST_DATABASE_URL || !process.env.TEST_REDIS_URL) {
  throw new Error('Set TEST_DATABASE_URL and TEST_REDIS_URL to isolated test services.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL;
const { sql } = await import('../dist/backend/src/db.js');
const { redis, redisSub } = await import('../dist/backend/src/redis.js');
const { saveGame } = await import('../dist/backend/src/services/admin.js');
const marker = crypto.randomUUID();
let actorId, gameId;
try {
  const actors = await sql`INSERT INTO users (email, billing_email, password_hash, display_name, role)
    VALUES (${`${marker}@example.test`}, ${`${marker}@example.test`}, 'test', 'Test Admin', 'admin') RETURNING id`;
  actorId = actors[0].id;
  const slug = `test-${marker}`;
  const created = await saveGame(actorId, { slug, title: 'Original', published: false, memberAccess: false, coverAlt: 'Original alt' });
  gameId = created.id;
  await saveGame(actorId, { slug, title: 'Changed' });
  const [preserved] = await sql`SELECT * FROM games WHERE id = ${gameId}`;
  assert.equal(preserved.title, 'Changed');
  assert.equal(preserved.published, false);
  assert.equal(preserved.member_access, false);
  assert.equal(preserved.cover_alt, 'Original alt');
  await saveGame(actorId, { slug, memberAccess: true, coverAlt: 'New alt', unsupportedNote: 'Unavailable', isNew: true });
  await saveGame(actorId, { slug, unsupportedNote: null });
  const [updated] = await sql`SELECT * FROM games WHERE id = ${gameId}`;
  assert.equal(updated.member_access, true);
  assert.equal(updated.cover_alt, 'New alt');
  assert.equal(updated.is_new, true);
  assert.equal(updated.unsupported_note, null);
  assert.equal(updated.published, false);
  console.log('catalog-edit: passed');
} finally {
  if (actorId) await sql`DELETE FROM audit_log WHERE actor_id = ${actorId}`;
  if (gameId) {
    await sql`DELETE FROM game_score_rules WHERE game_id = ${gameId}`;
    await sql`DELETE FROM games WHERE id = ${gameId}`;
  }
  if (actorId) await sql`DELETE FROM users WHERE id = ${actorId}`;
  await sql.end();
  redis.disconnect();
  redisSub.disconnect();
}
