import pg from "pg";

const { Client } = pg;
const url = String(process.env.DATABASE_URL || "").trim();
if (!url) { console.error(JSON.stringify({ ok: false, gate: "migration_preflight", reason: "DATABASE_URL_REQUIRED" })); process.exit(2); }
const client = new Client({ connectionString: url, connectionTimeoutMillis: 5_000, query_timeout: 10_000, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true } });
try {
  await client.connect();
  const baseline = await client.query(`SELECT
    to_regclass('public.evidence_anchors') IS NOT NULL AS evidence_anchors,
    to_regclass('public.evidence_events') IS NOT NULL AS evidence_events,
    to_regclass('public.webhook_deliveries') IS NOT NULL AS webhook_deliveries,
    to_regclass('public.webhook_endpoints') IS NOT NULL AS webhook_endpoints,
    to_regclass('public.admin_login_attempt_buckets') IS NOT NULL AS login_buckets`);
  const extension = await client.query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') AS uuid_ossp");
  const privileges = await client.query("SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage, has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create");
  const locks = await client.query("SELECT count(*)::int AS blocking_locks FROM pg_locks WHERE NOT granted");
  const migrationTable = await client.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present");
  let applied = [];
  if (migrationTable.rows[0]?.present) {
    const rows = await client.query("SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 12");
    applied = rows.rows.map((row) => row.id);
  }
  const planned = ["20260723193000_0050_evidence_anchor_reconciling_status.sql", "20260723193500_0051_iota_evidence_anchor_v2_writer.sql", "20260723194500_0052_webhook_delivery_outbox.sql", "20260723200500_0053_admin_login_abuse_guard.sql", "20260723213000_0054_iota_executor_publications.sql", "20260724213000_0055_iota_executor_durable_broadcast.sql"];
  const missingMigrations = planned.filter((id) => !applied.includes(id));
  const result = {
    ok: Boolean(baseline.rows[0]?.evidence_anchors && baseline.rows[0]?.evidence_events && baseline.rows[0]?.webhook_deliveries && baseline.rows[0]?.webhook_endpoints && baseline.rows[0]?.login_buckets && extension.rows[0]?.uuid_ossp && privileges.rows[0]?.schema_usage && privileges.rows[0]?.schema_create && locks.rows[0]?.blocking_locks === 0 && missingMigrations.length === 0),
    gate: "migration_preflight",
    baseline: baseline.rows[0],
    uuid_ossp: extension.rows[0]?.uuid_ossp,
    privileges: privileges.rows[0],
    blocking_locks: locks.rows[0]?.blocking_locks,
    applied_migrations: applied,
    planned,
    missing_migrations: missingMigrations,
  };
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, gate: "migration_preflight", reason: "DATABASE_UNAVAILABLE", detail: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
