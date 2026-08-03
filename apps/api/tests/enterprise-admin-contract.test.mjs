import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const migration = await read("../db/migrations/20260802230000_0088_enterprise_event_profile.sql");
const replay = await read("../src/app/admin/webhook-deliveries/[id]/replay/route.ts");
const risk = await read("../src/app/admin/risk-analytics/route.ts");

test("manual replay is tenant-bound, MFA-gated, idempotent and append-only", () => {
  assert.match(replay, /checkWebhookPermission\(req, "write"\)/);
  assert.match(replay, /mfaVerified/);
  assert.match(replay, /idempotency-key/);
  assert.match(replay, /resolveWebhookTenant/);
  assert.match(replay, /nexid_replay_webhook_delivery_v1/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS webhook_delivery_attempts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS webhook_delivery_replay_receipts/);
  assert.match(migration, /nexid_reject_enterprise_append_only_mutation_v1/);
  assert.match(migration, /status <> 'dead_letter'/);
  assert.match(migration, /JOIN webhook_endpoints endpoint ON endpoint\.id = delivery\.endpoint_id[\s\S]*endpoint\.tenant_id = v_tenant_id/);
});

test("risk analytics is tenant-bound and exposes all requested dimensions and KPIs", () => {
  assert.match(risk, /checkAdminPermission\(req, "analytics:read"\)/);
  assert.match(risk, /rateClass: "observability_read"/);
  assert.match(risk, /tenantWide: true/);
  assert.match(risk, /principal\.scope !== "super_admin"/);
  for (const filter of ["sku", "product", "batch", "lot", "region", "distributor", "carrier", "riskLevel", "from", "to"]) {
    assert.match(risk, new RegExp(`searchParams\\.get\\(\"${filter}\"\\)`));
  }
  for (const kpi of [
    "total_events", "critical_events", "risk_event_rate_pct", "average_risk_score",
    "valid_taps", "unique_units", "replay_events", "invalid_auth_events",
    "never_scanned_units_lifetime", "tamper_events", "geo_anomalies",
    "content_adoption_events", "cropwise_cta_clicks", "registrations_and_leads",
    "training_completions", "webhook_deliveries", "webhook_delivered",
    "webhook_pending", "webhook_dead_letter", "webhook_delivery_rate_pct",
    "unique_products", "unique_batches", "unique_distributors", "risk_scored_events",
    "risk_unscored_events", "risk_coverage_pct",
  ]) {
    assert.match(risk, new RegExp(`'${kpi}'`));
  }
  assert.match(risk, /sdk_external_events/);
  assert.match(risk, /webhook_deliveries/);
  assert.match(risk, /neverScannedUnits: "lifetime_inventory_matching_tenant_sku_product_batch_region_and_carrier"/);
  assert.match(risk, /riskScoring: "only_events_scored_with_nexid-risk-v1"/);
  assert.match(risk, /enterpriseRiskSchemaReady/);
  assert.match(risk, /nexid_enterprise_rbac_risk_truth_v1_capability/);
  assert.match(risk, /to_regclass\('public\.event_risk_projections'\)/);
  assert.match(risk, /LEFT JOIN event_risk_projections risk_projection[\s\S]*risk_projection\.event_id = event\.id[\s\S]*risk_projection\.event_created_at = event\.created_at[\s\S]*risk_projection\.tenant_id = event\.tenant_id/);
  assert.match(risk, /WITH event_base AS MATERIALIZED[\s\S]*filtered AS MATERIALIZED/);
  assert.match(risk, /'risk_coverage_pct', CASE WHEN count\(\*\) = 0 THEN NULL/);
  assert.doesNotMatch(risk, /ensureSdkSchema/);
  assert.match(risk, /tag\.id = event\.tag_id AND tag\.batch_id = batch\.id/);
  assert.match(risk, /tag\.id = external_event\.tag_id[\s\S]*tag\.batch_id = batch\.id/);
  assert.match(risk, /NULLIF\(tag\.carrier_profile_code, ''\)/);
  assert.doesNotMatch(risk, /AS uid_hash|SELECT \* FROM filtered/);
  assert.match(risk, /risk_profile_version = 'nexid-risk-v1' AND COALESCE\(triggered_rules/);
  assert.match(risk, /NULLIF\(profile\.sku, ''\), NULLIF\(batch\.sku, ''\)/);
  assert.match(risk, /RFC3339_WITH_ZONE/);
  assert.match(risk, /new Set\(CARRIER_PROFILES\.map\(\(profile\) => profile\.code\)\)/);
  assert.match(risk, /CARRIER_CODES\.has\(filters\.carrier\.toLowerCase\(\)\)/);
  assert.match(risk, /366 \* 24 \* 60 \* 60 \* 1000/);
});

test("API key policy persists tenant-scoped network and rate-limit controls without raw secrets", () => {
  assert.match(migration, /allowed_ip_cidrs cidr\[\]/);
  assert.match(migration, /allowed_origins text\[\]/);
  assert.match(migration, /rate_limit_profile text/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS tenant_api_key_policy_receipts/);
  assert.match(migration, /nexid_create_tenant_api_key_v2/);
  assert.doesNotMatch(migration.slice(migration.indexOf("CREATE TABLE IF NOT EXISTS tenant_api_key_policy_receipts")), /raw_key|secret_value|private_key/i);
});
