"use client";

import { useState } from "react";
import { Button } from "@product/ui";

export function InviteUserPanel() {
  const [form, setForm] = useState({ email: "", fullName: "", role: "viewer", tenantSlug: "", permissions: "events:read,analytics:read" });
  const [status, setStatus] = useState("");
  const [activationLink, setActivationLink] = useState("");

  async function submit() {
    setStatus("");
    setActivationLink("");
    const res = await fetch('/api/iam/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        permissions: form.permissions.split(',').map((item) => item.trim()).filter(Boolean),
      }),
    }).catch(() => null);

    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setStatus(data?.reason || 'No se pudo crear la invitación.');
      return;
    }
    setStatus('Invitación creada correctamente.');
    if (data?.activationLink) setActivationLink(data.activationLink);
  }

  return (
    <div className="mt-4 grid gap-3">
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Nombre completo" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Tenant slug (opcional)" value={form.tenantSlug} onChange={(e) => setForm((s) => ({ ...s, tenantSlug: e.target.value }))} />
      <select suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>
        <option value="tenant-admin">Tenant Admin</option>
        <option value="reseller">Reseller</option>
        <option value="viewer">Viewer</option>
      </select>
      <textarea suppressHydrationWarning className="min-h-20 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.permissions} onChange={(e) => setForm((s) => ({ ...s, permissions: e.target.value }))} />
      <Button className="w-full" onClick={submit}>Crear invitación</Button>
      {status ? <p className="text-xs text-cyan-200">{status}</p> : null}
      {activationLink ? <code className="rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 break-all">{activationLink}</code> : null}
    </div>
  );
}
