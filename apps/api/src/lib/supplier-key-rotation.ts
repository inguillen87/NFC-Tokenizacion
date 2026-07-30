import { sql } from "./db";

export const SUPPLIER_KEY_ROTATION_V2_MIGRATION =
  "20260730150000_0074_supplier_key_rotation_atomic.sql";

export type SupplierKeyRotationInput = {
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  expectedTenantSlug: string | null;
  expectedPairId: string;
  expectedPairVersion: number;
  expectedPairFingerprint: string;
  expectedMetaKeyFingerprint: string;
  expectedFileKeyFingerprint: string;
  nextKeyVersion: number;
  newPairFingerprint: string;
  metaEncryptedKeyCt: string;
  fileEncryptedKeyCt: string;
  metaKeyFingerprint: string;
  fileKeyFingerprint: string;
  actorId: string;
  actorEmail: string;
  rotationReason: string;
  userAgent: string | null;
  requestId: string | null;
};

export type SupplierKeyRotationReceipt = {
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  previousKeyVersion: number;
  newKeyVersion: number;
  previousPairFingerprint: string;
  previousRoleFingerprints: Record<string, string>;
  newPairFingerprint: string;
  newRoleFingerprints: Record<string, string>;
  evidenceEventHash: string;
  counts: {
    rotatedMaterial: number;
    insertedMaterial: number;
    updatedPair: number;
    updatedBatch: number;
    updatedSubBatch: number;
  };
};

/** Rolling-safe: it resolves only object names that pre-0074 databases know. */
export async function hasSupplierKeyRotationV2(query: typeof sql = sql) {
  const rows = await query/*sql*/`
    SELECT
      to_regprocedure('public.nexid_rotate_supplier_batch_keys_v2(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_key_rotation_v2_capability()') IS NOT NULL
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_rotate_supplier_batch_keys_v2(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_supplier_key_rotation_v2_capability()'),
        'EXECUTE'
      ), false) AS available
  `;
  return rows[0]?.available === true;
}

export async function rotateSupplierBatchKeysV2(
  input: SupplierKeyRotationInput,
  query: typeof sql = sql,
): Promise<SupplierKeyRotationReceipt> {
  const payload = {
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    batch_id: input.batchId,
    bid: input.bid,
    expected_tenant_slug: input.expectedTenantSlug,
    expected_pair_id: input.expectedPairId,
    expected_pair_version: input.expectedPairVersion,
    expected_pair_fingerprint: input.expectedPairFingerprint,
    expected_meta_key_fingerprint: input.expectedMetaKeyFingerprint,
    expected_file_key_fingerprint: input.expectedFileKeyFingerprint,
    next_key_version: input.nextKeyVersion,
    new_pair_fingerprint: input.newPairFingerprint,
    meta_encrypted_key_ct: input.metaEncryptedKeyCt,
    file_encrypted_key_ct: input.fileEncryptedKeyCt,
    meta_key_fingerprint: input.metaKeyFingerprint,
    file_key_fingerprint: input.fileKeyFingerprint,
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    rotation_reason: input.rotationReason,
    user_agent: input.userAgent,
    request_id: input.requestId,
  };
  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_rotate_supplier_batch_keys_v2(${JSON.stringify(payload)}::jsonb)
  `;
  const row = rows[0];
  if (!row) throw new Error("supplier_key_rotation_readback_failed");
  const counts = {
    rotatedMaterial: Number(row.rotated_material_count || 0),
    insertedMaterial: Number(row.inserted_material_count || 0),
    updatedPair: Number(row.updated_pair_count || 0),
    updatedBatch: Number(row.updated_batch_count || 0),
    updatedSubBatch: Number(row.updated_sub_batch_count || 0),
  };
  const returnedTenantId = String(row.tenant_id || "").toLowerCase();
  const returnedSupplierOrderId = String(row.supplier_order_id || "").toLowerCase();
  const returnedSupplierSubBatchId = String(row.supplier_sub_batch_id || "").toLowerCase();
  const returnedBatchId = String(row.batch_id || "").toLowerCase();
  const returnedBid = String(row.bid || "").toUpperCase();
  const previousKeyVersion = Number(row.previous_key_version || 0);
  const newKeyVersion = Number(row.new_key_version || 0);
  const previousPairFingerprint = String(row.previous_pair_fingerprint || "").toUpperCase();
  const previousRoleFingerprints = (row.previous_role_fingerprints || {}) as Record<string, unknown>;
  const newPairFingerprint = String(row.new_pair_fingerprint || "").toUpperCase();
  const newRoleFingerprints = (row.new_role_fingerprints || {}) as Record<string, unknown>;
  const evidenceEventHash = String(row.evidence_event_hash || "").toLowerCase();
  if (
    counts.rotatedMaterial !== 2
    || counts.insertedMaterial !== 2
    || counts.updatedPair !== 1
    || counts.updatedBatch !== 1
    || counts.updatedSubBatch !== 1
    || returnedTenantId !== input.tenantId.toLowerCase()
    || returnedSupplierOrderId !== input.supplierOrderId.toLowerCase()
    || returnedSupplierSubBatchId !== input.supplierSubBatchId.toLowerCase()
    || returnedBatchId !== input.batchId.toLowerCase()
    || returnedBid !== input.bid.toUpperCase()
    || previousKeyVersion !== input.expectedPairVersion
    || newKeyVersion !== input.nextKeyVersion
    || previousPairFingerprint !== input.expectedPairFingerprint.toUpperCase()
    || String(previousRoleFingerprints.K_META_BATCH || "").toUpperCase() !== input.expectedMetaKeyFingerprint.toUpperCase()
    || String(previousRoleFingerprints.K_FILE_BATCH || "").toUpperCase() !== input.expectedFileKeyFingerprint.toUpperCase()
    || newPairFingerprint !== input.newPairFingerprint.toUpperCase()
    || String(newRoleFingerprints.K_META_BATCH || "").toUpperCase() !== input.metaKeyFingerprint.toUpperCase()
    || String(newRoleFingerprints.K_FILE_BATCH || "").toUpperCase() !== input.fileKeyFingerprint.toUpperCase()
    || !/^sha256:[0-9a-f]{64}$/.test(evidenceEventHash)
  ) {
    throw new Error("supplier_key_rotation_readback_invalid");
  }
  return {
    tenantId: returnedTenantId,
    supplierOrderId: returnedSupplierOrderId,
    supplierSubBatchId: returnedSupplierSubBatchId,
    batchId: returnedBatchId,
    bid: returnedBid,
    previousKeyVersion,
    newKeyVersion,
    previousPairFingerprint,
    previousRoleFingerprints: previousRoleFingerprints as Record<string, string>,
    newPairFingerprint,
    newRoleFingerprints: newRoleFingerprints as Record<string, string>,
    evidenceEventHash,
    counts,
  };
}

const CONFLICT_REASONS = new Set([
  "supplier_key_rotation_active_material_invalid",
  "supplier_key_rotation_batch_conflict",
  "supplier_key_rotation_exported",
  "supplier_key_rotation_insert_conflict",
  "supplier_key_rotation_manifest_imported",
  "supplier_key_rotation_material_conflict",
  "supplier_key_rotation_pair_changed",
  "supplier_key_rotation_pair_conflict",
  "supplier_key_rotation_qa_passed",
  "supplier_key_rotation_state_ineligible",
  "supplier_key_rotation_sub_batch_conflict",
]);

const BAD_INPUT_REASONS = new Set([
  "supplier_key_rotation_identity_invalid",
  "supplier_key_rotation_key_material_unchanged",
  "supplier_key_rotation_payload_invalid",
  "supplier_key_rotation_version_invalid",
]);

export function supplierKeyRotationError(error: unknown): {
  status: number;
  reason: string;
  requiredMigration?: string;
} {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  const knownConflict = [...CONFLICT_REASONS].find((reason) => message.includes(reason));
  if (knownConflict) return { status: 409, reason: knownConflict };
  const knownBadInput = [...BAD_INPUT_REASONS].find((reason) => message.includes(reason));
  if (knownBadInput) return { status: 400, reason: knownBadInput };
  if (message.includes("supplier_key_rotation_tenant_scope_mismatch")) {
    return { status: 403, reason: "supplier_key_rotation_tenant_scope_mismatch" };
  }
  if (message.includes("supplier_key_rotation_scope_not_found") || code === "P0002") {
    return { status: 404, reason: "supplier_key_rotation_scope_not_found" };
  }
  if (code === "42501") {
    return { status: 503, reason: "supplier_key_rotation_runtime_grant_required" };
  }
  if (
    code === "42P01"
    || code === "42703"
    || code === "42883"
    || message.includes("nexid_rotate_supplier_batch_keys_v2")
    || message.includes("nexid_supplier_key_rotation_v2_capability")
  ) {
    return {
      status: 503,
      reason: "supplier_key_rotation_v2_migration_required",
      requiredMigration: SUPPLIER_KEY_ROTATION_V2_MIGRATION,
    };
  }
  return { status: 503, reason: "supplier_key_rotation_unavailable" };
}
