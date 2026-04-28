import test from "node:test";
import assert from "node:assert/strict";

const contract = await import("../../../packages/core/src/event-contract.ts");
const { aggregateTenantMetrics, normalizeEvent } = contract;

const fixtureEvents = [
  { id: 1, result: "VALID", source: "real", created_at: "2026-04-27T10:00:00.000Z", city: "Mendoza", country_code: "AR" },
  { id: 2, result: "REPLAY_SUSPECT", source: "real", created_at: "2026-04-27T10:01:00.000Z", city: "NYC", country_code: "US" },
  { id: 3, result: "TAMPER", source: "demo", created_at: "2026-04-27T10:02:00.000Z", city: "NYC", country_code: "US" },
  { id: 4, result: "INVALID", source: "real", created_at: "2026-04-27T10:03:00.000Z", city: null, country_code: null },
];

test("mismo input produce mismo score en overview y analytics", () => {
  const overviewLike = aggregateTenantMetrics({
    counts: { scans: 4, valid: 1, invalid: 3, duplicates: 1, tamper: 1, revoked: 0 },
  });
  const analyticsLike = aggregateTenantMetrics({
    events: fixtureEvents,
  });
  assert.equal(overviewLike.riskScore, analyticsLike.riskScore);
});

test("valores nulos no rompen normalizeEvent ni aggregate", () => {
  const normalized = normalizeEvent({ id: 9, result: null, source: null, city: null, country_code: null });
  assert.equal(normalized.verdict, "invalid");
  const aggregate = aggregateTenantMetrics({ events: [{ result: null, source: null }] });
  assert.equal(typeof aggregate.riskScore, "number");
});

test("eventos demo y productivos se distinguen", () => {
  const aggregate = aggregateTenantMetrics({ events: fixtureEvents });
  assert.equal(aggregate.demoEvents, 1);
  assert.equal(aggregate.productionEvents, 3);
});
