import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  NEXID_WEBHOOK_SIGNATURE_VERSION,
  NEXID_WEBHOOK_SIGNATURE_VERSION_V1,
  NEXID_WEBHOOK_SIGNATURE_VERSION_V2,
  NEXID_WEBHOOK_SIGNATURE_VERSIONS,
  verifyNexIdWebhookSignature,
} from "../src/index.ts";

const secret = "whsec_0123456789abcdef0123456789abcdef";
const timestamp = 1_760_000_000;
const rawBody = Buffer.from(JSON.stringify({ id: "evt_ñ", type: "shipment.handoff", ok: true }), "utf8");

function canonicalPrefix({ version, timestampValue, keyId, deliveryId, eventId, body }) {
  const keyFrame = version === "v2" ? [Buffer.byteLength(keyId, "utf8"), keyId] : [];
  return [
    version,
    String(timestampValue),
    ...keyFrame,
    Buffer.byteLength(deliveryId, "utf8"),
    deliveryId,
    Buffer.byteLength(eventId, "utf8"),
    eventId,
    body.byteLength,
    "",
  ].join(".");
}

function signedEnvelope(version) {
  const values = {
    version,
    timestampValue: timestamp,
    keyId: "key_á_2026",
    deliveryId: "delivery_456",
    eventId: "evt_ñ",
    body: rawBody,
  };
  const digest = createHmac("sha256", secret)
    .update(canonicalPrefix(values), "utf8")
    .update(rawBody)
    .digest("hex");
  return {
    values,
    headers: {
      "x-nexid-signature-version": version,
      "x-nexid-timestamp": String(timestamp),
      "x-nexid-key-id": values.keyId,
      "x-nexid-delivery-id": values.deliveryId,
      "x-nexid-event-id": values.eventId,
      "x-nexid-signature": `${version}=${digest}`,
    },
  };
}

test("keeps the legacy v1 constant and envelope explicitly available", () => {
  assert.equal(NEXID_WEBHOOK_SIGNATURE_VERSION, "v1");
  assert.equal(NEXID_WEBHOOK_SIGNATURE_VERSION_V1, "v1");
  assert.equal(NEXID_WEBHOOK_SIGNATURE_VERSION_V2, "v2");
  assert.deepEqual([...NEXID_WEBHOOK_SIGNATURE_VERSIONS], ["v1", "v2"]);
});

test("verifies the unchanged v1 canonical envelope and documents its unauthenticated keyId", () => {
  const { headers } = signedEnvelope("v1");
  assert.deepEqual(verifyNexIdWebhookSignature({ secret, rawBody, headers, now: timestamp }), {
    ok: true,
    version: "v1",
    timestamp,
    keyId: "key_á_2026",
    keyIdAuthenticated: false,
    deliveryId: "delivery_456",
    eventId: "evt_ñ",
  });

  const tamperedKeyId = { ...headers, "x-nexid-key-id": "attacker-selected-key" };
  assert.deepEqual(verifyNexIdWebhookSignature({ secret, rawBody, headers: tamperedKeyId, now: timestamp }), {
    ok: true,
    version: "v1",
    timestamp,
    keyId: "attacker-selected-key",
    keyIdAuthenticated: false,
    deliveryId: "delivery_456",
    eventId: "evt_ñ",
  });
});

test("v2 authenticates byte-length-framed keyId as part of the canonical payload", () => {
  const { headers } = signedEnvelope("v2");
  assert.deepEqual(verifyNexIdWebhookSignature({ secret, rawBody, headers: new Headers(headers), now: timestamp }), {
    ok: true,
    version: "v2",
    timestamp,
    keyId: "key_á_2026",
    keyIdAuthenticated: true,
    deliveryId: "delivery_456",
    eventId: "evt_ñ",
  });

  const tamperedKeyId = { ...headers, "x-nexid-key-id": "attacker-selected-key" };
  assert.deepEqual(
    verifyNexIdWebhookSignature({ secret, rawBody, headers: tamperedKeyId, now: timestamp }),
    { ok: false, reason: "signature_mismatch" },
  );
});

test("v2 rejects tampering of every signed identity field and the exact raw body", () => {
  const { headers } = signedEnvelope("v2");
  const cases = [
    { headers: { ...headers, "x-nexid-timestamp": String(timestamp + 1) }, body: rawBody },
    { headers: { ...headers, "x-nexid-delivery-id": "delivery_other" }, body: rawBody },
    { headers: { ...headers, "x-nexid-event-id": "evt_other" }, body: rawBody },
    { headers, body: Buffer.concat([rawBody, Buffer.from(" ")]) },
  ];

  for (const tampered of cases) {
    assert.deepEqual(
      verifyNexIdWebhookSignature({ secret, rawBody: tampered.body, headers: tampered.headers, now: timestamp }),
      { ok: false, reason: "signature_mismatch" },
    );
  }
});

test("rejects version confusion and unknown future envelopes", () => {
  const { headers } = signedEnvelope("v2");
  assert.deepEqual(
    verifyNexIdWebhookSignature({
      secret,
      rawBody,
      headers: { ...headers, "x-nexid-signature-version": "v1" },
      now: timestamp,
    }),
    { ok: false, reason: "invalid_signature_format" },
  );
  assert.deepEqual(
    verifyNexIdWebhookSignature({
      secret,
      rawBody,
      headers: {
        ...headers,
        "x-nexid-signature-version": "v3",
        "x-nexid-signature": `v3=${"0".repeat(64)}`,
      },
      now: timestamp,
    }),
    { ok: false, reason: "unsupported_version" },
  );
});
