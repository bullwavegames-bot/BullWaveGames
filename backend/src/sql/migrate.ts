import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "../db.js";
import { logger } from "../logger.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

export async function migrate(): Promise<void> {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('bullwave_schema_migrations'))`;
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
    const applied = await tx<{ id: string }[]>`SELECT id FROM schema_migrations`;
    const done = new Set(applied.map((row) => row.id));
    for (const file of files) {
      if (done.has(file)) continue;
      const body = await readFile(path.join(dir, file), "utf8");
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
      logger.info({ file }, "migration applied");
    }
  });
}

const entrypoint = path.basename(process.argv[1] ?? "");
if (entrypoint === "migrate.ts" || entrypoint === "migrate.js") {
  migrate()
    .then(() => sql.end())
    .catch((error) => {
      logger.error(error, "migration failed");
      process.exit(1);
    });
}
