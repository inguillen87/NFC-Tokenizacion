"use client";

import { useMemo, useState } from "react";
import { Card, Button } from "@product/ui";
import { postAdmin } from "../lib/api";

type Role = "super-admin" | "tenant-admin" | "reseller" | "viewer";

export function AdminActionForms({ title }: { title: string }) {
  const [role, setRole] = useState<Role>("super-admin");
  const [status, setStatus] = useState<string>("Ready.");
  const [tenant, setTenant] = useState({ name: "", slug: "", plan: "secure" });
  const [batch, setBatch] = useState({ tenantId: "", batchId: "", sku: "", quantity: "" });
  const [manifest, setManifest] = useState({ batchId: "", csv: "batch_id,uid_hex,ic_type,roll_id,qc_status,timestamp" });
  const [activation, setActivation] = useState({ batchId: "", count: "" });
  const [revoke, setRevoke] = useState({ batchId: "", reason: "suspicious duplicates" });
  const canEdit = role !== "viewer";

  const roleMessage = useMemo(() => ({"super-admin":"Global controls","tenant-admin":"Tenant controls","reseller":"Reseller controls","viewer":"Read-only controls"}[role]), [role]);
  async function submit(path: string, payload: unknown) { setStatus(`POST ${path}`); try { const data = await postAdmin<unknown>(path, payload); setStatus(`OK ${JSON.stringify(data).slice(0,180)}`);} catch (error) { setStatus(error instanceof Error ? error.message : "Request failed"); } }

  return <div className="space-y-6"><Card className="p-5"><p className="text-sm font-semibold text-white">{title}</p><p className="text-xs text-slate-400 mt-1">{roleMessage}</p><select className="mt-3 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={role} onChange={(e)=>setRole(e.target.value as Role)}><option value="super-admin">super admin</option><option value="tenant-admin">tenant admin</option><option value="reseller">reseller</option><option value="viewer">viewer</option></select></Card>
  <div className="grid gap-6 xl:grid-cols-2">
    <Card className="p-5"><h3 className="text-base font-semibold text-white">Create tenant</h3><div className="mt-4 grid gap-3"><input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Tenant name" value={tenant.name} onChange={(e)=>setTenant({...tenant,name:e.target.value})}/><input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant-slug" value={tenant.slug} onChange={(e)=>setTenant({...tenant,slug:e.target.value})}/><Button disabled={!canEdit} onClick={()=>submit('/admin/tenants/',tenant)}>Create tenant</Button></div></Card>
    <Card className="p-5"><h3 className="text-base font-semibold text-white">Create batch</h3><div className="mt-4 grid gap-3"><input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant_id" value={batch.tenantId} onChange={(e)=>setBatch({...batch,tenantId:e.target.value})}/><input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="batch_id" value={batch.batchId} onChange={(e)=>setBatch({...batch,batchId:e.target.value})}/><Button disabled={!canEdit} onClick={()=>submit('/admin/batches/',{...batch,quantity:Number(batch.quantity||0)})}>Create batch</Button></div></Card>
    <Card className="p-5"><h3 className="text-base font-semibold text-white">Import manifest CSV</h3><div className="mt-4 grid gap-3"><input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="batch_id" value={manifest.batchId} onChange={(e)=>setManifest({...manifest,batchId:e.target.value})}/><textarea disabled={!canEdit} className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs" value={manifest.csv} onChange={(e)=>setManifest({...manifest,csv:e.target.value})}/><Button disabled={!canEdit} onClick={()=>submit(`/admin/batches/${manifest.batchId}/import-manifest/`,{csv:manifest.csv})}>Import manifest</Button></div></Card>
    <Card className="p-5"><h3 className="text-base font-semibold text-white">Activate / Revoke</h3><div className="mt-4 grid gap-3"><input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="activation batch_id" value={activation.batchId} onChange={(e)=>setActivation({...activation,batchId:e.target.value})}/><Button disabled={!canEdit} onClick={()=>submit('/admin/tags/activate/',{...activation,count:Number(activation.count||0)})}>Activate tags</Button><input disabled={!canEdit} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="revoke batch_id" value={revoke.batchId} onChange={(e)=>setRevoke({...revoke,batchId:e.target.value})}/><Button disabled={!canEdit} variant="secondary" onClick={()=>submit(`/admin/batches/${revoke.batchId}/revoke/`,{reason:revoke.reason})}>Revoke batch</Button></div></Card>
  </div><Card className="p-4"><p className="text-xs text-cyan-300">API status</p><p className="mt-1 break-all text-xs text-slate-300">{status}</p></Card></div>;
}
