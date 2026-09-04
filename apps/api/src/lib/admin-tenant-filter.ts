export function effectiveTenantFilter(input: { forcedTenantSlug?: string | null; requestedTenantSlug?: string | null }) {
  const forced = String(input.forcedTenantSlug || "").trim().toLowerCase();
  if (forced) return forced;
  return String(input.requestedTenantSlug || "").trim().toLowerCase();
}

export type TenantStatsSource = "real" | "demo" | "imported";

export type TenantStatsSourceResolution =
  | { ok: true; source: TenantStatsSource }
  | { ok: false; reason: "invalid_source_filter" };

const TENANT_STATS_SOURCES = new Set<TenantStatsSource>(["real", "demo", "imported"]);

/**
 * A tenant-bound human session is operational, even when its tenant slug is
 * also used by an explicit demo corpus. It must never broaden its KPI query to
 * demo or mixed sources. Global operators may select one declared source, but
 * an omitted source still defaults to operational truth rather than a blend.
 */
export function resolveTenantStatsSource(input: {
  forcedTenantSlug?: string | null;
  requestedSource?: string | null;
}): TenantStatsSourceResolution {
  const forcedTenantSlug = String(input.forcedTenantSlug || "").trim().toLowerCase();
  if (forcedTenantSlug) return { ok: true, source: "real" };

  const requestedSource = String(input.requestedSource || "").trim().toLowerCase();
  if (!requestedSource) return { ok: true, source: "real" };
  if (!TENANT_STATS_SOURCES.has(requestedSource as TenantStatsSource)) {
    return { ok: false, reason: "invalid_source_filter" };
  }
  return { ok: true, source: requestedSource as TenantStatsSource };
}
