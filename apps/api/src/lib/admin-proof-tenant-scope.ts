import { getAdminTenantScope } from "./auth";
import { sql } from "./db";

export type AdminProofTenantScope = {
  requested: boolean;
  found: boolean;
  tenantId: string | null;
  tenantSlug: string | null;
};

export async function resolveAdminProofTenantScope(
  req: Request,
  requestedTenant: unknown = "",
  query: typeof sql = sql,
): Promise<AdminProofTenantScope> {
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const identifier = String(forcedTenantSlug || requestedTenant || "").trim();
  if (!identifier) {
    return { requested: false, found: true, tenantId: null, tenantSlug: null };
  }

  const rows = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)
    ? await query/*sql*/`SELECT id::text AS id, slug FROM tenants WHERE id = ${identifier}::uuid LIMIT 1`
    : await query/*sql*/`SELECT id::text AS id, slug FROM tenants WHERE slug = ${identifier.toLowerCase()} LIMIT 1`;
  const row = rows[0] as { id?: unknown; slug?: unknown } | undefined;
  if (!row?.id) {
    return { requested: true, found: false, tenantId: null, tenantSlug: identifier.toLowerCase() };
  }

  return {
    requested: true,
    found: true,
    tenantId: String(row.id),
    tenantSlug: String(row.slug || identifier).toLowerCase(),
  };
}
