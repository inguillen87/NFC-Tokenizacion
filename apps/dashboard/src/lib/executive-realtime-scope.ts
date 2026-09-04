import type { RealtimeStreamSource, TenantTapRealtimeEvent } from "./realtime-feed";

export const EXECUTIVE_REALTIME_EVENT_LIMIT = 50;

export type ExecutiveRealtimeMode = "tenant" | "global";

export type ExecutiveRealtimeTenantDirectoryEntry = {
  slug: string;
  name: string;
};

type ExecutiveRealtimeTenantScopedRow = {
  tenantSlug?: unknown;
  tenant_slug?: unknown;
  tenant?: unknown;
};

function normalizedTenant(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function resolveExecutiveRealtimeQueryTenant(input: {
  mode: ExecutiveRealtimeMode;
  tenantScope: unknown;
  selectedTenant: unknown;
}) {
  const lockedTenantScope = normalizedTenant(input.tenantScope);
  if (input.mode === "tenant") return lockedTenantScope;
  const selectedTenant = normalizedTenant(input.selectedTenant);
  return selectedTenant && selectedTenant !== "all" ? selectedTenant : "";
}

export function executiveRealtimeRequestKey(input: {
  tenant: string;
  timeRange: string;
  source: string;
}) {
  return `${normalizedTenant(input.tenant) || "all"}:${String(input.timeRange)}:${String(input.source)}`;
}

export function normalizeExecutiveRealtimeTenantDirectory(
  entries: readonly ExecutiveRealtimeTenantDirectoryEntry[],
) {
  const bySlug = new Map<string, ExecutiveRealtimeTenantDirectoryEntry>();
  for (const entry of entries) {
    const slug = normalizedTenant(entry?.slug);
    if (!slug) continue;
    const name = String(entry?.name || "").trim() || slug;
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, name });
  }
  return [...bySlug.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export function executiveRealtimeResponseScopeMatches(expectedTenant: unknown, reportedTenant: unknown) {
  const expected = normalizedTenant(expectedTenant);
  const reported = normalizedTenant(reportedTenant);
  return expected ? reported === expected : reported === "global";
}

export function executiveRealtimeSnapshotScopeMatches(
  expectedTenant: unknown,
  expectedWindow: unknown,
  reportedScope: unknown,
) {
  if (!reportedScope || typeof reportedScope !== "object" || Array.isArray(reportedScope)) return false;
  const scope = reportedScope as { tenant?: unknown; window?: unknown };
  return executiveRealtimeResponseScopeMatches(expectedTenant, scope.tenant)
    && String(scope.window || "").trim().toLowerCase() === String(expectedWindow || "").trim().toLowerCase();
}

export function executiveRealtimeRowsMatchTenant(
  rows: readonly ExecutiveRealtimeTenantScopedRow[],
  expectedTenant: unknown,
) {
  const expected = normalizedTenant(expectedTenant);
  if (!expected) return true;
  return rows.every((row) => normalizedTenant(row?.tenantSlug ?? row?.tenant_slug ?? row?.tenant) === expected);
}

const EXECUTIVE_INTERACTION_CLASSES = new Set([
  "authentication_verified",
  "product_identity_recognized",
  "security_signal",
  "lifecycle_activity",
  "unclassified_activity",
]);

export function isExecutiveRealtimeEvent(value: unknown): value is TenantTapRealtimeEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const requiredStrings = ["eventId", "uidMasked", "occurredAt", "eventType", "result", "verdict", "riskLevel"];
  if (requiredStrings.some((key) => !String(row[key] || "").trim())) return false;
  if (!Number.isFinite(Date.parse(String(row.occurredAt)))) return false;
  if (!String(row.tenantSlug || "").trim()) return false;
  if (!EXECUTIVE_INTERACTION_CLASSES.has(String(row.interactionClass || ""))) return false;
  if (!["production", "demo", "unknown"].includes(String(row.source || ""))) return false;
  if (!Array.isArray(row.commercialConsentChannels) || row.commercialConsentChannels.some((channel) => typeof channel !== "string")) return false;
  if (!Number.isFinite(Number(row.knownActorCount))) return false;
  return ["productIdentityRecognized", "authenticationVerified", "knownActor", "commercialConsentGranted"]
    .every((key) => typeof row[key] === "boolean");
}

export function executiveRealtimeSourceMatchesRequest(requested: RealtimeStreamSource, reported: unknown) {
  const source = String(reported || "").trim().toLowerCase();
  if (requested === "all") return source === "all" || source === "mixed" || source === "production" || source === "demo";
  return source === requested;
}

export function recentEventSamplePresentation(count: number, limit = EXECUTIVE_REALTIME_EVENT_LIMIT) {
  const normalizedCount = Number.isSafeInteger(count) && count > 0 ? count : 0;
  const normalizedLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : EXECUTIVE_REALTIME_EVENT_LIMIT;
  const limitReached = normalizedCount >= normalizedLimit;
  return {
    value: normalizedCount.toLocaleString("es-AR"),
    detail: limitReached ? `límite ${normalizedLimit}` : `hasta ${normalizedLimit}`,
    limitReached,
  };
}
