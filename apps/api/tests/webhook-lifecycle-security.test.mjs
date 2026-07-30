import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  WEBHOOK_ENABLED_ENDPOINTS_MAX_COUNT,
  generateWebhookSigningSecret,
  normalizeWebhookExpectedSecretVersion,
  parseWebhookEvents,
  redactWebhookUrlForDisplay,
  normalizeWebhookSecretOverlapSeconds,
  webhookLifecycleFailure,
  webhookSecretFingerprint,
  WEBHOOK_SECRET_OVERLAP_DEFAULT_SECONDS,
  WEBHOOK_SECRET_OVERLAP_MAX_SECONDS,
  WEBHOOK_SECRET_OVERLAP_MIN_SECONDS,
} from "../src/lib/webhook-lifecycle.ts";
import { GET as listWebhooks, POST as createWebhook } from "../src/app/admin/webhooks/route.ts";
import { DELETE as deleteWebhook, PATCH as updateWebhook } from "../src/app/admin/webhooks/[id]/route.ts";
import { POST as rotateWebhook } from "../src/app/admin/webhooks/[id]/rotate/route.ts";
import { POST as reactivateWebhook } from "../src/app/admin/webhooks/[id]/reactivate/route.ts";
import { GET as listWebhookDeliveries } from "../src/app/admin/webhook-deliveries/route.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const listRoute = read("../src/app/admin/webhooks/route.ts");
const itemRoute = read("../src/app/admin/webhooks/[id]/route.ts");
const rotateRoute = read("../src/app/admin/webhooks/[id]/rotate/route.ts");
const reactivateRoute = read("../src/app/admin/webhooks/[id]/reactivate/route.ts");
const deliveryRoute = read("../src/app/admin/webhook-deliveries/route.ts");
const deliveryWorker = read("../src/lib/sdk-webhooks.ts");
const databaseBoundary = read("../src/lib/db.ts");
const migration = read("../db/migrations/20260728160000_0064_webhook_lifecycle_governance.sql");
const endpointContext = { params: Promise.resolve({ id: "7b395637-1f56-4df7-9f11-96a6e0794218" }) };

test("every webhook lifecycle surface rejects unauthenticated access before body or database work", async () => {
  const jsonRequest = () => new Request("https://api.nexid.lat/admin/webhooks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const responses = await Promise.all([
    listWebhooks(new Request("https://api.nexid.lat/admin/webhooks")),
    createWebhook(jsonRequest()),
    updateWebhook(jsonRequest(), endpointContext),
    deleteWebhook(new Request("https://api.nexid.lat/admin/webhooks/7b395637-1f56-4df7-9f11-96a6e0794218", { method: "DELETE" }), endpointContext),
    rotateWebhook(jsonRequest(), endpointContext),
    reactivateWebhook(jsonRequest(), endpointContext),
    listWebhookDeliveries(new Request("https://api.nexid.lat/admin/webhook-deliveries")),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401, 401, 401]);
});

test("generated webhook secrets are strong and fingerprints disclose no secret material", () => {
  const first = generateWebhookSigningSecret();
  const second = generateWebhookSigningSecret();
  assert.match(first, /^whsec_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  const fingerprint = webhookSecretFingerprint(first);
  assert.match(fingerprint, /^sha256:[a-f0-9]{32}$/);
  assert.equal(fingerprint.includes(first), false);
  assert.equal(webhookSecretFingerprint(first), fingerprint);
});

test("administration masks credential-like webhook URL path/query material", () => {
  const masked = redactWebhookUrlForDisplay("https://hooks.example.com/services/T123/B456?token=secret&mode=live");
  assert.equal(masked.includes("T123"), false);
  assert.equal(masked.includes("B456"), false);
  assert.equal(masked.includes("secret"), false);
  assert.match(masked, /^https:\/\/hooks\.example\.com\/\[redacted\]/);
  assert.match(masked, /token=%5Bredacted%5D/);
  assert.match(listRoute, /safeWebhookEndpointProjection/);
  assert.match(deliveryRoute, /safeWebhookEndpointProjection/);
});

test("secret overlap is explicit and bounded to one day", () => {
  assert.equal(normalizeWebhookSecretOverlapSeconds(undefined), WEBHOOK_SECRET_OVERLAP_DEFAULT_SECONDS);
  assert.equal(normalizeWebhookSecretOverlapSeconds(WEBHOOK_SECRET_OVERLAP_MIN_SECONDS), WEBHOOK_SECRET_OVERLAP_MIN_SECONDS);
  assert.equal(normalizeWebhookSecretOverlapSeconds(WEBHOOK_SECRET_OVERLAP_MAX_SECONDS), WEBHOOK_SECRET_OVERLAP_MAX_SECONDS);
  assert.equal(normalizeWebhookSecretOverlapSeconds(WEBHOOK_SECRET_OVERLAP_MIN_SECONDS - 1), null);
  assert.equal(normalizeWebhookSecretOverlapSeconds(WEBHOOK_SECRET_OVERLAP_MAX_SECONDS + 1), null);
  assert.equal(normalizeWebhookSecretOverlapSeconds("not-a-number"), null);
  assert.equal(normalizeWebhookExpectedSecretVersion(0), 0);
  assert.equal(normalizeWebhookExpectedSecretVersion("12"), 12);
  assert.equal(normalizeWebhookExpectedSecretVersion(-1), null);
  assert.equal(normalizeWebhookExpectedSecretVersion("1.5"), null);
});

test("event subscriptions are bounded, normalized and reject executable or ambiguous names", () => {
  assert.deepEqual(parseWebhookEvents(["SDK.Verify", "sdk.verify", "*"]), {
    ok: true,
    events: ["sdk.verify", "*"],
  });
  assert.equal(parseWebhookEvents([]).reason, "webhook_events_required");
  assert.equal(parseWebhookEvents(["sdk.verify\nforged"]).reason, "webhook_events_invalid");
  assert.equal(parseWebhookEvents(Array.from({ length: 51 }, (_, index) => `sdk.event_${index}`)).reason, "webhook_events_too_many");
});

test("migration preserves endpoints and delivery history while adding auditable lifecycle state", () => {
  for (const column of [
    "deleted_at",
    "deleted_by",
    "signing_secret_previous",
    "signing_secret_previous_valid_until",
    "signing_secret_version",
    "signing_secret_fingerprint",
  ]) assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
  assert.match(migration, /CREATE TABLE IF NOT EXISTS webhook_endpoint_audit_events/);
  assert.match(migration, /webhook_deliveries_endpoint_id_fkey[\s\S]*ON DELETE RESTRICT/);
  assert.match(migration, /webhook_endpoint_audit_endpoint_tenant_fkey[\s\S]*FOREIGN KEY \(endpoint_id, tenant_id\)/);
  assert.match(migration, /nexid_webhook_audit_append_only/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON webhook_endpoint_audit_events/);
  assert.equal(WEBHOOK_ENABLED_ENDPOINTS_MAX_COUNT, 25);
  assert.match(migration, /webhook_enabled_endpoint_limit_preexisting/);
  assert.match(migration, /nexid_enforce_webhook_enabled_endpoint_limit_v1/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /v_enabled_count >= 25/);
  assert.match(migration, /previous_valid_until[\s\S]*interval '24 hours'/);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+webhook_(?:endpoints|deliveries|endpoint_audit_events)/i);
  assert.doesNotMatch(migration, /BEGIN;|COMMIT;/i);
});

test("enabled endpoint overflow maps to a stable tenant conflict", () => {
  assert.deepEqual(
    webhookLifecycleFailure({ code: "P0001", message: "webhook_enabled_endpoint_limit_exceeded" }),
    { status: 409, reason: "webhook_enabled_endpoint_limit_exceeded" },
  );
});

test("admin delete is a tenant-scoped audited tombstone and never destroys history", () => {
  assert.match(itemRoute, /checkWebhookPermission\(req, "write"\)/);
  assert.match(itemRoute, /getAdminActor\(req\)/);
  assert.match(itemRoute, /UPDATE webhook_endpoints[\s\S]*enabled = false[\s\S]*deleted_at = now\(\)[\s\S]*deleted_by = /);
  assert.match(itemRoute, /INSERT INTO webhook_endpoint_audit_events/);
  assert.match(itemRoute, /webhook_endpoint_deleted/);
  assert.match(itemRoute, /signing_secret = NULL/);
  assert.match(itemRoute, /last_error = 'webhook_endpoint_deleted'/);
  assert.doesNotMatch(itemRoute, /DELETE\s+FROM\s+webhook_(?:endpoints|deliveries)/i);
});

test("create and rotation reveal a secret once while ordinary administration exposes metadata only", () => {
  assert.match(listRoute, /generateWebhookSigningSecret\(\)/);
  assert.match(listRoute, /webhook_secret_and_context_server_derived/);
  assert.match(listRoute, /encryptWebhookSigningSecret\(oneTimeSecret/);
  assert.match(listRoute, /secret: oneTimeSecret/);
  assert.match(listRoute, /warning: "Store this secret now\. nexID will not show it again\."/);
  assert.match(listRoute, /signing_secret_fingerprint/);
  assert.match(listRoute, /"cache-control": "no-store"/);
  assert.doesNotMatch(listRoute, /SELECT[^;]*signing_secret\s+AS\s+(?:secret|signing_secret_material)/is);

  assert.match(rotateRoute, /generateWebhookSigningSecret\(\)/);
  assert.match(rotateRoute, /encryptedPreviousSecret = encryptWebhookSigningSecret\(previousPlaintext/);
  assert.match(rotateRoute, /signing_secret_previous = \$\{encryptedPreviousSecret\}/);
  assert.match(rotateRoute, /signing_secret = \$\{encryptedCurrentSecret\}/);
  assert.match(rotateRoute, /signing_secret_version = eligible\.signing_secret_version \+ 1/);
  assert.match(rotateRoute, /signature_version = 'v2'/);
  assert.match(rotateRoute, /signing_secret_version = \$\{expectedSecretVersion\}/);
  assert.match(rotateRoute, /webhook_secret_rotated/);
  assert.match(rotateRoute, /secret: oneTimeSecret/);
  assert.doesNotMatch(itemRoute, /secret:\s*(?:current|row|decrypted|signingSecret)/);
  assert.match(itemRoute, /webhook_secret_rotation_route_required/);
});

test("outbound delivery signs only with the current secret and excludes tombstoned endpoints", () => {
  assert.match(deliveryWorker, /we\.signing_secret/);
  assert.match(deliveryWorker, /deleted_at IS NULL/);
  assert.match(deliveryWorker, /FOR UPDATE OF wd, we SKIP LOCKED/);
  assert.match(deliveryWorker, /picked\.signing_secret/);
  assert.doesNotMatch(deliveryWorker, /we\.signing_secret_previous/);
  assert.doesNotMatch(deliveryWorker, /decryptWebhookSigningSecret\(row\.signing_secret_previous/);
});

test("webhook administration uses persisted principal permissions, tenant scope and explicit reactivation", () => {
  for (const source of [listRoute, itemRoute, rotateRoute, reactivateRoute, deliveryRoute]) {
    assert.match(source, /await checkAdmin\(req\)/);
    assert.doesNotMatch(source, /x-nexid-admin|x-nexid-permissions|x-nexid-actor|ADMIN_API_KEY/i);
  }
  assert.match(listRoute, /checkWebhookPermission\(req, "read"\)/);
  assert.match(deliveryRoute, /checkWebhookPermission\(req, "read"\)/);
  assert.match(rotateRoute, /checkWebhookPermission\(req, "write"\)/);
  assert.match(reactivateRoute, /deleted_at IS NOT NULL/);
  assert.match(reactivateRoute, /webhook_endpoint_reactivated/);
  assert.match(reactivateRoute, /resolveWebhookDestination/);
  assert.match(reactivateRoute, /expectedSecretVersion/);
  assert.match(reactivateRoute, /we\.updated_at = \$\{current\.updated_at\}::timestamptz/);
  assert.match(reactivateRoute, /webhook_endpoint_reactivated_with_new_secret/);
  assert.match(reactivateRoute, /webhook_reactivation_separation_required/);
  assert.match(reactivateRoute, /single_operator_override/);
  assert.match(itemRoute, /webhook_endpoint_busy/);
  assert.match(itemRoute, /last_error = 'webhook_endpoint_disabled'/);
  assert.match(rotateRoute, /wd\.status = 'processing'/);
  assert.match(databaseBoundary, /20260728160000_0064_webhook_lifecycle_governance\.sql/);
});
