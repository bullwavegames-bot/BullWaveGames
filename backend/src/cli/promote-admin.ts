import "dotenv/config";
import { sql } from "../db.js";
import { writeAudit } from "../services/audit.js";
import { logger } from "../logger.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run promote-admin -- user@example.com");
  process.exit(1);
}

const rows = await sql<{ id: string; role: string }[]>`
  UPDATE users SET role = 'admin', updated_at = now()
  WHERE email = ${email.toLowerCase()} AND deleted_at IS NULL
  RETURNING id, role
`;
if (!rows[0]) {
  logger.error("No user with that email");
  process.exit(1);
}
await writeAudit(null, "role_change", rows[0].id, { email, role: "admin", via: "cli" });
logger.info({ email, id: rows[0].id }, "promoted to admin");
await sql.end();
