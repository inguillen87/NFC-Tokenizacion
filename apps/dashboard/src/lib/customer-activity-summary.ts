import type { CustomerSignalCollectionState, CustomerSignalCollections } from "./customer-signal-timeline";

export type CustomerActivityKind = "leads" | "tickets" | "orders";
export type CustomerActivityCard = {
  kind: CustomerActivityKind;
  availability: CustomerSignalCollectionState["availability"];
  source: CustomerSignalCollectionState["source"];
  count: number | null;
  statuses: { value: string | null; count: number }[];
};
export type CustomerActivitySummary = {
  scope: string;
  demo: boolean;
  cards: CustomerActivityCard[];
};
const kinds: CustomerActivityKind[] = ["leads", "tickets", "orders"];
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const unavailable = (kind: CustomerActivityKind, availability: CustomerActivityCard["availability"] = "invalid_payload"): CustomerActivityCard => ({ kind, availability, source: "unavailable", count: null, statuses: [] });

/** A bounded read projection, never a funnel, audience, sales result or historical total. */
export function buildCustomerActivitySummary(input: {
  leads: unknown; tickets: unknown; orders: unknown; collections: CustomerSignalCollections;
  tenantScope: string; demoMode: boolean;
}): CustomerActivitySummary {
  const scope = typeof input.tenantScope === "string" ? input.tenantScope.trim().toLowerCase() : "";
  const validContext = typeof input.tenantScope === "string" && scope.length <= 128 && !/[\u0000-\u001f\u007f-\u009f]/.test(scope) && typeof input.demoMode === "boolean";
  const expectedSource = input.demoMode ? "demo" : "production";
  return { scope, demo: input.demoMode === true, cards: kinds.map(kind => {
    const state = object(object(input.collections)?.[kind]);
    if (!validContext || !state) return unavailable(kind);
    if (state.availability !== "ready") {
      const known = ["access_denied", "upstream_error", "unreachable", "invalid_payload"];
      return unavailable(kind, known.includes(String(state.availability)) ? state.availability as CustomerActivityCard["availability"] : "invalid_payload");
    }
    if (state.source !== expectedSource) return unavailable(kind);
    const rows = input[kind];
    if (!Array.isArray(rows) || rows.length > 5000) return unavailable(kind);
    const seen = new Set<string>();
    const buckets = new Map<string | null, number>();
    for (const value of rows) {
      const row = object(value);
      if (!row || typeof row.id !== "string" || !row.id.trim() || row.id.length > 128) return unavailable(kind);
      if (row.tenant_slug !== undefined && row.tenant_slug !== null && typeof row.tenant_slug !== "string") return unavailable(kind);
      const tenant = typeof row.tenant_slug === "string" ? row.tenant_slug.trim().toLowerCase() : "";
      if (tenant.length > 128 || /[\u0000-\u001f\u007f-\u009f]/.test(tenant) || (scope && tenant !== scope)) return unavailable(kind);
      // Channel/source text (e.g. demo_lab) does not determine data provenance.
      if (!input.demoMode && (row.demoMode === true || row.dataSource === "demo" || row.is_demo === true)) return unavailable(kind);
      const identity = JSON.stringify([tenant, row.id]);
      if (seen.has(identity)) return unavailable(kind);
      seen.add(identity);
      if (row.status !== undefined && row.status !== null && typeof row.status !== "string") return unavailable(kind);
      const status = typeof row.status === "string" && row.status.trim() ? row.status : null;
      if (status !== null && (status.length > 64 || /[\u0000-\u001f\u007f-\u009f]/.test(status))) return unavailable(kind);
      buckets.set(status, (buckets.get(status) || 0) + 1);
    }
    const statuses = [...buckets].map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || (a.value === b.value ? 0 : a.value === null ? 1 : b.value === null ? -1 : a.value < b.value ? -1 : 1));
    return { kind, availability: "ready", source: expectedSource, count: rows.length, statuses };
  }) };
}

/** A collection action cannot select an unrelated route or trigger a business write. */
export function customerActivityDestination(kind: CustomerActivityKind): "prospects" | "tickets" | "orders" {
  return kind === "leads" ? "prospects" : kind;
}
