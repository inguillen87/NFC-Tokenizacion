import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(url);
const migrationsDir = path.join(process.cwd(), "db", "migrations");
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

await sql(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const appliedRows = await sql`SELECT id FROM schema_migrations`;
const applied = new Set(appliedRows.map((r) => r.id));

for (const file of files) {
  if (applied.has(file)) continue;
  const body = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  console.log(`Applying ${file}...`);
  await sql(body);
  await sql`INSERT INTO schema_migrations (id) VALUES (${file})`;
}

console.log("Migrations up to date.");
