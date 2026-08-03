import { createHash } from "node:crypto";

export const ENTERPRISE_OUTBOUND_EVENT_VERSION = "1.0" as const;
export const CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE = "cropwise_physical_product_event" as const;

export const ENTERPRISE_CONNECTOR_PROFILES = {
  [CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE]: {
    code: CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE,
    displayName: "Cropwise-ready physical product event",
    eventVersion: ENTERPRISE_OUTBOUND_EVENT_VERSION,
    delivery: "signed_webhook",
    nativeIntegration: false,
    status: "template_only",
    claim: "Generic event mapping template. It is not a native or approved Cropwise integration.",
  },
} as const;

export type EnterpriseRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type EnterpriseRiskRule =
  | "INVALID_SUN_OR_CMAC"
  | "REPLAY_SUSPECT"
  | "UID_NOT_REGISTERED"
  | "TAG_INACTIVE_OR_REVOKED"
  | "EXCESSIVE_SCAN_FREQUENCY"
  | "IMPOSSIBLE_TRAVEL_OR_GEO_ANOMALY"
  | "DISTRIBUTOR_OR_REGION_MISMATCH"
  | "TAMPER_BEFORE_EXPECTED_SALE_STAGE"
  | "REPEATED_OWNERSHIP_ATTEMPTS"
  | "UNEXPECTED_DEVICE_OR_NETWORK"
  | "BATCH_QUARANTINED";

export type EnterpriseRiskDecision = {
  riskScore: number;
  riskLevel: EnterpriseRiskLevel;
  triggeredRules: EnterpriseRiskRule[];
  recommendedAction: string;
};

export type EnterpriseOutboundFields = {
  productId: string | null;
  sku: string | null;
  lotNumber: string | null;
  authStatus: string | null;
  tamperStatus: string | null;
  replayStatus: string | null;
  distributorId: string | null;
  campaignId: string | null;
  approximateLocation: Record<string, unknown> | null;
  consentFlags: Record<string, boolean> | null;
  connectorProfileCode: typeof CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE | null;
  risk: EnterpriseRiskDecision;
};

export type EnterpriseOutboundNormalization =
  | { ok: true; fields: EnterpriseOutboundFields }
  | { ok: false; reason: string };

const SECRET_KEY = /^(?:authorization|cookie|set-cookie|password|passwd|secret|webhook[_-]?secret|private[_-]?key|api[_-]?key|token|bearer[_-]?token|session[_-]?token|database[_-]?url|kms[_-]?master[_-]?key|k[_-]?meta(?:[_-]?batch)?|k[_-]?file(?:[_-]?batch)?)$/i;
const MAX_TEXT_LENGTH = 200;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  const text = String(value ?? "").trim();
  return text && text.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(text) ? text : null;
}

function firstText(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = boundedText(record[key]);
    if (value) return value;
  }
  return null;
}

function reportedTrue(record: Record<string, unknown>, ...keys: string[]) {
  return keys.some((key) => record[key] === true);
}

function normalizedSignal(...values: unknown[]) {
  return values.map((value) => String(value ?? "").trim().toUpperCase()).filter(Boolean).join(" ");
}

function levelForScore(score: number): EnterpriseRiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function actionForRisk(level: EnterpriseRiskLevel, rules: EnterpriseRiskRule[]) {
  if (rules.includes("BATCH_QUARANTINED") || rules.includes("TAG_INACTIVE_OR_REVOKED")) {
    return "BLOCK_AND_ESCALATE_TO_TENANT_SECURITY";
  }
  if (level === "CRITICAL") return "BLOCK_SENSITIVE_ACTIONS_AND_OPEN_INCIDENT";
  if (level === "HIGH") return "REQUIRE_PHYSICAL_RESCAN_AND_SECURITY_REVIEW";
  if (level === "MEDIUM") return "MONITOR_AND_REQUEST_OPERATOR_CONTEXT";
  return "ALLOW_WITH_STANDARD_MONITORING";
}

export function evaluateEnterpriseRisk(input: {
  eventType?: unknown;
  authStatus?: unknown;
  tamperStatus?: unknown;
  replayStatus?: unknown;
  data?: unknown;
}): EnterpriseRiskDecision {
  const data = asRecord(input.data);
  const signal = normalizedSignal(input.eventType, input.authStatus, input.tamperStatus, input.replayStatus);
  const rules: Array<{ code: EnterpriseRiskRule; weight: number }> = [];
  const add = (code: EnterpriseRiskRule, weight: number) => {
    if (!rules.some((rule) => rule.code === code)) rules.push({ code, weight });
  };

  if (/INVALID|CMAC_FAIL|CMAC_INVALID|SUN_PROFILE_MISMATCH|CRYPTO_FAIL/.test(signal)) add("INVALID_SUN_OR_CMAC", 90);
  if (/REPLAY|DUPLICATE_URL|COPIED_URL/.test(signal)) add("REPLAY_SUSPECT", 85);
  if (/NOT_REGISTERED|UNKNOWN_UID/.test(signal)) add("UID_NOT_REGISTERED", 70);
  if (/NOT_ACTIVE|REVOKED|BROKEN/.test(signal)) add("TAG_INACTIVE_OR_REVOKED", 95);
  if (reportedTrue(data, "excessiveScanFrequency", "excessive_scan_frequency") || Number(data.scanCountInWindow ?? data.scan_count_in_window) >= 40) {
    add("EXCESSIVE_SCAN_FREQUENCY", 35);
  }
  if (reportedTrue(data, "geoAnomaly", "geo_anomaly", "impossibleTravel", "impossible_travel")) {
    add("IMPOSSIBLE_TRAVEL_OR_GEO_ANOMALY", 55);
  }
  if (reportedTrue(data, "distributorMismatch", "distributor_mismatch", "regionMismatch", "region_mismatch")) {
    add("DISTRIBUTOR_OR_REGION_MISMATCH", 45);
  }
  if (/OPENED|TAMPER/.test(signal) && reportedTrue(data, "beforeExpectedSaleStage", "before_expected_sale_stage")) {
    add("TAMPER_BEFORE_EXPECTED_SALE_STAGE", 65);
  }
  if (reportedTrue(data, "repeatedOwnershipAttempts", "repeated_ownership_attempts") || Number(data.ownershipAttemptCount ?? data.ownership_attempt_count) >= 3) {
    add("REPEATED_OWNERSHIP_ATTEMPTS", 50);
  }
  if (reportedTrue(data, "unexpectedDevice", "unexpected_device", "unexpectedNetwork", "unexpected_network")) {
    add("UNEXPECTED_DEVICE_OR_NETWORK", 35);
  }
  if (reportedTrue(data, "batchQuarantined", "batch_quarantined") || /BATCH_QUARANTINED/.test(signal)) {
    add("BATCH_QUARANTINED", 100);
  }

  // Correlated lower-confidence signals compound, while one authoritative
  // blocker keeps its full weight. The result stays deterministic and auditable.
  const highest = rules.reduce((max, rule) => Math.max(max, rule.weight), 0);
  const correlated = rules.reduce((sum, rule) => sum + Math.min(rule.weight, 20), 0);
  const riskScore = Math.min(100, highest + Math.max(0, correlated - Math.min(highest, 20)));
  const riskLevel = levelForScore(riskScore);
  const triggeredRules = rules.map((rule) => rule.code);
  return {
    riskScore,
    riskLevel,
    triggeredRules,
    recommendedAction: actionForRisk(riskLevel, triggeredRules),
  };
}

export function enterprisePayloadContainsSecret(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => enterprisePayloadContainsSecret(item, depth + 1));
  if (typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => (
    SECRET_KEY.test(key.trim()) || enterprisePayloadContainsSecret(child, depth + 1)
  ));
}

function approximateLocation(value: unknown): Record<string, unknown> | null | "invalid" {
  if (value === undefined || value === null) return null;
  const record = asRecord(value);
  if (!Object.keys(record).length) return "invalid";
  const output: Record<string, unknown> = {};
  const lat = Number(record.lat ?? record.latitude);
  const lng = Number(record.lng ?? record.longitude);
  if (Number.isFinite(lat) || Number.isFinite(lng)) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return "invalid";
    output.lat = Number(lat.toFixed(3));
    output.lng = Number(lng.toFixed(3));
  }
  for (const [target, keys] of [
    ["city", ["city"]],
    ["region", ["region", "province"]],
    ["country", ["country", "countryCode", "country_code"]],
    ["source", ["source"]],
  ] as const) {
    const text = firstText(record, ...keys);
    if (text) output[target] = text;
  }
  if (!Object.keys(output).length) return "invalid";
  return output;
}

function consentFlags(value: unknown): Record<string, boolean> | null | "invalid" {
  if (value === undefined || value === null) return null;
  const record = asRecord(value);
  if (!Object.keys(record).length || Object.keys(record).length > 32) return "invalid";
  const output: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(record)) {
    if (!/^[a-z][a-z0-9_]{0,63}$/i.test(key) || typeof flag !== "boolean") return "invalid";
    output[key] = flag;
  }
  return output;
}

export function normalizeEnterpriseOutboundFields(input: {
  eventType: unknown;
  data: unknown;
  body?: unknown;
}): EnterpriseOutboundNormalization {
  const data = asRecord(input.data);
  const body = asRecord(input.body);
  if (enterprisePayloadContainsSecret(data) || enterprisePayloadContainsSecret(body.connectorConfig ?? body.connector_config)) {
    return { ok: false, reason: "enterprise_event_secret_fields_forbidden" };
  }

  const connectorRaw = firstText(body, "connectorProfile", "connector_profile") || firstText(data, "connectorProfile", "connector_profile");
  if (connectorRaw && connectorRaw !== CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE) {
    return { ok: false, reason: "enterprise_connector_profile_unsupported" };
  }
  const location = approximateLocation(data.approximateLocation ?? data.approximate_location ?? data.gps);
  if (location === "invalid") return { ok: false, reason: "enterprise_event_approximate_location_invalid" };
  const consent = consentFlags(data.consentFlags ?? data.consent_flags);
  if (consent === "invalid") return { ok: false, reason: "enterprise_event_consent_flags_invalid" };

  const authStatus = firstText(data, "authStatus", "auth_status");
  const tamperStatus = firstText(data, "tamperStatus", "tamper_status");
  const replayStatus = firstText(data, "replayStatus", "replay_status");
  const risk = evaluateEnterpriseRisk({
    eventType: input.eventType,
    authStatus,
    tamperStatus,
    replayStatus,
    data,
  });

  return {
    ok: true,
    fields: {
      productId: firstText(data, "productId", "product_id"),
      sku: firstText(data, "sku"),
      lotNumber: firstText(data, "lotNumber", "lot_number", "lot"),
      authStatus,
      tamperStatus,
      replayStatus,
      distributorId: firstText(data, "distributorId", "distributor_id"),
      campaignId: firstText(data, "campaignId", "campaign_id"),
      approximateLocation: location,
      consentFlags: consent,
      connectorProfileCode: connectorRaw as typeof CROPWISE_PHYSICAL_PRODUCT_EVENT_PROFILE | null,
      risk,
    },
  };
}

export function hashEnterpriseUid(uidHex: unknown) {
  const normalized = String(uidHex ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return `sha256:${createHash("sha256").update(normalized, "utf8").digest("hex")}`;
}
