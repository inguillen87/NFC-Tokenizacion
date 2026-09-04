import type { AdminScope } from "./auth";

export const REALTIME_EVENT_SOURCE_FILTERS = ["all", "production", "demo", "real", "imported"] as const;

export type RealtimeEventSourceFilter = (typeof REALTIME_EVENT_SOURCE_FILTERS)[number];

const REALTIME_EVENT_SOURCE_FILTER_SET = new Set<string>(REALTIME_EVENT_SOURCE_FILTERS);

export function parseRealtimeEventSourceFilter(value: unknown): RealtimeEventSourceFilter | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "all";
  return REALTIME_EVENT_SOURCE_FILTER_SET.has(normalized)
    ? normalized as RealtimeEventSourceFilter
    : null;
}

export function allowRealtimeEventForSource(
  filter: RealtimeEventSourceFilter,
  eventSource: unknown,
) {
  if (filter === "all") return true;
  const normalized = String(eventSource || "").trim().toLowerCase();
  if (!normalized) return false;
  if (filter === "production") return normalized === "real" || normalized === "imported";
  return normalized === filter;
}

export function allowRealtimeEventForScope(input: {
  scope: AdminScope | null;
  forcedTenantSlug?: string;
  requestedTenant?: string;
  eventTenantSlug?: string | null;
}) {
  const eventTenant = String(input.eventTenantSlug || "").toLowerCase();
  const forced = String(input.forcedTenantSlug || "").toLowerCase();
  const requested = String(input.requestedTenant || "").toLowerCase();
  if (input.scope === "tenant_admin" || input.scope === "tenant_operator" || input.scope === "reseller") {
    if (!forced) return false;
    return eventTenant === forced;
  }
  if (requested) return eventTenant === requested;
  return true;
}
