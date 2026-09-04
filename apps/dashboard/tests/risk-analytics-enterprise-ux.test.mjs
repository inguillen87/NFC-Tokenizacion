import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/(app)/risk-analytics/page.tsx", import.meta.url), "utf8");
const permissions = await readFile(new URL("../src/lib/permission-policy.ts", import.meta.url), "utf8");
const shell = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const destinations = await readFile(new URL("../src/lib/dashboard-destination-policy.ts", import.meta.url), "utf8");
const proxy = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
const supplierConsole = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");
const { dashboardCanReadSensitiveRiskAnalytics, requiredPermissionForAdminResource } = await import("../src/lib/permission-policy.ts");
const { CARRIER_PROFILES } = await import("../../api/src/lib/carrier-profiles.ts");
const {
  IOT_TRACKER_CARRIER_CODE,
  IOT_TRACKER_CARRIER_LABEL,
  IOT_TRACKER_EMPTY_DESCRIPTION,
  IOT_TRACKER_EMPTY_TITLE,
  IOT_TRACKER_EVIDENCE_DESCRIPTION,
  isIotTrackerEvidenceCarrier,
} = await import("../src/lib/iot-tracker-evidence-copy.ts");

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

test("IoT tracker filter preserves its contract while bounding declared evidence", () => {
  assert.equal(IOT_TRACKER_CARRIER_CODE, "iot_tracker_placeholder");
  assert.equal(IOT_TRACKER_CARRIER_LABEL, "Sensor / tracker IoT · evidencia declarada");
  assert.equal(isIotTrackerEvidenceCarrier(IOT_TRACKER_CARRIER_CODE), true);
  assert.equal(isIotTrackerEvidenceCarrier("ntag424_dna_tt"), false);
  assert.match(IOT_TRACKER_EVIDENCE_DESCRIPTION, /evidencia declarada[\s\S]*persistió/);
  assert.match(IOT_TRACKER_EVIDENCE_DESCRIPTION, /No confirma conexión en vivo, hardware atestado, controles anti-replay ni presencia física/);
  assert.match(IOT_TRACKER_EMPTY_TITLE, /Sin evidencia confirmada/);
  assert.match(IOT_TRACKER_EMPTY_DESCRIPTION, /No se muestran ni infieren temperatura, estado offline o rutas/);

  assert.match(page, /value="iot_tracker_placeholder">\{IOT_TRACKER_CARRIER_LABEL\}<\/option>/);
  assert.match(page, /iotTrackerEvidenceSelected = isIotTrackerEvidenceCarrier\(filters\.carrier\)/);
  assert.match(page, /data-testid="iot-tracker-evidence-boundary"/);
  assert.match(page, /title=\{iotTrackerEvidenceSelected \? IOT_TRACKER_EMPTY_TITLE/);
  assert.match(page, /description=\{iotTrackerEvidenceSelected \? IOT_TRACKER_EMPTY_DESCRIPTION/);
  assert.doesNotMatch(page, /Tracker IoT \(placeholder\)/);

  assert.match(supplierConsole, /value: "iot_tracker_placeholder", label: IOT_TRACKER_CARRIER_LABEL/);
  assert.match(supplierConsole, /isIotTrackerEvidenceCarrier\(carrierProfileCode\)/);
  assert.match(supplierConsole, /data-testid="supplier-iot-tracker-evidence-boundary"/);
  assert.match(supplierConsole, /\{IOT_TRACKER_EVIDENCE_DESCRIPTION\}/);
  assert.doesNotMatch(supplierConsole, /IoT tracker - telemetria/);
});

test("risk analytics fails closed and is discoverable in the dashboard", () => {
  assert.match(page, /No se muestran ceros falsos/);
  assert.match(page, /Risk Analytics no está disponible/);
  assert.match(shell, /destination: "riskAnalytics"[\s\S]*DASHBOARD_DESTINATIONS\.riskAnalytics\.href/);
  assert.match(destinations, /riskAnalytics:\s*\{[\s\S]*href: "\/risk-analytics"[\s\S]*requiredPermissions: \["reports\.export"\][\s\S]*highImpactCapability: "events\.read_sensitive"/);
  assert.match(proxy, /normalizedPath === "risk-analytics"[\s\S]*dashboardCanReadSensitiveRiskAnalytics\(/);
  assert.match(proxy, /requiredPermissions: \["reports\.export", "events\.read_sensitive"\]/);
  assert.match(permissions, /dashboardHighImpactPermissionMatches\([\s\S]*"events\.read_sensitive"[\s\S]*dashboardPermissionMatches\(granted, "reports\.export", denied\)/);
});
