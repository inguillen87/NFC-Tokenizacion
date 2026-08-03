import { createHash } from "node:crypto";

export const SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN = "nexid:supplier-qa:verification-context";
export const SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION = "v2";

export type SupplierQaPackPurpose = "legacy_unclassified" | "trial_integration" | "production";

export type SupplierQaVerificationContextInput = {
  tenantId: unknown;
  batchId: unknown;
  bid: unknown;
  manifestHash: unknown;
  carrierProfileCode: unknown;
  keyFingerprint: unknown;
  sdmConfig: unknown;
  supplierOrderId: unknown;
  supplierSubBatchId: unknown;
  supplierSubBatchStatus: unknown;
  batchStatus: unknown;
  keyExportCount: unknown;
  keyExportedAt: unknown;
  batchKeyExportCount: unknown;
  batchKeyExportedAt: unknown;
  packagingGovernanceStatus: unknown;
  packagingSpecRevision: unknown;
  packagingSpecHash: unknown;
  packPurpose: unknown;
};

function normalizedText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedNullableText(value: unknown) {
  return normalizedText(value) || null;
}

function normalizedNonNegativeInteger(value: unknown) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function compareUtf8(left: string, right: string) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/**
 * Canonical JSON shared with migration 0073. PostgreSQL uses COLLATE "C" for
 * object keys, so UTF-8 byte ordering keeps Node and the locked database
 * preimage identical even when an SDM config contains non-ASCII keys.
 */
export function canonicalSupplierQaJson(input: unknown): string {
  if (input === null) return "null";
  if (Array.isArray(input)) {
    return `[${input.map((item) => item === undefined ? "null" : canonicalSupplierQaJson(item)).join(",")}]`;
  }
  if (typeof input === "object") {
    const entries = Object.entries(input as Record<string, unknown>)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => compareUtf8(left, right));
    return `{${entries
      .map(([key, value]) => `${JSON.stringify(key)}:${canonicalSupplierQaJson(value)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(input);
  return encoded === undefined ? "null" : encoded;
}

function hashCanonicalSupplierQaPayload(input: unknown) {
  return `sha256:${createHash("sha256").update(canonicalSupplierQaJson(input), "utf8").digest("hex")}`;
}

export function normalizeSupplierQaPackPurpose(value: unknown): SupplierQaPackPurpose | null {
  const normalized = normalizedText(value).toLowerCase();
  return normalized === "legacy_unclassified"
    || normalized === "trial_integration"
    || normalized === "production"
    ? normalized
    : null;
}

function acceptanceScopeForPurpose(packPurpose: SupplierQaPackPurpose) {
  if (packPurpose === "trial_integration") return "trial_integration";
  if (packPurpose === "production") return "production_lot";
  return "legacy_unclassified";
}

/**
 * Builds the exact scan-time/QA-time consistency binding used by Supplier QA.
 * This is an application SHA-256 digest, not a signature, KMS operation, HSM
 * attestation, proof of physical presence, or replacement for SUN/SDM/CMAC.
 */
export function buildSupplierQaVerificationContext(input: SupplierQaVerificationContextInput) {
  const tenantId = normalizedText(input.tenantId).toLowerCase();
  const batchId = normalizedText(input.batchId).toLowerCase();
  const bid = normalizedText(input.bid).toUpperCase();
  const manifestHash = normalizedText(input.manifestHash).toLowerCase();
  const carrierProfileCode = normalizedText(input.carrierProfileCode).toLowerCase();
  const keyFingerprint = normalizedText(input.keyFingerprint).toUpperCase();
  const secureSun = carrierProfileCode === "ntag424_dna" || carrierProfileCode === "ntag424_dna_tt";
  const supplierOrderId = normalizedText(input.supplierOrderId).toLowerCase();
  const supplierSubBatchId = normalizedText(input.supplierSubBatchId).toLowerCase();
  const packPurpose = normalizeSupplierQaPackPurpose(input.packPurpose);

  if (
    !tenantId
    || !batchId
    || !bid
    || !supplierOrderId
    || !supplierSubBatchId
    || !/^sha256:[0-9a-f]{64}$/.test(manifestHash)
    || !carrierProfileCode
    || (secureSun ? !/^[0-9A-F]{16}$/.test(keyFingerprint) : keyFingerprint !== "")
    || !packPurpose
  ) {
    return null;
  }

  const carrierConfigDigest = hashCanonicalSupplierQaPayload({
    carrier_profile_code: carrierProfileCode,
    sdm_config: input.sdmConfig && typeof input.sdmConfig === "object" ? input.sdmConfig : {},
  });
  const acceptanceScope = acceptanceScopeForPurpose(packPurpose);
  const keyBinding = secureSun
    ? { key_fingerprint: keyFingerprint }
    : {
        key_fingerprint: null,
        key_material_mode: "none",
        software_envelope: false,
        managed_kms: false,
        hsm_backed: false,
      };
  const binding = {
    domain: SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN,
    schema_version: SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION,
    tenant_id: tenantId,
    batch_id: batchId,
    bid,
    manifest_hash: manifestHash,
    carrier_profile_code: carrierProfileCode,
    ...keyBinding,
    carrier_config_digest: carrierConfigDigest,
    supplier_order_id: supplierOrderId,
    supplier_sub_batch_id: supplierSubBatchId,
    supplier_sub_batch_status: normalizedNullableText(input.supplierSubBatchStatus)?.toLowerCase() || null,
    batch_status: normalizedNullableText(input.batchStatus)?.toLowerCase() || null,
    key_export_count: normalizedNonNegativeInteger(input.keyExportCount),
    key_exported_at: normalizedNullableText(input.keyExportedAt),
    batch_key_export_count: normalizedNonNegativeInteger(input.batchKeyExportCount),
    batch_key_exported_at: normalizedNullableText(input.batchKeyExportedAt),
    packaging_governance_status: normalizedNullableText(input.packagingGovernanceStatus)?.toLowerCase() || null,
    packaging_spec_revision: normalizedNonNegativeInteger(input.packagingSpecRevision),
    packaging_spec_hash: normalizedNullableText(input.packagingSpecHash)?.toLowerCase() || null,
    pack_purpose: packPurpose,
    acceptance_scope: acceptanceScope,
  };
  const canonicalPayload = canonicalSupplierQaJson(binding);
  const verificationContextDigest = `sha256:${createHash("sha256")
    .update(canonicalPayload, "utf8")
    .digest("hex")}`;

  return {
    domain: SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN,
    schemaVersion: SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION,
    packPurpose,
    acceptanceScope,
    carrierConfigDigest,
    binding,
    canonicalPayload,
    verificationContextDigest,
  };
}
