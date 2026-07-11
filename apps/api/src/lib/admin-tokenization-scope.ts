import { sql } from "./db";

export async function isTokenizationRequestInTenantScope(
  input: { requestId: string; forcedTenantSlug?: string | null },
  query: typeof sql = sql,
) {
  const tenantSlug = String(input.forcedTenantSlug || "").trim().toLowerCase();
  if (!tenantSlug) return true;

  const rows = await query/*sql*/`
    SELECT tr.id
    FROM tokenization_requests tr
    JOIN tenants tn ON tn.id = tr.tenant_id
    WHERE tr.id = ${input.requestId}::uuid
      AND tn.slug = ${tenantSlug}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}
