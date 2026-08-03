import assert from "node:assert/strict";
import test from "node:test";

import { NexIdApiError, NexIdClient } from "../src/index.ts";

const CAPTURED_URL = "https://tags.example.test/sun?v=1&bid=LOT-2026-001&picc_data=00112233445566778899AABBCCDDEEFF&enc=00112233445566778899AABBCCDDEEFF&cmac=0011223344556677";
const DEVICE_ID = "d877a64d-5a44-4a02-8d33-efb9f4bc0c74";
const BUNDLE_ID = "ovb_0123456789abcdef0123456789abcdef0123";

function request() {
  return {
    schemaVersion: 1,
    bundleId: BUNDLE_ID,
    deviceId: DEVICE_ID,
    events: [{
      localId: "warehouse-device-1-scan-42",
      capturedUrl: CAPTURED_URL,
      capturedAt: new Date(Date.now() - 60_000).toISOString(),
      status: "PENDING_BACKEND_VERIFICATION",
      appVersion: "2.4.1",
    }],
  };
}

function validServerResponse(overrides = {}) {
  return {
    ok: true,
    schema_version: 1,
    final_verdict_source: "backend_sun_sdm",
    received: 1,
    duplicates: 0,
    verified: 1,
    valid: 1,
    invalid: 0,
    pending: 0,
    rejected: 0,
    trace_id: "offline-trace-1",
    results: [{
      ok: true,
      client_event_id: "warehouse-device-1-scan-42",
      bid: "LOT-2026-001",
      sync_status: "SYNCED_VALID",
      final_verdict: true,
      verdict: "MESSAGE_VALID",
      cryptographic_verification: true,
      uid_masked: "04AA****EEFF",
      read_counter: 42,
      seal_status: "CLOSED",
      sun_event_id: "123",
      verified_at: "2026-08-02T12:00:05.000Z",
      reason: "sun_sdm_backend_verified",
      replayed: false,
      captured_url: CAPTURED_URL,
    }],
    ...overrides,
  };
}

test("syncOfflineScans sends a bounded idempotent operator queue and returns a redacted final receipt", async () => {
  let captured;
  const client = new NexIdClient({
    apiKey: "nxid_test_secret",
    tenantSlug: "tenant-demo",
    retry: false,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return Response.json(validServerResponse());
    },
  });

  const payload = request();
  const result = await client.syncOfflineScans(payload, {
    idempotencyKey: "warehouse-device-1-upload-42",
    requestId: "offline-upload-42",
  });

  assert.equal(captured.url, "https://api.nexid.lat/api/v1/sdk/offline-sync");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["idempotency-key"], "warehouse-device-1-upload-42");
  assert.deepEqual(JSON.parse(captured.init.body), payload);
  assert.equal(result.finalVerdictSource, "backend_sun_sdm");
  assert.equal(result.results[0].status, "SYNCED_VALID");
  assert.equal(result.results[0].cryptographicVerification, true);
  assert.equal(result.results[0].uidMasked, "04AA****EEFF");
  assert.equal("captured_url" in result.results[0], false);
  assert.equal("capturedUrl" in result.results[0], false);
});

test("offline sync retries transport failures only with the explicit batch idempotency key", async () => {
  const calls = [];
  const responses = [
    Response.json({ ok: false, reason: "offline_sync_unavailable" }, { status: 503, headers: { "retry-after": "0" } }),
    Response.json(validServerResponse()),
  ];
  const client = new NexIdClient({
    apiKey: "nxid_test_secret",
    tenantSlug: "tenant-demo",
    retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    fetchImpl: async (_url, init) => {
      calls.push(init.headers["idempotency-key"]);
      return responses.shift();
    },
  });

  const result = await client.syncOfflineScans(request(), {
    idempotencyKey: "warehouse-device-1-upload-42",
    maxRetries: 1,
  });
  assert.equal(result.valid, 1);
  assert.deepEqual(calls, ["warehouse-device-1-upload-42", "warehouse-device-1-upload-42"]);
});

test("offline sync rejects fake local verdicts and malformed SUN URLs before network I/O", async () => {
  let calls = 0;
  const client = new NexIdClient({
    apiKey: "nxid_test_secret",
    tenantSlug: "tenant-demo",
    retry: false,
    fetchImpl: async () => {
      calls += 1;
      return Response.json(validServerResponse());
    },
  });

  assert.throws(
    () => client.syncOfflineScans({
      ...request(),
      events: [{ ...request().events[0], status: "SYNCED_VALID" }],
    }, { idempotencyKey: "offline-upload-invalid-1" }),
    /cannot claim a final local authenticity verdict/,
  );
  assert.throws(
    () => client.syncOfflineScans({
      ...request(),
      events: [{ ...request().events[0], capturedUrl: CAPTURED_URL.replace("https://", "http://") }],
    }, { idempotencyKey: "offline-upload-invalid-2" }),
    /absolute HTTPS SUN URL/,
  );
  assert.equal(calls, 0);
});

test("SDK fails closed if the API labels an unverified result as SYNCED_VALID", async () => {
  const invalid = validServerResponse({
    results: [{
      ...validServerResponse().results[0],
      cryptographic_verification: false,
    }],
  });
  const client = new NexIdClient({
    apiKey: "nxid_test_secret",
    tenantSlug: "tenant-demo",
    retry: false,
    fetchImpl: async () => Response.json(invalid),
  });

  await assert.rejects(
    client.syncOfflineScans(request(), { idempotencyKey: "offline-upload-invalid-response" }),
    (error) => error instanceof NexIdApiError && error.status === 502 && error.reason === "invalid_offline_sync_response",
  );
});
