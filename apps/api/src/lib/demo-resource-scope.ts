import { sql } from "./db";

export const DEMO_TENANT_SLUG = "demobodega";
export const DEMO_BATCH_BID = "DEMO-2026-02";

const BID_SCOPE_KEYS = new Set(["bid", "forceBid", "batchBid", "batch_id"]);
const TENANT_SCOPE_KEYS = new Set(["tenant", "tenantSlug", "tenant_slug", "tenantId", "tenant_id"]);

type DemoScopeFailureReason =
  | "demo_bid_not_reserved"
  | "demo_tenant_not_reserved"
  | "demo_batch_not_found"
  | "demo_batch_tenant_conflict";

export type DemoScopeFailure = {
  ok: false;
  reason: DemoScopeFailureReason;
  status: 403 | 404 | 409;
};

export type ReservedDemoBatch = {
  id: string;
  tenantId: string;
  tenantSlug: typeof DEMO_TENANT_SLUG;
};

type DemoBatchInspection =
  | { ok: true; batch: ReservedDemoBatch | null }
  | DemoScopeFailure;

type DemoBatchResolution =
  | { ok: true; batch: ReservedDemoBatch }
  | DemoScopeFailure;

function failure(reason: DemoScopeFailureReason, status: DemoScopeFailure["status"]): DemoScopeFailure {
  return { ok: false, reason, status };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function requestedValues(input: unknown, keys: Set<string>) {
  const values: string[] = [];
  const seen = new WeakSet<object>();

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (keys.has(key)) {
        const requested = clean(nested);
        if (requested) values.push(requested);
      }
      visit(nested);
    }
  }

  visit(input);
  return values;
}

export function validateDemoResourceScopeRequest(req: Pick<Request, "headers">, input: unknown) {
  const body = asRecord(input);
  const requestedBids = requestedValues(body, BID_SCOPE_KEYS);
  if (requestedBids.some((bid) => bid !== DEMO_BATCH_BID)) {
    return failure("demo_bid_not_reserved", 403);
  }

  const requestedTenants = [
    ...requestedValues(body, TENANT_SCOPE_KEYS),
    clean(req.headers.get("x-nexid-tenant-slug")),
  ].filter(Boolean);
  if (requestedTenants.some((tenant) => tenant.toLowerCase() !== DEMO_TENANT_SLUG)) {
    return failure("demo_tenant_not_reserved", 403);
  }

  return {
    ok: true as const,
    bid: DEMO_BATCH_BID,
    tenantSlug: DEMO_TENANT_SLUG,
  };
}

export function classifyReservedDemoBatch(
  row: Record<string, unknown> | null | undefined,
  required = false,
): DemoBatchInspection {
  if (!row) {
    return required
      ? failure("demo_batch_not_found", 404)
      : { ok: true, batch: null };
  }

  const id = clean(row.id);
  const tenantId = clean(row.tenant_id);
  const tenantSlug = clean(row.tenant_slug).toLowerCase();
  if (!id || !tenantId || tenantSlug !== DEMO_TENANT_SLUG) {
    return failure("demo_batch_tenant_conflict", 409);
  }

  return {
    ok: true,
    batch: { id, tenantId, tenantSlug: DEMO_TENANT_SLUG },
  };
}

export async function inspectReservedDemoBatch(query: typeof sql = sql): Promise<DemoBatchInspection> {
  const rows = await query/*sql*/`
    SELECT b.id, b.tenant_id, t.slug AS tenant_slug
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    WHERE b.bid = ${DEMO_BATCH_BID}
    LIMIT 1
  `;
  return classifyReservedDemoBatch((rows[0] || null) as Record<string, unknown> | null);
}

export async function requireReservedDemoBatch(query: typeof sql = sql): Promise<DemoBatchResolution> {
  const inspected = await inspectReservedDemoBatch(query);
  if (!inspected.ok) return inspected;
  if (!inspected.batch) return failure("demo_batch_not_found", 404);
  return { ok: true, batch: inspected.batch };
}
