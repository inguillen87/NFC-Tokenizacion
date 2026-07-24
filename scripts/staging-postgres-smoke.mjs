import pg from "pg";

const { Client } = pg;
const requiredTables = ["evidence_anchors", "evidence_anchor_attempts", "iota_executor_publications", "admin_login_attempt_buckets"];
const requiredColumns = {
  evidence_anchors: ["proof_id", "memo_hash", "event_hashes_json", "merkle_root"],
  evidence_anchor_attempts: ["anchor_id", "attempt_no", "tx_hash", "nonce"],
  iota_executor_publications: ["proof_id", "status", "payload_json", "response_json"],
  admin_login_attempt_buckets: ["bucket_kind", "bucket_key", "attempt_count", "blocked_until"],
};
const url = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
if (!url) {
  console.error(JSON.stringify({ ok: false, reason: "DATABASE_URL_REQUIRED", gate: "postgres_staging" }));
  process.exit(2);
}

const client = new Client({ connectionString: url, connectionTimeoutMillis: 5_000, query_timeout: 10_000, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true } });
try {
  await client.connect();
  const server = await client.query("SELECT current_database() AS database, current_setting('server_version_num') AS server_version_num");
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])", [requiredTables]);
  const present = new Set(tables.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((name) => !present.has(name));
  const columns = await client.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [requiredTables]);
  const columnSet = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) => names.filter((name) => !columnSet.has(`${table}.${name}`)).map((name) => `${table}.${name}`));
  const indexes = await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_iota_executor_publications_request'`);
  const missingIndexes = indexes.rows.length ? [] : ["uq_iota_executor_publications_request"];
  const migrationTable = await client.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present");
  let appliedMigrations = null;
  if (migrationTable.rows[0]?.present) {
    const rows = await client.query("SELECT id FROM schema_migrations WHERE id IN ('20260723193000_0050_evidence_anchor_reconciling_status.sql','20260723193500_0051_iota_evidence_anchor_v2_writer.sql','20260723194500_0052_webhook_delivery_outbox.sql','20260723200500_0053_admin_login_abuse_guard.sql','20260723213000_0054_iota_executor_publications.sql','20260724213000_0055_iota_executor_durable_broadcast.sql') ORDER BY id");
    appliedMigrations = rows.rows.map((row) => row.id);
  }
  const result = { ok: missing.length === 0 && missingColumns.length === 0 && missingIndexes.length === 0, gate: "postgres_staging", database: server.rows[0].database, server_version_num: server.rows[0].server_version_num, required_tables: requiredTables, missing_tables: missing, missing_columns: missingColumns, missing_indexes: missingIndexes, applied_v2_migrations: appliedMigrations };
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, gate: "postgres_staging", reason: "DATABASE_UNAVAILABLE", detail: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
