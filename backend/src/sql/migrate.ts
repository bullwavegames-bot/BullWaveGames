import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "../db.js";
import { logger } from "../logger.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

export async function migrate(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  const applied = await sql<{ id: string }[]>`SELECT id FROM schema_migrations`;
  const done = new Set(applied.map((row) => row.id));
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
    });
    logger.info({ file }, "migration applied");
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("migrate.ts")) {
  migrate()
    .then(() => sql.end())
    .catch((error) => {
      logger.error(error, "migration failed");
      process.exit(1);
    });
}
