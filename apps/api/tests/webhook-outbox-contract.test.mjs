import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const {
  enqueueSdkWebhookGuaranteed,
  SdkWebhookOutboxUnavailableError,
} = await import("../src/lib/sdk-webhook-outbox-guarantee.ts");

test("SDK webhook dispatch persists a deduplicated outbox row and never performs inline fetch", () => {
  const source = read("src/lib/sdk-webhooks.ts");
  assert.match(source, /WITH matching_endpoints AS MATERIALIZED/);
  assert.match(source, /existing_deliveries AS MATERIALIZED/);
  assert.match(source, /inserted_deliveries AS/);
  assert.match(source, /INSERT INTO webhook_deliveries/);
  assert.match(source, /ON CONFLICT \(endpoint_id, event_id\) DO NOTHING/);
  assert.match(source, /attempt_count,\s*next_attempt_at/);
  const producer = source.slice(source.indexOf("export async function dispatchTenantWebhooks"), source.indexOf("export async function claimWebhookDeliveries"));
  assert.doesNotMatch(producer, /fetch\s*\(/);
  assert.doesNotMatch(producer, /deliverWebhookRequest\s*\(/);
});

test("SDK enqueue failure is retried with the same logical event and then propagated", async () => {
  const calls = [];
  const dispatch = async (input) => {
    calls.push({ eventName: input.eventName, idempotencyKey: input.idempotencyKey });
    throw new Error("database_unavailable");
  };

  await assert.rejects(
    enqueueSdkWebhookGuaranteed({
      tenantId: "tenant-1",
      eventName: "sdk.external_event",
      idempotencyKey: "resource-1",
      payload: { eventId: "resource-1" },
      correlationId: "trace-1",
      resourceId: "resource-1",
    }, { dispatch, maxAttempts: 2 }),
    (error) => error instanceof SdkWebhookOutboxUnavailableError
      && error.retryable === true
      && error.correlationId === "trace-1"
      && error.resourceId === "resource-1",
  );
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
});

test("SDK enqueue accepts only a receipt confirmed for every matching endpoint", async () => {
  await assert.rejects(
    enqueueSdkWebhookGuaranteed({
      tenantId: "tenant-1",
      eventName: "sdk.verify",
      idempotencyKey: "event-1",
      payload: {},
      correlationId: "trace-2",
      resourceId: "event-1",
    }, {
      maxAttempts: 1,
      dispatch: async () => ({ attempted: 2, confirmed: 1, queued: 1, deduplicated: 0, delivered: 0, eventId: "evt-1" }),
    }),
    SdkWebhookOutboxUnavailableError,
  );
});

test("SDK enqueue receipt distinguishes confirmed delivery rows from no configured endpoint", async () => {
  const base = {
    tenantId: "tenant-1",
    eventName: "sdk.verify",
    idempotencyKey: "event-2",
    payload: {},
    correlationId: "trace-3",
    resourceId: "event-2",
  };
  const confirmed = await enqueueSdkWebhookGuaranteed(base, {
    dispatch: async () => ({ attempted: 2, confirmed: 2, queued: 1, deduplicated: 1, delivered: 0, eventId: "evt-2" }),
  });
  const notConfigured = await enqueueSdkWebhookGuaranteed(base, {
    dispatch: async () => ({ attempted: 0, confirmed: 0, queued: 0, deduplicated: 0, delivered: 0, eventId: "evt-2" }),
  });
  assert.deepEqual(confirmed, { status: "confirmed", eventId: "evt-2", attempted: 2, confirmed: 2, queued: 1, deduplicated: 1 });
  assert.equal(notConfigured.status, "not_configured");
});

test("every webhook-producing SDK route returns explicit 503 instead of swallowing enqueue failure", () => {
  const routes = [
    "src/app/api/v1/sdk/verify/route.ts",
    "src/app/api/v1/sdk/events/route.ts",
    "src/app/api/v1/sdk/pos/activate/route.ts",
    "src/app/api/v1/sdk/claim/route.ts",
  ];
  for (const route of routes) {
    const source = read(route);
    assert.match(source, /enqueueSdkWebhookGuaranteed/);
    assert.match(source, /SdkWebhookOutboxUnavailableError/);
    assert.match(source, /sdkWebhookOutboxUnavailableBody/);
    assert.match(source, /statusCode: 503/);
    assert.match(source, /"retry-after": "2"/);
    assert.doesNotMatch(source, /dispatchTenantWebhooks[\s\S]*\.catch\(\(\) => null\)/);
  }
});

test("workers claim atomically, use expiring leases and persist retry or DLQ state", () => {
  const source = read("src/lib/sdk-webhooks.ts");
  const migration = read("db/migrations/20260723194500_0052_webhook_delivery_outbox.sql");
  const worker = read("src/app/internal/webhooks/worker/route.ts");
  const workerAuth = read("src/lib/webhook-worker-auth.ts");

  assert.match(source, /FOR UPDATE OF wd, we SKIP LOCKED/);
  assert.match(source, /status = 'processing'/);
  assert.match(source, /interval '10 minutes'/);
  assert.match(source, /status = 'retry_scheduled'/);
  assert.match(source, /status = 'dead_letter'/);
  assert.match(source, /AND lock_token = /);
  assert.match(migration, /UNIQUE INDEX[\s\S]*endpoint_id, event_id/);
  assert.match(migration, /next_attempt_at/);
  assert.match(worker, /authenticateWebhookWorkerRequest/);
  assert.match(workerAuth, /timingSafeEqual/);
  assert.match(workerAuth, /INTERNAL_WEBHOOK_WORKER_KEY/);
  assert.match(workerAuth, /x-internal-webhook-key/);
  assert.match(workerAuth, /WEBHOOK_SCHEDULER_OIDC_SERVICE_ACCOUNT_EMAIL/);
  assert.match(workerAuth, /WEBHOOK_SCHEDULER_OIDC_AUDIENCE/);
  assert.match(workerAuth, /verifyIdToken/);
});

test("the egress transport validates every DNS answer and pins the approved address", () => {
  const source = read("src/lib/webhook-egress.ts");
  assert.match(source, /addresses\.some\(\(row\) => !isPublicWebhookAddress\(row\.address\)\)/);
  assert.match(source, /lookup: \(_hostname, _options, callback\) => callback\(null, input\.address, input\.family\)/);
  assert.match(source, /agent: false/);
  assert.match(source, /webhook_redirect_not_allowed/);
});
