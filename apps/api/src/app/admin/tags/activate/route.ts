export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../lib/db";
import { checkAdminWithPermission, getAdminActor, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { logAuditEvent } from "../../../../lib/audit-logger";
import {
  canActivateSupplierSubBatch,
  resolveSupplierActivationScope,
  supplierActivationGateMessage,
} from "../../../../lib/supplier-ops";
import {
  activateSupplierProductionTagsV2,
  loadSupplierProductionActivationReceiptV2,
  supplierProductionActivationDatabaseReason,
  supplierProductionActivationOperationKey,
} from "../../../../lib/supplier-production-activation";

function normalizeUid(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export async function POST(req: Request) {
  const auth = await checkAdminWithPermission(req, "batch.activate");
  if (auth) return auth;
  const operationKey = supplierProductionActivationOperationKey(req);
  if (!operationKey) {
    return json({
      ok: false,
      reason: "supplier_production_activation_idempotency_key_required",
      message: "Idempotency-Key must be 8-128 characters using letters, numbers, dot, underscore, colon or hyphen.",
    }, 400);
  }
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
      SELECT b.id, b.tenant_id, b.status, b.created_at,
        b.supplier_order_id, b.supplier_sub_batch_id
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql/*sql*/`
      SELECT id, tenant_id, status, created_at, supplier_order_id, supplier_sub_batch_id
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
    SELECT sub_batch.id, sub_batch.tenant_id, sub_batch.supplier_order_id,
      sub_batch.batch_id, sub_batch.bid, sub_batch.expected_quantity,
      sub_batch.manifest_status, sub_batch.manifest_count, sub_batch.qa_status,
      sub_batch.pack_purpose AS declared_pack_purpose,
      supplier_order.pack_purpose AS order_pack_purpose,
      COALESCE(purpose_decision.to_purpose, supplier_order.pack_purpose) AS effective_pack_purpose,
      purpose_decision.id AS classification_decision_id
    FROM supplier_sub_batches sub_batch
    LEFT JOIN supplier_orders supplier_order
      ON supplier_order.id = sub_batch.supplier_order_id
     AND supplier_order.tenant_id = sub_batch.tenant_id
    LEFT JOIN supplier_pack_purpose_decisions purpose_decision
      ON purpose_decision.supplier_order_id = supplier_order.id
     AND purpose_decision.tenant_id = supplier_order.tenant_id
    WHERE sub_batch.batch_id = ${batch.id}
       OR (${batch.supplier_sub_batch_id}::uuid IS NOT NULL AND sub_batch.id = ${batch.supplier_sub_batch_id})
       OR (sub_batch.tenant_id = ${batch.tenant_id} AND upper(sub_batch.bid) = upper(${bid}))
    ORDER BY sub_batch.created_at ASC, sub_batch.id ASC
  `;
  const supplierScope = resolveSupplierActivationScope({
    batch: {
      id: batch.id,
      tenantId: batch.tenant_id,
      bid,
      supplierOrderId: batch.supplier_order_id,
      supplierSubBatchId: batch.supplier_sub_batch_id,
    },
    candidates: supplierRows.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      supplier_order_id: row.supplier_order_id,
      batch_id: row.batch_id,
      bid: row.bid,
      expected_quantity: row.expected_quantity,
      manifest_status: row.manifest_status,
      manifest_count: row.manifest_count,
      qa_status: row.qa_status,
      effective_pack_purpose: row.effective_pack_purpose,
      tenantId: row.tenant_id,
      supplierOrderId: row.supplier_order_id,
      batchId: row.batch_id,
      declaredPackPurpose: row.declared_pack_purpose,
      orderPackPurpose: row.order_pack_purpose,
      effectivePackPurpose: row.effective_pack_purpose,
      classificationDecisionId: row.classification_decision_id,
    })),
  });
  if (!supplierScope.ok) {
    return json({
      ok: false,
      reason: supplierScope.reason,
      message: supplierActivationGateMessage(supplierScope.reason),
      bid,
      candidate_count: supplierScope.candidateCount,
    }, 409);
  }
  const supplierSubBatch = supplierScope.supplierSubBatch;
  const productionAcceptanceV2 = supplierSubBatch?.effective_pack_purpose === "production"
    ? await loadSupplierProductionActivationReceiptV2({
        tenantId: String(supplierSubBatch.tenant_id),
        supplierOrderId: String(supplierSubBatch.supplier_order_id),
        supplierSubBatchId: String(supplierSubBatch.id),
        batchId: String(supplierSubBatch.batch_id),
        bid: String(supplierSubBatch.bid),
        lotSize: Number(supplierSubBatch.expected_quantity),
      })
    : null;
  if (supplierSubBatch) {
    const gate = canActivateSupplierSubBatch({
      effectivePackPurpose: supplierSubBatch.effective_pack_purpose,
      productionAcceptanceV2,
      manifestStatus: supplierSubBatch.manifest_status,
      qaStatus: supplierSubBatch.qa_status,
      expectedQuantity: supplierSubBatch.expected_quantity,
      manifestCount: supplierSubBatch.manifest_count,
    });
    if (!gate.ok) {
      return json({
        ok: false,
        reason: gate.reason,
        message: supplierActivationGateMessage(gate.reason),
        bid,
        expected: "expected" in gate ? gate.expected : undefined,
        received: "received" in gate ? gate.received : undefined,
      }, 409);
    }
  }

  let requestedCount: number;
  let activatedUids: string[];
  let remainingInactive: number;
  let activationReceiptId: string | null = null;
  let idempotentReplay = false;
  if (supplierSubBatch?.effective_pack_purpose === "production") {
    const actor = getAdminActor(req);
    const selection = uids.length
      ? { mode: "uids" as const, uids }
      : activateAll
        ? { mode: "all" as const }
        : { mode: "count" as const, limit: Math.max(0, Math.trunc(count)) };
    try {
      const receipt = await activateSupplierProductionTagsV2({
        tenantId: String(supplierSubBatch.tenant_id),
        supplierOrderId: String(supplierSubBatch.supplier_order_id),
        supplierSubBatchId: String(supplierSubBatch.id),
        batchId: String(supplierSubBatch.batch_id),
        bid: String(supplierSubBatch.bid),
        lotSize: Number(supplierSubBatch.expected_quantity),
        actorId: actor.id,
        authSessionId: actor.sessionId,
        operationKey,
        selection,
        requestId: req.headers.get("x-request-id"),
      });
      requestedCount = receipt.requestedCount;
      activatedUids = receipt.activatedUids;
      remainingInactive = receipt.remainingInactive;
      activationReceiptId = receipt.activationReceiptId;
      idempotentReplay = receipt.idempotentReplay;
    } catch (error) {
      const reason = supplierProductionActivationDatabaseReason(error);
      if (!reason) throw error;
      return json({
        ok: false,
        reason,
        message: supplierActivationGateMessage(reason),
        bid,
      }, reason === "supplier_production_activation_actor_scope_invalid" ? 403 : 409);
    }
  } else {
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
    requestedCount = targetUids.length;
    activatedUids = updated.map((row) => String(row.uid_hex || "")).filter(Boolean);
    remainingInactive = Number(remaining[0]?.count || 0);
    await logAuditEvent({
      actorId: getAdminActor(req).id,
      tenantId: String(batch.tenant_id),
      action: "supplier_tags_activated",
      resourceType: "batch",
      resourceId: String(batch.id),
      afterData: {
        bid,
        requested_count: requestedCount,
        activated_count: activatedUids.length,
        remaining_inactive: remainingInactive,
        activated_by: getAdminActor(req).email,
      },
      requestId: req.headers.get("x-request-id"),
    });
  }

  return json({
    ok: true,
    batch: bid,
    requested: requestedCount,
    activated: activatedUids.length,
    uids: activatedUids,
    remainingInactive,
    activationReceiptId,
    idempotentReplay,
    supplier_gate: supplierSubBatch ? {
      manifest_status: supplierSubBatch.manifest_status,
      qa_status: supplierSubBatch.qa_status,
      expected_quantity: Number(supplierSubBatch.expected_quantity || 0),
      manifest_count: Number(supplierSubBatch.manifest_count || 0),
      effective_pack_purpose: supplierSubBatch.effective_pack_purpose,
    } : null,
  });
}
