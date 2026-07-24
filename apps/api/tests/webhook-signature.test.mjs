import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createWebhookSignatureHeaders,
  createWebhookSignatureV1,
  WebhookSigningError,
  webhookSigningSecretIssue,
} from "../src/lib/webhook-signing.ts";
import { verifyNexIdWebhookSignature } from "../../../packages/sdk/src/index.ts";

const secret = "whsec_0123456789abcdef0123456789abcdef";
const rawBody = JSON.stringify({ id: "evt_123", type: "sdk.verify", data: { verdict: "VALID" } });
const timestamp = 1_750_000_000;

function signedHeaders() {
  return createWebhookSignatureHeaders({
    secret,
    keyId: "endpoint_123",
    deliveryId: "delivery_456",
    eventId: "evt_123",
    rawBody,
    timestamp,
  });
}

test("webhook v1 signs timestamp, delivery ID, event ID and exact raw body", () => {
  const headers = signedHeaders();
  assert.deepEqual(verifyNexIdWebhookSignature({ secret, rawBody, headers, now: timestamp }), {
    ok: true,
    version: "v1",
    timestamp,
    keyId: "endpoint_123",
    deliveryId: "delivery_456",
    eventId: "evt_123",
  });
  assert.equal(headers["x-nexid-signature-version"], "v1");
  assert.equal(headers["x-nexid-timestamp"], String(timestamp));
  assert.equal(headers["x-nexid-key-id"], "endpoint_123");
  assert.match(headers["x-nexid-signature"], /^v1=[a-f0-9]{64}$/);
});

test("webhook v1 rejects an altered body or signed identity", () => {
  const headers = signedHeaders();
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody: `${rawBody} `, headers, now: timestamp }),
    { ok: false, reason: "signature_mismatch" },
  );
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody, headers: { ...headers, "x-nexid-event-id": "evt_other" }, now: timestamp }),
    { ok: false, reason: "signature_mismatch" },
  );
});

test("webhook v1 rejects expired and future timestamps", () => {
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

test("enabled webhook signing fails closed for absent or weak secrets", () => {
  assert.equal(webhookSigningSecretIssue("", { required: true }), "webhook_signing_secret_required");
  assert.equal(webhookSigningSecretIssue("short-secret", { required: true }), "webhook_signing_secret_too_short");
  assert.equal(webhookSigningSecretIssue("", { required: false }), null);
  assert.throws(
    () => createWebhookSignatureV1({ secret: "short-secret", timestamp, deliveryId: "delivery_456", eventId: "evt_123", rawBody }),
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
