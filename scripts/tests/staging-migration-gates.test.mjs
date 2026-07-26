import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PLANNED_MIGRATIONS,
  assertAllowedTarget,
  assertMigrationProgress,
  assertNoTransactionControl,
  compareExactLedger,
  expectedLedgerForPhase,
  expectedLedgerForPrefix,
  migrationProgress,
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
  assert.equal(PLANNED_MIGRATIONS.length, 7);
  assert.equal(
    PLANNED_MIGRATIONS.at(-1),
    "20260725014500_0056_iota_evidence_constraints_validate.sql",
  );
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

test("virgin baseline resolves to an exact empty prefix", () => {
  const progress = assertMigrationProgress(baseline, baseline);
  assert.equal(progress.ok, true);
  assert.equal(progress.prefix_length, 0);
  assert.deepEqual(progress.applied_migrations, []);
  assert.deepEqual(progress.pending_migrations, PLANNED_MIGRATIONS);
  assert.deepEqual(progress.ledger.expected, expectedLedgerForPrefix(baseline, 0));
});

test("staging prefix 0050-0054 resumes with only 0055-0056 pending", () => {
  const appliedPrefix = PLANNED_MIGRATIONS.slice(0, 5);
  const progress = assertMigrationProgress([...baseline, ...appliedPrefix], baseline);
  assert.equal(progress.prefix_length, 5);
  assert.deepEqual(progress.applied_migrations, appliedPrefix);
  assert.deepEqual(progress.pending_migrations, PLANNED_MIGRATIONS.slice(5));
  assert.equal(progress.complete, false);
});

test("a malicious migration gap or unexpected application order fails closed", () => {
  const sparseLedger = [
    ...baseline,
    ...PLANNED_MIGRATIONS.slice(0, 5),
    PLANNED_MIGRATIONS[6],
  ];
  const sparse = migrationProgress(sparseLedger, baseline);
  assert.equal(sparse.ok, false);
  assert.deepEqual(sparse.non_prefix_applied, [PLANNED_MIGRATIONS[6]]);
  assert.throws(
    () => assertMigrationProgress(sparseLedger, baseline),
    /MIGRATION_LEDGER_NOT_EXACT_CONTIGUOUS_PREFIX/,
  );

  const reordered = [
    ...baseline,
    PLANNED_MIGRATIONS[1],
    PLANNED_MIGRATIONS[0],
  ];
  const outOfOrder = migrationProgress(reordered, baseline);
  assert.equal(outOfOrder.ok, false);
  assert.equal(outOfOrder.order_valid, false);
  assert.throws(
    () => assertMigrationProgress(reordered, baseline),
    /MIGRATION_LEDGER_NOT_EXACT_CONTIGUOUS_PREFIX/,
  );
});

test("an all-complete ledger is an idempotent no-op", () => {
  const progress = assertMigrationProgress([...baseline, ...PLANNED_MIGRATIONS], baseline);
  assert.equal(progress.complete, true);
  assert.equal(progress.prefix_length, PLANNED_MIGRATIONS.length);
  assert.deepEqual(progress.pending_migrations, []);
  assert.equal(progress.ledger.ok, true);
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
  assert.match(preflight, /assertMigrationProgress/);
  assert.match(dryRun, /pendingMigrations = progress\.pending_migrations/);
  assert.match(dryRun, /for \(const file of pendingMigrations\)/);
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
  assert.match(apply, /process\.execPath/);
  assert.match(apply, /scripts\/db-apply\.mjs/);
  assert.match(apply, /cwd: path\.resolve\(process\.cwd\(\), "apps\/api"\)/);
  assert.doesNotMatch(apply, /npm\.cmd/);
  assert.match(apply, /let prefixLength = initialProgress\.prefix_length/);
  assert.match(apply, /for \(let index = prefixLength;/);
  assert.ok(apply.indexOf("MIGRATION_PREFLIGHT_FAILED") < apply.indexOf("MIGRATION_PENDING_SUFFIX_DRY_RUN_FAILED"));
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
    assert.match(sql, /20260725014500_0056_iota_evidence_constraints_validate\.sql/);
  }
});
