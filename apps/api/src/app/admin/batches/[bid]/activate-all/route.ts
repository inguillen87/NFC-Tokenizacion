export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin, getAdminTenantScope } from '../../../../../lib/auth';
import { json } from '../../../../../lib/http';
import { sql } from '../../../../../lib/db';
import { ensureSupplierOpsSchema } from '../../../../../lib/supplier-ops-schema';
import { canActivateSupplierSubBatch } from '../../../../../lib/supplier-ops';
import { hashEvidencePayload } from '../../../../../lib/proof-layer';

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req, ['super_admin', 'tenant_admin']);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { bid } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const limit = Math.max(0, Math.trunc(Number(body.limit || 0)));
  const overrideReason = String(body.override_reason || body.overrideReason || '').trim();
  if (overrideReason) {
    return json({
      ok: false,
      reason: 'supplier_activation_override_disabled',
      message: 'Industrial supplier batches cannot bypass manifest and QA gates. Fix the manifest, quantity or QA evidence instead of using override.',
      bid,
    }, 409);
  }

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const batchRows = forcedTenantSlug
    ? await sql`
      SELECT b.id, b.tenant_id, b.status, b.created_at, b.supplier_order_id, b.supplier_sub_batch_id
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql`
      SELECT id, tenant_id, status, created_at, supplier_order_id, supplier_sub_batch_id
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;
  if (batchRows.length > 1) {
    return json({
      ok: false,
      reason: 'DUPLICATE_BID',
      message: 'BID must be globally unique before activating tags.',
      batches: batchRows.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);

  // Validate batch status
  const allowedStatuses = ['production_registered', 'active_in_market', 'active'];
  if (!allowedStatuses.includes(batch.status)) {
    return json({
      ok: false,
      reason: 'invalid_batch_state',
      message: `Cannot activate tags while batch status is '${batch.status}'. Batch status must be 'production_registered' or 'active_in_market'.`
    }, 400);
  }

  const supplierRows = await sql/*sql*/`
    SELECT id, supplier_order_id, bid, expected_quantity, manifest_status, manifest_count, qa_status
    FROM supplier_sub_batches
    WHERE batch_id = ${batch.id} OR bid = ${bid}
    LIMIT 1
  `;
  const supplierSubBatch = supplierRows[0] || null;
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
        message: 'Industrial supplier batch activation is blocked until manifest import, quantity match and QA approval are complete.',
        bid,
        expected: 'expected' in gate ? gate.expected : undefined,
        received: 'received' in gate ? gate.received : undefined,
      }, 409);
    }
  }

  const target = limit > 0
    ? await sql`
        SELECT uid_hex
        FROM tags
        WHERE batch_id = ${batch.id} AND status = 'inactive'
        ORDER BY created_at ASC, uid_hex ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT uid_hex
        FROM tags
        WHERE batch_id = ${batch.id} AND status = 'inactive'
        ORDER BY created_at ASC, uid_hex ASC
      `;

  const uids = target.map((row) => String(row.uid_hex || '')).filter(Boolean);
  const updated = uids.length
    ? await sql`
        UPDATE tags
        SET status = 'active'
        WHERE batch_id = ${batch.id} AND uid_hex = ANY(${uids})
        RETURNING uid_hex
      `
    : [];

  const remaining = await sql`
    SELECT COUNT(*)::int AS count
    FROM tags
    WHERE batch_id = ${batch.id} AND status = 'inactive'
  `;

  if (supplierSubBatch) {
    const remainingInactive = Number(remaining[0]?.count || 0);
    const activationComplete = remainingInactive === 0;
    const supplierStatus = activationComplete ? 'activated' : 'partially_activated';
    await sql/*sql*/`
      UPDATE supplier_sub_batches
      SET status = ${supplierStatus}, activated_at = CASE WHEN ${activationComplete} THEN COALESCE(activated_at, now()) ELSE activated_at END, updated_at = now()
      WHERE id = ${supplierSubBatch.id}
    `;
    if (activationComplete) {
      await sql/*sql*/`
        UPDATE batches
        SET status = 'active_in_market'
        WHERE id = ${batch.id}
      `;
    }
    const eventPayload = {
      supplier_order_id: supplierSubBatch.supplier_order_id,
      supplier_sub_batch_id: supplierSubBatch.id,
      bid,
      activated_tags: updated.length,
      remaining_inactive: remainingInactive,
      activation_complete: activationComplete,
      override: false,
    };
    const eventHash = hashEvidencePayload({
      tenantId: String(batch.tenant_id),
      resourceType: 'supplier_sub_batch',
      resourceId: String(supplierSubBatch.id),
      eventType: activationComplete ? 'batch_activated' : 'batch_partially_activated',
      payload: eventPayload,
    });
    await sql/*sql*/`
      INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
      VALUES (${batch.tenant_id}, 'supplier_sub_batch', ${supplierSubBatch.id}, ${activationComplete ? 'batch_activated' : 'batch_partially_activated'}, ${JSON.stringify(eventPayload)}::jsonb, ${eventHash})
      ON CONFLICT (payload_hash) DO NOTHING
    `;
  }

  return json({
    ok: true,
    batch: bid,
    activated: updated.length,
    remainingInactive: Number(remaining[0]?.count || 0),
    activationComplete: Number(remaining[0]?.count || 0) === 0,
    supplier_gate: supplierSubBatch ? {
      manifest_status: supplierSubBatch.manifest_status,
      qa_status: supplierSubBatch.qa_status,
      expected_quantity: Number(supplierSubBatch.expected_quantity || 0),
      manifest_count: Number(supplierSubBatch.manifest_count || 0),
      override: false,
    } : null,
  });
}
