import { sql, type SqlExecutor } from "./db";
import { buildSupplierQaVerificationContext } from "./supplier-qa-verification-context";

export type SupplierProductionQaScope = {
  supplier_order_id: string;
  tenant_id: string;
  tenant_slug: string;
  effective_pack_purpose: string;
  supplier_sub_batch_id: string;
  batch_id: string;
  bid: string;
  expected_quantity: number;
  manifest_status: string;
  manifest_count: number;
  manifest_hash: string | null;
  manifest_imported_at: string | null;
  qa_status: string;
  qa_acceptance_scope: string | null;
  release_qa_check_id: string | null;
  manufacturing_state: string | null;
  supplier_sub_batch_status: string;
  batch_status: string;
  key_export_count: number;
  key_exported_at: string | null;
  batch_key_export_count: number;
  batch_key_exported_at: string | null;
  key_fingerprint: string;
  order_carrier_profile_code: string;
  carrier_profile_code: string;
  batch_sdm_config: Record<string, unknown>;
  packaging_governance_status: string;
  packaging_spec_revision: number;
  packaging_spec_hash: string | null;
};

export type SupplierProductionQaManifestUnit = {
  tag_id: string;
  uid_hex: string;
  bid: string;
  unit_metadata: Record<string, unknown>;
};

function normalizeScope(row: Record<string, unknown>): SupplierProductionQaScope {
  return {
    ...(row as unknown as SupplierProductionQaScope),
    supplier_order_id: String(row.supplier_order_id || ""),
    tenant_id: String(row.tenant_id || ""),
    tenant_slug: String(row.tenant_slug || "").toLowerCase(),
    effective_pack_purpose: String(row.effective_pack_purpose || "").toLowerCase(),
    supplier_sub_batch_id: String(row.supplier_sub_batch_id || ""),
    batch_id: String(row.batch_id || ""),
    bid: String(row.bid || "").toUpperCase(),
    expected_quantity: Number(row.expected_quantity || 0),
    manifest_status: String(row.manifest_status || "").toLowerCase(),
    manifest_count: Number(row.manifest_count || 0),
    manifest_hash: row.manifest_hash ? String(row.manifest_hash).toLowerCase() : null,
    manifest_imported_at: row.manifest_imported_at ? String(row.manifest_imported_at) : null,
    qa_status: String(row.qa_status || "").toLowerCase(),
    qa_acceptance_scope: row.qa_acceptance_scope ? String(row.qa_acceptance_scope) : null,
    release_qa_check_id: row.release_qa_check_id ? String(row.release_qa_check_id) : null,
    manufacturing_state: row.manufacturing_state ? String(row.manufacturing_state) : null,
    supplier_sub_batch_status: String(row.supplier_sub_batch_status || "").toLowerCase(),
    batch_status: String(row.batch_status || "").toLowerCase(),
    key_export_count: Number(row.key_export_count || 0),
    key_exported_at: row.key_exported_at ? String(row.key_exported_at) : null,
    batch_key_export_count: Number(row.batch_key_export_count || 0),
    batch_key_exported_at: row.batch_key_exported_at ? String(row.batch_key_exported_at) : null,
    key_fingerprint: String(row.key_fingerprint || "").toUpperCase(),
    order_carrier_profile_code: String(row.order_carrier_profile_code || "").toLowerCase(),
    carrier_profile_code: String(row.carrier_profile_code || "").toLowerCase(),
    batch_sdm_config: row.batch_sdm_config && typeof row.batch_sdm_config === "object"
      ? row.batch_sdm_config as Record<string, unknown>
      : {},
    packaging_governance_status: String(row.packaging_governance_status || "").toLowerCase(),
    packaging_spec_revision: Number(row.packaging_spec_revision || 0),
    packaging_spec_hash: row.packaging_spec_hash ? String(row.packaging_spec_hash).toLowerCase() : null,
  };
}

export async function loadSupplierProductionQaScope(input: {
  supplierOrderId: string;
  bid: string;
  forcedTenantSlug?: string | null;
}, query: SqlExecutor = sql): Promise<SupplierProductionQaScope | null> {
  const forcedTenantSlug = String(input.forcedTenantSlug || "").trim().toLowerCase();
  const rows = await query/*sql*/`
    SELECT
      supplier_order.id AS supplier_order_id,
      supplier_order.tenant_id,
      tenant.slug AS tenant_slug,
      public.nexid_effective_supplier_pack_purpose_v1(supplier_order.id) AS effective_pack_purpose,
      sub_batch.id AS supplier_sub_batch_id,
      sub_batch.batch_id,
      upper(sub_batch.bid) AS bid,
      sub_batch.expected_quantity,
      sub_batch.manifest_status,
      sub_batch.manifest_count,
      sub_batch.manifest_hash,
      to_char(sub_batch.manifest_imported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS manifest_imported_at,
      sub_batch.qa_status,
      sub_batch.qa_acceptance_scope,
      sub_batch.release_qa_check_id,
      sub_batch.manufacturing_state,
      sub_batch.status AS supplier_sub_batch_status,
      sub_batch.key_export_count,
      to_char(sub_batch.key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS key_exported_at,
      batch.status AS batch_status,
      batch.carrier_profile_code,
      batch.sdm_config AS batch_sdm_config,
      batch_key.key_fingerprint,
      batch_key.export_count AS batch_key_export_count,
      to_char(batch_key.exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS batch_key_exported_at,
      supplier_order.carrier_profile_code AS order_carrier_profile_code,
      supplier_order.packaging_governance_status,
      supplier_order.packaging_spec_revision,
      supplier_order.packaging_spec_hash
    FROM supplier_orders supplier_order
    JOIN tenants tenant ON tenant.id = supplier_order.tenant_id
    JOIN supplier_sub_batches sub_batch
      ON sub_batch.supplier_order_id = supplier_order.id
     AND sub_batch.tenant_id = supplier_order.tenant_id
    JOIN batches batch
      ON batch.id = sub_batch.batch_id
     AND batch.tenant_id = sub_batch.tenant_id
     AND upper(batch.bid) = upper(sub_batch.bid)
    JOIN batch_keys batch_key
      ON batch_key.supplier_sub_batch_id = sub_batch.id
     AND batch_key.batch_id = batch.id
     AND batch_key.tenant_id = sub_batch.tenant_id
     AND upper(batch_key.bid) = upper(sub_batch.bid)
     AND batch_key.status = 'active'
    WHERE supplier_order.id = ${input.supplierOrderId}::uuid
      AND upper(sub_batch.bid) = upper(${input.bid})
      AND (${forcedTenantSlug} = '' OR lower(tenant.slug) = ${forcedTenantSlug})
    LIMIT 1
  `;
  return rows[0] ? normalizeScope(rows[0]) : null;
}

export async function loadSupplierProductionQaManifestUnits(input: {
  tenantId: string;
  batchId: string;
  bid: string;
}, query: SqlExecutor = sql): Promise<SupplierProductionQaManifestUnit[]> {
  const rows = await query/*sql*/`
    SELECT
      manifest_tag.id::text AS tag_id,
      upper(manifest_tag.uid_hex) AS uid_hex,
      upper(${input.bid}) AS bid,
      COALESCE(profile.locale_data #> '{manifest,unit_metadata}', '{}'::jsonb) AS unit_metadata
    FROM tags manifest_tag
    JOIN batches batch
      ON batch.id = manifest_tag.batch_id
     AND batch.tenant_id = ${input.tenantId}::uuid
    LEFT JOIN tag_profiles profile ON profile.tag_id = manifest_tag.id
    WHERE manifest_tag.batch_id = ${input.batchId}::uuid
    ORDER BY upper(manifest_tag.uid_hex), manifest_tag.id
  `;
  return rows.map((row) => ({
    tag_id: String(row.tag_id || ""),
    uid_hex: String(row.uid_hex || "").toUpperCase(),
    bid: String(row.bid || "").toUpperCase(),
    unit_metadata: row.unit_metadata && typeof row.unit_metadata === "object"
      ? row.unit_metadata as Record<string, unknown>
      : {},
  }));
}

export function buildSupplierProductionQaVerificationContext(scope: SupplierProductionQaScope) {
  return buildSupplierQaVerificationContext({
    tenantId: scope.tenant_id,
    batchId: scope.batch_id,
    bid: scope.bid,
    manifestHash: scope.manifest_hash,
    carrierProfileCode: scope.carrier_profile_code,
    keyFingerprint: scope.key_fingerprint,
    sdmConfig: scope.batch_sdm_config,
    supplierOrderId: scope.supplier_order_id,
    supplierSubBatchId: scope.supplier_sub_batch_id,
    supplierSubBatchStatus: scope.supplier_sub_batch_status,
    batchStatus: scope.batch_status,
    keyExportCount: scope.key_export_count,
    keyExportedAt: scope.key_exported_at,
    batchKeyExportCount: scope.batch_key_export_count,
    batchKeyExportedAt: scope.batch_key_exported_at,
    packagingGovernanceStatus: scope.packaging_governance_status,
    packagingSpecRevision: scope.packaging_spec_revision,
    packagingSpecHash: scope.packaging_spec_hash,
    packPurpose: scope.effective_pack_purpose,
  });
}
