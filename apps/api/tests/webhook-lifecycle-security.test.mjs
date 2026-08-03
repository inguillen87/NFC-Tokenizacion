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
import { installEphemeralE2eSqlExecutor } from "../src/lib/db.ts";
import { processClaimedWebhookDelivery } from "../src/lib/sdk-webhooks.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const listRoute = read("../src/app/admin/webhooks/route.ts");
const itemRoute = read("../src/app/admin/webhooks/[id]/route.ts");
const rotateRoute = read("../src/app/admin/webhooks/[id]/rotate/route.ts");
const reactivateRoute = read("../src/app/admin/webhooks/[id]/reactivate/route.ts");
const deliveryRoute = read("../src/app/admin/webhook-deliveries/route.ts");
const deliveryWorker = read("../src/lib/sdk-webhooks.ts");
const databaseBoundary = read("../src/lib/db.ts");
const migration = read("../db/migrations/20260728160000_0064_webhook_lifecycle_governance.sql");
const destinationMigration = read("../db/migrations/20260802130000_0078_webhook_destination_cutover.sql");
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

test("changing a webhook URL atomically retires queued deliveries for the previous destination", () => {
  assert.match(itemRoute, /eligible\.url AS previous_url/);
  assert.match(itemRoute, /eligible\.destination_version AS previous_destination_version/);
  assert.match(itemRoute, /updated\.url IS DISTINCT FROM updated\.previous_url/);
  assert.match(itemRoute, /last_error = CASE[\s\S]*webhook_destination_changed[\s\S]*webhook_endpoint_disabled/);
  assert.match(itemRoute, /status_code = NULL[\s\S]*delivered_at = NULL/);
  assert.match(itemRoute, /wd\.status IN \('pending', 'retry_scheduled'\)/);
  assert.match(itemRoute, /wd\.status = 'processing'[\s\S]*COALESCE\(wd\.locked_at, wd\.last_attempt_at, wd\.created_at\)[\s\S]*<= now\(\) - interval '10 minutes'/);
  assert.match(itemRoute, /COALESCE\(wd\.locked_at, wd\.last_attempt_at, wd\.created_at\)[\s\S]*> now\(\) - interval '10 minutes'/);
  assert.match(itemRoute, /'webhook_destination_changed'/);
  assert.match(itemRoute, /'previous_destination_version'/);
  assert.match(itemRoute, /'destination_version'/);
  assert.match(itemRoute, /'previous_destination_fingerprint'/);
  assert.match(itemRoute, /'destination_fingerprint'/);
  assert.match(itemRoute, /retired_delivery_count: Number\(retiredDeliveryCount \|\| 0\)/);
  const auditFragment = itemRoute.slice(itemRoute.indexOf("), audit AS ("), itemRoute.indexOf("FROM updated", itemRoute.indexOf("), audit AS (")));
  assert.doesNotMatch(auditFragment, /'previous_url'|'destination_url'|'url'/);
});

test("destination cutover migration makes URL and version an immutable delivery identity", () => {
  assert.match(destinationMigration, /ADD COLUMN IF NOT EXISTS destination_version bigint/);
  assert.match(destinationMigration, /NEW\.url IS DISTINCT FROM OLD\.url[\s\S]*NEW\.destination_version := OLD\.destination_version \+ 1/);
  assert.match(destinationMigration, /NEW\.destination_version := OLD\.destination_version/);
  assert.match(destinationMigration, /webhook_destination_has_fresh_lease/);
  assert.match(destinationMigration, /BEFORE UPDATE OF url, destination_version ON webhook_endpoints/);
  assert.match(destinationMigration, /FOR SHARE/);
  assert.doesNotMatch(destinationMigration, /FOR KEY SHARE/);
  assert.match(destinationMigration, /NEW\.endpoint_url := v_endpoint\.url/);
  assert.match(destinationMigration, /v_endpoint public\.webhook_endpoints%ROWTYPE/);
  assert.match(destinationMigration, /NEW\.destination_version := v_endpoint\.destination_version/);
  assert.match(destinationMigration, /webhook_delivery_endpoint_not_eligible/);
  assert.match(destinationMigration, /webhook_delivery_identity_is_immutable/);
  for (const field of ["endpoint_id", "endpoint_url", "destination_version", "event_id", "event_name", "payload", "created_at"]) {
    assert.match(destinationMigration, new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`));
  }
  const legacyClassification = destinationMigration.slice(
    destinationMigration.indexOf("-- Never replay an open legacy delivery"),
    destinationMigration.indexOf("ALTER TABLE webhook_deliveries", destinationMigration.indexOf("-- Never replay an open legacy delivery")),
  );
  assert.match(legacyClassification, /status = 'dead_letter'/);
  assert.match(legacyClassification, /webhook_destination_mismatch_legacy/);
  assert.match(legacyClassification, /delivery\.endpoint_url IS DISTINCT FROM endpoint\.url/);
  assert.doesNotMatch(legacyClassification, /SET[\s\S]*endpoint_url\s*=/);
  assert.match(destinationMigration, /'webhook_destination_changed'/);
  assert.equal((destinationMigration.match(/SET search_path = public, pg_temp/g) || []).length, 3);
  assert.doesNotMatch(destinationMigration, /BEGIN;|COMMIT;/i);
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

test("worker renews and verifies destination identity before any webhook egress", () => {
  const processor = deliveryWorker.slice(
    deliveryWorker.indexOf("export async function processClaimedWebhookDelivery"),
    deliveryWorker.indexOf("export async function processWebhookDeliveryBatch"),
  );
  assert.match(deliveryWorker, /renewAndVerifyWebhookDeliveryLease/);
  assert.match(deliveryWorker, /FOR SHARE[\s\S]*SET locked_at = now\(\)/);
  assert.match(deliveryWorker, /wd\.endpoint_url = endpoint\.url/);
  assert.match(deliveryWorker, /wd\.destination_version = endpoint\.destination_version/);
  assert.match(deliveryWorker, /webhook_destination_changed/);
  assert.ok(processor.indexOf("renewAndVerifyWebhookDeliveryLease(row)") < processor.indexOf("webhookDeliveryTransport(dependencies)"));
  assert.match(processor, /if \(!prepared\.delivery\)[\s\S]*return/);
  assert.match(deliveryWorker, /const claimed = await claimWebhookDeliveries\(1\)/);
  assert.doesNotMatch(deliveryWorker, /const claimed = await claimWebhookDeliveries\(limit\)/);
});

test("pre-egress destination rejection atomically appends the claimed attempt receipt", () => {
  const renewal = deliveryWorker.slice(
    deliveryWorker.indexOf("async function renewAndVerifyWebhookDeliveryLease"),
    deliveryWorker.indexOf("function deliveryPayload"),
  );
  const terminal = renewal.slice(renewal.indexOf("const terminal = await sql"));
  const attemptReceipt = terminal.slice(
    terminal.indexOf("terminal_attempt AS"),
    terminal.indexOf("SELECT delivery.id::text AS id"),
  );
  assert.match(terminal, /terminal_delivery AS \([\s\S]*UPDATE webhook_deliveries wd[\s\S]*SET status = 'dead_letter'/);
  assert.match(terminal, /terminal_attempt AS \([\s\S]*INSERT INTO webhook_delivery_attempts/);
  assert.match(terminal, /delivery\.attempt_count,[\s\S]*'dead_letter'/);
  assert.match(terminal, /delivery\.tenant_id/);
  assert.match(terminal, /delivery\.last_error/);
  assert.match(terminal, /JOIN terminal_attempt attempt ON attempt\.delivery_id = delivery\.id/);
  assert.match(terminal, /webhook_endpoint_disabled/);
  assert.match(terminal, /webhook_destination_changed/);
  assert.doesNotMatch(attemptReceipt, /signing_secret|endpoint_url|payload/);
});

test("disabled endpoint terminalization records a receipt and performs zero network I/O", async () => {
  const statements = [];
  let transportCalls = 0;
  const uninstall = installEphemeralE2eSqlExecutor(async (strings, ...values) => {
    const statement = strings.join("?");
    statements.push({ statement, values });
    if (/SET locked_at = now\(\)/.test(statement)) return [];
    if (/terminal_attempt AS/.test(statement)) {
      return [{ id: "101", last_error: "webhook_endpoint_disabled" }];
    }
    throw new Error("unexpected_webhook_receipt_test_statement");
  }, {
    NODE_ENV: "test",
    VERCEL_ENV: "test",
    NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
    NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:test-only@127.0.0.1/nexid_e2e_webhook_receipt",
  });
  const claimed = {
    id: "101",
    endpoint_id: "7b395637-1f56-4df7-9f11-96a6e0794218",
    endpoint_url: "https://hooks.example.com/old",
    destination_version: "3",
    endpoint_enabled: true,
    tenant_id: "7b395637-1f56-4df7-9f11-96a6e0794219",
    signing_secret: "must-never-enter-attempt-receipt",
    signature_version: "v2",
    event_id: "evt_disabled",
    event_name: "sdk.verify",
    payload: { id: "evt_disabled" },
    attempt_count: 4,
    attempt_cycle_count: 2,
    lock_token: "claimed-lease",
  };
  try {
    const result = await processClaimedWebhookDelivery(claimed, {
      deliver: async () => {
        transportCalls += 1;
        return { statusCode: 204 };
      },
    });
    assert.equal(transportCalls, 0);
    assert.equal(result.status, "dead_letter");
    assert.equal(result.reason, "webhook_endpoint_disabled");
    assert.equal(result.attemptCount, 4);
    assert.equal(statements.length, 2);
    assert.match(statements[1].statement, /UPDATE webhook_deliveries wd[\s\S]*INSERT INTO webhook_delivery_attempts/);
    assert.equal(statements[1].values.includes(claimed.signing_secret), false);
    assert.equal(statements[1].values.includes(claimed.tenant_id), false);
    assert.equal(statements[1].values.includes(claimed.payload), false);
  } finally {
    uninstall();
  }
});

test("a lost claim appends one tenant-derived lease-loss receipt without secret material", async () => {
  const statements = [];
  let transportCalls = 0;
  const uninstall = installEphemeralE2eSqlExecutor(async (strings, ...values) => {
    const statement = strings.join("?");
    statements.push({ statement, values });
    if (/SET locked_at = now\(\)/.test(statement)) return [];
    if (/terminal_attempt AS/.test(statement)) return [];
    if (/WITH receipt_source AS/.test(statement)) return [{ id: "102" }];
    throw new Error("unexpected_webhook_lease_loss_test_statement");
  }, {
    NODE_ENV: "test",
    VERCEL_ENV: "test",
    NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
    NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:test-only@localhost/nexid_e2e_webhook_lease_loss",
  });
  const claimed = {
    id: "102",
    endpoint_id: "7b395637-1f56-4df7-9f11-96a6e0794218",
    endpoint_url: "https://hooks.example.com/current",
    destination_version: "7",
    endpoint_enabled: true,
    tenant_id: "7b395637-1f56-4df7-9f11-96a6e0794219",
    signing_secret: "must-never-enter-lease-loss-receipt",
    signature_version: "v2",
    event_id: "evt_lease_lost",
    event_name: "sdk.verify",
    payload: { data: { requestId: "req_lease_lost" } },
    attempt_count: 5,
    attempt_cycle_count: 1,
    lock_token: "superseded-lease",
  };
  try {
    const result = await processClaimedWebhookDelivery(claimed, {
      deliver: async () => {
        transportCalls += 1;
        return { statusCode: 204 };
      },
    });
    assert.equal(transportCalls, 0);
    assert.equal(result.status, "lease_lost");
    assert.equal(result.reason, "webhook_delivery_lease_lost");
    assert.equal(statements.length, 3);
    const receipt = statements[2];
    assert.match(receipt.statement, /JOIN webhook_endpoints endpoint ON endpoint\.id = delivery\.endpoint_id/);
    assert.match(receipt.statement, /delivery\.attempt_count >=/);
    assert.match(receipt.statement, /'lease_lost'/);
    assert.match(receipt.statement, /ON CONFLICT \(delivery_id, attempt_number\) DO NOTHING/);
    assert.equal(receipt.values.includes(claimed.signing_secret), false);
    assert.equal(receipt.values.includes(claimed.tenant_id), false);
    assert.equal(receipt.values.includes(claimed.payload), false);
    assert.equal(receipt.values.includes("req_lease_lost"), true);
  } finally {
    uninstall();
  }
});

test("a failed pre-egress renewal performs zero network I/O", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.NODE_ENV = "test";
  process.env.VERCEL_ENV = "test";
  let transportCalls = 0;
  try {
    const claimed = {
      id: "101",
      endpoint_id: "7b395637-1f56-4df7-9f11-96a6e0794218",
      endpoint_url: "https://hooks.example.com/old",
      destination_version: "3",
      endpoint_enabled: true,
      tenant_id: "7b395637-1f56-4df7-9f11-96a6e0794219",
      signing_secret: "unused",
      signature_version: "v2",
      event_id: "evt_cutover",
      event_name: "sdk.verify",
      payload: { id: "evt_cutover" },
      attempt_count: 1,
      lock_token: "old-lease",
    };
    const result = await processClaimedWebhookDelivery(claimed, {
      prepare: async () => ({
        delivery: null,
        rejected: { status: "dead_letter", reason: "webhook_destination_changed" },
      }),
      deliver: async () => {
        transportCalls += 1;
        return { statusCode: 204 };
      },
    });
    assert.equal(transportCalls, 0);
    assert.equal(result.status, "dead_letter");
    assert.equal(result.reason, "webhook_destination_changed");

    const missingEndpoint = await processClaimedWebhookDelivery(claimed, {
      prepare: async () => ({
        delivery: null,
        rejected: { status: "lease_lost", reason: "webhook_delivery_lease_lost" },
      }),
      deliver: async () => {
        transportCalls += 1;
        return { statusCode: 204 };
      },
    });
    assert.equal(transportCalls, 0);
    assert.equal(missingEndpoint.status, "lease_lost");
    assert.equal(missingEndpoint.reason, "webhook_delivery_lease_lost");
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});

test("webhook administration uses persisted principal permissions, tenant scope and explicit reactivation", () => {
  for (const source of [listRoute, itemRoute, rotateRoute, reactivateRoute, deliveryRoute]) {
    assert.match(source, /await checkAdmin\(req, \[[^\]]*"tenant_operator"[^\]]*\]\)/);
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
  assert.match(itemRoute, /webhook_endpoint_disabled/);
  assert.match(rotateRoute, /wd\.status = 'processing'/);
  assert.match(databaseBoundary, /20260728160000_0064_webhook_lifecycle_governance\.sql/);
});
