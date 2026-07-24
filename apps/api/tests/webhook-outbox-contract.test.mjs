import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("SDK webhook dispatch persists a deduplicated outbox row and never performs inline fetch", () => {
  const source = read("src/lib/sdk-webhooks.ts");
  assert.match(source, /INSERT INTO webhook_deliveries/);
  assert.match(source, /ON CONFLICT \(endpoint_id, event_id\) DO NOTHING/);
  assert.match(source, /attempt_count,\s*next_attempt_at/);
  const producer = source.slice(source.indexOf("export async function dispatchTenantWebhooks"), source.indexOf("export async function claimWebhookDeliveries"));
  assert.doesNotMatch(producer, /fetch\s*\(/);
  assert.doesNotMatch(producer, /deliverWebhookRequest\s*\(/);
});

test("workers claim atomically, use expiring leases and persist retry or DLQ state", () => {
  const source = read("src/lib/sdk-webhooks.ts");
  const migration = read("db/migrations/20260723194500_0052_webhook_delivery_outbox.sql");
  const worker = read("src/app/internal/webhooks/worker/route.ts");

  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.match(source, /status = 'processing'/);
  assert.match(source, /interval '10 minutes'/);
  assert.match(source, /status = 'retry_scheduled'/);
  assert.match(source, /status = 'dead_letter'/);
  assert.match(source, /AND lock_token = /);
  assert.match(migration, /UNIQUE INDEX[\s\S]*endpoint_id, event_id/);
  assert.match(migration, /next_attempt_at/);
  assert.match(worker, /timingSafeEqual/);
  assert.match(worker, /INTERNAL_WEBHOOK_WORKER_KEY/);
  assert.match(worker, /x-internal-webhook-key/);
});

test("the egress transport validates every DNS answer and pins the approved address", () => {
  const source = read("src/lib/webhook-egress.ts");
  assert.match(source, /addresses\.some\(\(row\) => !isPublicWebhookAddress\(row\.address\)\)/);
  assert.match(source, /lookup: \(_hostname, _options, callback\) => callback\(null, input\.address, input\.family\)/);
  assert.match(source, /agent: false/);
  assert.match(source, /webhook_redirect_not_allowed/);
});
