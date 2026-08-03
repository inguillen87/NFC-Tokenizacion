export const RISK_ANALYTICS_SCOPES = Object.freeze({
  eventKpis: "selected_filters_and_time_window",
  neverScannedUnits: "lifetime_inventory_matching_tenant_sku_product_batch_region_and_carrier",
  webhookHealth: "tenant_and_time_window",
  riskScoring: "only_events_scored_with_nexid-risk-v1",
} as const);

export const RISK_COUNT_KPI_KEYS = [
  "total_events",
  "valid_taps",
  "unique_units",
  "replay_events",
  "invalid_auth_events",
  "never_scanned_units_lifetime",
  "tamper_events",
  "geo_anomalies",
  "content_adoption_events",
  "cropwise_cta_clicks",
  "registrations_and_leads",
  "training_completions",
  "webhook_deliveries",
  "webhook_delivered",
  "webhook_pending",
  "webhook_dead_letter",
  "critical_events",
  "high_events",
  "medium_events",
  "low_or_none_events",
  "unique_products",
  "unique_batches",
  "unique_distributors",
  "risk_scored_events",
  "risk_unscored_events",
] as const;

export type RiskCountKpi = (typeof RISK_COUNT_KPI_KEYS)[number];

export type RiskKpis = Record<RiskCountKpi, number> & {
  risk_event_rate_pct: number | null;
  average_risk_score: number | null;
  webhook_delivery_rate_pct: number | null;
  risk_coverage_pct: number | null;
};

export type RiskEvent = {
  id: string;
  created_at: string;
  tenant_slug: string;
  bid: string;
  sku: string | null;
  product_id: string | null;
  lot_number: string | null;
  region: string | null;
  distributor_id: string | null;
  carrier_profile_code: string | null;
  event_type: string;
  result: string;
  risk_profile_version: "nexid-risk-v1" | null;
  risk_classified: boolean;
  risk_score: number | null;
  risk_level: "none" | "low" | "medium" | "high" | "critical" | null;
  triggered_rules: string[];
  recommended_action: string | null;
  unit_reference: string;
  approximate_location: {
    lat: number;
    lng: number;
    city: string | null;
    country: string | null;
  } | null;
};

export type RiskAnalyticsPayload = {
  ok: true;
  tenantScoped: boolean;
  scopes: typeof RISK_ANALYTICS_SCOPES;
  kpis: RiskKpis;
  triggered_rules: Array<{ rule: string; events: number }>;
  events: RiskEvent[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedString(value: unknown, max = 512): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

function nullableString(value: unknown, max = 512): string | null | undefined {
  if (value === null) return null;
  return boundedString(value, max) || undefined;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function percentage(value: unknown, nullable: boolean): number | null | undefined {
  if (nullable && value === null) return null;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : undefined;
}

function parseRules(value: unknown) {
  if (!Array.isArray(value) || value.length > 128) return null;
  const parsed: string[] = [];
  for (const item of value) {
    const rule = boundedString(item, 160);
    if (!rule) return null;
    parsed.push(rule);
  }
  return parsed;
}

function parseLocation(value: unknown): RiskEvent["approximate_location"] | undefined {
  if (value === null) return null;
  const current = record(value);
  if (!current || typeof current.lat !== "number" || !Number.isFinite(current.lat)
    || typeof current.lng !== "number" || !Number.isFinite(current.lng)
    || current.lat < -90 || current.lat > 90 || current.lng < -180 || current.lng > 180) return undefined;
  const city = nullableString(current.city, 160);
  const country = nullableString(current.country, 32);
  if (city === undefined || country === undefined) return undefined;
  return { lat: current.lat, lng: current.lng, city, country };
}

function parseEvent(value: unknown): RiskEvent | null {
  const current = record(value);
  if (!current || "uid_hex" in current || "uid_hash" in current || "tag_id" in current) return null;
  const id = boundedString(current.id, 32);
  const createdAt = boundedString(current.created_at, 64);
  const tenantSlug = boundedString(current.tenant_slug, 160);
  const bid = boundedString(current.bid, 160);
  const eventType = boundedString(current.event_type, 160);
  const result = boundedString(current.result, 160);
  const unitReference = boundedString(current.unit_reference, 64);
  const classified = current.risk_classified;
  const rules = parseRules(current.triggered_rules);
  const location = parseLocation(current.approximate_location);
  if (!id || !/^\d+$/.test(id) || !createdAt || !Number.isFinite(Date.parse(createdAt))
    || !tenantSlug || !bid || !eventType || !result || !unitReference || !/^event:[0-9a-f]{24}$/.test(unitReference)
    || classified !== true && classified !== false || !rules || location === undefined) return null;

  const optionalFields = ["sku", "product_id", "lot_number", "region", "distributor_id", "carrier_profile_code"] as const;
  const optional = Object.fromEntries(optionalFields.map((key) => [key, nullableString(current[key], 160)]));
  if (Object.values(optional).some((item) => item === undefined)) return null;

  const riskVersion = current.risk_profile_version;
  const riskScore = current.risk_score;
  const riskLevel = current.risk_level;
  const action = nullableString(current.recommended_action, 256);
  if (classified) {
    if (riskVersion !== "nexid-risk-v1" || count(riskScore) === null || Number(riskScore) > 100
      || !["none", "low", "medium", "high", "critical"].includes(String(riskLevel))
      || action === null || action === undefined) return null;
  } else if (riskVersion !== null || riskScore !== null || riskLevel !== null || action !== null || rules.length > 0) {
    return null;
  }

  return {
    id,
    created_at: new Date(createdAt).toISOString(),
    tenant_slug: tenantSlug,
    bid,
    sku: optional.sku as string | null,
    product_id: optional.product_id as string | null,
    lot_number: optional.lot_number as string | null,
    region: optional.region as string | null,
    distributor_id: optional.distributor_id as string | null,
    carrier_profile_code: optional.carrier_profile_code as string | null,
    event_type: eventType,
    result,
    risk_profile_version: classified ? "nexid-risk-v1" : null,
    risk_classified: classified,
    risk_score: classified ? Number(riskScore) : null,
    risk_level: classified ? riskLevel as RiskEvent["risk_level"] : null,
    triggered_rules: rules,
    recommended_action: classified ? action as string : null,
    unit_reference: unitReference,
    approximate_location: location,
  };
}

export function parseRiskAnalyticsPayload(value: unknown): RiskAnalyticsPayload | null {
  const current = record(value);
  const scopes = record(current?.scopes);
  const rawKpis = record(current?.kpis);
  if (!current || current.ok !== true || typeof current.tenantScoped !== "boolean" || !scopes || !rawKpis) return null;
  for (const [key, expected] of Object.entries(RISK_ANALYTICS_SCOPES)) {
    if (scopes[key] !== expected) return null;
  }

  const kpis = {} as RiskKpis;
  for (const key of RISK_COUNT_KPI_KEYS) {
    const parsed = count(rawKpis[key]);
    if (parsed === null) return null;
    kpis[key] = parsed;
  }
  const riskRate = percentage(rawKpis.risk_event_rate_pct, true);
  const averageRisk = percentage(rawKpis.average_risk_score, true);
  const webhookRate = percentage(rawKpis.webhook_delivery_rate_pct, true);
  const coverage = percentage(rawKpis.risk_coverage_pct, true);
  if (riskRate === undefined || averageRisk === undefined || webhookRate === undefined || coverage === undefined
    || kpis.risk_scored_events + kpis.risk_unscored_events !== kpis.total_events) return null;
  const expectedCoverage = kpis.total_events === 0
    ? null
    : Math.round((10000 * kpis.risk_scored_events) / kpis.total_events) / 100;
  const riskLevelTotal = kpis.critical_events + kpis.high_events + kpis.medium_events + kpis.low_or_none_events;
  if ((expectedCoverage === null ? coverage !== null : coverage === null || Math.abs(coverage - expectedCoverage) > 0.01)
    || riskLevelTotal !== kpis.risk_scored_events
    || (kpis.risk_scored_events === 0 && (riskRate !== null || averageRisk !== null))
    || (kpis.risk_scored_events > 0 && (riskRate === null || averageRisk === null))
    || (kpis.webhook_deliveries === 0 && webhookRate !== null)
    || (kpis.webhook_deliveries > 0 && webhookRate === null)
    || kpis.webhook_delivered > kpis.webhook_deliveries
    || kpis.webhook_pending > kpis.webhook_deliveries
    || kpis.webhook_dead_letter > kpis.webhook_deliveries
    || kpis.unique_units > kpis.total_events) return null;
  kpis.risk_event_rate_pct = riskRate;
  kpis.average_risk_score = averageRisk;
  kpis.webhook_delivery_rate_pct = webhookRate;
  kpis.risk_coverage_pct = coverage;

  if (!Array.isArray(current.triggered_rules) || current.triggered_rules.length > 128
    || !Array.isArray(current.events) || current.events.length > 200) return null;
  const ruleCounts: Array<{ rule: string; events: number }> = [];
  for (const item of current.triggered_rules) {
    const row = record(item);
    const rule = boundedString(row?.rule, 160);
    const events = count(row?.events);
    if (!rule || events === null) return null;
    ruleCounts.push({ rule, events });
  }
  const events = current.events.map(parseEvent);
  if (events.some((event) => !event) || events.length > kpis.total_events) return null;

  return {
    ok: true,
    tenantScoped: current.tenantScoped,
    scopes: RISK_ANALYTICS_SCOPES,
    kpis,
    triggered_rules: ruleCounts,
    events: events as RiskEvent[],
  };
}
