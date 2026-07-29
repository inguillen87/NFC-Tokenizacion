import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  generateWebhookSigningSecret,
  normalizeWebhookSecretOverlapSeconds,
  webhookSecretFingerprint,
  WEBHOOK_SECRET_OVERLAP_DEFAULT_SECONDS,
  WEBHOOK_SECRET_OVERLAP_MAX_SECONDS,
  WEBHOOK_SECRET_OVERLAP_MIN_SECONDS,
} from "../src/lib/webhook-lifecycle.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const listRoute = read("../src/app/admin/webhooks/route.ts");
const itemRoute = read("../src/app/admin/webhooks/[id]/route.ts");
const rotateRoute = read("../src/app/admin/webhooks/[id]/rotate/route.ts");
const reactivateRoute = read("../src/app/admin/webhooks/[id]/reactivate/route.ts");
const deliveryRoute = read("../src/app/admin/webhook-deliveries/route.ts");
const deliveryWorker = read("../src/lib/sdk-webhooks.ts");
const migration = read("../db/migrations/20260728160000_0064_webhook_lifecycle_governance.sql");

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

test("secret overlap is explicit and bounded to one day", () => {
  assert.equal(normalizeWebhookSecretOverlapSeconds(undefined), WEBHOOK_SECRET_OVERLAP_DEFAULT_SECONDS);
  assert.equal(normalizeWebhookSecretOverlapSeconds(WEBHOOK_SECRET_OVERLAP_MIN_SECONDS), WEBHOOK_SECRET_OVERLAP_MIN_SECONDS);
  assert.equal(normalizeWebhookSecretOverlapSeconds(WEBHOOK_SECRET_OVERLAP_MAX_SECONDS), WEBHOOK_SECRET_OVERLAP_MAX_SECONDS);
  assert.equal(normalizeWebhookSecretOverlapSeconds(WEBHOOK_SECRET_OVERLAP_MIN_SECONDS - 1), null);
  assert.equal(normalizeWebhookSecretOverlapSeconds(WEBHOOK_SECRET_OVERLAP_MAX_SECONDS + 1), null);
  assert.equal(normalizeWebhookSecretOverlapSeconds("not-a-number"), null);
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
  assert.match(migration, /previous_valid_until[\s\S]*interval '24 hours'/);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+webhook_(?:endpoints|deliveries|endpoint_audit_events)/i);
  assert.doesNotMatch(migration, /BEGIN;|COMMIT;/i);
});

test("admin delete is a tenant-scoped audited tombstone and never destroys history", () => {
  assert.match(itemRoute, /checkWebhookPermission\(req, "write"\)/);
  assert.match(itemRoute, /getAdminActor\(req\)/);
  assert.match(itemRoute, /UPDATE webhook_endpoints[\s\S]*enabled = false[\s\S]*deleted_at = now\(\)[\s\S]*deleted_by = /);
  assert.match(itemRoute, /INSERT INTO webhook_endpoint_audit_events/);
  assert.match(itemRoute, /webhook_endpoint_deleted/);
  assert.doesNotMatch(itemRoute, /DELETE\s+FROM\s+webhook_(?:endpoints|deliveries)/i);
});

test("create and rotation reveal a secret once while ordinary administration exposes metadata only", () => {
  assert.match(listRoute, /generateWebhookSigningSecret\(\)/);
  assert.match(listRoute, /secret: oneTimeSecret/);
  assert.match(listRoute, /warning: "Store this secret now\. nexID will not show it again\."/);
  assert.match(listRoute, /signing_secret_fingerprint/);
  assert.doesNotMatch(listRoute, /SELECT[^;]*signing_secret\s+AS\s+(?:secret|signing_secret_material)/is);

  assert.match(rotateRoute, /generateWebhookSigningSecret\(\)/);
  assert.match(rotateRoute, /signing_secret_previous = signing_secret/);
  assert.match(rotateRoute, /signing_secret = /);
  assert.match(rotateRoute, /signing_secret_version = signing_secret_version \+ 1/);
  assert.match(rotateRoute, /signing_secret_version = \$\{expectedSecretVersion\}/);
  assert.match(rotateRoute, /webhook_secret_rotated/);
  assert.match(rotateRoute, /secret: oneTimeSecret/);
  assert.doesNotMatch(itemRoute, /secret:\s*(?:current|row|decrypted|signingSecret)/);
});

test("outbound delivery signs only with the current secret and excludes tombstoned endpoints", () => {
  assert.match(deliveryWorker, /we\.signing_secret/);
  assert.match(deliveryWorker, /deleted_at IS NULL/);
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
});
