import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeTenantTapRealtimeEvent, normalizeEventDataProvenance } from "../../../packages/core/src/event-contract.ts";
import { readEmbeddedTenantTapProjection, loadTenantTapRealtimeProjection } from "../src/lib/realtime-tap-projection.ts";
import { minimizeRealtimePayloadForBroker } from "../src/lib/realtime-broker-payload.ts";
import { allowRealtimeEventForSource } from "../src/lib/realtime-stream-filter.ts";

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
  assert.deepEqual(readEmbeddedTenantTapProjection(projection), { ...projection, dataProvenance: "legacy_unclassified" });
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

test("provenance survives SQL projection, broker minimization and embedded replay without hiding feeds", () => {
  const base = { id: 42, tenant_id: "tenant-id", tenant_slug: "tenant-a", batch_id: "batch-id", tag_id: "tag-id",
    created_at: "2026-09-21T12:00:00.000Z", source: "real", event_type: "TAP_VALID", result: "VALID_CLOSED" };
  for (const event_type of ["TAP_VALID", "TAP_INVALID", "REPLAY_SUSPECT", "CONSUMER_ACTION"]) {
    for (const data_provenance of ["operational_tap", "declared_demo", "imported", "legacy_unclassified", undefined, "forged", true]) {
      for (const source of ["real", "demo", "imported"]) {
        const normalized = normalizeTenantTapRealtimeEvent({ ...base, source, event_type, data_provenance });
        const transported = minimizeRealtimePayloadForBroker({ id: "42", event_type, source, tap_projection: normalized });
        const received = readEmbeddedTenantTapProjection(transported.tap_projection);
        assert.ok(received, "classification adds information without dropping security or other feed events");
        assert.equal(received.dataProvenance, normalizeEventDataProvenance(data_provenance));
        assert.equal(received.eventType, event_type);
        assert.equal(received.eventSource, source);
        assert.equal(allowRealtimeEventForSource("production", received.eventSource), source !== "demo");
      }
    }
  }
});

test("old broker frames and raw real TAP source never infer operational provenance", () => {
  const raw = { id: 1, tenant_id: "tenant-id", tenant_slug: "tenant-a", batch_id: "batch-id",
    source: "real", event_type: "TAP_INVALID", created_at: "2026-09-21T12:00:00.000Z",
    meta: { replay_execution_class: "operational" } };
  const normalized = normalizeTenantTapRealtimeEvent(raw);
  assert.equal(normalized.dataProvenance, "legacy_unclassified", "metadata is not a substitute for the persisted SQL binding");
  const { dataProvenance, ...oldFrame } = normalized;
  assert.equal(readEmbeddedTenantTapProjection(oldFrame).dataProvenance, "legacy_unclassified");
  for (const value of [" operational_tap ", "OPERATIONAL_TAP", "production", {}, true]) {
    const payload = minimizeRealtimePayloadForBroker({ id: "1", event_type: "TAP_INVALID", tap_projection: { ...oldFrame, dataProvenance: value } });
    assert.equal(payload.tap_projection.dataProvenance, "legacy_unclassified");
  }
});

test("post-commit read classifies exact asset binding but preserves unbound invalid event rows", async () => {
  let statement;
  const projection = await loadTenantTapRealtimeProjection(42, async (strings, ...values) => {
    statement = strings.join("?");
    assert.deepEqual(values, [42]);
    return [{ id: 42, tenant_id: "tenant-id", tenant_slug: "tenant-a", batch_id: "batch-id",
      source: "real", event_type: "TAP_INVALID", result: "INVALID", created_at: "2026-09-21T12:00:00.000Z",
      data_provenance: "legacy_unclassified" }];
  });
  assert.equal(projection.eventType, "TAP_INVALID");
  assert.equal(projection.dataProvenance, "legacy_unclassified");
  assert.match(statement, /LEFT JOIN tags provenance_tag/);
  assert.match(statement, /provenance_tag\.batch_id = e\.batch_id/);
  assert.match(statement, /UPPER\(provenance_tag\.uid_hex\) = UPPER\(e\.uid_hex\)/);
  assert.match(statement, /canonical_operation\.event_created_at = e\.created_at/);
  assert.match(statement, /ambiguous_event\.created_at <> e\.created_at/);
  assert.doesNotMatch(statement, /WHERE data_provenance = 'operational_tap'/);
});
