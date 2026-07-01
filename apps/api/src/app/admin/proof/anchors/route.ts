export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";

export async function GET(req: Request) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const url = new URL(req.url);
  const requestedTenant = url.searchParams.get("tenant") || "";
  
  let tenantId: string | null = null;
  if (forcedTenantSlug) {
    const rows = await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${forcedTenantSlug} LIMIT 1`;
    tenantId = rows[0]?.id || null;
  } else if (requestedTenant) {
    const rows = /^[0-9a-f-]{36}$/i.test(requestedTenant)
      ? await sql/*sql*/`SELECT id FROM tenants WHERE id = ${requestedTenant}::uuid LIMIT 1`
      : await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${requestedTenant.toLowerCase()} LIMIT 1`;
    tenantId = rows[0]?.id || null;
  }

  const rows = tenantId
    ? await sql/*sql*/`
        SELECT id, provider, network, anchor_type, resource_type, resource_id, event_count, merkle_root, tx_hash, explorer_url, status, anchored_at, created_at
        FROM evidence_anchors
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT 100
      `
    : await sql/*sql*/`
        SELECT id, provider, network, anchor_type, resource_type, resource_id, event_count, merkle_root, tx_hash, explorer_url, status, anchored_at, created_at
        FROM evidence_anchors
        ORDER BY created_at DESC
        LIMIT 100
      `;

  return json({
    ok: true,
    anchors: rows,
  });
}
