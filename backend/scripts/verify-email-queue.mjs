import assert from 'node:assert/strict';
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to an isolated migrated database.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { sql } = await import('../dist/backend/src/db.js');
const { processEmailJobs } = await import('../dist/backend/src/mailer.js');
const subject = `queue-test-${crypto.randomUUID()}`;
try {
  const [job] = await sql`INSERT INTO email_outbox (recipient, subject, body)
    VALUES ('test@example.test', ${subject}, 'secret test link') RETURNING id`;
  await processEmailJobs(async () => { throw new Error('simulated outage'); });
  const [failed] = await sql`SELECT * FROM email_outbox WHERE id = ${job.id}`;
  assert.equal(failed.status, 'failed');
  assert.equal(failed.attempt_count, 1);
  assert.ok(new Date(failed.next_attempt_at) > new Date(failed.created_at));
  await sql`UPDATE email_outbox SET next_attempt_at = now() WHERE id = ${job.id}`;
  const delivered = [];
  await Promise.all([processEmailJobs(async message => { delivered.push(message); }),
    processEmailJobs(async message => { delivered.push(message); })]);
  assert.equal(delivered.filter(message => message.subject === subject).length, 1);
  const [completed] = await sql`SELECT * FROM email_outbox WHERE id = ${job.id}`;
  assert.equal(completed.status, 'completed');
  assert.equal(completed.body, '');
  assert.equal(completed.recipient, '');
  await sql`INSERT INTO email_outbox (recipient, subject, body, expires_at)
    VALUES ('test@example.test', ${subject}, 'expired link', now() - interval '1 second')`;
  await processEmailJobs(async () => { throw new Error('Expired mail must not be sent'); });
  const expired = await sql`SELECT * FROM email_outbox WHERE subject = ${subject} AND status = 'dead_letter'`;
  assert.equal(expired.length, 1);
  assert.equal(expired[0].body, '');
  console.log('email-queue: passed');
} finally {
  await sql`DELETE FROM email_outbox WHERE subject = ${subject}`;
  await sql.end();
}
