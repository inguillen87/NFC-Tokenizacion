"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Button, Card } from "@product/ui";
import { DEMO_SUPPLIER_BATCH_ID, DEMO_SUPPLIER_UIDS } from "../lib/demo-uids";

type AppLocale = "es-AR" | "pt-BR" | "en";

type WizardStep = 1 | 2 | 3 | 4 | 5;

function normalizeHex(value: string) {
  return value.trim().toUpperCase();
}

function isHex32(value: string) {
  return /^[0-9A-F]{32}$/.test(normalizeHex(value));
}

function parseUidLines(raw: string) {
  return raw
    .replace(/^\uFEFF/, "")
    .split(/[\r\n,;\t ]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
    .filter((token) => token !== "UID_HEX" && token !== "UID")
    .filter((token) => /^[0-9A-F]{8,20}$/.test(token));
}

function describeValidationStatus(reason: string) {
  const normalized = reason.toUpperCase();
  if (normalized.includes("UNKNOWN_BATCH")) return { code: "UNKNOWN_BATCH", detail: "El BID no existe. Registrá el lote y cargá keys primero." };
  if (normalized.includes("NOT_REGISTERED")) return { code: "NOT_REGISTERED", detail: "El UID no fue importado en este batch. Reimportá manifest." };
  if (normalized.includes("NOT_ACTIVE")) return { code: "NOT_ACTIVE", detail: "El UID existe pero no está activo. Ejecutá Activate imported tags." };
  if (normalized.includes("REPLAY")) return { code: "REPLAY_SUSPECT", detail: "Se detectó repetición anómala. Revisá origen del scan y riesgo de clonación." };
  if (normalized.includes("INVALID") || normalized.includes("CMAC")) return { code: "INVALID", detail: "Firma no válida o keys incorrectas para este tag." };
  if (normalized.includes("VALID") || normalized.includes("OK")) return { code: "VALID", detail: "Validación correcta. El tag y el lote están consistentes." };
  return { code: "UNKNOWN", detail: "Resultado no mapeado automáticamente. Revisá el JSON de respuesta." };
}

function parseUidCsv(raw: string) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { uids: [], batchIds: [] as string[] };
  const header = lines[0].split(",").map((item) => item.trim().toLowerCase());
  const uidIndex = header.findIndex((item) => ["uid_hex", "uid", "uidhex"].includes(item));
  const batchIndex = header.findIndex((item) => ["batch_id", "batchid", "bid"].includes(item));
  if (uidIndex < 0) return { uids: [], batchIds: [] as string[] };
  const rows = lines.slice(1).map((line) => line.split(",").map((item) => item.trim()));
  const uids = rows.map((row) => row[uidIndex]?.toUpperCase() || "").filter((uid) => /^[0-9A-F]{8,20}$/.test(uid));
  const batchIds = batchIndex >= 0 ? rows.map((row) => row[batchIndex] || "") : [];
  return { uids, batchIds };
}

function actionMessage(reason: string) {
  const lower = reason.toLowerCase();
  if (lower.includes("unknown batch") || lower.includes("batch not found")) {
    return "Este BID no está registrado todavía. Volvé al Step 4 y registralo.";
  }
  if (lower.includes("not allowed") || lower.includes("not active") || lower.includes("allowlist")) {
    return "El UID existe pero no está activado o allowlisteado. Importá UIDs y activá en el Step 4.";
  }
  if (lower.includes("cmac") || lower.includes("mismatch")) {
    return "Keys incorrectas (o proveedor programó con keys distintas). Revisá K_META / K_FILE del Step 2.";
  }
  return "Revisá el detalle técnico y volvé a ejecutar el paso recomendado.";
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

export function SupplierBatchWizard({ locale }: { locale: AppLocale }) {
  const copy = locale === "en"
    ? {
        title: "Supplier Batch Onboarding Wizard",
        subtitle: "Simple mode: complete 5 steps and leave the batch ready to scan.",
        source: "source: supplier.txt",
        startStatus: "Complete the onboarding in 5 steps to leave the batch READY TO SCAN.",
        quickTitle: "Quick route (recommended)",
        quickHint: "If this is your first run, use this button and then validate one supplier URL.",
        quickAction: "Run complete setup",
        quickFooter: "This runs: create tenant (if missing) → register batch → import UIDs → activate UIDs.",
        step1: "Step 1 · Batch identity",
        step2: "Step 2 · Batch keys",
        step3: "Step 3 · UID intake",
        step4: "Step 4 · Register + Import + Activate",
        step5: "Step 5 · Supplier pretest",
      }
    : locale === "pt-BR"
      ? {
          title: "Onboarding de Lote do Fornecedor",
          subtitle: "Modo simples: complete os 5 passos e deixe o lote pronto para scan.",
          source: "fonte: supplier.txt",
          startStatus: "Complete o onboarding em 5 passos para deixar o lote READY TO SCAN.",
          quickTitle: "Rota rápida (recomendada)",
          quickHint: "Se for sua primeira execução, use este botão e depois valide uma URL SUN.",
          quickAction: "Executar setup completo",
          quickFooter: "Executa: criar tenant (se faltar) → registrar lote → importar UIDs → ativar UIDs.",
          step1: "Passo 1 · Identidade do lote",
          step2: "Passo 2 · Chaves do lote",
          step3: "Passo 3 · Carga de UIDs",
          step4: "Passo 4 · Registrar + Importar + Ativar",
          step5: "Passo 5 · Pré-teste do fornecedor",
        }
      : {
          title: "Wizard de Onboarding de Lote Proveedor",
          subtitle: "Modo simple: completá 5 pasos y dejá el lote listo para escanear.",
          source: "fuente: supplier.txt",
          startStatus: "Completá el onboarding en 5 pasos para dejar el batch READY TO SCAN.",
          quickTitle: "Ruta rápida (recomendada)",
          quickHint: "Si es tu primera corrida, usá este botón y después validá una URL SUN.",
          quickAction: "Ejecutar setup completo",
          quickFooter: "Esto ejecuta: crear tenant (si falta) → registrar batch → importar UIDs → activar UIDs.",
          step1: "Paso 1 · Identidad del batch",
          step2: "Paso 2 · Keys del batch",
          step3: "Paso 3 · Carga de UIDs",
          step4: "Paso 4 · Registrar + Importar + Activar",
          step5: "Paso 5 · Pretest proveedor",
        };

  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(copy.startStatus);
  const [responseText, setResponseText] = useState("{}");

  const [tenantSlug, setTenantSlug] = useState("demobodega");
  const [tenantName, setTenantName] = useState("Demo Bodega");
  const [batchMode, setBatchMode] = useState<"supplier" | "internal">("supplier");
  const [bid, setBid] = useState(DEMO_SUPPLIER_BATCH_ID);
  const [chipModel, setChipModel] = useState("NTAG 424 DNA TagTamper");
  const [sku, setSku] = useState("wine-secure");
  const [quantity, setQuantity] = useState("10");
  const [notes, setNotes] = useState("Supplier-programmed batch. Do not rotate keys.");
  const [kMeta, setKMeta] = useState("c2a462e6ab434828153d73ce440704ac");
  const [kFile, setKFile] = useState("bfce6c576540c04c840f1cfd457bf213");
  const [uids, setUids] = useState<string[]>([]);
  const [manifestSourceType, setManifestSourceType] = useState<"txt" | "csv">("txt");
  const [batchMismatchCount, setBatchMismatchCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [supplierUrl, setSupplierUrl] = useState("");
  const [readyToScan, setReadyToScan] = useState(false);
  const [validationCode, setValidationCode] = useState("PENDING");
  const [validationDetail, setValidationDetail] = useState("Pegá una URL SUN para evaluar estado de negocio.");

  const steps = [copy.step1, copy.step2, copy.step3, copy.step4, copy.step5];

  const progress = Math.round(((activeStep - 1) / (steps.length - 1)) * 100);
  const uidPreview = useMemo(() => uids.slice(0, 10), [uids]);
  const expectedNdefTemplate = useMemo(() => `https://api.nexid.lat/sun?v=1&bid=${encodeURIComponent(bid || "DEMO-2026-02")}&picc_data=...&enc=...&cmac=...`, [bid]);

  async function run(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    const data = await parseJsonSafe(response);
    setResponseText(JSON.stringify(data, null, 2));
    if (!response.ok) {
      const reason = typeof data === "object" && data && "reason" in data ? String((data as { reason?: unknown }).reason || response.statusText) : response.statusText;
      throw new Error(reason);
    }
    return data as Record<string, unknown>;
  }

  async function onUidFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    if (file.name.toLowerCase().endsWith(".csv")) {
      const parsed = parseUidCsv(raw);
      setUids(parsed.uids || []);
      const mismatches = (parsed.batchIds || []).filter((entry) => entry && entry !== bid).length;
      const duplicates = parsed.uids.length - new Set(parsed.uids).size;
      setBatchMismatchCount(mismatches);
      setDuplicateCount(duplicates);
      setStatus(`UIDs detectados: ${parsed.uids.length}. Duplicados: ${duplicates}.`);
      return;
    }
    const parsed = parseUidLines(raw);
    setUids(parsed);
    setDuplicateCount(parsed.length - new Set(parsed).size);
    setBatchMismatchCount(0);
    setStatus(`UIDs detectados: ${parsed.length}. Duplicados: ${parsed.length - new Set(parsed).size}.`);
  }

  async function createTenantIfMissing() {
    if (!tenantSlug.trim() || !tenantName.trim()) return;
    await run("/api/admin/tenants", {
      method: "POST",
      body: JSON.stringify({ slug: tenantSlug.trim(), name: tenantName.trim() }),
    }).catch(() => null);
  }

  async function registerBatch() {
    if (!tenantSlug.trim() || !bid.trim()) throw new Error("Completá tenant_slug y bid en Step 1.");
    if (!isHex32(kMeta) || !isHex32(kFile)) throw new Error("K_META y K_FILE deben ser hex de 32 caracteres.");
    return run("/api/admin/batches/register", {
      method: "POST",
      body: JSON.stringify({
        tenant_slug: tenantSlug.trim(),
        mode: batchMode,
        bid: bid.trim(),
        chip_model: chipModel.trim(),
        sku: sku.trim(),
        quantity: Number(quantity || 0),
        notes: notes.trim(),
        k_meta_hex: normalizeHex(kMeta),
        k_file_hex: normalizeHex(kFile),
        sdm_config: { source: "supplier.txt", url_template: expectedNdefTemplate },
      }),
    });
  }

  async function importUids() {
    if (!bid.trim()) throw new Error("Falta BID.");
    if (!uids.length) throw new Error("Cargá UIDs en Step 3.");
    const data = await run(`/api/admin/batches/${encodeURIComponent(bid.trim())}/import-uids`, {
      method: "POST",
      body: JSON.stringify({ uids, sourceType: manifestSourceType }),
    });
    setImportedCount(Number(data.imported || uids.length));
    return data;
  }

  async function activateAll() {
    if (!bid.trim()) throw new Error("Falta BID.");
    const data = await run(`/api/admin/batches/${encodeURIComponent(bid.trim())}/activate-all`, {
      method: "POST",
      body: JSON.stringify({ limit: uids.length || undefined }),
    });
    setActiveCount(Number(data.activated || 0));
    return data;
  }

  async function runAll() {
    setPending(true);
    setStatus("Ejecutando onboarding...");
    try {
      await createTenantIfMissing();
      await registerBatch();
      await importUids();
      await activateAll();
      setReadyToScan(true);
      setStatus("READY TO SCAN: batch registrado, UIDs importados y activados.");
      setActiveStep(5);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      setStatus(message);
    } finally {
      setPending(false);
    }
  }

  async function validateNow() {
    if (!supplierUrl.trim()) {
      setStatus("Pegá una URL SUN del proveedor.");
      return;
    }
    setPending(true);
    setStatus("Validando URL SUN...");
    try {
      const data = await run("/api/admin/sun/validate", {
        method: "POST",
        body: JSON.stringify({ url: supplierUrl.trim() }),
      });
      const reason = String(data.reason || "");
      const statusInfo = describeValidationStatus(reason);
      setValidationCode(statusInfo.code);
      setValidationDetail(statusInfo.detail);
      const advice = actionMessage(reason);
      setStatus(`Validación completa. ${advice}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "validation failed";
      const statusInfo = describeValidationStatus(message);
      setValidationCode(statusInfo.code);
      setValidationDetail(statusInfo.detail);
      setStatus(`${message}. ${actionMessage(message)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold text-white">{copy.title}</h2>
        <p className="mt-2 text-sm text-slate-300">{copy.subtitle}</p>
        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">{copy.quickTitle}</p>
          <p className="mt-1 text-sm text-cyan-50">{copy.quickHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button disabled={pending} onClick={() => void runAll()}>{copy.quickAction}</Button>
            <p className="text-xs text-cyan-100/90">{copy.quickFooter}</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {steps.map((step, index) => (
            <button key={step} type="button" className={`rounded-xl border px-2 py-2 text-xs ${activeStep === index + 1 ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`} onClick={() => setActiveStep((index + 1) as WizardStep)}>
              {step}
            </button>
          ))}
        </div>
      </Card>

      <Card className={`p-6 ${activeStep === 1 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 1 · Batch identity</h3>
        <p className="mt-1 text-xs text-slate-400">ⓘ Tenant = marca/cliente dueño del lote. Para demo real usá: Demo Bodega / demobodega.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className={`rounded-lg border px-2 py-1 text-xs ${batchMode === "supplier" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => setBatchMode("supplier")}>Supplier batch mode</button>
          <button type="button" className={`rounded-lg border px-2 py-1 text-xs ${batchMode === "internal" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => setBatchMode("internal")}>Internal batch mode</button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="tenant_slug" value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="tenant_name" value={tenantName} onChange={(event) => setTenantName(event.target.value)} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="bid" value={bid} onChange={(event) => setBid(event.target.value)} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="chip model" value={chipModel} onChange={(event) => setChipModel(event.target.value)} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="sku" value={sku} onChange={(event) => setSku(event.target.value)} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="quantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <textarea className="min-h-20 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white md:col-span-3" placeholder="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </Card>

      <Card className={`p-6 ${activeStep === 2 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 2 · Batch keys</h3>
        <p className="mt-1 text-xs text-slate-400">{copy.source}</p>
        <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {batchMode === "supplier"
            ? "Supplier mode: K_META_BATCH y K_FILE_BATCH son obligatorias y no se autogeneran."
            : "Internal mode: podés dejar keys vacías y el backend las genera automáticamente."}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="rounded-xl border border-emerald-300/30 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="k_meta_hex (16 bytes / 32 hex)" value={kMeta} onChange={(event) => setKMeta(event.target.value)} />
          <input className="rounded-xl border border-emerald-300/30 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="k_file_hex (16 bytes / 32 hex)" value={kFile} onChange={(event) => setKFile(event.target.value)} />
        </div>
        <p className="mt-3 text-xs text-cyan-200">NDEF template preview: {expectedNdefTemplate}</p>
      </Card>

      <Card className={`p-6 ${activeStep === 3 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 3 · UID intake</h3>
        <p className="mt-1 text-sm text-slate-300">Subí .txt o .csv. Se normaliza a upper-case hex automáticamente.</p>
        <button
          type="button"
          className="mt-2 rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
          onClick={() => {
            const list = [...DEMO_SUPPLIER_UIDS];
            setUids(list);
            setDuplicateCount(0);
            setBatchMismatchCount(0);
            setStatus(`UID list oficial cargada: ${list.length}/10.`);
          }}
        >
          Load supplier source-of-truth UID list (10)
        </button>
        <div className="mt-2 flex gap-2">
          <button type="button" className={`rounded-lg border px-2 py-1 text-xs ${manifestSourceType === "txt" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => setManifestSourceType("txt")}>TXT UID list</button>
          <button type="button" className={`rounded-lg border px-2 py-1 text-xs ${manifestSourceType === "csv" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => setManifestSourceType("csv")}>CSV manifest</button>
        </div>
        <input type="file" accept=".txt,.csv,text/plain,text/csv" className="mt-3 block w-full text-sm text-slate-200" onChange={(event) => void onUidFile(event)} />
        <p className="mt-2 text-xs text-slate-400">Rows parsed: {uids.length} · Duplicates: {duplicateCount} · Batch consistency issues: {batchMismatchCount}</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {uidPreview.map((uid, index) => (
            <div key={`${uid}-${index}`} className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">{uid}</div>
          ))}
        </div>
      </Card>

      <Card className={`p-6 ${activeStep === 4 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 4 · Register + Import + Activate</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => void createTenantIfMissing()}>Create tenant if missing</Button>
          <Button disabled={pending} onClick={() => void registerBatch()}>Register batch</Button>
          <Button disabled={pending} onClick={() => void importUids()}>Import UIDs</Button>
          <Button disabled={pending} onClick={() => void activateAll()}>Activate all imported UIDs</Button>
          <Button disabled={pending} variant="secondary" onClick={() => void runAll()}>Run all</Button>
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Imported: {importedCount} · Active: {activeCount}
        </div>
        {readyToScan ? <p className="mt-3 rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">READY TO SCAN</p> : null}
      </Card>

      <Card className={`p-6 ${activeStep === 5 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 5 · Supplier pretest</h3>
        <p className="mt-1 text-sm text-slate-300">Pegá URL SUN completa y validá ahora (ok/reason/latencia/tag_status/batch_status).</p>
        <textarea className="mt-3 min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" value={supplierUrl} onChange={(event) => setSupplierUrl(event.target.value)} placeholder="https://api.nexid.lat/sun?..." />
        <Button className="mt-3" disabled={pending} onClick={() => void validateNow()}>Validate now</Button>
        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          <p className="font-semibold">Validation status: {validationCode}</p>
          <p className="mt-1">{validationDetail}</p>
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-sm text-slate-300">{status}</p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{responseText}</pre>
      </Card>
    </div>
  );
}
