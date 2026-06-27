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
    password: string;
    password_warning: string;
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

const carrierProfiles = [
  { value: "ntag424_dna", label: "NTAG 424 DNA - SUN seguro" },
  { value: "ntag424_dna_tt", label: "NTAG 424 DNA TagTamper - sello fisico" },
  { value: "gs1_digital_link", label: "QR GS1 Digital Link" },
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

export function SupplierOrderConsole() {
  const [tenantSlug, setTenantSlug] = useState("");
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
  const [orders, setOrders] = useState<SupplierOrder[]>([]);

  const subBatches = useMemo(() => created?.sub_batches || [], [created]);
  const selectedOrderId = created?.order?.id || "";

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
      const firstBid = data.sub_batches?.[0]?.bid || "";
      setQaBid(firstBid);
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

  async function exportPack() {
    if (!selectedOrderId) {
      setStatus("Primero crea o selecciona un Supplier Order.");
      return;
    }
    setPending(true);
    setStatus("Generando ZIP cifrado con TXT/JSON/PDF/checksums por sub-batch. Las llaves no quedan visibles en el navegador.");
    try {
      const data = await run(`/api/admin/supplier-orders/${encodeURIComponent(selectedOrderId)}/export-pack`, { method: "POST" }) as SupplierPackResponse;
      setPack(data);
      setResponse(asJson(safePackSummary(data)));
      setStatus(`Pack cifrado listo: ${data.packs?.length || 0} carpetas. Descarga el .zip.enc y envia el password por canal separado.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo exportar el pack.");
    } finally {
      setPending(false);
    }
  }

  async function markQa(passed: boolean) {
    if (!selectedOrderId || !qaBid.trim()) {
      setStatus("Falta order y BID para QA.");
      return;
    }
    setPending(true);
    setStatus(passed ? "Marcando QA aprobado..." : "Marcando QA rechazado...");
    try {
      await run(`/api/admin/supplier-orders/${encodeURIComponent(selectedOrderId)}/qa`, {
        method: "POST",
        body: JSON.stringify({
          bid: qaBid.trim(),
          passed,
          sample_count: Number(qaSampleCount || 0),
          replay_checked: true,
          ttstatus_checked: carrierProfileCode === "ntag424_dna_tt",
          notes: passed ? "QA sample passed from supplier console." : "QA failed from supplier console.",
        }),
      });
      setStatus(passed ? "QA aprobado. El sub-batch ya puede pasar a activacion controlada." : "QA rechazado. No activar este sub-batch.");
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
    setQaBid(subBatchesFromOrder[0]?.bid || "");
    setStatus(`Pedido seleccionado: ${order.order_name || order.id}. ${subBatchesFromOrder.length} sub-batches disponibles.`);
  }

  return (
    <Card className="overflow-hidden border-cyan-300/20 bg-slate-950/80">
      <div className="grid gap-6 p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Supplier Order industrial</p>
          <h2 className="mt-2 text-2xl font-black text-white">Pedido de tags listo para fabrica</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Crea sub-batches, genera llaves por lote, las guarda cifradas, exporta pack de encoding solo para superadmin y bloquea activacion hasta manifest + QA.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Tenant slug" value={tenantSlug} onChange={setTenantSlug} placeholder="bodega-balmec o syngenta-ar" />
            <Field label="Customer slug" value={customerSlug} onChange={setCustomerSlug} placeholder="opcional, por defecto tenant" />
            <Field label="Order name" value={orderName} onChange={setOrderName} placeholder="SYN-AR-2026-001" />
            <Field label="Base batch ID" value={baseBatchId} onChange={setBaseBatchId} placeholder="SYN-AR-2026-001" />
            <Field label="Cantidad total" value={totalQuantity} onChange={setTotalQuantity} placeholder="5000" />
            <Field label="Tamano sub-batch" value={subBatchSize} onChange={setSubBatchSize} placeholder="1000" />
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
            <Button disabled={pending} onClick={() => void createOrder()}>{pending ? "Procesando..." : "Crear Supplier Order"}</Button>
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
              Todavia no hay un pedido en esta sesion. Crea uno o carga la lista de pedidos existentes.
            </div>
          )}

          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Export pack</p>
            <p className="mt-2 text-sm leading-6 text-amber-50">
              Solo superadmin. Genera un contenedor cifrado con carpetas por sub-batch, TXT/JSON/PDF y checksums. El password se muestra una vez y se manda por canal separado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={pending || !selectedOrderId} onClick={() => void exportPack()}>Exportar pack</Button>
              <Button variant="secondary" disabled={!pack?.encrypted_pack} onClick={downloadEncryptedPack}>Descargar ZIP cifrado</Button>
              <Button variant="secondary" disabled={!pack} onClick={downloadSafeSummary}>Resumen seguro</Button>
            </div>
            {pack?.encrypted_pack?.password ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-xs text-white">
                Password one-time: {pack.encrypted_pack.password}
              </p>
            ) : null}
            {pack?.encrypted_pack?.envelope_sha256 ? (
              <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-300">
                <p>Envelope: <span className="font-mono text-cyan-100">{pack.encrypted_pack.envelope_sha256}</span></p>
                <p>ZIP interno: <span className="font-mono text-cyan-100">{pack.encrypted_pack.plaintext_zip_sha256}</span></p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">QA gate</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_0.5fr]">
              <Field label="BID para QA" value={qaBid} onChange={setQaBid} placeholder="SYN-AR-2026-001-A" />
              <Field label="Muestra" value={qaSampleCount} onChange={setQaSampleCount} placeholder="5" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={pending || !selectedOrderId || !qaBid.trim()} onClick={() => void markQa(true)}>Aprobar QA</Button>
              <Button variant="secondary" disabled={pending || !selectedOrderId || !qaBid.trim()} onClick={() => void markQa(false)}>Rechazar QA</Button>
            </div>
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
