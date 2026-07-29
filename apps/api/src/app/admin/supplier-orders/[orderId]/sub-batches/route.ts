export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { orderId } = await params;
  const adminTenantScope = getAdminTenantScope(req);

  const orderRows = await sql/*sql*/`
    SELECT so.*, t.slug AS tenant_slug
    FROM supplier_orders so
    JOIN tenants t ON t.id = so.tenant_id
    WHERE so.id = ${orderId}::uuid
    LIMIT 1
  `;
  const order = orderRows[0];
  if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
  if (adminTenantScope.forcedTenantSlug && String(order.tenant_slug || "").toLowerCase() !== adminTenantScope.forcedTenantSlug) {
    return json({ ok: false, reason: "supplier_order_forbidden_for_tenant" }, 403);
  }

  const rows = await sql/*sql*/`
    SELECT
      ssb.id,
      ssb.bid,
      ssb.sequence_index,
      ssb.expected_quantity,
      ssb.manifest_count,
      ssb.manifest_status,
      ssb.qa_status,
      ssb.status,
      ssb.key_export_count,
      ssb.key_exported_at,
      ssb.metadata_json,
      b.id AS batch_id,
      b.sdm_config
    FROM supplier_sub_batches ssb
    LEFT JOIN batches b ON b.id = ssb.batch_id
    WHERE ssb.supplier_order_id = ${order.id}
    ORDER BY ssb.sequence_index ASC
  `;

  return json({
    ok: true,
    order: {
      id: order.id,
      tenant_slug: order.tenant_slug,
      customer_slug: order.customer_slug,
      order_name: order.order_name,
    },
    sub_batches: rows.map((row) => ({
      ...row,
      url_template: row.metadata_json?.url_template || row.sdm_config?.url_template,
      key_fingerprint: row.metadata_json?.key_fingerprint,
    })),
  });
}
