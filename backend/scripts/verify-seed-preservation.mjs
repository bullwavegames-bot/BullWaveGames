import { sql } from "../dist/backend/src/db.js";
import { seed } from "../dist/backend/src/sql/seed.js";

const slug = "kite-line";
const marker = `Phase 1 seed preservation ${Date.now()}`;
let original;

try {
  const before = await sql`SELECT title FROM games WHERE slug = ${slug}`;
  if (!before[0]) throw new Error("Seeded verification game is missing.");
  original = before[0].title;
  await sql`UPDATE games SET title = ${marker} WHERE slug = ${slug}`;
  await seed();
  const after = await sql`SELECT title FROM games WHERE slug = ${slug}`;
  if (after[0]?.title !== marker) throw new Error("Catalog seed overwrote an administrator edit.");
  process.stdout.write("seed-preservation: passed\n");
} finally {
  if (original !== undefined) await sql`UPDATE games SET title = ${original} WHERE slug = ${slug}`;
  await sql.end();
}
