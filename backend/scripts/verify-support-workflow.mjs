import assert from 'node:assert/strict';

// Never run this verifier against an implicitly configured application database.
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to an isolated migrated test database.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { sql } = await import('../dist/backend/src/db.js');
const { createTicket, updateTicket } = await import('../dist/backend/src/services/admin.js');
const marker = crypto.randomUUID();
let adminId, memberId, ticketId;
try {
  const rows = await sql`INSERT INTO users (email, billing_email, password_hash, display_name, role)
    VALUES (${`support-admin-${marker}@example.test`}, ${`support-admin-${marker}@example.test`}, 'test', 'Test Admin', 'admin'),
           (${`support-member-${marker}@example.test`}, ${`support-member-${marker}@example.test`}, 'test', 'Test Member', 'player')
    RETURNING id, role`;
  adminId = rows.find(row => row.role === 'admin').id;
  memberId = rows.find(row => row.role !== 'admin').id;
  ticketId = await createTicket({ userId: memberId, name: 'Test', email: 'test@example.test', topic: 'billing', message: 'Test workflow' });
  await assert.rejects(updateTicket(adminId, ticketId, { status: 'resolved' }));
  await assert.rejects(updateTicket(adminId, ticketId, { status: 'in_progress', assignedTo: memberId }));
  const assigned = await updateTicket(adminId, ticketId, { status: 'in_progress', assignedTo: adminId });
  assert.equal(assigned.assigned_to, adminId);
  const resolved = await updateTicket(adminId, ticketId, { status: 'resolved', resolution: 'Verified correction' });
  assert.equal(resolved.resolution, 'Verified correction');
  assert.ok(resolved.resolved_at);
  assert.equal(resolved.assigned_to, adminId);
  const reopened = await updateTicket(adminId, ticketId, { status: 'open', assignedTo: null });
  assert.equal(reopened.resolved_at, null);
  assert.equal(reopened.resolution, null);
  assert.equal(reopened.assigned_to, null);
  const audits = await sql`SELECT * FROM audit_log WHERE target = ${ticketId} AND action = 'support_ticket_update'`;
  assert.equal(audits.length, 3);
  console.log('support-workflow: passed');
} finally {
  if (ticketId) {
    await sql`DELETE FROM audit_log WHERE target = ${ticketId}`;
    await sql`DELETE FROM support_tickets WHERE id = ${ticketId}`;
  }
  if (adminId) await sql`DELETE FROM users WHERE id = ${adminId}`;
  if (memberId) await sql`DELETE FROM users WHERE id = ${memberId}`;
  await sql.end();
}
