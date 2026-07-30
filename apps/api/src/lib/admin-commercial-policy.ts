import { createHash } from "node:crypto";
import type { AdminPrincipal } from "./auth";

export type AdminWriteTenant = {
  tenantId: string;
  tenantSlug: string;
};

export type AdminWriteTenantResolution =
  | { ok: true; tenant: AdminWriteTenant }
  | { ok: false; status: 400 | 403 | 404; reason: string };

type TenantReference = {
  tenantId?: unknown;
  tenantSlug?: unknown;
};

type TenantLookup = (input: {
  tenantId: string;
  tenantSlug: string;
}) => Promise<Array<{ id: unknown; slug: unknown }>>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function text(value: unknown) {
  return String(value || "").trim();
}

export function tenantReference(value: unknown): TenantReference {
  const normalized = text(value);
  if (!normalized) return {};
  return UUID_PATTERN.test(normalized)
    ? { tenantId: normalized.toLowerCase() }
    : { tenantSlug: normalized.toLowerCase() };
}

/**
 * Resolves a tenant for an authenticated administrative write. Tenant-bound
 * principals never depend on caller input; any conflicting reference is
 * rejected. Global principals must identify one existing tenant server-side.
 */
export async function resolveAdminWriteTenant(input: {
  principal: AdminPrincipal;
  references: TenantReference[];
  lookup: TenantLookup;
}): Promise<AdminWriteTenantResolution> {
  const tenantIds = [...new Set(input.references.map((item) => text(item.tenantId).toLowerCase()).filter(Boolean))];
  const tenantSlugs = [...new Set(input.references.map((item) => text(item.tenantSlug).toLowerCase()).filter(Boolean))];

  if (tenantIds.length > 1 || tenantSlugs.length > 1) {
    return { ok: false, status: 403, reason: "tenant_scope_conflict" };
  }
  const requestedTenantId = tenantIds[0] || "";
  const requestedTenantSlug = tenantSlugs[0] || "";

  if (input.principal.scope === "tenant_admin" || input.principal.scope === "reseller") {
    const principalTenantId = text(input.principal.tenantId).toLowerCase();
    const principalTenantSlug = text(input.principal.tenantSlug).toLowerCase();
    if (!principalTenantId || !principalTenantSlug) {
      return { ok: false, status: 403, reason: "tenant_scope_required" };
    }
    if (
      (requestedTenantId && requestedTenantId !== principalTenantId)
      || (requestedTenantSlug && requestedTenantSlug !== principalTenantSlug)
    ) {
      return { ok: false, status: 403, reason: "tenant_scope_forbidden" };
    }
    return {
      ok: true,
      tenant: { tenantId: principalTenantId, tenantSlug: principalTenantSlug },
    };
  }

  if (!requestedTenantId && !requestedTenantSlug) {
    return { ok: false, status: 400, reason: "tenant_required" };
  }
  if (requestedTenantId && !UUID_PATTERN.test(requestedTenantId)) {
    return { ok: false, status: 400, reason: "tenant_id_invalid" };
  }
  if (requestedTenantSlug && !TENANT_SLUG_PATTERN.test(requestedTenantSlug)) {
    return { ok: false, status: 400, reason: "tenant_slug_invalid" };
  }

  const rows = await input.lookup({
    tenantId: requestedTenantId,
    tenantSlug: requestedTenantSlug,
  });
  if (rows.length !== 1) {
    return { ok: false, status: 404, reason: "tenant_not_found" };
  }
  const tenantId = text(rows[0].id).toLowerCase();
  const tenantSlug = text(rows[0].slug).toLowerCase();
  if (!UUID_PATTERN.test(tenantId) || !TENANT_SLUG_PATTERN.test(tenantSlug)) {
    return { ok: false, status: 404, reason: "tenant_not_found" };
  }
  return { ok: true, tenant: { tenantId, tenantSlug } };
}

export function normalizeAdminIdempotencyKey(value: unknown) {
  const key = text(value);
  return IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}

/**
 * order_requests predates a dedicated idempotency column. A tenant-scoped,
 * deterministic UUID provides an atomic create-or-replay key through its
 * existing primary key; the route still compares the persisted payload and
 * rejects reuse with different content.
 */
export function deriveAdminOrderRequestId(tenantId: string, idempotencyKey: string) {
  const bytes = Buffer.from(
    createHash("sha256")
      .update(`nexid:admin-order-request:v1\u0000${tenantId}\u0000${idempotencyKey}`, "utf8")
      .digest()
      .subarray(0, 16),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
