import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createWebhookSignatureHeaders,
  createWebhookSignatureV1,
  createWebhookSignatureV2,
  WebhookSigningError,
  webhookSigningSecretIssue,
} from "../src/lib/webhook-signing.ts";
import { verifyNexIdWebhookSignature } from "../../../packages/sdk/src/index.ts";

const secret = "whsec_0123456789abcdef0123456789abcdef";
const rawBody = JSON.stringify({ id: "evt_123", type: "sdk.verify", data: { verdict: "VALID" } });
const timestamp = 1_750_000_000;

function signedHeaders(version = "v2") {
  return createWebhookSignatureHeaders({
    secret,
    keyId: "endpoint_123",
    deliveryId: "delivery_456",
    eventId: "evt_123",
    rawBody,
    timestamp,
    version,
  });
}

test("webhook v2 signs key ID, delivery ID, event ID and exact raw body", () => {
  const headers = signedHeaders();
  assert.deepEqual(verifyNexIdWebhookSignature({ secret, rawBody, headers, now: timestamp }), {
    ok: true,
    version: "v2",
    timestamp,
    keyId: "endpoint_123",
    keyIdAuthenticated: true,
    deliveryId: "delivery_456",
    eventId: "evt_123",
  });
  assert.equal(headers["x-nexid-signature-version"], "v2");
  assert.equal(headers["x-nexid-timestamp"], String(timestamp));
  assert.equal(headers["x-nexid-key-id"], "endpoint_123");
  assert.match(headers["x-nexid-signature"], /^v2=[a-f0-9]{64}$/);
});

test("webhook v2 rejects an altered body or any signed identity", () => {
  const headers = signedHeaders();
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody: `${rawBody} `, headers, now: timestamp }),
    { ok: false, reason: "signature_mismatch" },
  );
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody, headers: { ...headers, "x-nexid-event-id": "evt_other" }, now: timestamp }),
    { ok: false, reason: "signature_mismatch" },
  );
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody, headers: { ...headers, "x-nexid-key-id": "endpoint_other" }, now: timestamp }),
    { ok: false, reason: "signature_mismatch" },
  );
});

test("webhook v2 rejects expired and future timestamps", () => {
  const headers = signedHeaders();
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody, headers, now: timestamp + 301 }),
    { ok: false, reason: "timestamp_out_of_tolerance" },
  );
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody, headers, now: timestamp - 301 }),
    { ok: false, reason: "timestamp_out_of_tolerance" },
  );
});

test("legacy v1 remains verifiable but reports that key ID is not authenticated", () => {
  const headers = signedHeaders("v1");
  assert.deepEqual(
    verifyNexIdWebhookSignature({
      secret,
      rawBody,
      headers: { ...headers, "x-nexid-key-id": "untrusted-routing-hint" },
      now: timestamp,
    }),
    {
      ok: true,
      version: "v1",
      timestamp,
      keyId: "untrusted-routing-hint",
      keyIdAuthenticated: false,
      deliveryId: "delivery_456",
      eventId: "evt_123",
    },
  );
});

test("enabled webhook signing fails closed for absent or weak secrets", () => {
  assert.equal(webhookSigningSecretIssue("", { required: true }), "webhook_signing_secret_required");
  assert.equal(webhookSigningSecretIssue("short-secret", { required: true }), "webhook_signing_secret_too_short");
  assert.equal(webhookSigningSecretIssue("", { required: false }), null);
  assert.throws(
    () => createWebhookSignatureV1({ secret: "short-secret", timestamp, deliveryId: "delivery_456", eventId: "evt_123", rawBody }),
    (error) => error instanceof WebhookSigningError && error.code === "webhook_signing_secret_too_short",
  );
  assert.throws(
    () => createWebhookSignatureV2({ secret: "short-secret", timestamp, keyId: "endpoint_123", deliveryId: "delivery_456", eventId: "evt_123", rawBody }),
    (error) => error instanceof WebhookSigningError && error.code === "webhook_signing_secret_too_short",
  );
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret: "short-secret", rawBody, headers: signedHeaders(), now: timestamp }),
    { ok: false, reason: "invalid_secret" },
  );
});

test("SDK verifier requires the complete versioned signature envelope", () => {
  const headers = signedHeaders();
  delete headers["x-nexid-key-id"];
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody, headers, now: timestamp }),
    { ok: false, reason: "missing_header" },
  );
});

test("delivery and admin paths cannot send or enable an unsigned endpoint", () => {
  const deliverySource = readFileSync(new URL("../src/lib/sdk-webhooks.ts", import.meta.url), "utf8");
  const sendStart = deliverySource.indexOf("export async function processClaimedWebhookDelivery");
  const sendEnd = deliverySource.indexOf("export async function processWebhookDeliveryBatch");
  const sendPath = deliverySource.slice(sendStart, sendEnd);
  assert.match(sendPath, /webhookSigningSecretIssue\(secret, \{ required: true \}\)/);
  assert.match(sendPath, /createWebhookSignatureHeaders/);
  assert.doesNotMatch(sendPath, /secret \? \{ "x-nexid-signature"/);

  const createRoute = readFileSync(new URL("../src/app/admin/webhooks/route.ts", import.meta.url), "utf8");
  const updateRoute = readFileSync(new URL("../src/app/admin/webhooks/[id]/route.ts", import.meta.url), "utf8");
  assert.match(createRoute, /webhookSigningSecretIssue\(effectiveSigningSecret, \{ required: true \}\)/);
  assert.match(updateRoute, /webhookSigningSecretIssue\(effectiveSigningSecret, \{ required: true \}\)/);
});

test("signature v2 rollout preserves existing endpoints and defaults new endpoints to v2", () => {
  const schemaSource = readFileSync(new URL("../src/lib/commercial-runtime-schema.ts", import.meta.url), "utf8");
  const createRoute = readFileSync(new URL("../src/app/admin/webhooks/route.ts", import.meta.url), "utf8");
  const updateRoute = readFileSync(new URL("../src/app/admin/webhooks/[id]/route.ts", import.meta.url), "utf8");
  const deliverySource = readFileSync(new URL("../src/lib/sdk-webhooks.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../db/migrations/20260726103000_0058_webhook_signature_v2.sql", import.meta.url), "utf8");

  assert.match(schemaSource, /UPDATE webhook_endpoints SET signature_version = 'v1' WHERE signature_version IS NULL/);
  assert.match(schemaSource, /ALTER COLUMN signature_version SET DEFAULT 'v2'/);
  assert.match(migration, /SET signature_version = 'v1'[\s\S]*SET DEFAULT 'v2'/);
  assert.match(migration, /CHECK \(signature_version IN \('v1', 'v2'\)\)/);
  assert.match(createRoute, /signatureVersion \|\| "v2"/);
  assert.match(createRoute, /signature_version = COALESCE\(\$\{signatureVersion\}, webhook_endpoints\.signature_version\)/);
  assert.match(updateRoute, /normalizeWebhookSignatureVersion/);
  assert.match(deliverySource, /we\.signature_version/);
  assert.match(deliverySource, /version: signatureVersion/);
});
