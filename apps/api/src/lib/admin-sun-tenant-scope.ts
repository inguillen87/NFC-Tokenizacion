import { sql } from "./db";

function normalizeTenantSlug(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBids(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

export async function areAdminSunBidsInTenantScope(
  input: { bids: Array<string | null | undefined>; forcedTenantSlug?: string | null },
  query: typeof sql = sql,
) {
  const tenantSlug = normalizeTenantSlug(input.forcedTenantSlug);
  if (!tenantSlug) return true;

  const bids = normalizeBids(input.bids);
  if (!bids.length) return false;

  const rows = await query/*sql*/`
    SELECT
      b.bid,
      COUNT(*)::int AS batch_count,
      COUNT(*) FILTER (WHERE t.slug = ${tenantSlug})::int AS owned_count
    FROM batches b
    JOIN tenants t ON t.id = b.tenant_id
    WHERE b.bid = ANY(${bids}::text[])
    GROUP BY b.bid
  `;
  const ownership = new Map(rows.map((row) => [String(row.bid || ""), {
    batchCount: Number(row.batch_count || 0),
    ownedCount: Number(row.owned_count || 0),
  }]));
  return bids.every((bid) => {
    const resolved = ownership.get(bid);
    return resolved?.batchCount === 1 && resolved.ownedCount === 1;
  });
}

export async function isAdminSunDiagnosticInTenantScope(
  input: { diagnosticId: string | number; forcedTenantSlug?: string | null },
  query: typeof sql = sql,
) {
  const tenantSlug = normalizeTenantSlug(input.forcedTenantSlug);
  if (!tenantSlug) return true;

  const diagnosticId = String(input.diagnosticId || "").trim();
  if (!diagnosticId) return false;

  const rows = await query/*sql*/`
    SELECT d.id
    FROM sun_diagnostics d
    JOIN batches b ON b.bid = d.bid
    JOIN tenants t ON t.id = b.tenant_id
    WHERE d.id = ${diagnosticId}
    GROUP BY d.id
    HAVING COUNT(*) = 1
      AND COUNT(*) FILTER (WHERE t.slug = ${tenantSlug}) = 1
  `;
  return Boolean(rows[0]?.id);
}
