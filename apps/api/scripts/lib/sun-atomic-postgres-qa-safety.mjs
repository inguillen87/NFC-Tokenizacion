export const SUN_ATOMIC_QA_CONFIRMATION_PREFIX = "RUN_NEXID_SUN_ATOMIC_QA";

export const SUN_ATOMIC_REQUIRED_MIGRATIONS = Object.freeze([
  "20260728120000_0062_sun_atomic_persistence.sql",
  "20260728180000_0066_tag_lifecycle_governance.sql",
  "20260802240000_0089_sun_carrier_trust_state.sql",
  "20260802280000_0093_sun_tt_durable_truth_binding.sql",
  "20260802320000_0097_sun_demo_replay_isolation.sql",
]);

const DATABASE_NAME_PATTERN = /^codex_qa_[a-z0-9][a-z0-9_]{0,47}$/;
const ENDPOINT_ID_PATTERN = /^ep-[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/;
const NEON_HOST_PATTERN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/;

function required(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required; this validator never falls back to DATABASE_URL.`);
  }
  return value;
}

function parsePostgresUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NEXID_SUN_ATOMIC_QA_DATABASE_URL must be an absolute PostgreSQL URL.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("NEXID_SUN_ATOMIC_QA_DATABASE_URL must use postgres:// or postgresql://.");
  }
  // node-postgres/libpq query parameters can override host, user, port and
  // TLS behavior. Reject the complete override surface before pg sees it.
  if (parsed.search || parsed.hash) {
    throw new Error("NEXID_SUN_ATOMIC_QA_DATABASE_URL must not include query parameters or fragments.");
  }
  return parsed;
}

export function sunAtomicQaConfirmation({ expectedEndpointId, databaseName }) {
  return `${SUN_ATOMIC_QA_CONFIRMATION_PREFIX}:${expectedEndpointId}:${databaseName}`;
}

export function readSunAtomicPostgresQaConfig(env = process.env) {
  const nodeEnvironment = String(env.NODE_ENV || "").trim().toLowerCase();
  const vercelEnvironment = String(env.VERCEL_ENV || "").trim().toLowerCase();
  if (nodeEnvironment !== "test" || vercelEnvironment !== "test") {
    throw new Error("SUN atomic PostgreSQL QA requires NODE_ENV=test and VERCEL_ENV=test.");
  }

  const databaseUrl = parsePostgresUrl(required(env, "NEXID_SUN_ATOMIC_QA_DATABASE_URL"));
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
  if (!DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error("Disposable SUN QA database name must match codex_qa_[a-z0-9_]+.");
  }
  if (!databaseUrl.username || !databaseUrl.password) {
    throw new Error("Disposable SUN QA database URL must include its dedicated role and password.");
  }

  const expectedHost = required(env, "NEXID_SUN_ATOMIC_QA_EXPECTED_HOST").toLowerCase();
  if (!NEON_HOST_PATTERN.test(expectedHost)) {
    throw new Error("NEXID_SUN_ATOMIC_QA_EXPECTED_HOST must be an exact *.neon.tech hostname.");
  }
  const hostname = databaseUrl.hostname.toLowerCase();
  if (hostname !== expectedHost) {
    throw new Error("SUN atomic QA database hostname does not match the explicitly expected host.");
  }

  const expectedEndpointId = required(env, "NEXID_SUN_ATOMIC_QA_EXPECTED_ENDPOINT_ID").toLowerCase();
  if (!ENDPOINT_ID_PATTERN.test(expectedEndpointId)) {
    throw new Error("NEXID_SUN_ATOMIC_QA_EXPECTED_ENDPOINT_ID is invalid.");
  }
  const hostnameEndpointId = hostname.split(".", 1)[0].replace(/-pooler$/, "");
  if (hostnameEndpointId !== expectedEndpointId) {
    throw new Error("SUN atomic QA hostname is not bound to the explicitly expected Neon endpoint.");
  }

  const expectedConfirmation = sunAtomicQaConfirmation({ expectedEndpointId, databaseName });
  if (required(env, "NEXID_SUN_ATOMIC_QA_CONFIRMATION") !== expectedConfirmation) {
    throw new Error(`NEXID_SUN_ATOMIC_QA_CONFIRMATION must equal ${expectedConfirmation}.`);
  }

  return Object.freeze({
    databaseUrl: databaseUrl.toString(),
    databaseName,
    databaseRole: decodeURIComponent(databaseUrl.username),
    expectedEndpointId,
    hostname,
    port: databaseUrl.port || "5432",
    safeTarget: `${hostname}:${databaseUrl.port || "5432"}/${databaseName}`,
  });
}

export async function assertSunAtomicPostgresQaTarget(client, config) {
  const identity = (await client.query(`SELECT
    current_database() AS database_name,
    current_user AS database_role,
    current_setting('neon.endpoint_id', true) AS endpoint_id,
    current_setting('transaction_read_only') AS transaction_read_only,
    current_setting('server_version_num')::integer AS server_version_number`)).rows[0] || {};

  if (String(identity.database_name || "") !== config.databaseName) {
    throw new Error("sun_atomic_qa_database_identity_mismatch");
  }
  if (String(identity.database_role || "") !== config.databaseRole) {
    throw new Error("sun_atomic_qa_database_role_mismatch");
  }
  if (String(identity.endpoint_id || "").toLowerCase() !== config.expectedEndpointId) {
    throw new Error("sun_atomic_qa_neon_endpoint_mismatch");
  }
  if (String(identity.transaction_read_only || "").toLowerCase() !== "off") {
    throw new Error("sun_atomic_qa_database_is_read_only");
  }
  if (Number(identity.server_version_number || 0) < 140000) {
    throw new Error("sun_atomic_qa_postgres_version_unsupported");
  }

  const capability = (await client.query(`SELECT
    to_regclass('public.tenants') IS NOT NULL AS tenants,
    to_regclass('public.batches') IS NOT NULL AS batches,
    to_regclass('public.tags') IS NOT NULL AS tags,
    to_regclass('public.events') IS NOT NULL AS events,
    to_regclass('public.sun_tt_truth_receipts') IS NOT NULL AS tt_truth_receipts,
    to_regclass('public.sun_automated_fetch_quarantines') IS NOT NULL AS automated_fetch_quarantines,
    to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NOT NULL AS wrapper,
    to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)') IS NOT NULL AS base_0062,
    to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)') IS NOT NULL AS base_pre_tt_0093,
    to_regprocedure('public.nexid_sun_tt_durable_truth_v1_capability()') IS NOT NULL AS tt_truth_capability,
    to_regprocedure('public.nexid_sun_demo_replay_isolation_v1_capability()') IS NOT NULL AS demo_replay_isolation_capability,
    to_regprocedure('public.nexid_classify_sun_automated_fetch_user_agent_v1(text)') IS NOT NULL AS automated_fetch_classifier,
    COALESCE((
      SELECT procedure_row.prosecdef
      FROM pg_proc procedure_row
      WHERE procedure_row.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')
    ), false) AS base_0062_security_definer,
    EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      JOIN pg_proc trigger_function ON trigger_function.oid = trigger_row.tgfoid
      WHERE trigger_row.tgrelid = to_regclass('public.sun_tt_truth_receipts')
        AND trigger_row.tgname = 'trg_sun_tt_truth_receipts_append_only'
        AND trigger_function.proname = 'nexid_sun_tt_truth_receipt_immutable_v1'
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled IN ('O', 'A')
    ) AS tt_truth_append_only,
    EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      JOIN pg_proc trigger_function ON trigger_function.oid = trigger_row.tgfoid
      WHERE trigger_row.tgrelid = to_regclass('public.sun_automated_fetch_quarantines')
        AND trigger_row.tgname = 'trg_sun_automated_fetch_quarantines_append_only'
        AND trigger_function.proname = 'nexid_sun_automated_fetch_quarantine_immutable_v1'
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled IN ('O', 'A')
    ) AS automated_fetch_append_only,
    EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      JOIN pg_proc trigger_function ON trigger_function.oid = trigger_row.tgfoid
      WHERE trigger_row.tgrelid = to_regclass('public.events')
        AND trigger_row.tgname = 'trg_events_capture_sun_automated_fetch_v1'
        AND trigger_function.proname = 'nexid_capture_sun_automated_fetch_quarantine_v1'
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled IN ('O', 'A')
    ) AS automated_fetch_capture,
    (SELECT count(*)::integer FROM tenants) AS tenant_count,
    (SELECT count(*)::integer FROM batches) AS batch_count,
    (SELECT count(*)::integer FROM tags) AS tag_count,
    (SELECT count(*)::integer FROM events) AS event_count,
    (SELECT count(*)::integer FROM public.sun_automated_fetch_quarantines) AS automated_fetch_quarantine_count,
    (SELECT count(*)::integer
      FROM information_schema.columns column_row
      WHERE column_row.table_schema = 'public'
        AND column_row.table_name = 'sun_automated_fetch_quarantines'
        AND lower(column_row.column_name) = 'user_agent'
    ) AS automated_fetch_raw_ua_column_count,
    COALESCE((
      SELECT array_agg(id ORDER BY id)
      FROM schema_migrations
      WHERE id = ANY($1::text[])
    ), ARRAY[]::text[]) AS applied_migrations`, [SUN_ATOMIC_REQUIRED_MIGRATIONS])).rows[0] || {};

  if (!capability.tenants || !capability.batches || !capability.tags || !capability.events) {
    throw new Error("sun_atomic_qa_required_relations_missing");
  }
  if (!capability.wrapper || !capability.base_0062) {
    throw new Error("sun_atomic_qa_0062_0066_functions_missing");
  }
  if (!capability.tt_truth_receipts
    || !capability.base_pre_tt_0093
    || !capability.tt_truth_capability
    || !capability.base_0062_security_definer
    || !capability.tt_truth_append_only) {
    throw new Error("sun_atomic_qa_0093_durable_tt_contract_missing");
  }
  if (!capability.automated_fetch_quarantines
    || !capability.demo_replay_isolation_capability
    || !capability.automated_fetch_classifier
    || !capability.automated_fetch_append_only
    || !capability.automated_fetch_capture
    || Number(capability.automated_fetch_raw_ua_column_count || 0) !== 0) {
    throw new Error("sun_atomic_qa_0097_demo_isolation_quarantine_contract_missing");
  }

  const ttTruthContract = (await client.query(`SELECT
    public.nexid_sun_tt_durable_truth_v1_capability() AS capability_version,
    (SELECT count(*)::integer FROM public.sun_tt_truth_receipts) AS receipt_count,
    (SELECT count(*)::integer
      FROM information_schema.columns column_row
      WHERE column_row.table_schema = 'public'
        AND column_row.table_name = 'sun_tt_truth_receipts'
        AND lower(column_row.column_name) = ANY($1::text[])
    ) AS forbidden_column_count`, [[
      "uid", "uid_hex", "resolved_uid_hex", "tenant_slug", "raw_query",
      "user_agent", "ip", "ip_hash", "geo_city", "geo_country", "lat", "lng",
      "email", "phone", "key", "key_hex", "k_meta", "k_file", "secret",
      "password", "token", "authorization", "cookie", "session_id",
    ]])).rows[0] || {};

  if (String(ttTruthContract.capability_version || "") !== "sun-tt-durable-truth-binding/v1") {
    throw new Error("sun_atomic_qa_0093_capability_version_mismatch");
  }
  if (Number(ttTruthContract.forbidden_column_count || 0) !== 0) {
    throw new Error("sun_atomic_qa_0093_receipt_sensitive_columns_present");
  }
  const businessRowCount = [
    capability.tenant_count,
    capability.batch_count,
    capability.tag_count,
    capability.event_count,
    capability.automated_fetch_quarantine_count,
    ttTruthContract.receipt_count,
  ].reduce((total, value) => total + Number(value || 0), 0);
  if (businessRowCount !== 0) {
    throw new Error(`sun_atomic_qa_business_tables_not_empty:${businessRowCount}`);
  }
  const appliedMigrations = Array.isArray(capability.applied_migrations)
    ? capability.applied_migrations.map(String)
    : [];
  if (appliedMigrations.length !== SUN_ATOMIC_REQUIRED_MIGRATIONS.length
    || SUN_ATOMIC_REQUIRED_MIGRATIONS.some((migration) => !appliedMigrations.includes(migration))) {
    throw new Error("sun_atomic_qa_required_migration_ledger_incomplete");
  }

  return Object.freeze({
    databaseName: String(identity.database_name),
    databaseRole: String(identity.database_role),
    endpointId: String(identity.endpoint_id),
    postgresVersionNumber: Number(identity.server_version_number),
    businessRowCount,
    appliedMigrations,
    ttTruthCapability: String(ttTruthContract.capability_version),
  });
}

export function sanitizeSunAtomicQaFailure(error, config = null) {
  const raw = error instanceof Error ? error.message : "sun_atomic_postgres_qa_failed";
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted_database_url]")
    .replaceAll(config?.databaseUrl || "__no_configured_database_url__", "[redacted_database_url]")
    .slice(0, 500);
}
