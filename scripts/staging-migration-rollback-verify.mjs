import {
  PLANNED_MIGRATIONS,
  assertAllowedTarget,
  assertRecordedPrechangeFingerprint,
  compareExactLedger,
  createStagingClient,
  expectedBaselineLedger,
  expectedLedgerForPhase,
  identifyTarget,
  readLedger,
  relevantSchemaFingerprint,
  safeFailure,
} from "./lib/staging-migration-gate.mjs";

let client;
let target;
try {
  const connection = createStagingClient();
  client = connection.client;
  await client.connect();
  await client.query("BEGIN TRANSACTION READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");
  target = await identifyTarget(client, connection.endpointFromHost);
  assertAllowedTarget(target);
  const actualLedger = await readLedger(client);
  const ledger = compareExactLedger(
    actualLedger,
    expectedLedgerForPhase(expectedBaselineLedger(), "rollback"),
  );
  const plannedPresent = PLANNED_MIGRATIONS.filter((id) => actualLedger.includes(id));
  const residual = (await client.query(`SELECT
    to_regclass('public.evidence_anchor_members') IS NOT NULL AS evidence_anchor_members,
    to_regclass('public.evidence_anchor_attempts') IS NOT NULL AS evidence_anchor_attempts,
    to_regclass('public.iota_executor_publications') IS NOT NULL AS iota_executor_publications,
    to_regclass('public.admin_login_attempt_buckets') IS NOT NULL AS admin_login_attempt_buckets,
    EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'evidence_anchor_status' AND e.enumlabel = 'reconciling'
    ) AS enum_reconciling`)).rows[0];
  const schemaFingerprint = await relevantSchemaFingerprint(client);
  assertRecordedPrechangeFingerprint(schemaFingerprint);
  await client.query("ROLLBACK");
  const noResidualV2 = Object.values(residual).every((value) => !value);
  const ok = ledger.ok && plannedPresent.length === 0 && noResidualV2;
  console.log(JSON.stringify({
    ok,
    gate: "migration_rollback_verify",
    target,
    schema_fingerprint: schemaFingerprint,
    ledger,
    planned_migrations_present: plannedPresent,
    residual_v2_objects: residual,
    rollback_mechanism: "neon_snapshot_or_branch_restore",
    database_mutated_by_gate: false,
  }));
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    ok: false,
    gate: "migration_rollback_verify",
    ...safeFailure(error, "MIGRATION_ROLLBACK_VERIFY_FAILED"),
    ...(target ? { target } : {}),
  }));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
