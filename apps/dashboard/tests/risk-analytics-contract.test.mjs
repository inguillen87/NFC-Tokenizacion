import assert from "node:assert/strict";
import test from "node:test";

import {
  parseRiskAnalyticsPayload,
  RISK_ANALYTICS_SCOPES,
  RISK_COUNT_KPI_KEYS,
} from "../src/lib/risk-analytics-contract.ts";

function validPayload() {
  const kpis = Object.fromEntries(RISK_COUNT_KPI_KEYS.map((key) => [key, 0]));
  return {
    ok: true,
    tenantScoped: true,
    scopes: RISK_ANALYTICS_SCOPES,
    kpis: {
      ...kpis,
      risk_event_rate_pct: null,
      average_risk_score: null,
      webhook_delivery_rate_pct: null,
      risk_coverage_pct: null,
    },
    triggered_rules: [],
    events: [],
  };
}

test("risk analytics parser accepts the complete authoritative contract", () => {
  assert.deepEqual(parseRiskAnalyticsPayload(validPayload()), validPayload());
});

test("risk analytics parser fails closed instead of turning missing KPIs into zero", () => {
  const payload = validPayload();
  delete payload.kpis.valid_taps;
  assert.equal(parseRiskAnalyticsPayload(payload), null);
  assert.equal(parseRiskAnalyticsPayload({ ok: true, kpis: {} }), null);
});

test("risk analytics parser rejects UID correlation fields and inconsistent coverage", () => {
  const payload = validPayload();
  payload.kpis.total_events = 1;
  payload.kpis.risk_unscored_events = 1;
  payload.kpis.risk_coverage_pct = 0;
  payload.events = [{
    id: "1",
    created_at: "2026-08-02T12:00:00.000Z",
    tenant_slug: "syngenta",
    bid: "BID-1",
    sku: null,
    product_id: null,
    lot_number: null,
    region: null,
    distributor_id: null,
    carrier_profile_code: "ntag424_dna_tt",
    event_type: "NFC_TAP",
    result: "VALID",
    risk_profile_version: null,
    risk_classified: false,
    risk_score: null,
    risk_level: null,
    triggered_rules: [],
    recommended_action: null,
    unit_reference: "event:0123456789abcdef01234567",
    approximate_location: null,
    uid_hash: "forbidden",
  }];
  assert.equal(parseRiskAnalyticsPayload(payload), null);

  const inconsistent = validPayload();
  inconsistent.kpis.total_events = 2;
  assert.equal(parseRiskAnalyticsPayload(inconsistent), null);

  const falseCoverage = validPayload();
  falseCoverage.kpis.total_events = 1;
  falseCoverage.kpis.risk_scored_events = 1;
  falseCoverage.kpis.low_or_none_events = 1;
  falseCoverage.kpis.risk_event_rate_pct = 0;
  falseCoverage.kpis.average_risk_score = 0;
  falseCoverage.kpis.risk_coverage_pct = 0;
  assert.equal(parseRiskAnalyticsPayload(falseCoverage), null);

  const falseEmptyCoverage = validPayload();
  falseEmptyCoverage.kpis.risk_coverage_pct = 100;
  assert.equal(parseRiskAnalyticsPayload(falseEmptyCoverage), null);
});
