import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: node scripts/db-apply-file.mjs <migration-file>");
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), "db", "migrations");
const file = path.basename(fileArg);
const fullPath = path.join(migrationsDir, file);

if (!fs.existsSync(fullPath)) {
  console.error(`Migration not found: ${fullPath}`);
  process.exit(1);
}

const sql = neon(url);

await sql(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const appliedRows = await sql`SELECT id FROM schema_migrations WHERE id = ${file} LIMIT 1`;
if (appliedRows[0]) {
  console.log(JSON.stringify({ ok: true, skipped: true, migration: file }));
  process.exit(0);
}

const body = fs.readFileSync(fullPath, "utf8");
await sql(body);
await sql`INSERT INTO schema_migrations (id) VALUES (${file}) ON CONFLICT (id) DO NOTHING`;

console.log(JSON.stringify({ ok: true, applied: true, migration: file }));
