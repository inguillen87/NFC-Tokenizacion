import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const url = String(process.env.DATABASE_URL || "").trim();
const migrationDir = path.resolve(process.cwd(), "apps/api/db/migrations");
const files = [
  "20260723193000_0050_evidence_anchor_reconciling_status.sql",
  "20260723193500_0051_iota_evidence_anchor_v2_writer.sql",
  "20260723194500_0052_webhook_delivery_outbox.sql",
  "20260723200500_0053_admin_login_abuse_guard.sql",
  "20260723213000_0054_iota_executor_publications.sql",
  "20260724213000_0055_iota_executor_durable_broadcast.sql",
];
if (!url) { console.error(JSON.stringify({ ok: false, gate: "migration_dry_run", reason: "DATABASE_URL_REQUIRED" })); process.exit(2); }
const client = new Client({ connectionString: url, connectionTimeoutMillis: 5_000, query_timeout: 30_000, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true } });
try {
  await client.connect();
  await client.query("SET lock_timeout = '3s'");
  await client.query("SET statement_timeout = '30s'");
  const enumCheck = await client.query("SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'evidence_anchor_status' AND e.enumlabel = 'reconciling') AS reconciling");
  if (!enumCheck.rows[0]?.reconciling) {
    console.log(JSON.stringify({ ok: false, gate: "migration_dry_run", reason: "ENUM_VALUE_REQUIRES_COMMITTED_0050", persisted: false, required_first: files[0] }));
    process.exitCode = 1;
    await client.end();
    process.exit();
  }
  await client.query("BEGIN");
  const applied = [];
  for (const file of files.slice(1)) {
    const sql = await fs.readFile(path.join(migrationDir, file), "utf8");
    await client.query(sql);
    applied.push(file);
  }
  await client.query("ROLLBACK");
  console.log(JSON.stringify({ ok: true, gate: "migration_dry_run", applied_in_transaction: applied, persisted: false }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({ ok: false, gate: "migration_dry_run", reason: "MIGRATION_SQL_INCOMPATIBLE", detail: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
