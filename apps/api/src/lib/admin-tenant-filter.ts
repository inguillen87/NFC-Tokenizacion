export function effectiveTenantFilter(input: { forcedTenantSlug?: string | null; requestedTenantSlug?: string | null }) {
  const forced = String(input.forcedTenantSlug || "").trim().toLowerCase();
  if (forced) return forced;
  return String(input.requestedTenantSlug || "").trim().toLowerCase();
}
