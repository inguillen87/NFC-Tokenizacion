import { auditFreeformContainsSecret } from "./audit-freeform-secret-policy";

export const TENANT_VAULT_FOLDERS = ["exports", "manifests", "qa-reports", "proofs"] as const;

export type TenantVaultFolder = (typeof TENANT_VAULT_FOLDERS)[number];
export type TenantVaultViewer = "operator" | "tenant";

export type TenantVaultWorkflowRow = Record<string, unknown>;

export type TenantVaultArtifactRow = {
  id?: unknown;
  supplier_order_id?: unknown;
  supplier_sub_batch_id?: unknown;
  artifact_type?: unknown;
  content_hash?: unknown;
  mime_type?: unknown;
  status?: unknown;
  delivery_status?: unknown;
  delivery_attempt_count?: unknown;
  last_delivery_attempt_at?: unknown;
  download_count?: unknown;
  last_downloaded_at?: unknown;
  metadata_json?: unknown;
  created_at?: unknown;
};

const TENANT_VAULT_DOWNLOAD_IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

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
]);

const TENANT_EXPORT_STATUS_METADATA_KEYS = new Set([
  "pack_purpose",
  "commercial_disposition",
  "activation_allowed",
  "receiving_qa_required",
  "packaging_spec_revision",
  "packaging_spec_hash",
]);

function safeIdentifier(value: unknown) {
  const normalized = String(value || "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(normalized) ? normalized : null;
}

function safeStatus(value: unknown, fallback = "unknown") {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : fallback;
}

function safeTimestamp(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function safeDigest(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^(?:sha256:)?[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function safeMimeType(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/.test(normalized)
    ? normalized
    : null;
}

export function normalizeTenantVaultDownloadIdempotencyKey(value: unknown) {
  const normalized = String(value || "").trim();
  return TENANT_VAULT_DOWNLOAD_IDEMPOTENCY_PATTERN.test(normalized) ? normalized : "";
}

export function normalizeTenantVaultDownloadReason(value: unknown) {
  const normalized = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length >= 12
    && normalized.length <= 240
    && !auditFreeformContainsSecret(normalized)
    ? normalized
    : "";
}

export function tenantVaultDownloadFilename(value: unknown, artifactId: unknown) {
  const safe = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 160);
  if (safe) return safe.endsWith(".enc") ? safe : `${safe}.enc`;
  const suffix = safeIdentifier(artifactId)?.slice(0, 16) || "encrypted-pack";
  return `nexid-supplier-pack-${suffix}.enc`;
}

function safeMetadataValue(value: unknown): string | number | boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 256 ? normalized : null;
}

export function resolveTenantVaultNextAction(
  order: TenantVaultWorkflowRow,
  subBatches: TenantVaultWorkflowRow[],
  viewer: TenantVaultViewer,
) {
  const packPurpose = String(order.effective_pack_purpose || "legacy_unclassified").toLowerCase();
  const packagingStatus = String(order.packaging_governance_status || "legacy_unverified").toLowerCase();
  const exported = subBatches.filter((row) => Number(row.key_export_count || 0) > 0).length;
  const manifested = subBatches.filter((row) => String(row.manifest_status || "").toLowerCase() === "imported").length;
  const qaPassed = subBatches.filter((row) => String(row.qa_status || "").toLowerCase() === "passed").length;
  const active = subBatches.reduce((total, row) => total + Number(row.active_tag_count || 0), 0);
  const expected = subBatches.reduce((total, row) => total + Number(row.expected_quantity || 0), 0);
  const href = `/supplier-orders/${encodeURIComponent(String(order.id || ""))}`;

  if (subBatches.length === 0) {
    return viewer === "operator"
      ? { code: "investigate_missing_sub_batches", label: "Revisar la orden: no hay sub-batches registrados", href }
      : { code: "await_nexid_order_repair", label: "Estructura operativa de la orden pendiente de revisión por nexID", href };
  }

  if (packPurpose === "legacy_unclassified") {
    return viewer === "operator"
      ? { code: "classify_pack_purpose", label: "Clasificar el propósito comercial antes de liberar material", href }
      : { code: "await_nexid_classification", label: "Clasificación del alcance de la orden pendiente por nexID", href };
  }
  if (packagingStatus !== "approved") {
    return viewer === "operator"
      ? { code: "approve_packaging", label: "Completar y aprobar la especificación industrial", href }
      : { code: "await_nexid_packaging", label: "Validación de la especificación industrial pendiente por nexID", href };
  }
  if (exported < subBatches.length) {
    return viewer === "operator"
      ? { code: "export_encrypted_pack", label: "Generar y entregar el pack cifrado", href }
      : { code: "await_nexid_export", label: "Preparación del pack de fábrica pendiente por nexID", href };
  }
  if (manifested < subBatches.length) {
    return viewer === "operator"
      ? { code: "import_manifest", label: "Importar y validar el manifiesto del proveedor", href }
      : { code: "await_supplier_manifest", label: "Recepción y validación del manifiesto pendiente por nexID", href };
  }
  if (qaPassed < subBatches.length) {
    return viewer === "operator"
      ? { code: "complete_qa", label: "Completar QA de recepción con evidencia", href }
      : { code: "await_receiving_qa", label: "QA de recepción con evidencia pendiente por nexID", href };
  }
  if (packPurpose === "trial_integration") {
    return { code: "trial_complete", label: "Prueba de integración completa · lote no vendible y no activable", href };
  }
  if (active < expected) {
    return viewer === "operator"
      ? { code: "activate_tags", label: "Activar tags aceptados según el plan aprobado", href }
      : { code: "await_nexid_activation", label: "Activación autorizada pendiente de ejecución por nexID", href };
  }
  return { code: "handover_complete", label: "Operación lista para handover y monitoreo", href };
}

export function tenantVaultFolderForArtifact(value: unknown): TenantVaultFolder {
  const type = String(value || "").trim().toLowerCase();
  if (type.includes("manifest")) return "manifests";
  if (type.includes("qa") || type.includes("acceptance")) return "qa-reports";
  if (type.startsWith("supplier_pack")) return "exports";
  return "proofs";
}

export function sanitizeTenantVaultMetadata(value: unknown, viewer: TenantVaultViewer) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const allowed = viewer === "operator"
    ? new Set([...COMMON_METADATA_KEYS, ...OPERATOR_METADATA_KEYS])
    : COMMON_METADATA_KEYS;
  const output: Record<string, string | number | boolean> = {};

  for (const [key, item] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    const safe = safeMetadataValue(item);
    if (safe !== null) output[key] = safe;
  }

  if (viewer === "operator" && input.encryption && typeof input.encryption === "object" && !Array.isArray(input.encryption)) {
    const algorithm = safeMetadataValue((input.encryption as Record<string, unknown>).algorithm);
    if (typeof algorithm === "string") output.encryption_algorithm = algorithm;
  }
  return output;
}

export function projectTenantVaultArtifact(row: TenantVaultArtifactRow, viewer: TenantVaultViewer) {
  const artifactType = safeIdentifier(row.artifact_type) || "unknown_artifact";
  const folder = tenantVaultFolderForArtifact(artifactType);
  const isEncryptedSupplierPack = artifactType === "supplier_pack_zip_encrypted";
  const deliveryAttempts = Number(row.delivery_attempt_count || 0);
  const downloadCount = Number(row.download_count || 0);
  const status = safeStatus(row.status, "unknown");
  const deliveryStatus = safeStatus(row.delivery_status, "metadata_only");
  const operatorDownloadAvailable = viewer === "operator"
    && isEncryptedSupplierPack
    && status === "active"
    && deliveryStatus === "ready";
  const sanitizedMetadata = sanitizeTenantVaultMetadata(row.metadata_json, viewer);
  const metadata = viewer === "tenant" && folder === "exports"
    ? Object.fromEntries(
        Object.entries(sanitizedMetadata).filter(([key]) => TENANT_EXPORT_STATUS_METADATA_KEYS.has(key)),
      )
    : sanitizedMetadata;
  const base = {
    id: safeIdentifier(row.id),
    supplier_order_id: safeIdentifier(row.supplier_order_id),
    supplier_sub_batch_id: safeIdentifier(row.supplier_sub_batch_id),
    folder,
    artifact_type: viewer === "tenant" && folder === "exports"
      ? "encrypted_supplier_pack"
      : artifactType,
    content_hash: safeDigest(row.content_hash),
    mime_type: viewer === "tenant" && folder === "exports" ? null : safeMimeType(row.mime_type),
    encrypted: isEncryptedSupplierPack,
    status,
    created_at: safeTimestamp(row.created_at),
    metadata,
    download: {
      available: operatorDownloadAvailable,
      reason: operatorDownloadAvailable
        ? null
        : viewer === "tenant" && folder === "exports"
          ? "tenant_key_pack_download_forbidden"
          : "artifact_not_downloadable",
      count: Number.isSafeInteger(downloadCount) && downloadCount >= 0
        ? Math.min(downloadCount, 1_000_000)
        : 0,
      last_downloaded_at: safeTimestamp(row.last_downloaded_at),
    },
  };

  if (viewer !== "operator") return base;
  return {
    ...base,
    delivery: {
      status: deliveryStatus,
      attempt_count: Number.isSafeInteger(deliveryAttempts) && deliveryAttempts >= 0
        ? Math.min(deliveryAttempts, 1_000_000)
        : 0,
      last_attempt_at: safeTimestamp(row.last_delivery_attempt_at),
    },
  };
}

export function emptyTenantVaultFolders() {
  return {
    exports: [] as ReturnType<typeof projectTenantVaultArtifact>[],
    manifests: [] as ReturnType<typeof projectTenantVaultArtifact>[],
    "qa-reports": [] as ReturnType<typeof projectTenantVaultArtifact>[],
    proofs: [] as ReturnType<typeof projectTenantVaultArtifact>[],
  };
}
