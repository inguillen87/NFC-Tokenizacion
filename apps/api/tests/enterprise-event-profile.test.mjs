import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE,
  ENTERPRISE_CONNECTOR_PROFILES,
  enterprisePayloadContainsSecret,
  evaluateEnterpriseRisk,
  hashEnterpriseUid,
  normalizeEnterpriseOutboundFields,
} from "../src/lib/enterprise-outbound-event.ts";

const migration = await readFile(new URL("../db/migrations/20260802230000_0088_enterprise_event_profile.sql", import.meta.url), "utf8");
const eventRoute = await readFile(new URL("../src/app/api/v1/sdk/events/route.ts", import.meta.url), "utf8");

test("canonical event normalizes privacy-sensitive fields and deterministic risk", () => {
  const result = normalizeEnterpriseOutboundFields({
    eventType: "shipment.received",
    body: { connectorProfile: CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE },
    data: {
      productId: "product-1",
      sku: "SKU-1",
      lotNumber: "LOT-1",
      authStatus: "CMAC_INVALID",
      geoAnomaly: true,
      approximateLocation: { lat: -34.603722, lng: -58.381592, country: "AR" },
      consentFlags: { location_analytics: true },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.fields.approximateLocation, { lat: -34.604, lng: -58.382, country: "AR" });
  assert.equal(result.fields.risk.riskScore, 100);
  assert.equal(result.fields.risk.riskLevel, "CRITICAL");
  assert.deepEqual(result.fields.risk.triggeredRules, ["INVALID_SUN_OR_CMAC", "IMPOSSIBLE_TRAVEL_OR_GEO_ANOMALY"]);
  assert.match(hashEnterpriseUid("04aabb"), /^sha256:[a-f0-9]{64}$/);
});

test("canonical event rejects secrets, unsupported profiles and invalid consent", () => {
  assert.equal(enterprisePayloadContainsSecret({ nested: { k_meta: "secret" } }), true);
  assert.deepEqual(normalizeEnterpriseOutboundFields({ eventType: "x", data: { apiKey: "secret" } }), {
    ok: false,
    reason: "enterprise_event_secret_fields_forbidden",
  });
  assert.deepEqual(normalizeEnterpriseOutboundFields({ eventType: "x", body: { connectorProfile: "native_cropwise" }, data: {} }), {
    ok: false,
    reason: "enterprise_connector_profile_unsupported",
  });
  assert.equal(normalizeEnterpriseOutboundFields({ eventType: "x", data: { consentFlags: { analytics: "yes" } } }).ok, false);
});

test("Cropwise profile is explicitly generic and the atomic payload never emits raw UID", () => {
  const profile = ENTERPRISE_CONNECTOR_PROFILES[CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE];
  assert.equal(profile.nativeIntegration, false);
  assert.equal(profile.status, "template_only");
  assert.match(profile.claim, /not a native or approved Cropwise integration/i);
  assert.match(migration, /'cropwise_physical_product_event'/);
  assert.match(migration, /native_integration,?[\s\S]*false/);
  assert.match(migration, /v_uid_hex text := upper\([\s\S]*'uid_hash', CASE[\s\S]*digest\(v_uid_hex, 'sha256'\)/);
  assert.doesNotMatch(migration, /jsonb_build_object\([\s\S]{0,800}'uid_hex'/);
  assert.match(eventRoute, /normalizeEnterpriseOutboundFields/);
});

test("secret-bearing SDK events fail before durable idempotency reservation", () => {
  const secretPreflight = eventRoute.indexOf("enterprisePayloadContainsSecret(securityEnvelope)");
  const idempotencyBoundary = eventRoute.indexOf("return runSdkIdempotentMutation({");
  assert.ok(secretPreflight >= 0 && idempotencyBoundary > secretPreflight);
  assert.match(eventRoute, /reason: "enterprise_event_secret_fields_forbidden"/);
});

test("risk model covers every required enterprise factor and stays bounded", () => {
  const sourceSignals = {
    eventType: "BATCH_QUARANTINED REVOKED REPLAY UNKNOWN_UID TAMPER",
    tamperStatus: "OPENED",
    data: {
      excessive_scan_frequency: true,
      impossible_travel: true,
      distributor_mismatch: true,
      before_expected_sale_stage: true,
      repeated_ownership_attempts: true,
      unexpected_network: true,
      batch_quarantined: true,
    },
  };
  const risk = evaluateEnterpriseRisk(sourceSignals);
  assert.equal(risk.riskScore, 100);
  assert.equal(risk.riskLevel, "CRITICAL");
  assert.equal(risk.triggeredRules.length, 10);
  assert.equal(risk.recommendedAction, "BLOCK_AND_ESCALATE_TO_TENANT_SECURITY");
});

test("SQL risk projection preserves authoritative blocker priority from TypeScript", () => {
  const actionStart = migration.indexOf("NEW.recommended_action := CASE");
  const actionEnd = migration.indexOf("END;", actionStart);
  const actionBlock = migration.slice(actionStart, actionEnd);
  const blocker = actionBlock.indexOf("BATCH_QUARANTINED', 'TAG_INACTIVE_OR_REVOKED");
  const genericCritical = actionBlock.indexOf("WHEN NEW.risk_score >= 80");
  assert.ok(blocker >= 0 && genericCritical > blocker);
  assert.match(actionBlock, /THEN 'BLOCK_AND_ESCALATE_TO_TENANT_SECURITY'/);

  for (const eventType of ["BATCH_QUARANTINED", "TAG_REVOKED"]) {
    const risk = evaluateEnterpriseRisk({ eventType });
    assert.equal(risk.recommendedAction, "BLOCK_AND_ESCALATE_TO_TENANT_SECURITY");
  }
});

test("membership role migration is namespace-qualified and fails clearly below PostgreSQL 12", () => {
  assert.match(migration, /current_setting\('server_version_num'\)::integer < 120000/);
  assert.match(migration, /to_regtype\('public\.membership_role'\) IS NULL/);
  assert.match(migration, /enum_namespace\.nspname = 'public'/);
  assert.match(migration, /ALTER TYPE %I\.%I ADD VALUE %L/);
  assert.doesNotMatch(migration, /ALTER TYPE membership_role ADD VALUE/);
});
