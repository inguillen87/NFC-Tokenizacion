export type NexidEventVerdict =
  | "valid"
  | "invalid"
  | "replay_suspect"
  | "blocked_replay"
  | "revoked"
  | "broken"
  | "tampered"
  | "unknown_batch"
  | "not_registered"
  | "not_active";

export type RiskScoreInput = {
  replayRate: number;
  invalidRate: number;
  tamperRate: number;
  revokedTapRate: number;
  geoAnomalyRate: number;
  deviceAnomalyRate: number;
};

export type RiskScoreBreakdown = RiskScoreInput & {
  rawScore: number;
  score: number;
};

export type NexidTapEvent = {
  id?: string | number | null;
  uidHex?: string | null;
  bid?: string | null;
  tenantSlug?: string | null;
  result?: string | null;
  verdict: NexidEventVerdict;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  city?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: string | null;
  createdAt?: string | null;
  isDemo: boolean;
};

export type TenantTapRealtimeEvent = {
  eventId: string;
  tenantId: string | null;
  tenantSlug: string | null;
  batchId: string | null;
  tagId: string | null;
  uidMasked: string;
  occurredAt: string;
  occurredAtUtc: string;
  occurredAtLocal: string;
  timezone: string;
  timezoneLabel: string;
  timezoneOffset: string | null;
  verdict: string;
  riskLevel: string;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  locationSource?: string | null;
  locationAccuracyM?: number | null;
  deviceLabel?: string | null;
  deviceOs?: string | null;
  deviceType?: string | null;
  productName?: string | null;
  source: "production" | "demo" | "unknown";
  eventSource: string;
};

const WEIGHTS = {
  replay: 45,
  invalid: 25,
  tamper: 50,
  revoked: 35,
  geo: 20,
  device: 15,
} as const;

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mapResultToVerdict(result: string): NexidEventVerdict {
  const normalized = String(result || "").trim().toUpperCase();
  if (normalized === "VALID" || normalized === "TAP_VALID") return "valid";
  if (normalized === "REPLAY_SUSPECT" || normalized === "DUPLICATE") return "replay_suspect";
  if (normalized === "BLOCKED_REPLAY") return "blocked_replay";
  if (normalized === "REVOKED") return "revoked";
  if (normalized === "BROKEN") return "broken";
  if (normalized === "TAMPER" || normalized === "TAMPERED") return "tampered";
  if (normalized === "UNKNOWN_BATCH") return "unknown_batch";
  if (normalized === "NOT_REGISTERED") return "not_registered";
  if (normalized === "NOT_ACTIVE") return "not_active";
  return "invalid";
}

function verdictToRiskLevel(verdict: NexidEventVerdict): NexidTapEvent["riskLevel"] {
  if (verdict === "valid") return "none";
  if (verdict === "replay_suspect" || verdict === "blocked_replay" || verdict === "tampered") return "high";
  if (verdict === "revoked" || verdict === "broken") return "critical";
  if (verdict === "invalid" || verdict === "unknown_batch" || verdict === "not_registered" || verdict === "not_active") return "medium";
  return "low";
}

export function maskUid(uid: string | null | undefined) {
  const value = String(uid || "").trim().toUpperCase();
  if (!value) return "N/A";
  if (value.length <= 6) return `${value.slice(0, 1)}***${value.slice(-1)}`;
  return `${value.slice(0, 4)}****${value.slice(-2)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    if (text) return text;
  }
  return "";
}

function inferDeviceOs(platform: string, userAgent: string) {
  const normalized = `${platform} ${userAgent}`.toLowerCase();
  if (/iphone|ipad|ios|mac os/.test(normalized)) return "iOS";
  if (/android/.test(normalized)) return "Android";
  if (/windows/.test(normalized)) return "Windows";
  if (/linux/.test(normalized)) return "Linux";
  return "";
}

function inferDeviceType(mobile: unknown, platform: string, userAgent: string) {
  if (mobile === true || String(mobile).toLowerCase() === "true") return "mobile";
  const normalized = `${platform} ${userAgent}`.toLowerCase();
  if (/ipad|tablet/.test(normalized)) return "tablet";
  if (/mobi|iphone|android/.test(normalized)) return "mobile";
  return "";
}

const COUNTRY_TIMEZONES: Record<string, { timezone: string; label: string }> = {
  AR: { timezone: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  BR: { timezone: "America/Sao_Paulo", label: "Sao Paulo" },
  CL: { timezone: "America/Santiago", label: "Santiago" },
  UY: { timezone: "America/Montevideo", label: "Montevideo" },
  PY: { timezone: "America/Asuncion", label: "Asuncion" },
  BO: { timezone: "America/La_Paz", label: "La Paz" },
  PE: { timezone: "America/Lima", label: "Lima" },
  CO: { timezone: "America/Bogota", label: "Bogota" },
  MX: { timezone: "America/Mexico_City", label: "Mexico City" },
  US: { timezone: "America/New_York", label: "US Eastern" },
};

const TENANT_TIMEZONES: Record<string, { timezone: string; label: string }> = {
  demobodega: { timezone: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
};

function normalizeTimezoneCandidate(value: string) {
  try {
    new Intl.DateTimeFormat("es-AR", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "";
  }
}

function resolveTimezone(row: Record<string, unknown>, countryCode: string | null, tenantSlug: string | null) {
  const meta = asRecord(row.meta);
  const sunContext = asRecord(meta.sun_context);
  const client = asRecord(sunContext.client);
  const explicitTimezone = normalizeTimezoneCandidate(firstText(
    row.timezone,
    row.time_zone,
    row.event_timezone,
    client.timezone,
    meta.timezone,
  ));
  if (explicitTimezone) {
    return { timezone: explicitTimezone, label: explicitTimezone.replace(/^America\//, "").replace(/_/g, " ") };
  }
  const tenantMatch = TENANT_TIMEZONES[String(tenantSlug || "").toLowerCase()];
  if (tenantMatch) return tenantMatch;
  const countryMatch = COUNTRY_TIMEZONES[String(countryCode || "").toUpperCase()];
  if (countryMatch) return countryMatch;
  return { timezone: "UTC", label: "UTC" };
}

function timezoneOffsetLabel(date: Date, timezone: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date).find((item) => item.type === "timeZoneName")?.value || null;
    return part ? part.replace("GMT-03:00", "GMT-3").replace("GMT+00:00", "GMT") : null;
  } catch {
    return null;
  }
}

export function resolveEventLocalTime(row: Record<string, unknown>) {
  const normalized = normalizeEvent(row);
  const occurredAtUtc = normalized.createdAt || new Date().toISOString();
  const date = new Date(occurredAtUtc);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const { timezone, label } = resolveTimezone(row, normalized.countryCode || null, normalized.tenantSlug || null);
  const offset = timezoneOffsetLabel(safeDate, timezone);
  const occurredAtLocal = new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(safeDate);
  return {
    occurredAtUtc,
    occurredAtLocal,
    timezone,
    timezoneLabel: offset ? `${label} (${offset})` : label,
    timezoneOffset: offset,
  };
}

export function normalizeTenantTapRealtimeEvent(row: Record<string, unknown>): TenantTapRealtimeEvent {
  const normalized = normalizeEvent(row);
  const meta = asRecord(row.meta);
  const sunContext = asRecord(meta.sun_context);
  const client = asRecord(sunContext.client);
  const deviceMeta = asRecord(sunContext.device);
  const tenantId = row.tenant_id == null ? null : String(row.tenant_id);
  const batchId = row.batch_id == null ? (normalized.bid || null) : String(row.batch_id);
  const tagId = row.tag_id == null ? null : String(row.tag_id);
  const productName = row.product_name == null ? null : String(row.product_name);
  const time = resolveEventLocalTime(row);
  const accuracy = Number(row.location_accuracy_m ?? row.accuracy_m ?? row.accuracyM);
  const userAgent = firstText(row.user_agent, row.userAgent, client.userAgent, client.browser);
  const platform = firstText(row.device_label, row.deviceLabel, client.platform);
  const deviceOs = firstText(row.device_os, row.deviceOs, deviceMeta.deviceOs, deviceMeta.os, client.os) || inferDeviceOs(platform, userAgent);
  const deviceType = firstText(row.device_type, row.deviceType, deviceMeta.deviceType, client.deviceType) || inferDeviceType(client.mobile, platform, userAgent);
  const deviceLabel = firstText(row.device_label, row.deviceLabel, deviceMeta.deviceLabel, platform, deviceOs, deviceType);
  return {
    eventId: String(normalized.id || row.event_id || `${normalized.createdAt || Date.now()}`),
    tenantId,
    tenantSlug: normalized.tenantSlug || null,
    batchId,
    tagId,
    uidMasked: maskUid(normalized.uidHex || null),
    occurredAt: time.occurredAtUtc,
    occurredAtUtc: time.occurredAtUtc,
    occurredAtLocal: time.occurredAtLocal,
    timezone: time.timezone,
    timezoneLabel: time.timezoneLabel,
    timezoneOffset: time.timezoneOffset,
    verdict: normalized.verdict,
    riskLevel: normalized.riskLevel,
    city: normalized.city || null,
    country: normalized.countryCode || null,
    lat: normalized.lat ?? null,
    lng: normalized.lng ?? null,
    locationSource: firstText(row.location_source, row.locationSource) || null,
    locationAccuracyM: Number.isFinite(accuracy) ? accuracy : null,
    deviceLabel: deviceLabel || null,
    deviceOs: deviceOs || null,
    deviceType: deviceType || null,
    productName,
    source: normalized.isDemo || normalized.source === "seed"
      ? "demo"
      : normalized.source === "real" || normalized.source === "imported" || normalized.source === "production"
        ? "production"
        : "unknown",
    eventSource: normalized.source || "unknown",
  };
}

export function computeRiskScore(input: RiskScoreInput): RiskScoreBreakdown {
  const rawScore =
    input.replayRate * WEIGHTS.replay +
    input.invalidRate * WEIGHTS.invalid +
    input.tamperRate * WEIGHTS.tamper +
    input.revokedTapRate * WEIGHTS.revoked +
    input.geoAnomalyRate * WEIGHTS.geo +
    input.deviceAnomalyRate * WEIGHTS.device;
  return { ...input, rawScore, score: clamp(rawScore) };
}

export function normalizeEvent(row: Record<string, unknown>): NexidTapEvent {
  const verdict = (typeof row.verdict === "string" && row.verdict
    ? String(row.verdict).toLowerCase()
    : mapResultToVerdict(String(row.result || ""))) as NexidEventVerdict;
  const source = String(row.source || "");
  return {
    id: (row.id as string | number | null | undefined) ?? null,
    uidHex: String(row.uid_hex || row.uidHex || "") || null,
    bid: String(row.bid || "") || null,
    tenantSlug: String(row.tenant_slug || row.tenantSlug || "") || null,
    result: String(row.result || "") || null,
    verdict,
    riskLevel: verdictToRiskLevel(verdict),
    city: String(row.city || row.geo_city || "") || null,
    countryCode: String(row.country_code || row.geo_country || "") || null,
    lat: typeof row.lat === "number" ? row.lat : typeof row.geo_lat === "number" ? (row.geo_lat as number) : null,
    lng: typeof row.lng === "number" ? row.lng : typeof row.geo_lng === "number" ? (row.geo_lng as number) : null,
    source: source || null,
    createdAt: String(row.created_at || row.createdAt || "") || null,
    isDemo: source === "demo" || source === "demo_simulation",
  };
}

export function aggregateTenantMetrics(input: {
  events?: Array<Record<string, unknown>>;
  counts?: Partial<Record<"scans" | "valid" | "invalid" | "duplicates" | "tamper" | "revoked", number>>;
  geoAnomalyRate?: number;
  deviceAnomalyRate?: number;
}) {
  const events = Array.isArray(input.events) ? input.events.map(normalizeEvent) : [];
  const scans = input.counts?.scans ?? events.length;
  const valid = input.counts?.valid ?? events.filter((event) => event.verdict === "valid").length;
  const duplicates = input.counts?.duplicates ?? events.filter((event) => event.verdict === "replay_suspect" || event.verdict === "blocked_replay").length;
  const tamper = input.counts?.tamper ?? events.filter((event) => event.verdict === "tampered").length;
  const revoked = input.counts?.revoked ?? events.filter((event) => event.verdict === "revoked").length;
  const invalid = input.counts?.invalid ?? Math.max(scans - valid, 0);
  const safeScans = Math.max(0, Number(scans || 0));

  const breakdown = computeRiskScore({
    replayRate: safeScans ? duplicates / safeScans : 0,
    invalidRate: safeScans ? invalid / safeScans : 0,
    tamperRate: safeScans ? tamper / safeScans : 0,
    revokedTapRate: safeScans ? revoked / safeScans : 0,
    geoAnomalyRate: Number(input.geoAnomalyRate || 0),
    deviceAnomalyRate: Number(input.deviceAnomalyRate || 0),
  });

  return {
    scans: safeScans,
    valid: Number(valid || 0),
    invalid: Number(invalid || 0),
    duplicates: Number(duplicates || 0),
    tamper: Number(tamper || 0),
    revoked: Number(revoked || 0),
    validRate: safeScans ? Number((((valid || 0) / safeScans) * 100).toFixed(1)) : 0,
    invalidRate: safeScans ? Number((((invalid || 0) / safeScans) * 100).toFixed(1)) : 0,
    riskScore: Number(breakdown.score.toFixed(1)),
    riskBreakdown: breakdown,
    demoEvents: events.filter((event) => event.isDemo).length,
    productionEvents: events.filter((event) => !event.isDemo).length,
  };
}
