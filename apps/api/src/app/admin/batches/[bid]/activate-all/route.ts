export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin, getAdminActor, getAdminPermissions, getAdminTenantScope, type AdminScope } from '../../../../../lib/auth';
import { json } from '../../../../../lib/http';
import { sql } from '../../../../../lib/db';
import { ensureSupplierOpsSchema } from '../../../../../lib/supplier-ops-schema';
import { canActivateSupplierSubBatch } from '../../../../../lib/supplier-ops';
import { hashEvidencePayload } from '../../../../../lib/proof-layer';
import { logAuditEvent } from '../../../../../lib/audit-logger';

function hasScopedPermission(grants: string[], permission: string) {
  const current = permission.trim();
  for (const rawGrant of grants) {
    const grant = String(rawGrant || '').trim();
    if (!grant || grant === '*') continue;
    if (grant === current) return true;
    if (grant.endsWith(':*')) {
      const prefix = grant.slice(0, -2);
      if (current === prefix || current.startsWith(`${prefix}:`)) return true;
    }
  }
  return false;
}

function canUseActivationOverride(scope: AdminScope | null, permissions: string[]) {
  return scope === 'super_admin'
    || hasScopedPermission(permissions, 'supplier:activate_override');
}

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = await checkAdmin(req, ['super_admin', 'tenant_admin']);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { bid } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const limit = Math.max(0, Math.trunc(Number(body.limit || 0)));
  const overrideReason = String(body.override_reason || body.overrideReason || '').trim();
  const overrideBy = getAdminActor(req).email;
  const adminTenantScope = getAdminTenantScope(req);
  const permissionGrants = getAdminPermissions(req);
  const overrideRequested = Boolean(overrideReason);
  const overrideAllowed = canUseActivationOverride(adminTenantScope.scope, permissionGrants);
  if (overrideRequested && !overrideAllowed) {
    return json({
      ok: false,
      reason: 'supplier_activation_override_forbidden',
      message: 'Activation overrides require superadmin or explicit supplier:activate_override permission.',
    }, 403);
  }

  const { forcedTenantSlug } = adminTenantScope;
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
  let activationGate: ReturnType<typeof canActivateSupplierSubBatch> | null = null;
  if (supplierSubBatch) {
    activationGate = canActivateSupplierSubBatch({
      manifestStatus: supplierSubBatch.manifest_status,
      qaStatus: supplierSubBatch.qa_status,
      expectedQuantity: supplierSubBatch.expected_quantity,
      manifestCount: supplierSubBatch.manifest_count,
      overrideReason: overrideAllowed ? overrideReason : '',
      overrideBy: overrideAllowed ? overrideBy : '',
    });
    if (!activationGate.ok) {
      return json({
        ok: false,
        reason: activationGate.reason,
        message: activationGate.reason === 'supplier_activation_override_audit_required'
          ? 'Activation override requires override_reason with at least 16 characters and override_by.'
          : 'Industrial supplier batch activation is blocked until manifest import, quantity match and QA approval are complete.',
        bid,
        expected: 'expected' in activationGate ? activationGate.expected : undefined,
        received: 'received' in activationGate ? activationGate.received : undefined,
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
    const overrideAudit = activationGate?.ok === true && activationGate.override ? activationGate : null;
    const eventPayload = {
      supplier_order_id: supplierSubBatch.supplier_order_id,
      supplier_sub_batch_id: supplierSubBatch.id,
      bid,
      activated_tags: updated.length,
      remaining_inactive: remainingInactive,
      activation_complete: activationComplete,
      override: Boolean(overrideAudit),
      override_reason: overrideAudit ? overrideAudit.overrideReason : null,
      override_by: overrideAudit ? overrideAudit.overrideBy : null,
      override_blocked_reasons: overrideAudit ? overrideAudit.blockedReasons : [],
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
    if (overrideAudit) {
      await logAuditEvent({
        actorId: null,
        tenantId: String(batch.tenant_id),
        action: 'supplier_activation_override_used',
        resourceType: 'supplier_sub_batch',
        resourceId: String(supplierSubBatch.id),
        afterData: eventPayload,
        userAgent: req.headers.get('user-agent'),
        requestId: req.headers.get('x-request-id'),
      });
    }
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
      override: Boolean(overrideReason),
    } : null,
  });
}
