type Scope = "super_admin" | "tenant_admin" | "reseller" | "readonly_demo" | null;

export function allowRealtimeEventForScope(input: {
  scope: Scope;
  forcedTenantSlug?: string;
  requestedTenant?: string;
  eventTenantSlug?: string | null;
}) {
  const eventTenant = String(input.eventTenantSlug || "").toLowerCase();
  const forced = String(input.forcedTenantSlug || "").toLowerCase();
  const requested = String(input.requestedTenant || "").toLowerCase();
  if (input.scope === "tenant_admin" || input.scope === "reseller") {
    if (!forced) return false;
    return eventTenant === forced;
  }
  if (requested) return eventTenant === requested;
  return true;
}
