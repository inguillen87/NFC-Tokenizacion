export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminActor, getAdminPermissions, getAdminTenantScope, type AdminScope } from "../../../../../../../../lib/auth";
import { assertBatchKeyEnvelopeContext, buildBatchKeyLifecycleRecords } from "../../../../../../../../lib/batch-keys";
import { sql } from "../../../../../../../../lib/db";
import { json } from "../../../../../../../../lib/http";
import {
  hasSupplierKeyRotationV2,
  rotateSupplierBatchKeysV2,
  SUPPLIER_KEY_ROTATION_V2_MIGRATION,
  supplierKeyRotationError,
} from "../../../../../../../../lib/supplier-key-rotation";
import { canRotateSupplierSubBatchKeys, generateSupplierBatchKeys } from "../../../../../../../../lib/supplier-ops";

function safeString(value: unknown) {
  return String(value || "").trim();
}

function hasScopedPermission(grants: string[], permission: string) {
  const current = permission.trim();
  for (const rawGrant of grants) {
    const grant = String(rawGrant || "").trim();
    if (!grant || grant === "*") continue;
    if (grant === current) return true;
    if (grant.endsWith(":*")) {
      const prefix = grant.slice(0, -2);
      if (current === prefix || current.startsWith(`${prefix}:`)) return true;
    }
  }
  return false;
}

function canRotateSupplierKeys(scope: AdminScope | null, permissions: string[]) {
  return scope === "super_admin"
    || hasScopedPermission(permissions, "supplier:key_rotate");
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string; bid: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;

  const adminTenantScope = getAdminTenantScope(req);
  const permissionGrants = getAdminPermissions(req);
  if (!canRotateSupplierKeys(adminTenantScope.scope, permissionGrants)) {
    return json({
      ok: false,
      reason: "supplier_key_rotation_forbidden",
      message: "Supplier key rotation requires superadmin or explicit supplier:key_rotate permission.",
    }, 403);
  }

  // This probe must precede all 0074-dependent reads and writes so a rolling
  // deployment fails closed instead of parsing unavailable schema objects.
  if (!await hasSupplierKeyRotationV2()) {
    return json({
      ok: false,
      reason: "supplier_key_rotation_v2_migration_required",
      requiredMigration: SUPPLIER_KEY_ROTATION_V2_MIGRATION,
    }, 503);
  }

  const { orderId, bid } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rotationReason = safeString(body.reason || body.rotation_reason || body.rotationReason);
  if (rotationReason.length < 12) {
    return json({
      ok: false,
      reason: "supplier_key_rotation_reason_required",
      message: "A rotation reason with at least 12 characters is required for audit.",
    }, 400);
  }

  // This read exists only to build context-bound software envelopes in the
  // application process. The 0074 writer treats every value as an expectation,
  // locks the authoritative rows and revalidates all gates before mutation.
  const rows = adminTenantScope.forcedTenantSlug
    ? await sql/*sql*/`
        SELECT
          so.id AS supplier_order_id,
          so.tenant_id,
          t.slug AS tenant_slug,
          ssb.id AS supplier_sub_batch_id,
          ssb.batch_id,
          ssb.bid,
          ssb.status AS sub_batch_status,
          ssb.manifest_status,
          ssb.manifest_count,
          ssb.qa_status,
          ssb.key_export_count,
          b.status AS batch_status,
          bk.id AS batch_key_id,
          bk.export_count AS batch_key_export_count,
          bk.key_version AS current_pair_version,
          bk.key_fingerprint AS current_pair_fingerprint,
          COUNT(bkm.id) FILTER (WHERE bkm.status = 'active')::int AS active_material_count,
          COALESCE(MAX(bkm.key_version), 0)::int AS max_key_version,
          COALESCE(jsonb_object_agg(bkm.key_role, bkm.key_fingerprint)
            FILTER (WHERE bkm.status = 'active'), '{}'::jsonb) AS active_role_fingerprints
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id AND ssb.tenant_id = so.tenant_id
        JOIN batches b ON b.id = ssb.batch_id AND b.tenant_id = ssb.tenant_id
        JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id AND bk.tenant_id = ssb.tenant_id
        LEFT JOIN batch_key_material bkm ON bkm.supplier_sub_batch_id = ssb.id AND bkm.tenant_id = ssb.tenant_id
        WHERE so.id = ${orderId}::uuid
          AND upper(ssb.bid) = upper(${bid})
          AND t.slug = ${adminTenantScope.forcedTenantSlug}
        GROUP BY so.id, t.slug, ssb.id, b.id, bk.id
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT
          so.id AS supplier_order_id,
          so.tenant_id,
          t.slug AS tenant_slug,
          ssb.id AS supplier_sub_batch_id,
          ssb.batch_id,
          ssb.bid,
          ssb.status AS sub_batch_status,
          ssb.manifest_status,
          ssb.manifest_count,
          ssb.qa_status,
          ssb.key_export_count,
          b.status AS batch_status,
          bk.id AS batch_key_id,
          bk.export_count AS batch_key_export_count,
          bk.key_version AS current_pair_version,
          bk.key_fingerprint AS current_pair_fingerprint,
          COUNT(bkm.id) FILTER (WHERE bkm.status = 'active')::int AS active_material_count,
          COALESCE(MAX(bkm.key_version), 0)::int AS max_key_version,
          COALESCE(jsonb_object_agg(bkm.key_role, bkm.key_fingerprint)
            FILTER (WHERE bkm.status = 'active'), '{}'::jsonb) AS active_role_fingerprints
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id AND ssb.tenant_id = so.tenant_id
        JOIN batches b ON b.id = ssb.batch_id AND b.tenant_id = ssb.tenant_id
        JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id AND bk.tenant_id = ssb.tenant_id
        LEFT JOIN batch_key_material bkm ON bkm.supplier_sub_batch_id = ssb.id AND bkm.tenant_id = ssb.tenant_id
        WHERE so.id = ${orderId}::uuid AND upper(ssb.bid) = upper(${bid})
        GROUP BY so.id, t.slug, ssb.id, b.id, bk.id
        LIMIT 1
      `;

  const subBatch = rows[0];
  if (!subBatch) return json({ ok: false, reason: "supplier_sub_batch_not_found" }, 404);

  const gate = canRotateSupplierSubBatchKeys({
    keyExportCount: subBatch.key_export_count,
    batchKeyExportCount: subBatch.batch_key_export_count,
    manifestStatus: subBatch.manifest_status,
    manifestCount: subBatch.manifest_count,
    qaStatus: subBatch.qa_status,
    subBatchStatus: subBatch.sub_batch_status,
    batchStatus: subBatch.batch_status,
  });
  if (!gate.ok) {
    return json({
      ok: false,
      reason: gate.reason,
      message: "Supplier sub-batch keys can only rotate before factory export, manifest import, QA pass or activation.",
      gate,
    }, 409);
  }
  if (Number(subBatch.active_material_count || 0) !== 2) {
    return json({
      ok: false,
      reason: "supplier_active_key_material_incomplete",
      message: "Exactly one active K_META_BATCH and one active K_FILE_BATCH are required before rotation.",
      active_material_count: Number(subBatch.active_material_count || 0),
    }, 409);
  }

  const actor = getAdminActor(req);
  const currentVersion = Number(subBatch.current_pair_version || 0);
  const nextVersion = Math.max(1, Math.trunc(currentVersion) + 1);
  const keys = generateSupplierBatchKeys();
  const keyMaterial = buildBatchKeyLifecycleRecords({
    tenantId: String(subBatch.tenant_id),
    bid: String(subBatch.bid),
    kMetaHex: keys.kMetaHex,
    kFileHex: keys.kFileHex,
    keyVersion: nextVersion,
    createdBy: actor.email,
  });
  const metaKey = keyMaterial.find((item) => item.keyRole === "K_META_BATCH");
  const fileKey = keyMaterial.find((item) => item.keyRole === "K_FILE_BATCH");
  if (!metaKey || !fileKey) return json({ ok: false, reason: "supplier_batch_key_material_missing" }, 500);

  // The plaintext keys never cross this boundary. Validate their authenticated
  // envelope context before sending only ciphertext and non-secret fingerprints.
  assertBatchKeyEnvelopeContext(metaKey.encryptedKeyCt, {
    tenantId: String(subBatch.tenant_id), bid: String(subBatch.bid), role: metaKey.keyRole, keyVersion: nextVersion,
  });
  assertBatchKeyEnvelopeContext(fileKey.encryptedKeyCt, {
    tenantId: String(subBatch.tenant_id), bid: String(subBatch.bid), role: fileKey.keyRole, keyVersion: nextVersion,
  });

  try {
    const receipt = await rotateSupplierBatchKeysV2({
      tenantId: String(subBatch.tenant_id),
      supplierOrderId: String(subBatch.supplier_order_id),
      supplierSubBatchId: String(subBatch.supplier_sub_batch_id),
      batchId: String(subBatch.batch_id),
      bid: String(subBatch.bid),
      expectedTenantSlug: adminTenantScope.forcedTenantSlug || null,
      expectedPairId: String(subBatch.batch_key_id),
      expectedPairVersion: currentVersion,
      expectedPairFingerprint: String(subBatch.current_pair_fingerprint),
      expectedMetaKeyFingerprint: String((subBatch.active_role_fingerprints as Record<string, unknown>)?.K_META_BATCH || ""),
      expectedFileKeyFingerprint: String((subBatch.active_role_fingerprints as Record<string, unknown>)?.K_FILE_BATCH || ""),
      nextKeyVersion: nextVersion,
      newPairFingerprint: keys.fingerprint,
      metaEncryptedKeyCt: metaKey.encryptedKeyCt,
      fileEncryptedKeyCt: fileKey.encryptedKeyCt,
      metaKeyFingerprint: metaKey.keyFingerprint,
      fileKeyFingerprint: fileKey.keyFingerprint,
      actorId: actor.id,
      actorEmail: actor.email,
      rotationReason,
      userAgent: req.headers.get("user-agent"),
      requestId: req.headers.get("x-request-id"),
    });
    return json({
      ok: true,
      bid: receipt.bid,
      key_version: receipt.newKeyVersion,
      key_fingerprint: receipt.newPairFingerprint,
      role_key_fingerprints: receipt.newRoleFingerprints,
      evidence_hash: receipt.evidenceEventHash,
      warning: "Keys rotated before supplier export. Raw K_META_BATCH/K_FILE_BATCH were not returned.",
    });
  } catch (error) {
    const normalized = supplierKeyRotationError(error);
    return json({
      ok: false,
      reason: normalized.reason,
      ...(normalized.requiredMigration ? { requiredMigration: normalized.requiredMigration } : {}),
      message: normalized.status === 409
        ? "Key rotation was not applied because the locked sub-batch state is no longer eligible."
        : "Supplier key rotation could not be committed atomically.",
    }, normalized.status);
  }
}
