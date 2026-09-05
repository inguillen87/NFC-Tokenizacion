import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeTenantTapRealtimeEvent } from "../../../packages/core/src/event-contract.ts";
import { resolveEventMapCoordinate } from "../../dashboard/src/lib/geo-coordinates.ts";
import { classifyLocationProvenance } from "../../dashboard/src/lib/location-provenance.ts";
import { mergeRealtimeEvents } from "../../dashboard/src/lib/realtime-feed.ts";
import { minimizeRealtimePayloadForBroker } from "../src/lib/realtime-broker-payload.ts";
import { persistSunRequestLocationAndPublish } from "../src/lib/sun-request-location-realtime.ts";

// Explicitly synthetic, non-network fixtures. Every side effect below is
// injected; no database, broker, SUN validation or physical tag is exercised.
const input = Object.freeze({ eventId: 42, lat: -30, lng: -60, city: "Fixture City", country: "AR" });

test("request location is awaited before publishing the same persisted event id", async () => {
  const order = [];
  let finishPersistence;
  const pending = persistSunRequestLocationAndPublish(input, {
    persist: async (value) => {
      assert.equal(value, input);
      order.push("persist_started");
      const saved = await new Promise((resolve) => { finishPersistence = resolve; });
      order.push("persist_finished");
      return saved;
    },
    publish: async (...args) => {
      order.push("publish");
      assert.deepEqual(args, [42], "publisher must reload identity, scope and location from persisted truth");
      return { projected: true, distributed: true };
    },
    warn: () => assert.fail("successful publication must not warn"),
  });
  await Promise.resolve();
  assert.deepEqual(order, ["persist_started"], "no premature frame before enrichment commits");
  finishPersistence(true);
  assert.equal(await pending, true);
  assert.deepEqual(order, ["persist_started", "persist_finished", "publish"]);
});

test("rejected or absent enrichment cannot publish a false location revision", async () => {
  for (const throws of [false, true]) {
    let publications = 0;
    const run = persistSunRequestLocationAndPublish(input, {
      persist: async () => {
        if (throws) throw new Error("fixture_persistence_failed");
        return false;
      },
      publish: async () => { publications += 1; assert.fail("must not publish"); },
      warn: () => assert.fail("must not claim a publication attempt"),
    });
    if (throws) await assert.rejects(run, /fixture_persistence_failed/);
    else assert.equal(await run, false);
    assert.equal(publications, 0);
  }
});

test("publication failure preserves successful enrichment without retrying or exposing the error", async () => {
  let publications = 0;
  const warnings = [];
  assert.equal(await persistSunRequestLocationAndPublish(input, {
    persist: async () => true,
    publish: async () => { publications += 1; throw new Error("fixture_detail_must_not_be_logged"); },
    warn: (reason) => warnings.push(reason),
  }), true);
  assert.equal(publications, 1);
  assert.deepEqual(warnings, ["publication_failed"]);
});

test("unavailable projection or distribution is reported without misreporting the saved tap", async () => {
  for (const [publication, expected] of [
    [{ projected: false, distributed: false }, "projection_unavailable"],
    [{ projected: true, distributed: false }, "distribution_unavailable"],
  ]) {
    const warnings = [];
    assert.equal(await persistSunRequestLocationAndPublish(input, {
      persist: async () => true,
      publish: async () => publication,
      warn: (reason) => warnings.push(reason),
    }), true);
    assert.deepEqual(warnings, [expected]);
  }
});

function persistedFixture() {
  return {
    id: 42,
    tenant_id: "fixture-tenant-id",
    tenant_slug: "demobodega",
    batch_id: "fixture-batch-id",
    created_at: "2026-09-05T23:04:51.221Z",
    event_type: "TAP_VALID",
    result: "VALID_CLOSED",
    verdict: "valid",
    source: "real",
    city: input.city,
    country_code: input.country,
    lat: input.lat,
    lng: input.lng,
    location_source: null,
    post_tap_location_observation: null,
    meta: { geo_evidence: { source: "edge_ip_approx", precision: "ip_approximate", consent: false } },
  };
}

function brokerFrame(row) {
  return minimizeRealtimePayloadForBroker({
    id: row.id,
    tenant_id: row.tenant_id,
    tenant_slug: row.tenant_slug,
    batch_id: row.batch_id,
    source: row.source,
    tap_projection: normalizeTenantTapRealtimeEvent(row),
  }).tap_projection;
}

test("real core, broker and dashboard helpers replace one tap with a correctly classified network location", async () => {
  const persisted = persistedFixture();
  const initial = brokerFrame(persisted);
  assert.equal(initial.city, input.city);
  assert.equal(initial.lat, input.lat);
  assert.equal(initial.lng, input.lng);
  assert.equal(initial.locationSource, null);
  assert.equal(classifyLocationProvenance(resolveEventMapCoordinate(initial).source), "other_reported");
  let rows = [initial];

  assert.equal(await persistSunRequestLocationAndPublish(input, {
    persist: async () => {
      persisted.location_source = "edge_ip_approx";
      return true;
    },
    publish: async (eventId) => {
      assert.equal(eventId, persisted.id);
      rows = mergeRealtimeEvents(rows, brokerFrame(persisted));
      return { projected: true, distributed: true };
    },
    warn: () => assert.fail("fixture should remain available"),
  }), true);

  assert.equal(rows.length, 1, "location enrichment never becomes a second tap");
  assert.equal(rows[0].eventId, initial.eventId);
  assert.equal(rows[0].tenantSlug, "demobodega");
  assert.equal(rows[0].locationSource, "edge_ip_approx");
  assert.equal(rows[0].occurredAt, initial.occurredAt, "keep physical reading time, not enrichment time");
  assert.equal(rows[0].occurredAtLocal, "05/09/2026, 20:04:51");
  assert.equal(rows[0].timezone, "America/Argentina/Buenos_Aires");
  assert.equal(classifyLocationProvenance(resolveEventMapCoordinate(rows[0]).source), "network_approx");
  assert.equal(persisted.post_tap_location_observation, null, "network evidence is not phone consent");
});

test("empty or incomplete coordinate pairs never become a point at zero", () => {
  for (const pair of [[null, null], [undefined, undefined], ["", ""], [null, -60]]) {
    const frame = brokerFrame({ ...persistedFixture(), lat: pair[0], lng: pair[1] });
    assert.equal(frame.lat, null);
    assert.equal(frame.lng, null);
    assert.equal(resolveEventMapCoordinate(frame), null);
  }
});

test("the physical SUN handler uses the post-enrichment publisher once, without changing scan validation", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  assert.match(route, /import \{ persistSunRequestLocationAndPublish \} from '\.\.\/\.\.\/lib\/sun-request-location-realtime'/);
  assert.equal([...route.matchAll(/await persistSunRequestLocationAndPublish\(/g)].length, 1);
  assert.ok(route.indexOf("processSunScan(sunScanInput)") < route.indexOf("await persistSunRequestLocationAndPublish("));
});
