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
  assert.match(projectionSource, /AS bid/);
  assert.match(projectionSource, /normalizeTenantTapRealtimeEvent\(projectConsentedPostTapLocation\(rows\[0\]/);
  assert.match(projectionSource, /bid: projection\.bid/);
  assert.match(projectionSource, /tap_projection: projection/);
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
