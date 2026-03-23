"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@product/ui";
import { postAdmin } from "../lib/api";

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

export function AdminActionForms({ copy, roles, readyLabel, currentRole }: AdminActionFormsProps) {
  const role = currentRole;
  const [status, setStatus] = useState<string>(readyLabel);
  const [summary, setSummary] = useState<ApiSummaryItem[]>([]);
  const [lastResponse, setLastResponse] = useState<ActionPayload | null>(null);
  const [pending, setPending] = useState(false);

  const [tenant, setTenant] = useState({ name: "", slug: "", plan: "secure" });
  const [batch, setBatch] = useState({ tenantId: "", batchId: "", sku: "", quantity: "" });
  const [manifest, setManifest] = useState({ batchId: "", csv: "batch_id,uid_hex,ic_type,roll_id,qc_status,timestamp", activateImported: true });
  const [activation, setActivation] = useState({ batchId: "", count: "", uids: "" });
  const [revoke, setRevoke] = useState({ batchId: "", reason: "suspicious duplicates" });

  const canEdit = role !== "viewer";
  const roleMessage = useMemo(() => copy.roleHint[role], [copy.roleHint, role]);
  const copyActions = useMemo(() => buildCopyActions(lastResponse), [lastResponse]);

  const hints = {
    createTenant: "Creates a new tenant workspace. Use slug lowercase and unique.",
    createBatch: "Quick batch creation for platform-managed keys only. Do not use this card for supplier-programmed tags that already depend on agreed K_META_BATCH / K_FILE_BATCH values.",
    importManifest: "Imports CSV rows (UID + metadata) into an existing batch, verifies batch_id alignment, and can leave them active on arrival when supplier-coded tags arrive ready to use.",
    activateRevoke: "Activate tags for issuance by count or explicit UID list, or revoke a batch when risk is detected.",
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

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="text-sm font-semibold text-white">{copy.roleHeading}</p>
        <p className="mt-1 text-xs text-slate-400">{roleMessage}</p>

        <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">{copy.roleLabel}</label>
        <div className="mt-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">{roles[role]}</div>
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
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.sku} value={batch.sku} onChange={(event) => setBatch({ ...batch, sku: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.quantity} value={batch.quantity} onChange={(event) => setBatch({ ...batch, quantity: event.target.value })} />
            <p className="text-[11px] text-amber-200">Quick flow only. If factory already has fixed keys, stop here and use Register Supplier Batch.</p>
            <Button disabled={pending || !canEdit || !batch.tenantId || !batch.batchId} onClick={() => submit("/admin/batches", { ...batch, quantity: Number(batch.quantity || 0) })}>{copy.actions.createBatch}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.importManifest} <span className="ml-1 text-cyan-300" title={hints.importManifest}>ⓘ</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.importManifest}</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={manifest.batchId} onChange={(event) => setManifest({ ...manifest, batchId: event.target.value })} />
            <textarea disabled={!canEdit} className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs" placeholder={copy.fields.csv} value={manifest.csv} onChange={(event) => setManifest({ ...manifest, csv: event.target.value })} />
            <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-400">Expected columns: batch_id, uid_hex and optional metadata like ic_type, roll_id, qc_status, timestamp.</div>
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
