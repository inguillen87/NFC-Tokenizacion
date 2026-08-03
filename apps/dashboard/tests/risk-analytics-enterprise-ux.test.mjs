import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/(app)/risk-analytics/page.tsx", import.meta.url), "utf8");
const permissions = await readFile(new URL("../src/lib/permission-policy.ts", import.meta.url), "utf8");
const shell = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
const { dashboardCanReadSensitiveRiskAnalytics, requiredPermissionForAdminResource } = await import("../src/lib/permission-policy.ts");
const { CARRIER_PROFILES } = await import("../../api/src/lib/carrier-profiles.ts");

test("enterprise risk page exposes the required filters without inventing tenant authority", () => {
  for (const name of ["tenant", "sku", "product", "batch", "lot", "region", "distributor", "riskLevel", "from", "to", "carrier"]) {
    assert.match(page, new RegExp(`name=\\"${name}\\"`));
  }
  assert.match(page, /context\.canSelectTenant/);
  assert.match(page, /createAdminPageContext\(session, query\.tenant\)/);
  assert.match(page, /fetchAdminPage\(context, `risk-analytics\?/);
  assert.equal(requiredPermissionForAdminResource("GET", "risk-analytics"), "reports.export");
  assert.equal(requiredPermissionForAdminResource("POST", "risk-analytics"), null);
  assert.match(page, /dashboardCanReadSensitiveRiskAnalytics\([\s\S]*session\.deniedPermissions/);
  assert.match(page, /if \(!dashboardCanReadSensitiveRiskAnalytics\([\s\S]*\)\) notFound\(\)/);
});

test("event-level risk analytics requires reports and sensitive-event authority", () => {
  const allowedRoles = new Set([
    "super-admin",
    "tenant-owner",
    "tenant-admin",
    "security-analyst",
    "operations-manager",
    "security-operator",
  ]);
  for (const role of [
    "super-admin", "tenant-owner", "tenant-admin", "security-analyst",
    "operations-manager", "security-operator", "packaging-operator",
    "marketing-manager", "reseller-admin", "viewer", "reseller", "api-integration",
  ]) {
    assert.equal(
      dashboardCanReadSensitiveRiskAnalytics(role, ["reports.export", "events.read_sensitive"]),
      allowedRoles.has(role),
      role,
    );
  }
  assert.equal(dashboardCanReadSensitiveRiskAnalytics("tenant-owner", ["reports.export"]), false);
  assert.equal(dashboardCanReadSensitiveRiskAnalytics("tenant-owner", ["events.read_sensitive"]), false);
  assert.equal(dashboardCanReadSensitiveRiskAnalytics("tenant-owner", ["*"], ["reports.export"]), false);
  assert.equal(dashboardCanReadSensitiveRiskAnalytics("tenant-owner", ["*"], ["events.read_sensitive"]), false);
});

test("enterprise risk KPIs expose operational truth and bounded evidence copy", () => {
  for (const key of [
    "valid_taps", "unique_units", "replay_events", "invalid_auth_events",
    "never_scanned_units_lifetime", "tamper_events", "geo_anomalies",
    "content_adoption_events", "cropwise_cta_clicks", "registrations_and_leads",
    "training_completions", "webhook_delivery_rate_pct", "risk_coverage_pct",
  ]) assert.match(page, new RegExp(`key: \\"${key}\\"`));
  assert.match(page, /no certifica por sí solo el producto físico/);
  assert.match(page, /Clicks registrados; no implica integración nativa ni conversión/);
  assert.match(page, /no se presentan como conversiones/);
  assert.match(page, /no se entrega UID ni un hash global correlacionable/);
  assert.match(page, /Cobertura histórica de riesgo incompleta/);
  assert.match(page, /Aplicar la migración enterprise 0096/);
  assert.match(page, /key === "risk_coverage_pct" && value === null\) return "Sin eventos"/);
  assert.match(page, /Desde \(UTC\)/);
  assert.match(page, /value="qr_basic"/);
  assert.match(page, /value="uhf_rfid"/);
  assert.doesNotMatch(page, /value="qr_static"|value="uhf_epc"/);
  for (const profile of CARRIER_PROFILES) assert.match(page, new RegExp(`value="${profile.code}"`));
  assert.doesNotMatch(page, /uid_hex|K_META|K_FILE|hsm_backed|managed_kms/);
});

test("risk analytics fails closed and is discoverable in the dashboard", () => {
  assert.match(page, /No se muestran ceros falsos/);
  assert.match(page, /Risk Analytics no está disponible/);
  assert.match(shell, /href: "\/risk-analytics"/);
  assert.match(shell, /const canReadRiskAnalytics = dashboardCanReadSensitiveRiskAnalytics\(/);
  assert.match(proxy, /normalizedPath === "risk-analytics"[\s\S]*dashboardCanReadSensitiveRiskAnalytics\(/);
  assert.match(proxy, /requiredPermissions: \["reports\.export", "events\.read_sensitive"\]/);
  assert.match(permissions, /dashboardHighImpactPermissionMatches\([\s\S]*"events\.read_sensitive"[\s\S]*dashboardPermissionMatches\(granted, "reports\.export", denied\)/);
});
