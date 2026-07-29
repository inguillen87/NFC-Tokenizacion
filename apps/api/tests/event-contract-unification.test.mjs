import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contract = await import("../../../packages/core/src/event-contract.ts");
const {
  aggregateTenantMetrics,
  classifyEventRiskBucket,
  eventVerdictRiskLevel,
  isEventSecurityRisk,
  normalizeEvent,
  normalizeEventVerdict,
  normalizeTenantTapRealtimeEvent,
  normalizeWgs84CoordinatePair,
} = contract;

const fixtureEvents = [
  { id: 1, result: "VALID", source: "real", created_at: "2026-04-27T10:00:00.000Z", city: "Mendoza", country_code: "AR" },
  { id: 2, result: "REPLAY_SUSPECT", source: "real", created_at: "2026-04-27T10:01:00.000Z", city: "NYC", country_code: "US" },
  { id: 3, result: "TAMPER", source: "demo", created_at: "2026-04-27T10:02:00.000Z", city: "NYC", country_code: "US" },
  { id: 4, result: "INVALID", source: "real", created_at: "2026-04-27T10:03:00.000Z", city: null, country_code: null },
];

test("mismo input produce mismo score en overview y analytics", () => {
  const overviewLike = aggregateTenantMetrics({
    counts: { scans: 4, valid: 1, invalid: 1, duplicates: 1, tamper: 1, revoked: 0 },
  });
  const analyticsLike = aggregateTenantMetrics({
    events: fixtureEvents,
  });
  assert.equal(overviewLike.riskScore, analyticsLike.riskScore);
});

test("valores nulos no rompen normalizeEvent ni aggregate", () => {
  const normalized = normalizeEvent({ id: 9, result: null, source: null, city: null, country_code: null });
  assert.equal(normalized.verdict, "unknown");
  const aggregate = aggregateTenantMetrics({ events: [{ result: null, source: null }] });
  assert.equal(typeof aggregate.riskScore, "number");
});

test("adverse result and reason override a stale valid verdict without misclassifying lifecycle events", () => {
  const adverse = [
    [{ verdict: "valid", result: "REPLAY_SUSPECT" }, "replay_suspect", "duplicate_replay", "high"],
    [{ verdict: "valid", result: "TAMPER_RISK" }, "tampered", "tamper", "high"],
    [{ verdict: "valid", result: "REVOKED" }, "revoked", "revoked", "critical"],
    [{ verdict: "valid", result: "INVALID" }, "invalid", "invalid", "medium"],
    [{ verdict: "valid", result: "VALID", reason: "duplicate detected" }, "replay_suspect", "duplicate_replay", "high"],
  ];
  for (const [input, verdict, bucket, riskLevel] of adverse) {
    assert.equal(normalizeEventVerdict(input), verdict);
    assert.equal(classifyEventRiskBucket(input), bucket);
    assert.equal(eventVerdictRiskLevel(input), riskLevel);
    assert.equal(isEventSecurityRisk(input), true);
  }

  assert.equal(normalizeEventVerdict({ verdict: "valid", result: "VALID_OPENED" }), "valid");
  assert.equal(isEventSecurityRisk({ verdict: "valid", result: "VALID_OPENED" }), false);
  assert.equal(classifyEventRiskBucket({ verdict: "valid", result: "CLAIMED" }), "unknown");
  assert.equal(isEventSecurityRisk({ verdict: "valid", result: "CLAIMED" }), false);
  assert.equal(classifyEventRiskBucket({ result: "NOT_REGISTERED" }), "lifecycle");
  assert.equal(isEventSecurityRisk({ result: "NOT_REGISTERED" }), false);
});

test("WGS84 coordinates require a complete in-range pair and preserve the legitimate origin", () => {
  assert.deepEqual(normalizeWgs84CoordinatePair(0, 0), { lat: 0, lng: 0 });
  assert.deepEqual(normalizeWgs84CoordinatePair("-34.6", "-58.4"), { lat: -34.6, lng: -58.4 });
  assert.equal(normalizeWgs84CoordinatePair(null, null), null);
  assert.equal(normalizeWgs84CoordinatePair("", ""), null);
  assert.equal(normalizeWgs84CoordinatePair(-34.6, null), null);
  assert.equal(normalizeWgs84CoordinatePair(91, 0), null);
  assert.equal(normalizeWgs84CoordinatePair(0, -181), null);

  const origin = normalizeEvent({ result: "VALID", lat: 0, lng: 0 });
  assert.equal(origin.lat, 0);
  assert.equal(origin.lng, 0);
  const partial = normalizeEvent({ result: "VALID", lat: -34.6, lng: null });
  assert.equal(partial.lat, null);
  assert.equal(partial.lng, null);
});

test("eventos demo y productivos se distinguen", () => {
  const aggregate = aggregateTenantMetrics({ events: fixtureEvents });
  assert.equal(aggregate.demoEvents, 1);
  assert.equal(aggregate.productionEvents, 3);
});

test("stream snapshot rows normalized", () => {
  const row = normalizeTenantTapRealtimeEvent({
    id: 22,
    tenant_id: "tenant-id-1",
    tenant_slug: "demobodega",
    bid: "DEMO-2026-02",
    uid_hex: "04A1B2C3D4",
    result: "REPLAY_SUSPECT",
    source: "real",
    created_at: "2026-04-28T10:00:00.000Z",
  });
  assert.equal(row.eventId, "22");
  assert.equal(row.tenantSlug, "demobodega");
  assert.equal(row.verdict, "replay_suspect");
  assert.equal(row.source, "production");
});

test("overview, tenant stats and SSE apply the same adverse-first taxonomy", async () => {
  const [overview, tenants, stream] = await Promise.all([
    readFile(new URL("../src/app/admin/overview/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/tenants/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/events/stream/route.ts", import.meta.url), "utf8"),
  ]);

  for (const source of [overview, tenants]) {
    assert.match(source, /EVENT_TAXONOMY_VERSION/);
    assert.match(source, /WITH (?:scoped_batches AS MATERIALIZED|classified AS) \(/);
    assert.ok(source.indexOf("REPLAY_SUSPECT") < source.indexOf("LOWER(COALESCE(e.verdict"));
    assert.ok(source.indexOf("TAMPER_RISK") < source.indexOf("LOWER(COALESCE(e.verdict"));
    assert.ok(source.indexOf("REVOKED") < source.indexOf("LOWER(COALESCE(e.verdict"));
    assert.ok(source.indexOf("'INVALID','TAP_INVALID'") < source.indexOf("LOWER(COALESCE(e.verdict"));
    assert.match(source, /VALID_%/);
  }

  assert.match(stream, /e\.verdict/);
  assert.match(stream, /e\.risk_level/);
  assert.match(stream, /normalizeTenantTapRealtimeEvent\(row\)/);
  assert.match(stream, /normalizeTenantTapRealtimeEvent\(rawPayload\)/);
  assert.ok(stream.indexOf("REPLAY_SUSPECT") < stream.indexOf("= 'valid'"));
  assert.ok(stream.indexOf("TAMPER_RISK") < stream.indexOf("= 'valid'"));
  assert.ok(stream.indexOf("REVOKED") < stream.indexOf("= 'valid'"));
});
