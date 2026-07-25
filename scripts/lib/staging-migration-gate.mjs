import { createHash } from "node:crypto";
import pg from "pg";

const { Client } = pg;

export const STAGING_MIGRATION_LOCK_ID = 487421337;
export const PLANNED_MIGRATIONS = Object.freeze([
  "20260723193000_0050_evidence_anchor_reconciling_status.sql",
  "20260723193500_0051_iota_evidence_anchor_v2_writer.sql",
  "20260723194500_0052_webhook_delivery_outbox.sql",
  "20260723200500_0053_admin_login_abuse_guard.sql",
  "20260723213000_0054_iota_executor_publications.sql",
  "20260724213000_0055_iota_executor_durable_broadcast.sql",
  "20260725014500_0056_iota_evidence_constraints_validate.sql",
]);

export const DRY_RUN_MIGRATIONS = Object.freeze(PLANNED_MIGRATIONS.slice(1));

const RELEVANT_TABLES = Object.freeze([
  "admin_login_attempt_buckets",
  "evidence_anchor_attempts",
  "evidence_anchor_members",
  "evidence_anchors",
  "evidence_events",
  "iota_executor_publications",
  "schema_migrations",
  "webhook_deliveries",
  "webhook_endpoints",
]);

function sha256(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function requiredText(value, reason) {
  const normalized = String(value || "").trim();
  if (!normalized) throw gateError(reason);
  return normalized;
}

export function gateError(reason, metadata = {}) {
  const error = new Error(reason);
  error.reason = reason;
  error.metadata = metadata;
  return error;
}

export function safeFailure(error, fallback = "MIGRATION_GATE_FAILED") {
  const reason = typeof error?.reason === "string" ? error.reason : fallback;
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{2,12}$/.test(error.code)
    ? error.code
    : undefined;
  const metadata = error?.metadata && typeof error.metadata === "object" ? error.metadata : {};
  return { reason, ...(code ? { code } : {}), ...metadata };
}

export function normalizeLedger(ids) {
  if (!Array.isArray(ids)) throw gateError("EXPECTED_LEDGER_INVALID");
  const normalized = ids.map((id) => String(id || "").trim()).filter(Boolean);
  if (normalized.some((id) => !/^[A-Za-z0-9_.-]+\.sql$/.test(id))) {
    throw gateError("EXPECTED_LEDGER_INVALID");
  }
  if (new Set(normalized).size !== normalized.length) throw gateError("EXPECTED_LEDGER_DUPLICATE");
  return normalized.sort();
}

export function expectedBaselineLedger(source = process.env) {
  const value = requiredText(
    source.STAGING_MIGRATION_EXPECTED_BASELINE_LEDGER,
    "STAGING_MIGRATION_EXPECTED_BASELINE_LEDGER_REQUIRED",
  );
  return normalizeLedger(value.split(","));
}

export function expectedLedgerForPhase(baseline, phase) {
  const normalized = normalizeLedger(baseline);
  if (phase === "preflight" || phase === "rollback") return normalized;
  if (phase === "after_0050" || phase === "dry_run") {
    return normalizeLedger([...normalized, PLANNED_MIGRATIONS[0]]);
  }
  if (phase === "postcheck") return normalizeLedger([...normalized, ...PLANNED_MIGRATIONS]);
  throw gateError("MIGRATION_LEDGER_PHASE_INVALID");
}

export function compareExactLedger(actual, expected) {
  const normalizedActual = normalizeLedger(actual);
  const normalizedExpected = normalizeLedger(expected);
  const actualSet = new Set(normalizedActual);
  const expectedSet = new Set(normalizedExpected);
  const missing = normalizedExpected.filter((id) => !actualSet.has(id));
  const unexpected = normalizedActual.filter((id) => !expectedSet.has(id));
  return {
    ok: missing.length === 0 && unexpected.length === 0,
    actual: normalizedActual,
    expected: normalizedExpected,
    missing,
    unexpected,
    sha256: sha256(normalizedActual.join("\n")),
  };
}

export function parseEndpointAllowlist(source = process.env) {
  const raw = requiredText(
    source.STAGING_DATABASE_ENDPOINT_ALLOWLIST,
    "STAGING_DATABASE_ENDPOINT_ALLOWLIST_REQUIRED",
  );
  const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (!values.length || values.some((value) => !/^ep-[a-z0-9-]+$/.test(value))) {
    throw gateError("STAGING_DATABASE_ENDPOINT_ALLOWLIST_INVALID");
  }
  return new Set(values);
}

export function stagingConnection(source = process.env) {
  const raw = requiredText(source.STAGING_DATABASE_URL, "STAGING_DATABASE_URL_REQUIRED");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw gateError("STAGING_DATABASE_URL_INVALID");
  }
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw gateError("STAGING_DATABASE_URL_INVALID");
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(".neon.tech")) throw gateError("STAGING_DATABASE_PROVIDER_NOT_NEON");
  if (hostname.includes("-pooler.")) throw gateError("STAGING_DATABASE_UNPOOLED_URL_REQUIRED");
  const endpointFromHost = hostname.split(".")[0];
  if (!/^ep-[a-z0-9-]+$/.test(endpointFromHost)) throw gateError("STAGING_DATABASE_ENDPOINT_INVALID");

  // Force certificate and hostname validation even when a copied Neon URL used
  // the historically ambiguous `sslmode=require` spelling.
  url.searchParams.set("sslmode", "verify-full");
  url.searchParams.set("application_name", "nexid-staging-migration-gate");
  return {
    connectionString: url.toString(),
    endpointFromHost,
    clientOptions: {
      connectionString: url.toString(),
      connectionTimeoutMillis: 5_000,
      query_timeout: 30_000,
      ssl: { rejectUnauthorized: true },
    },
  };
}

export function createStagingClient(source = process.env) {
  const connection = stagingConnection(source);
  return { ...connection, client: new Client(connection.clientOptions) };
}

export async function identifyTarget(client, endpointFromHost) {
  const row = (await client.query(`SELECT
    current_database() AS database,
    current_user AS database_role,
    current_setting('server_version_num') AS server_version_num,
    current_setting('neon.endpoint_id', true) AS endpoint_id,
    current_setting('default_transaction_read_only') AS default_transaction_read_only,
    pg_is_in_recovery() AS in_recovery`)).rows[0];
  const endpointId = String(row?.endpoint_id || "").trim();
  if (!/^ep-[a-z0-9-]+$/.test(endpointId)) throw gateError("NEON_ENDPOINT_ID_UNAVAILABLE");
  if (endpointId !== endpointFromHost) throw gateError("NEON_ENDPOINT_HOST_MISMATCH", { endpoint_id: endpointId });
  const target = {
    provider: "neon",
    endpoint_id: endpointId,
    database: String(row.database),
    database_role: String(row.database_role),
    server_version_num: String(row.server_version_num),
    default_transaction_read_only: String(row.default_transaction_read_only),
    in_recovery: Boolean(row.in_recovery),
  };
  return {
    ...target,
    target_fingerprint: sha256([
      "nexid.staging.database.v1",
      target.endpoint_id,
      target.database,
      target.database_role,
    ].join("|")),
  };
}

export function assertAllowedTarget(target, source = process.env) {
  const allowlist = parseEndpointAllowlist(source);
  if (!allowlist.has(target.endpoint_id)) {
    throw gateError("STAGING_DATABASE_ENDPOINT_NOT_ALLOWLISTED", {
      endpoint_id: target.endpoint_id,
      target_fingerprint: target.target_fingerprint,
    });
  }
  if (target.in_recovery || target.default_transaction_read_only !== "off") {
    throw gateError("STAGING_DATABASE_NOT_WRITABLE_PRIMARY", {
      endpoint_id: target.endpoint_id,
      target_fingerprint: target.target_fingerprint,
    });
  }
}

export async function readLedger(client) {
  const table = await client.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present");
  if (!table.rows[0]?.present) throw gateError("SCHEMA_MIGRATIONS_TABLE_REQUIRED");
  return normalizeLedger((await client.query("SELECT id FROM schema_migrations ORDER BY id")).rows.map((row) => row.id));
}

export async function relevantSchemaFingerprint(client) {
  const columns = (await client.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable,
      COALESCE(column_default, '') AS column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position`, [RELEVANT_TABLES])).rows;
  const constraints = (await client.query(`SELECT c.conrelid::regclass::text AS table_name, c.conname,
      c.contype, c.convalidated, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.connamespace = 'public'::regnamespace
      AND c.conrelid::regclass::text = ANY($1::text[])
    ORDER BY table_name, c.conname`, [RELEVANT_TABLES])).rows;
  const indexes = (await client.query(`SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY($1::text[])
    ORDER BY tablename, indexname`, [RELEVANT_TABLES])).rows;
  const enumLabels = (await client.query(`SELECT e.enumlabel
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'evidence_anchor_status'
    ORDER BY e.enumsortorder`)).rows.map((row) => row.enumlabel);
  const ledger = await readLedger(client);
  return sha256(JSON.stringify({ columns, constraints, indexes, enumLabels, ledger }));
}

export function assertRecordedPrechangeFingerprint(actual, source = process.env) {
  const expected = requiredText(
    source.STAGING_MIGRATION_PRECHANGE_SCHEMA_FINGERPRINT,
    "STAGING_MIGRATION_PRECHANGE_SCHEMA_FINGERPRINT_REQUIRED",
  ).toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/.test(expected)) {
    throw gateError("STAGING_MIGRATION_PRECHANGE_SCHEMA_FINGERPRINT_INVALID");
  }
  if (actual.toLowerCase() !== expected) {
    throw gateError("STAGING_MIGRATION_PRECHANGE_SCHEMA_FINGERPRINT_MISMATCH", {
      schema_fingerprint: actual,
    });
  }
}

export function assertNoTransactionControl(sql, file) {
  if (/^\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?)\s*;\s*$/im.test(sql)) {
    throw gateError("MIGRATION_TRANSACTION_CONTROL_FORBIDDEN", { migration: file });
  }
}
