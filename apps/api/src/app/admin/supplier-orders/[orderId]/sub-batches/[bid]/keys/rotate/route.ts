export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope, type AdminScope } from "../../../../../../../../lib/auth";
import { logAuditEvent } from "../../../../../../../../lib/audit-logger";
import { buildBatchKeyLifecycleRecords } from "../../../../../../../../lib/batch-keys";
import { sql } from "../../../../../../../../lib/db";
import { json } from "../../../../../../../../lib/http";
import { hashEvidencePayload } from "../../../../../../../../lib/proof-layer";
import { ensureSupplierOpsSchema } from "../../../../../../../../lib/supplier-ops-schema";
import { canRotateSupplierSubBatchKeys, generateSupplierBatchKeys } from "../../../../../../../../lib/supplier-ops";

function safeString(value: unknown) {
  return String(value || "").trim();
}

function safeActor(req: Request) {
  return safeString(req.headers.get("x-nexid-actor"))
    || safeString(req.headers.get("x-nexid-actor-id"))
    || safeString(req.headers.get("x-dashboard-user"))
    || safeString(req.headers.get("x-forwarded-user"))
    || "unknown_admin";
}

function parsePermissionHeader(value: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    || scope === "security_operator"
    || hasScopedPermission(permissions, "supplier:key_rotate");
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string; bid: string }> }) {
  const auth = checkAdmin(req, ["super_admin", "security_operator", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const adminTenantScope = getAdminTenantScope(req);
  const permissionGrants = parsePermissionHeader(req.headers.get("x-nexid-permissions"));
  if (!canRotateSupplierKeys(adminTenantScope.scope, permissionGrants)) {
    return json({
      ok: false,
      reason: "supplier_key_rotation_forbidden",
      message: "Supplier key rotation requires superadmin, security-operator scope, or explicit supplier:key_rotate permission.",
    }, 403);
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

  const rows = adminTenantScope.forcedTenantSlug
    ? await sql/*sql*/`
        SELECT
          so.id AS supplier_order_id,
          so.tenant_id,
          so.carrier_profile_code,
          t.slug AS tenant_slug,
          ssb.id AS supplier_sub_batch_id,
          ssb.batch_id,
          ssb.bid,
          ssb.status AS sub_batch_status,
          ssb.manifest_status,
          ssb.manifest_count,
          ssb.qa_status,
          ssb.key_export_count,
          ssb.metadata_json,
          b.status AS batch_status,
          b.sdm_config,
          bk.id AS batch_key_id,
          bk.export_count AS batch_key_export_count,
          bk.key_version AS current_pair_version,
          bk.key_fingerprint AS current_pair_fingerprint,
          COUNT(bkm.id) FILTER (WHERE bkm.status = 'active')::int AS active_material_count,
          COALESCE(MAX(bkm.key_version), 0)::int AS max_key_version,
          COALESCE(
            jsonb_object_agg(bkm.key_role, bkm.key_fingerprint) FILTER (WHERE bkm.status = 'active'),
            '{}'::jsonb
          ) AS active_role_fingerprints
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        JOIN batches b ON b.id = ssb.batch_id
        JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id
        LEFT JOIN batch_key_material bkm ON bkm.supplier_sub_batch_id = ssb.id
        WHERE so.id = ${orderId}::uuid AND ssb.bid = ${bid} AND t.slug = ${adminTenantScope.forcedTenantSlug}
        GROUP BY so.id, t.slug, ssb.id, b.id, bk.id
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT
          so.id AS supplier_order_id,
          so.tenant_id,
          so.carrier_profile_code,
          t.slug AS tenant_slug,
          ssb.id AS supplier_sub_batch_id,
          ssb.batch_id,
          ssb.bid,
          ssb.status AS sub_batch_status,
          ssb.manifest_status,
          ssb.manifest_count,
          ssb.qa_status,
          ssb.key_export_count,
          ssb.metadata_json,
          b.status AS batch_status,
          b.sdm_config,
          bk.id AS batch_key_id,
          bk.export_count AS batch_key_export_count,
          bk.key_version AS current_pair_version,
          bk.key_fingerprint AS current_pair_fingerprint,
          COUNT(bkm.id) FILTER (WHERE bkm.status = 'active')::int AS active_material_count,
          COALESCE(MAX(bkm.key_version), 0)::int AS max_key_version,
          COALESCE(
            jsonb_object_agg(bkm.key_role, bkm.key_fingerprint) FILTER (WHERE bkm.status = 'active'),
            '{}'::jsonb
          ) AS active_role_fingerprints
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        JOIN batches b ON b.id = ssb.batch_id
        JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id
        LEFT JOIN batch_key_material bkm ON bkm.supplier_sub_batch_id = ssb.id
        WHERE so.id = ${orderId}::uuid AND ssb.bid = ${bid}
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

  const actor = safeActor(req);
  const nextVersion = Math.max(1, Math.trunc(Number(subBatch.max_key_version || subBatch.current_pair_version || 1)) + 1);
  const keys = generateSupplierBatchKeys();
  const keyMaterial = buildBatchKeyLifecycleRecords({
    bid: String(subBatch.bid),
    kMetaHex: keys.kMetaHex,
    kFileHex: keys.kFileHex,
    keyVersion: nextVersion,
    createdBy: actor,
  });
  const metaKey = keyMaterial.find((item) => item.keyRole === "K_META_BATCH");
  const fileKey = keyMaterial.find((item) => item.keyRole === "K_FILE_BATCH");
  if (!metaKey || !fileKey) return json({ ok: false, reason: "supplier_batch_key_material_missing" }, 500);

  const rotationMetadata = {
    key_fingerprint: keys.fingerprint,
    key_version: nextVersion,
    rotated_by: actor,
    rotation_reason: rotationReason,
  };
  const writeRows = await sql/*sql*/`
    WITH selected AS MATERIALIZED (
      SELECT
        ssb.id AS supplier_sub_batch_id,
        ssb.batch_id,
        ssb.supplier_order_id,
        ssb.tenant_id,
        ssb.bid,
        ssb.metadata_json,
        b.sdm_config
      FROM supplier_sub_batches ssb
      JOIN batches b ON b.id = ssb.batch_id
      JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id
      WHERE ssb.id = ${subBatch.supplier_sub_batch_id}
        AND ssb.key_export_count = 0
        AND bk.export_count = 0
        AND ssb.manifest_status <> 'imported'
        AND ssb.manifest_count = 0
        AND ssb.qa_status <> 'passed'
        AND ssb.status NOT IN ('activated', 'partially_activated', 'active')
        AND b.status NOT IN ('active', 'active_in_market')
      LIMIT 1
    ),
    rotated AS (
      UPDATE batch_key_material bkm
      SET status = 'rotated',
          rotated_at = now(),
          rotation_reason = ${rotationReason},
          metadata_json = bkm.metadata_json || ${JSON.stringify({
            rotated_by: actor,
            rotated_to_version: nextVersion,
            rotation_reason: rotationReason,
          })}::jsonb,
          updated_at = now()
      FROM selected
      WHERE bkm.supplier_sub_batch_id = selected.supplier_sub_batch_id
        AND bkm.status = 'active'
        AND bkm.export_count = 0
      RETURNING bkm.id, bkm.key_role
    ),
    readiness AS (
      SELECT
        (SELECT COUNT(*)::int FROM selected) = 1
        AND (SELECT COUNT(*)::int FROM rotated) = 2 AS ok
    ),
    inserted AS (
      INSERT INTO batch_key_material (
        tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
        key_role, key_version, encrypted_key_ct, key_fingerprint, status,
        created_by, rotated_from_key_id, rotation_reason, metadata_json
      )
      SELECT
        selected.tenant_id, selected.supplier_order_id, selected.supplier_sub_batch_id,
        selected.batch_id, selected.bid,
        ${metaKey.keyRole}, ${metaKey.keyVersion}, ${metaKey.encryptedKeyCt}, ${metaKey.keyFingerprint},
        ${metaKey.status}, ${metaKey.createdBy},
        (SELECT id FROM rotated WHERE key_role = 'K_META_BATCH' LIMIT 1),
        ${rotationReason},
        ${JSON.stringify({ source: "supplier_key_rotation", pair_fingerprint: keys.fingerprint })}::jsonb
      FROM selected, readiness
      WHERE readiness.ok
      UNION ALL
      SELECT
        selected.tenant_id, selected.supplier_order_id, selected.supplier_sub_batch_id,
        selected.batch_id, selected.bid,
        ${fileKey.keyRole}, ${fileKey.keyVersion}, ${fileKey.encryptedKeyCt}, ${fileKey.keyFingerprint},
        ${fileKey.status}, ${fileKey.createdBy},
        (SELECT id FROM rotated WHERE key_role = 'K_FILE_BATCH' LIMIT 1),
        ${rotationReason},
        ${JSON.stringify({ source: "supplier_key_rotation", pair_fingerprint: keys.fingerprint })}::jsonb
      FROM selected, readiness
      WHERE readiness.ok
      RETURNING id, key_role, key_version, key_fingerprint
    ),
    updated_pair AS (
      UPDATE batch_keys bk
      SET meta_key_ct = ${metaKey.encryptedKeyCt},
          file_key_ct = ${fileKey.encryptedKeyCt},
          key_fingerprint = ${keys.fingerprint},
          key_version = ${nextVersion},
          status = 'active',
          created_by = ${actor},
          rotated_at = now()
      FROM selected, readiness
      WHERE readiness.ok
        AND bk.supplier_sub_batch_id = selected.supplier_sub_batch_id
      RETURNING bk.id
    ),
    updated_batch AS (
      UPDATE batches b
      SET meta_key_ct = ${metaKey.encryptedKeyCt},
          file_key_ct = ${fileKey.encryptedKeyCt},
          sdm_config = COALESCE(b.sdm_config, '{}'::jsonb) || ${JSON.stringify({
            key_version: nextVersion,
            key_rotated_at: new Date().toISOString(),
            key_rotation_policy: "pre_export_only",
          })}::jsonb
      FROM selected, readiness
      WHERE readiness.ok
        AND b.id = selected.batch_id
      RETURNING b.id
    ),
    updated_sub_batch AS (
      UPDATE supplier_sub_batches ssb
      SET metadata_json = COALESCE(ssb.metadata_json, '{}'::jsonb) || ${JSON.stringify(rotationMetadata)}::jsonb,
          updated_at = now()
      FROM selected, readiness
      WHERE readiness.ok
        AND ssb.id = selected.supplier_sub_batch_id
      RETURNING ssb.id
    )
    SELECT
      (SELECT ok FROM readiness) AS ok,
      (SELECT COUNT(*)::int FROM rotated) AS rotated_count,
      (SELECT COUNT(*)::int FROM inserted) AS inserted_count,
      (SELECT COUNT(*)::int FROM updated_pair) AS updated_pair_count,
      (SELECT COUNT(*)::int FROM updated_batch) AS updated_batch_count,
      (SELECT COUNT(*)::int FROM updated_sub_batch) AS updated_sub_batch_count,
      COALESCE((SELECT jsonb_object_agg(key_role, key_fingerprint) FROM inserted), '{}'::jsonb) AS role_key_fingerprints
  `;
  const write = writeRows[0] || {};
  if (write.ok !== true || Number(write.rotated_count || 0) !== 2 || Number(write.inserted_count || 0) !== 2) {
    return json({
      ok: false,
      reason: "supplier_key_rotation_conflict",
      message: "Key rotation was not applied because the sub-batch state changed while the request was running.",
      rotated_count: Number(write.rotated_count || 0),
      inserted_count: Number(write.inserted_count || 0),
    }, 409);
  }

  const eventPayload = {
    supplier_order_id: subBatch.supplier_order_id,
    supplier_sub_batch_id: subBatch.supplier_sub_batch_id,
    bid: subBatch.bid,
    previous_key_version: Number(subBatch.current_pair_version || subBatch.max_key_version || 1),
    new_key_version: nextVersion,
    previous_pair_fingerprint: subBatch.current_pair_fingerprint,
    previous_role_fingerprints: subBatch.active_role_fingerprints || {},
    new_pair_fingerprint: keys.fingerprint,
    new_role_fingerprints: write.role_key_fingerprints || {},
    rotated_by: actor,
    rotation_reason: rotationReason,
  };
  const eventHash = hashEvidencePayload({
    tenantId: String(subBatch.tenant_id),
    resourceType: "supplier_sub_batch",
    resourceId: String(subBatch.supplier_sub_batch_id),
    eventType: "batch_keys_rotated",
    payload: eventPayload,
  });
  await sql/*sql*/`
    INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
    VALUES (${subBatch.tenant_id}, 'supplier_sub_batch', ${subBatch.supplier_sub_batch_id}, 'batch_keys_rotated', ${JSON.stringify(eventPayload)}::jsonb, ${eventHash})
    ON CONFLICT (payload_hash) DO NOTHING
  `;
  await sql/*sql*/`
    INSERT INTO vault_artifacts (
      tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
      artifact_type, content_hash, mime_type, metadata_json
    ) VALUES (
      ${subBatch.tenant_id}, ${subBatch.supplier_order_id}, ${subBatch.supplier_sub_batch_id},
      'supplier_sub_batch', ${subBatch.supplier_sub_batch_id}, 'batch_key_rotation_report',
      ${eventHash}, 'application/json', ${JSON.stringify({
        bid: subBatch.bid,
        key_fingerprint: keys.fingerprint,
        key_version: nextVersion,
        rotation_reason: rotationReason,
        rotated_by: actor,
      })}::jsonb
    )
  `;
  await logAuditEvent({
    actorId: null,
    tenantId: String(subBatch.tenant_id),
    action: "supplier_batch_keys_rotated",
    resourceType: "supplier_sub_batch",
    resourceId: String(subBatch.supplier_sub_batch_id),
    afterData: eventPayload,
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    bid: subBatch.bid,
    key_version: nextVersion,
    key_fingerprint: keys.fingerprint,
    role_key_fingerprints: write.role_key_fingerprints || {},
    evidence_hash: eventHash,
    warning: "Keys rotated before supplier export. Raw K_META_BATCH/K_FILE_BATCH were not returned.",
  });
}
