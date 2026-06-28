"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card } from "@product/ui";
import { postAdmin } from "../lib/api";
import { DEMO_SUPPLIER_UID_TEXT } from "../lib/demo-uids";

type Role = "super-admin" | "tenant-admin" | "reseller" | "viewer";

type AdminActionFormsProps = {
  roles: Record<Role, string>;
  readyLabel: string;
  currentRole: Role;
  copy: {
    roleHeading: string;
    roleHint: Record<Role, string>;
    roleLabel: string;
    createTenant: string;
    createBatch: string;
    importManifest: string;
    activateRevoke: string;
    apiStatus: string;
    fields: {
      tenantName: string;
      tenantSlug: string;
      tenantPlan: string;
      tenantId: string;
      batchId: string;
      sku: string;
      quantity: string;
      csv: string;
      count: string;
      reason: string;
    };
    actions: {
      createTenant: string;
      createBatch: string;
      importManifest: string;
      activateTags: string;
      revokeBatch: string;
    };
  };
};

type ApiSummaryItem = { label: string; value: string };

type ActionPayload = Record<string, unknown>;
type CopyAction = { label: string; value: string };


function stringifyValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some((key) => /^k_.*_hex$/i.test(key) || /^k[A-Z].*Hex$/.test(key))) return "[custodiado en Tenant Vault]";
    return JSON.stringify(value);
  }
  return String(value ?? "-");
}

function buildSummary(data: unknown): ApiSummaryItem[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const preferredKeys = [
    "batch",
    "tenant_slug",
    "requested_quantity",
    "sku",
    "profile",
    "inserted",
    "reactivated",
    "ignored",
    "importedRows",
    "manifestBatchIds",
    "activated",
    "requested",
    "uids",
    "reason",
    "key_custody",
  ];

  const entries = preferredKeys
    .filter((key) => key in record)
    .map((key) => ({ label: key.replaceAll("_", " "), value: stringifyValue(record[key]) }));

  if (entries.length) return entries;
  return Object.entries(record).slice(0, 8).map(([key, value]) => ({ label: key.replaceAll("_", " "), value: stringifyValue(value) }));
}


function buildCopyActions(data: ActionPayload | null): CopyAction[] {
  if (!data) return [];
  const actions: CopyAction[] = [];
  if (typeof data.batch === "object" && data.batch && "bid" in data.batch) {
    actions.push({ label: "Copy batch ID", value: String((data.batch as ActionPayload).bid || "") });
  }
  if (typeof data.ndef_url_template === "string") {
    actions.push({ label: "Copy SUN URL template", value: String(data.ndef_url_template || "") });
  }
  if (actions.length > 1) {
    actions.unshift({ label: "Copy supplier handoff", value: actions.map((item) => `${item.label.replace("Copy ", "")}:: ${item.value}`).join("\n") });
  }
  return actions.filter((item) => item.value);
}

function parseManifestPreview(input: string) {
  const text = String(input || "").trim();
  if (!text) return { format: "empty", rows: 0, unique: 0, duplicates: 0, sample: [] as string[], batchIds: [] as string[] };

  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return { format: "empty", rows: 0, unique: 0, duplicates: 0, sample: [] as string[], batchIds: [] as string[] };

  const looksCsv = lines[0].includes(",");
  const rows = looksCsv ? lines.slice(1) : lines;
  const entries = rows
    .map((line) => {
      if (!looksCsv) return { uid: line, batch: "" };
      const [uid, batch] = line.split(",").map((value) => String(value || "").trim());
      return { uid, batch };
    })
    .filter((row) => row.uid && row.uid.toLowerCase() !== "uid_hex");

  const normalizedUids = entries.map((row) => row.uid.toUpperCase());
  const unique = new Set(normalizedUids);
  const duplicateCount = Math.max(0, normalizedUids.length - unique.size);
  const batchIds = Array.from(new Set(entries.map((row) => row.batch).filter(Boolean)));

  return {
    format: looksCsv ? "csv" : "txt",
    rows: entries.length,
    unique: unique.size,
    duplicates: duplicateCount,
    sample: Array.from(unique).slice(0, 3),
    batchIds,
  };
}

export function AdminActionForms({ copy, roles, readyLabel, currentRole }: AdminActionFormsProps) {
  const [role] = useState<Role>(currentRole || "super-admin");
  const [status, setStatus] = useState<string>(readyLabel);
  const [summary, setSummary] = useState<ApiSummaryItem[]>([]);
  const [lastResponse, setLastResponse] = useState<ActionPayload | null>(null);
  const [pending, setPending] = useState(false);

  const [tenant, setTenant] = useState({ name: "", slug: "", plan: "secure" });
  const [manifest, setManifest] = useState({ batchId: "", csv: "", activateImported: false });
  const [activation, setActivation] = useState({ batchId: "", count: "", uids: "" });
  const [revoke, setRevoke] = useState({ batchId: "", reason: "suspicious duplicates" });
  const [urlValidation, setUrlValidation] = useState({ sampleUrl: "" });
  const [inspectUrl, setInspectUrl] = useState("");
  const [tamperCompare, setTamperCompare] = useState({ beforeUrl: "", afterUrl: "" });
  const [tamperSamples, setTamperSamples] = useState({ closedUrls: "", openedUrls: "" });
  const [manualOpened, setManualOpened] = useState({ batchId: "", uidHex: "", reason: "physical seal opened with operator evidence", note: "" });
  const [tamperConfig, setTamperConfig] = useState({
    bid: "",
    source: "enc_decrypted",
    offset: "0",
    length: "1",
    closed: "00",
    opened: "01",
  });
  const [pilot, setPilot] = useState({
    tenantName: "Bodega Andes Pilot",
    tenantSlug: "bodega-andes-pilot",
    batchId: "",
    userEmail: "ops@bodega-andes.com",
    userPassword: "Nexid!2026",
    userName: "Ops Bodega Andes",
  });

  const canEdit = role !== "viewer";
  const roleMessage = useMemo(() => copy.roleHint[role], [copy.roleHint, role]);
  const copyActions = useMemo(() => buildCopyActions(lastResponse), [lastResponse]);
  const manifestPreview = useMemo(() => parseManifestPreview(manifest.csv), [manifest.csv]);
  const onboardingSteps = useMemo(() => [
    {
      label: "1) Register supplier batch",
      done: Boolean(pilot.tenantSlug.trim() && pilot.batchId.trim()),
      detail: "Tenant + batch + Vault + chip model",
    },
    {
      label: "2) Import supplier manifest",
      done: manifestPreview.unique > 0,
      detail: `${manifestPreview.unique} unique UID(s) detected`,
    },
    {
      label: "3) Activate imported tags",
      done: activation.batchId.trim().length > 0,
      detail: "Activate by count or specific UID list",
    },
    {
      label: "4) Validate SUN sample URL",
      done: urlValidation.sampleUrl.trim().length > 0,
      detail: "Paste one /sun?... URL to verify trust state",
    },
  ], [activation.batchId, manifestPreview.unique, pilot.batchId, pilot.tenantSlug, urlValidation.sampleUrl]);

  const hints = {
    createTenant: "Creates a new tenant workspace. Use slug lowercase and unique.",
    createBatch: "Creates a protected supplier order, stores requested volume/SKU/profile metadata, and keeps SUN secrets under Tenant Vault custody.",
    importManifest: "Imports supplier UID manifests into an existing batch (CSV with columns or plain UID text list), verifies batch_id alignment when provided, and can leave tags active on arrival when supplier-coded tags arrive ready to use.",
    activateRevoke: "Activate tags for issuance by count or explicit UID list, or revoke a batch when risk is detected.",
    validateSampleUrl: "Validates a supplier SUN URL and returns trust/auth + replay + tamper fields (when configured).",
  };

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`Copied ${value.slice(0, 24)}${value.length > 24 ? "…" : ""}`);
    } catch {
      setStatus("Clipboard unavailable");
    }
  }

  async function submit(path: string, payload: unknown) {
    setPending(true);
    setSummary([]);
    setStatus(`POST ${path}`);
    try {
      const data = await postAdmin<unknown>(path, payload);
      setLastResponse((data && typeof data === "object") ? (data as ActionPayload) : null);
      setSummary(buildSummary(data));
      setStatus("Action completed successfully");
    } catch (error) {
      setLastResponse(null);
      setSummary([]);
      setStatus(error instanceof Error ? error.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  async function compareTamperUrls() {
    if (!canEdit) return;
    const beforeUrl = tamperCompare.beforeUrl.trim();
    const afterUrl = tamperCompare.afterUrl.trim();
    if (!beforeUrl || !afterUrl) return;
    setPending(true);
    try {
      const compare = await postAdmin<unknown>("/admin/sun/compare-tamper", { closed_url: beforeUrl, opened_url: afterUrl });
      const payload = (compare || {}) as ActionPayload;
      setLastResponse(payload);
      setSummary(buildSummary(payload));
      const recommendation = String(payload.recommendation || "");
      setStatus(recommendation.includes("Need more samples") ? "Tamper compare complete - Need more samples" : "Tamper compare complete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tamper compare failed");
      setSummary([]);
      setLastResponse(null);
    } finally {
      setPending(false);
    }
  }

  async function provisionWinePilot() {
    if (!canEdit) return;
    setSummary([]);
    setLastResponse(null);
    setStatus("El alta profesional de tenant + batch + manifest ahora vive en Supplier batches. Redirigiendo...");
    window.location.assign("/batches/supplier");
  }

  async function runSupplierFlow() {
    if (!canEdit) return;
    setSummary([]);
    setLastResponse(null);
    setStatus("El runner legacy quedo bloqueado: usa Supplier Order para generar llaves en servidor y exportar el pack cifrado.");
    window.location.href = "/batches/supplier#supplier-order-console";
  }

  async function onManifestFile(file: File) {
    const raw = (await file.text()).replace(/^\uFEFF/, "");
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return;
    const first = lines[0].toLowerCase();
    if (!first.includes(",")) {
      const normalized = lines.filter((line) => line.toLowerCase() !== "uid_hex").map((line) => line.replace(/[,;\s]+/g, "").toUpperCase()).filter(Boolean);
      setManifest((current) => ({ ...current, csv: ["uid_hex", ...normalized].join("\n") }));
      return;
    }
    setManifest((current) => ({ ...current, csv: raw }));
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="text-sm font-semibold text-white">{copy.roleHeading}</p>
        <p className="mt-1 text-xs text-slate-400">{roleMessage}</p>

        <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">{copy.roleLabel}</label>
        <div className="mt-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">{roles[role]}</div>
      </Card>

      <Card className="p-5">
        <h3 className="text-base font-semibold text-white">Supplier Order protegido</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          El runner legacy queda bloqueado para produccion: ya no registra batches con K_META/K_FILE desde el navegador.
          El flujo correcto genera llaves en servidor, exporta pack cifrado de un solo uso y deja evidencia en Tenant Vault.
        </p>
        <Button className="mt-3" disabled={pending || !canEdit} onClick={() => void runSupplierFlow()}>
          Abrir Supplier Order
        </Button>
      </Card>

      <Card className="p-5">
        <h3 className="text-base font-semibold text-white">Alta profesional de tenant y batch</h3>
        <p className="mt-1 text-xs text-slate-400">El flujo productivo completo se ejecuta desde Supplier batches: perfil SUN, llaves, manifest, activacion y validacion real.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant name" value={pilot.tenantName} onChange={(event) => setPilot((current) => ({ ...current, tenantName: event.target.value }))} />
          <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant slug" value={pilot.tenantSlug} onChange={(event) => setPilot((current) => ({ ...current, tenantSlug: event.target.value }))} />
          <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="batch id" value={pilot.batchId} onChange={(event) => setPilot((current) => ({ ...current, batchId: event.target.value }))} />
          <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="ops user name" value={pilot.userName} onChange={(event) => setPilot((current) => ({ ...current, userName: event.target.value }))} />
          <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="ops email" value={pilot.userEmail} onChange={(event) => setPilot((current) => ({ ...current, userEmail: event.target.value }))} />
          <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="temporary password (8+)" value={pilot.userPassword} onChange={(event) => setPilot((current) => ({ ...current, userPassword: event.target.value }))} />
        </div>
        <Button
          className="mt-3"
          disabled={pending || !canEdit}
          onClick={() => void provisionWinePilot()}
        >
          Abrir Supplier batches
        </Button>
      </Card>

      <Card className="p-5">
        <h3 className="text-base font-semibold text-white">Supplier flow checklist</h3>
        <p className="mt-1 text-xs text-slate-400">Checklist operativo sin exponer llaves en navegador ni copiar secretos por error.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {onboardingSteps.map((step) => (
            <div key={step.label} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs">
              <p className={step.done ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>{step.done ? "OK" : "PEND"} {step.label}</p>
              <p className="mt-1 text-slate-400">{step.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.createTenant} <span className="ml-1 text-cyan-300" title={hints.createTenant}>(i)</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.createTenant}</p>
          <div className="mt-4 grid gap-3">
            <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.tenantName} value={tenant.name} onChange={(event) => setTenant({ ...tenant, name: event.target.value })} />
            <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.tenantSlug} value={tenant.slug} onChange={(event) => setTenant({ ...tenant, slug: event.target.value })} />
            <select suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={tenant.plan} onChange={(event) => setTenant({ ...tenant, plan: event.target.value })}>
              <option value="basic">BASIC</option>
              <option value="secure">SECURE</option>
              <option value="enterprise">ENTERPRISE / RESELLER</option>
            </select>
            <Button disabled={pending || !canEdit || !tenant.name || !tenant.slug} onClick={() => submit("/admin/tenants", tenant)}>{copy.actions.createTenant}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Registro de batch protegido</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Esta superficie legacy ya no acepta llaves SUN manuales. Para proveedor externo, crea una Supplier Order:
            nexID genera K_META/K_FILE en servidor, cifra el pack y registra auditoria.
          </p>
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">
            Bloqueado por seguridad: no se copian ni se pegan secretos de fabricacion en formularios de dashboard.
          </div>
          <Link
            href="/batches/supplier#supplier-order-console"
            className="mt-4 inline-flex rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100"
          >
            Abrir Supplier Order
          </Link>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.importManifest} <span className="ml-1 text-cyan-300" title={hints.importManifest}>(i)</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.importManifest}</p>
          <div className="mt-4 grid gap-3">
            <button suppressHydrationWarning
              type="button"
              disabled={!canEdit}
              className="w-fit rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100 disabled:opacity-50"
              onClick={() =>
                setManifest({
                  ...manifest,
                  csv: DEMO_SUPPLIER_UID_TEXT,
                })}
            >
              Load Echo sample UID list (10)
            </button>
            <label className="w-fit rounded-full border border-white/20 px-3 py-1 text-[11px] text-slate-200">
              Upload supplier TXT/CSV
              <input suppressHydrationWarning
                disabled={!canEdit}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void onManifestFile(file);
                }}
              />
            </label>
            <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={manifest.batchId} onChange={(event) => setManifest({ ...manifest, batchId: event.target.value })} />
            <textarea suppressHydrationWarning disabled={!canEdit} className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs" placeholder={copy.fields.csv} value={manifest.csv} onChange={(event) => setManifest({ ...manifest, csv: event.target.value })} />
            <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-400">Accepted formats: (1) CSV with uid_hex (+ optional batch_id, product_name, sku, lot, serial, image_url, label_image_url, model_url, gallery_urls) or (2) plain text UID list, one UID per line (optional first line: uid_hex).</div>
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-100">
              <p>Preview: format <b>{manifestPreview.format.toUpperCase()}</b> - rows <b>{manifestPreview.rows}</b> - unique UIDs <b>{manifestPreview.unique}</b> - duplicates <b>{manifestPreview.duplicates}</b></p>
              {manifestPreview.batchIds.length ? <p className="mt-1">Detected batch_id values: {manifestPreview.batchIds.join(", ")}</p> : null}
              {manifestPreview.sample.length ? <p className="mt-1">Sample UIDs: {manifestPreview.sample.join(", ")}</p> : null}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input suppressHydrationWarning disabled={!canEdit} type="checkbox" checked={manifest.activateImported} onChange={(event) => setManifest({ ...manifest, activateImported: event.target.checked })} />
              Activate imported tags immediately when the supplier already encoded them
            </label>
            <Button disabled={pending || !canEdit || !manifest.batchId} onClick={() => submit(`/admin/batches/${manifest.batchId}/import-manifest`, { csv: manifest.csv, activateImported: manifest.activateImported })}>{copy.actions.importManifest}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.activateRevoke} <span className="ml-1 text-cyan-300" title={hints.activateRevoke}>(i)</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.activateRevoke}</p>
          <div className="mt-4 grid gap-3">
            <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={activation.batchId} onChange={(event) => setActivation({ ...activation, batchId: event.target.value })} />
            <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.count} value={activation.count} onChange={(event) => setActivation({ ...activation, count: event.target.value })} />
            <textarea suppressHydrationWarning disabled={!canEdit} className="min-h-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs" placeholder="Optional UID list, separated by commas or new lines" value={activation.uids} onChange={(event) => setActivation({ ...activation, uids: event.target.value })} />
            <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-400">Tip: paste one UID per line when QA wants to selectively activate audited units only.</div>
            <Button disabled={pending || !canEdit || !activation.batchId || (!activation.count && !activation.uids.trim())} onClick={() => submit("/admin/tags/activate", { bid: activation.batchId, count: Number(activation.count || 0), uids: activation.uids })}>{copy.actions.activateTags}</Button>
            <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={revoke.batchId} onChange={(event) => setRevoke({ ...revoke, batchId: event.target.value })} />
            <input suppressHydrationWarning disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.reason} value={revoke.reason} onChange={(event) => setRevoke({ ...revoke, reason: event.target.value })} />
            <Button disabled={pending || !canEdit || !revoke.batchId} variant="secondary" onClick={() => { if (window.confirm("Confirm batch revoke? This can impact live validations.")) submit(`/admin/batches/${revoke.batchId}/revoke`, { reason: revoke.reason }); }}>{copy.actions.revokeBatch}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Validate Supplier Sample URL <span className="ml-1 text-cyan-300" title={hints.validateSampleUrl}>(i)</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.validateSampleUrl}</p>
          <div className="mt-4 grid gap-3">
            <textarea suppressHydrationWarning
              disabled={!canEdit}
              className="min-h-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs"
              placeholder="Pega una URL /sun recien escaneada desde una tag fisica"
              value={urlValidation.sampleUrl}
              onChange={(event) => setUrlValidation({ sampleUrl: event.target.value })}
            />
            <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-400">
              Expected trust/product states: VALID_CLOSED - VALID_OPENED - TAMPER_RISK - TAMPER_UNVERIFIED - REPLAY_SUSPECT - INVALID
            </div>
            <Button
              disabled={pending || !canEdit || !urlValidation.sampleUrl.trim()}
              onClick={() => submit("/admin/sun/validate", { url: urlValidation.sampleUrl })}
            >
              Validate sample URL
            </Button>
            <div className="rounded-xl border border-amber-300/20 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-100">Compare before/after tamper URLs</p>
              <div className="mt-2 grid gap-2">
                <textarea suppressHydrationWarning
                  disabled={!canEdit}
                  className="min-h-16 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs"
                  placeholder="URL before breaking loop"
                  value={tamperCompare.beforeUrl}
                  onChange={(event) => setTamperCompare((prev) => ({ ...prev, beforeUrl: event.target.value }))}
                />
                <textarea suppressHydrationWarning
                  disabled={!canEdit}
                  className="min-h-16 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs"
                  placeholder="URL after breaking loop"
                  value={tamperCompare.afterUrl}
                  onChange={(event) => setTamperCompare((prev) => ({ ...prev, afterUrl: event.target.value }))}
                />
                <Button disabled={pending || !canEdit || !tamperCompare.beforeUrl.trim() || !tamperCompare.afterUrl.trim()} variant="secondary" onClick={() => void compareTamperUrls()}>
                  Compare before/after tamper
                </Button>
                <textarea suppressHydrationWarning
                  disabled={!canEdit}
                  className="min-h-16 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs"
                  placeholder="Closed URLs (one per line)"
                  value={tamperSamples.closedUrls}
                  onChange={(event) => setTamperSamples((prev) => ({ ...prev, closedUrls: event.target.value }))}
                />
                <textarea suppressHydrationWarning
                  disabled={!canEdit}
                  className="min-h-16 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs"
                  placeholder="Opened URLs (one per line)"
                  value={tamperSamples.openedUrls}
                  onChange={(event) => setTamperSamples((prev) => ({ ...prev, openedUrls: event.target.value }))}
                />
                <Button
                  disabled={pending || !canEdit || !tamperSamples.closedUrls.trim() || !tamperSamples.openedUrls.trim()}
                  variant="secondary"
                  onClick={() => submit("/admin/sun/compare-tamper-samples", {
                    closed_urls: tamperSamples.closedUrls.split(/\r?\n/).map((v) => v.trim()).filter(Boolean),
                    opened_urls: tamperSamples.openedUrls.split(/\r?\n/).map((v) => v.trim()).filter(Boolean),
                  })}
                >
                  Compare multi-sample tamper
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-300/20 bg-indigo-500/5 p-3">
              <p className="text-xs font-semibold text-indigo-100">Inspect SUN URL (super-admin diagnostics)</p>
              <textarea suppressHydrationWarning
                disabled={!canEdit}
                className="mt-2 min-h-16 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs"
                placeholder="Full /sun URL for parsed payload + decrypted byte offsets"
                value={inspectUrl}
                onChange={(event) => setInspectUrl(event.target.value)}
              />
              <Button disabled={pending || !canEdit || !inspectUrl.trim()} className="mt-2" variant="secondary" onClick={() => submit("/admin/sun/inspect", { url: inspectUrl })}>
                Inspect URL payload
              </Button>
            </div>
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/5 p-3">
              <p className="text-xs font-semibold text-emerald-100">TagTamper parser config</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={tamperConfig.bid} onChange={(e) => setTamperConfig((v) => ({ ...v, bid: e.target.value }))} placeholder="batch bid" />
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={tamperConfig.source} onChange={(e) => setTamperConfig((v) => ({ ...v, source: e.target.value }))} placeholder="source: enc_decrypted" />
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={tamperConfig.offset} onChange={(e) => setTamperConfig((v) => ({ ...v, offset: e.target.value }))} placeholder="offset" />
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={tamperConfig.length} onChange={(e) => setTamperConfig((v) => ({ ...v, length: e.target.value }))} placeholder="length" />
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={tamperConfig.closed} onChange={(e) => setTamperConfig((v) => ({ ...v, closed: e.target.value }))} placeholder="closed values, comma separated" />
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={tamperConfig.opened} onChange={(e) => setTamperConfig((v) => ({ ...v, opened: e.target.value }))} placeholder="open values, comma separated" />
              </div>
              <Button
                disabled={pending || !canEdit || !tamperConfig.bid.trim()}
                className="mt-2"
                variant="secondary"
                onClick={() => submit(`/admin/batches/${tamperConfig.bid.trim()}/tamper-config`, {
                  tagtamper_enabled: true,
                  tamper_status_enabled: true,
                  tamper_status_source: tamperConfig.source,
                  tamper_status_offset: Number(tamperConfig.offset || 0),
                  tamper_status_length: Number(tamperConfig.length || 1),
                  tamper_closed_values: tamperConfig.closed.split(",").map((v) => v.trim()).filter(Boolean),
                  tamper_open_values: tamperConfig.opened.split(",").map((v) => v.trim()).filter(Boolean),
                })}
              >
                Save tamper parser config
              </Button>
            </div>
            <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/5 p-3 text-xs text-fuchsia-100">
              <p className="font-semibold">Supplier TagTamper Requirements</p>
              <p className="mt-1 whitespace-pre-wrap">- Is TagTamper open/closed status included in SUN/SDM payload?\n- Where is it located?\n- Which byte/field indicates open vs closed?\n- Can you send before/after URLs from the same tag?\n- Can you confirm production batches include this field?</p>
            </div>
            <div className="rounded-xl border border-rose-300/20 bg-rose-500/5 p-3">
              <p className="text-xs font-semibold text-rose-100">Manual opened evidence override</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={manualOpened.batchId} onChange={(e) => setManualOpened((v) => ({ ...v, batchId: e.target.value }))} placeholder="batch id" />
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={manualOpened.uidHex} onChange={(e) => setManualOpened((v) => ({ ...v, uidHex: e.target.value }))} placeholder="uid hex" />
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs md:col-span-2" value={manualOpened.reason} onChange={(e) => setManualOpened((v) => ({ ...v, reason: e.target.value }))} placeholder="reason" />
                <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs md:col-span-2" value={manualOpened.note} onChange={(e) => setManualOpened((v) => ({ ...v, note: e.target.value }))} placeholder="evidence note" />
              </div>
              <Button
                disabled={pending || !canEdit || !manualOpened.batchId.trim() || !manualOpened.uidHex.trim()}
                className="mt-2"
                variant="secondary"
                onClick={() => submit("/admin/tags/mark-opened", {
                  batch_id: manualOpened.batchId.trim(),
                  uid_hex: manualOpened.uidHex.trim().toUpperCase(),
                  reason: manualOpened.reason,
                  evidence_note: manualOpened.note,
                  source: "operator",
                })}
              >
                Mark UID as manual opened
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-xs text-cyan-300">{copy.apiStatus}</p>
        <p className="mt-1 break-all text-xs text-slate-300">{pending ? "Running action..." : status}</p>
        {summary.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {summary.map((item) => (
              <div key={`${item.label}-${item.value}`} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
                <p className="uppercase tracking-[0.14em] text-cyan-300">{item.label}</p>
                <p className="mt-1 break-all text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {copyActions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {copyActions.map((item) => (
              <button suppressHydrationWarning key={item.label} type="button" className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100" onClick={() => void copyValue(item.value)}>{item.label}</button>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
