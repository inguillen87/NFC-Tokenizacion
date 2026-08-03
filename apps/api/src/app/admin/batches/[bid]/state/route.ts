export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminActor, getAdminTenantScope } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import {
  canActivateSupplierSubBatch,
  resolveSupplierActivationScope,
  supplierActivationGateMessage,
} from "../../../../../lib/supplier-ops";
import {
  activateSupplierProductionTagsV2,
  loadSupplierProductionActivationReceiptV2,
  supplierProductionActivationDatabaseReason,
  supplierProductionActivationOperationKey,
} from "../../../../../lib/supplier-production-activation";

export async function PATCH(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = await checkAdminWithPermission(req, "batch.lifecycle");
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

  let productionSupplierSubBatch: Record<string, unknown> | null = null;
  if (nextState === "active_in_market") {
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
          expected: "expected" in gate ? gate.expected : undefined,
          received: "received" in gate ? gate.received : undefined,
        }, 409);
      }
      if (supplierSubBatch.effective_pack_purpose === "production") {
        productionSupplierSubBatch = supplierSubBatch;
      }
    }
  }

  if (productionSupplierSubBatch) {
    const actor = getAdminActor(req);
    try {
      const receipt = await activateSupplierProductionTagsV2({
        tenantId: String(productionSupplierSubBatch.tenant_id),
        supplierOrderId: String(productionSupplierSubBatch.supplier_order_id),
        supplierSubBatchId: String(productionSupplierSubBatch.id),
        batchId: String(productionSupplierSubBatch.batch_id),
        bid: String(productionSupplierSubBatch.bid),
        lotSize: Number(productionSupplierSubBatch.expected_quantity),
        actorId: actor.id,
        authSessionId: actor.sessionId,
        operationKey,
        selection: { mode: "state_only" },
        requestId: req.headers.get("x-request-id"),
      });
      return json({
        ok: true,
        batch: { id: batch.id, bid, status: "active_in_market" },
        activationReceiptId: receipt.activationReceiptId,
        idempotentReplay: receipt.idempotentReplay,
      });
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
  }

  let updated: Array<Record<string, unknown>>;
  try {
    updated = await sql/*sql*/`
      UPDATE batches
      SET status = ${nextState}
      WHERE id = ${batch.id}
      RETURNING id, bid, status
    `;
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

  return json({ ok: true, batch: updated[0] });
}
