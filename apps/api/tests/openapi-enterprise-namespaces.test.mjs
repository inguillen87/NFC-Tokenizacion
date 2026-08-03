import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CARRIER_PROFILES } from "../src/lib/carrier-profiles.ts";

const load = async (name) => JSON.parse(await readFile(new URL(`../public/openapi/${name}`, import.meta.url), "utf8"));
const [index, publicApi, sdkApi, adminApi, internalApi] = await Promise.all([
  load("nexid-enterprise-index-v1.json"),
  load("nexid-public-v1.json"),
  load("nexid-sdk-v1.json"),
  load("nexid-admin-v1.json"),
  load("nexid-internal-v1.json"),
]);

test("enterprise OpenAPI index separates public, SDK, admin and internal namespaces", () => {
  assert.equal(index.openapi, "3.1.0");
  assert.deepEqual(Object.keys(index["x-nexid-documents"]).sort(), ["admin", "internal", "public", "sdk", "webhooks"]);
  assert.ok(Object.keys(publicApi.paths).every((path) => path.startsWith("/public/")));
  assert.ok(Object.keys(sdkApi.paths).every((path) => path.startsWith("/api/v1/")));
  assert.ok(Object.keys(adminApi.paths).every((path) => path.startsWith("/admin/")));
});

test("internal contract is deny-by-default and public contracts do not advertise demo/admin routes", () => {
  assert.deepEqual(internalApi.paths, {});
  assert.match(internalApi.info.description, /Empty by design/);
  assert.equal(Object.keys(publicApi.paths).some((path) => /admin|internal|demo/i.test(path)), false);
  assert.equal(Object.keys(sdkApi.paths).some((path) => /admin|internal|demo/i.test(path)), false);
});

test("admin risk analytics publishes every enterprise filter and the scoped KPI contract", () => {
  const operation = adminApi.paths["/admin/risk-analytics"].get;
  assert.equal(operation["x-nexid-permission"], "analytics:read");
  assert.deepEqual(
    operation.parameters.map((parameter) => parameter.name),
    ["tenant", "sku", "product", "batch", "lot", "region", "distributor", "carrier", "riskLevel", "from", "to", "limit"],
  );
  assert.deepEqual(
    operation.parameters.find((parameter) => parameter.name === "carrier").schema.enum,
    CARRIER_PROFILES.map((profile) => profile.code),
  );
  assert.equal(
    operation.responses["200"].content["application/json"].schema.$ref,
    "#/components/schemas/RiskAnalyticsResponse",
  );
  const schema = adminApi.components.schemas.RiskAnalyticsResponse;
  assert.equal(schema.properties.scopes.properties.neverScannedUnits.const, "lifetime_inventory_matching_tenant_sku_product_batch_region_and_carrier");
  assert.equal(schema.properties.scopes.properties.riskScoring.const, "only_events_scored_with_nexid-risk-v1");
  for (const key of [
    "valid_taps", "unique_units", "replay_events", "invalid_auth_events",
    "never_scanned_units_lifetime", "tamper_events", "geo_anomalies",
    "content_adoption_events", "cropwise_cta_clicks", "registrations_and_leads",
    "training_completions", "webhook_delivery_rate_pct", "risk_scored_events",
    "risk_unscored_events", "risk_coverage_pct",
  ]) assert.ok(schema.properties.kpis.required.includes(key), key);
  assert.deepEqual(schema.properties.kpis.properties.risk_coverage_pct.type, ["number", "null"]);
  const eventSchema = adminApi.components.schemas.RiskAnalyticsEvent;
  assert.ok(eventSchema.required.includes("unit_reference"));
  assert.equal("uid_hash" in eventSchema.properties, false);
  assert.equal("uid_hex" in eventSchema.properties, false);
  assert.equal("tag_id" in eventSchema.properties, false);
  for (const parameter of operation.parameters.filter((item) => ["from", "to"].includes(item.name))) {
    assert.match(parameter.description, /explicit Z or numeric UTC offset/);
  }
});
