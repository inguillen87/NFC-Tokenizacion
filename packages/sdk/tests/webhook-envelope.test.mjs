import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  NEXID_WEBHOOK_EVENT_SCHEMA_VERSION,
  NEXID_WEBHOOK_EVENT_TYPES,
  verifyAndParseNexIdWebhook,
} from "../src/index.ts";

const secret = "whsec_0123456789abcdef0123456789abcdef";
const timestamp = 1_760_000_000;

function signedBody(body, eventId = "evt_12345678") {
  const rawBody = typeof body === "string" || body instanceof Uint8Array
    ? body
    : JSON.stringify(body);
  const keyId = "endpoint_12345678";
  const deliveryId = "delivery_12345678";
  const bodyBytes = typeof rawBody === "string" ? Buffer.byteLength(rawBody, "utf8") : rawBody.byteLength;
  const prefix = [
    "v2",
    String(timestamp),
    Buffer.byteLength(keyId, "utf8"),
    keyId,
    Buffer.byteLength(deliveryId, "utf8"),
    deliveryId,
    Buffer.byteLength(eventId, "utf8"),
    eventId,
    bodyBytes,
    "",
  ].join(".");
  const signature = createHmac("sha256", secret).update(prefix, "utf8").update(rawBody).digest("hex");
  return {
    rawBody,
    headers: {
      "x-nexid-signature-version": "v2",
      "x-nexid-timestamp": String(timestamp),
      "x-nexid-key-id": keyId,
      "x-nexid-delivery-id": deliveryId,
      "x-nexid-event-id": eventId,
      "x-nexid-signature": `v2=${signature}`,
    },
  };
}

test("verifies and parses the current versioned webhook contract", () => {
  const signed = signedBody({
    schemaVersion: "1.0",
    id: "evt_12345678",
    type: "sdk.verify",
    createdAt: "2026-07-29T12:00:00.000Z",
    data: { verdict: "VALID" },
  });
  const result = verifyAndParseNexIdWebhook({
    secret,
    ...signed,
    now: timestamp,
    expectedEventTypes: ["sdk.verify"],
  });

  assert.equal(NEXID_WEBHOOK_EVENT_SCHEMA_VERSION, "1.0");
  assert.ok(NEXID_WEBHOOK_EVENT_TYPES.includes("sdk.verify"));
  assert.equal(result.ok, true);
  assert.equal(result.contractVersion, "1.0");
  assert.equal(result.knownEventType, true);
  assert.equal(result.event.id, "evt_12345678");
  assert.deepEqual(result.event.data, { verdict: "VALID" });
});

test("keeps exactly the unversioned N-1 envelope readable during migration", () => {
  const signed = signedBody({
    id: "evt_12345678",
    type: "partner.custom_event",
    createdAt: "2026-07-29T12:00:00.000Z",
    data: { externalId: "wms-42" },
  });
  const result = verifyAndParseNexIdWebhook({ secret, ...signed, now: timestamp });

  assert.equal(result.ok, true);
  assert.equal(result.contractVersion, "legacy");
  assert.equal(result.knownEventType, false);
});

test("fails closed on future schema versions and signed header/body identity mismatch", () => {
  const future = signedBody({
    schemaVersion: "2.0",
    id: "evt_12345678",
    type: "sdk.verify",
    createdAt: "2026-07-29T12:00:00.000Z",
    data: {},
  });
  assert.deepEqual(
    verifyAndParseNexIdWebhook({ secret, ...future, now: timestamp }),
    { ok: false, stage: "envelope", reason: "unsupported_webhook_schema_version" },
  );

  const mismatch = signedBody({
    schemaVersion: "1.0",
    id: "evt_body1234",
    type: "sdk.verify",
    createdAt: "2026-07-29T12:00:00.000Z",
    data: {},
  }, "evt_header12");
  assert.deepEqual(
    verifyAndParseNexIdWebhook({ secret, ...mismatch, now: timestamp }),
    { ok: false, stage: "envelope", reason: "webhook_event_id_mismatch" },
  );
});

test("rejects malformed envelopes, invalid UTF-8 and unexpected event types", () => {
  const malformed = signedBody("{not-json");
  assert.deepEqual(
    verifyAndParseNexIdWebhook({ secret, ...malformed, now: timestamp }),
    { ok: false, stage: "envelope", reason: "invalid_webhook_json" },
  );

  const invalidUtf8 = signedBody(new Uint8Array([0xc3, 0x28]));
  assert.deepEqual(
    verifyAndParseNexIdWebhook({ secret, ...invalidUtf8, now: timestamp }),
    { ok: false, stage: "envelope", reason: "invalid_webhook_body_encoding" },
  );

  const unexpected = signedBody({
    schemaVersion: "1.0",
    id: "evt_12345678",
    type: "sdk.external_event",
    createdAt: "2026-07-29T12:00:00.000Z",
    data: {},
  });
  assert.deepEqual(
    verifyAndParseNexIdWebhook({
      secret,
      ...unexpected,
      now: timestamp,
      expectedEventTypes: ["sdk.verify"],
    }),
    { ok: false, stage: "envelope", reason: "unexpected_webhook_event_type" },
  );
});

test("enforces a bounded event body after signature verification", () => {
  const signed = signedBody({
    schemaVersion: "1.0",
    id: "evt_12345678",
    type: "sdk.verify",
    createdAt: "2026-07-29T12:00:00.000Z",
    data: { padding: "x".repeat(1_000) },
  });
  assert.deepEqual(
    verifyAndParseNexIdWebhook({ secret, ...signed, now: timestamp, maxBodyBytes: 128 }),
    { ok: false, stage: "envelope", reason: "webhook_body_too_large" },
  );
});
