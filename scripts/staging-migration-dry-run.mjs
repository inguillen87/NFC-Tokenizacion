import fs from "node:fs/promises";
import path from "node:path";
import {
  DRY_RUN_MIGRATIONS,
  PLANNED_MIGRATIONS,
  STAGING_MIGRATION_LOCK_ID,
  assertAllowedTarget,
  assertNoTransactionControl,
  compareExactLedger,
  createStagingClient,
  expectedBaselineLedger,
  expectedLedgerForPhase,
  identifyTarget,
  readLedger,
  relevantSchemaFingerprint,
  safeFailure,
} from "./lib/staging-migration-gate.mjs";

const migrationDir = path.resolve(process.cwd(), "apps/api/db/migrations");
let client;
let target;
let failingMigration = null;
let beforeFingerprint = null;
let rollbackVerified = false;

try {
  const sqlByFile = new Map();
  for (const file of DRY_RUN_MIGRATIONS) {
    const sql = await fs.readFile(path.join(migrationDir, file), "utf8");
    assertNoTransactionControl(sql, file);
    sqlByFile.set(file, sql);
  }

  const connection = createStagingClient();
  client = connection.client;
  await client.connect();

  await client.query("BEGIN TRANSACTION READ ONLY");
  target = await identifyTarget(client, connection.endpointFromHost);
  assertAllowedTarget(target);
  const beforeLedger = compareExactLedger(
    await readLedger(client),
    expectedLedgerForPhase(expectedBaselineLedger(), "dry_run"),
  );
  const enumReconciling = (await client.query(`SELECT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'evidence_anchor_status' AND e.enumlabel = 'reconciling'
  ) AS present`)).rows[0]?.present;
  beforeFingerprint = await relevantSchemaFingerprint(client);
  await client.query("ROLLBACK");

  if (!beforeLedger.ok) {
    const error = new Error("MIGRATION_LEDGER_MISMATCH_AFTER_0050");
    error.reason = "MIGRATION_LEDGER_MISMATCH_AFTER_0050";
    error.metadata = { ledger: beforeLedger };
    throw error;
  }
  if (!enumReconciling) {
    const error = new Error("ENUM_VALUE_REQUIRES_COMMITTED_0050");
    error.reason = "ENUM_VALUE_REQUIRES_COMMITTED_0050";
    error.metadata = { required_first: PLANNED_MIGRATIONS[0] };
    throw error;
  }

  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '3s'");
  await client.query("SET LOCAL statement_timeout = '30s'");
  await client.query("SELECT pg_advisory_xact_lock($1)", [STAGING_MIGRATION_LOCK_ID]);
  for (const file of DRY_RUN_MIGRATIONS) {
    failingMigration = file;
    await client.query(sqlByFile.get(file));
  }
  failingMigration = null;
  await client.query("ROLLBACK");

  await client.query("BEGIN TRANSACTION READ ONLY");
  const afterFingerprint = await relevantSchemaFingerprint(client);
  const afterLedger = compareExactLedger(
    await readLedger(client),
    expectedLedgerForPhase(expectedBaselineLedger(), "dry_run"),
  );
  await client.query("ROLLBACK");
  rollbackVerified = beforeFingerprint === afterFingerprint && afterLedger.ok;

  console.log(JSON.stringify({
    ok: rollbackVerified,
    gate: "migration_dry_run",
    target,
    prerequisite: PLANNED_MIGRATIONS[0],
    applied_in_transaction: DRY_RUN_MIGRATIONS,
    persisted: false,
    rollback_verified: rollbackVerified,
    schema_fingerprint_before: beforeFingerprint,
    schema_fingerprint_after: afterFingerprint,
    ledger: afterLedger,
  }));
  process.exitCode = rollbackVerified ? 0 : 1;
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});
  let afterFingerprint = null;
  try {
    await client?.query("BEGIN TRANSACTION READ ONLY");
    afterFingerprint = client ? await relevantSchemaFingerprint(client) : null;
    await client?.query("ROLLBACK");
    rollbackVerified = Boolean(beforeFingerprint && beforeFingerprint === afterFingerprint);
  } catch {
    await client?.query("ROLLBACK").catch(() => {});
  }
  console.error(JSON.stringify({
    ok: false,
    gate: "migration_dry_run",
    ...safeFailure(error, "MIGRATION_SQL_INCOMPATIBLE"),
    ...(target ? { target } : {}),
    ...(failingMigration ? { failing_migration: failingMigration } : {}),
    persisted: false,
    rollback_verified: rollbackVerified,
    ...(beforeFingerprint ? { schema_fingerprint_before: beforeFingerprint } : {}),
    ...(afterFingerprint ? { schema_fingerprint_after: afterFingerprint } : {}),
  }));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
