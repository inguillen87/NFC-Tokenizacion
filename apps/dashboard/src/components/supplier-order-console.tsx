"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@product/ui";

type SupplierSubBatch = {
  id: string;
  bid: string;
  batch_id?: string;
  sequence_index?: number;
  expected_quantity?: number;
  manifest_status?: string;
  qa_status?: string;
  key_fingerprint?: string;
  url_template?: string;
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

export function SupplierOrderConsole({
  currentRole = "tenant-admin",
  currentPermissions = [],
  tenantSlug: sessionTenantSlug = null,
}: SupplierOrderConsoleProps) {
  const normalizedRole = currentRole.replace(/_/g, "-");
  const isSuperAdmin = normalizedRole === "super-admin";
  const isSecurityOperator = normalizedRole === "security-operator";
  const canCreateOrder = isSuperAdmin
    || hasPermission(currentPermissions, "supplier:write")
    || hasPermission(currentPermissions, "batches:write");
  const canRunQa = isSuperAdmin
    || hasPermission(currentPermissions, "supplier:qa")
    || hasPermission(currentPermissions, "batches:qa")
    || hasPermission(currentPermissions, "batches:write");
  const canExportPack = isSuperAdmin || isSecurityOperator || hasScopedPermission(currentPermissions, "supplier:export_pack");

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
  const [vaultArtifacts, setVaultArtifacts] = useState<SupplierVaultArtifact[]>([]);

  const subBatches = useMemo(() => created?.sub_batches || [], [created]);
  const selectedOrderId = created?.order?.id || "";
  const activeCarrierProfile = created?.order?.carrier_profile_code || carrierProfileCode;
  const requiresTtstatus = activeCarrierProfile === "ntag424_dna_tt";
  const qaUrls = useMemo(
    () => qaSampleUrls
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter((value) => /^https?:\/\//i.test(value) && !/[<>]/.test(value)),
    [qaSampleUrls],
  );
  const qaReadyToPass = Boolean(selectedOrderId && qaBid.trim() && qaUrls.length && qaReplayChecked && (!requiresTtstatus || qaTtstatusChecked));

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
    setResponse(asJson(data));
    if (!result.ok || (data && typeof data === "object" && (data as { ok?: unknown }).ok === false)) {
      throw new Error(formatError(data, result.statusText));
    }
    return data as Record<string, unknown>;
  }

  async function createOrder() {
    if (!canCreateOrder) {
      setStatus("Tu perfil no puede crear pedidos de fábrica. Pedí a un superadmin o a un operador con permiso de lotes.");
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
      setPackPassword("");
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
    setResponse(asJson(data));
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
    const effectivePassword = packPassword.trim()
      || makeLocalPackPassword(created?.order?.customer_slug || customerSlug, created?.order?.tenant_slug || tenantSlug);
    setPackPassword(effectivePassword);
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

  async function markQa(passed: boolean) {
    if (!canRunQa) {
      setStatus("Tu perfil no puede aprobar QA. Necesitás permiso de lotes o supplier QA.");
      return;
    }
    if (!selectedOrderId || !qaBid.trim()) {
      setStatus("Falta order y BID para QA.");
      return;
    }
    if (passed && !qaReadyToPass) {
      setStatus(requiresTtstatus
        ? "Para aprobar QA hace falta una muestra real del carrier, replay verificado y TTStatus validado."
        : "Para aprobar QA hace falta una muestra real del carrier y replay verificado.");
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
    setPackPassword("");
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
            <Button disabled={pending || !canCreateOrder} onClick={() => void createOrder()}>{pending ? "Procesando..." : "Crear Supplier Order"}</Button>
            <Button variant="secondary" disabled={pending} onClick={() => void refreshOrders()}>Ver pedidos</Button>
          </div>
          <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm leading-6 text-cyan-50">{status}</p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Sub-batches" value={String(subBatches.length)} />
            <Metric label="Pack" value={pack?.packs?.length ? "exportado" : "pendiente"} />
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
                    onClick={() => setQaBid(item.bid)}
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
                    onClick={() => setPackPassword(makeLocalPackPassword(created?.order?.customer_slug || customerSlug, created?.order?.tenant_slug || tenantSlug))}
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
              <Button disabled={pending || !selectedOrderId || !canExportPack} onClick={() => void exportPack()}>Exportar pack</Button>
              <Button variant="secondary" disabled={!pack?.encrypted_pack || !canExportPack} onClick={downloadEncryptedPack}>Descargar ZIP cifrado</Button>
              <Button variant="secondary" disabled={!pack || !canExportPack} onClick={downloadSafeSummary}>Resumen seguro</Button>
              <Button variant="secondary" disabled={pending || !selectedOrderId} onClick={() => void loadVaultArtifacts(selectedOrderId).catch((error) => setStatus(error instanceof Error ? error.message : "No se pudo cargar Tenant Vault."))}>Ver Tenant Vault</Button>
            </div>
            {packPassword ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-xs text-white">
                Password local: {packPassword}
              </p>
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
                    {artifact.metadata ? (
                      <p className="mt-1 truncate text-slate-500">{Object.entries(artifact.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</p>
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
              <Button disabled={pending || !qaReadyToPass || !canRunQa} onClick={() => void markQa(true)}>Aprobar QA</Button>
              <Button variant="secondary" disabled={pending || !selectedOrderId || !qaBid.trim() || !canRunQa} onClick={() => void markQa(false)}>Rechazar QA</Button>
            </div>
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
