export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../lib/db";
import { checkAdmin, getAdminActor, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { canActivateSupplierSubBatch } from "../../../../lib/supplier-ops";
import { hashEvidencePayload } from "../../../../lib/proof-layer";
import { logAuditEvent } from "../../../../lib/audit-logger";

function normalizeUid(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const bid = String(body.bid || body.batchId || "").trim();
  const uids = Array.isArray(body.uids)
    ? body.uids.map(normalizeUid).filter(Boolean)
    : String(body.uids || "")
        .split(/[\s,\n]+/)
        .map(normalizeUid)
        .filter(Boolean);
  const count = Number(body.count || body.quantity || 0);
  const activateAll = body.all === true;

  if (!bid || (!uids.length && count <= 0 && !activateAll)) {
    return json({ ok: false, reason: "bid and either uids, quantity/count, or all=true required" }, 400);
  }

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const batchRows = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.tenant_id, b.status, b.created_at
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql/*sql*/`
      SELECT id, tenant_id, status, created_at
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;
  if (batchRows.length > 1) {
    return json({
      ok: false,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique before activating individual tags.",
      batches: batchRows.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

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
        message: "Industrial supplier tags cannot be activated until manifest import, quantity match and QA approval are complete.",
        bid,
        expected: "expected" in gate ? gate.expected : undefined,
        received: "received" in gate ? gate.received : undefined,
      }, 409);
    }
  }

  let targetUids = Array.from(new Set(uids));
  if (!targetUids.length && (count > 0 || activateAll)) {
    const candidates = activateAll
      ? await sql/*sql*/`
          SELECT uid_hex
          FROM tags
          WHERE batch_id = ${batch.id} AND status = 'inactive'
          ORDER BY created_at ASC, uid_hex ASC
        `
      : await sql/*sql*/`
          SELECT uid_hex
          FROM tags
          WHERE batch_id = ${batch.id} AND status = 'inactive'
          ORDER BY created_at ASC, uid_hex ASC
          LIMIT ${Math.max(0, Math.trunc(count))}
        `;
    targetUids = candidates.map((row) => String(row.uid_hex || "")).filter(Boolean);
  }

  if (!targetUids.length) {
    return json({ ok: false, reason: "no tags available to activate" }, 400);
  }

  const updated = await sql/*sql*/`
    UPDATE tags
    SET status = 'active'
    WHERE batch_id = ${batch.id} AND uid_hex = ANY(${targetUids})
    RETURNING uid_hex
  `;

  const remaining = await sql/*sql*/`
    SELECT COUNT(*)::int AS count
    FROM tags
    WHERE batch_id = ${batch.id} AND status = 'inactive'
  `;

  if (supplierSubBatch && updated.length) {
    const eventPayload = {
      supplier_order_id: supplierSubBatch.supplier_order_id,
      supplier_sub_batch_id: supplierSubBatch.id,
      bid,
      activated_tags: updated.length,
      uid_count: updated.length,
    };
    const eventHash = hashEvidencePayload({
      tenantId: String(batch.tenant_id),
      resourceType: "supplier_sub_batch",
      resourceId: String(supplierSubBatch.id),
      eventType: "tag_activated",
      payload: eventPayload,
    });
    await sql/*sql*/`
      INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
      VALUES (${batch.tenant_id}, 'supplier_sub_batch', ${supplierSubBatch.id}, 'tag_activated', ${JSON.stringify(eventPayload)}::jsonb, ${eventHash})
      ON CONFLICT (payload_hash) DO NOTHING
    `;
    await logAuditEvent({
      actorId: null,
      tenantId: String(batch.tenant_id),
      action: "supplier_tags_activated",
      resourceType: "supplier_sub_batch",
      resourceId: String(supplierSubBatch.id),
      afterData: {
        ...eventPayload,
        activated_by: getAdminActor(req).email,
      },
      userAgent: req.headers.get("user-agent"),
      requestId: req.headers.get("x-request-id"),
    });
  }

  return json({
    ok: true,
    batch: bid,
    requested: targetUids.length,
    activated: updated.length,
    uids: updated.map((row) => row.uid_hex),
    remainingInactive: Number(remaining[0]?.count || 0),
    supplier_gate: supplierSubBatch ? {
      manifest_status: supplierSubBatch.manifest_status,
      qa_status: supplierSubBatch.qa_status,
      expected_quantity: Number(supplierSubBatch.expected_quantity || 0),
      manifest_count: Number(supplierSubBatch.manifest_count || 0),
    } : null,
  });
}
