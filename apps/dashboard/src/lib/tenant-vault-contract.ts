export type TenantVaultArtifact = {
  id: string | null;
  supplier_order_id: string | null;
  supplier_sub_batch_id: string | null;
  folder: "exports" | "manifests" | "qa-reports" | "proofs";
  artifact_type: string;
  content_hash: string | null;
  mime_type: string | null;
  encrypted: boolean;
  status: string;
  created_at: string | null;
  metadata: Record<string, string | number | boolean>;
  download: {
    available: boolean;
    reason: string | null;
    count: number;
    last_downloaded_at: string | null;
    href?: string;
    method?: "POST";
  };
  delivery?: { status: string; attempt_count: number; last_attempt_at: string | null };
};

export type TenantVaultSubBatch = {
  id: string;
  bid: string;
  sequence_index: number;
  expected_quantity: number;
  manifest_count: number;
  manifest_hash: string | null;
  manifest_status: string;
  qa_status: string;
  status: string;
  active_tag_count: number;
  manifest_imported_at: string | null;
  qa_passed_at: string | null;
  activated_at: string | null;
  key_export?: { exported: boolean; count: number; exported_at: string | null };
};

export type TenantVaultOrder = {
  id: string;
  folder_name: string;
  order_name: string;
  base_batch_id: string;
  total_quantity: number;
  sub_batch_size: number;
  chip_model: string;
  carrier_profile_code: string;
  material_type: string | null;
  status: string;
  pack_purpose: "legacy_unclassified" | "trial_integration" | "production";
  packaging: { status: string; revision: number; spec_hash: string | null };
  created_at: string | null;
  updated_at: string | null;
  next_action: { code: string; label: string; href: string };
  sub_batches: TenantVaultSubBatch[];
  folders: {
    exports: TenantVaultArtifact[];
    manifests: TenantVaultArtifact[];
    "qa-reports": TenantVaultArtifact[];
    proofs: TenantVaultArtifact[];
  };
};

export type TenantVaultPayload = {
  ok: true;
  generated_at: string;
  viewer: {
    mode: "operator" | "tenant";
    can_view_export_audit: boolean;
    can_download_supplier_packs: boolean;
  };
  custody: {
    classification: "application_envelope_encryption";
    managed_kms: false;
    hsm_backed: false;
    plaintext_artifact_persisted: false;
    tenant_key_export_allowed: false;
    download_status: string;
  };
  tenant: { id: string; slug: string; name: string };
  hierarchy: { root: string; supplier_orders: string; folders: string[] };
  summary: {
    orders: number;
    sub_batches: number;
    planned_tags: number;
    manifested_tags: number;
    qa_passed_sub_batches: number;
    active_tags: number;
    artifacts: number;
  };
  pagination: {
    order_limit: number;
    orders_truncated: boolean;
    artifact_limit: number;
    artifacts_truncated: boolean;
  };
  orders: TenantVaultOrder[];
  export_audit?: Array<{
    id: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    before_hash: string | null;
    after_hash: string | null;
    request_id: string | null;
    actor_email: string | null;
    actor_name: string | null;
    created_at: string | null;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const COMMON_METADATA_KEYS = new Set([
  "bid",
  "filename",
  "entry_count",
  "row_count",
  "manifest_type",
  "manifest_id",
  "qa_status",
  "sample_count",
  "replay_checked",
  "ttstatus_checked",
  "server_verified_sun_evidence",
  "physical_ceremony_verified",
  "evidence_schema_version",
  "evidence_digest",
  "database_binding_digest",
  "qa_check_id",
  "pack_purpose",
  "commercial_disposition",
  "activation_allowed",
  "receiving_qa_required",
  "packaging_spec_revision",
  "packaging_spec_hash",
]);

const OPERATOR_METADATA_KEYS = new Set([
  ...COMMON_METADATA_KEYS,
  "plaintext_zip_sha256",
  "ciphertext_sha256",
  "envelope_sha256",
  "password_policy",
  "key_fingerprint",
  "key_version",
  "rotated_by",
  "rotation_reason",
  "production_qa_plan_id",
  "production_qa_plan_digest",
  "production_qa_plan_decision_id",
  "production_qa_plan_approval_receipt_sha256",
  "encryption_algorithm",
]);

const TENANT_EXPORT_METADATA_KEYS = new Set([
  "pack_purpose",
  "commercial_disposition",
  "activation_allowed",
  "receiving_qa_required",
  "packaging_spec_revision",
  "packaging_spec_hash",
]);

export function selectTenantVaultPayload(
  value: unknown,
  expectedTenantIdentifiers: string[],
  expectedViewer: "operator" | "tenant",
) {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.tenant) || !isRecord(value.viewer)) return null;
  const tenantId = String(value.tenant.id || "").trim().toLowerCase();
  const tenantSlug = String(value.tenant.slug || "").trim().toLowerCase();
  const expected = new Set(expectedTenantIdentifiers.map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (!tenantId || !tenantSlug || (!expected.has(tenantId) && !expected.has(tenantSlug))) return null;
  if (value.viewer.mode !== expectedViewer) return null;
  if (
    typeof value.viewer.can_download_supplier_packs !== "boolean"
    || (expectedViewer === "tenant" && value.viewer.can_download_supplier_packs !== false)
    || value.viewer.can_view_export_audit !== (expectedViewer === "operator")
    || !isRecord(value.custody)
    || value.custody.classification !== "application_envelope_encryption"
    || value.custody.managed_kms !== false
    || value.custody.hsm_backed !== false
    || value.custody.plaintext_artifact_persisted !== false
    || value.custody.tenant_key_export_allowed !== false
  ) return null;
  const expectedDownloadStatus = expectedViewer === "tenant"
    ? "tenant_key_pack_download_forbidden"
    : value.viewer.can_download_supplier_packs
      ? "privileged_idempotent_audited_delivery"
      : "operator_mfa_required";
  if (value.custody.download_status !== expectedDownloadStatus) return null;
  if (!Array.isArray(value.orders) || !isRecord(value.summary) || !isRecord(value.pagination)) return null;
  for (const order of value.orders) {
    if (!isRecord(order) || !String(order.id || "").trim() || !Array.isArray(order.sub_batches) || !isRecord(order.folders) || !isRecord(order.next_action)) return null;
    if (!["legacy_unclassified", "trial_integration", "production"].includes(String(order.pack_purpose || ""))) return null;
    if (expectedViewer === "tenant" && order.sub_batches.some((row) => isRecord(row) && "key_export" in row)) return null;
    for (const folder of ["exports", "manifests", "qa-reports", "proofs"]) {
      const artifacts = order.folders[folder];
      if (!Array.isArray(artifacts)) return null;
      for (const artifact of artifacts) {
        if (
          !isRecord(artifact)
          || artifact.folder !== folder
          || !isRecord(artifact.download)
          || typeof artifact.download.available !== "boolean"
          || !Number.isSafeInteger(artifact.download.count)
          || Number(artifact.download.count) < 0
          || !isRecord(artifact.metadata)
        ) return null;
        if (expectedViewer === "tenant" && artifact.download.available !== false) return null;
        if (artifact.download.available === true) {
          const artifactId = String(artifact.id || "").trim();
          const expectedHref = `/admin/tenant-vault/${encodeURIComponent(tenantId)}/artifacts/${encodeURIComponent(artifactId)}/download`;
          if (
            expectedViewer !== "operator"
            || value.viewer.can_download_supplier_packs !== true
            || folder !== "exports"
            || artifact.encrypted !== true
            || artifact.download.method !== "POST"
            || artifact.download.href !== expectedHref
            || artifact.download.reason !== null
          ) return null;
        } else if ("href" in artifact.download || "method" in artifact.download) {
          return null;
        }
        const allowedMetadata = expectedViewer === "operator"
          ? OPERATOR_METADATA_KEYS
          : folder === "exports"
            ? TENANT_EXPORT_METADATA_KEYS
            : COMMON_METADATA_KEYS;
        if (Object.keys(artifact.metadata).some((key) => !allowedMetadata.has(key))) return null;
        if (expectedViewer === "tenant" && "delivery" in artifact) return null;
        if (
          expectedViewer === "tenant"
          && folder === "exports"
          && (artifact.artifact_type !== "encrypted_supplier_pack" || artifact.mime_type !== null)
        ) return null;
      }
    }
  }
  if (expectedViewer === "tenant" && "export_audit" in value) return null;
  return value as unknown as TenantVaultPayload;
}
