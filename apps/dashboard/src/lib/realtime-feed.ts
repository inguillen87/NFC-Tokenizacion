import { classifyEventRiskBucket, isEventSecurityRisk } from "@product/core";

export type RealtimeStreamSource = "production" | "demo" | "all";
export type RealtimeDataSource = "production" | "demo" | "seed" | "mixed" | "unavailable";
export type RealtimeAvailability = "ready" | "fallback" | "upstream_error" | "invalid_payload" | "unreachable";
export type RealtimeVerdictBucket = "valid" | "duplicate_replay" | "tamper" | "invalid" | "unknown";

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
  reason?: string | null;
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
  eventSource?: string;
};

/** Wire contract emitted by the API SSE endpoint before dashboard normalization. */
export type TenantTapRealtimeWireEvent = {
  id?: string | number;
  result?: string;
  verdict?: string;
  reason?: string;
  uid_hex?: string;
  bid?: string;
  tenant_slug?: string;
  city?: string;
  country_code?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  coordinate_source?: string | null;
  location_source?: string | null;
  location_accuracy_m?: number | string | null;
  created_at?: string;
  stream_sent_at?: string;
  stream_latency_ms?: number | null;
  request_id?: string;
  stream_request_id?: string;
  origin_trace_id?: string | null;
};

export function classifyRealtimeVerdict(value?: unknown, reason?: unknown): RealtimeVerdictBucket {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : { verdict: value, result: value, reason };
  const bucket = classifyEventRiskBucket(input);
  if (bucket === "revoked") return "invalid";
  if (bucket === "lifecycle") return "unknown";
  return bucket;
}

export function isRealtimeRisk(value?: unknown, reason?: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : { verdict: value, result: value, reason };
  return isEventSecurityRisk(input);
}

export function classifyRealtimeEventSource(value: unknown): Pick<TenantTapRealtimeEvent, "source" | "eventSource"> {
  const eventSource = String(value || "").trim().toLowerCase() || "unknown";
  if (eventSource === "demo" || eventSource === "demo_simulation" || eventSource === "seed") {
    return { source: "demo", eventSource };
  }
  if (eventSource === "real" || eventSource === "imported" || eventSource === "production") {
    return { source: "production", eventSource };
  }
  return { source: "unknown", eventSource };
}

function eventMs(row: TenantTapRealtimeEvent) {
  const candidates = [row.occurredAt, row.occurredAtUtc, row.occurredAtLocal];
  for (const value of candidates) {
    const ms = Date.parse(String(value || ""));
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function sortRealtimeEvents(rows: TenantTapRealtimeEvent[], max = 40) {
  const byId = new Map<string, TenantTapRealtimeEvent>();
  rows.forEach((row, index) => {
    const key = String(row.eventId || `${row.uidMasked || "uid"}-${row.occurredAt || "time"}-${index}`);
    const current = byId.get(key);
    if (!current || eventMs(row) >= eventMs(current)) byId.set(key, row);
  });
  return [...byId.values()]
    .sort((a, b) => eventMs(b) - eventMs(a))
    .slice(0, max);
}

export function mergeRealtimeEvents(
  previous: TenantTapRealtimeEvent[],
  incoming: TenantTapRealtimeEvent,
  max = 40,
) {
  const withoutDup = previous.filter((row) => row.eventId !== incoming.eventId);
  return sortRealtimeEvents([incoming, ...withoutDup], max);
}
