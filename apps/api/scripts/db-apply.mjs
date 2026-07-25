import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

function containsExplicitTransactionControl(sql) {
  return /^\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?)\s*;\s*$/im.test(sql);
}

const migrationsDir = path.join(process.cwd(), "db", "migrations");
const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
const only = argumentValue("--only");
if (only && !files.includes(only)) {
  console.error(`Unknown migration: ${only}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const appliedRows = await client.query("SELECT id FROM schema_migrations");
  const applied = new Set(appliedRows.rows.map((row) => String(row.id)));

  if (!only && applied.size > 0) {
    const highestAppliedIndex = Math.max(...files.map((file, index) => applied.has(file) ? index : -1));
    const historicalGaps = files.slice(0, highestAppliedIndex + 1).filter((file) => !applied.has(file));
    if (historicalGaps.length) {
      throw new Error(
        `Migration ledger has ${historicalGaps.length} historical gap(s). `
        + "Refusing an unscoped replay; reconcile the ledger or use an approved --only migration."
      );
    }
  }

  if (!only && applied.size === 0) {
    const existingSchema = await client.query(`
      SELECT
        to_regclass('public.tenants') IS NOT NULL
        OR to_regclass('public.consumers') IS NOT NULL
        OR to_regclass('public.tags') IS NOT NULL AS initialized
    `);
    if (existingSchema.rows[0]?.initialized) {
      throw new Error(
        "Existing schema has no migration history. Refusing to replay from 0001. "
        + "Audit the baseline first, or apply one additive migration with --only <filename>."
      );
    }
  }

  const pending = (only ? [only] : files).filter((file) => !applied.has(file));
  for (const file of pending) {
    const body = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    if (containsExplicitTransactionControl(body)) {
      throw new Error(
        `Migration ${file} contains explicit transaction control. `
        + "Remove BEGIN/COMMIT/ROLLBACK so the runner can atomically apply and ledger the migration."
      );
    }
    console.log(`Applying ${file}...`);
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '60s'");
      await client.query("SELECT pg_advisory_xact_lock(487421337)");
      const concurrent = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [file]);
      if (!concurrent.rowCount) {
        await client.query(body);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log(pending.length ? "Migrations applied." : "Migrations up to date.");
} finally {
  await client.end();
}
