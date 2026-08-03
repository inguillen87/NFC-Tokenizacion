import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  assertSunAtomicPostgresQaTarget,
  readSunAtomicPostgresQaConfig,
  sanitizeSunAtomicQaFailure,
} from "./lib/sun-atomic-postgres-qa-safety.mjs";

export const CONTROL_PLANE_REQUIRED_MIGRATIONS = Object.freeze([
  "20260802113000_0077_tenant_api_key_lifecycle.sql",
  "20260802130000_0078_webhook_destination_cutover.sql",
  "20260802150000_0079_supplier_order_atomic_create.sql",
  "20260802153000_0080_offline_scan_history_index.sql",
  "20260802160000_0081_supplier_manifest_atomic_import.sql",
]);

export const CONTROL_PLANE_API_KEY_CREATE_SQL = `
  SELECT *
  FROM public.nexid_create_tenant_api_key_v1($1::jsonb)
`;

export const WEBHOOK_DELIVERY_INSERT_SQL = `
  INSERT INTO webhook_deliveries (
    endpoint_id,
    endpoint_url,
    destination_version,
    event_id,
    event_name,
    payload,
    status,
    ok,
    next_attempt_at
  ) VALUES (
    $1::uuid,
    $2,
    $3::bigint,
    $4,
    'qa.control_plane',
    $5::jsonb,
    'pending',
    false,
    now()
  )
  RETURNING
    id::text AS id,
    endpoint_id::text AS endpoint_id,
    endpoint_url,
    destination_version::text AS destination_version,
    event_id,
    status
`;

// This is the database portion of the current PATCH cutover contract. The
// endpoint row lock and the migration-owned delivery FOR SHARE trigger are the
// serialization boundary under test. Only URL fingerprints enter audit data.
export const WEBHOOK_CUTOVER_SQL = `
  WITH locked AS MATERIALIZED (
    SELECT endpoint.*
    FROM webhook_endpoints endpoint
    WHERE endpoint.id = $1::uuid
      AND endpoint.tenant_id = $2::uuid
      AND endpoint.deleted_at IS NULL
      AND endpoint.updated_at = $9::timestamptz
    FOR UPDATE
  ), eligible AS MATERIALIZED (
    SELECT locked.*
    FROM locked
    WHERE NOT EXISTS (
      SELECT 1
      FROM webhook_deliveries delivery
      WHERE delivery.endpoint_id = locked.id
        AND delivery.status = 'processing'
        AND COALESCE(delivery.locked_at, delivery.last_attempt_at, delivery.created_at)
          > now() - interval '10 minutes'
    )
  ), updated AS (
    UPDATE webhook_endpoints endpoint
    SET
      url = $3,
      updated_by = $4::uuid,
      updated_at = now()
    FROM eligible
    WHERE endpoint.id = eligible.id
    RETURNING
      endpoint.*,
      eligible.url AS previous_url,
      eligible.destination_version AS previous_destination_version
  ), cancelled_deliveries AS (
    UPDATE webhook_deliveries delivery
    SET
      status = 'dead_letter',
      ok = false,
      status_code = NULL,
      next_attempt_at = NULL,
      last_error = 'webhook_destination_changed',
      delivered_at = NULL,
      locked_at = NULL,
      lock_token = NULL
    FROM updated
    WHERE updated.url IS DISTINCT FROM updated.previous_url
      AND delivery.endpoint_id = updated.id
      AND (
        delivery.status IN ('pending', 'retry_scheduled')
        OR (
          delivery.status = 'processing'
          AND COALESCE(delivery.locked_at, delivery.last_attempt_at, delivery.created_at)
            <= now() - interval '10 minutes'
        )
      )
    RETURNING delivery.id
  ), audit AS (
    INSERT INTO webhook_endpoint_audit_events (
      endpoint_id,
      tenant_id,
      actor_id,
      event_type,
      secret_version,
      secret_fingerprint,
      previous_secret_version,
      previous_secret_fingerprint,
      overlap_valid_until,
      request_id,
      ip_address,
      user_agent,
      metadata_json
    )
    SELECT
      updated.id,
      updated.tenant_id,
      $4::uuid,
      'webhook_destination_changed',
      updated.signing_secret_version,
      updated.signing_secret_fingerprint,
      updated.signing_secret_previous_version,
      updated.signing_secret_previous_fingerprint,
      updated.signing_secret_previous_valid_until,
      $7,
      NULL,
      $8,
      jsonb_build_object(
        'changed_fields', '["url"]'::jsonb,
        'retired_delivery_count', (SELECT count(*) FROM cancelled_deliveries),
        'previous_destination_version', updated.previous_destination_version,
        'destination_version', updated.destination_version,
        'previous_destination_fingerprint', $5::text,
        'destination_fingerprint', $6::text
      )
    FROM updated
    RETURNING id
  )
  SELECT
    updated.id::text AS endpoint_id,
    updated.previous_destination_version::text AS previous_destination_version,
    updated.destination_version::text AS destination_version,
    (SELECT count(*)::integer FROM cancelled_deliveries) AS retired_delivery_count,
    (SELECT id::text FROM audit) AS audit_id
  FROM updated
`;

const RECEIPT_FORBIDDEN_FIELD = /(^|_)(key_hash|raw_secret|secret|credential)($|_)/i;

function sha256Hex(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function webhookDestinationFingerprint(value) {
  return `sha256:${sha256Hex(value).slice(0, 32)}`;
}

export function buildSyntheticApiKeyCreateInput({
  tenantId,
  actorId,
  runId,
  lane,
  syntheticCredential,
}) {
  if (!syntheticCredential) throw new Error("control_plane_qa_synthetic_credential_required");
  const keyHash = sha256Hex(syntheticCredential);
  const input = Object.freeze({
    tenant_id: tenantId,
    actor_id: actorId,
    name: `QA control plane ${lane}`,
    key_prefix: `qa_${runId}_${lane}`,
    key_hash: keyHash,
    scopes: ["sdk:verify"],
    max_active_keys: 1,
    request_id: `qa-control-plane:${runId}:${lane}`,
    user_agent: "nexid-control-plane-postgres-qa/1",
    ip_address: "192.0.2.10",
  });
  return Object.freeze({ input, keyHash });
}

function collectForbiddenFieldPaths(value, pathPrefix = "", paths = []) {
  if (!value || typeof value !== "object") return paths;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectForbiddenFieldPaths(entry, `${pathPrefix}[${index}]`, paths));
    return paths;
  }
  for (const [key, nested] of Object.entries(value)) {
    const pathName = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (RECEIPT_FORBIDDEN_FIELD.test(key)) paths.push(pathName);
    collectForbiddenFieldPaths(nested, pathName, paths);
  }
  return paths;
}

export function assertLifecycleReceiptContainsNoCredentialMaterial(receipt, prohibitedValues = []) {
  const forbiddenFields = collectForbiddenFieldPaths(receipt);
  assert.deepEqual(
    forbiddenFields,
    [],
    `tenant API-key receipt exposes forbidden credential fields: ${forbiddenFields.join(",")}`,
  );
  const serialized = JSON.stringify(receipt);
  for (const value of prohibitedValues) {
    if (!value) continue;
    assert.equal(
      serialized.includes(String(value)),
      false,
      "tenant API-key receipt contains prohibited credential material",
    );
  }
  return true;
}

export function summarizeApiKeyCreateResult(row) {
  return Object.freeze({
    outcome: String(row?.outcome || ""),
    api_key_id: row?.id ? String(row.id) : null,
    status: row?.status ? String(row.status) : null,
    active_count: Number(row?.active_count || 0),
    receipt_id: row?.receipt_id ? String(row.receipt_id) : null,
  });
}

export function summarizeLifecycleReceipt(receipt) {
  return Object.freeze({
    receipt_id: receipt?.id ? String(receipt.id) : null,
    action: String(receipt?.action || ""),
    current_status: String(receipt?.current_status || ""),
    changed_fields: Array.isArray(receipt?.changed_fields) ? [...receipt.changed_fields] : [],
    request_fingerprint_present: /^sha256:[0-9a-f]{64}$/.test(String(receipt?.request_fingerprint || "")),
  });
}

export async function assertControlPlanePostgresQaCapabilities(client) {
  const capability = (await client.query(`SELECT
    to_regclass('public.users') IS NOT NULL AS users,
    to_regclass('public.tenant_api_keys') IS NOT NULL AS tenant_api_keys,
    to_regclass('public.tenant_api_key_lifecycle_receipts') IS NOT NULL AS api_key_receipts,
    to_regclass('public.webhook_endpoints') IS NOT NULL AS webhook_endpoints,
    to_regclass('public.webhook_deliveries') IS NOT NULL AS webhook_deliveries,
    to_regclass('public.webhook_endpoint_audit_events') IS NOT NULL AS webhook_audit,
    to_regprocedure('public.nexid_create_tenant_api_key_v1(jsonb)') IS NOT NULL AS api_key_create_function,
    to_regprocedure('public.nexid_supplier_order_create_v2_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)') IS NOT NULL
      AS supplier_order_atomic_create_functions,
    to_regclass('public.idx_offline_scan_events_tenant_history') IS NOT NULL
      AS offline_scan_history_index,
    to_regclass('public.tag_sun_payloads') IS NOT NULL
      AND to_regclass('public.uq_tags_uid_hex_global') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_manifest_import_v2_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)') IS NOT NULL
      AS supplier_manifest_atomic_import,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = to_regclass('public.tenant_api_keys')
        AND tgname = 'trg_tenant_api_key_lifecycle_guard_v1'
        AND NOT tgisinternal
    ) AS api_key_guard_trigger,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = to_regclass('public.tenant_api_key_lifecycle_receipts')
        AND tgname = 'trg_tenant_api_key_lifecycle_receipts_append_only'
        AND NOT tgisinternal
    ) AS api_key_receipt_trigger,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = to_regclass('public.webhook_endpoints')
        AND tgname = 'trg_webhook_destination_version_insert'
        AND NOT tgisinternal
    ) AS webhook_version_insert_trigger,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = to_regclass('public.webhook_endpoints')
        AND tgname = 'trg_webhook_destination_version_update'
        AND NOT tgisinternal
    ) AS webhook_version_trigger,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = to_regclass('public.webhook_deliveries')
        AND tgname = 'trg_webhook_delivery_destination_snapshot'
        AND NOT tgisinternal
    ) AS webhook_snapshot_trigger,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = to_regclass('public.webhook_deliveries')
        AND tgname = 'trg_webhook_delivery_identity_immutable'
        AND NOT tgisinternal
    ) AS webhook_identity_trigger,
    COALESCE((
      SELECT array_agg(id ORDER BY id)
      FROM schema_migrations
      WHERE id = ANY($1::text[])
    ), ARRAY[]::text[]) AS applied_migrations,
    COALESCE((
      SELECT array_agg(column_name ORDER BY column_name)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_api_key_lifecycle_receipts'
        AND column_name ~* '(^|_)(key_hash|raw_secret|secret|credential)($|_)'
    ), ARRAY[]::text[]) AS receipt_forbidden_columns`, [CONTROL_PLANE_REQUIRED_MIGRATIONS])).rows[0] || {};

  const relationFields = [
    "users",
    "tenant_api_keys",
    "api_key_receipts",
    "webhook_endpoints",
    "webhook_deliveries",
    "webhook_audit",
  ];
  if (relationFields.some((field) => capability[field] !== true)) {
    throw new Error("control_plane_qa_required_relations_missing");
  }
  const capabilityFields = [
    "api_key_create_function",
    "api_key_guard_trigger",
    "api_key_receipt_trigger",
    "webhook_version_insert_trigger",
    "webhook_version_trigger",
    "webhook_snapshot_trigger",
    "webhook_identity_trigger",
    "supplier_order_atomic_create_functions",
    "offline_scan_history_index",
    "supplier_manifest_atomic_import",
  ];
  if (capabilityFields.some((field) => capability[field] !== true)) {
    throw new Error("control_plane_qa_0077_0081_capabilities_missing");
  }
  const appliedMigrations = Array.isArray(capability.applied_migrations)
    ? capability.applied_migrations.map(String)
    : [];
  if (appliedMigrations.length !== CONTROL_PLANE_REQUIRED_MIGRATIONS.length
    || CONTROL_PLANE_REQUIRED_MIGRATIONS.some((migration) => !appliedMigrations.includes(migration))) {
    throw new Error("control_plane_qa_0077_0081_migration_ledger_incomplete");
  }
  const forbiddenColumns = Array.isArray(capability.receipt_forbidden_columns)
    ? capability.receipt_forbidden_columns.map(String)
    : [];
  if (forbiddenColumns.length > 0) {
    throw new Error(`control_plane_qa_receipt_credential_columns_present:${forbiddenColumns.join(",")}`);
  }

  const counts = (await client.query(`SELECT
    (SELECT count(*)::integer FROM tenant_api_keys) AS api_key_count,
    (SELECT count(*)::integer FROM tenant_api_key_lifecycle_receipts) AS api_key_receipt_count,
    (SELECT count(*)::integer FROM webhook_endpoints) AS webhook_endpoint_count,
    (SELECT count(*)::integer FROM webhook_deliveries) AS webhook_delivery_count,
    (SELECT count(*)::integer FROM webhook_endpoint_audit_events) AS webhook_audit_count`)).rows[0] || {};
  const businessRowCount = [
    counts.api_key_count,
    counts.api_key_receipt_count,
    counts.webhook_endpoint_count,
    counts.webhook_delivery_count,
    counts.webhook_audit_count,
  ].reduce((total, value) => total + Number(value || 0), 0);
  if (businessRowCount !== 0) {
    throw new Error(`control_plane_qa_business_tables_not_empty:${businessRowCount}`);
  }

  return Object.freeze({
    appliedMigrations,
    businessRowCount,
    receiptForbiddenColumns: Object.freeze(forbiddenColumns),
  });
}

function clientOptions(config, applicationName) {
  return {
    connectionString: config.databaseUrl,
    application_name: applicationName,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
    ssl: { rejectUnauthorized: true },
  };
}

async function backendPid(client) {
  return Number((await client.query("SELECT pg_backend_pid()::integer AS pid")).rows[0]?.pid || 0);
}

async function waitForLockWaiters(observer, backendPids, { advisoryOnly, timeoutMs = 5_000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = (await observer.query(`SELECT pid, wait_event_type, wait_event
      FROM pg_stat_activity
      WHERE pid = ANY($1::integer[])
        AND state = 'active'`, [backendPids])).rows;
    const waiting = new Map(rows
      .filter((row) => row.wait_event_type === "Lock")
      .filter((row) => !advisoryOnly || String(row.wait_event || "").toLowerCase() === "advisory")
      .map((row) => [Number(row.pid), String(row.wait_event || "unknown")]));
    if (backendPids.every((pid) => waiting.has(pid))) {
      return backendPids.map((pid) => Object.freeze({ pid, waitEvent: waiting.get(pid) }));
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(advisoryOnly
    ? "control_plane_qa_concurrent_advisory_wait_not_observed"
    : "control_plane_qa_webhook_row_lock_wait_not_observed");
}

async function invokeApiKeyCreate(client, input) {
  const rows = (await client.query(CONTROL_PLANE_API_KEY_CREATE_SQL, [JSON.stringify(input)])).rows;
  if (rows.length !== 1) throw new Error("control_plane_qa_api_key_result_missing");
  return rows[0];
}

function settle(promise) {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );
}

function unwrapSettled(result) {
  if (!result?.ok) throw result?.error || new Error("control_plane_qa_concurrent_call_failed");
  return result.value;
}

function buildFixture() {
  const runId = randomBytes(8).toString("hex");
  return Object.freeze({
    runId,
    tenantId: randomUUID(),
    actorId: randomUUID(),
    tenantSlug: `codex-qa-control-${runId}`,
    actorEmail: `qa-control-${runId}@example.invalid`,
    endpointId: randomUUID(),
    oldUrl: `https://qa-${runId}.example.invalid/webhooks/old`,
    newUrl: `https://qa-${runId}.example.invalid/webhooks/new`,
    forgedUrl: `https://forged-${runId}.example.invalid/not-authoritative`,
    oldEventId: `qa:${runId}:before-cutover`,
    newEventId: `qa:${runId}:during-cutover`,
  });
}

async function insertIdentityFixtures(client, fixture) {
  await client.query("BEGIN");
  try {
    await client.query(`INSERT INTO users (id, email, full_name, admin_status)
      VALUES ($1::uuid, $2, 'Control plane PostgreSQL QA', 'active')`, [
      fixture.actorId,
      fixture.actorEmail,
    ]);
    await client.query(`INSERT INTO tenants (id, slug, name, root_key_ct)
      VALUES ($1::uuid, $2, 'Control plane PostgreSQL QA', 'not-a-key:synthetic-validation-fixture')`, [
      fixture.tenantId,
      fixture.tenantSlug,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  }
}

async function runApiKeyRollback({ config, observer, fixture }) {
  const client = new pg.Client(clientOptions(config, `nexid_control_qa_api_key_rollback_${fixture.runId}`));
  const syntheticCredential = `qa-only-${randomBytes(32).toString("hex")}`;
  const material = buildSyntheticApiKeyCreateInput({
    tenantId: fixture.tenantId,
    actorId: fixture.actorId,
    runId: fixture.runId,
    lane: "rollback",
    syntheticCredential,
  });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    const created = await invokeApiKeyCreate(client, material.input);
    assert.equal(created.outcome, "created", "rollback transaction must create one provisional key");
    const receipt = (await client.query(`SELECT *
      FROM tenant_api_key_lifecycle_receipts
      WHERE id = $1::bigint AND api_key_id = $2::uuid`, [created.receipt_id, created.id])).rows[0] || null;
    assert.ok(receipt, "rollback transaction must see its provisional lifecycle receipt");
    assertLifecycleReceiptContainsNoCredentialMaterial(receipt, [syntheticCredential, material.keyHash]);
    const inside = (await client.query(`SELECT
      (SELECT count(*)::integer FROM tenant_api_keys WHERE tenant_id = $1::uuid) AS api_key_count,
      (SELECT count(*)::integer FROM tenant_api_key_lifecycle_receipts WHERE tenant_id = $1::uuid) AS receipt_count`, [
      fixture.tenantId,
    ])).rows[0];
    assert.equal(Number(inside.api_key_count), 1);
    assert.equal(Number(inside.receipt_count), 1);

    await client.query("ROLLBACK");
    transactionOpen = false;
    const after = (await observer.query(`SELECT
      (SELECT count(*)::integer FROM tenant_api_keys WHERE tenant_id = $1::uuid) AS api_key_count,
      (SELECT count(*)::integer FROM tenant_api_key_lifecycle_receipts WHERE tenant_id = $1::uuid) AS receipt_count`, [
      fixture.tenantId,
    ])).rows[0];
    assert.equal(Number(after.api_key_count), 0, "rolled-back key must not be externally visible");
    assert.equal(Number(after.receipt_count), 0, "rolled-back receipt must not be externally visible");
    return Object.freeze({
      provisional_result: summarizeApiKeyCreateResult(created),
      provisional_key_and_receipt_visible_in_transaction: true,
      key_and_receipt_absent_after_rollback: true,
    });
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => null);
    await client.end().catch(() => null);
  }
}

async function runApiKeyQuotaRace({ config, observer, fixture }) {
  const suffix = randomBytes(4).toString("hex");
  const blocker = new pg.Client(clientOptions(config, `nexid_control_qa_quota_blocker_${suffix}`));
  const first = new pg.Client(clientOptions(config, `nexid_control_qa_quota_a_${suffix}`));
  const second = new pg.Client(clientOptions(config, `nexid_control_qa_quota_b_${suffix}`));
  const credentials = [
    `qa-only-${randomBytes(32).toString("hex")}`,
    `qa-only-${randomBytes(32).toString("hex")}`,
  ];
  const materials = credentials.map((syntheticCredential, index) => buildSyntheticApiKeyCreateInput({
    tenantId: fixture.tenantId,
    actorId: fixture.actorId,
    runId: fixture.runId,
    lane: index === 0 ? "a" : "b",
    syntheticCredential,
  }));
  let blockerTransactionOpen = false;
  let firstTransactionOpen = false;
  let secondTransactionOpen = false;
  const calls = [];
  try {
    await Promise.all([blocker.connect(), first.connect(), second.connect()]);
    await blocker.query("BEGIN");
    blockerTransactionOpen = true;
    await blocker.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('tenant-api-key-quota:' || $1::uuid::text, 0))",
      [fixture.tenantId],
    );
    // Explicit transactions pin both sessions even when the disposable Neon
    // URL uses its pooler. The create wrapper's xact advisory lock is released
    // by each lane's COMMIT, allowing the other lane to continue.
    await Promise.all([first.query("BEGIN"), second.query("BEGIN")]);
    firstTransactionOpen = true;
    secondTransactionOpen = true;
    const pids = await Promise.all([backendPid(first), backendPid(second)]);

    calls.push(settle((async () => {
      const result = await invokeApiKeyCreate(first, materials[0].input);
      await first.query("COMMIT");
      firstTransactionOpen = false;
      return result;
    })()));
    calls.push(settle((async () => {
      const result = await invokeApiKeyCreate(second, materials[1].input);
      await second.query("COMMIT");
      secondTransactionOpen = false;
      return result;
    })()));
    const waits = await waitForLockWaiters(observer, pids, { advisoryOnly: true });
    await blocker.query("COMMIT");
    blockerTransactionOpen = false;

    const results = (await Promise.all(calls)).map(unwrapSettled);
    const summaries = results.map(summarizeApiKeyCreateResult);
    assert.deepEqual(
      summaries.map((entry) => entry.outcome).sort(),
      ["created", "quota_exceeded"],
      "max=1 race must commit exactly one key",
    );
    const persisted = (await observer.query(`SELECT
      count(*)::integer AS api_key_count,
      count(*) FILTER (WHERE key_hash = ANY($2::text[]))::integer AS matching_synthetic_hash_count
      FROM tenant_api_keys
      WHERE tenant_id = $1::uuid`, [fixture.tenantId, materials.map((entry) => entry.keyHash)])).rows[0];
    assert.equal(Number(persisted.api_key_count), 1);
    assert.equal(Number(persisted.matching_synthetic_hash_count), 1);
    const receipts = (await observer.query(`SELECT *
      FROM tenant_api_key_lifecycle_receipts
      WHERE tenant_id = $1::uuid
      ORDER BY id`, [fixture.tenantId])).rows;
    assert.equal(receipts.length, 1, "only the committed create may produce a receipt");
    for (const receipt of receipts) {
      assertLifecycleReceiptContainsNoCredentialMaterial(receipt, [
        ...credentials,
        ...materials.map((entry) => entry.keyHash),
      ]);
    }
    return Object.freeze({
      two_connections_waited_on_quota_lock: waits.length === 2,
      outcomes: Object.freeze(summaries),
      persisted_active_key_count: Number(persisted.api_key_count),
      persisted_receipts: Object.freeze(receipts.map(summarizeLifecycleReceipt)),
    });
  } finally {
    if (blockerTransactionOpen) await blocker.query("ROLLBACK").catch(() => null);
    if (firstTransactionOpen) await first.query("ROLLBACK").catch(() => null);
    if (secondTransactionOpen) await second.query("ROLLBACK").catch(() => null);
    await Promise.allSettled(calls);
    await Promise.allSettled([blocker.end(), first.end(), second.end()]);
  }
}

async function insertWebhookFixture(observer, fixture) {
  await observer.query("BEGIN");
  try {
    const endpoint = (await observer.query(`INSERT INTO webhook_endpoints (
      id, tenant_id, name, url, enabled, events, signing_secret,
      signature_version, destination_version, created_by, updated_by
    ) VALUES (
      $1::uuid, $2::uuid, 'Control plane PostgreSQL QA', $3, true,
      '["qa.control_plane"]'::jsonb, NULL, 'v2', 999, $4::uuid, $4::uuid
    )
    RETURNING
      id::text AS id,
      destination_version::text AS destination_version,
      updated_at::text AS updated_at`, [
      fixture.endpointId,
      fixture.tenantId,
      fixture.oldUrl,
      fixture.actorId,
    ])).rows[0];
    assert.equal(endpoint.destination_version, "1", "endpoint insert trigger owns initial version");
    const delivery = (await observer.query(WEBHOOK_DELIVERY_INSERT_SQL, [
      fixture.endpointId,
      fixture.forgedUrl,
      999,
      fixture.oldEventId,
      JSON.stringify({ qa_fixture: "control_plane_postgres_v1", phase: "before_cutover" }),
    ])).rows[0];
    assert.equal(delivery.endpoint_url, fixture.oldUrl, "delivery trigger must reject caller URL authority");
    assert.equal(delivery.destination_version, "1", "delivery trigger must reject caller version authority");
    await observer.query("COMMIT");
    return Object.freeze({ endpoint, delivery });
  } catch (error) {
    await observer.query("ROLLBACK").catch(() => null);
    throw error;
  }
}

async function runWebhookCutoverRace({ config, observer, fixture }) {
  const seeded = await insertWebhookFixture(observer, fixture);
  const suffix = randomBytes(4).toString("hex");
  const cutover = new pg.Client(clientOptions(config, `nexid_control_qa_webhook_cutover_${suffix}`));
  const inserter = new pg.Client(clientOptions(config, `nexid_control_qa_webhook_insert_${suffix}`));
  let cutoverTransactionOpen = false;
  let inserterTransactionOpen = false;
  let insertCall = null;
  try {
    await Promise.all([cutover.connect(), inserter.connect()]);
    await inserter.query("BEGIN");
    inserterTransactionOpen = true;
    const inserterPid = await backendPid(inserter);
    await cutover.query("BEGIN");
    cutoverTransactionOpen = true;
    const previousFingerprint = webhookDestinationFingerprint(fixture.oldUrl);
    const destinationFingerprint = webhookDestinationFingerprint(fixture.newUrl);
    const cutoverResult = (await cutover.query(WEBHOOK_CUTOVER_SQL, [
      fixture.endpointId,
      fixture.tenantId,
      fixture.newUrl,
      fixture.actorId,
      previousFingerprint,
      destinationFingerprint,
      `qa-control-plane:${fixture.runId}:webhook-cutover`,
      "nexid-control-plane-postgres-qa/1",
      seeded.endpoint.updated_at,
    ])).rows[0] || null;
    assert.ok(cutoverResult, "webhook cutover must lock and update the fixture endpoint");
    assert.equal(cutoverResult.previous_destination_version, "1");
    assert.equal(cutoverResult.destination_version, "2");
    assert.equal(Number(cutoverResult.retired_delivery_count), 1);

    insertCall = settle((async () => {
      const inserted = (await inserter.query(WEBHOOK_DELIVERY_INSERT_SQL, [
        fixture.endpointId,
        fixture.forgedUrl,
        999,
        fixture.newEventId,
        JSON.stringify({ qa_fixture: "control_plane_postgres_v1", phase: "during_cutover" }),
      ])).rows[0];
      await inserter.query("COMMIT");
      inserterTransactionOpen = false;
      return inserted;
    })());
    const waits = await waitForLockWaiters(observer, [inserterPid], { advisoryOnly: false });
    await cutover.query("COMMIT");
    cutoverTransactionOpen = false;
    const concurrentDelivery = unwrapSettled(await insertCall);

    const endpoint = (await observer.query(`SELECT
      id::text AS id, url, destination_version::text AS destination_version
      FROM webhook_endpoints
      WHERE id = $1::uuid`, [fixture.endpointId])).rows[0];
    assert.equal(endpoint.url, fixture.newUrl);
    assert.equal(endpoint.destination_version, "2");

    const deliveries = (await observer.query(`SELECT
      id::text AS id,
      endpoint_url,
      destination_version::text AS destination_version,
      event_id,
      status,
      ok,
      next_attempt_at,
      last_error,
      locked_at,
      lock_token
      FROM webhook_deliveries
      WHERE id = ANY($1::bigint[])
      ORDER BY event_id`, [[seeded.delivery.id, concurrentDelivery.id]])).rows;
    const oldDelivery = deliveries.find((entry) => entry.event_id === fixture.oldEventId);
    const newDelivery = deliveries.find((entry) => entry.event_id === fixture.newEventId);
    assert.ok(oldDelivery);
    assert.ok(newDelivery);
    assert.equal(oldDelivery.endpoint_url, fixture.oldUrl, "cutover cannot rebind old delivery identity");
    assert.equal(oldDelivery.destination_version, "1");
    assert.equal(oldDelivery.status, "dead_letter");
    assert.equal(oldDelivery.ok, false);
    assert.equal(oldDelivery.next_attempt_at, null);
    assert.equal(oldDelivery.last_error, "webhook_destination_changed");
    assert.equal(oldDelivery.locked_at, null);
    assert.equal(oldDelivery.lock_token, null);
    assert.equal(newDelivery.endpoint_url, fixture.newUrl, "blocked insert must snapshot the committed destination");
    assert.equal(newDelivery.destination_version, "2");
    assert.equal(newDelivery.status, "pending");
    assert.notEqual(newDelivery.endpoint_url, fixture.forgedUrl);

    const audit = (await observer.query(`SELECT
      id::text AS id,
      event_type,
      metadata_json
      FROM webhook_endpoint_audit_events
      WHERE id = $1::bigint`, [cutoverResult.audit_id])).rows[0] || null;
    assert.ok(audit);
    assert.equal(audit.event_type, "webhook_destination_changed");
    assert.equal(audit.metadata_json.previous_destination_version, 1);
    assert.equal(audit.metadata_json.destination_version, 2);
    assert.equal(Number(audit.metadata_json.retired_delivery_count), 1);
    assert.equal(audit.metadata_json.previous_destination_fingerprint, previousFingerprint);
    assert.equal(audit.metadata_json.destination_fingerprint, destinationFingerprint);
    const serializedAudit = JSON.stringify(audit);
    assert.equal(serializedAudit.includes(fixture.oldUrl), false, "audit must not contain the previous raw URL");
    assert.equal(serializedAudit.includes(fixture.newUrl), false, "audit must not contain the current raw URL");
    assert.equal(serializedAudit.includes(fixture.forgedUrl), false, "audit must not contain caller-forged URL input");

    return Object.freeze({
      concurrent_insert_waited_on_endpoint_lock: waits.length === 1,
      observed_wait_event: waits[0]?.waitEvent || "unknown",
      endpoint_destination_version: Number(endpoint.destination_version),
      old_open_delivery: Object.freeze({
        destination_version: Number(oldDelivery.destination_version),
        status: oldDelivery.status,
        identity_url_unchanged: oldDelivery.endpoint_url === fixture.oldUrl,
      }),
      concurrent_delivery: Object.freeze({
        destination_version: Number(newDelivery.destination_version),
        status: newDelivery.status,
        snapshotted_committed_url: newDelivery.endpoint_url === fixture.newUrl,
        caller_url_and_version_overridden: concurrentDelivery.endpoint_url === fixture.newUrl
          && concurrentDelivery.destination_version === "2",
      }),
      audit: Object.freeze({
        event_type: audit.event_type,
        raw_urls_absent: true,
        previous_destination_fingerprint: previousFingerprint,
        destination_fingerprint: destinationFingerprint,
        retired_delivery_count: Number(audit.metadata_json.retired_delivery_count),
      }),
    });
  } finally {
    if (cutoverTransactionOpen) await cutover.query("ROLLBACK").catch(() => null);
    if (inserterTransactionOpen) await inserter.query("ROLLBACK").catch(() => null);
    if (insertCall) await insertCall.catch(() => null);
    await Promise.allSettled([cutover.end(), inserter.end()]);
  }
}

export async function runControlPlanePostgresQa(env = process.env) {
  const config = readSunAtomicPostgresQaConfig(env);
  const observer = new pg.Client(clientOptions(
    config,
    `nexid_control_qa_observer_${randomBytes(4).toString("hex")}`,
  ));
  const fixture = buildFixture();
  await observer.connect();
  try {
    const basePreflight = await assertSunAtomicPostgresQaTarget(observer, config);
    const controlPlanePreflight = await assertControlPlanePostgresQaCapabilities(observer);
    await insertIdentityFixtures(observer, fixture);
    const rollback = await runApiKeyRollback({ config, observer, fixture });
    const quota = await runApiKeyQuotaRace({ config, observer, fixture });
    const webhook = await runWebhookCutoverRace({ config, observer, fixture });

    return Object.freeze({
      ok: true,
      validator: "control_plane_postgres_concurrency_v1",
      target: Object.freeze({
        endpoint_id: basePreflight.endpointId,
        database: basePreflight.databaseName,
        database_role: basePreflight.databaseRole,
        safe_target: config.safeTarget,
        postgres_version_number: basePreflight.postgresVersionNumber,
      }),
      migrations: Object.freeze([
        ...basePreflight.appliedMigrations,
        ...controlPlanePreflight.appliedMigrations,
      ]),
      evidence: Object.freeze({
        tenant_api_key_transaction_rollback: rollback,
        tenant_api_key_atomic_quota_max_one: quota,
        webhook_destination_cutover_serialization: webhook,
      }),
      boundaries: Object.freeze({
        production_touched: false,
        disposable_neon_postgresql_only: true,
        http_route: "not_covered_database_cutover_contract_only",
        raw_api_key_material_persisted_or_reported: false,
        physical_nfc_cryptographic_path_touched: false,
        managed_kms_validated: false,
        hsm_validated: false,
        webhook_secret_custody: "not_revalidated_software_envelope_encryption_only",
      }),
      cleanup: "disposable_neon_branch_deletion_required_append_only_evidence_not_mutated",
    });
  } finally {
    // 0077 receipts and 0064 webhook audit rows are deliberately append-only.
    // Weakening those controls for test cleanup would invalidate the evidence;
    // the preflight therefore permits only an empty disposable branch and the
    // caller must delete that branch after collecting the result.
    await observer.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  let config = null;
  try {
    config = readSunAtomicPostgresQaConfig(process.env);
    const result = await runControlPlanePostgresQa(process.env);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      validator: "control_plane_postgres_concurrency_v1",
      reason: sanitizeSunAtomicQaFailure(error, config),
      cleanup: "delete_disposable_neon_branch_if_fixture_insertion_started",
    }));
    process.exitCode = 1;
  }
}
