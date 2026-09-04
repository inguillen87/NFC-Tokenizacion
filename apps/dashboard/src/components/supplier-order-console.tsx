"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Card } from "@product/ui";
import { CheckCircle2, CloudOff, Download, FileCheck2, LockKeyhole, ShieldCheck, Smartphone, UploadCloud } from "lucide-react";
import {
  LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION,
  legacyTrialClassificationAttemptSignature,
  normalizeLegacyTrialClassificationReason,
  resolveSupplierPackPurpose,
  type SupplierPackPurpose,
} from "../lib/supplier-pack-purpose-policy";
import {
  IOT_TRACKER_CARRIER_LABEL,
  IOT_TRACKER_EVIDENCE_DESCRIPTION,
  isIotTrackerEvidenceCarrier,
} from "../lib/iot-tracker-evidence-copy";
import { resolveSupplierOpsErrorReport, type SupplierOpsDownloadableErrorReport } from "../lib/supplier-ops-error-report";
import { dashboardHighImpactPermissionMatches, dashboardPermissionMatches } from "../lib/permission-policy";
import { SupplierProductionAcceptancePanel } from "./supplier-production-acceptance-panel";

type SupplierSubBatch = {
  id: string;
  bid: string;
  batch_id?: string;
  sequence_index?: number;
  expected_quantity?: number;
  manifest_status?: string;
  manifest_count?: number;
  qa_status?: string;
  manufacturing_state?: string;
  key_export_count?: number;
  key_exported_at?: string | null;
  activated_at?: string | null;
  key_fingerprint?: string;
  url_template?: string;
  status?: string;
};

type SupplierOrder = {
  id: string;
  tenant_slug?: string;
  customer_slug?: string;
  order_name?: string;
  carrier_profile_code?: string;
  chip_model?: string;
  total_quantity?: number;
  sub_batch_size?: number;
  status?: string;
  pack_exported_at?: string;
  pack_status?: string;
  sent_to_supplier_at?: string | null;
  tenant_handover_recorded_at?: string | null;
  packaging_governance_status?: string;
  packaging_spec_revision?: number;
  packaging_spec_hash?: string | null;
  pack_purpose?: string | null;
  declared_pack_purpose?: string | null;
  effective_pack_purpose?: string | null;
  classification_decision_id?: string | null;
  sub_batches?: SupplierSubBatch[];
};

type SupplierOrderResponse = {
  ok?: boolean;
  order?: SupplierOrder;
  sub_batches?: SupplierSubBatch[];
  warning?: string;
  orders?: SupplierOrder[];
};

type SupplierPackResponse = {
  ok?: boolean;
  order?: SupplierOrder;
  zip_layout?: string;
  encrypted_pack?: {
    filename: string;
    mime_type: string;
    encoding: "base64";
    base64: string;
    envelope_sha256: string;
    plaintext_zip_sha256: string;
    ciphertext_sha256: string;
    password_warning: string;
    password_delivery?: {
      mode?: string;
      returned?: boolean;
      separate_channel_required?: boolean;
    };
    encryption?: Record<string, unknown>;
  };
  warning?: string;
  packs?: Array<{
    bid: string;
    folder: string;
    key_fingerprint: string;
    text_filename: string;
    json_filename: string;
    pdf_summary_filename: string;
    content_hash: string;
    json_hash: string;
    pdf_hash: string;
  }>;
};

type SupplierVaultArtifact = {
  id: string;
  bid?: string | null;
  resource_type?: string;
  artifact_type?: string;
  content_hash?: string;
  mime_type?: string | null;
  status?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

type ManifestImportResponse = {
  ok?: boolean;
  dryRun?: boolean;
  bid?: string;
  importedRows?: number;
  inserted?: number;
  registeredSunPayloads?: number;
  supplier_gate?: Record<string, unknown> | null;
  warning?: string;
};

type ActivationResponse = {
  ok?: boolean;
  activated?: number;
  remainingInactive?: number;
  activationComplete?: boolean;
  supplier_gate?: Record<string, unknown> | null;
};

type OfflineVerifierDevice = {
  id: string;
  tenant_slug?: string;
  device_label?: string;
  device_type?: string;
  device_fingerprint?: string;
  operator_ref?: string | null;
  status?: string;
  last_seen_at?: string | null;
  created_at?: string;
};

type OfflineVerifierBundle = {
  id: string;
  bundle_ref?: string;
  tenant_slug?: string;
  device_id?: string;
  allowed_bids?: string[];
  key_fingerprints?: Record<string, unknown>;
  key_material_included?: false;
  policy?: {
    contains_key_material?: false;
    local_verdict_model?: string;
    allowed_local_verdicts?: string[];
    requires_backend_sync_for?: string[];
  };
  bundle_hash?: string;
  status?: string;
  expires_at?: string;
  created_at?: string;
};

type OfflineVerifierDevicesResponse = {
  ok?: boolean;
  devices?: OfflineVerifierDevice[];
};

type OfflineVerifierDeviceResponse = {
  ok?: boolean;
  device?: OfflineVerifierDevice;
};

type OfflineVerifierBundleResponse = {
  ok?: boolean;
  bundle?: OfflineVerifierBundle;
  warning?: string;
};

type SupplierOrderConsoleProps = {
  currentRole?: string;
  currentPermissions?: string[];
  currentDeniedPermissions?: string[];
  tenantSlug?: string | null;
};

const carrierProfiles = [
  { value: "ntag424_dna", label: "NTAG 424 DNA - SUN seguro" },
  { value: "ntag424_dna_tt", label: "NTAG 424 DNA TagTamper - sello fisico" },
  { value: "gs1_digital_link", label: "QR GS1 Digital Link" },
  { value: "qr_basic", label: "QR seguro - experiencia web" },
  { value: "uhf_rfid", label: "UHF / EPC - logistica y agro" },
  { value: "event_wristband", label: "Pulsera NFC - eventos/acceso" },
  { value: "hotel_keycard", label: "Credencial / keycard hotel" },
  { value: "iot_tracker_placeholder", label: IOT_TRACKER_CARRIER_LABEL },
  { value: "ntag216", label: "NTAG216 - UX extendida" },
  { value: "ntag215", label: "NTAG215 - eventos/acceso" },
];

function asJson(data: unknown) {
  return JSON.stringify(data, null, 2);
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64(filename: string, base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safePackSummary(data: SupplierPackResponse) {
  return {
    ok: data.ok,
    order: data.order,
    zip_layout: data.zip_layout,
    warning: data.warning,
    encrypted_pack: data.encrypted_pack
      ? {
          filename: data.encrypted_pack.filename,
          envelope_sha256: data.encrypted_pack.envelope_sha256,
          plaintext_zip_sha256: data.encrypted_pack.plaintext_zip_sha256,
          ciphertext_sha256: data.encrypted_pack.ciphertext_sha256,
          password_warning: data.encrypted_pack.password_warning,
          encryption: data.encrypted_pack.encryption,
        }
      : null,
    packs: data.packs,
  };
}

function formatError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  const reason = record.reason || record.error || record.message;
  if (!reason) return fallback;
  const missing = Array.isArray(record.missing) ? ` (${record.missing.join(", ")})` : "";
  return `${String(reason)}${missing}`;
}

function makeLocalPackPassword(customerSlug: string, tenantSlug: string) {
  const prefix = (customerSlug || tenantSlug || "NEXID").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").toUpperCase();
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `nexID-${prefix}-${secret}`;
}

function countManifestRows(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return 0;
  const firstLine = lines[0]?.toLowerCase() || "";
  const hasHeader = firstLine.includes("uid") || firstLine.includes("batch") || firstLine.includes("bid");
  return Math.max(0, lines.length - (hasHeader ? 1 : 0));
}

function parseBidList(value: string) {
  return Array.from(new Set(
    value
      .split(/[\s,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  ));
}

function offlineExpiryFromDays(value: string) {
  const parsed = Math.trunc(Number(value || 7));
  const days = Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function hasScopedPermission(grants: string[], permission: string) {
  return grants.some((grant) => {
    if (grant === permission) return true;
    if (grant.endsWith(":*")) return permission.startsWith(grant.slice(0, -1));
    return false;
  });
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.includes("fingerprint")) return false;
  return [
    "k_meta",
    "k_file",
    "secret",
    "password",
    "kms",
    "private",
    "raw",
    "plaintext_key",
    "file_key",
    "meta_key",
    "storage",
    "bucket",
    "path",
    "url",
    "token",
  ].some((needle) => normalized.includes(needle));
}

function formatSafeMetadataValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function safeVaultMetadataEntries(metadata?: Record<string, unknown>) {
  if (!metadata) return [];
  return Object.entries(metadata)
    .filter(([key, value]) => !isSensitiveMetadataKey(key) && formatSafeMetadataValue(value))
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${formatSafeMetadataValue(value)}`);
}

function sanitizeVaultArtifact(artifact: SupplierVaultArtifact) {
  const safeMetadata = Object.fromEntries(
    safeVaultMetadataEntries(artifact.metadata).map((entry) => {
      const [key, ...rest] = entry.split(": ");
      return [key, rest.join(": ")];
    }),
  );
  return {
    id: artifact.id,
    bid: artifact.bid,
    resource_type: artifact.resource_type,
    artifact_type: artifact.artifact_type,
    content_hash: artifact.content_hash,
    mime_type: artifact.mime_type,
    status: artifact.status,
    created_at: artifact.created_at,
    metadata: Object.keys(safeMetadata).length ? safeMetadata : undefined,
  };
}

function safeResponseForPath(path: string, data: unknown) {
  if (path.includes("/export-pack") && data && typeof data === "object") {
    const record = data as SupplierPackResponse;
    if (record.encrypted_pack || record.packs || record.order) return safePackSummary(record);
  }
  if (path.includes("/vault") && data && typeof data === "object") {
    const record = data as { artifacts?: SupplierVaultArtifact[] };
    return {
      ...record,
      artifacts: Array.isArray(record.artifacts) ? record.artifacts.map(sanitizeVaultArtifact) : [],
    };
  }
  if (path.includes("/offline-verifier") && data && typeof data === "object") {
    const record = data as OfflineVerifierBundleResponse & OfflineVerifierDeviceResponse & OfflineVerifierDevicesResponse;
    return {
      ok: record.ok,
      warning: record.warning,
      device: record.device,
      devices: record.devices,
      bundle: record.bundle
        ? {
            id: record.bundle.id,
            bundle_ref: record.bundle.bundle_ref,
            tenant_slug: record.bundle.tenant_slug,
            device_id: record.bundle.device_id,
            allowed_bids: record.bundle.allowed_bids,
            key_fingerprints: record.bundle.key_fingerprints,
            key_material_included: false,
            policy: record.bundle.policy,
            bundle_hash: record.bundle.bundle_hash,
            status: record.bundle.status,
            expires_at: record.bundle.expires_at,
            created_at: record.bundle.created_at,
          }
        : undefined,
    };
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    const report = record.error_report && typeof record.error_report === "object" && !Array.isArray(record.error_report)
      ? record.error_report as Record<string, unknown>
      : null;
    if (report && typeof report.csv === "string") {
      return {
        ...record,
        error_report: {
          ...report,
          csv: `[CSV disponible para descarga: ${Number(report.row_count || 0)} fila(s)]`,
        },
      };
    }
  }
  return data;
}

function normalStatus(value?: string | null) {
  return (value || "pending").toLowerCase();
}

function effectiveSupplierPackPurpose(order?: SupplierOrder): Exclude<SupplierPackPurpose, ""> {
  return resolveSupplierPackPurpose({
    declaredPackPurpose: order?.declared_pack_purpose || order?.pack_purpose,
    effectivePackPurpose: order?.effective_pack_purpose,
  });
}

function supplierPurposeContract(purpose: SupplierPackPurpose) {
  if (purpose === "trial_integration") {
    return {
      badge: "NON_SELLABLE",
      detail: "Solo integración. Puede completar el QA de 10 tags, pero nunca activar ni habilitar venta, claim o tokenización.",
      className: "border-amber-300/30 bg-amber-500/10 text-amber-100",
    };
  }
  if (purpose === "production") {
    return {
      badge: "BLOQUEADO · QA V2",
      detail: "Producción queda bloqueada hasta un plan QA v2 aprobado por el tenant; el QA fijo de 10 tags no libera este lote.",
      className: "border-rose-300/30 bg-rose-500/10 text-rose-100",
    };
  }
  if (purpose === "legacy_unclassified") {
    return {
      badge: "PROPÓSITO SIN CLASIFICAR",
      detail: "Registro legado fail-closed: no permite exportar, aprobar QA ni activar hasta una clasificación auditada.",
      className: "border-slate-300/25 bg-slate-500/10 text-slate-200",
    };
  }
  return {
    badge: "SELECCIÓN REQUERIDA",
    detail: "Elegí explícitamente integración no vendible o producción antes de crear el pedido.",
    className: "border-cyan-300/25 bg-cyan-500/10 text-cyan-100",
  };
}

function qaSnapshotReferenceKey(value: string) {
  if (value.length > 4096) return null;
  try {
    const url = new URL(value);
    const snapshot = Number(url.searchParams.get("snapshot"));
    const trace = String(url.searchParams.get("trace") || "").trim();
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
    if (!Number.isSafeInteger(snapshot) || snapshot <= 0 || !/^[A-Za-z0-9._:-]{1,160}$/.test(trace)) return null;
    return `${snapshot}:${trace}`;
  } catch {
    return null;
  }
}

function isQaSnapshotResultUrl(value: string) {
  return qaSnapshotReferenceKey(value) !== null;
}

function hasExportEvidence(order: SupplierOrder | undefined, artifacts: SupplierVaultArtifact[], sessionPack: SupplierPackResponse | null) {
  if (sessionPack?.encrypted_pack) return true;
  if (order?.pack_exported_at || normalStatus(order?.pack_status).includes("export")) return true;
  return artifacts.some((artifact) => {
    const kind = `${artifact.artifact_type || ""} ${artifact.resource_type || ""}`.toLowerCase();
    return kind.includes("pack") || kind.includes("factory") || kind.includes("encrypted_pack");
  });
}

export function SupplierOrderConsole({
  currentRole = "tenant-admin",
  currentPermissions = [],
  currentDeniedPermissions = [],
  tenantSlug: sessionTenantSlug = null,
}: SupplierOrderConsoleProps) {
  const normalizedRole = currentRole.replace(/_/g, "-");
  const isSuperAdmin = normalizedRole === "super-admin";
  const canCreateOrder = dashboardHighImpactPermissionMatches(
    currentRole,
    currentPermissions,
    "supplier_order.create",
    currentDeniedPermissions,
  );
  const canGenerateBatchKeys = dashboardHighImpactPermissionMatches(
    currentRole,
    currentPermissions,
    "batch.keys.generate",
    currentDeniedPermissions,
  );
  const canManageManifest = dashboardPermissionMatches(
    currentPermissions,
    "manifest.import",
    currentDeniedPermissions,
  );
  const canRunQa = dashboardPermissionMatches(
    currentPermissions,
    "qa.approve",
    currentDeniedPermissions,
  );
  const canExportPack = dashboardHighImpactPermissionMatches(
    currentRole,
    currentPermissions,
    "supplier_pack.export",
    currentDeniedPermissions,
  );
  const canActivateTags = dashboardPermissionMatches(
    currentPermissions,
    "batch.activate",
    currentDeniedPermissions,
  );
  const canUseActivationOverride = isSuperAdmin
    || hasScopedPermission(currentPermissions, "supplier:activate_override");
  const canClassifyLegacyTrial = isSuperAdmin
    || hasScopedPermission(currentPermissions, "supplier:pack_purpose_classify_trial");
  const canManageOfflineVerifier = isSuperAdmin || hasScopedPermission(currentPermissions, "supplier:offline_verifier");

  const [tenantSlug, setTenantSlug] = useState(sessionTenantSlug || "");
  const [customerSlug, setCustomerSlug] = useState("");
  const [orderName, setOrderName] = useState("");
  const [baseBatchId, setBaseBatchId] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("5000");
  const [subBatchSize, setSubBatchSize] = useState("1000");
  const [chipModel, setChipModel] = useState("NTAG 424 DNA");
  const [carrierProfileCode, setCarrierProfileCode] = useState("ntag424_dna");
  const [packPurpose, setPackPurpose] = useState<SupplierPackPurpose>("");
  const [materialType, setMaterialType] = useState("Etiqueta NFC industrial");
  const [sku, setSku] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Listo para crear un pedido industrial real. No pega llaves manuales ni expone la clave maestra de aplicación.");
  const [response, setResponse] = useState("{}");
  const [created, setCreated] = useState<SupplierOrderResponse | null>(null);
  const [pack, setPack] = useState<SupplierPackResponse | null>(null);
  const [qaBid, setQaBid] = useState("");
  const [qaSampleUrls, setQaSampleUrls] = useState("");
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [packPassword, setPackPassword] = useState("");
  const [packPasswordVisible, setPackPasswordVisible] = useState(false);
  const [vaultArtifacts, setVaultArtifacts] = useState<SupplierVaultArtifact[]>([]);
  const [manifestCsv, setManifestCsv] = useState("");
  const [manifestResult, setManifestResult] = useState<ManifestImportResponse | null>(null);
  const [manifestQuantityOverrideEnabled, setManifestQuantityOverrideEnabled] = useState(false);
  const [manifestQuantityOverrideReason, setManifestQuantityOverrideReason] = useState("");
  const [activationLimit, setActivationLimit] = useState("");
  const [activationOverrideEnabled, setActivationOverrideEnabled] = useState(false);
  const [activationOverrideReason, setActivationOverrideReason] = useState("");
  const [errorReport, setErrorReport] = useState<SupplierOpsDownloadableErrorReport | null>(null);
  const [legacyTrialReason, setLegacyTrialReason] = useState("");
  const [legacyTrialConfirmation, setLegacyTrialConfirmation] = useState("");
  const [offlineDevices, setOfflineDevices] = useState<OfflineVerifierDevice[]>([]);
  const [offlineDeviceLabel, setOfflineDeviceLabel] = useState("Samsung field verifier");
  const [offlineDeviceType, setOfflineDeviceType] = useState("field_app");
  const [offlineDeviceFingerprint, setOfflineDeviceFingerprint] = useState("");
  const [offlineOperatorRef, setOfflineOperatorRef] = useState("");
  const [offlineSelectedDeviceId, setOfflineSelectedDeviceId] = useState("");
  const [offlineBundleBids, setOfflineBundleBids] = useState("");
  const [offlineBundleExpiryDays, setOfflineBundleExpiryDays] = useState("7");
  const [offlineBundle, setOfflineBundle] = useState<OfflineVerifierBundle | null>(null);
  const qaOperationKeys = useRef(new Map<string, string>());
  const activationOperationKeys = useRef(new Map<string, string>());
  const legacyTrialClassificationAttempt = useRef<{ signature: string; idempotencyKey: string } | null>(null);

  const subBatches = useMemo(() => created?.sub_batches || [], [created]);
  const selectedOrderId = created?.order?.id || "";
  const selectedSubBatch = useMemo(
    () => subBatches.find((item) => item.bid === qaBid) || null,
    [qaBid, subBatches],
  );
  const activeCarrierProfile = created?.order?.carrier_profile_code || carrierProfileCode;
  const activePackPurpose: SupplierPackPurpose = selectedOrderId
    ? effectiveSupplierPackPurpose(created?.order)
    : packPurpose;
  const declaredPackPurpose = resolveSupplierPackPurpose({
    declaredPackPurpose: created?.order?.declared_pack_purpose || created?.order?.pack_purpose,
  });
  const creationPurposeContract = supplierPurposeContract(packPurpose);
  const activePurposeContract = supplierPurposeContract(activePackPurpose);
  const effectiveTenantSlug = (created?.order?.tenant_slug || tenantSlug).trim();
  const requiresTtstatus = activeCarrierProfile === "ntag424_dna_tt";
  const supportsSunQa = ["ntag424_dna", "ntag424_dna_tt"].includes(activeCarrierProfile);
  const manifestRows = useMemo(() => countManifestRows(manifestCsv), [manifestCsv]);
  const legacyTrialReasonContract = normalizeLegacyTrialClassificationReason(legacyTrialReason);
  const qaUrls = useMemo(() => {
    const seen = new Set<string>();
    return qaSampleUrls
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter((value) => {
        if (/[<>]/.test(value) || !isQaSnapshotResultUrl(value)) return false;
        const key = qaSnapshotReferenceKey(value)!;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [qaSampleUrls]);
  const qaRequiredManifestUids = Math.min(
    10,
    Math.max(1, Math.trunc(Number(selectedSubBatch?.expected_quantity || 10))),
  );
  const qaMinimumDiagnosticReceipts = qaRequiredManifestUids * 2 + (requiresTtstatus ? 1 : 0);
  const packAlreadyExported = hasExportEvidence(created?.order, vaultArtifacts, pack);
  const packagingStatus = normalStatus(created?.order?.packaging_governance_status) || "legacy_unverified";
  const packagingApproved = packagingStatus === "approved";
  const totalQuantityValue = Number(totalQuantity);
  const subBatchSizeValue = Number(subBatchSize);
  const selectedExpectedQuantity = Math.max(0, Math.trunc(Number(selectedSubBatch?.expected_quantity || 0)));
  const selectedManifestCount = Math.max(0, Math.trunc(Number(selectedSubBatch?.manifest_count || 0)));
  const manifestDraftQuantityMismatch = Boolean(
    selectedExpectedQuantity > 0
    && manifestRows > 0
    && manifestRows !== selectedExpectedQuantity,
  );
  const importedManifestQuantityMismatch = Boolean(
    selectedExpectedQuantity > 0
    && normalStatus(selectedSubBatch?.manifest_status) === "imported"
    && selectedManifestCount !== selectedExpectedQuantity,
  );
  const manifestQuantityOverrideReady = Boolean(
    isSuperAdmin
    && manifestQuantityOverrideEnabled
    && manifestQuantityOverrideReason.trim().length >= 16,
  );
  const activationOverrideReady = Boolean(
    canUseActivationOverride
    && activationOverrideEnabled
    && activationOverrideReason.trim().length >= 16,
  );
  const offlineBids = useMemo(() => {
    const manualBids = parseBidList(offlineBundleBids);
    if (manualBids.length) return manualBids;
    return qaBid ? [qaBid] : [];
  }, [offlineBundleBids, qaBid]);
  const createOrderBlockReason = !canCreateOrder
    ? "Tu perfil no tiene supplier_order.create para crear Supplier Orders."
    : !packPurpose
      ? "Selecciona explícitamente el propósito: trial de integración no vendible o producción bloqueada hasta QA v2."
    : !tenantSlug.trim()
      ? "Falta tenant slug."
      : !orderName.trim() && !baseBatchId.trim()
        ? "Falta order name o base batch ID."
        : !Number.isFinite(totalQuantityValue) || totalQuantityValue <= 0
          ? "Cantidad total invalida."
          : !Number.isFinite(subBatchSizeValue) || subBatchSizeValue <= 0
            ? "Tamano de sub-batch invalido."
            : subBatchSizeValue > totalQuantityValue
              ? "El sub-batch no puede superar la cantidad total."
              : "";
  const legacyTrialClassificationBlockReason = !selectedOrderId
    ? "Selecciona un Supplier Order historico."
    : activePackPurpose !== "legacy_unclassified"
      ? "Solo un pedido legacy_unclassified puede clasificarse por este flujo."
      : !canClassifyLegacyTrial
        ? "Solo superadmin o supplier:pack_purpose_classify_trial puede ejecutar esta decision irreversible."
        : !legacyTrialReasonContract.valid
          ? "Escribe una razon de auditoria entre 16 y 1000 caracteres."
          : legacyTrialConfirmation !== LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION
            ? `Escribe exactamente ${LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION}.`
            : "";
  const manifestBaseBlockReason = !canManageManifest
    ? "Tu perfil no puede importar manifiestos."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : !qaBid.trim()
        ? "Selecciona un BID."
        : !selectedSubBatch
          ? "El BID no pertenece al Supplier Order seleccionado."
          : normalStatus(selectedSubBatch.manifest_status) === "imported"
            ? "Este sub-batch ya tiene manifiesto importado. Las correcciones deben auditarse desde backend."
            : !manifestCsv.trim()
              ? "Pega el CSV/TXT recibido del proveedor."
              : "";
  const manifestImportBlockReason = manifestBaseBlockReason
    || (manifestDraftQuantityMismatch && !isSuperAdmin
      ? `La cantidad recibida (${manifestRows}) no coincide con la planificada (${selectedExpectedQuantity}); solo superadmin puede registrar una excepción auditada.`
      : manifestDraftQuantityMismatch && !manifestQuantityOverrideReady
        ? "Para importar esta diferencia de cantidad, activa la excepción y escribe una razón de al menos 16 caracteres."
        : "");
  const activationBlockReason = !canActivateTags
    ? "Tu perfil no puede activar tags."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : activePackPurpose === "legacy_unclassified"
        ? "Propósito sin clasificar: este registro legado no puede activarse."
      : activePackPurpose === "trial_integration"
          ? "NON_SELLABLE: un trial de integración nunca puede activar tags."
      : !qaBid.trim()
        ? "Selecciona un BID."
        : !selectedSubBatch
          ? "El BID no pertenece al Supplier Order seleccionado."
          : normalStatus(selectedSubBatch.manifest_status) !== "imported"
            ? "Falta manifiesto importado."
            : normalStatus(selectedSubBatch.qa_status) !== "passed"
              ? activePackPurpose === "production"
                ? "Falta aceptación QA de producción: plan aprobado por tenant-admin y sesión de recepción aprobada por otro actor autorizado."
                : "Falta QA aprobado."
              : importedManifestQuantityMismatch && !canUseActivationOverride
                ? `El manifiesto importado (${selectedManifestCount}) no coincide con la cantidad planificada (${selectedExpectedQuantity}); tu perfil no puede autorizar esta excepción.`
                : importedManifestQuantityMismatch && !activationOverrideReady
                  ? "La activación exige una excepción explícita con una razón de al menos 16 caracteres para esta diferencia de cantidad."
                  : "";
  const qaPassBlockReason = !canRunQa
    ? "Tu perfil no puede aprobar QA."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : activePackPurpose === "legacy_unclassified"
        ? "Propósito sin clasificar: el QA permanece bloqueado hasta una clasificación auditada."
        : activePackPurpose === "production"
          ? "El QA fijo de 10 tags es solo para trial de integración; producción requiere QA v2 aprobado por el tenant."
      : !qaBid.trim()
        ? "Selecciona un BID."
        : !selectedSubBatch
          ? "El BID no pertenece al Supplier Order seleccionado."
          : normalStatus(selectedSubBatch.manifest_status) !== "imported"
            ? "Importa el manifiesto antes de aprobar QA."
            : !supportsSunQa
              ? "Este gate aprueba solo NTAG 424 SUN; el carrier seleccionado necesita otra estrategia de evidencia."
            : !qaUrls.length
              ? "Pega las URLs de resultado Nexid con snapshot y trace."
              : qaUrls.length > 60
                ? "El gate acepta como máximo 60 recibos SUN únicos por evaluación."
              : qaUrls.length < qaMinimumDiagnosticReceipts
                ? `Faltan recibos: minimo ${qaMinimumDiagnosticReceipts} (${qaRequiredManifestUids} validos + ${qaRequiredManifestUids} replays${requiresTtstatus ? " + 1 estado OPENED TagTamper electronico" : ""}).`
                : "";
  const qaRejectBlockReason = !canRunQa
    ? "Tu perfil no puede rechazar QA."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : activePackPurpose === "legacy_unclassified"
        ? "Propósito sin clasificar: el flujo QA permanece bloqueado hasta una clasificación auditada."
      : !qaBid.trim()
        ? "Selecciona un BID."
        : "";
  const exportPackBlockReason = !canExportPack
    ? "Solo superadmin puede exportar el pack cifrado con llaves de fabrica."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : activePackPurpose === "legacy_unclassified"
        ? "Propósito sin clasificar: no se exportan llaves de un registro legado sin clasificación auditada."
      : !packagingApproved
        ? `Packaging ${packagingStatus}: completa y aproba la especificacion industrial antes de exportar llaves.`
        : packAlreadyExported
          ? "Pack ya exportado o con evidencia en Vault."
          : "";
  const offlineBlockReason = !canManageOfflineVerifier
    ? "Solo superadmin o un usuario con supplier:offline_verifier puede emitir bundles offline sin llaves de fabrica."
    : !effectiveTenantSlug
      ? "Falta tenant slug."
      : "";
  const offlineBundleBlockReason = offlineBlockReason
    || (!offlineSelectedDeviceId ? "Selecciona o enrola un dispositivo offline." : "")
    || (!offlineBids.length ? "Selecciona al menos un BID para el bundle." : "");
  const canDryRunManifest = Boolean(!pending && !manifestBaseBlockReason);
  const canImportManifest = Boolean(!pending && !manifestImportBlockReason);
  const canActivateSubBatch = Boolean(!pending && !activationBlockReason);
  const canPassQa = Boolean(!pending && !qaPassBlockReason);
  const canRejectQa = Boolean(!pending && !qaRejectBlockReason);
  const canExportCurrentPack = Boolean(!pending && !exportPackBlockReason);
  const canClassifyCurrentLegacyOrder = Boolean(!pending && !legacyTrialClassificationBlockReason);
  const canLoadOfflineDevices = Boolean(!pending && !offlineBlockReason);
  const canEnrollOfflineDevice = Boolean(
    !pending
    && !offlineBlockReason
    && offlineDeviceLabel.trim()
    && offlineDeviceFingerprint.trim(),
  );
  const canIssueOfflineBundle = Boolean(!pending && !offlineBundleBlockReason);
  const nextAction = !selectedOrderId
    ? "Crea o selecciona un Supplier Order."
    : activePackPurpose === "legacy_unclassified"
      ? "Clasifica el propósito legado mediante una decisión auditada antes de operar."
    : !selectedSubBatch
      ? "Selecciona un sub-batch del pedido."
      : !packagingApproved
        ? "Completa la especificacion de packaging, evidencia fisica y aprobacion antes del pack."
        : !packAlreadyExported && canExportPack
          ? "Exporta el pack cifrado una sola vez y entrega la clave por canal separado."
        : normalStatus(selectedSubBatch.manifest_status) !== "imported"
          ? "Valida el manifiesto con dry-run y despues importalo."
          : normalStatus(selectedSubBatch.qa_status) !== "passed"
            ? activePackPurpose === "production"
              ? "Completa el plan QA v2 aprobado por tenant-admin y la recepción aprobada por otro actor autorizado."
              : "Completa QA con muestra real, replay y TTStatus si aplica."
            : activePackPurpose === "trial_integration"
              ? "Trial validado para integración. Permanece NON_SELLABLE y no puede activarse."
              : normalStatus(selectedSubBatch.status).includes("activated")
                ? "Sub-batch activo. Revisa Vault y evidencias."
                : "Activacion habilitada: ejecuta activate-all o define un limite.";

  async function run(path: string, init?: RequestInit) {
    const result = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const text = await result.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    const errorStage: "manifest" | "qa" | null = path.includes("/import-manifest")
      ? "manifest"
      : /\/supplier-orders\/[^/]+\/qa(?:\?|$)/.test(path)
        ? "qa"
        : null;
    setResponse(asJson(safeResponseForPath(path, data)));
    if (!result.ok || (data && typeof data === "object" && (data as { ok?: unknown }).ok === false)) {
      if (errorStage) {
        setErrorReport(resolveSupplierOpsErrorReport(data, { stage: errorStage, bid: qaBid.trim() }));
      }
      throw new Error(formatError(data, result.statusText));
    }
    if (errorStage) setErrorReport(null);
    return data as Record<string, unknown>;
  }

  function updateSubBatchStatus(bid: string, patch: Partial<SupplierSubBatch>) {
    setCreated((previous) => {
      if (!previous?.sub_batches?.length) return previous;
      const nextSubBatches = previous.sub_batches.map((item) => (
        item.bid === bid ? { ...item, ...patch } : item
      ));
      return {
        ...previous,
        sub_batches: nextSubBatches,
        order: previous.order ? { ...previous.order, sub_batches: nextSubBatches } : previous.order,
      };
    });
  }

  function resetLegacyTrialClassificationDraft() {
    setLegacyTrialReason("");
    setLegacyTrialConfirmation("");
    legacyTrialClassificationAttempt.current = null;
  }

  async function createOrder() {
    if (createOrderBlockReason) {
      setStatus(createOrderBlockReason);
      return;
    }
    setPending(true);
    setStatus(canGenerateBatchKeys
      ? "Creando pedido y sub-batches; el backend autorizará por separado cualquier generación de llaves cifradas."
      : "Creando pedido sin asumir autorización para generar llaves ni exportar material de fábrica.");
    try {
      const data = await run("/api/admin/supplier-orders", {
        method: "POST",
        body: JSON.stringify({
          tenant_slug: tenantSlug.trim(),
          customer_slug: customerSlug.trim() || tenantSlug.trim(),
          order_name: orderName.trim(),
          base_batch_id: baseBatchId.trim() || orderName.trim(),
          total_quantity: Number(totalQuantity),
          sub_batch_size: Number(subBatchSize),
          chip_model: chipModel.trim(),
          carrier_profile_code: carrierProfileCode,
          pack_purpose: packPurpose,
          material_type: materialType.trim(),
          sku: sku.trim(),
          notes: notes.trim(),
        }),
      }) as SupplierOrderResponse;
      setCreated(data);
      setPack(null);
      setVaultArtifacts([]);
      const firstBid = data.sub_batches?.[0]?.bid || "";
      setQaBid(firstBid);
      setQaSampleUrls("");
      setManifestCsv("");
      setManifestResult(null);
      setManifestQuantityOverrideEnabled(false);
      setManifestQuantityOverrideReason("");
      setActivationLimit("");
      setActivationOverrideEnabled(false);
      setActivationOverrideReason("");
      setErrorReport(null);
      setPackPassword("");
      setPackPasswordVisible(false);
      setOfflineBundleBids(firstBid);
      setOfflineBundle(null);
      setOfflineSelectedDeviceId("");
      setOfflineDevices([]);
      resetLegacyTrialClassificationDraft();
      setStatus(`Pedido creado: ${data.sub_batches?.length || 0} sub-batches. Contrato ${supplierPurposeContract(packPurpose).badge}; las llaves permanecen cifradas bajo el secreto de aplicación.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo crear el pedido.");
    } finally {
      setPending(false);
    }
  }

  async function refreshOrders() {
    setPending(true);
    setStatus("Consultando pedidos industriales existentes...");
    try {
      const data = await run("/api/admin/supplier-orders") as SupplierOrderResponse;
      setOrders(data.orders || []);
      setStatus(`${data.orders?.length || 0} pedidos cargados.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudieron cargar pedidos.");
    } finally {
      setPending(false);
    }
  }

  async function classifyLegacyOrderAsTrial() {
    if (legacyTrialClassificationBlockReason) {
      setStatus(legacyTrialClassificationBlockReason);
      return;
    }
    const reason = legacyTrialReasonContract.reason;
    const signature = legacyTrialClassificationAttemptSignature({
      supplierOrderId: selectedOrderId,
      reason,
      confirmation: legacyTrialConfirmation,
    });
    let attempt = legacyTrialClassificationAttempt.current;
    if (!attempt || attempt.signature !== signature) {
      attempt = {
        signature,
        idempotencyKey: `supplier-purpose:${crypto.randomUUID()}`,
      };
      legacyTrialClassificationAttempt.current = attempt;
    }

    setPending(true);
    setStatus("Registrando la decision auditada. No se modifican llaves, UID, BID, SDM ni estados de activacion.");
    try {
      await run(`/api/admin/supplier-orders/${encodeURIComponent(selectedOrderId)}/purpose/classify-trial`, {
        method: "POST",
        headers: { "Idempotency-Key": attempt.idempotencyKey },
        body: JSON.stringify({
          reason,
          confirmation: legacyTrialConfirmation,
        }),
      });

      const authoritative = await run("/api/admin/supplier-orders") as SupplierOrderResponse;
      const authoritativeOrders = Array.isArray(authoritative.orders) ? authoritative.orders : [];
      const authoritativeOrder = authoritativeOrders.find((order) => order.id === selectedOrderId);
      if (!authoritativeOrder || effectiveSupplierPackPurpose(authoritativeOrder) !== "trial_integration") {
        throw new Error("La decision fue recibida, pero el refresh autoritativo aun no confirma trial_integration. Reintenta exactamente la misma operacion.");
      }
      const authoritativeSubBatches = Array.isArray(authoritativeOrder.sub_batches)
        ? authoritativeOrder.sub_batches
        : [];
      setOrders(authoritativeOrders);
      setCreated({ ok: true, order: authoritativeOrder, sub_batches: authoritativeSubBatches });
      setQaBid((current) => (
        authoritativeSubBatches.some((subBatch) => subBatch.bid === current)
          ? current
          : authoritativeSubBatches[0]?.bid || ""
      ));
      resetLegacyTrialClassificationDraft();
      setStatus("Pedido historico clasificado como trial_integration. Disposicion permanente NON_SELLABLE: no habilita produccion, venta, claim, tokenizacion ni activacion.");
    } catch (error) {
      // Keep the exact key only for retrying this exact payload. Changing the
      // order, reason, or confirmation clears or replaces the attempt.
      setStatus(error instanceof Error ? error.message : "No se pudo clasificar el pedido historico.");
    } finally {
      setPending(false);
    }
  }

  async function loadVaultArtifacts(orderId: string) {
    if (!orderId) return;
    const result = await fetch(`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/vault`, { cache: "no-store" });
    const data = await result.json().catch(() => ({}));
    setResponse(asJson(safeResponseForPath(`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/vault`, data)));
    if (!result.ok || (data && typeof data === "object" && (data as { ok?: unknown }).ok === false)) {
      throw new Error(formatError(data, result.statusText || "No se pudo cargar Tenant Vault."));
    }
    const record = data as { artifacts?: SupplierVaultArtifact[] };
    setVaultArtifacts(Array.isArray(record.artifacts) ? record.artifacts : []);
  }

  async function loadOfflineDevices() {
    if (offlineBlockReason) {
      setStatus(offlineBlockReason);
      return;
    }
    setPending(true);
    setStatus("Consultando dispositivos offline enrolados para este tenant...");
    try {
      const path = `/api/admin/offline-verifier/devices?tenant=${encodeURIComponent(effectiveTenantSlug)}`;
      const data = await run(path) as OfflineVerifierDevicesResponse;
      const devices = Array.isArray(data.devices) ? data.devices : [];
      setOfflineDevices(devices);
      setOfflineSelectedDeviceId((current) => current || devices[0]?.id || "");
      setStatus(`${devices.length} dispositivos offline cargados. Los bundles no contienen K_META, K_FILE ni master keys.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudieron cargar dispositivos offline.");
    } finally {
      setPending(false);
    }
  }

  async function enrollOfflineDevice() {
    if (!canEnrollOfflineDevice) {
      setStatus(offlineBlockReason || "Falta label y fingerprint/public key del dispositivo.");
      return;
    }
    setPending(true);
    setStatus("Enrolando dispositivo offline. La API hashea el identificador y audita el alta.");
    try {
      const data = await run("/api/admin/offline-verifier/devices", {
        method: "POST",
        body: JSON.stringify({
          tenant: effectiveTenantSlug,
          device_label: offlineDeviceLabel.trim(),
          device_type: offlineDeviceType.trim() || "field_app",
          device_fingerprint: offlineDeviceFingerprint.trim(),
          operator_ref: offlineOperatorRef.trim(),
          platform: offlineDeviceType.trim() || "field_app",
        }),
      }) as OfflineVerifierDeviceResponse;
      if (data.device) {
        setOfflineDevices((current) => {
          const remaining = current.filter((device) => device.id !== data.device?.id);
          return [data.device as OfflineVerifierDevice, ...remaining];
        });
        setOfflineSelectedDeviceId(data.device.id);
      }
      setStatus("Dispositivo offline enrolado. No se guardo ninguna master key en el dashboard.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo enrolar el dispositivo offline.");
    } finally {
      setPending(false);
    }
  }

  async function issueOfflineBundle() {
    if (offlineBundleBlockReason) {
      setStatus(offlineBundleBlockReason);
      return;
    }
    setPending(true);
    setStatus("Emitiendo bundle offline con scope de dispositivo, BIDs y vencimiento. Veredicto local queda provisional.");
    try {
      const data = await run("/api/admin/offline-verifier/bundles", {
        method: "POST",
        body: JSON.stringify({
          device_id: offlineSelectedDeviceId,
          bids: offlineBids,
          expires_at: offlineExpiryFromDays(offlineBundleExpiryDays),
        }),
      }) as OfflineVerifierBundleResponse;
      setOfflineBundle(data.bundle || null);
      setStatus(data.warning || "Bundle offline emitido. Sin material de llave; resultado final requiere backend sync.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo emitir el bundle offline.");
    } finally {
      setPending(false);
    }
  }

  async function exportPack() {
    if (!canExportPack) {
      setStatus("Pack de fábrica bloqueado: la sesión no tiene supplier_pack.export. Crear una orden no autoriza generar ni exportar material criptográfico.");
      return;
    }
    if (!selectedOrderId) {
      setStatus("Primero crea o selecciona un Supplier Order.");
      return;
    }
    if (activePackPurpose === "legacy_unclassified") {
      setStatus("Pack bloqueado: el propósito legado debe clasificarse mediante una decisión auditada antes de exportar.");
      return;
    }
    if (!packagingApproved) {
      setStatus(`Pack bloqueado: packaging ${packagingStatus}. Abri el detalle del pedido y completa el release fisico antes de exponer claves a fabrica.`);
      return;
    }
    if (packAlreadyExported) {
      setStatus("Pack bloqueado: este pedido ya tiene evidencia de export. Para reemitir hace falta rotar lote o un override auditado del backend.");
      return;
    }
    const effectivePassword = packPassword.trim()
      || makeLocalPackPassword(created?.order?.customer_slug || customerSlug, created?.order?.tenant_slug || tenantSlug);
    setPackPassword(effectivePassword);
    setPackPasswordVisible(false);
    setPending(true);
    setStatus("Generando ZIP cifrado con TXT/JSON/PDF/checksums por sub-batch. La API no devuelve el password.");
    try {
      const data = await run(`/api/admin/supplier-orders/${encodeURIComponent(selectedOrderId)}/export-pack`, {
        method: "POST",
        body: JSON.stringify({ password: effectivePassword }),
      }) as SupplierPackResponse;
      setPack(data);
      setResponse(asJson(safePackSummary(data)));
      await loadVaultArtifacts(selectedOrderId);
      setStatus(`Pack cifrado listo: ${data.packs?.length || 0} carpetas. Descarga el .zip.enc y envía el password generado localmente por canal separado.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo exportar el pack.");
    } finally {
      setPending(false);
    }
  }

  async function importManifest(dryRun: boolean) {
    const blockReason = dryRun ? manifestBaseBlockReason : manifestImportBlockReason;
    if (blockReason) {
      setStatus(blockReason);
      return;
    }
    setPending(true);
    setStatus(dryRun ? "Validando manifiesto sin escribir datos..." : "Importando manifiesto y registrando evidencia...");
    try {
      const data = await run(`/api/admin/batches/${encodeURIComponent(qaBid.trim())}/import-manifest`, {
        method: "POST",
        body: JSON.stringify({
          csv: manifestCsv,
          dryRun,
          activateImported: false,
          overrideReason: manifestQuantityOverrideReady ? manifestQuantityOverrideReason.trim() : undefined,
        }),
      }) as ManifestImportResponse;
      setManifestResult(data);
      const quantityOverrideUsed = Boolean(data.supplier_gate?.quantity_override);
      if (!dryRun) {
        updateSubBatchStatus(qaBid.trim(), {
          manifest_status: "imported",
          manifest_count: Number(data.inserted || data.importedRows || manifestRows || 0),
        });
        setManifestQuantityOverrideEnabled(false);
        setManifestQuantityOverrideReason("");
        await loadVaultArtifacts(selectedOrderId);
      }
      const count = Number(data.inserted || data.importedRows || manifestRows || 0);
      setStatus(dryRun
        ? `Preflight OK: ${count} filas válidas para ${qaBid.trim()}. Todavía no se activó nada.${quantityOverrideUsed ? " Se evaluó una excepción de cantidad auditada." : ""}`
        : `Manifiesto importado: ${count} UIDs registrados.${quantityOverrideUsed ? " Diferencia de cantidad aceptada bajo excepción superadmin auditada." : ""} Ahora falta QA aprobado antes de activar.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo importar el manifiesto.");
    } finally {
      setPending(false);
    }
  }

  async function activateSubBatch() {
    if (activationBlockReason) {
      setStatus(`Activacion bloqueada: ${activationBlockReason}`);
      return;
    }
    const limit = Math.max(0, Math.trunc(Number(activationLimit || 0)));
    const activationSignature = JSON.stringify({
      bid: qaBid.trim().toUpperCase(),
      selection_mode: limit > 0 ? "count" : "all",
      limit,
      override_reason: activationOverrideReady ? activationOverrideReason.trim() : "",
    });
    let activationOperationKey = activationOperationKeys.current.get(activationSignature);
    if (!activationOperationKey) {
      activationOperationKey = `supplier-activation:${crypto.randomUUID()}`;
      activationOperationKeys.current.set(activationSignature, activationOperationKey);
    }
    setPending(true);
    setStatus(limit > 0 ? `Activando hasta ${limit} tags del sub-batch...` : "Activando todos los tags pendientes del sub-batch...");
    try {
      const data = await run(`/api/admin/batches/${encodeURIComponent(qaBid.trim())}/activate-all`, {
        method: "POST",
        headers: { "Idempotency-Key": activationOperationKey },
        body: JSON.stringify({
          limit,
          override_reason: activationOverrideReady ? activationOverrideReason.trim() : undefined,
        }),
      }) as ActivationResponse;
      activationOperationKeys.current.delete(activationSignature);
      const activationOverrideUsed = Boolean(data.supplier_gate?.override);
      updateSubBatchStatus(qaBid.trim(), {
        status: data.activationComplete ? "activated" : "partially_activated",
        manufacturing_state: data.activationComplete ? "ACTIVATED" : selectedSubBatch?.manufacturing_state,
        activated_at: data.activationComplete ? new Date().toISOString() : selectedSubBatch?.activated_at,
      });
      setActivationOverrideEnabled(false);
      setActivationOverrideReason("");
      setStatus(data.activationComplete
        ? `Sub-batch activo: ${data.activated || 0} tags activados y sin pendientes.${activationOverrideUsed ? " El backend aceptó la excepción explícita de cantidad." : ""}`
        : `Activación parcial: ${data.activated || 0} tags activados, ${data.remainingInactive || 0} pendientes.${activationOverrideUsed ? " El backend aceptó la excepción explícita de cantidad." : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo activar el sub-batch.");
    } finally {
      setPending(false);
    }
  }

  async function markQa(passed: boolean) {
    if (!canRunQa) {
      setStatus("Tu perfil no puede aprobar QA. Necesitás permiso de lotes o supplier QA.");
      return;
    }
    if (!selectedOrderId || !qaBid.trim()) {
      setStatus("Falta order y BID para QA.");
      return;
    }
    if (passed && qaPassBlockReason) {
      setStatus(qaPassBlockReason);
      return;
    }
    if (!passed && qaRejectBlockReason) {
      setStatus(qaRejectBlockReason);
      return;
    }
    const qaNotes = passed
      ? "QA solicitado desde consola supplier; veredicto derivado exclusivamente por el backend desde diagnosticos SUN persistidos."
      : "QA rechazado desde consola supplier. No activar este sub-batch.";
    const qaRequestSignature = JSON.stringify({
      supplier_order_id: selectedOrderId,
      bid: qaBid.trim(),
      passed,
      snapshot_urls: passed ? qaUrls : [],
      notes: qaNotes,
    });
    let qaOperationKey = qaOperationKeys.current.get(qaRequestSignature);
    if (!qaOperationKey) {
      qaOperationKey = `qa:${crypto.randomUUID()}`;
      qaOperationKeys.current.set(qaRequestSignature, qaOperationKey);
    }
    setPending(true);
    setStatus(passed ? "Verificando recibos SUN persistidos contra eventos canonicos..." : "Marcando QA rechazado...");
    try {
      await run(`/api/admin/supplier-orders/${encodeURIComponent(selectedOrderId)}/qa`, {
        method: "POST",
        headers: { "Idempotency-Key": qaOperationKey },
        body: JSON.stringify({
          bid: qaBid.trim(),
          passed,
          snapshot_urls: passed ? qaUrls : [],
          notes: qaNotes,
        }),
      });
      updateSubBatchStatus(qaBid.trim(), { qa_status: passed ? "passed" : "failed" });
      setStatus(passed
        ? `QA aprobado por evidencia SUN: ${qaRequiredManifestUids} UIDs unicos, replay ligado al evento original${requiresTtstatus ? " y apertura TagTamper electronica" : ""}.`
        : "QA rechazado. No activar este sub-batch.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo actualizar QA.");
    } finally {
      setPending(false);
    }
  }

  function downloadEncryptedPack() {
    const encrypted = pack?.encrypted_pack;
    if (!encrypted) return;
    downloadBase64(encrypted.filename, encrypted.base64, encrypted.mime_type || "application/octet-stream");
  }

  function downloadSafeSummary() {
    if (!pack) return;
    downloadText(`supplier-pack-summary-${selectedOrderId}.json`, asJson(safePackSummary(pack)), "application/json;charset=utf-8");
  }

  function downloadErrorReport() {
    if (!errorReport) return;
    downloadText(errorReport.filename, errorReport.csv, "text/csv;charset=utf-8");
  }

  function selectExistingOrder(order: SupplierOrder) {
    const subBatchesFromOrder = Array.isArray(order.sub_batches) ? order.sub_batches : [];
    setCreated({ ok: true, order, sub_batches: subBatchesFromOrder });
    setPack(null);
    setVaultArtifacts([]);
    setQaBid(subBatchesFromOrder[0]?.bid || "");
    setQaSampleUrls("");
    setManifestCsv("");
    setManifestResult(null);
    setManifestQuantityOverrideEnabled(false);
    setManifestQuantityOverrideReason("");
    setActivationLimit("");
    setActivationOverrideEnabled(false);
    setActivationOverrideReason("");
    setErrorReport(null);
    setPackPassword("");
    setPackPasswordVisible(false);
    setOfflineBundleBids(subBatchesFromOrder[0]?.bid || "");
    setOfflineBundle(null);
    setOfflineSelectedDeviceId("");
    setOfflineDevices([]);
    resetLegacyTrialClassificationDraft();
    setStatus(`Pedido seleccionado: ${order.order_name || order.id}. ${subBatchesFromOrder.length} sub-batches. Contrato ${supplierPurposeContract(effectiveSupplierPackPurpose(order)).badge}.`);
    void loadVaultArtifacts(order.id).catch((error) => {
      setStatus(error instanceof Error ? error.message : "No se pudo cargar Tenant Vault.");
    });
  }

  return (
    <Card className="overflow-hidden border-cyan-300/20 bg-slate-950/80">
      <div className="grid gap-6 p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Supplier Order industrial</p>
          <h2 className="mt-2 text-2xl font-black text-white">Pedido de tags listo para fábrica</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Crea sub-batches, genera credenciales por lote, las guarda cifradas, exporta pack de fábrica solo para superadmin y bloquea activación hasta manifest + QA.
          </p>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-slate-300">
              <span className="flex items-center gap-2 font-black uppercase tracking-[0.14em] text-cyan-100">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Perfil activo
              </span>
              <span className="mt-1 block text-slate-400">{normalizedRole || "sin rol"} / {currentPermissions.length ? currentPermissions.join(", ") : "sin permisos explicitos"}</span>
            </div>
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-emerald-50">
              <span className="flex items-center gap-2 font-black uppercase tracking-[0.14em] text-emerald-100">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Proxima accion
              </span>
              <span className="mt-1 block">{nextAction}</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Tenant slug" value={tenantSlug} onChange={setTenantSlug} placeholder="bodega-balmec o agro-enterprise-ar" />
            <Field label="Customer slug" value={customerSlug} onChange={setCustomerSlug} placeholder="opcional, por defecto tenant" />
            <Field label="Order name" value={orderName} onChange={setOrderName} placeholder="SYN-AR-2026-001" />
            <Field label="Base batch ID" value={baseBatchId} onChange={setBaseBatchId} placeholder="SYN-AR-2026-001" />
            <Field label="Cantidad total" value={totalQuantity} onChange={setTotalQuantity} placeholder="5000" />
            <Field label="Tamaño sub-batch" value={subBatchSize} onChange={setSubBatchSize} placeholder="1000" />
            <Field label="Chip model" value={chipModel} onChange={setChipModel} placeholder="NTAG 424 DNA" />
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Carrier profile</span>
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"
                value={carrierProfileCode}
                onChange={(event) => setCarrierProfileCode(event.target.value)}
              >
                {carrierProfiles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {isIotTrackerEvidenceCarrier(carrierProfileCode) ? (
                <span data-testid="supplier-iot-tracker-evidence-boundary" className="mt-2 block rounded-lg border border-cyan-300/20 bg-cyan-400/[0.06] px-3 py-2 text-xs leading-5 text-slate-300">
                  {IOT_TRACKER_EVIDENCE_DESCRIPTION}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Propósito comercial</span>
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"
                value={packPurpose}
                onChange={(event) => setPackPurpose(event.target.value as SupplierPackPurpose)}
              >
                <option value="" disabled>Seleccionar explícitamente</option>
                <option value="trial_integration">Trial de integración · NON_SELLABLE</option>
                <option value="production">Producción · bloqueada hasta QA v2</option>
              </select>
            </label>
            <Field label="Material" value={materialType} onChange={setMaterialType} placeholder="Etiqueta NFC industrial" />
            <Field label="SKU" value={sku} onChange={setSku} placeholder="opcional" />
          </div>
          <div className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${creationPurposeContract.className}`} data-testid="supplier-pack-purpose-contract">
            <b className="font-black uppercase tracking-[0.12em]">{creationPurposeContract.badge}</b>
            <span className="ml-2">{creationPurposeContract.detail}</span>
          </div>
          <textarea
            className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notas: region piloto, proveedor, empaque, requisitos de QC..."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button className="gap-2" disabled={pending || Boolean(createOrderBlockReason)} title={createOrderBlockReason || "Crear orden y sub-batches"} onClick={() => void createOrder()}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {pending ? "Procesando..." : "Crear Supplier Order"}
            </Button>
            <Button className="gap-2" variant="secondary" disabled={pending} onClick={() => void refreshOrders()}>
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              Ver pedidos
            </Button>
          </div>
          {createOrderBlockReason ? <p className="mt-2 text-xs text-amber-100">{createOrderBlockReason}</p> : null}
          <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm leading-6 text-cyan-50">{status}</p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Metric label="Sub-batches" value={String(subBatches.length)} />
            <Metric label="Propósito" value={activePurposeContract.badge} />
            <Metric label="Pack" value={packAlreadyExported ? "exportado" : "pendiente"} />
            <Metric label="Packaging" value={`${packagingStatus} · r${created?.order?.packaging_spec_revision || 0}`} />
            <Metric label="Manifiesto" value={selectedSubBatch?.manifest_status || "pendiente"} />
            <Metric label="QA BID" value={qaBid || "pendiente"} />
          </div>
          {selectedOrderId ? (
            <div
              className={`rounded-xl border px-3 py-2 text-xs leading-5 ${activePurposeContract.className}`}
              data-testid="supplier-pack-purpose-resolution"
            >
              <b>Proposito declarado:</b> {declaredPackPurpose}
              <span className="mx-2 text-slate-400">/</span>
              <b>Proposito efectivo:</b> {activePackPurpose}
              <span className="mx-2 text-slate-400">/</span>
              <b>Decision:</b> {created?.order?.classification_decision_id || "sin decision adicional"}
            </div>
          ) : null}

          {subBatches.length ? (
            <div className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-slate-950/60 p-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Sub-batches creados</p>
              <div className="mt-3 space-y-2">
                {subBatches.map((item) => (
                  <button
                    key={item.bid}
                    type="button"
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${qaBid === item.bid ? "border-cyan-300/50 bg-cyan-500/15 text-cyan-50" : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-300/30"}`}
                    onClick={() => {
                      setQaBid(item.bid);
                      setManifestResult(null);
                      setManifestQuantityOverrideEnabled(false);
                      setManifestQuantityOverrideReason("");
                      setActivationOverrideEnabled(false);
                      setActivationOverrideReason("");
                      setErrorReport(null);
                    }}
                  >
                    <b className="text-white">{item.bid}</b>
                    <span className="ml-2 text-slate-400">{item.expected_quantity || 0} tags</span>
                    <span className="mt-1 block text-cyan-200">fingerprint {item.key_fingerprint || "pendiente"}</span>
                    <span className="mt-1 block font-black text-amber-100">{activePurposeContract.badge}</span>
                    <span className="mt-1 block text-slate-400">manifest {item.manifest_status || "pending"} / QA {item.qa_status || "pending"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : orders.length ? (
            <div className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-slate-950/60 p-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Ultimos pedidos</p>
              <div className="mt-3 space-y-2">
                {orders.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-300/35"
                    onClick={() => selectExistingOrder(item)}
                  >
                    <b className="text-white">{item.order_name || item.id}</b>
                    <span className="ml-2 text-cyan-200">{item.tenant_slug || item.customer_slug}</span>
                    <span className="mt-1 block text-slate-400">{item.total_quantity || 0} tags / {item.status || "estado pendiente"}</span>
                    <span className="mt-1 block font-black text-amber-100">{supplierPurposeContract(effectiveSupplierPackPurpose(item)).badge}</span>
                    <span className="mt-1 block text-cyan-200">{item.sub_batches?.length || 0} sub-batches. Click para operar.</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
              Todavía no hay un pedido en esta sesión. Crea uno o carga la lista de pedidos existentes.
            </div>
          )}

          {selectedOrderId && activePackPurpose === "legacy_unclassified" ? (
            <section
              className="rounded-2xl border-2 border-rose-300/50 bg-rose-500/15 p-4 shadow-[0_0_30px_rgba(244,63,94,0.12)]"
              data-testid="legacy-trial-classification-panel"
              aria-labelledby="legacy-trial-classification-title"
            >
              <div
                id="legacy-trial-classification-warning"
                className="rounded-xl border border-rose-200/35 bg-slate-950/70 p-3 text-sm leading-6 text-rose-50"
                role="alert"
              >
                <p id="legacy-trial-classification-title" className="font-black uppercase tracking-[0.14em] text-rose-100">
                  Decision irreversible: trial NON_SELLABLE permanente
                </p>
                <p className="mt-2">
                  Este flujo existe solo para pedidos historicos sin proposito. No convierte el lote en produccion y nunca habilita venta, claim, tokenizacion, marketplace ni activacion. No modifica K_META, K_FILE, UID, BID ni SDM.
                </p>
              </div>

              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <Metric label="Declarado" value={declaredPackPurpose} />
                <Metric label="Efectivo" value={activePackPurpose} />
                <Metric label="Decision" value={created?.order?.classification_decision_id || "pendiente"} />
              </div>

              <label className="mt-3 block" htmlFor="legacy-trial-reason">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-rose-100">Razon auditada (16-1000)</span>
                <textarea
                  id="legacy-trial-reason"
                  className="mt-1 min-h-24 w-full rounded-xl border border-rose-200/25 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
                  value={legacyTrialReason}
                  minLength={16}
                  maxLength={1000}
                  disabled={pending || !canClassifyLegacyTrial}
                  aria-describedby="legacy-trial-classification-warning legacy-trial-reason-count"
                  onChange={(event) => {
                    setLegacyTrialReason(event.target.value);
                    legacyTrialClassificationAttempt.current = null;
                  }}
                  placeholder="Explica por que este pedido historico corresponde exclusivamente a una prueba de integracion no vendible."
                />
                <span id="legacy-trial-reason-count" className="mt-1 block text-xs text-rose-100/80">
                  {legacyTrialReasonContract.length}/1000 caracteres
                </span>
              </label>

              <label className="mt-3 block" htmlFor="legacy-trial-confirmation">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-rose-100">Confirmacion exacta</span>
                <input
                  id="legacy-trial-confirmation"
                  className="mt-1 w-full rounded-xl border border-rose-200/25 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-500"
                  value={legacyTrialConfirmation}
                  disabled={pending || !canClassifyLegacyTrial}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="legacy-trial-classification-warning"
                  onChange={(event) => {
                    setLegacyTrialConfirmation(event.target.value);
                    legacyTrialClassificationAttempt.current = null;
                  }}
                  placeholder={LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION}
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  className="gap-2 border-rose-200/40 bg-rose-500/20 text-rose-50 hover:bg-rose-500/30"
                  disabled={!canClassifyCurrentLegacyOrder}
                  title={legacyTrialClassificationBlockReason || "Clasificar de forma auditada como trial NON_SELLABLE"}
                  onClick={() => void classifyLegacyOrderAsTrial()}
                >
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  Clasificar como trial NON_SELLABLE
                </Button>
                <span className="text-xs leading-5 text-rose-100">
                  {legacyTrialClassificationBlockReason || "El backend enumera sub-batches y recibos QA; el navegador no envia ese scope."}
                </span>
              </div>
            </section>
          ) : null}

          {selectedOrderId && selectedSubBatch && activePackPurpose === "production" ? (
            <SupplierProductionAcceptancePanel
              key={`${selectedOrderId}:${selectedSubBatch.bid}`}
              orderId={selectedOrderId}
              bid={selectedSubBatch.bid}
              disabled={pending}
              onDecision={(qaStatus) => updateSubBatchStatus(selectedSubBatch.bid, { qa_status: qaStatus })}
            />
          ) : null}

          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Export pack</p>
            <p className="mt-2 text-sm leading-6 text-amber-50">
              {canExportPack
                ? "Superadmin activo: genera un contenedor cifrado con carpetas por sub-batch, TXT/JSON/PDF y checksums. El password se genera en esta consola, no vuelve desde la API y debe enviarse por canal separado."
                : "Bloqueado para este perfil: manifiestos, QA y Vault siguen disponibles, pero ningún permiso de tenant habilita el pack con llaves de fábrica."}
            </p>
            {selectedOrderId ? (
              <a
                className="mt-3 inline-flex rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/20"
                href={`/supplier-orders/${encodeURIComponent(selectedOrderId)}`}
              >
                Abrir especificación y aprobación de packaging
              </a>
            ) : null}
            <p className="mt-3 rounded-xl border border-amber-200/20 bg-slate-950/55 px-3 py-2 text-xs leading-5 text-amber-50/90">
              Custodia NFC piloto: envelope AES-256-GCM con secreto de aplicacion versionado en Vercel y AAD por tenant, lote, rol y version. No es KMS administrado ni HSM; la migracion a custodia no exportable sigue siendo un gate de produccion enterprise.
            </p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Password de fábrica</span>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-500"
                      value={packPassword}
                      disabled={!canExportCurrentPack}
                    onChange={(event) => setPackPassword(event.target.value)}
                    placeholder="Generar antes de exportar"
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={!canExportCurrentPack}
                    onClick={() => {
                      setPackPassword(makeLocalPackPassword(created?.order?.customer_slug || customerSlug, created?.order?.tenant_slug || tenantSlug));
                      setPackPasswordVisible(false);
                    }}
                  >
                    Generar
                  </Button>
                </div>
              </label>
              <p className="mt-2 text-xs leading-5 text-amber-50/85">
                Guardalo en el gestor seguro del operador y compartilo con fábrica por otro canal. nexID no lo devuelve en la respuesta del export.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="gap-2" disabled={!canExportCurrentPack} title={exportPackBlockReason || "Exportar pack cifrado una sola vez"} onClick={() => void exportPack()}>
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Exportar pack
              </Button>
              <Button className="gap-2" variant="secondary" disabled={!pack?.encrypted_pack || !canExportPack || activePackPurpose === "legacy_unclassified"} onClick={downloadEncryptedPack}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Descargar ZIP cifrado
              </Button>
              <Button className="gap-2" variant="secondary" disabled={!pack || !canExportPack} onClick={downloadSafeSummary}>
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                Resumen seguro
              </Button>
              <Button className="gap-2" variant="secondary" disabled={pending || !selectedOrderId} onClick={() => void loadVaultArtifacts(selectedOrderId).catch((error) => setStatus(error instanceof Error ? error.message : "No se pudo cargar Tenant Vault."))}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Ver Tenant Vault
              </Button>
            </div>
            {exportPackBlockReason ? <p className="mt-2 text-xs leading-5 text-amber-100">{exportPackBlockReason}</p> : null}
            {packPassword ? (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 font-mono">
                  Password local: <span className="break-all">{packPasswordVisible ? packPassword : "********************"}</span>
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-cyan-300/25 px-3 py-1 font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200"
                  onClick={() => setPackPasswordVisible((value) => !value)}
                >
                  {packPasswordVisible ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            ) : null}
            {pack?.encrypted_pack?.envelope_sha256 ? (
              <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-300">
                <p>Envelope: <span className="font-mono text-cyan-100">{pack.encrypted_pack.envelope_sha256}</span></p>
                <p>ZIP interno: <span className="font-mono text-cyan-100">{pack.encrypted_pack.plaintext_zip_sha256}</span></p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Tenant Vault</p>
                <p className="mt-2 text-sm leading-6 text-cyan-50">
                  Evidencia operativa visible para el tenant: hashes, PDF, JSON, ZIP cifrado y estado. No expone storage interno, llaves ni passwords.
                </p>
              </div>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100">
                {vaultArtifacts.length} artefactos
              </span>
            </div>
            {vaultArtifacts.length ? (
              <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                {vaultArtifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b className="text-white">{artifact.artifact_type || "artifact"}</b>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-cyan-100">{artifact.bid || artifact.resource_type || "order"}</span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-cyan-100">{artifact.content_hash || "hash pendiente"}</p>
                    <p className="mt-1 text-slate-400">{artifact.mime_type || "mime n/a"} / {artifact.status || "active"} / {artifact.created_at ? new Date(artifact.created_at).toLocaleString("es-AR") : "sin fecha"}</p>
                    {safeVaultMetadataEntries(artifact.metadata).length ? (
                      <p className="mt-1 truncate text-slate-500">{safeVaultMetadataEntries(artifact.metadata).join(" / ")}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-xs leading-5 text-slate-300">
                Sin artefactos visibles todavia. Exporta el pack o importa el manifest para poblar el Vault.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-teal-300/20 bg-teal-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">Offline verifier</p>
                <p className="mt-2 text-sm leading-6 text-teal-50">
                  Modo de baja conectividad para campo, cavas, plantas, minas y depositos: enrola un celular/lector, emite un bundle por BIDs y sincroniza evidencia hasheada cuando vuelve la senal.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                <span className="rounded-full border border-teal-300/25 bg-teal-400/10 px-3 py-1 text-teal-100">Provisional</span>
                <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-amber-100">No master keys</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-200">Final sync backend</span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Device label" value={offlineDeviceLabel} onChange={setOfflineDeviceLabel} placeholder="Samsung S24 campo norte" />
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Device type</span>
                <select
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"
                  value={offlineDeviceType}
                  onChange={(event) => setOfflineDeviceType(event.target.value)}
                >
                  <option value="field_app">Android/iOS app</option>
                  <option value="nfc_reader">NFC reader</option>
                  <option value="uhf_reader">UHF reader</option>
                  <option value="rugged_scanner">Rugged scanner</option>
                </select>
              </label>
              <Field label="Public key / fingerprint" value={offlineDeviceFingerprint} onChange={setOfflineDeviceFingerprint} placeholder="public key or sha256 fingerprint, never private key" />
              <Field label="Operator ref" value={offlineOperatorRef} onChange={setOfflineOperatorRef} placeholder="turno, tecnico o contratista" />
            </div>

            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">BIDs autorizados</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-500"
                value={offlineBundleBids}
                onChange={(event) => setOfflineBundleBids(event.target.value)}
                placeholder={qaBid || "SYN-AR-2026-001-A, SYN-AR-2026-001-B"}
              />
              <span className="mt-1 block text-xs text-slate-400">
                {offlineBids.length} BID(s) en scope. Si queda vacio, se usa el BID seleccionado.
              </span>
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-[0.45fr_1fr]">
              <Field label="TTL dias" value={offlineBundleExpiryDays} onChange={setOfflineBundleExpiryDays} placeholder="1 a 30" />
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Dispositivo enrolado</span>
                <select
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"
                  value={offlineSelectedDeviceId}
                  onChange={(event) => setOfflineSelectedDeviceId(event.target.value)}
                >
                  <option value="">Sin dispositivo seleccionado</option>
                  {offlineDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.device_label || device.id} / {device.status || "status"} / {device.device_fingerprint || "fingerprint"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="gap-2" variant="secondary" disabled={!canLoadOfflineDevices} title={offlineBlockReason || "Cargar dispositivos offline"} onClick={() => void loadOfflineDevices()}>
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                Ver dispositivos
              </Button>
              <Button className="gap-2" variant="secondary" disabled={!canEnrollOfflineDevice} title={offlineBlockReason || "Enrolar dispositivo offline"} onClick={() => void enrollOfflineDevice()}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Enrolar dispositivo
              </Button>
              <Button className="gap-2" disabled={!canIssueOfflineBundle} title={offlineBundleBlockReason || "Emitir bundle offline"} onClick={() => void issueOfflineBundle()}>
                <CloudOff className="h-4 w-4" aria-hidden="true" />
                Emitir bundle offline
              </Button>
            </div>
            {(offlineBlockReason || offlineBundleBlockReason) ? (
              <p className="mt-2 text-xs leading-5 text-teal-100">{offlineBlockReason || offlineBundleBlockReason}</p>
            ) : null}

            {offlineDevices.length ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {offlineDevices.slice(0, 4).map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${offlineSelectedDeviceId === device.id ? "border-teal-300/50 bg-teal-500/15 text-teal-50" : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-teal-300/30"}`}
                    onClick={() => setOfflineSelectedDeviceId(device.id)}
                  >
                    <b className="text-white">{device.device_label || device.id}</b>
                    <span className="ml-2 text-teal-200">{device.device_type || "field_app"}</span>
                    <span className="mt-1 block font-mono text-[11px] text-slate-400">{device.device_fingerprint || "fingerprint pendiente"}</span>
                    <span className="mt-1 block text-slate-500">{device.operator_ref || "sin operador"} / {device.last_seen_at ? `sync ${new Date(device.last_seen_at).toLocaleString("es-AR")}` : "sin sync"}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {offlineBundle ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/65 p-3 text-xs text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-white">Bundle emitido</b>
                  <span className="rounded-full border border-teal-300/25 px-2 py-0.5 font-mono text-[10px] text-teal-100">{offlineBundle.bundle_ref || offlineBundle.id}</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Metric label="BIDs" value={String(offlineBundle.allowed_bids?.length || 0)} />
                  <Metric label="Keys" value={offlineBundle.key_material_included === false ? "fingerprints" : "revisar"} />
                  <Metric label="Estado" value={offlineBundle.status || "active"} />
                </div>
                <p className="mt-2 break-all font-mono text-[11px] text-teal-100">{offlineBundle.bundle_hash || "hash pendiente"}</p>
                <p className="mt-2 text-slate-400">
                  Vence: {offlineBundle.expires_at ? new Date(offlineBundle.expires_at).toLocaleString("es-AR") : "sin fecha"}.
                  Requiere backend para {offlineBundle.policy?.requires_backend_sync_for?.join(", ") || "replay, ownership, warranty, CRM y proof anchors"}.
                </p>
              </div>
            ) : null}

            <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
              Este modo no certifica ownership, warranty, CRM ni proof anchors sin backend. El bundle no incluye K_META_BATCH, K_FILE_BATCH, la clave maestra de aplicación ni tenant master keys.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-100">Manifiesto + activación</p>
                <p className="mt-2 text-sm leading-6 text-sky-50">
                  Flujo de fábrica: primero se valida el archivo recibido, después se importa, luego QA evalúa muestras del manifiesto mediante evidencia SUN y recién ahí se habilita la activación. La evidencia digital no sustituye el protocolo físico de recepción.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-sky-100">{qaBid || "sin BID"}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-200">{manifestRows} filas</span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">QA {selectedSubBatch?.qa_status || "pendiente"}</span>
                <span className={`rounded-full border px-3 py-1 ${activePurposeContract.className}`}>{activePurposeContract.badge}</span>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">CSV/TXT recibido del proveedor</span>
              <textarea
                className="mt-1 min-h-32 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-500"
                value={manifestCsv}
                onChange={(event) => {
                  setManifestCsv(event.target.value);
                  setManifestResult(null);
                  setErrorReport(null);
                }}
                placeholder={"uid_hex,bid,product_name,sku,lot,serial\n04AABBCCDD0011,SYN-AR-2026-001-A,Producto,SKU-001,LOT-001,SER-001"}
              />
              <span className="mt-1 block text-xs text-slate-400">
                No activa tags durante el dry-run. La importación queda registrada en Tenant Vault y no expone llaves.
              </span>
            </label>

            {manifestDraftQuantityMismatch ? (
              <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-50" data-testid="supplier-manifest-quantity-override">
                <b>Diferencia detectada:</b> el archivo tiene {manifestRows} filas y el sub-batch espera {selectedExpectedQuantity}.
                {isSuperAdmin ? (
                  <>
                    <label className="mt-2 flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={manifestQuantityOverrideEnabled}
                        onChange={(event) => setManifestQuantityOverrideEnabled(event.target.checked)}
                      />
                      <span>Registrar una excepción de cantidad superadmin. Esta excepción no activa tags, no corrige UIDs y no reemplaza QA.</span>
                    </label>
                    {manifestQuantityOverrideEnabled ? (
                      <label className="mt-2 block">
                        <span className="font-semibold uppercase tracking-[0.1em]">Razón auditada (mínimo 16 caracteres)</span>
                        <textarea
                          className="mt-1 min-h-20 w-full rounded-xl border border-amber-200/25 bg-slate-950 px-3 py-2 text-sm text-white"
                          minLength={16}
                          maxLength={1000}
                          value={manifestQuantityOverrideReason}
                          onChange={(event) => setManifestQuantityOverrideReason(event.target.value)}
                        />
                      </label>
                    ) : null}
                  </>
                ) : (
                  <span className="mt-1 block">Corregí el archivo o pedí a un superadmin una excepción auditada; este perfil no puede concederla.</span>
                )}
              </div>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-[0.45fr_1fr]">
              <Field label="Límite activación" value={activationLimit} onChange={setActivationLimit} placeholder="0 = todos" />
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs leading-5 text-slate-300">
                <b className="text-white">Regla de seguridad</b>
                <span className="mt-1 block">
                  El botón de activación queda bloqueado hasta tener <span className="text-cyan-100">manifiesto importado</span> y <span className="text-emerald-100">QA aprobado</span>.
                </span>
              </div>
            </div>

            {importedManifestQuantityMismatch ? (
              <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-xs leading-5 text-rose-50" data-testid="supplier-activation-quantity-override">
                <b>Gate de activación:</b> se importaron {selectedManifestCount} UIDs para {selectedExpectedQuantity} planificados.
                {canUseActivationOverride ? (
                  <>
                    <label className="mt-2 flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={activationOverrideEnabled}
                        onChange={(event) => setActivationOverrideEnabled(event.target.checked)}
                      />
                      <span>Autorizar sólo esta diferencia de cantidad. No permite omitir manifiesto, QA ni la aceptación de producción de dos actores.</span>
                    </label>
                    {activationOverrideEnabled ? (
                      <label className="mt-2 block">
                        <span className="font-semibold uppercase tracking-[0.1em]">Razón obligatoria para el gate (mínimo 16 caracteres)</span>
                        <textarea
                          className="mt-1 min-h-20 w-full rounded-xl border border-rose-200/25 bg-slate-950 px-3 py-2 text-sm text-white"
                          minLength={16}
                          maxLength={1000}
                          value={activationOverrideReason}
                          onChange={(event) => setActivationOverrideReason(event.target.value)}
                        />
                      </label>
                    ) : null}
                  </>
                ) : (
                  <span className="mt-1 block">Este perfil no puede conceder la excepción. La activación permanece bloqueada.</span>
                )}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="gap-2" variant="secondary" disabled={!canDryRunManifest} title={manifestBaseBlockReason || "Validar manifiesto sin escribir datos"} onClick={() => void importManifest(true)}>
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                Validar sin importar
              </Button>
              <Button className="gap-2" disabled={!canImportManifest} title={manifestImportBlockReason || "Importar manifiesto auditado"} onClick={() => void importManifest(false)}>
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Importar manifiesto
              </Button>
              <Button className="gap-2" disabled={!canActivateSubBatch} title={activationBlockReason || "Activar sub-batch"} onClick={() => void activateSubBatch()}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Activar sub-batch
              </Button>
              {errorReport?.stage === "manifest" ? (
                <Button className="gap-2" variant="secondary" onClick={downloadErrorReport}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Descargar CSV de errores ({errorReport.rowCount})
                </Button>
              ) : null}
            </div>
            {(manifestImportBlockReason || activationBlockReason) ? (
              <p className="mt-2 text-xs leading-5 text-sky-100">
                {manifestImportBlockReason || activationBlockReason}
              </p>
            ) : null}
            <p className="mt-2 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
              Las excepciones disponibles son únicamente de cantidad y requieren una razón explícita. El import de manifiesto persiste su razón en evidencia; la activación valida la razón y audita la operación. Ninguna excepción permite saltar el manifiesto, el QA o la separación de actores de producción.
            </p>

            {manifestResult ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-white">{manifestResult.dryRun ? "Validación de manifiesto" : "Manifiesto importado"}</b>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-sky-100">{manifestResult.bid || qaBid}</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Metric label="Filas" value={String(manifestResult.inserted || manifestResult.importedRows || manifestRows || 0)} />
                  <Metric label="SUN payloads" value={String(manifestResult.registeredSunPayloads || 0)} />
                  <Metric label="Estado" value={manifestResult.ok ? "OK" : "revisar"} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">QA gate</p>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${activePurposeContract.className}`}>{activePurposeContract.badge}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-50">
              La ceremonia operativa exige escaneo físico; el backend verifica {qaRequiredManifestUids} UIDs distintos mediante eventos SUN canónicos, CMAC/SDM y un replay ligado al evento original. {requiresTtstatus ? "Además exige TT electrónico cerrado y una apertura sacrificial posterior." : "No acepta casillas ni declaraciones manuales."}
            </p>
            <div className="mt-3">
              <Field
                label="BID para QA"
                value={qaBid}
                onChange={(value) => {
                  setQaBid(value);
                  setManifestResult(null);
                  setManifestQuantityOverrideEnabled(false);
                  setManifestQuantityOverrideReason("");
                  setActivationOverrideEnabled(false);
                  setActivationOverrideReason("");
                  setErrorReport(null);
                }}
                placeholder="SYN-AR-2026-001-A"
              />
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Recibos SUN de la ceremonia (snapshot + trace)</span>
              <textarea
                className="mt-1 min-h-36 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-500"
                value={qaSampleUrls}
                onChange={(event) => setQaSampleUrls(event.target.value)}
                placeholder="https://nexid.lat/sun?snapshot=123&trace=nexid_..."
              />
              <span className="mt-1 block text-xs text-slate-400">
                {qaUrls.length}/{qaMinimumDiagnosticReceipts} recibos mínimos con formato válido. Las URLs SUN crudas con picc_data/enc/cmac no se adjuntan ni se guardan aquí.
              </span>
            </label>
            <div className="mt-3 rounded-xl border border-cyan-300/20 bg-slate-950/50 p-3 text-xs leading-5 text-slate-300">
              <b className="text-cyan-100">Secuencia:</b> escanea cada tag físicamente y copia la URL de la página de resultado; vuelve a abrir la URL SUN original para producir el replay y copia también ese resultado. {requiresTtstatus ? "Finalmente abre un tag sacrificial, escanéalo de nuevo, revoca ese UID para que nunca sea vendible y agrega el recibo VALID_OPENED con contador mayor." : "El servidor cruza cada replay con el evento canónico original."} La evidencia digital respalda la ceremonia, pero no prueba por sí sola el contacto NFC presencial.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="gap-2" disabled={!canPassQa} title={qaPassBlockReason || "Aprobar QA con evidencia"} onClick={() => void markQa(true)}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Aprobar QA
              </Button>
              <Button className="gap-2" variant="secondary" disabled={!canRejectQa} title={qaRejectBlockReason || "Rechazar QA"} onClick={() => void markQa(false)}>
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                Rechazar QA
              </Button>
              {errorReport?.stage === "qa" ? (
                <Button className="gap-2" variant="secondary" onClick={downloadErrorReport}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Descargar CSV de errores ({errorReport.rowCount})
                </Button>
              ) : null}
            </div>
            {(qaPassBlockReason || qaRejectBlockReason) ? (
              <p className="mt-2 text-xs leading-5 text-emerald-100">{qaPassBlockReason || qaRejectBlockReason}</p>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Carrier activo: <span className="font-mono text-cyan-100">{activeCarrierProfile}</span>. {supportsSunQa ? "El veredicto se deriva de eventos SUN canónicos posteriores al manifiesto y ligados al tenant/batch/BID; la UI no puede autoaprobarlo." : "No hay fallback auto-declarado: falta implementar el contrato QA específico para este carrier."}
            </p>
          </div>

          <pre className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{response}</pre>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
      <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <b className="mt-1 block truncate text-lg text-white">{value}</b>
    </div>
  );
}
