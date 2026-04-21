"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Button, Card } from "@product/ui";
import { productUrls } from "@product/config";
import { DEMO_SUPPLIER_BATCH_ID, DEMO_SUPPLIER_UIDS } from "../lib/demo-uids";

type AppLocale = "es-AR" | "pt-BR" | "en";
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
type TenantSegment = "cosmetica" | "reseller" | "bodega" | "custom";

type BatchSummary = {
  bid: string;
  status: string;
  tenant_slug: string;
  chip_model: string;
  sku: string;
  requested_quantity: number;
  imported_tags: number;
  active_tags: number;
  inactive_tags: number;
  has_meta_key: boolean;
  has_file_key: boolean;
};

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

function parseUidCsv(raw: string) {
  const splitCsvLine = (line: string) => {
    const columns: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === "\"" && inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      if (char === "\"") {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        columns.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    columns.push(current.trim());
    return columns;
  };

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { uids: [], batchIds: [] as string[] };

  const header = splitCsvLine(lines[0]).map((item) => item.toLowerCase());
  const uidIndex = header.findIndex((item) => ["uid_hex", "uid", "uidhex"].includes(item));
  const batchIndex = header.findIndex((item) => ["batch_id", "batchid", "bid"].includes(item));
  if (uidIndex < 0) return { uids: [], batchIds: [] as string[] };

  const rows = lines.slice(1).map((line) => splitCsvLine(line));
  const uids = rows.map((row) => row[uidIndex]?.toUpperCase() || "").filter((uid) => /^[0-9A-F]{8,20}$/.test(uid));
  const batchIds = batchIndex >= 0 ? rows.map((row) => row[batchIndex] || "") : [];
  return { uids, batchIds };
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

function actionMessage(reason: string) {
  const lower = reason.toLowerCase();
  if (lower.includes("unknown batch") || lower.includes("batch not found")) return "Este BID no está registrado todavía. Volvé al Step 4 y ejecutá Run all.";
  if (lower.includes("not allowed") || lower.includes("not active") || lower.includes("allowlist")) return "El UID existe pero no está activado o allowlisteado. Importá UIDs y activá en el Step 4.";
  if (lower.includes("cmac") || lower.includes("mismatch")) return "Keys incorrectas (o proveedor programó con keys distintas). Revisá K_META / K_FILE del Step 2.";
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

function generatePassword() {
  const base = Math.random().toString(36).slice(-6);
  return `NexID!${base}A1`;
}

export function SupplierBatchWizard({ locale }: { locale: AppLocale }) {
  const copy = locale === "en"
    ? {
        title: "Supplier Batch Onboarding Wizard",
        subtitle: "Simple mode: complete 6 steps and leave a tenant + batch ready to scan.",
        quickAction: "Run full provisioning",
      }
    : locale === "pt-BR"
      ? {
          title: "Wizard de Onboarding do Fornecedor",
          subtitle: "Modo simples: complete 6 passos e deixe tenant + lote prontos para scan.",
          quickAction: "Executar provisionamento completo",
        }
      : {
          title: "Wizard de Onboarding Proveedor",
          subtitle: "Modo simple: completá 6 pasos y dejá tenant + batch listos para escanear.",
          quickAction: "Ejecutar provisionamiento completo",
        };

  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Completá el onboarding para dejar tenant + batch READY TO SCAN.");
  const [responseText, setResponseText] = useState("{}");

  const [tenantSegment, setTenantSegment] = useState<TenantSegment>("bodega");
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

  const [rawUidText, setRawUidText] = useState(DEMO_SUPPLIER_UIDS.join("\n"));
  const [uids, setUids] = useState<string[]>([...DEMO_SUPPLIER_UIDS]);
  const [manifestSourceType, setManifestSourceType] = useState<"txt" | "csv">("txt");
  const [batchMismatchCount, setBatchMismatchCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const [adminEnabled, setAdminEnabled] = useState(true);
  const [adminEmail, setAdminEmail] = useState("ops@demobodega.com");
  const [adminName, setAdminName] = useState("Tenant Operations Admin");
  const [adminPassword, setAdminPassword] = useState("NexID!DemoA1");

  const [importedCount, setImportedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [supplierUrl, setSupplierUrl] = useState("");
  const [readyToScan, setReadyToScan] = useState(false);
  const [validationCode, setValidationCode] = useState("PENDING");
  const [validationDetail, setValidationDetail] = useState("Pegá una URL SUN para validar estado.");
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);

  const steps = [
    "Paso 1 · Tenant + segment",
    "Paso 2 · Batch + keys",
    "Paso 3 · UID intake",
    "Paso 4 · Register + Import + Activate",
    "Paso 5 · SUN pretest",
    "Paso 6 · Resumen operativo",
  ];

  const progress = Math.round(((activeStep - 1) / (steps.length - 1)) * 100);
  const keysReady = batchMode === "internal" || (isHex32(kMeta) && isHex32(kFile));
  const uniqueUidCount = useMemo(() => new Set(uids).size, [uids]);
  const firstUid = uids[0] || "demo-item-001";
  const supplierUidReady = batchMode === "internal" || (uids.length >= 10 && duplicateCount === 0 && batchMismatchCount === 0);
  const onboardingReady = keysReady && supplierUidReady && Boolean(tenantSlug.trim()) && Boolean(bid.trim());
  const stepReady = {
    1: Boolean(tenantSlug.trim() && tenantName.trim() && bid.trim() && chipModel.trim()),
    2: keysReady,
    3: supplierUidReady,
    4: importedCount > 0 && activeCount > 0,
    5: validationCode !== "PENDING",
    6: Boolean(batchSummary),
  } as const;

  const expectedNdefTemplate = useMemo(
    () => `${productUrls.api}/sun?v=1&bid=${encodeURIComponent(bid || DEMO_SUPPLIER_BATCH_ID)}&picc_data=...&enc=...&cmac=...`,
    [bid],
  );
  const nextAction = !stepReady[1]
    ? "Completá datos de tenant + batch en Step 1."
    : !stepReady[2]
      ? "Cargá K_META/K_FILE válidas en Step 2."
      : !stepReady[3]
        ? "Importá 10 UIDs únicas en Step 3."
        : !stepReady[4]
          ? "Ejecutá Register + Import + Activate en Step 4."
          : !stepReady[5]
            ? "Pegá URL /sun real y validá estado en Step 5."
            : "Step 6 listo: abrir mobile preview y revisar resumen operativo.";

  async function run(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    const data = await parseJsonSafe(response);
    setResponseText(JSON.stringify(data, null, 2));
    if (!response.ok) {
      const reason = typeof data === "object" && data && "reason" in data
        ? String((data as { reason?: unknown }).reason || response.statusText)
        : response.statusText;
      throw new Error(reason);
    }
    return data as Record<string, unknown>;
  }

  useEffect(() => {
    setAdminPassword((current) => (current === "NexID!DemoA1" ? generatePassword() : current));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("supplier_wizard_draft_v1");
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<{
        activeStep: WizardStep;
        tenantSlug: string;
        tenantName: string;
        bid: string;
        sku: string;
        quantity: string;
        supplierUrl: string;
        batchMode: "supplier" | "internal";
      }>;
      if (draft.activeStep && draft.activeStep >= 1 && draft.activeStep <= 6) setActiveStep(draft.activeStep);
      if (typeof draft.tenantSlug === "string") setTenantSlug(draft.tenantSlug);
      if (typeof draft.tenantName === "string") setTenantName(draft.tenantName);
      if (typeof draft.bid === "string") setBid(draft.bid);
      if (typeof draft.sku === "string") setSku(draft.sku);
      if (typeof draft.quantity === "string") setQuantity(draft.quantity);
      if (typeof draft.supplierUrl === "string") setSupplierUrl(draft.supplierUrl);
      if (draft.batchMode === "supplier" || draft.batchMode === "internal") setBatchMode(draft.batchMode);
    } catch {
      // ignore malformed local draft
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("supplier_wizard_draft_v1", JSON.stringify({
        activeStep,
        tenantSlug,
        tenantName,
        bid,
        sku,
        quantity,
        supplierUrl,
        batchMode,
      }));
    } catch {
      // ignore storage write failures
    }
  }, [activeStep, tenantSlug, tenantName, bid, sku, quantity, supplierUrl, batchMode]);

  function applyPreset(segment: TenantSegment) {
    setTenantSegment(segment);
    if (segment === "cosmetica") {
      setTenantSlug("cosmetica-demo");
      setTenantName("Cosmetica Demo");
      setSku("cosmetics-secure");
      setAdminEmail("admin@cosmetica-demo.com");
      setNotes("Cosmetics rollout: serialized anti-counterfeit tags.");
      return;
    }
    if (segment === "reseller") {
      setTenantSlug("partner-reseller");
      setTenantName("Partner Reseller");
      setSku("reseller-secure");
      setAdminEmail("ops@partner-reseller.com");
      setNotes("Reseller allocation: activate based on order volume.");
      return;
    }
    if (segment === "bodega") {
      setTenantSlug("demobodega");
      setTenantName("Demo Bodega");
      setSku("wine-secure");
      setAdminEmail("ops@demobodega.com");
      setNotes("Bodega rollout with supplier-programmed keys.");
      return;
    }
    setNotes("Custom tenant rollout.");
  }

  function syncParsedUids(parsed: string[], mismatches = 0) {
    const duplicates = parsed.length - new Set(parsed).size;
    setUids(parsed);
    setDuplicateCount(duplicates);
    setBatchMismatchCount(mismatches);
    setQuantity(String(parsed.length || quantity));
    setStatus(`UIDs detectados: ${parsed.length}. Duplicados: ${duplicates}.`);
  }

  function parseRawUidText() {
    const parsed = parseUidLines(rawUidText || "");
    syncParsedUids(parsed);
  }

  async function onUidFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    if (file.name.toLowerCase().endsWith(".csv")) {
      const parsed = parseUidCsv(raw);
      const mismatches = (parsed.batchIds || []).filter((entry) => entry && entry !== bid).length;
      syncParsedUids(parsed.uids || [], mismatches);
      return;
    }
    syncParsedUids(parseUidLines(raw));
  }
  function applyDemoPreset() {
    setTenantSlug("demobodega");
    setTenantName("Demo Bodega");
    setBatchMode("supplier");
    setBid(DEMO_SUPPLIER_BATCH_ID);
    setChipModel("NTAG 424 DNA TagTamper");
    setSku("wine-secure");
    setQuantity("10");
    setKMeta("c2a462e6ab434828153d73ce440704ac");
    setKFile("bfce6c576540c04c840f1cfd457bf213");
    setUids([...DEMO_SUPPLIER_UIDS]);
    setRawUidText(DEMO_SUPPLIER_UIDS.join("\n"));
    setDuplicateCount(0);
    setBatchMismatchCount(0);
    setStatus("Preset DEMO-2026-02 cargado: tenant + keys + 10 UIDs source-of-truth.");
  }

  function downloadManifestTemplate() {
    const header = "batch_id,uid_hex\n";
    const rows = (uids.length ? uids : DEMO_SUPPLIER_UIDS).map((uid) => `${bid || DEMO_SUPPLIER_BATCH_ID},${uid}`).join("\n");
    const csv = `${header}${rows}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${bid || DEMO_SUPPLIER_BATCH_ID}-manifest-template.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function createTenantIfMissing() {
    if (!tenantSlug.trim() || !tenantName.trim()) throw new Error("Completá tenant slug y tenant name.");
    await run("/api/admin/tenants", {
      method: "POST",
      body: JSON.stringify({ slug: tenantSlug.trim().toLowerCase(), name: tenantName.trim() }),
    }).catch(() => null);
  }

  async function refreshBatchSummary() {
    if (!bid.trim()) return;
    const data = await run(`/api/admin/batches/${encodeURIComponent(bid.trim())}/summary`);
    if (data.batch && typeof data.batch === "object") {
      setBatchSummary(data.batch as BatchSummary);
    }
  }

  async function registerBatch() {
    if (!tenantSlug.trim() || !bid.trim()) throw new Error("Completá tenant_slug y bid.");
    if (batchMode === "supplier" && (!isHex32(kMeta) || !isHex32(kFile))) throw new Error("K_META y K_FILE deben ser hex de 32 caracteres.");

    return run("/api/admin/batches/register", {
      method: "POST",
      body: JSON.stringify({
        tenant_slug: tenantSlug.trim(),
        mode: batchMode,
        bid: bid.trim(),
        chip_model: chipModel.trim(),
        sku: sku.trim(),
        quantity: Number(quantity || 0) || uids.length,
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

  async function createTenantAdmin() {
    if (!adminEnabled) return null;
    if (!adminEmail.trim() || adminPassword.length < 8) throw new Error("Admin email y password(8+) requeridos.");
    try {
      return await run("/api/iam/users", {
        method: "POST",
        body: JSON.stringify({
          email: adminEmail.trim().toLowerCase(),
          fullName: adminName.trim() || "Tenant Admin",
          password: adminPassword,
          role: "tenant-admin",
          tenantSlug: tenantSlug.trim(),
          permissions: ["batches:write", "events:read", "analytics:read", "users:manage"],
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "tenant-admin create failed";
      if (message.toLowerCase().includes("unauthorized")) {
        setStatus("Tenant y batch listos. Usuario tenant-admin omitido: sesión sin permiso users:manage.");
        return null;
      }
      throw error;
    }
  }

  async function runAll() {
    setPending(true);
    setStatus("Ejecutando provisionamiento completo...");
    try {
      await createTenantIfMissing();
      await registerBatch();
      await importUids();
      await activateAll();
      await createTenantAdmin();
      await refreshBatchSummary();
      setReadyToScan(true);
      setStatus("READY TO SCAN: tenant + batch + import + activate + tenant-admin listos.");
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
      setStatus(`Validación completa. ${actionMessage(reason)}`);
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <a href="/onboarding" className="rounded-lg border border-white/15 px-3 py-1 text-slate-100">← Volver a onboarding</a>
          <a href="/batches" className="rounded-lg border border-white/15 px-3 py-1 text-slate-100">Ver todos los batches</a>
          <button type="button" className="rounded-lg border border-cyan-300/30 px-3 py-1 text-cyan-100" onClick={() => setActiveStep((prev) => Math.max(1, prev - 1) as WizardStep)}>Paso anterior</button>
          <button type="button" className="rounded-lg border border-cyan-300/30 px-3 py-1 text-cyan-100" onClick={() => setActiveStep((prev) => Math.min(6, prev + 1) as WizardStep)}>Paso siguiente</button>
        </div>

        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">Super Admin Fast Lane</p>
          <p className="mt-1 text-sm text-cyan-50">Ejecuta tenant + batch + 10 tags + tenant-admin en un solo botón.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button disabled={pending || !onboardingReady} onClick={() => void runAll()}>{copy.quickAction}</Button>
            <p className="text-xs text-cyan-100/90">Ideal para preparar 10 tags de prueba y luego escalar al pedido de fábrica.</p>
          </div>
          {!onboardingReady ? (
            <p className="mt-2 text-xs text-amber-100/90">
              Antes de ejecutar: completá tenant + bid y, en supplier mode, asegurá exactamente 10 UIDs únicos sin conflictos de batch.
            </p>
          ) : null}
        </div>

        <div className="mt-4 h-2 w-full rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          {steps.map((step, index) => (
            <button
              key={step}
              type="button"
              disabled={index + 1 > activeStep + 1}
              className={`rounded-xl border px-2 py-2 text-xs ${activeStep === index + 1 ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900/70 text-slate-300"} disabled:cursor-not-allowed disabled:opacity-45`}
              onClick={() => setActiveStep((index + 1) as WizardStep)}
            >
              {step}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">Rows parsed<br /><b className="text-white">{uids.length}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">Unique UIDs<br /><b className="text-white">{uniqueUidCount}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">Imported<br /><b className="text-white">{importedCount}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">Active<br /><b className="text-white">{activeCount}</b></div>
          <div className={`rounded-xl border p-3 text-xs ${validationCode === "VALID" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : validationCode === "REPLAY_SUSPECT" ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : "border-white/10 bg-slate-900/60 text-slate-300"}`}>
            Validator<br /><b>{validationCode}</b>
          </div>
        </div>
        <p className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">Next action: <b>{nextAction}</b></p>
      </Card>

      <Card className={`p-6 ${activeStep === 1 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 1 · Tenant + segment</h3>
        <p className="mt-1 text-xs text-slate-400">Definí si es cosmética, reseller, bodega o custom; luego cargá tenant.</p>

        <div className="mt-2 flex flex-wrap gap-2">
          {(["cosmetica", "reseller", "bodega", "custom"] as TenantSegment[]).map((segment) => (
            <button
              key={segment}
              type="button"
              className={`rounded-lg border px-2 py-1 text-xs ${tenantSegment === segment ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`}
              onClick={() => applyPreset(segment)}
            >
              {segment}
            </button>
          ))}
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

        <div className="mt-4 flex justify-end">
          <Button disabled={!stepReady[1]} onClick={() => setActiveStep(2)}>Continue to Step 2</Button>
        </div>
      </Card>

      <Card className={`p-6 ${activeStep === 2 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 2 · Batch keys</h3>
        <p className="mt-1 text-xs text-slate-400">Supplier mode exige K_META y K_FILE. Internal mode permite autogenerar.</p>

        <div className="mt-2 flex gap-2">
          <button type="button" className={`rounded-lg border px-2 py-1 text-xs ${batchMode === "supplier" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => setBatchMode("supplier")}>Supplier batch mode</button>
          <button type="button" className={`rounded-lg border px-2 py-1 text-xs ${batchMode === "internal" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => setBatchMode("internal")}>Internal batch mode</button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="rounded-xl border border-emerald-300/30 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="k_meta_hex" value={kMeta} onChange={(event) => setKMeta(event.target.value)} />
          <input className="rounded-xl border border-emerald-300/30 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="k_file_hex" value={kFile} onChange={(event) => setKFile(event.target.value)} />
        </div>

        <p className="mt-3 text-xs text-cyan-200">NDEF preview: {expectedNdefTemplate}</p>

        <div className="mt-4 flex justify-between">
          <Button variant="secondary" onClick={() => setActiveStep(1)}>Back</Button>
          <Button disabled={!stepReady[2]} onClick={() => setActiveStep(3)}>Continue to Step 3</Button>
        </div>
      </Card>

      <Card className={`p-6 ${activeStep === 3 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 3 · UID intake</h3>
        <p className="mt-1 text-sm text-slate-300">Subí .txt/.csv o pegá UIDs. Para smoke test recomendadas: 10 únicas.</p>

        <div className="mt-2 flex gap-2">
          <button type="button" className={`rounded-lg border px-2 py-1 text-xs ${manifestSourceType === "txt" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => setManifestSourceType("txt")}>TXT UID list</button>
          <button type="button" className={`rounded-lg border px-2 py-1 text-xs ${manifestSourceType === "csv" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => setManifestSourceType("csv")}>CSV manifest</button>
          <button
            type="button"
            className="rounded-lg border border-violet-200/40 px-3 py-1 text-xs text-violet-100"
            onClick={() => {
              setUids([...DEMO_SUPPLIER_UIDS]);
              setRawUidText(DEMO_SUPPLIER_UIDS.join("\n"));
              setDuplicateCount(0);
              setBatchMismatchCount(0);
              setQuantity(String(DEMO_SUPPLIER_UIDS.length));
              setStatus("Preset DEMO cargado con 10 UIDs.");
            }}
          >
            Load DEMO 10 UIDs
          </button>
        </div>

        <textarea className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" value={rawUidText} onChange={(event) => setRawUidText(event.target.value)} placeholder="1 UID por línea" />
        <button type="button" className="mt-2 rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-100" onClick={parseRawUidText}>Parse pasted TXT</button>
        <input type="file" accept=".txt,.csv,text/plain,text/csv" className="mt-3 block w-full text-sm text-slate-200" onChange={(event) => void onUidFile(event)} />

        <p className="mt-2 text-xs text-slate-400">Rows parsed: {uids.length} · Unique: {uniqueUidCount} · Duplicates: {duplicateCount} · Batch mismatch: {batchMismatchCount}</p>
        <p className={`mt-2 text-xs ${supplierUidReady ? "text-emerald-200" : "text-amber-200"}`}>
          {supplierUidReady ? "Listo para importar/activar." : "Necesitás UIDs válidas (ideal: 10 únicas sin conflicto)."}
        </p>

        <div className="mt-4 flex justify-between">
          <Button variant="secondary" onClick={() => setActiveStep(2)}>Back</Button>
          <Button disabled={!stepReady[3]} onClick={() => setActiveStep(4)}>Continue to Step 4</Button>
        </div>
      </Card>

      <Card className={`p-6 ${activeStep === 4 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 4 · Register + Import + Activate (+ optional tenant-admin)</h3>

        <div className="mt-2 rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          Este paso deja todo listo para escanear en segundos y crea un tenant-admin opcional para operación delegada.
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-slate-200">
          <input type="checkbox" checked={adminEnabled} onChange={(event) => setAdminEnabled(event.target.checked)} />
          Crear/actualizar tenant-admin
        </label>
        {adminEnabled ? (
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" placeholder="admin email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
            <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" placeholder="admin name" value={adminName} onChange={(event) => setAdminName(event.target.value)} />
            <div className="flex gap-2">
              <input className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" placeholder="admin password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
              <button type="button" className="rounded-lg border border-white/20 px-2 text-xs text-slate-100" onClick={() => setAdminPassword(generatePassword())}>regen</button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => void createTenantIfMissing()}>Create tenant</Button>
          <Button disabled={pending || !keysReady} onClick={() => void registerBatch()}>Register batch</Button>
          <Button disabled={pending || !uids.length} onClick={() => void importUids()}>Import UIDs</Button>
          <Button disabled={pending || !uids.length} onClick={() => void activateAll()}>Activate all imported UIDs</Button>
          <Button disabled={pending || !onboardingReady} variant="secondary" onClick={() => void runAll()}>Run all</Button>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Imported: {importedCount} · Active: {activeCount}
        </div>

        {readyToScan ? <p className="mt-3 rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">READY TO SCAN</p> : null}

        <div className="mt-4 flex justify-between">
          <Button variant="secondary" onClick={() => setActiveStep(3)}>Back</Button>
          <Button disabled={!stepReady[4]} onClick={() => setActiveStep(5)}>Continue to Step 5</Button>
        </div>
      </Card>

      <Card className={`p-6 ${activeStep === 5 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 5 · SUN pretest</h3>
        <p className="mt-1 text-sm text-slate-300">Pegá URL SUN completa y validá estado de negocio.</p>
        <textarea className="mt-3 min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" value={supplierUrl} onChange={(event) => setSupplierUrl(event.target.value)} placeholder="https://api.nexid.lat/sun?..." />
        <Button className="mt-3" disabled={pending} onClick={() => void validateNow()}>Validate now</Button>

        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          <p className="font-semibold">Validation status: {validationCode}</p>
          <p className="mt-1">{validationDetail}</p>
        </div>

        <div className="mt-4 flex justify-between">
          <Button variant="secondary" onClick={() => setActiveStep(4)}>Back</Button>
          <Button disabled={!stepReady[5]} onClick={() => setActiveStep(6)}>Continue to Step 6</Button>
        </div>
      </Card>

      <Card className={`p-6 ${activeStep === 6 ? "" : "hidden"}`}>
        <h3 className="text-lg font-semibold text-white">Step 6 · Resumen operativo</h3>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => void refreshBatchSummary()}>Refresh batch summary</Button>
          <a href={`/batches/${encodeURIComponent(bid.trim() || DEMO_SUPPLIER_BATCH_ID)}`} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open batch detail page</a>
          <a href={`/events?bid=${encodeURIComponent(bid.trim() || DEMO_SUPPLIER_BATCH_ID)}`} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open events</a>
          <a href={`/tags?bid=${encodeURIComponent(bid.trim() || DEMO_SUPPLIER_BATCH_ID)}`} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open tags</a>
          <a href={`/demo-lab/mobile/${encodeURIComponent(tenantSlug.trim() || "demobodega")}/${encodeURIComponent(firstUid)}?pack=wine-secure&bid=${encodeURIComponent(bid.trim() || DEMO_SUPPLIER_BATCH_ID)}&demoMode=consumer_tap`} className="rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">Open public mobile preview</a>
        </div>

        {batchSummary ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-200 md:grid-cols-2">
            <p>Batch: <b>{batchSummary.bid}</b></p>
            <p>Tenant: <b>{batchSummary.tenant_slug}</b></p>
            <p>SKU: <b>{batchSummary.sku || "-"}</b></p>
            <p>Quantity: <b>{batchSummary.requested_quantity}</b></p>
            <p>Imported tags: <b>{batchSummary.imported_tags}</b></p>
            <p>Active tags: <b>{batchSummary.active_tags}</b></p>
            <p>Inactive tags: <b>{batchSummary.inactive_tags}</b></p>
            <p>Keys loaded: <b>{batchSummary.has_meta_key && batchSummary.has_file_key ? "yes" : "partial"}</b></p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-amber-200">No batch summary loaded yet. Ejecutá Step 4 y luego Refresh.</p>
        )}
      </Card>

      <Card className="p-6">
        <p className="text-sm text-slate-300">{status}</p>
        {batchSummary ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-200 md:grid-cols-2">
            <p>Batch: <b>{batchSummary.bid}</b></p>
            <p>Tenant: <b>{batchSummary.tenant_slug}</b></p>
            <p>Chip: <b>{batchSummary.chip_model || "-"}</b></p>
            <p>SKU/Profile: <b>{batchSummary.sku || "-"}</b></p>
            <p>Requested qty: <b>{batchSummary.requested_quantity}</b></p>
            <p>Imported tags: <b>{batchSummary.imported_tags}</b></p>
            <p>Active tags: <b>{batchSummary.active_tags}</b></p>
            <p>Inactive tags: <b>{batchSummary.inactive_tags}</b></p>
            <p>Meta key loaded: <b>{batchSummary.has_meta_key ? "yes" : "no"}</b></p>
            <p>File key loaded: <b>{batchSummary.has_file_key ? "yes" : "no"}</b></p>
          </div>
        ) : null}
        <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{responseText}</pre>
      </Card>
      <Card className="sticky bottom-3 z-10 border border-cyan-300/25 bg-slate-950/95 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-300">Navegación rápida: si la sesión vence y volvés a loguear, el wizard recupera draft automáticamente.</p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={activeStep <= 1} onClick={() => setActiveStep((prev) => Math.max(1, prev - 1) as WizardStep)}>← Back step</Button>
            <Button disabled={activeStep >= 6} onClick={() => setActiveStep((prev) => Math.min(6, prev + 1) as WizardStep)}>Next step →</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
