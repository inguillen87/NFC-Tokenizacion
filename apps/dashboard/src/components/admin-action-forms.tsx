"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@product/ui";
import { postAdmin } from "../lib/api";
import { DEMO_SUPPLIER_BATCH_ID, DEMO_SUPPLIER_UID_TEXT } from "../lib/demo-uids";

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
  if (value && typeof value === "object") return JSON.stringify(value);
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
    "keys",
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
  if (typeof data.keys === "object" && data.keys && "k_meta_hex" in data.keys) {
    actions.push({ label: "Copy meta key", value: String((data.keys as ActionPayload).k_meta_hex || "") });
  }
  if (typeof data.keys === "object" && data.keys && "k_file_hex" in data.keys) {
    actions.push({ label: "Copy file key", value: String((data.keys as ActionPayload).k_file_hex || "") });
  }
  if (typeof data.ndef_url_template === "string") {
    actions.push({ label: "Copy SUN URL template", value: String(data.ndef_url_template || "") });
  }
  if (actions.length > 1) {
    actions.unshift({ label: "Copy supplier handoff", value: actions.map((item) => `${item.label.replace("Copy ", "")}:: ${item.value}`).join("\n") });
  }
  return actions.filter((item) => item.value);
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
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
  const [batch, setBatch] = useState({
    tenantId: "demobodega",
    batchId: DEMO_SUPPLIER_BATCH_ID,
    sku: "",
    quantity: "10",
    chipModel: "NTAG 424 DNA TT",
    kMetaHex: "",
    kFileHex: "",
  });
  const [manifest, setManifest] = useState({ batchId: DEMO_SUPPLIER_BATCH_ID, csv: DEMO_SUPPLIER_UID_TEXT, activateImported: true });
  const [activation, setActivation] = useState({ batchId: DEMO_SUPPLIER_BATCH_ID, count: "", uids: "" });
  const [revoke, setRevoke] = useState({ batchId: "", reason: "suspicious duplicates" });
  const [urlValidation, setUrlValidation] = useState({ sampleUrl: "" });
  const [pilot, setPilot] = useState({
    tenantName: "Bodega Andes Pilot",
    tenantSlug: "bodega-andes-pilot",
    batchId: DEMO_SUPPLIER_BATCH_ID,
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
      done: Boolean(batch.tenantId.trim() && batch.batchId.trim()),
      detail: "Tenant + batch + keys + chip model",
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
  ], [activation.batchId, batch.batchId, batch.tenantId, manifestPreview.unique, urlValidation.sampleUrl]);

  const hints = {
    createTenant: "Creates a new tenant workspace. Use slug lowercase and unique.",
    createBatch: "Creates a batch under an existing tenant slug or UUID, stores requested volume/SKU/profile metadata, and returns batch keys for supplier coordination.",
    importManifest: "Imports supplier UID manifests into an existing batch (CSV with columns or plain UID text list), verifies batch_id alignment when provided, and can leave tags active on arrival when supplier-coded tags arrive ready to use.",
    activateRevoke: "Activate tags for issuance by count or explicit UID list, or revoke a batch when risk is detected.",
    validateSampleUrl: "Validates a supplier SUN URL and returns a human-readable trust state (VALID, NOT_REGISTERED, NOT_ACTIVE, INVALID, REPLAY_SUSPECT, UNKNOWN_BATCH).",
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

  async function provisionWinePilot() {
    if (!canEdit) return;
    setPending(true);
    setSummary([]);
    setLastResponse(null);
    setStatus("Provisioning wine pilot: tenant → batch → 10 tags → user...");
    try {
      const tenantsRes = await fetch("/api/admin/tenants", { cache: "no-store" });
      const tenantsRaw = await tenantsRes.text();
      const tenantsData = safeParseJson(tenantsRaw);
      const existingTenant = Array.isArray(tenantsData)
        ? tenantsData.find((item) => String((item as ActionPayload).slug || "").toLowerCase() === pilot.tenantSlug.toLowerCase())
        : null;

      const tenant = existingTenant
        ? existingTenant
        : await postAdmin<unknown>("/admin/tenants", { slug: pilot.tenantSlug, name: pilot.tenantName });

      const register = await postAdmin<unknown>("/admin/batches/register", {
        mode: "supplier",
        tenant_slug: pilot.tenantSlug,
        bid: pilot.batchId,
        chip_model: "NTAG 424 DNA TT",
        quantity: 10,
        profile: "wine-secure",
      });

      const imported = await postAdmin<unknown>(`/admin/batches/${pilot.batchId}/import-manifest`, {
        csv: DEMO_SUPPLIER_UID_TEXT,
        activateImported: true,
      });

      const activated = await postAdmin<unknown>(`/admin/batches/${pilot.batchId}/activate-all`, { limit: 10 });

      const userResponse = await fetch("/api/iam/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pilot.userEmail,
          fullName: pilot.userName,
          password: pilot.userPassword,
          role: "tenant-admin",
          tenantSlug: pilot.tenantSlug,
          permissions: ["batches:write", "events:read", "analytics:read", "users:manage"],
        }),
      });
      const userText = await userResponse.text();
      const user = safeParseJson(userText);
      if (!userResponse.ok) throw new Error(`User provisioning failed: ${userText}`);

      const finalPayload = { tenant, register, imported, activated, user };
      setLastResponse(finalPayload as ActionPayload);
      setSummary(buildSummary(finalPayload));
      setStatus("Wine pilot provisioned successfully (tenant + batch + tags + tenant-admin).");
      setBatch((current) => ({ ...current, tenantId: pilot.tenantSlug, batchId: pilot.batchId, quantity: "10" }));
      setManifest((current) => ({ ...current, batchId: pilot.batchId, csv: DEMO_SUPPLIER_UID_TEXT, activateImported: true }));
      setActivation((current) => ({ ...current, batchId: pilot.batchId, count: "10" }));
    } catch (error) {
      setLastResponse(null);
      setSummary([]);
      setStatus(error instanceof Error ? error.message : "Provisioning flow failed");
    } finally {
      setPending(false);
    }
  }

  async function runSupplierFlow() {
    if (!canEdit) return;
    setPending(true);
    setSummary([]);
    setLastResponse(null);
    setStatus("Running supplier flow: register → import → activate → validate...");
    try {
      const register = await postAdmin<unknown>("/admin/batches", {
        tenantId: batch.tenantId,
        batchId: batch.batchId,
        sku: batch.sku,
        quantity: Number(batch.quantity || 0),
        profile: "secure",
        k_meta_hex: batch.kMetaHex || undefined,
        k_file_hex: batch.kFileHex || undefined,
        sdm_config: {
          ic_type: batch.chipModel,
          tag_type: batch.chipModel,
          security_profile: "secure",
        },
      });
      const imported = await postAdmin<unknown>(`/admin/batches/${manifest.batchId}/import-manifest`, { csv: manifest.csv, activateImported: manifest.activateImported });
      const activated = await postAdmin<unknown>("/admin/tags/activate", {
        bid: activation.batchId || manifest.batchId,
        count: Number(activation.count || manifestPreview.unique || 0),
        uids: activation.uids || "",
      });
      const validated = urlValidation.sampleUrl.trim()
        ? await postAdmin<unknown>("/admin/sun/validate", { url: urlValidation.sampleUrl })
        : null;
      const finalPayload = { register, imported, activated, validated };
      setLastResponse(finalPayload as ActionPayload);
      setSummary(buildSummary(finalPayload));
      setStatus("Supplier flow completed");
    } catch (error) {
      setLastResponse(null);
      setSummary([]);
      setStatus(error instanceof Error ? error.message : "Supplier flow failed");
    } finally {
      setPending(false);
    }
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
        <h3 className="text-base font-semibold text-white">Supplier flow runner</h3>
        <p className="mt-1 text-xs text-slate-400">Run end-to-end without CLI: register batch, import manifest, activate tags and validate sample URL.</p>
        <Button className="mt-3" disabled={pending || !canEdit || !batch.batchId || !manifest.batchId} onClick={() => void runSupplierFlow()}>
          Run full supplier flow
        </Button>
      </Card>

      <Card className="p-5">
        <h3 className="text-base font-semibold text-white">Wine pilot launcher (10 physical tags)</h3>
        <p className="mt-1 text-xs text-slate-400">One-click enterprise setup from Super Admin: create tenant, register batch, import/activate 10 tags and create tenant-admin credentials.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant name" value={pilot.tenantName} onChange={(event) => setPilot((current) => ({ ...current, tenantName: event.target.value }))} />
          <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant slug" value={pilot.tenantSlug} onChange={(event) => setPilot((current) => ({ ...current, tenantSlug: event.target.value }))} />
          <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="batch id" value={pilot.batchId} onChange={(event) => setPilot((current) => ({ ...current, batchId: event.target.value }))} />
          <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="ops user name" value={pilot.userName} onChange={(event) => setPilot((current) => ({ ...current, userName: event.target.value }))} />
          <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="ops email" value={pilot.userEmail} onChange={(event) => setPilot((current) => ({ ...current, userEmail: event.target.value }))} />
          <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="temporary password (8+)" value={pilot.userPassword} onChange={(event) => setPilot((current) => ({ ...current, userPassword: event.target.value }))} />
        </div>
        <Button
          className="mt-3"
          disabled={pending || !canEdit || !pilot.tenantSlug || !pilot.batchId || !pilot.userEmail || pilot.userPassword.length < 8}
          onClick={() => void provisionWinePilot()}
        >
          Provision wine pilot (10 tags + tenant admin)
        </Button>
      </Card>

      <Card className="p-5">
        <h3 className="text-base font-semibold text-white">Supplier flow checklist</h3>
        <p className="mt-1 text-xs text-slate-400">Guided no-CLI onboarding to avoid operator mistakes during supplier handoff.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {onboardingSteps.map((step) => (
            <div key={step.label} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs">
              <p className={step.done ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>{step.done ? "✓" : "•"} {step.label}</p>
              <p className="mt-1 text-slate-400">{step.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.createTenant} <span className="ml-1 text-cyan-300" title={hints.createTenant}>ⓘ</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.createTenant}</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.tenantName} value={tenant.name} onChange={(event) => setTenant({ ...tenant, name: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.tenantSlug} value={tenant.slug} onChange={(event) => setTenant({ ...tenant, slug: event.target.value })} />
            <select disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={tenant.plan} onChange={(event) => setTenant({ ...tenant, plan: event.target.value })}>
              <option value="basic">BASIC</option>
              <option value="secure">SECURE</option>
              <option value="enterprise">ENTERPRISE / RESELLER</option>
            </select>
            <Button disabled={pending || !canEdit || !tenant.name || !tenant.slug} onClick={() => submit("/admin/tenants", tenant)}>{copy.actions.createTenant}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.createBatch} <span className="ml-1 text-cyan-300" title={hints.createBatch}>ⓘ</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.createBatch}</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.tenantId} value={batch.tenantId} onChange={(event) => setBatch({ ...batch, tenantId: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={batch.batchId} onChange={(event) => setBatch({ ...batch, batchId: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Chip model (e.g. NTAG 424 DNA TT)" value={batch.chipModel} onChange={(event) => setBatch({ ...batch, chipModel: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.sku} value={batch.sku} onChange={(event) => setBatch({ ...batch, sku: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.quantity} value={batch.quantity} onChange={(event) => setBatch({ ...batch, quantity: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs" placeholder="K_META_BATCH (32 hex, optional)" value={batch.kMetaHex} onChange={(event) => setBatch({ ...batch, kMetaHex: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs" placeholder="K_FILE_BATCH (32 hex, optional)" value={batch.kFileHex} onChange={(event) => setBatch({ ...batch, kFileHex: event.target.value })} />
            <p className="text-[11px] text-slate-500">Supplier batch registration (no CLI): tenant + batch + chip + keys + quantity. Use tenant slug or tenant UUID.</p>
            <Button
              disabled={pending || !canEdit || !batch.tenantId || !batch.batchId}
              onClick={() =>
                submit("/admin/batches", {
                  tenantId: batch.tenantId,
                  batchId: batch.batchId,
                  sku: batch.sku,
                  quantity: Number(batch.quantity || 0),
                  profile: "secure",
                  k_meta_hex: batch.kMetaHex || undefined,
                  k_file_hex: batch.kFileHex || undefined,
                  sdm_config: {
                    ic_type: batch.chipModel,
                    tag_type: batch.chipModel,
                    security_profile: "secure",
                  },
                })}
            >
              {copy.actions.createBatch}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.importManifest} <span className="ml-1 text-cyan-300" title={hints.importManifest}>ⓘ</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.importManifest}</p>
          <div className="mt-4 grid gap-3">
            <button
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
              <input
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
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={manifest.batchId} onChange={(event) => setManifest({ ...manifest, batchId: event.target.value })} />
            <textarea disabled={!canEdit} className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs" placeholder={copy.fields.csv} value={manifest.csv} onChange={(event) => setManifest({ ...manifest, csv: event.target.value })} />
            <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-400">Accepted formats: (1) CSV with uid_hex (+ optional batch_id, ic_type, roll_id, qc_status, timestamp) or (2) plain text UID list, one UID per line (optional first line: uid_hex).</div>
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-100">
              <p>Preview: format <b>{manifestPreview.format.toUpperCase()}</b> · rows <b>{manifestPreview.rows}</b> · unique UIDs <b>{manifestPreview.unique}</b> · duplicates <b>{manifestPreview.duplicates}</b></p>
              {manifestPreview.batchIds.length ? <p className="mt-1">Detected batch_id values: {manifestPreview.batchIds.join(", ")}</p> : null}
              {manifestPreview.sample.length ? <p className="mt-1">Sample UIDs: {manifestPreview.sample.join(", ")}</p> : null}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input disabled={!canEdit} type="checkbox" checked={manifest.activateImported} onChange={(event) => setManifest({ ...manifest, activateImported: event.target.checked })} />
              Activate imported tags immediately when the supplier already encoded them
            </label>
            <Button disabled={pending || !canEdit || !manifest.batchId} onClick={() => submit(`/admin/batches/${manifest.batchId}/import-manifest`, { csv: manifest.csv, activateImported: manifest.activateImported })}>{copy.actions.importManifest}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.activateRevoke} <span className="ml-1 text-cyan-300" title={hints.activateRevoke}>ⓘ</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.activateRevoke}</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={activation.batchId} onChange={(event) => setActivation({ ...activation, batchId: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.count} value={activation.count} onChange={(event) => setActivation({ ...activation, count: event.target.value })} />
            <textarea disabled={!canEdit} className="min-h-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs" placeholder="Optional UID list, separated by commas or new lines" value={activation.uids} onChange={(event) => setActivation({ ...activation, uids: event.target.value })} />
            <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-400">Tip: paste one UID per line when QA wants to selectively activate audited units only.</div>
            <Button disabled={pending || !canEdit || !activation.batchId || (!activation.count && !activation.uids.trim())} onClick={() => submit("/admin/tags/activate", { bid: activation.batchId, count: Number(activation.count || 0), uids: activation.uids })}>{copy.actions.activateTags}</Button>
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={revoke.batchId} onChange={(event) => setRevoke({ ...revoke, batchId: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.reason} value={revoke.reason} onChange={(event) => setRevoke({ ...revoke, reason: event.target.value })} />
            <Button disabled={pending || !canEdit || !revoke.batchId} variant="secondary" onClick={() => { if (window.confirm("Confirm batch revoke? This can impact live validations.")) submit(`/admin/batches/${revoke.batchId}/revoke`, { reason: revoke.reason }); }}>{copy.actions.revokeBatch}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Validate Supplier Sample URL <span className="ml-1 text-cyan-300" title={hints.validateSampleUrl}>ⓘ</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.validateSampleUrl}</p>
          <div className="mt-4 grid gap-3">
            <textarea
              disabled={!canEdit}
              className="min-h-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs"
              placeholder={`https://api.nexid.lat/sun?v=1&bid=${DEMO_SUPPLIER_BATCH_ID}&picc_data=...&enc=...&cmac=...`}
              value={urlValidation.sampleUrl}
              onChange={(event) => setUrlValidation({ sampleUrl: event.target.value })}
            />
            <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-400">
              Expected trust states: VALID · NOT_REGISTERED · NOT_ACTIVE · INVALID · REPLAY_SUSPECT · UNKNOWN_BATCH
            </div>
            <Button
              disabled={pending || !canEdit || !urlValidation.sampleUrl.trim()}
              onClick={() => submit("/admin/sun/validate", { url: urlValidation.sampleUrl })}
            >
              Validate sample URL
            </Button>
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
              <button key={item.label} type="button" className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100" onClick={() => void copyValue(item.value)}>{item.label}</button>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
