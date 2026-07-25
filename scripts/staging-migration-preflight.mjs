import {
  PLANNED_MIGRATIONS,
  assertAllowedTarget,
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

  const baseline = (await client.query(`SELECT
    to_regclass('public.evidence_anchors') IS NOT NULL AS evidence_anchors,
    to_regclass('public.evidence_events') IS NOT NULL AS evidence_events,
    to_regclass('public.webhook_deliveries') IS NOT NULL AS webhook_deliveries,
    to_regclass('public.webhook_endpoints') IS NOT NULL AS webhook_endpoints`)).rows[0];
  const uuidOssp = (await client.query(
    "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') AS present",
  )).rows[0]?.present;
  const privileges = (await client.query(`SELECT
    has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
    has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create`)).rows[0];
  const ownership = (await client.query(`SELECT bool_and(c.relowner = current_user::regrole::oid) AS owns_baseline
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY($1::text[])`, [[
    "evidence_anchors",
    "evidence_events",
    "webhook_deliveries",
    "webhook_endpoints",
    "schema_migrations",
  ]])).rows[0]?.owns_baseline;
  const locks = (await client.query(`SELECT
    count(*) FILTER (WHERE NOT granted)::int AS waiting,
    count(*) FILTER (WHERE granted AND mode = 'AccessExclusiveLock')::int AS access_exclusive
    FROM pg_locks
    WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())`)).rows[0];
  const enumReconciling = (await client.query(`SELECT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'evidence_anchor_status' AND e.enumlabel = 'reconciling'
  ) AS present`)).rows[0]?.present;
  const actualLedger = await readLedger(client);
  const ledger = compareExactLedger(
    actualLedger,
    expectedLedgerForPhase(expectedBaselineLedger(), "preflight"),
  );
  const plannedPresent = PLANNED_MIGRATIONS.filter((id) => actualLedger.includes(id));
  const anchorRisks = (await client.query(`SELECT
    count(*)::int AS anchors,
    count(*) FILTER (WHERE tx_hash IS NOT NULL)::int AS anchors_with_tx_hash,
    (SELECT count(*)::int FROM (
      SELECT lower(tx_hash) FROM evidence_anchors WHERE tx_hash IS NOT NULL
      GROUP BY lower(tx_hash) HAVING count(*) > 1
    ) duplicate_groups) AS duplicate_tx_hash_groups
    FROM evidence_anchors`)).rows[0];
  const webhookRisks = (await client.query(`SELECT
    count(*)::int AS deliveries,
    count(*) FILTER (WHERE endpoint.id IS NULL)::int AS orphan_endpoint_rows,
    count(*) FILTER (WHERE endpoint.url IS NULL OR btrim(endpoint.url) = '')::int AS missing_endpoint_url_rows,
    (SELECT count(*)::int FROM (
      SELECT endpoint_id, COALESCE(NULLIF(payload->>'id', ''), 'legacy:' || id::text)
      FROM webhook_deliveries
      GROUP BY endpoint_id, COALESCE(NULLIF(payload->>'id', ''), 'legacy:' || id::text)
      HAVING count(*) > 1
    ) duplicate_groups) AS prospective_duplicate_event_groups
    FROM webhook_deliveries delivery
    LEFT JOIN webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id`)).rows[0];
  const residualV2 = (await client.query(`SELECT
    to_regclass('public.evidence_anchor_members') IS NOT NULL AS evidence_anchor_members,
    to_regclass('public.evidence_anchor_attempts') IS NOT NULL AS evidence_anchor_attempts,
    to_regclass('public.iota_executor_publications') IS NOT NULL AS iota_executor_publications,
    to_regclass('public.admin_login_attempt_buckets') IS NOT NULL AS admin_login_attempt_buckets,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'evidence_anchors'
        AND column_name = ANY($1::text[])
    ) AS evidence_anchor_v2_columns`, [[
    "proof_id", "memo_hash", "public_resource_id", "contract_version", "idempotency_key",
  ]])).rows[0];
  const schemaFingerprint = await relevantSchemaFingerprint(client);
  await client.query("ROLLBACK");

  const baselineReady = Object.values(baseline).every(Boolean);
  const ok = Boolean(
    baselineReady
    && uuidOssp
    && privileges?.schema_usage
    && privileges?.schema_create
    && ownership
    && locks?.waiting === 0
    && locks?.access_exclusive === 0
    && !enumReconciling
    && ledger.ok
    && plannedPresent.length === 0
    && Object.values(residualV2).every((value) => !value)
    && Number(anchorRisks?.duplicate_tx_hash_groups || 0) === 0
    && Number(webhookRisks?.orphan_endpoint_rows || 0) === 0
    && Number(webhookRisks?.missing_endpoint_url_rows || 0) === 0
    && Number(webhookRisks?.prospective_duplicate_event_groups || 0) === 0
  );
  console.log(JSON.stringify({
    ok,
    gate: "migration_preflight",
    target,
    schema_fingerprint: schemaFingerprint,
    baseline,
    uuid_ossp: Boolean(uuidOssp),
    privileges: { ...privileges, owns_baseline: Boolean(ownership) },
    locks,
    ledger,
    planned_migrations_present: plannedPresent,
    residual_v2_schema: residualV2,
    enum_reconciling_present: Boolean(enumReconciling),
    data_preconditions: { evidence_anchors: anchorRisks, webhook_deliveries: webhookRisks },
  }));
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    ok: false,
    gate: "migration_preflight",
    ...safeFailure(error, "MIGRATION_PREFLIGHT_FAILED"),
    ...(target ? { target } : {}),
  }));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
