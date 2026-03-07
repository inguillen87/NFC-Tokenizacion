"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@product/ui";
import { postAdmin } from "../lib/api";

type Role = "super-admin" | "tenant-admin" | "reseller" | "viewer";

type AdminActionFormsProps = {
  roles: Record<Role, string>;
  readyLabel: string;
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

export function AdminActionForms({ copy, roles, readyLabel }: AdminActionFormsProps) {
  const [role, setRole] = useState<Role>("super-admin");
  const [status, setStatus] = useState<string>(readyLabel);

  const [tenant, setTenant] = useState({ name: "", slug: "", plan: "secure" });
  const [batch, setBatch] = useState({ tenantId: "", batchId: "", sku: "", quantity: "" });
  const [manifest, setManifest] = useState({ batchId: "", csv: "batch_id,uid_hex,ic_type,roll_id,qc_status,timestamp" });
  const [activation, setActivation] = useState({ batchId: "", count: "" });
  const [revoke, setRevoke] = useState({ batchId: "", reason: "suspicious duplicates" });

  const canEdit = role !== "viewer";
  const roleMessage = useMemo(() => copy.roleHint[role], [copy.roleHint, role]);


  const hints = {
    createTenant: "Creates a new tenant workspace. Use slug lowercase and unique.",
    createBatch: "Creates a batch under an existing tenant slug/id for provisioning tags.",
    importManifest: "Imports CSV rows (UID + metadata) into an existing batch.",
    activateRevoke: "Activate tags for issuance, or revoke a batch when risk is detected.",
  };

  async function submit(path: string, payload: unknown) {
    setStatus(`POST ${path}`);
    try {
      const data = await postAdmin<unknown>(path, payload);
      setStatus(`OK ${JSON.stringify(data).slice(0, 180)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="text-sm font-semibold text-white">{copy.roleHeading}</p>
        <p className="mt-1 text-xs text-slate-400">{roleMessage}</p>

        <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">{copy.roleLabel}</label>
        <select
          className="mt-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          {Object.entries(roles).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
            <Button disabled={!canEdit || !tenant.name || !tenant.slug} onClick={() => submit("/admin/tenants", tenant)}>{copy.actions.createTenant}</Button>
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
            <Button disabled={!canEdit || !batch.tenantId || !batch.batchId} onClick={() => submit("/admin/batches", { ...batch, quantity: Number(batch.quantity || 0) })}>{copy.actions.createBatch}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.importManifest} <span className="ml-1 text-cyan-300" title={hints.importManifest}>ⓘ</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.importManifest}</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={manifest.batchId} onChange={(event) => setManifest({ ...manifest, batchId: event.target.value })} />
            <textarea disabled={!canEdit} className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" placeholder={copy.fields.csv} value={manifest.csv} onChange={(event) => setManifest({ ...manifest, csv: event.target.value })} />
            <Button disabled={!canEdit || !manifest.batchId} onClick={() => submit(`/admin/batches/${manifest.batchId}/import-manifest`, { csv: manifest.csv })}>{copy.actions.importManifest}</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">{copy.activateRevoke} <span className="ml-1 text-cyan-300" title={hints.activateRevoke}>ⓘ</span></h3>
          <p className="mt-1 text-xs text-slate-400">{hints.activateRevoke}</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={activation.batchId} onChange={(event) => setActivation({ ...activation, batchId: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.count} value={activation.count} onChange={(event) => setActivation({ ...activation, count: event.target.value })} />
            <Button disabled={!canEdit || !activation.batchId || !activation.count} onClick={() => submit("/admin/tags/activate", { ...activation, count: Number(activation.count || 0) })}>{copy.actions.activateTags}</Button>
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.batchId} value={revoke.batchId} onChange={(event) => setRevoke({ ...revoke, batchId: event.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.fields.reason} value={revoke.reason} onChange={(event) => setRevoke({ ...revoke, reason: event.target.value })} />
            <Button disabled={!canEdit || !revoke.batchId} variant="secondary" onClick={() => { if (window.confirm("Confirm batch revoke?")) submit(`/admin/batches/${revoke.batchId}/revoke`, { reason: revoke.reason }); }}>{copy.actions.revokeBatch}</Button>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-xs text-cyan-300">{copy.apiStatus}</p>
        <p className="mt-1 break-all text-xs text-slate-300">{status}</p>
      </Card>
    </div>
  );
}
