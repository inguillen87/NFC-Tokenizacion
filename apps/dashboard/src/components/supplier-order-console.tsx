"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@product/ui";
import { CheckCircle2, Download, FileCheck2, LockKeyhole, ShieldCheck, UploadCloud } from "lucide-react";

type SupplierSubBatch = {
  id: string;
  bid: string;
  batch_id?: string;
  sequence_index?: number;
  expected_quantity?: number;
  manifest_status?: string;
  manifest_count?: number;
  qa_status?: string;
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

type SupplierOrderConsoleProps = {
  currentRole?: string;
  currentPermissions?: string[];
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
  { value: "iot_tracker_placeholder", label: "IoT tracker - telemetria" },
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

function hasPermission(grants: string[], permission: string) {
  return grants.some((grant) => {
    if (grant === "*" || grant === permission) return true;
    if (grant.endsWith(":*")) return permission.startsWith(grant.slice(0, -1));
    return false;
  });
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
  return data;
}

function normalStatus(value?: string | null) {
  return (value || "pending").toLowerCase();
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
  tenantSlug: sessionTenantSlug = null,
}: SupplierOrderConsoleProps) {
  const normalizedRole = currentRole.replace(/_/g, "-");
  const isSuperAdmin = normalizedRole === "super-admin";
  const isSecurityOperator = normalizedRole === "security-operator";
  const canCreateOrder = isSuperAdmin
    || isSecurityOperator
    || hasScopedPermission(currentPermissions, "supplier:write");
  const canManageManifest = isSuperAdmin
    || isSecurityOperator
    || hasPermission(currentPermissions, "supplier:manifest")
    || hasPermission(currentPermissions, "batches:write");
  const canRunQa = isSuperAdmin
    || hasPermission(currentPermissions, "supplier:qa")
    || hasPermission(currentPermissions, "batches:qa")
    || hasPermission(currentPermissions, "batches:write");
  const canExportPack = isSuperAdmin || isSecurityOperator || hasScopedPermission(currentPermissions, "supplier:export_pack");
  const canActivateTags = isSuperAdmin
    || isSecurityOperator
    || hasPermission(currentPermissions, "supplier:activate")
    || hasPermission(currentPermissions, "batches:write");

  const [tenantSlug, setTenantSlug] = useState(sessionTenantSlug || "");
  const [customerSlug, setCustomerSlug] = useState("");
  const [orderName, setOrderName] = useState("");
  const [baseBatchId, setBaseBatchId] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("5000");
  const [subBatchSize, setSubBatchSize] = useState("1000");
  const [chipModel, setChipModel] = useState("NTAG 424 DNA");
  const [carrierProfileCode, setCarrierProfileCode] = useState("ntag424_dna");
  const [materialType, setMaterialType] = useState("Etiqueta NFC industrial");
  const [sku, setSku] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Listo para crear un pedido industrial real. No pega llaves manuales y no expone KMS.");
  const [response, setResponse] = useState("{}");
  const [created, setCreated] = useState<SupplierOrderResponse | null>(null);
  const [pack, setPack] = useState<SupplierPackResponse | null>(null);
  const [qaBid, setQaBid] = useState("");
  const [qaSampleCount, setQaSampleCount] = useState("5");
  const [qaSampleUrls, setQaSampleUrls] = useState("");
  const [qaReplayChecked, setQaReplayChecked] = useState(false);
  const [qaTtstatusChecked, setQaTtstatusChecked] = useState(false);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [packPassword, setPackPassword] = useState("");
  const [packPasswordVisible, setPackPasswordVisible] = useState(false);
  const [vaultArtifacts, setVaultArtifacts] = useState<SupplierVaultArtifact[]>([]);
  const [manifestCsv, setManifestCsv] = useState("");
  const [manifestResult, setManifestResult] = useState<ManifestImportResponse | null>(null);
  const [activationLimit, setActivationLimit] = useState("");

  const subBatches = useMemo(() => created?.sub_batches || [], [created]);
  const selectedOrderId = created?.order?.id || "";
  const selectedSubBatch = useMemo(
    () => subBatches.find((item) => item.bid === qaBid) || null,
    [qaBid, subBatches],
  );
  const activeCarrierProfile = created?.order?.carrier_profile_code || carrierProfileCode;
  const requiresTtstatus = activeCarrierProfile === "ntag424_dna_tt";
  const manifestRows = useMemo(() => countManifestRows(manifestCsv), [manifestCsv]);
  const qaUrls = useMemo(
    () => qaSampleUrls
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter((value) => /^https?:\/\//i.test(value) && !/[<>]/.test(value)),
    [qaSampleUrls],
  );
  const packAlreadyExported = hasExportEvidence(created?.order, vaultArtifacts, pack);
  const totalQuantityValue = Number(totalQuantity);
  const subBatchSizeValue = Number(subBatchSize);
  const createOrderBlockReason = !canCreateOrder
    ? "Solo superadmin, security operator o supplier:write puede crear un Supplier Order."
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
  const manifestBlockReason = !canManageManifest
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
  const activationBlockReason = !canActivateTags
    ? "Tu perfil no puede activar tags."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : !qaBid.trim()
        ? "Selecciona un BID."
        : !selectedSubBatch
          ? "El BID no pertenece al Supplier Order seleccionado."
          : normalStatus(selectedSubBatch.manifest_status) !== "imported"
            ? "Falta manifiesto importado."
            : normalStatus(selectedSubBatch.qa_status) !== "passed"
              ? "Falta QA aprobado."
              : "";
  const qaPassBlockReason = !canRunQa
    ? "Tu perfil no puede aprobar QA."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : !qaBid.trim()
        ? "Selecciona un BID."
        : !selectedSubBatch
          ? "El BID no pertenece al Supplier Order seleccionado."
          : normalStatus(selectedSubBatch.manifest_status) !== "imported"
            ? "Importa el manifiesto antes de aprobar QA."
            : !qaUrls.length
              ? "Agrega al menos una URL real escaneada."
              : !qaReplayChecked
                ? "Confirma replay verificado."
                : requiresTtstatus && !qaTtstatusChecked
                  ? "Confirma TTStatus para TagTamper."
                  : "";
  const qaRejectBlockReason = !canRunQa
    ? "Tu perfil no puede rechazar QA."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : !qaBid.trim()
        ? "Selecciona un BID."
        : "";
  const exportPackBlockReason = !canExportPack
    ? "Solo superadmin, security operator o supplier:export_pack puede exportar el pack."
    : !selectedOrderId
      ? "Primero selecciona un Supplier Order."
      : packAlreadyExported
        ? "Pack ya exportado o con evidencia en Vault."
        : "";
  const canImportManifest = Boolean(!pending && !manifestBlockReason);
  const canActivateSubBatch = Boolean(!pending && !activationBlockReason);
  const canPassQa = Boolean(!pending && !qaPassBlockReason);
  const canRejectQa = Boolean(!pending && !qaRejectBlockReason);
  const canExportCurrentPack = Boolean(!pending && !exportPackBlockReason);
  const nextAction = !selectedOrderId
    ? "Crea o selecciona un Supplier Order."
    : !selectedSubBatch
      ? "Selecciona un sub-batch del pedido."
      : !packAlreadyExported && canExportPack
        ? "Exporta el pack cifrado una sola vez y entrega la clave por canal separado."
        : normalStatus(selectedSubBatch.manifest_status) !== "imported"
          ? "Valida el manifiesto con dry-run y despues importalo."
          : normalStatus(selectedSubBatch.qa_status) !== "passed"
            ? "Completa QA con muestra real, replay y TTStatus si aplica."
            : normalStatus(selectedSubBatch.status).includes("activated")
              ? "Sub-batch activo. Revisa Vault y evidencias."
              : "Activacion habilitada: ejecuta activate-all o define un limite.";

  async function run(path: string, init?: RequestInit) {
    const result = await fetch(path, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    const text = await result.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    setResponse(asJson(safeResponseForPath(path, data)));
    if (!result.ok || (data && typeof data === "object" && (data as { ok?: unknown }).ok === false)) {
      throw new Error(formatError(data, result.statusText));
    }
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

  async function createOrder() {
    if (createOrderBlockReason) {
      setStatus(createOrderBlockReason);
      return;
    }
    setPending(true);
    setStatus("Creando pedido, sub-batches, llaves cifradas y evidencia batch_created...");
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
      setQaReplayChecked(false);
      setQaTtstatusChecked(false);
      setManifestCsv("");
      setManifestResult(null);
      setActivationLimit("");
      setPackPassword("");
      setPackPasswordVisible(false);
      setStatus(`Pedido creado: ${data.sub_batches?.length || 0} sub-batches con fingerprints, llaves cifradas y sin KMS expuesta.`);
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

  async function exportPack() {
    if (!canExportPack) {
      setStatus("Pack de fábrica bloqueado para este perfil. El tenant puede ver Vault, manifiestos y QA, pero las llaves/export quedan bajo superadmin.");
      return;
    }
    if (!selectedOrderId) {
      setStatus("Primero crea o selecciona un Supplier Order.");
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
    if (manifestBlockReason) {
      setStatus(manifestBlockReason);
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
        }),
      }) as ManifestImportResponse;
      setManifestResult(data);
      if (!dryRun) {
        updateSubBatchStatus(qaBid.trim(), {
          manifest_status: "imported",
          manifest_count: Number(data.inserted || data.importedRows || manifestRows || 0),
        });
        await loadVaultArtifacts(selectedOrderId);
      }
      const count = Number(data.inserted || data.importedRows || manifestRows || 0);
      setStatus(dryRun
        ? `Preflight OK: ${count} filas válidas para ${qaBid.trim()}. Todavía no se activó nada.`
        : `Manifiesto importado: ${count} UIDs registrados. Ahora falta QA aprobado antes de activar.`);
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
    setPending(true);
    setStatus(limit > 0 ? `Activando hasta ${limit} tags del sub-batch...` : "Activando todos los tags pendientes del sub-batch...");
    try {
      const data = await run(`/api/admin/batches/${encodeURIComponent(qaBid.trim())}/activate-all`, {
        method: "POST",
        body: JSON.stringify({ limit }),
      }) as ActivationResponse;
      updateSubBatchStatus(qaBid.trim(), {
        status: data.activationComplete ? "activated" : "partially_activated",
      });
      setStatus(data.activationComplete
        ? `Sub-batch activo: ${data.activated || 0} tags activados y sin pendientes.`
        : `Activación parcial: ${data.activated || 0} tags activados, ${data.remainingInactive || 0} pendientes.`);
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
    setPending(true);
    setStatus(passed ? "Marcando QA aprobado con evidencia..." : "Marcando QA rechazado...");
    try {
      await run(`/api/admin/supplier-orders/${encodeURIComponent(selectedOrderId)}/qa`, {
        method: "POST",
        body: JSON.stringify({
          bid: qaBid.trim(),
          passed,
          sample_count: Number(qaSampleCount || 0),
          sample_urls: passed ? qaUrls : [],
          replay_checked: passed ? qaReplayChecked : false,
          ttstatus_checked: passed ? qaTtstatusChecked : false,
          requires_ttstatus: requiresTtstatus,
          notes: passed
            ? "QA aprobado desde consola supplier con muestra SUN real y replay verificado."
            : "QA rechazado desde consola supplier. No activar este sub-batch.",
        }),
      });
      updateSubBatchStatus(qaBid.trim(), { qa_status: passed ? "passed" : "failed" });
      setStatus(passed ? "QA aprobado. El sub-batch ya puede pasar a activación controlada." : "QA rechazado. No activar este sub-batch.");
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

  function selectExistingOrder(order: SupplierOrder) {
    const subBatchesFromOrder = Array.isArray(order.sub_batches) ? order.sub_batches : [];
    setCreated({ ok: true, order, sub_batches: subBatchesFromOrder });
    setPack(null);
    setVaultArtifacts([]);
    setQaBid(subBatchesFromOrder[0]?.bid || "");
    setQaSampleUrls("");
    setQaReplayChecked(false);
    setQaTtstatusChecked(false);
    setManifestCsv("");
    setManifestResult(null);
    setActivationLimit("");
    setPackPassword("");
    setPackPasswordVisible(false);
    setStatus(`Pedido seleccionado: ${order.order_name || order.id}. ${subBatchesFromOrder.length} sub-batches disponibles.`);
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
            <Field label="Tenant slug" value={tenantSlug} onChange={setTenantSlug} placeholder="bodega-balmec o syngenta-ar" />
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
            </label>
            <Field label="Material" value={materialType} onChange={setMaterialType} placeholder="Etiqueta NFC industrial" />
            <Field label="SKU" value={sku} onChange={setSku} placeholder="opcional" />
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
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Sub-batches" value={String(subBatches.length)} />
            <Metric label="Pack" value={packAlreadyExported ? "exportado" : "pendiente"} />
            <Metric label="Manifiesto" value={selectedSubBatch?.manifest_status || "pendiente"} />
            <Metric label="QA BID" value={qaBid || "pendiente"} />
          </div>

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
                    }}
                  >
                    <b className="text-white">{item.bid}</b>
                    <span className="ml-2 text-slate-400">{item.expected_quantity || 0} tags</span>
                    <span className="mt-1 block text-cyan-200">fingerprint {item.key_fingerprint || "pendiente"}</span>
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

          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Export pack</p>
            <p className="mt-2 text-sm leading-6 text-amber-50">
              {canExportPack
                ? isSecurityOperator
                  ? "Operador de seguridad activo: puede emitir el pack cifrado de fábrica bajo auditoría, sin exponer claves crudas al tenant."
                  : "Superadmin activo: genera un contenedor cifrado con carpetas por sub-batch, TXT/JSON/PDF y checksums. El password se genera en esta consola, no vuelve desde la API y debe enviarse por canal separado."
                : "Bloqueado para tenant admin: el tenant opera manifiestos, QA y Vault, pero el pack cifrado de fábrica queda bajo superadmin, security operator o permiso explícito."}
            </p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Password de fábrica</span>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-500"
                    value={packPassword}
                    disabled={!canExportPack}
                    onChange={(event) => setPackPassword(event.target.value)}
                    placeholder="Generar antes de exportar"
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={!canExportPack}
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
              <Button className="gap-2" variant="secondary" disabled={!pack?.encrypted_pack || !canExportPack} onClick={downloadEncryptedPack}>
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

          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-100">Manifiesto + activación</p>
                <p className="mt-2 text-sm leading-6 text-sky-50">
                  Flujo real de fábrica: primero se valida el archivo recibido, después se importa, luego QA aprueba muestras reales y recién ahí se activa el sub-batch.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-sky-100">{qaBid || "sin BID"}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-200">{manifestRows} filas</span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">QA {selectedSubBatch?.qa_status || "pendiente"}</span>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">CSV/TXT recibido del proveedor</span>
              <textarea
                className="mt-1 min-h-32 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-500"
                value={manifestCsv}
                onChange={(event) => setManifestCsv(event.target.value)}
                placeholder={"uid_hex,bid,product_name,sku,lot,serial\n04AABBCCDD0011,SYN-AR-2026-001-A,Producto,SKU-001,LOT-001,SER-001"}
              />
              <span className="mt-1 block text-xs text-slate-400">
                No activa tags durante el dry-run. La importación queda registrada en Tenant Vault y no expone llaves.
              </span>
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-[0.45fr_1fr]">
              <Field label="Límite activación" value={activationLimit} onChange={setActivationLimit} placeholder="0 = todos" />
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs leading-5 text-slate-300">
                <b className="text-white">Regla de seguridad</b>
                <span className="mt-1 block">
                  El botón de activación queda bloqueado hasta tener <span className="text-cyan-100">manifiesto importado</span> y <span className="text-emerald-100">QA aprobado</span>.
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="gap-2" variant="secondary" disabled={!canImportManifest} title={manifestBlockReason || "Validar manifiesto sin escribir datos"} onClick={() => void importManifest(true)}>
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                Validar sin importar
              </Button>
              <Button className="gap-2" disabled={!canImportManifest} title={manifestBlockReason || "Importar manifiesto auditado"} onClick={() => void importManifest(false)}>
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Importar manifiesto
              </Button>
              <Button className="gap-2" disabled={!canActivateSubBatch} title={activationBlockReason || "Activar sub-batch"} onClick={() => void activateSubBatch()}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Activar sub-batch
              </Button>
            </div>
            {(manifestBlockReason || activationBlockReason) ? (
              <p className="mt-2 text-xs leading-5 text-sky-100">
                {manifestBlockReason || activationBlockReason}
              </p>
            ) : null}
            <p className="mt-2 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
              Override auditado: no hay endpoint/payload en el cliente actual. Backend requerido: activar con reason, approver, snapshot de manifest/QA gate y evidencia de auditoria.
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">QA gate</p>
            <p className="mt-2 text-sm leading-6 text-emerald-50">
              Para aprobar un sub-batch no alcanza con declarar "ok". Pega una muestra real del carrier escaneada, confirma que una muestra vieja cae como replay y, si es TagTamper, valida TTStatus cerrado/abierto.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_0.5fr]">
              <Field label="BID para QA" value={qaBid} onChange={setQaBid} placeholder="SYN-AR-2026-001-A" />
              <Field label="Muestra" value={qaSampleCount} onChange={setQaSampleCount} placeholder="5" />
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Muestras reales escaneadas</span>
              <textarea
                className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
                value={qaSampleUrls}
                onChange={(event) => setQaSampleUrls(event.target.value)}
                placeholder="https://api.nexid.lat/sun?v=1&bid=... o https://nexid.lat/01/... o muestra real del carrier"
              />
              <span className="mt-1 block text-xs text-slate-400">{qaUrls.length} muestra válida lista para adjuntar como evidencia.</span>
            </label>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={qaReplayChecked}
                  onChange={(event) => setQaReplayChecked(event.target.checked)}
                />
                <span><b className="text-white">Replay verificado</b><span className="block text-xs text-slate-400">Una URL vieja o repetida fue rechazada como sospechosa.</span></span>
              </label>
              <label className={`flex items-start gap-2 rounded-xl border p-3 ${requiresTtstatus ? "border-cyan-300/30 bg-cyan-500/10" : "border-white/10 bg-slate-950/50 text-slate-400"}`}>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={qaTtstatusChecked}
                  disabled={!requiresTtstatus}
                  onChange={(event) => setQaTtstatusChecked(event.target.checked)}
                />
                <span><b className="text-white">TTStatus validado</b><span className="block text-xs text-slate-400">{requiresTtstatus ? "Obligatorio para TagTamper." : "No aplica para este carrier."}</span></span>
              </label>
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
            </div>
            {(qaPassBlockReason || qaRejectBlockReason) ? (
              <p className="mt-2 text-xs leading-5 text-emerald-100">{qaPassBlockReason || qaRejectBlockReason}</p>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Carrier activo: <span className="font-mono text-cyan-100">{activeCarrierProfile}</span>. {requiresTtstatus ? "El backend exige TTStatus además de replay." : "El backend exige muestra real y replay/control equivalente."}
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
