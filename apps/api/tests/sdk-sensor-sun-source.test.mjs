import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

import {
  SDK_SENSOR_EVENT_SOURCE,
  SDK_SENSOR_INGESTION_TRANSPORT,
  SDK_SENSOR_READING_EVENT_TYPE,
  normalizeSdkSensorEvent,
  projectSdkSensorTimelineRows,
  sdkSensorEvidenceReceipt,
  sdkSensorReceiptMatchesTarget,
} from "../src/lib/sdk-sensor-event.ts";

const NOW = Date.parse("2026-08-29T12:00:00.000Z");

test("sensor SDK payload is unit-bound and reduced to the public allowlist", () => {
  const result = normalizeSdkSensorEvent({
    bid: "BID-SUN-001",
    uidHex: "04A1B2C3D4E5F6",
    occurredAt: "2026-08-29T11:55:00-00:00",
    source: "Acme Cold Chain API",
    data: {
      sensors: {
        temperatureC: 12.45678,
        humidityPct: 68.2,
        lightExposure: 450,
        transitShock: 0.25,
        deviceId: "logger-7",
        stage: "warehouse",
      },
    },
  }, NOW);

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    bid: "BID-SUN-001",
    uidHex: "04A1B2C3D4E5F6",
    occurredAt: "2026-08-29T11:55:00.000Z",
    source: SDK_SENSOR_EVENT_SOURCE,
    data: {
      sensors: {
        temperatureC: 12.457,
        humidityPct: 68.2,
        lightExposure: "450 lux",
        transitShock: "0.25 g",
        measuredAt: "2026-08-29T11:55:00.000Z",
        source: "Acme Cold Chain API",
        deviceId: "logger-7",
        stage: "warehouse",
      },
    },
  });
});

test("sensor SDK payload fails closed without BID, registered-unit UID, time or measurement", () => {
  const base = {
    bid: "BID-SUN-001",
    uidHex: "04A1B2C3D4E5F6",
    occurredAt: "2026-08-29T11:55:00Z",
    data: { sensors: { temperatureC: 12, source: "tenant-api" } },
  };
  assert.equal(normalizeSdkSensorEvent({ ...base, bid: "" }, NOW).reason, "sdk_sensor_bid_required");
  assert.equal(normalizeSdkSensorEvent({ ...base, uidHex: "" }, NOW).reason, "sdk_sensor_uid_required");
  assert.equal(normalizeSdkSensorEvent({ ...base, occurredAt: undefined }, NOW).reason, "sdk_sensor_measured_at_required_or_invalid");
  assert.equal(normalizeSdkSensorEvent({ ...base, data: { sensors: { source: "tenant-api" } } }, NOW).reason, "sdk_sensor_measurement_required");
  assert.equal(normalizeSdkSensorEvent({ ...base, data: { sensors: { temperatureC: 12, source: "tenant-api", apiKey: "forbidden" } } }, NOW).reason, "sdk_sensor_fields_unsupported");
  assert.equal(normalizeSdkSensorEvent({ ...base, data: { sensors: { temperatureC: 12, source: "tenant-api", nexidExpectedTagId: "forged" } } }, NOW).reason, "sdk_sensor_fields_unsupported");
  assert.equal(normalizeSdkSensorEvent({ ...base, data: { sensors: { humidityPct: 101, source: "tenant-api" } } }, NOW).reason, "sdk_sensor_humidity_invalid");
});

test("sensor receipt must preserve the exact pre-resolved batch and tag binding", () => {
  const target = {
    batchId: "22222222-2222-4222-8222-222222222222",
    tagId: "33333333-3333-4333-8333-333333333333",
    bid: "BID-SUN-001",
    uidHex: "04A1B2C3D4E5F6",
  };
  assert.equal(sdkSensorReceiptMatchesTarget(target, {
    ...target,
    batchId: target.batchId.toUpperCase(),
    uidHex: target.uidHex.toLowerCase(),
  }), true);
  assert.equal(sdkSensorReceiptMatchesTarget(target, { ...target, tagId: null }), false);
  assert.equal(sdkSensorReceiptMatchesTarget(target, {
    ...target,
    tagId: "44444444-4444-4444-8444-444444444444",
  }), false);
  assert.equal(sdkSensorReceiptMatchesTarget(target, { ...target, bid: "BID-OTHER" }), false);
});

test("sensor ingestion receipt distinguishes one accepted reading from live connector health", () => {
  assert.deepEqual(sdkSensorEvidenceReceipt(true), {
    kind: "reported",
    storage: "sdk_external_events",
    timelineEligible: true,
    ingestionTransport: SDK_SENSOR_INGESTION_TRANSPORT,
    readingStatus: "accepted",
    connectorStatus: "not_monitored",
    evidenceAuthority: "tenant_reported",
    liveStreamConnected: false,
  });
  assert.equal(sdkSensorEvidenceReceipt(false).readingStatus, "quarantined");
  assert.equal(sdkSensorEvidenceReceipt(false).timelineEligible, false);
});

test("SUN source selects only allowlisted SDK sensor fields and projects valid readings", async () => {
  const source = await readFile(new URL("../src/lib/sdk-sensor-sun-source.ts", import.meta.url), "utf8");
  assert.match(source, /sdk_external_events/);
  assert.match(source, /external_event\.tag_id/);
  assert.match(source, /batch\.tenant_id = \$\{input\.tenantId\}::uuid/);
  assert.match(source, /upper\(tag\.uid_hex\) = upper\(external_event\.uid_hex\)/);
  assert.match(source, /jsonb_object_length\(external_event\.data\) = 1/);
  assert.match(source, /nexidExpectedBatchId}' = external_event\.batch_id::text/);
  assert.match(source, /nexidExpectedTagId}' = external_event\.tag_id::text/);
  assert.match(source, /jsonb_object_keys\(external_event\.data->'sensors'\)/);
  assert.doesNotMatch(source, /SELECT\s+external_event\.data(?:\s|,)/i);
  assert.match(source, /SDK_SENSOR_READING_EVENT_TYPE/);
  assert.match(source, /SDK_SENSOR_EVENT_SOURCE/);

  const readings = projectSdkSensorTimelineRows([{
      received_at: "2026-08-29T11:56:00Z",
      occurred_at: "2026-08-29T11:55:30Z",
      measured_at: "2026-08-29T11:55:00Z",
      temperature_c: "12.4",
      humidity_pct: "68.2",
      light_exposure: "450 lux",
      transit_shock: "0.25 g",
      device_id: "logger-7",
      sensor_source: "Acme Cold Chain API",
      stage: "warehouse",
  }], NOW);
  assert.deepEqual(readings, [{
    receivedAt: "2026-08-29T11:56:00.000Z",
    occurredAt: "2026-08-29T11:55:30.000Z",
    measuredAt: "2026-08-29T11:55:00.000Z",
    temperatureC: 12.4,
    humidityPct: 68.2,
    lightExposure: "450 lux",
    transitShock: "0.25 g",
    deviceId: "logger-7",
    source: "Acme Cold Chain API",
    stage: "warehouse",
  }]);
});

test("SDK event route keeps generic events compatible and never writes sensor data into canonical tap events", async () => {
  const route = await readFile(new URL("../src/app/api/v1/sdk/events/route.ts", import.meta.url), "utf8");
  assert.match(route, /isSdkSensorReadingEventType/);
  assert.match(route, /sdk_sensor_idempotency_key_required/);
  assert.match(route, /statusCode: 428/);
  assert.match(route, /req\.headers\.get\("idempotency-key"\)/);
  assert.match(route, /normalizeSdkSensorEvent/);
  assert.match(route, /resolveSdkSensorTarget/);
  assert.match(route, /nexidExpectedBatchId: sensorTarget\.batchId/);
  assert.match(route, /nexidExpectedTagId: sensorTarget\.tagId/);
  assert.match(route, /sdkSensorReceiptMatchesTarget\(sensorTarget, persisted\)/);
  assert.match(route, /reason: "sdk_sensor_target_changed"/);
  assert.match(route, /operationCommitted: true/);
  assert.match(route, /timelineEligible: false/);
  assert.match(route, /else \{[\s\S]*\.\.\.asRecord\(body\.data\)/);
  assert.match(route, /sdkSensorEvidenceReceipt\(true\)/);
  assert.match(route, /sdkSensorEvidenceReceipt\(false\)/);
  assert.doesNotMatch(route, /INSERT INTO (?:public\.)?events/i);
  const receiptGuard = route.indexOf("if (isSensorReading &&");
  const realtimePublish = route.indexOf("publishRealtimeEvent({", receiptGuard);
  assert.ok(receiptGuard > 0 && realtimePublish > receiptGuard, "receipt mismatch must return before realtime publication");
});

test("SUN consumes unit-bound SDK readings as sensor evidence without counting them as NFC taps", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  assert.match(route, /import \{ listSdkSensorTimeline \} from '\.\.\/\.\.\/lib\/sdk-sensor-sun-source'/);
  assert.match(route, /listSdkSensorTimeline\(\{[\s\S]*tenantId: input\.tenantId,[\s\S]*bid: input\.bid,[\s\S]*uidHex: input\.uid/);
  assert.match(route, /const sensorEvidenceTimeline = \[\.\.\.params\.timeline, \.\.\.\(params\.sensorTimeline \|\| \[\]\)\]/);
  assert.match(route, /sensorTimeline: sdkSensorTimeline/);
  // Check the actual public-contract inputs rather than a removed intermediate
  // variable. Sensor readings must remain a separate input from NFC history.
  const source = ts.createSourceFile("sun-route.ts", route, ts.ScriptTarget.Latest, true);
  const calls = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "buildPublicContract") calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(calls.length, 1);
  const input = calls[0].arguments[0];
  assert.ok(ts.isObjectLiteralExpression(input));
  const properties = new Map(input.properties.map((property) => [property.name?.getText(source), property]));
  assert.ok(ts.isShorthandPropertyAssignment(properties.get("timeline")), "canonical NFC timeline is passed unchanged");
  assert.equal(properties.get("sensorTimeline")?.initializer?.getText(source), "sdkSensorTimeline");
  assert.match(route, /const timelineLatest = params\.timeline\[0\]/, "latest NFC read must not come from sensor history");
});
