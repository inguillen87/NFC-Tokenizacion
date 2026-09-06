import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import pg from "pg";

// This release runner cannot run arbitrary migrations or pick a default target.
const migration = "20260906120000_0102_campaign_drafts.sql";
const prerequisite = "20260903130000_0101_identified_unverified_event_taxonomy.sql";
const mode = process.argv[2];
if (!["dry-run", "apply", "verify"].includes(mode)) throw new Error("mode_required:dry-run|apply|verify");
const endpoint = process.env.CAMPAIGN_MIGRATION_EXPECTED_ENDPOINT;
const approvedHash = process.env.CAMPAIGN_MIGRATION_APPROVED_SHA256;
if (!/^ep-[a-z0-9-]+$/.test(endpoint || "")) throw new Error("expected_endpoint_required");
if (!/^[a-f0-9]{64}$/.test(approvedHash || "")) throw new Error("approved_migration_sha256_required");
const body = await fs.readFile(new URL(`../db/migrations/${migration}`, import.meta.url), "utf8");
const sha256 = createHash("sha256").update(body).digest("hex");
if (sha256 !== approvedHash) throw new Error("migration_hash_mismatch");
const connection = new URL(process.env.DATABASE_URL || "");
if (connection.hostname.includes("-pooler")) throw new Error("direct_connection_required");
if (connection.hostname.split(".")[0] !== endpoint) throw new Error("connection_endpoint_mismatch");
connection.searchParams.set("sslmode", "verify-full");
const client = new pg.Client({ connectionString: connection.toString(), connectionTimeoutMillis: 10000 });
let transaction = false;
try {
  await client.connect();
  const target = (await client.query("SELECT current_database() AS database, current_user AS role, current_setting('neon.endpoint_id', true) AS endpoint")).rows[0];
  if (target.endpoint !== endpoint || target.database !== "neondb") throw new Error("database_target_mismatch");
  await client.query("BEGIN");
  transaction = true;
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '30s'");
  await client.query("SELECT pg_advisory_xact_lock(609060102)");
  const ledger = (await client.query("SELECT id FROM schema_migrations WHERE id = ANY($1::text[])", [[migration, prerequisite]])).rows.map(row => row.id);
  if (!ledger.includes(prerequisite)) throw new Error("migration_prerequisite_missing");
  const before = (await client.query("SELECT to_regclass('public.campaign_drafts')::text AS name")).rows[0].name;
  if (ledger.includes(migration)) {
    if (!before) throw new Error("migration_ledger_schema_mismatch");
    await client.query("ROLLBACK");
    transaction = false;
    console.log(JSON.stringify({ ok: true, mode, alreadyApplied: true, migration, sha256, target }));
  } else {
    if (mode === "verify") throw new Error("migration_not_applied");
    if (before) throw new Error("untracked_campaign_schema_exists");
    await client.query(body);
    await client.query("INSERT INTO schema_migrations(id) VALUES ($1)", [migration]);
    const checks = (await client.query("SELECT count(*)::int AS constraints FROM pg_constraint WHERE conrelid = 'public.campaign_drafts'::regclass")).rows[0];
    if (checks.constraints < 10) throw new Error("campaign_schema_constraints_incomplete");
    await client.query(mode === "apply" ? "COMMIT" : "ROLLBACK");
    transaction = false;
    const after = (await client.query("SELECT to_regclass('public.campaign_drafts')::text AS name, EXISTS(SELECT 1 FROM schema_migrations WHERE id = $1) AS applied", [migration])).rows[0];
    if (mode === "dry-run" && (after.name !== before || after.applied)) throw new Error("dry_run_rollback_failed");
    if (mode === "apply" && (!after.name || !after.applied)) throw new Error("migration_apply_verification_failed");
    console.log(JSON.stringify({ ok: true, mode, migration, sha256, target, persisted: mode === "apply", rollbackVerified: mode === "dry-run", constraints: checks.constraints }));
  }
} catch (error) {
  if (transaction) await client.query("ROLLBACK").catch(() => {});
  // Never print connection strings or database error detail containing row values.
  console.error(JSON.stringify({ ok: false, mode, migration, reason: String(error?.message || "migration_failed"), code: error?.code || null }));
  process.exitCode = 1;
} finally {
  await client.end();
}
