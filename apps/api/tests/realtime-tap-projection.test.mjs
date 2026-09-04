import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const projectionSource = await readFile(
  new URL("../src/lib/realtime-tap-projection.ts", import.meta.url),
  "utf8",
);

test("tap push is rebuilt from persisted tenant truth rather than request guesses", () => {
  assert.match(projectionSource, /WHERE e\.id = \$\{eventId\}/);
  assert.match(projectionSource, /JOIN tenants t ON t\.id = e\.tenant_id/);
  assert.match(projectionSource, /AS known_actor_count/);
  assert.match(projectionSource, /AS commercial_consent_channels/);
  assert.match(projectionSource, /e\.location_source/);
  assert.match(projectionSource, /to_jsonb\(e\)->'post_tap_location_observation' AS post_tap_location_observation/);
  assert.match(projectionSource, /AS bid/);
  assert.match(projectionSource, /normalizePersistedTenantTapRealtimeEvent\(rows\[0\]/);
  assert.match(projectionSource, /bid: projection\.bid/);
  assert.match(projectionSource, /tap_projection: projection/);
});

test("a consented post-tap observation atomically replaces request location in the realtime view", async () => {
  const { normalizePersistedTenantTapRealtimeEvent } = await import("../src/lib/realtime-tap-projection.ts");
  const persistedRow = {
    id: 42,
    tenant_id: "tenant-id",
    tenant_slug: "demobodega",
    batch_id: "batch-id",
    tag_id: "tag-id",
    created_at: "2026-09-04T12:00:00.000Z",
    event_type: "TAP_VALID",
    result: "VALID_CLOSED",
    verdict: "valid",
    source: "real",
    city: "Buenos Aires",
    country_code: "AR",
    lat: -34.604,
    lng: -58.382,
    location_source: "edge_ip_approx",
    location_accuracy_m: null,
    commercial_consent_channels: [],
    post_tap_location_observation: {
      schemaVersion: "sun-browser-location-observation/v1",
      consent: true,
      precision: "approximate",
      source: "browser_geolocation_approximate_consent",
      city: "Santiago",
      countryCode: "cl",
      lat: -33.449,
      lng: -70.669,
      accuracyM: 850,
    },
  };

  const projected = normalizePersistedTenantTapRealtimeEvent(persistedRow);
  assert.deepEqual(
    {
      city: projected.city,
      country: projected.country,
      lat: projected.lat,
      lng: projected.lng,
      source: projected.locationSource,
      accuracyM: projected.locationAccuracyM,
    },
    {
      city: "Santiago",
      country: "CL",
      lat: -33.449,
      lng: -70.669,
      source: "browser_geolocation_approximate_consent",
      accuracyM: 850,
    },
  );
  assert.equal(persistedRow.city, "Buenos Aires");
  assert.equal(persistedRow.location_source, "edge_ip_approx");
});

test("post-tap location is all-or-nothing and invalid evidence keeps request provenance", async () => {
  const { normalizePersistedTenantTapRealtimeEvent } = await import("../src/lib/realtime-tap-projection.ts");
  const base = {
    id: 43,
    tenant_id: "tenant-id",
    tenant_slug: "demobodega",
    batch_id: "batch-id",
    tag_id: "tag-id",
    created_at: "2026-09-04T12:00:00.000Z",
    event_type: "TAP_VALID",
    result: "VALID_CLOSED",
    verdict: "valid",
    source: "real",
    city: "Buenos Aires",
    country_code: "AR",
    lat: -34.604,
    lng: -58.382,
    location_source: "edge_ip_approx",
    location_accuracy_m: null,
    commercial_consent_channels: [],
  };
  const invalidEvidence = {
    schemaVersion: "sun-browser-location-observation/v1",
    consent: false,
    precision: "approximate",
    source: "browser_geolocation_approximate_consent",
    city: "Santiago",
    countryCode: "CL",
    lat: -33.449,
    lng: -70.669,
    accuracyM: 850,
  };

  const projected = normalizePersistedTenantTapRealtimeEvent({
    ...base,
    post_tap_location_observation: invalidEvidence,
  });
  assert.deepEqual(
    {
      city: projected.city,
      country: projected.country,
      lat: projected.lat,
      lng: projected.lng,
      source: projected.locationSource,
      accuracyM: projected.locationAccuracyM,
    },
    {
      city: "Buenos Aires",
      country: "AR",
      lat: -34.604,
      lng: -58.382,
      source: "edge_ip_approx",
      accuracyM: null,
    },
  );
});

test("the SSE snapshot and raw-event paths use the post-tap aware projection", async () => {
  const streamRoute = await readFile(
    new URL("../src/app/admin/events/stream/route.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    streamRoute.match(/to_jsonb\(e\)->'post_tap_location_observation' AS post_tap_location_observation/g)?.length,
    2,
  );
  assert.match(streamRoute, /embeddedProjection \|\| normalizePersistedTenantTapRealtimeEvent\(rawPayload\)/);
  assert.match(streamRoute, /snapshotRows\.map\(\(row\) => normalizePersistedTenantTapRealtimeEvent\(row\)\)/);
});

test("embedded tap projections require complete tenant and event identity", async () => {
  const { readEmbeddedTenantTapProjection } = await import("../src/lib/realtime-tap-projection.ts");
  assert.equal(readEmbeddedTenantTapProjection({ eventId: "1" }), null);
  const projection = {
    eventId: "42",
    tenantId: "tenant-id",
    tenantSlug: "demobodega",
    batchId: "batch-id",
    occurredAt: "2026-09-04T12:00:00.000Z",
    eventType: "TAP_VALID",
    eventSource: "real",
    commercialConsentChannels: [],
  };
  assert.equal(readEmbeddedTenantTapProjection(projection), projection);
});

test("canonical and SUN publishers await the persisted projection without rolling back writes", async () => {
  const canonical = await readFile(new URL("../src/lib/canonical-event-writer.ts", import.meta.url), "utf8");
  const sun = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");
  assert.match(canonical, /await publishTenantTapRealtimeProjection\(receipt\.eventId, traceId\)/);
  assert.match(canonical, /Re-publishing an idempotent database replay repairs the request-level gap/);
  assert.doesNotMatch(canonical, /if \(!receipt\.replayed\)/);
  assert.match(canonical, /canonical_realtime_projection_failed/);
  assert.match(sun, /await publishTenantTapRealtimeProjection/);
  assert.match(sun, /sun_realtime_projection_failed/);
});
