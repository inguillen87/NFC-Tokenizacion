import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { normalizeTenantTapRealtimeEvent } from "../../../packages/core/src/event-contract.ts";
import { withConsumerNetworkEventProvenance } from "../src/lib/consumer-network-provenance.ts";
import { normalizeAdminPhysicalTap } from "../src/lib/admin-physical-taps.ts";
import { postTapBrowserLocation, projectConsentedPostTapLocation } from "../src/lib/post-tap-location-projection.ts";
import { minimizeRealtimePayloadForBroker } from "../src/lib/realtime-broker-payload.ts";
import { createBoundedRealtimeProjectionDeduper } from "../src/lib/realtime-stream-lifecycle.ts";
import { resolveRealtimeStreamWindow } from "../src/lib/realtime-stream-window.ts";
import { normalizeConsentedApproximateLocation, sanitizePublicLocationProjection } from "../src/lib/approximate-location.ts";
import { isPostTapLocationTimingValid } from "../src/lib/sun-tap-location.ts";
import { mergeRealtimeEvents } from "../../dashboard/src/lib/realtime-feed.ts";

const [projectionSource, streamSource, adminSource, contextSource] = await Promise.all([
  "../src/lib/realtime-tap-projection.ts", "../src/app/admin/events/stream/route.ts",
  "../src/app/admin/events/route.ts", "../src/app/sun/context/route.ts",
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

// Execute actual function bodies with inert local SQL/publish dependencies. No
// PostgreSQL, HTTP, broker or signed SUN URL is used or replayed in these tests.
function functionsFrom(source, names, bindings) {
  const parsed = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.ES2022, true);
  const declarations = parsed.statements.filter((statement) => ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text));
  assert.equal(declarations.length, names.length);
  const compiled = ts.transpileModule(declarations.map((entry) => entry.getText(parsed).replace(/^export\s+/, "")).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(bindings), `${compiled}\nreturn {${names.join(",")}};`)(...Object.values(bindings));
}

function observation(overrides = {}) {
  return { source: "browser_geolocation_approximate_consent", consent: true, precision: "approximate",
    city: "Mendoza", countryCode: "AR", lat: -32.89, lng: -68.84, accuracyM: 180, ...overrides };
}
function event(overrides = {}) {
  return { id: 42, tenant_id: "fixture-tenant-id", tenant_slug: "fixture-tenant", batch_id: "fixture-batch-id",
    tag_id: "fixture-tag-id", bid: "FIXTURE-01", uid_hex: "AABBCCDDEEFF0011", created_at: "2026-09-05T12:00:00.000Z",
    event_type: "TAP_VALID", result: "VALID_CLOSED", verdict: "valid", cmac_ok: true, allowlisted: true,
    source: "real", city: "Buenos Aires", country_code: "AR", lat: -34.60, lng: -58.38,
    location_source: "edge_ip_approx", location_accuracy_m: null,
    post_tap_location_observation: null, meta: { geo_evidence: { source: "edge_ip_approx", consent: false } }, ...overrides };
}

test("consented persisted observation supersedes IP only in projection and agrees with Physical", () => {
  const persisted = event({ post_tap_location_observation: observation() });
  const original = structuredClone(persisted);
  const projected = projectConsentedPostTapLocation(persisted);
  const normalized = normalizeTenantTapRealtimeEvent(projected);
  const physical = normalizeAdminPhysicalTap(persisted);
  assert.equal(normalized.city, "Mendoza");
  assert.equal(normalized.lat, physical.location.lat);
  assert.equal(normalized.lng, physical.location.lng);
  assert.equal(normalized.locationSource, physical.location.source);
  assert.equal(normalized.locationAccuracyM, physical.location.accuracyM);
  for (const key of ["id", "tenant_id", "tenant_slug", "batch_id", "tag_id", "created_at", "result", "verdict", "cmac_ok", "meta"]) {
    assert.deepEqual(projected[key], original[key], `${key} is not revised by a display location`);
  }
  assert.deepEqual(persisted, original, "original HTTP/IP and SUN evidence stays intact");
  assert.equal(normalized.eventId, "42");
  assert.equal(normalized.eventSource, "real");
});

test("missing, unsupported or unconsented observations retain IP; product/meta coordinates are never promoted", () => {
  for (const invalid of [null, [], "{}", {}, observation({ consent: false }), observation({ consent: "true" }),
    observation({ precision: "exact" }), observation({ source: "edge_ip_approx" }), observation({ source: "browser_gps" }),
    observation({ lat: null }), observation({ lng: "" }), observation({ lat: 91 }),
    observation({ accuracyM: null }), observation({ accuracyM: 149 }), observation({ accuracyM: 50_001 }),
  ]) {
    const row = event({ post_tap_location_observation: invalid, product_lat: -32.89, product_lng: -68.84,
      meta: { sun_context: { geo: observation() } } });
    assert.equal(projectConsentedPostTapLocation(row), row);
    assert.equal(normalizeTenantTapRealtimeEvent(projectConsentedPostTapLocation(row)).locationSource, "edge_ip_approx");
  }
  const empty = normalizeTenantTapRealtimeEvent(projectConsentedPostTapLocation(event({ lat: null, lng: null })));
  assert.equal(empty.lat, null);
  assert.equal(empty.lng, null);
});

test("admin observation is capped at three decimals, minimum 150m accuracy, with no invented locality", () => {
  for (const source of ["browser_geolocation_approximate_consent", "browser_gps_approximate_consent"]) {
    const result = postTapBrowserLocation(event({ post_tap_location_observation: observation({ source, city: null, countryCode: null,
      lat: -32.891234, lng: -68.841234, accuracyM: 150 }) }));
    assert.deepEqual(result.coordinate, { lat: -32.891, lng: -68.841 });
    assert.equal(result.accuracyM, 150);
    assert.equal(result.city, null);
    assert.equal(result.country, null);
  }
});

function createPublisher(readRow, order = []) {
  const frames = [];
  const queries = [];
  const loaded = functionsFrom(projectionSource, ["positiveEventId", "loadTenantTapRealtimeProjection", "publishTenantTapRealtimeProjection"], {
    normalizeTenantTapRealtimeEvent, projectConsentedPostTapLocation, withConsumerNetworkEventProvenance,
    sql: async (strings, ...values) => {
      const statement = strings.join("?");
      assert.match(statement, /WHERE e\.id = \?/);
      assert.match(statement, /b\.tenant_id = e\.tenant_id/);
      assert.match(statement, /t\.id = e\.tenant_id/);
      assert.match(statement, /to_jsonb\(e\)->'post_tap_location_observation'/);
      assert.deepEqual(values, [42]);
      queries.push(statement);
      order.push("projection_read");
      return [readRow()];
    },
    publishRealtimeEvent: async (payload) => {
      order.push("publish");
      frames.push(minimizeRealtimePayloadForBroker(payload));
      return { distributed: true };
    },
  });
  return { ...loaded, frames, queries };
}

test("same-ID revision survives broker/deduper and replaces one CRM tap without adding a scan", async () => {
  const persisted = event();
  const publisher = createPublisher(() => persisted);
  await publisher.publishTenantTapRealtimeProjection(42);
  persisted.post_tap_location_observation = observation();
  await publisher.publishTenantTapRealtimeProjection(42);
  const [initial, updated] = publisher.frames.map((frame) => frame.tap_projection);
  const remember = createBoundedRealtimeProjectionDeduper((row) => row.eventId, JSON.stringify, 100);
  assert.equal(remember(initial), true);
  assert.equal(remember(updated), true, "same event, changed persisted projection");
  assert.equal(remember(updated), false, "duplicate revision is not emitted twice");
  const merged = mergeRealtimeEvents([initial], updated);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].city, "Mendoza");
  assert.equal(merged[0].locationSource, "browser_geolocation_approximate_consent");
  assert.equal(merged[0].eventId, initial.eventId);
  assert.equal(merged[0].tenantId, initial.tenantId);
  assert.equal(merged[0].occurredAt, initial.occurredAt);
  assert.ok(!("post_tap_location_observation" in publisher.frames[1]));
  assert.ok(!("meta" in publisher.frames[1]));
  assert.ok(!("uid_hex" in publisher.frames[1]));
});

test("both real SSE snapshot queries project the same observation as the post-commit publisher", async () => {
  const row = event({ post_tap_location_observation: observation() });
  const expected = await createPublisher(() => row).loadTenantTapRealtimeProjection(42);
  for (const tenant of ["fixture-tenant", ""]) {
    const { fetchRows } = functionsFrom(streamSource, ["fetchRows"], {
      projectConsentedPostTapLocation, withConsumerNetworkEventProvenance,
      sql: async (strings, ...values) => {
        const statement = strings.join("?");
        assert.match(statement, /to_jsonb\(e\)->'post_tap_location_observation'/);
        assert.match(statement, /b\.tenant_id = e\.tenant_id/);
        if (tenant) { assert.match(statement, /WHERE t\.slug = \?/); assert.ok(values.includes(tenant)); }
        return [row];
      },
    });
    for (const range of ["all", "24h", "7d", "30d"]) {
      const rows = await fetchRows(new URLSearchParams(), resolveRealtimeStreamWindow(range), tenant, "production");
      assert.deepEqual(rows.map(normalizeTenantTapRealtimeEvent), [expected]);
    }
  }
});

function contextFixture(persist) {
  const now = Date.now();
  const row = event({ created_at: new Date(now - 20_000).toISOString(), sdm_read_ctr: 3 });
  const order = [];
  const publisher = createPublisher(() => row, order);
  const payload = { eventId: "42", diagnosticId: "offline-diagnostic", traceId: "offline-trace", bid: "FIXTURE-01", readCounter: 3 };
  const compiled = functionsFrom(contextSource, ["asNumber", "firstText", "sqlState", "publishLocationProjection", "safeClientContext",
    "clientTimestamp", "resolveEventLocationStorage", "POST"], {
    MAX_CONTEXT_BODY_BYTES: 32 * 1024, BID_RE: /^[A-Za-z0-9._:-]{3,120}$/, UID_RE: /^[0-9A-F]{8,32}$/,
    json: (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers }),
    RequestBodyTooLargeError: class extends Error {}, readBoundedJsonBody: (req) => req.json(),
    enforceCriticalRateLimit: async () => null,
    // Trusted local seam only: these tests do not generate, alter, or replay a capability.
    requireSunFreshHandoff: () => ({ ok: true, payload }), consumeSunFreshHandoff: async () => ({ ok: true, payload }),
    normalizeConsentedApproximateLocation, sanitizePublicLocationProjection, isPostTapLocationTimingValid,
    findNearestCity: () => ({ city: "Mendoza", countryCode: "AR" }),
    publishTenantTapRealtimeProjection: publisher.publishTenantTapRealtimeProjection,
    sql: async (strings, ...values) => {
      const statement = strings.join("?");
      if (statement.includes("SELECT id, tenant_id, bid FROM batches")) return [{ id: row.batch_id, tenant_id: row.tenant_id, bid: row.bid }];
      if (statement.includes("information_schema.columns")) return [{ has_post_tap_location_observation: true }];
      if (statement.includes("WITH bound_pair AS MATERIALIZED")) {
        assert.match(statement, /event\.tenant_id = \?/);
        assert.match(statement, /event\.post_tap_location_observation IS NULL/);
        assert.doesNotMatch(statement, /SET\s+(lat|lng|city|location_source)\s*=/);
        order.push("persist_started");
        const result = await persist();
        if (result === "empty") return [];
        row.post_tap_location_observation = values.map((value) => {
          try { return JSON.parse(value); } catch { return null; }
        }).find((value) => value?.normalization === "rounded_3_decimals_min_150m");
        assert.ok(row.post_tap_location_observation);
        order.push("persist_committed");
        return [{ event_id: row.id, diagnostic_id: payload.diagnosticId }];
      }
      if (statement.includes("AS evidence_already_consumed")) return [{ evidence_already_consumed: false }];
      assert.match(statement, /WHERE e\.id = \?::bigint/);
      return [row];
    },
  });
  const request = new Request("https://fixture.invalid/sun/context", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    bid: row.bid, eventId: row.id, ctr: 3, geoConsent: true, geoPrecision: "approximate",
    locationRequestedAt: new Date(now - 10_000).toISOString(),
    geo: { lat: -32.891234, lng: -68.841234, accuracy: 180, measuredAt: new Date(now - 5_000).toISOString() },
  }) });
  return { ...publisher, order, row, run: () => compiled.POST(request) };
}

test("actual /sun/context awaits durable observation before publishing that exact event and returns coarse receipt", async () => {
  let completePersistence;
  const fixture = contextFixture(() => new Promise((resolve) => { completePersistence = resolve; }));
  const pending = fixture.run();
  for (let turn = 0; turn < 30 && !completePersistence; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof completePersistence, "function");
  assert.deepEqual(fixture.order, ["persist_started"]);
  assert.equal(fixture.frames.length, 0);
  completePersistence("saved");
  const response = await pending;
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.order, ["persist_started", "persist_committed", "projection_read", "publish"]);
  assert.equal(fixture.frames[0].tap_projection.city, "Mendoza");
  assert.equal(fixture.frames[0].tap_projection.locationSource, "browser_geolocation_approximate_consent");
  assert.equal(fixture.frames[0].tap_projection.lat, -32.891);
  const receipt = await response.json();
  assert.equal(receipt.location.lat, -32.89, "public receipt remains at two decimals");
  assert.equal(receipt.client_values_verified, false);
  assert.equal(fixture.row.city, "Buenos Aires", "original HTTP/IP evidence stays unchanged");
});

test("actual /sun/context does not publish on failed or unmatched persistence", async () => {
  for (const scenario of ["empty", "error"]) {
    const fixture = contextFixture(async () => { if (scenario === "error") throw new Error("offline_failure"); return "empty"; });
    const response = await fixture.run();
    assert.equal(response.status, scenario === "error" ? 503 : 409);
    assert.equal(fixture.frames.length, 0);
    assert.equal(fixture.row.post_tap_location_observation, null);
  }
});

test("all admin list branches select the same row-bound observation without schema or original-evidence writes", () => {
  assert.equal([...adminSource.matchAll(/to_jsonb\(e\)->'post_tap_location_observation' AS post_tap_location_observation/g)].length, 4);
  assert.match(adminSource, /const row = projectConsentedPostTapLocation\(persistedRow\)/);
  assert.match(adminSource, /source: row\.location_source/);
  assert.match(adminSource, /city: String\(row\.city/);
  assert.doesNotMatch(`${projectionSource}\n${streamSource}\n${adminSource}`, /ALTER TABLE|UPDATE events|SET post_tap_location_observation/);
});
