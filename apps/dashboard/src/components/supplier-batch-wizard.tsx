"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card } from "@product/ui";

type AppLocale = "es-AR" | "pt-BR" | "en";

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  warning: string;
  tenantName: string;
  createTenantIfMissing: string;
  keyExplain: string;
  handoffTitle: string;
  copyHandoff: string;
  manifestPreviewTitle: string;
  tenantSlug: string;
  batchId: string;
  sku: string;
  quantity: string;
  kMeta: string;
  kFile: string;
  notes: string;
  chipModel: string;
  register: string;
  previewTitle: string;
  supplierTemplate: string;
  noTemplate: string;
  copyTemplate: string;
  copied: string;
  importTitle: string;
  importHint: string;
  importAction: string;
  activateImported: string;
  validateTitle: string;
  validateHint: string;
  sampleUrl: string;
  validateAction: string;
  nextTitle: string;
  nextBatchPage: string;
  nextBatchDetail: string;
  responseTitle: string;
  checklistTitle: string;
  checklist: string[];
  keyError: string;
  requiredError: string;
  sampleUrlError: string;
  batchMissing: string;
  batchExists: string;
  validateOk: string;
};

const copy: Record<AppLocale, Copy> = {
  "es-AR": {
    eyebrow: "Supplier-backed batch",
    title: "Register Supplier Batch",
    description: "Usá este flujo para tags codificadas por proveedor. Acá sí se cargan las llaves exactas acordadas con fábrica; no se generan llaves aleatorias.",
    warning: "No uses el alta rápida para tags supplier-coded: si cambiás K_META_BATCH o K_FILE_BATCH, las tags reales van a fallar con INVALID.",
    tenantName: "Nombre del tenant (si hay que crearlo)",
    createTenantIfMissing: "Crear tenant si todavía no existe",
    keyExplain: "K_META_BATCH y K_FILE_BATCH son las llaves exactas del lote que deben coincidir con las que ya compartiste al proveedor.",
    handoffTitle: "Supplier handoff summary",
    copyHandoff: "Copiar handoff",
    manifestPreviewTitle: "Preview de UIDs detectados",
    tenantSlug: "tenant_slug",
    batchId: "batch_id / BID",
    sku: "SKU",
    quantity: "Cantidad esperada",
    kMeta: "K_META_BATCH (32 hex)",
    kFile: "K_FILE_BATCH (32 hex)",
    notes: "Notas operativas (opcional)",
    chipModel: "Modelo de chip (opcional)",
    register: "Registrar supplier batch",
    previewTitle: "Preview operativo",
    supplierTemplate: "URL template para proveedor",
    noTemplate: "Todavía no hay template. Registrá el batch con llaves correctas para generarlo.",
    copyTemplate: "Copiar template",
    copied: "Copiado",
    importTitle: "Manifest workflow",
    importHint: "Cuando llegue el CSV del proveedor, pegalo acá. Debe incluir batch_id y uid_hex. Podés activar en el mismo paso.",
    importAction: "Importar manifest",
    activateImported: "Activar tags al importar",
    validateTitle: "Validate Supplier Sample URL",
    validateHint: "Pegá una URL real de /sun. El sistema valida si el batch existe y luego prueba la respuesta real del endpoint.",
    sampleUrl: "https://api.nexid.lat/sun?...",
    validateAction: "Validar sample URL",
    nextTitle: "Siguientes acciones",
    nextBatchPage: "Abrir batch ops",
    nextBatchDetail: "Abrir batch detail",
    responseTitle: "Respuesta",
    checklistTitle: "Checklist para Echo / proveedor",
    checklist: [
      "No cambiar batch_id, URL template ni sample keys ya acordadas.",
      "Pedir manifest CSV con batch_id y uid_hex por tag.",
      "Confirmar que el BID grabado en NDEF coincide exactamente con este batch.",
      "Confirmar que el encoding usa estas mismas llaves y no otras generadas por el proveedor.",
    ],
    keyError: "Las keys deben ser hex de 32 caracteres.",
    requiredError: "Tenant, batch_id, k_meta_hex y k_file_hex son obligatorios para este flujo.",
    sampleUrlError: "Pegá una URL válida de /sun con bid.",
    batchMissing: "El batch del sample URL todavía no existe en la plataforma.",
    batchExists: "El batch del sample URL ya existe en plataforma.",
    validateOk: "Validación ejecutada sobre la URL real del proveedor.",
  },
  "pt-BR": {
    eyebrow: "Supplier-backed batch",
    title: "Register Supplier Batch",
    description: "Use este fluxo para tags codificadas pelo fornecedor. Aqui você carrega as keys exatas acordadas com a fábrica; nada de keys aleatórias.",
    warning: "Não use a criação rápida para tags supplier-coded: se mudar K_META_BATCH ou K_FILE_BATCH, as tags reais vão falhar com INVALID.",
    tenantName: "Nome do tenant (se precisar criar)",
    createTenantIfMissing: "Criar tenant se ainda não existir",
    keyExplain: "K_META_BATCH e K_FILE_BATCH são as keys exatas do lote e devem coincidir com as já compartilhadas com o fornecedor.",
    handoffTitle: "Supplier handoff summary",
    copyHandoff: "Copiar handoff",
    manifestPreviewTitle: "Preview dos UIDs detectados",
    tenantSlug: "tenant_slug",
    batchId: "batch_id / BID",
    sku: "SKU",
    quantity: "Quantidade esperada",
    kMeta: "K_META_BATCH (32 hex)",
    kFile: "K_FILE_BATCH (32 hex)",
    notes: "Notas operacionais (opcional)",
    chipModel: "Modelo do chip (opcional)",
    register: "Registrar supplier batch",
    previewTitle: "Preview operacional",
    supplierTemplate: "URL template para o fornecedor",
    noTemplate: "Ainda não há template. Registre o batch com as keys corretas para gerá-lo.",
    copyTemplate: "Copiar template",
    copied: "Copiado",
    importTitle: "Manifest workflow",
    importHint: "Quando o CSV chegar, cole aqui. Ele deve incluir batch_id e uid_hex. Você pode ativar no mesmo passo.",
    importAction: "Importar manifest",
    activateImported: "Ativar tags no import",
    validateTitle: "Validate Supplier Sample URL",
    validateHint: "Cole uma URL real de /sun. O sistema valida se o batch existe e depois testa a resposta real do endpoint.",
    sampleUrl: "https://api.nexid.lat/sun?...",
    validateAction: "Validar sample URL",
    nextTitle: "Próximas ações",
    nextBatchPage: "Abrir batch ops",
    nextBatchDetail: "Abrir batch detail",
    responseTitle: "Resposta",
    checklistTitle: "Checklist para Echo / fornecedor",
    checklist: [
      "Não mudar batch_id, URL template nem sample keys já acordadas.",
      "Pedir manifest CSV com batch_id e uid_hex por tag.",
      "Confirmar que o BID gravado no NDEF coincide exatamente com este batch.",
      "Confirmar que o encoding usa estas mesmas keys e não outras geradas pelo fornecedor.",
    ],
    keyError: "As keys devem ser hex com 32 caracteres.",
    requiredError: "Tenant, batch_id, k_meta_hex e k_file_hex são obrigatórios neste fluxo.",
    sampleUrlError: "Cole uma URL válida de /sun com bid.",
    batchMissing: "O batch do sample URL ainda não existe na plataforma.",
    batchExists: "O batch do sample URL já existe na plataforma.",
    validateOk: "Validação executada sobre a URL real do fornecedor.",
  },
  en: {
    eyebrow: "Supplier-backed batch",
    title: "Register Supplier Batch",
    description: "Use this flow for supplier-programmed tags. This is where you enter the exact factory-agreed keys; no random keys should be generated here.",
    warning: "Do not use quick batch creation for supplier-coded tags: if K_META_BATCH or K_FILE_BATCH change, real tags will fail with INVALID.",
    tenantName: "Tenant name (if it must be created)",
    createTenantIfMissing: "Create tenant if missing",
    keyExplain: "K_META_BATCH and K_FILE_BATCH are the exact batch keys that must match what was already shared with the supplier.",
    handoffTitle: "Supplier handoff summary",
    copyHandoff: "Copy handoff",
    manifestPreviewTitle: "Detected UID preview",
    tenantSlug: "tenant_slug",
    batchId: "batch_id / BID",
    sku: "SKU",
    quantity: "Expected quantity",
    kMeta: "K_META_BATCH (32 hex)",
    kFile: "K_FILE_BATCH (32 hex)",
    notes: "Operational notes (optional)",
    chipModel: "Chip model (optional)",
    register: "Register supplier batch",
    previewTitle: "Operational preview",
    supplierTemplate: "Supplier URL template",
    noTemplate: "No template yet. Register the batch with the correct keys to generate it.",
    copyTemplate: "Copy template",
    copied: "Copied",
    importTitle: "Manifest workflow",
    importHint: "When the supplier CSV arrives, paste it here. It must include batch_id and uid_hex. You can activate on import.",
    importAction: "Import manifest",
    activateImported: "Activate tags on import",
    validateTitle: "Validate Supplier Sample URL",
    validateHint: "Paste a real /sun URL. The wizard checks whether the batch exists and then tests the real endpoint response.",
    sampleUrl: "https://api.nexid.lat/sun?...",
    validateAction: "Validate sample URL",
    nextTitle: "Next actions",
    nextBatchPage: "Open batch ops",
    nextBatchDetail: "Open batch detail",
    responseTitle: "Response",
    checklistTitle: "Checklist for Echo / supplier",
    checklist: [
      "Do not change batch_id, URL template or the sample keys already agreed.",
      "Request a manifest CSV with batch_id and uid_hex per tag.",
      "Confirm the BID written in NDEF exactly matches this batch.",
      "Confirm encoding uses these exact keys and not supplier-generated replacements.",
    ],
    keyError: "Keys must be 32-character hex values.",
    requiredError: "Tenant, batch_id, k_meta_hex and k_file_hex are required in this flow.",
    sampleUrlError: "Paste a valid /sun URL containing bid.",
    batchMissing: "The batch from the sample URL does not exist in platform yet.",
    batchExists: "The batch from the sample URL already exists in platform.",
    validateOk: "Validation executed against the supplier's real URL.",
  },
};

type ApiRecord = Record<string, unknown>;

function normalizeHex(value: string) {
  return value.trim().toUpperCase();
}

function isHex32(value: string) {
  return /^[0-9A-F]{32}$/.test(normalizeHex(value));
}

function pretty(data: unknown) {
  return JSON.stringify(data, null, 2);
}

export function SupplierBatchWizard({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [form, setForm] = useState({
    tenantName: "Demo Bodega",
    tenantSlug: "demobodega",
    batchId: "DEMO-2026-02",
    sku: "china-ntag424-demo",
    quantity: "100",
    kMeta: "",
    kFile: "",
    notes: "",
    chipModel: "NTAG 424 DNA",
  });
  const [manifestCsv, setManifestCsv] = useState("batch_id,uid_hex\nDEMO-2026-02,");
  const [createTenantIfMissing, setCreateTenantIfMissing] = useState(false);
  const [activateImported, setActivateImported] = useState(true);
  const [sampleUrl, setSampleUrl] = useState("");
  const [pending, setPending] = useState<"register" | "manifest" | "validate" | null>(null);
  const [responseText, setResponseText] = useState("{}");
  const [status, setStatus] = useState(t.description);
  const [template, setTemplate] = useState("");
  const [copied, setCopied] = useState(false);

  const detailHref = useMemo(() => `/batches/${encodeURIComponent(form.batchId || "new")}`, [form.batchId]);
  const expectedTemplate = useMemo(() => form.batchId.trim() ? `https://api.nexid.lat/sun/?v=1&bid=${form.batchId.trim()}&picc_data=00000000000000000000000000000000&enc=00000000000000000000000000000000&cmac=0000000000000000` : "", [form.batchId]);
  const manifestPreview = useMemo(() => {
    const lines = manifestCsv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((value) => value.trim());
    const uidIndex = headers.findIndex((header) => ["uid_hex", "uid", "UID", "uidHex"].includes(header));
    const batchIndex = headers.findIndex((header) => ["batch_id", "batchId"].includes(header));
    return lines.slice(1, 6).map((line) => {
      const cols = line.split(",").map((value) => value.trim());
      return { uid: uidIndex >= 0 ? cols[uidIndex] || "-" : "-", batch: batchIndex >= 0 ? cols[batchIndex] || "-" : form.batchId || "-" };
    });
  }, [form.batchId, manifestCsv]);

  async function run(path: string, init?: RequestInit) {
    const res = await fetch(path, { cache: "no-store", ...init });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    setResponseText(pretty(data));
    if (!res.ok) throw new Error(typeof data === "object" && data && "reason" in data ? String((data as ApiRecord).reason || res.statusText) : res.statusText);
    return data as ApiRecord;
  }

  async function registerBatch() {
    if (!form.tenantSlug.trim() || !form.batchId.trim() || !form.kMeta.trim() || !form.kFile.trim()) {
      setStatus(t.requiredError);
      return;
    }
    if (!isHex32(form.kMeta) || !isHex32(form.kFile)) {
      setStatus(t.keyError);
      return;
    }
    setPending("register");
    setStatus("POST /api/admin/batches");
    try {
      if (createTenantIfMissing && form.tenantName.trim()) {
        await run("/api/admin/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.tenantName.trim(), slug: form.tenantSlug.trim() }),
        }).catch(() => null);
      }
      const payload = {
        tenant_slug: form.tenantSlug.trim(),
        bid: form.batchId.trim(),
        sku: form.sku.trim(),
        quantity: Number(form.quantity || 0),
        profile: "secure",
        k_meta_hex: normalizeHex(form.kMeta),
        k_file_hex: normalizeHex(form.kFile),
        sdm_config: {
          security_profile: "secure",
          chip_model: form.chipModel.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      };
      const data = await run("/api/admin/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setTemplate(String(data.ndef_url_template || ""));
      setStatus(`OK · ${form.batchId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "register failed");
    } finally {
      setPending(null);
    }
  }

  async function importManifest() {
    if (!form.batchId.trim()) {
      setStatus(t.requiredError);
      return;
    }
    setPending("manifest");
    setStatus(`POST /api/admin/batches/${form.batchId}/import-manifest`);
    try {
      await run(`/api/admin/batches/${encodeURIComponent(form.batchId.trim())}/import-manifest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: manifestCsv, activateImported }),
      });
      setStatus(`OK · manifest ${form.batchId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "manifest failed");
    } finally {
      setPending(null);
    }
  }

  async function validateSampleUrl() {
    if (!sampleUrl.trim()) {
      setStatus(t.sampleUrlError);
      return;
    }
    setPending("validate");
    try {
      const url = new URL(sampleUrl.trim());
      const bid = url.searchParams.get("bid") || "";
      if (!bid || !url.pathname.includes("/sun")) {
        setStatus(t.sampleUrlError);
        setPending(null);
        return;
      }
      const batches = await run("/api/admin/batches");
      const rows = Array.isArray(batches) ? batches : [];
      const exists = rows.some((row) => typeof row === "object" && row && String((row as ApiRecord).bid || "") === bid);
      const sampleResponse = await fetch(sampleUrl.trim(), { cache: "no-store" });
      const sampleText = await sampleResponse.text();
      let sampleData: unknown = sampleText;
      try { sampleData = JSON.parse(sampleText); } catch {}
      setResponseText(pretty({ batchCheck: exists ? t.batchExists : t.batchMissing, sampleStatus: sampleResponse.status, sampleResponse: sampleData }));
      setStatus(`${exists ? t.batchExists : t.batchMissing} ${t.validateOk}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "validation failed");
    } finally {
      setPending(null);
    }
  }

  async function copyTemplate() {
    if (!template) return;
    await navigator.clipboard.writeText(template).catch(() => null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function copyHandoff() {
    const handoff = [
      `BATCH_ID=${form.batchId.trim()}`,
      `K_META_BATCH=${normalizeHex(form.kMeta)}`,
      `K_FILE_BATCH=${normalizeHex(form.kFile)}`,
      `URL_TEMPLATE=${template || expectedTemplate}`,
    ].join("\n");
    await navigator.clipboard.writeText(handoff).catch(() => null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">{t.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{t.title}</h2>
        <p className="mt-2 text-sm text-slate-300">{t.description}</p>
        <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">{t.warning}</div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder={t.tenantName} value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} />
            <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder={t.tenantSlug} value={form.tenantSlug} onChange={(e) => setForm({ ...form, tenantSlug: e.target.value })} />
            <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder={t.batchId} value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} />
            <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder={t.sku} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder={t.quantity} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <input className="rounded-xl border border-emerald-300/30 bg-slate-950 px-3 py-2 text-sm text-white" placeholder={t.kMeta} value={form.kMeta} onChange={(e) => setForm({ ...form, kMeta: e.target.value })} />
            <input className="rounded-xl border border-emerald-300/30 bg-slate-950 px-3 py-2 text-sm text-white" placeholder={t.kFile} value={form.kFile} onChange={(e) => setForm({ ...form, kFile: e.target.value })} />
            <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white md:col-span-2" placeholder={t.chipModel} value={form.chipModel} onChange={(e) => setForm({ ...form, chipModel: e.target.value })} />
            <textarea className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white md:col-span-2" placeholder={t.notes} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={createTenantIfMissing} onChange={(e) => setCreateTenantIfMissing(e.target.checked)} />
            <span>{t.createTenantIfMissing}</span>
          </label>
          <p className="mt-3 text-xs text-emerald-200">{t.keyExplain}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={registerBatch} disabled={pending !== null}>{t.register}</Button>
            <Link className="inline-flex items-center rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100" href="/batches">{t.nextBatchPage}</Link>
            <Link className="inline-flex items-center rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100" href={detailHref}>{t.nextBatchDetail}</Link>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">{t.previewTitle}</h3>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-400">{t.supplierTemplate}</p>
          <p className="mt-2 break-all text-sm text-cyan-100">{template || expectedTemplate || t.noTemplate}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={copyTemplate} disabled={!(template || expectedTemplate)}>{copied ? t.copied : t.copyTemplate}</Button>
            <Button variant="secondary" onClick={copyHandoff} disabled={!form.batchId.trim() || !form.kMeta.trim() || !form.kFile.trim()}>{t.copyHandoff}</Button>
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.16em] text-slate-400">{t.handoffTitle}</p>
          <pre className="mt-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200">{[
            `BATCH_ID=${form.batchId.trim() || "-"}`,
            `K_META_BATCH=${normalizeHex(form.kMeta) || "-"}`,
            `K_FILE_BATCH=${normalizeHex(form.kFile) || "-"}`,
            `URL_TEMPLATE=${template || expectedTemplate || "-"}`,
          ].join("\n")}</pre>
          <p className="mt-6 text-xs uppercase tracking-[0.16em] text-slate-400">{t.checklistTitle}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {t.checklist.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{t.importTitle}</h3>
          <p className="mt-2 text-sm text-slate-300">{t.importHint}</p>
          <textarea className="mt-4 min-h-40 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" value={manifestCsv} onChange={(e) => setManifestCsv(e.target.value)} />
          {manifestPreview.length ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t.manifestPreviewTitle}</p>
              <div className="mt-3 grid gap-2">
                {manifestPreview.map((item, index) => (
                  <div key={`${item.uid}-${index}`} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">{item.batch} · {item.uid}</div>
                ))}
              </div>
            </div>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={activateImported} onChange={(e) => setActivateImported(e.target.checked)} />
            <span>{t.activateImported}</span>
          </label>
          <Button className="mt-4" onClick={importManifest} disabled={pending !== null}>{t.importAction}</Button>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{t.validateTitle}</h3>
          <p className="mt-2 text-sm text-slate-300">{t.validateHint}</p>
          <textarea className="mt-4 min-h-32 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder={t.sampleUrl} value={sampleUrl} onChange={(e) => setSampleUrl(e.target.value)} />
          <Button className="mt-4" onClick={validateSampleUrl} disabled={pending !== null}>{t.validateAction}</Button>
        </Card>
      </div>

      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t.responseTitle}</p>
        <p className="mt-2 text-sm text-slate-300">{status}</p>
        <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{responseText}</pre>
      </Card>
    </div>
  );
}
