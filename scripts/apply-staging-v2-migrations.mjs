import { spawn } from "node:child_process";
import path from "node:path";
import {
  PLANNED_MIGRATIONS,
  assertAllowedTarget,
  assertMigrationProgress,
  assertRecordedPrechangeFingerprint,
  createStagingClient,
  expectedBaselineLedger,
  expectedLedgerForPrefix,
  gateError,
  identifyTarget,
  readLedger,
  relevantSchemaFingerprint,
  safeFailure,
} from "./lib/staging-migration-gate.mjs";

function requiredEvidence(name) {
  const value = String(process.env[name] || "").trim();
  if (value.length < 8) throw gateError(`${name}_REQUIRED`);
  return value;
}

function run(command, args, env = process.env, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", env, ...options });
    child.on("error", () => resolve(1));
    child.on("close", (value) => resolve(value ?? 1));
  });
}

function runMigration(file, env) {
  return run(
    process.execPath,
    ["scripts/db-apply.mjs", "--only", file],
    env,
    { cwd: path.resolve(process.cwd(), "apps/api") },
  );
}

async function verifyPrefix(baseline, expectedPrefixLength) {
  const connection = createStagingClient();
  const client = connection.client;
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    const target = await identifyTarget(client, connection.endpointFromHost);
    assertAllowedTarget(target);
    const progress = assertMigrationProgress(await readLedger(client), baseline);
    await client.query("ROLLBACK");
    if (progress.prefix_length !== expectedPrefixLength) {
      throw gateError("MIGRATION_LEDGER_PREFIX_CHANGED", {
        expected_prefix_length: expectedPrefixLength,
        migration_progress: progress,
      });
    }
    const ledger = progress.ledger;
    if (!ledger.ok || ledger.expected.join("\n") !== expectedLedgerForPrefix(baseline, expectedPrefixLength).join("\n")) {
      throw gateError("MIGRATION_LEDGER_PHASE_MISMATCH", { ledger });
    }
    return { target, ledger, progress };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

const approved = String(process.env.STAGING_MIGRATION_APPROVED || "").trim();
const envName = String(process.env.NODE_ENV || "").toLowerCase();
let backupReference = null;
let lastCompleted = null;
let initialProgress = null;
const appliedNow = [];

try {
  if (approved !== "YES") throw gateError("STAGING_MIGRATION_CONFIRMATION_REQUIRED");
  if (envName !== "staging") throw gateError("NODE_ENV_STAGING_REQUIRED");
  backupReference = requiredEvidence("STAGING_MIGRATION_BACKUP_REFERENCE");
  requiredEvidence("STAGING_MIGRATION_REHEARSAL_EVIDENCE");
  const baseline = expectedBaselineLedger();
  const connection = createStagingClient();

  // Bind the approval to the exact allowlisted endpoint, exact ledger and the
  // preflight schema fingerprint captured before the backup was created.
  const client = connection.client;
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    const target = await identifyTarget(client, connection.endpointFromHost);
    assertAllowedTarget(target);
    initialProgress = assertMigrationProgress(await readLedger(client), baseline);
    assertRecordedPrechangeFingerprint(await relevantSchemaFingerprint(client));
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }

  if (await run(process.execPath, ["scripts/check-migration-safety.mjs"]) !== 0) {
    throw gateError("MIGRATION_SAFETY_GATE_FAILED");
  }
  if (await run(process.execPath, ["scripts/staging-migration-preflight.mjs"]) !== 0) {
    throw gateError("MIGRATION_PREFLIGHT_FAILED");
  }

  const migrationEnv = { ...process.env, DATABASE_URL: connection.connectionString };
  let prefixLength = initialProgress.prefix_length;
  await verifyPrefix(baseline, prefixLength);

  // PostgreSQL enum additions must be committed before 0051 can reference the
  // new value. A virgin baseline applies 0050 alone; a valid resumed prefix
  // has already crossed this transaction boundary and must never replay it.
  if (prefixLength === 0) {
    const first = PLANNED_MIGRATIONS[0];
    if (await runMigration(first, migrationEnv) !== 0) {
      throw gateError("MIGRATION_APPLY_FAILED", { migration: first });
    }
    lastCompleted = first;
    appliedNow.push(first);
    prefixLength = 1;
    await verifyPrefix(baseline, prefixLength);
  }

  // Rehearse only the still-pending suffix. For an already-complete ledger this
  // is an explicit no-op whose rollback/fingerprint checks still run.
  if (await run(process.execPath, ["scripts/staging-migration-dry-run.mjs"]) !== 0) {
    throw gateError("MIGRATION_PENDING_SUFFIX_DRY_RUN_FAILED");
  }

  for (let index = prefixLength; index < PLANNED_MIGRATIONS.length; index += 1) {
    const file = PLANNED_MIGRATIONS[index];
    if (await runMigration(file, migrationEnv) !== 0) {
      throw gateError("MIGRATION_APPLY_FAILED", { migration: file });
    }
    lastCompleted = file;
    appliedNow.push(file);
    await verifyPrefix(baseline, index + 1);
  }

  if (await run(process.execPath, ["scripts/staging-postgres-smoke.mjs"]) !== 0) {
    throw gateError("MIGRATION_POSTCHECK_FAILED");
  }
  console.log(JSON.stringify({
    ok: true,
    gate: "staging_v2_migrations",
    migrations: PLANNED_MIGRATIONS,
    already_applied_migrations: initialProgress.applied_migrations,
    migrations_applied_now: appliedNow,
    idempotent_noop: initialProgress.complete,
    backup_reference: backupReference,
    rollback_required: false,
  }));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    gate: "staging_v2_migrations",
    ...safeFailure(error, "STAGING_MIGRATION_FAILED"),
    last_completed_migration: lastCompleted,
    backup_reference: backupReference,
    rollback_required: Boolean(lastCompleted),
    rollback_mechanism: "restore_the_recorded_neon_snapshot_or_branch_then_run_gate:migrations:rollback-verify",
  }));
  process.exitCode = 1;
}
