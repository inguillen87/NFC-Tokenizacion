import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import pg from "pg";

const RELEASE_MIGRATIONS = Object.freeze([
  "20260726173000_0060_sdk_idempotency_operations.sql",
  "20260726190000_0061_supplier_export_artifact_delivery.sql",
  "20260728120000_0062_sun_atomic_persistence.sql",
  "20260728143000_0063_supplier_packaging_governance.sql",
]);
const REQUIRED_APPLIED = Object.freeze([
  "20260725230000_0057_sun_rate_limit_atomic_buckets.sql",
  "20260726103000_0058_webhook_signature_v2.sql",
  "20260726135000_0059_marketplace_claim_truth_cleanup.sql",
]);

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const expectedFingerprint = String(process.env.NEXID_APPROVED_DATABASE_FINGERPRINT || "").trim().toLowerCase();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!/^sha256:[0-9a-f]{64}$/.test(expectedFingerprint)) {
  throw new Error("NEXID_APPROVED_DATABASE_FINGERPRINT is required");
}

const migrationsDir = path.resolve(process.cwd(), "db", "migrations");
const migrationBodies = await Promise.all(RELEASE_MIGRATIONS.map(async (id) => {
  const body = await fs.readFile(path.join(migrationsDir, id), "utf8");
  return { id, body, sha256: createHash("sha256").update(body).digest("hex") };
}));

const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
  query_timeout: 90_000,
});
await client.connect();

try {
  const target = (await client.query(`SELECT
    current_database() AS database,
    current_user AS database_role,
    current_setting('neon.endpoint_id', true) AS endpoint_id`)).rows[0];
  const identity = [target.endpoint_id, target.database, target.database_role].join("|");
  const actualFingerprint = `sha256:${createHash("sha256").update(identity).digest("hex")}`;
  if (actualFingerprint !== expectedFingerprint) throw new Error("approved_database_fingerprint_mismatch");

  const ledger = await client.query(
    "SELECT id FROM schema_migrations WHERE id = ANY($1::text[])",
    [[...REQUIRED_APPLIED, ...RELEASE_MIGRATIONS]],
  );
  const applied = new Set(ledger.rows.map((row) => String(row.id)));
  const missingPrerequisites = REQUIRED_APPLIED.filter((id) => !applied.has(id));
  const alreadyApplied = RELEASE_MIGRATIONS.filter((id) => applied.has(id));
  if (missingPrerequisites.length) throw new Error(`release_prerequisites_missing:${missingPrerequisites.join(",")}`);
  if (alreadyApplied.length) throw new Error(`release_migration_already_applied:${alreadyApplied.join(",")}`);

  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '90s'");
  await client.query("SELECT pg_advisory_xact_lock(487421337)");
  for (const migration of migrationBodies) {
    await client.query(migration.body);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
  }

  const postcheck = (await client.query(`SELECT
    to_regclass('public.sdk_idempotency_operations') IS NOT NULL AS sdk_idempotency_operations,
    to_regclass('public.vault_artifacts') IS NOT NULL AS vault_artifacts,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vault_artifacts'
        AND column_name = 'encrypted_payload_base64'
    ) AS supplier_export_envelope,
    to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NOT NULL AS sun_atomic_persistence,
    to_regclass('public.uq_tags_batch_uid_upper') IS NOT NULL AS sun_casefold_uid_guard,
    to_regclass('public.supplier_packaging_governance_decisions') IS NOT NULL AS supplier_packaging_governance,
    to_regprocedure('public.nexid_record_supplier_packaging_decision_v1(jsonb)') IS NOT NULL AS supplier_packaging_governance_writer,
    (SELECT count(*)::int FROM schema_migrations WHERE id = ANY($1::text[])) AS release_ledger_count`,
    [RELEASE_MIGRATIONS])).rows[0];
  if (
    !postcheck.sdk_idempotency_operations
    || !postcheck.vault_artifacts
    || !postcheck.supplier_export_envelope
    || !postcheck.sun_atomic_persistence
    || !postcheck.sun_casefold_uid_guard
    || !postcheck.supplier_packaging_governance
    || !postcheck.supplier_packaging_governance_writer
    || postcheck.release_ledger_count !== RELEASE_MIGRATIONS.length
  ) throw new Error("release_dry_run_postcheck_failed");

  await client.query("ROLLBACK");
  console.log(JSON.stringify({
    ok: true,
    gate: "enterprise_release_dry_run",
    target_fingerprint: actualFingerprint,
    migrations: migrationBodies.map(({ id, sha256 }) => ({ id, sha256: `sha256:${sha256}` })),
    postcheck,
    committed: false,
  }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    ok: false,
    gate: "enterprise_release_dry_run",
    reason: error instanceof Error ? error.message : "release_dry_run_failed",
  }));
  process.exitCode = 1;
} finally {
  await client.end();
}
