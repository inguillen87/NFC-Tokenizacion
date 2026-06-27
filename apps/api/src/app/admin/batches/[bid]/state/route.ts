export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import { canActivateSupplierSubBatch } from "../../../../../lib/supplier-ops";

export async function PATCH(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { bid } = await params;
  const { forcedTenantSlug } = getAdminTenantScope(req);

  const batchRows = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.tenant_id, b.status, b.carrier_profile_code,
        (b.meta_key_ct IS NOT NULL AND b.meta_key_ct <> '') AS has_meta_key,
        (b.file_key_ct IS NOT NULL AND b.file_key_ct <> '') AS has_file_key,
        b.supplier_order_id, b.supplier_sub_batch_id, b.created_at
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql/*sql*/`
      SELECT id, tenant_id, status, carrier_profile_code,
        (meta_key_ct IS NOT NULL AND meta_key_ct <> '') AS has_meta_key,
        (file_key_ct IS NOT NULL AND file_key_ct <> '') AS has_file_key,
        supplier_order_id, supplier_sub_batch_id, created_at
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;

  if (batchRows.length > 1) {
    return json({
      ok: false,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique before changing batch state.",
      batches: batchRows.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }

  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const nextState = String(body.state || body.status || "").trim().toLowerCase();
  
  const validStates = ['draft', 'production_registered', 'active_in_market', 'deprecating', 'archived'];
  if (!validStates.includes(nextState)) {
    return json({ ok: false, reason: "invalid_state", message: `State must be one of: ${validStates.join(', ')}` }, 400);
  }

  // Transition validation: draft -> production_registered requires keys and carrier profile
  if (nextState === 'production_registered') {
    const keysPresent = Boolean(batch.has_meta_key && batch.has_file_key);
    const profilePresent = Boolean(batch.carrier_profile_code);
    if (!keysPresent || !profilePresent) {
      return json({
        ok: false,
        reason: "missing_requirements",
        message: "Cannot transition to 'production_registered' because batch is missing encrypted keys or carrier profile configuration."
      }, 400);
    }
  }

  if (nextState === "active_in_market" && batch.supplier_sub_batch_id) {
    const supplierRows = await sql/*sql*/`
      SELECT id, expected_quantity, manifest_status, manifest_count, qa_status
      FROM supplier_sub_batches
      WHERE id = ${batch.supplier_sub_batch_id}
      LIMIT 1
    `;
    const supplierSubBatch = supplierRows[0];
    if (supplierSubBatch) {
      const gate = canActivateSupplierSubBatch({
        manifestStatus: supplierSubBatch.manifest_status,
        qaStatus: supplierSubBatch.qa_status,
        expectedQuantity: supplierSubBatch.expected_quantity,
        manifestCount: supplierSubBatch.manifest_count,
      });
      if (!gate.ok) {
        return json({
          ok: false,
          reason: gate.reason,
          message: "Supplier batch cannot enter market until manifest import, quantity match and QA approval are complete.",
          expected: "expected" in gate ? gate.expected : undefined,
          received: "received" in gate ? gate.received : undefined,
        }, 409);
      }
    }
  }

  const updated = await sql/*sql*/`
    UPDATE batches
    SET status = ${nextState}
    WHERE id = ${batch.id}
    RETURNING id, bid, status
  `;

  return json({ ok: true, batch: updated[0] });
}
