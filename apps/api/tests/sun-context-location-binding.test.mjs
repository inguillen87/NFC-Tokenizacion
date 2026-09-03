import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeConsentedApproximateLocation,
  sanitizePublicLocationProjection,
} from "../src/lib/approximate-location.ts";

test("post-tap capture rejects missing or unusable accuracy", () => {
  const base = { consent: true, precision: "approximate", lat: -34.603722, lng: -58.381592 };
  for (const accuracy of [undefined, Number.NaN, -1, 50_001, 100_000]) {
    const result = normalizeConsentedApproximateLocation({ ...base, accuracy });
    assert.equal(result.accepted, false);
    assert.equal(result.reason, "invalid_location_accuracy");
    assert.equal(result.accuracy, null);
  }
});

test("public location projection is coarse and fails closed without durable consent evidence", () => {
  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603722,
    lng: -58.381592,
    locationSource: "browser_gps",
    geoPrecision: "browser_exact",
  }), { lat: null, lng: null });

  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603722,
    lng: -58.381592,
    locationSource: "edge_ip_approx",
    geoPrecision: "ip",
  }), { lat: -34.6, lng: -58.38 });

  const consented = {
    lat: -34.603,
    lng: -58.382,
    locationSource: "browser_geolocation_approximate_consent",
    geoPrecision: "approximate",
    locationAccuracyM: 180,
    metadata: {
      sun_context: {
        geo: {
          source: "browser_geolocation_approximate_consent",
          consent: true,
          precision: "approximate",
          accuracyM: 180,
        },
      },
    },
  };
  assert.deepEqual(sanitizePublicLocationProjection(consented), { lat: -34.6, lng: -58.38 });
  assert.deepEqual(sanitizePublicLocationProjection({
    ...consented,
    metadata: { sun_context: { geo: { ...consented.metadata.sun_context.geo, consent: false } } },
  }), { lat: null, lng: null });

  assert.deepEqual(sanitizePublicLocationProjection({
    lat: -34.603722,
    lng: -58.381592,
    geoPrecision: "ip",
    metadata: {
      sun_context: {
        tap_request_location: { source: "ip_geo", precision: "ip" },
        geo: {
          source: "browser_geolocation_approximate_consent",
          consent: true,
          precision: "approximate",
          accuracyM: 180,
        },
      },
    },
  }), { lat: -34.6, lng: -58.38 }, "the original tap evidence must win over a later browser observation");
});

test("context uses the canonical event UID and returns only a coarse nested receipt", async () => {
  const source = await readFile(new URL("../src/app/sun/context/route.ts", import.meta.url), "utf8");
  const optionalUidValidation = source.indexOf("(uid && !UID_RE.test(uid))");
  const preflight = source.indexOf("requireSunFreshHandoff(req, body");
  const canonicalUid = source.indexOf("const targetUid = String(target.uid_hex");
  const consume = source.indexOf("consumeSunFreshHandoff(req, body");
  const receiptStart = source.search(/return json\(\{\r?\n    ok: true/);
  const receipt = source.slice(receiptStart);

  assert.notEqual(optionalUidValidation, -1);
  assert.notEqual(preflight, -1);
  assert.notEqual(canonicalUid, -1);
  assert.notEqual(consume, -1);
  assert.ok(preflight < canonicalUid && canonicalUid < consume);
  assert.match(source, /\(\$\{uid \|\| null\}::text IS NULL OR UPPER\(e\.uid_hex\) = \$\{uid \|\| null\}\)/);
  assert.match(source, /uidHex: targetUid,[\s\S]*readCounter: ctr/);
  assert.match(source, /if \(!UID_RE\.test\(targetUid\)\)/);
  assert.match(source, /Date\.parse\(locationMeasuredAt\) < Date\.parse\(locationRequestedAt\)/);
  assert.match(source, /isPostTapLocationTimingValid\(\{[\s\S]*eventCreatedAt: target\.created_at,[\s\S]*requestReceivedAtMs/);
  assert.match(source, /timing: hasBrowserLocation \? "client_reported_after_tap"/);
  assert.match(source, /reason: "sun_context_schema_not_ready"/);
  assert.doesNotMatch(source, /ALTER TABLE|ensureEventLocationContextSchema|meta_only/);

  assert.notEqual(receiptStart, -1);
  assert.match(receipt, /location: \{[\s\S]*precision: hasBrowserLocation \? "approximate" : "none"/);
  assert.match(receipt, /lat: publicLocation\.lat,[\s\S]*lng: publicLocation\.lng/);
  assert.match(receipt, /accuracyM: accuracy,[\s\S]*tapReceivedAt:[\s\S]*measuredAt: locationMeasuredAt,[\s\S]*receivedAt: locationReceivedAt/);
  assert.doesNotMatch(receipt, /\n\s*uid(?:Hex)?:/);
});

test("the post-tap observation migration is additive, separate, and fail-closed", async () => {
  const contextMigration = await readFile(
    new URL("../db/migrations/20260831190000_0099_post_tap_location_observation.sql", import.meta.url),
    "utf8",
  );

  assert.match(contextMigration, /ADD COLUMN IF NOT EXISTS post_tap_location_observation jsonb/);
  assert.match(contextMigration, /events_post_tap_location_observation_check/);
  assert.match(contextMigration, /sun-browser-location-observation\/v1/);
  assert.match(contextMigration, /browser_geolocation_approximate_consent/);
  assert.match(contextMigration, /accuracyM'[\s\S]*BETWEEN 150 AND 50000/);
  assert.match(
    contextMigration,
    /post_tap_location_observation IS NULL OR \(\([\s\S]*\) IS TRUE\)/,
    "incomplete JSON objects must evaluate to false instead of passing through SQL NULL",
  );
  assert.match(contextMigration, /VALIDATE CONSTRAINT events_post_tap_location_observation_check/);
  assert.match(contextMigration, /post_tap_location_observation_schema_postcondition_failed/);
  assert.doesNotMatch(contextMigration, /DROP\s+(TABLE|COLUMN|TYPE)|DELETE\s+FROM|UPDATE\s+/i);
});

test("SUN context reserves an invariant source bucket before attacker-controlled capability scope", async () => {
  const source = await readFile(new URL("../src/app/sun/context/route.ts", import.meta.url), "utf8");
  const preAuth = source.indexOf('subjectId: "sun-context:unauthenticated"');
  const capability = source.indexOf("requireSunFreshHandoff(req, body");
  const scoped = source.indexOf('subjectId: `sun-event:${eventId}`');

  assert.notEqual(preAuth, -1);
  assert.notEqual(capability, -1);
  assert.notEqual(scoped, -1);
  assert.ok(preAuth < capability && capability < scoped);
  assert.match(source.slice(0, capability), /tenantId: "platform"/);
});

test("public SUN timeline exposes only tenant-published coarse checkpoints", async () => {
  const source = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  const timelineStart = source.indexOf("async function getTimelineSummary");
  const timelineEnd = source.indexOf("async function getSdkSensorTimelineSummary", timelineStart);
  const timeline = source.slice(timelineStart, timelineEnd);

  assert.match(timeline, /SELECT date_trunc\('day', e\.created_at\)::date::text AS at, e\.meta/);
  assert.match(timeline, /e\.meta->'public_checkpoint'->>'visibility'/);
  assert.match(timeline, /const publicCheckpoint = \(meta\.public_checkpoint/);
  assert.match(timeline, /device: null,[\s\S]*lat: null,[\s\S]*lng: null/);
  assert.doesNotMatch(timeline, /e\.id|e\.lat|e\.lng|location_source|location_accuracy_m|geo_precision|sanitizePublicLocationProjection/);
});
