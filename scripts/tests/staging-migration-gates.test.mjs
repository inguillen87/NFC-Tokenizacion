import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PLANNED_MIGRATIONS,
  assertAllowedTarget,
  assertNoTransactionControl,
  compareExactLedger,
  expectedLedgerForPhase,
  parseEndpointAllowlist,
  stagingConnection,
} from "../lib/staging-migration-gate.mjs";

const baseline = ["0001_initial.sql", "20260712053000_0049_tokenization_simulation_truth.sql"];

async function source(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

test("staging connection requires an unpooled Neon URL and upgrades TLS verification", () => {
  assert.throws(() => stagingConnection({}), /STAGING_DATABASE_URL_REQUIRED/);
  assert.throws(
    () => stagingConnection({ STAGING_DATABASE_URL: "postgresql://user:pass@example.com/db" }),
    /STAGING_DATABASE_PROVIDER_NOT_NEON/,
  );
  assert.throws(
    () => stagingConnection({ STAGING_DATABASE_URL: "postgresql://user:pass@ep-safe-pooler.us-east-1.aws.neon.tech/db" }),
    /STAGING_DATABASE_UNPOOLED_URL_REQUIRED/,
  );
  const connection = stagingConnection({
    STAGING_DATABASE_URL: "postgresql://user:pass@ep-safe.us-east-1.aws.neon.tech/db?sslmode=require",
  });
  const normalized = new URL(connection.connectionString);
  assert.equal(connection.endpointFromHost, "ep-safe");
  assert.equal(normalized.searchParams.get("sslmode"), "verify-full");
  assert.equal(normalized.searchParams.get("application_name"), "nexid-staging-migration-gate");
});

test("endpoint authorization is exact and cannot be satisfied by a substring", () => {
  const source = { STAGING_DATABASE_ENDPOINT_ALLOWLIST: "ep-staging-one,ep-staging-two" };
  assert.deepEqual([...parseEndpointAllowlist(source)], ["ep-staging-one", "ep-staging-two"]);
  assert.doesNotThrow(() => assertAllowedTarget({
    endpoint_id: "ep-staging-one",
    target_fingerprint: `sha256:${"a".repeat(64)}`,
    in_recovery: false,
    default_transaction_read_only: "off",
  }, source));
  assert.throws(() => assertAllowedTarget({
    endpoint_id: "ep-staging",
    target_fingerprint: `sha256:${"b".repeat(64)}`,
    in_recovery: false,
    default_transaction_read_only: "off",
  }, source), /STAGING_DATABASE_ENDPOINT_NOT_ALLOWLISTED/);
});

test("each migration phase requires the exact full ledger", () => {
  const before = expectedLedgerForPhase(baseline, "preflight");
  const after0050 = expectedLedgerForPhase(baseline, "after_0050");
  const afterAll = expectedLedgerForPhase(baseline, "postcheck");
  assert.deepEqual(before, [...baseline].sort());
  assert.deepEqual(after0050, [...baseline, PLANNED_MIGRATIONS[0]].sort());
  assert.deepEqual(afterAll, [...baseline, ...PLANNED_MIGRATIONS].sort());
  assert.equal(compareExactLedger(before, before).ok, true);
  const gap = compareExactLedger(afterAll.slice(1), afterAll);
  assert.equal(gap.ok, false);
  assert.deepEqual(gap.missing, [afterAll[0]]);
  const extra = compareExactLedger([...before, "9999_unapproved.sql"], before);
  assert.equal(extra.ok, false);
  assert.deepEqual(extra.unexpected, ["9999_unapproved.sql"]);
});

test("migration SQL cannot terminate the runner-owned transaction", () => {
  assert.doesNotThrow(() => assertNoTransactionControl("ALTER TABLE demo ADD COLUMN value text;", "safe.sql"));
  for (const sql of ["BEGIN;\nSELECT 1;", "SELECT 1;\nCOMMIT;", "ROLLBACK;"]) {
    assert.throws(() => assertNoTransactionControl(sql, "unsafe.sql"), /MIGRATION_TRANSACTION_CONTROL_FORBIDDEN/);
  }
});

test("executable gates bind preflight, dry-run, postcheck and rollback to safe phases", async () => {
  const preflight = await source("../staging-migration-preflight.mjs");
  const dryRun = await source("../staging-migration-dry-run.mjs");
  const postcheck = await source("../staging-postgres-smoke.mjs");
  const rollback = await source("../staging-migration-rollback-verify.mjs");
  const apply = await source("../apply-staging-v2-migrations.mjs");
  assert.match(preflight, /BEGIN TRANSACTION READ ONLY/);
  assert.match(preflight, /residual_v2_schema/);
  assert.match(dryRun, /expectedLedgerForPhase\(expectedBaselineLedger\(\), "dry_run"\)/);
  assert.match(dryRun, /schema_fingerprint_before/);
  assert.match(dryRun, /rollback_verified/);
  assert.match(postcheck, /protocol_version/);
  assert.match(postcheck, /uq_iota_executor_publications_signer_nonce/);
  assert.match(postcheck, /production_ready/);
  assert.match(postcheck, /unvalidatedConstraints\.length === 0/);
  assert.match(rollback, /assertRecordedPrechangeFingerprint/);
  assert.match(rollback, /BEGIN TRANSACTION READ ONLY/);
  assert.match(apply, /STAGING_MIGRATION_BACKUP_REFERENCE/);
  assert.match(apply, /STAGING_MIGRATION_REHEARSAL_EVIDENCE/);
  assert.ok(apply.indexOf("MIGRATION_PREFLIGHT_FAILED") < apply.indexOf("MIGRATION_DRY_RUN_FAILED_AFTER_0050"));
});

test("runner blocks sparse-ledger replay and owns all transaction controls", async () => {
  const runner = await source("../../apps/api/scripts/db-apply.mjs");
  const legacyRunner = await source("../../apps/api/scripts/db-apply-file.mjs");
  const legacyPowerShell = await source("../api-db-apply-migration-file.ps1");
  assert.match(runner, /historicalGaps/);
  assert.match(runner, /Refusing an unscoped replay/);
  assert.match(runner, /containsExplicitTransactionControl/);
  assert.match(runner, /SET LOCAL lock_timeout/);
  assert.match(runner, /INSERT INTO schema_migrations/);
  assert.match(legacyRunner, /IOTA V2 migrations require the allowlisted transactional staging runner/);
  assert.match(legacyPowerShell, /IOTA V2 migrations must use npm run apply:staging:v2/);
  assert.match(legacyPowerShell, /20260724213000_0055_iota_executor_durable_broadcast\.sql/);
  assert.match(legacyPowerShell, /20260725014500_0056_iota_evidence_constraints_validate\.sql/);
});

test("postcheck and rollback SQL artifacts are read-only", async () => {
  const postcheck = await source("../../apps/api/db/ops/iota-v2-postcheck.sql");
  const rollback = await source("../../apps/api/db/ops/iota-v2-rollback-verify.sql");
  for (const sql of [postcheck, rollback]) {
    assert.match(sql, /BEGIN TRANSACTION READ ONLY/);
    assert.match(sql, /ROLLBACK;/);
    assert.doesNotMatch(sql, /^\s*(?:ALTER|CREATE|DROP|DELETE|INSERT|TRUNCATE|UPDATE)\b/im);
  }
});
