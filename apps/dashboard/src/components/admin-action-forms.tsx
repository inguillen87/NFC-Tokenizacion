"use client";

import { useMemo, useState } from "react";
import { Card, Button } from "@product/ui";
import { postAdmin } from "../lib/api";

type Role = "super-admin" | "tenant-admin" | "reseller" | "viewer";

const roles: Array<{ value: Role; label: string }> = [
  { value: "super-admin", label: "Super Admin" },
  { value: "tenant-admin", label: "Tenant Admin" },
  { value: "reseller", label: "Reseller" },
  { value: "viewer", label: "Viewer" },
];

export function AdminActionForms() {
  const [role, setRole] = useState<Role>("super-admin");
  const [status, setStatus] = useState<string>("Ready.");

  const [tenant, setTenant] = useState({ name: "", slug: "", plan: "secure" });
  const [batch, setBatch] = useState({ tenantId: "", batchId: "", sku: "", quantity: "" });
  const [manifest, setManifest] = useState({ batchId: "", csv: "batch_id,uid_hex,ic_type,roll_id,qc_status,timestamp" });
  const [activation, setActivation] = useState({ batchId: "", count: "" });
  const [revoke, setRevoke] = useState({ batchId: "", reason: "suspicious duplicates" });

  const canEdit = role !== "viewer";
  const resellerScope = role === "reseller";

  const roleMessage = useMemo(() => {
    if (role === "super-admin") return "Global controls unlocked: tenants, batches, revocations and reseller governance.";
    if (role === "tenant-admin") return "Tenant operations enabled: batches, activations, manifest and analytics for your org.";
    if (role === "reseller") return "Reseller mode: sub-tenant onboarding and white-label funnel enabled.";
    return "Viewer mode: read-only analytics and alerts.";
  }, [role]);

  async function submit(path: string, payload: unknown) {
    setStatus(`Posting to ${path}...`);
    try {
      const data = await postAdmin<unknown>(path, payload);
      setStatus(`OK ${path}: ${JSON.stringify(data).slice(0, 180)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Role-based UX</p>
            <p className="mt-1 text-sm text-slate-400">{roleMessage}</p>
          </div>
          <select
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {roles.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Create tenant</h3>
          <p className="mt-1 text-xs text-slate-400">POST /admin/tenants/</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Tenant name" value={tenant.name} onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant-slug" value={tenant.slug} onChange={(e) => setTenant({ ...tenant, slug: e.target.value })} />
            <select disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={tenant.plan} onChange={(e) => setTenant({ ...tenant, plan: e.target.value })}>
              <option value="basic">BASIC</option><option value="secure">SECURE</option><option value="enterprise">ENTERPRISE / RESELLER</option>
            </select>
            <Button disabled={!canEdit} onClick={() => submit("/admin/tenants/", tenant)}>Create tenant</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Create batch</h3>
          <p className="mt-1 text-xs text-slate-400">POST /admin/batches/</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant_id" value={batch.tenantId} onChange={(e) => setBatch({ ...batch, tenantId: e.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="batch_id" value={batch.batchId} onChange={(e) => setBatch({ ...batch, batchId: e.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="sku" value={batch.sku} onChange={(e) => setBatch({ ...batch, sku: e.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="quantity" value={batch.quantity} onChange={(e) => setBatch({ ...batch, quantity: e.target.value })} />
            <Button disabled={!canEdit} onClick={() => submit("/admin/batches/", { ...batch, quantity: Number(batch.quantity || 0) })}>Create batch</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Import manifest CSV</h3>
          <p className="mt-1 text-xs text-slate-400">POST /admin/batches/:bid/import-manifest/</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="batch_id" value={manifest.batchId} onChange={(e) => setManifest({ ...manifest, batchId: e.target.value })} />
            <textarea disabled={!canEdit} className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={manifest.csv} onChange={(e) => setManifest({ ...manifest, csv: e.target.value })} />
            <Button disabled={!canEdit} onClick={() => submit(`/admin/batches/${manifest.batchId}/import-manifest/`, { csv: manifest.csv })}>Import manifest</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Activate tags + Revoke batch</h3>
          <p className="mt-1 text-xs text-slate-400">POST /admin/tags/activate/ · /admin/batches/:bid/revoke/</p>
          <div className="mt-4 grid gap-3">
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="activation batch_id" value={activation.batchId} onChange={(e) => setActivation({ ...activation, batchId: e.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="count" value={activation.count} onChange={(e) => setActivation({ ...activation, count: e.target.value })} />
            <Button disabled={!canEdit} onClick={() => submit("/admin/tags/activate/", { ...activation, count: Number(activation.count || 0) })}>Activate tags</Button>
            <hr className="border-white/10" />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="revoke batch_id" value={revoke.batchId} onChange={(e) => setRevoke({ ...revoke, batchId: e.target.value })} />
            <input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="reason" value={revoke.reason} onChange={(e) => setRevoke({ ...revoke, reason: e.target.value })} />
            <Button disabled={!canEdit} variant="secondary" onClick={() => submit(`/admin/batches/${revoke.batchId}/revoke/`, { reason: revoke.reason })}>Revoke batch</Button>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-xs text-cyan-300">API status</p>
        <p className="mt-1 break-all text-xs text-slate-300">{status}</p>
        {resellerScope && <p className="mt-3 text-xs text-amber-300">Reseller role can only operate assigned tenants in production.</p>}
      </Card>
    </div>
  );
}
