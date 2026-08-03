import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const {
  SDK_EVENT_ATOMIC_OUTBOX_MIGRATION,
  sdkExternalEventAtomicError,
  writeSdkExternalEventAtomic,
} = await import("../src/lib/sdk-external-event-writer.ts");

const baseMigrationPath = "db/migrations/20260802180000_0083_sdk_event_webhook_atomic_outbox.sql";
const migrationPath = "db/migrations/20260802230000_0088_enterprise_event_profile.sql";

const outbound = {
  productId: "product-1",
  sku: "SKU-1",
  lotNumber: "LOT-1",
  authStatus: "VALID",
  tamperStatus: "SEALED",
  replayStatus: "FRESH",
  distributorId: "distributor-1",
  campaignId: null,
  approximateLocation: { country: "AR" },
  consentFlags: { location_analytics: true },
  connectorProfileCode: "cropwise_physical_product_event",
  risk: {
    riskScore: 0,
    riskLevel: "LOW",
    triggeredRules: [],
    recommendedAction: "ALLOW_WITH_STANDARD_MONITORING",
  },
};

test("0083 exposes a reusable fail-closed outbox primitive with immutable delivery identity", () => {
  const migration = read(baseMigrationPath);
  assert.equal(SDK_EVENT_ATOMIC_OUTBOX_MIGRATION, migrationPath.split("/").at(-1));
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_enqueue_tenant_webhook_outbox_v1/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(migration, /convert_to\(p_tenant_id::text, 'UTF8'\)[\s\S]*decode\('00', 'hex'\)[\s\S]*convert_to\(v_event_name, 'UTF8'\)/);
  assert.match(migration, /endpoint\.tenant_id = p_tenant_id/);
  assert.match(migration, /endpoint\.enabled = true/);
  assert.match(migration, /endpoint\.deleted_at IS NULL/);
  assert.match(migration, /LIMIT 25/);
  assert.match(migration, /endpoint_url,[\s\S]*destination_version,[\s\S]*event_id/);
  assert.match(migration, /ON CONFLICT \(endpoint_id, event_id\) DO NOTHING/);
  assert.match(migration, /delivery\.payload IS DISTINCT FROM v_payload/);
  assert.match(migration, /webhook_outbox_idempotency_conflict/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_enqueue_tenant_webhook_outbox_v1/);
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/mi);
});

test("SDK external-event mutation and outbox enqueue execute inside one PostgreSQL function", () => {
  const migration = read(migrationPath);
  const writerStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_write_sdk_external_event_v1");
  const writer = migration.slice(writerStart);
  const businessInsert = writer.indexOf("INSERT INTO public.sdk_external_events");
  const outboxCall = writer.indexOf("public.nexid_enqueue_tenant_webhook_outbox_v1");
  assert.ok(writerStart >= 0);
  assert.ok(businessInsert >= 0);
  assert.ok(outboxCall > businessInsert);
  assert.match(writer, /FROM public\.tenant_api_keys api_key[\s\S]*FOR SHARE/);
  assert.match(writer, /api_key\.tenant_id = v_tenant_id/);
  assert.match(writer, /api_key\.status <> 'active'/);
  assert.match(writer, /v_api_key\.scopes \? 'sdk:events'/);
  assert.match(writer, /FROM public\.sdk_idempotency_operations operation[\s\S]*operation\.route = '\/api\/v1\/sdk\/events'[\s\S]*FOR UPDATE/);
  assert.match(writer, /v_existing\.id IS NULL AND v_idempotency_operation\.state <> 'processing'/);
  assert.match(writer, /v_attempted <> v_queued \+ v_deduplicated/);
  assert.match(writer, /sdk_external_event_outbox_receipt_unconfirmed/);
  assert.match(writer, /REVOKE ALL ON FUNCTION public\.nexid_write_sdk_external_event_v1/);
});

test("application wrapper performs exactly one atomic SQL statement and validates its receipt", async () => {
  const calls = [];
  const result = await writeSdkExternalEventAtomic({
    tenantId: "11111111-1111-4111-8111-111111111111",
    apiKeyId: "22222222-2222-4222-8222-222222222222",
    idempotencyOperationId: "33333333-3333-4333-8333-333333333333",
    bid: "SYN-2026-01",
    uidHex: "04AABBCCDDEEFF",
    eventType: "shipment.received",
    source: "sdk",
    occurredAt: "2026-08-02T18:00:00.000Z",
    data: { traceId: "trace-atomic" },
    traceId: "trace-atomic",
    outbound,
  }, async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{
      external_event_id: "44444444-4444-4444-8444-444444444444",
      event_created_at: "2026-08-02T18:00:01.000Z",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      batch_id: "55555555-5555-4555-8555-555555555555",
      tag_id: "66666666-6666-4666-8666-666666666666",
      bid: "SYN-2026-01",
      uid_hex: "04AABBCCDDEEFF",
      event_type: "shipment.received",
      event_source: "sdk",
      replayed: false,
      outbox_event_id: `evt_${"a".repeat(64)}`,
      webhook_attempted: 2,
      webhook_queued: 1,
      webhook_deduplicated: 1,
    }];
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /SELECT \*[\s\S]*nexid_write_sdk_external_event_v1/);
  assert.equal(calls[0].values.length, 1);
  assert.equal(result.eventId, "44444444-4444-4444-8444-444444444444");
  assert.deepEqual(result.webhookOutbox, {
    status: "confirmed",
    eventId: `evt_${"a".repeat(64)}`,
    attempted: 2,
    confirmed: 2,
    queued: 1,
    deduplicated: 1,
  });
});

test("invalid atomic receipt is rejected rather than reporting a partial commit as success", async () => {
  await assert.rejects(writeSdkExternalEventAtomic({
    tenantId: "11111111-1111-4111-8111-111111111111",
    apiKeyId: "22222222-2222-4222-8222-222222222222",
    idempotencyOperationId: null,
    bid: null,
    uidHex: null,
    eventType: "inventory.checked",
    source: "sdk",
    occurredAt: null,
    data: {},
    traceId: "trace-invalid",
    outbound,
  }, async () => [{
    external_event_id: "44444444-4444-4444-8444-444444444444",
    event_created_at: "2026-08-02T18:00:01.000Z",
    tenant_id: "11111111-1111-4111-8111-111111111111",
    event_type: "inventory.checked",
    event_source: "sdk",
    replayed: false,
    outbox_event_id: `evt_${"b".repeat(64)}`,
    webhook_attempted: 2,
    webhook_queued: 1,
    webhook_deduplicated: 0,
  }]), /sdk_external_event_atomic_readback_invalid/);
});

test("known PostgreSQL rejection is non-committed while transport ambiguity stays uncertain", () => {
  const missing = Object.assign(new Error("function nexid_write_sdk_external_event_v1 does not exist"), { code: "42883" });
  assert.deepEqual(sdkExternalEventAtomicError(missing), {
    status: 503,
    reason: "sdk_event_atomic_outbox_migration_required",
    operationCommitted: false,
    requiredMigration: SDK_EVENT_ATOMIC_OUTBOX_MIGRATION,
  });
  assert.deepEqual(sdkExternalEventAtomicError(new Error("sdk_external_event_batch_not_found_for_tenant")), {
    status: 404,
    reason: "batch_not_found_for_tenant",
    operationCommitted: false,
  });
  assert.equal(sdkExternalEventAtomicError(new Error("socket closed after request write")), null);
});

test("SDK events route has no post-commit webhook window", () => {
  const route = read("src/app/api/v1/sdk/events/route.ts");
  assert.match(route, /writeSdkExternalEventAtomic/);
  assert.doesNotMatch(route, /enqueueSdkWebhookGuaranteed/);
  assert.doesNotMatch(route, /dispatchTenantWebhooks/);
  assert.doesNotMatch(route, /INSERT INTO sdk_external_events/);
  assert.match(route, /if \(!mapped\)[\s\S]*operationCommitted: null/);
  assert.match(route, /Requests without an Idempotency-Key cannot be safely auto-retried/);
  assert.match(route, /operationCommitted: mapped\.operationCommitted/);
  assert.match(route, /if \(!persisted\.replayed\)[\s\S]*publishRealtimeEvent/);
});
