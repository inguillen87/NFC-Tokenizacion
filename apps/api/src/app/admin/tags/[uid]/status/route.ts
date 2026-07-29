export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import { canActivateSupplierSubBatch } from "../../../../../lib/supplier-ops";

export async function PATCH(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { uid } = await params;
  const { forcedTenantSlug } = getAdminTenantScope(req);

  const tagRows = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT t.id, t.status, b.status AS batch_status, b.id AS batch_id, b.tenant_id
      FROM tags t
      JOIN batches b ON b.id = t.batch_id
      JOIN tenants tn ON tn.id = b.tenant_id
      WHERE t.uid_hex = ${uid.toUpperCase()} AND tn.slug = ${forcedTenantSlug}
      LIMIT 1
    `
    : await sql/*sql*/`
      SELECT t.id, t.status, b.status AS batch_status, b.id AS batch_id, b.tenant_id
      FROM tags t
      JOIN batches b ON b.id = t.batch_id
      WHERE t.uid_hex = ${uid.toUpperCase()}
      LIMIT 1
    `;

  const tag = tagRows[0];
  if (!tag) return json({ ok: false, reason: "tag not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const nextStatus = String(body.status || "").trim().toLowerCase();

  const validStatuses = ['inactive', 'active', 'suspended', 'revoked'];
  if (!validStatuses.includes(nextStatus)) {
    return json({ ok: false, reason: "invalid_status", message: `Status must be one of: ${validStatuses.join(', ')}` }, 400);
  }

  const currentStatus = tag.status;

  // Once revoked, a tag cannot change state
  if (currentStatus === 'revoked') {
    return json({ ok: false, reason: "tag_already_revoked", message: "Tag is permanently revoked and cannot change state." }, 400);
  }

  // Can only transition from inactive -> active
  if (currentStatus === 'inactive' && nextStatus !== 'active') {
    return json({ ok: false, reason: "invalid_transition", message: "Inactive tags can only transition to active." }, 400);
  }

  // Can transition from active -> suspended or revoked
  if (currentStatus === 'active' && !['suspended', 'revoked'].includes(nextStatus)) {
    return json({ ok: false, reason: "invalid_transition", message: "Active tags can only transition to suspended or revoked." }, 400);
  }

  // Can transition from suspended -> active or revoked
  if (currentStatus === 'suspended' && nextStatus !== 'active' && nextStatus !== 'revoked') {
    return json({ ok: false, reason: "invalid_transition", message: "Suspended tags can only transition to active or revoked." }, 400);
  }

  // Additional check if activating: batch must be active/registered
  if (nextStatus === 'active') {
    const allowedStatuses = ['production_registered', 'active_in_market', 'active'];
    if (!allowedStatuses.includes(tag.batch_status)) {
      return json({
        ok: false,
        reason: 'invalid_batch_state',
        message: `Cannot activate tag because batch status is '${tag.batch_status}'.`
      }, 400);
    }
    const supplierRows = await sql/*sql*/`
      SELECT id, bid, expected_quantity, manifest_status, manifest_count, qa_status
      FROM supplier_sub_batches
      WHERE batch_id = ${tag.batch_id}
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
          message: "Industrial supplier tag activation is blocked until manifest import, quantity match and QA approval are complete.",
          bid: supplierSubBatch.bid,
          expected: "expected" in gate ? gate.expected : undefined,
          received: "received" in gate ? gate.received : undefined,
        }, 409);
      }
    }
  }

  const updated = await sql/*sql*/`
    UPDATE tags
    SET status = ${nextStatus}
    WHERE id = ${tag.id}
    RETURNING id, uid_hex, status
  `;

  return json({ ok: true, tag: updated[0] });
}
