import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertOfflineCaptureWithinBundleWindow,
  normalizeSdkOfflineSyncEvent,
  parseOfflineSunCapturedUrl,
  readStoredOfflineSyncReceipt,
  redactOfflineSunVerification,
} from "../src/lib/sdk-offline-sync.ts";

const VALID_URL = "https://tags.example.test/sun?v=1&bid=LOT-2026-001&picc_data=00112233445566778899AABBCCDDEEFF&enc=00112233445566778899AABBCCDDEEFF&cmac=0011223344556677";
const DEVICE_ID = "d877a64d-5a44-4a02-8d33-efb9f4bc0c74";

test("operator offline captures are parsed as strict transient SUN payloads", () => {
  assert.deepEqual(parseOfflineSunCapturedUrl(VALID_URL), {
    capturedUrl: VALID_URL,
    bid: "LOT-2026-001",
    piccDataHex: "00112233445566778899AABBCCDDEEFF",
    encHex: "00112233445566778899AABBCCDDEEFF",
    cmacHex: "0011223344556677",
  });

  const event = normalizeSdkOfflineSyncEvent({
    localId: "scan-device-0001",
    capturedUrl: VALID_URL,
    capturedAt: "2026-08-02T12:00:00.000Z",
    status: "PENDING_BACKEND_VERIFICATION",
    approximateLocation: {
      consent: true,
      precision: "approximate",
      lat: -34.603722,
      lng: -58.381592,
      accuracy: 12,
    },
  }, {
    expectedDeviceId: DEVICE_ID,
    expectedTenantId: "57a9bba7-0101-41cf-b01c-b1541b8b6c7c",
    expectedTenantSlug: "tenant-demo",
    now: Date.parse("2026-08-02T12:05:00.000Z"),
  });

  assert.equal(event.bid, "LOT-2026-001");
  assert.match(event.sunPayloadHash, /^sha256:[0-9a-f]{64}$/);
  assert.match(event.legacyCapturedUrlHash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(event.approximateLocation, {
    lat: -34.604,
    lng: -58.382,
    accuracy_m: 150,
    precision: "approximate",
  });
});

test("offline Level 2 rejects non-SUN URLs, ambiguous params and local authenticity claims", () => {
  for (const invalid of [
    VALID_URL.replace("https://", "http://"),
    VALID_URL.replace("/sun?", "/other?"),
    `${VALID_URL}&cmac=0011223344556677`,
    `${VALID_URL}&redirect=https://attacker.invalid`,
    VALID_URL.replace("picc_data=00112233445566778899AABBCCDDEEFF", "picc_data=0011"),
  ]) {
    assert.throws(() => parseOfflineSunCapturedUrl(invalid), /offline_sync_/);
  }
  assert.throws(() => normalizeSdkOfflineSyncEvent({
    localId: "scan-device-0002",
    capturedUrl: VALID_URL,
    capturedAt: "2026-08-02T12:00:00.000Z",
    status: "SYNCED_VALID",
  }, {
    expectedDeviceId: DEVICE_ID,
    expectedTenantId: "57a9bba7-0101-41cf-b01c-b1541b8b6c7c",
    expectedTenantSlug: "tenant-demo",
    now: Date.parse("2026-08-02T12:05:00.000Z"),
  }), /offline_sync_requires_pending_backend_verification/);
});

test("bundle capture window is checked independently from later online sync time", () => {
  assert.doesNotThrow(() => assertOfflineCaptureWithinBundleWindow({
    capturedAt: "2026-08-02T12:30:00.000Z",
    bundleCreatedAt: "2026-08-02T12:00:00.000Z",
    bundleExpiresAt: "2026-08-02T13:00:00.000Z",
  }));
  assert.throws(() => assertOfflineCaptureWithinBundleWindow({
    capturedAt: "2026-08-02T13:00:00.001Z",
    bundleCreatedAt: "2026-08-02T12:00:00.000Z",
    bundleExpiresAt: "2026-08-02T13:00:00.000Z",
  }), /offline_sync_capture_outside_bundle_window/);
});

test("hashing or a local pass can never become a backend valid receipt", () => {
  const receipt = redactOfflineSunVerification({
    clientEventId: "scan-device-0003",
    bid: "LOT-2026-001",
    verifiedAt: "2026-08-02T12:10:00.000Z",
    result: {
      status: 200,
      body: {
        ok: true,
        result: "VALID",
        cryptographic_verification: false,
        supplier_payload_match: true,
        uid: "04AABBCCDDEEFF",
      },
    },
  });
  assert.equal(receipt.sync_status, "SYNCED_INVALID");
  assert.equal(receipt.final_verdict, true);
  assert.equal(receipt.cryptographic_verification, false);
  assert.equal(receipt.seal_status, "UNKNOWN");
  assert.equal(receipt.reason, "sun_sdm_cryptographic_verification_failed");
});

test("backend replay has priority over an otherwise cryptographically valid message", () => {
  const receipt = redactOfflineSunVerification({
    clientEventId: "scan-device-0004",
    bid: "LOT-2026-001",
    result: {
      status: 409,
      body: {
        ok: false,
        result: "REPLAY_SUSPECT",
        cryptographic_verification: true,
        uid: "04AABBCCDDEEFF",
        ctr: 9,
        tamper_status: "CLOSED",
        event_id: 123,
      },
    },
  });
  assert.equal(receipt.sync_status, "REPLAY_SUSPECT");
  assert.equal(receipt.verdict, "REPLAY_SUSPECT");
  assert.equal(receipt.cryptographic_verification, false);
  assert.equal(receipt.seal_status, "UNKNOWN");
  assert.equal(receipt.sun_event_id, "123");
});

test("stored idempotency receipts fail closed if valid was not cryptographically proven", () => {
  assert.equal(readStoredOfflineSyncReceipt({
    verification_receipt: {
      ok: true,
      client_event_id: "scan-device-0005",
      bid: "LOT-2026-001",
      sync_status: "SYNCED_VALID",
      final_verdict: true,
      cryptographic_verification: false,
      verified_at: "2026-08-02T12:10:00.000Z",
    },
  }), null);
});

test("SDK offline route reserves once, validates through SUN and persists only redacted evidence", () => {
  const route = readFileSync(new URL("../src/app/api/v1/sdk/offline-sync/route.ts", import.meta.url), "utf8");
  const sunService = readFileSync(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");
  const insert = route.slice(route.indexOf("INSERT INTO offline_scan_events"), route.indexOf("let offlineScanEventId"));

  assert.match(route, /authenticateSdkRequest\(req, "sdk:logistics"\)/);
  assert.match(route, /bundle\.tenant_id = \$\{auth\.context\.tenantId\}/);
  assert.match(route, /device\.tenant_id = \$\{auth\.context\.tenantId\}/);
  assert.match(route, /ON CONFLICT \(tenant_id, device_id, client_event_id\) DO NOTHING/);
  assert.ok(route.indexOf("ON CONFLICT (tenant_id, device_id, client_event_id) DO NOTHING") < route.indexOf("await processSunScan"));
  assert.match(route, /expectedTenantId: auth\.context\.tenantId/);
  assert.match(route, /redactOfflineSunVerification/);
  assert.match(route, /server_verdict = \$\{receipt\.sync_status\}/);
  assert.match(route, /event\.meta->>'offline_scan_event_id' = \$\{offlineScanEventId\}/);
  assert.match(route, /recovered_from_canonical_sun_event: true/);
  assert.match(route, /received_at < now\(\) - interval '5 minutes'/);
  assert.doesNotMatch(insert, /captured_url|picc_data|\benc\b|\bcmac\b/i);
  assert.match(sunService, /expectedTenantId\?: string/);
  assert.match(sunService, /b\.tenant_id = \$\{expectedTenantId\}::uuid/);
});
