import { sql } from "./db";

export async function resolveTokenizationRequestTenantId(
  input: { requestId: string; forcedTenantSlug?: string | null },
  query: typeof sql = sql,
) {
  const tenantSlug = String(input.forcedTenantSlug || "").trim().toLowerCase();
  const rows = tenantSlug
    ? await query/*sql*/`
      SELECT tr.tenant_id
      FROM tokenization_requests tr
      JOIN tenants tn ON tn.id = tr.tenant_id
      WHERE tr.id = ${input.requestId}::uuid
        AND tn.slug = ${tenantSlug}
      LIMIT 1
    `
    : await query/*sql*/`
      SELECT tr.tenant_id
      FROM tokenization_requests tr
      WHERE tr.id = ${input.requestId}::uuid
        AND tr.tenant_id IS NOT NULL
      LIMIT 1
    `;
  return rows[0]?.tenant_id ? String(rows[0].tenant_id) : null;
}

export async function isTokenizationRequestInTenantScope(
  input: { requestId: string; forcedTenantSlug?: string | null },
  query: typeof sql = sql,
) {
  return Boolean(await resolveTokenizationRequestTenantId(input, query));
}
