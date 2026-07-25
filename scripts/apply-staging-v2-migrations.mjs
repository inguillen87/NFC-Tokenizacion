import { spawn } from "node:child_process";
import {
  PLANNED_MIGRATIONS,
  assertAllowedTarget,
  assertRecordedPrechangeFingerprint,
  compareExactLedger,
  createStagingClient,
  expectedBaselineLedger,
  expectedLedgerForPhase,
  gateError,
  identifyTarget,
  normalizeLedger,
  readLedger,
  relevantSchemaFingerprint,
  safeFailure,
} from "./lib/staging-migration-gate.mjs";

function requiredEvidence(name) {
  const value = String(process.env[name] || "").trim();
  if (value.length < 8) throw gateError(`${name}_REQUIRED`);
  return value;
}

function run(command, args, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", () => resolve(1));
    child.on("close", (value) => resolve(value ?? 1));
  });
}

async function verifyLedger(expected) {
  const connection = createStagingClient();
  const client = connection.client;
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    const target = await identifyTarget(client, connection.endpointFromHost);
    assertAllowedTarget(target);
    const ledger = compareExactLedger(await readLedger(client), expected);
    await client.query("ROLLBACK");
    if (!ledger.ok) throw gateError("MIGRATION_LEDGER_PHASE_MISMATCH", { ledger });
    return { target, ledger };
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
    const ledger = compareExactLedger(await readLedger(client), expectedLedgerForPhase(baseline, "preflight"));
    if (!ledger.ok) throw gateError("MIGRATION_LEDGER_BASELINE_MISMATCH", { ledger });
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
  const first = PLANNED_MIGRATIONS[0];
  if (await run("npm.cmd", ["run", "db:migrate", "--workspace=api", "--", "--only", first], migrationEnv) !== 0) {
    throw gateError("MIGRATION_APPLY_FAILED", { migration: first });
  }
  lastCompleted = first;
  await verifyLedger(expectedLedgerForPhase(baseline, "after_0050"));

  // PostgreSQL enum additions must be committed before 0051 can reference the
  // new value. Only after 0050 is durable can 0051-0055 be rehearsed together.
  if (await run(process.execPath, ["scripts/staging-migration-dry-run.mjs"]) !== 0) {
    throw gateError("MIGRATION_DRY_RUN_FAILED_AFTER_0050");
  }

  for (let index = 1; index < PLANNED_MIGRATIONS.length; index += 1) {
    const file = PLANNED_MIGRATIONS[index];
    if (await run("npm.cmd", ["run", "db:migrate", "--workspace=api", "--", "--only", file], migrationEnv) !== 0) {
      throw gateError("MIGRATION_APPLY_FAILED", { migration: file });
    }
    lastCompleted = file;
    await verifyLedger(normalizeLedger([...baseline, ...PLANNED_MIGRATIONS.slice(0, index + 1)]));
  }

  if (await run(process.execPath, ["scripts/staging-postgres-smoke.mjs"]) !== 0) {
    throw gateError("MIGRATION_POSTCHECK_FAILED");
  }
  console.log(JSON.stringify({
    ok: true,
    gate: "staging_v2_migrations",
    migrations: PLANNED_MIGRATIONS,
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
