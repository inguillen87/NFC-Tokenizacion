"use client";

import { useState } from "react";
import { Button } from "@product/ui";

export function RegisterAccessPanel({ submitLabel }: { submitLabel: string }) {
  const [form, setForm] = useState({ company: "", email: "", tenantSlug: "", fullName: "", role: "tenant-admin" });
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setStatus("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setStatus(data?.reason || "No se pudo enviar la solicitud.");
      setPending(false);
      return;
    }
    setStatus(data?.mode === "request_access" ? "Solicitud de acceso enviada. El equipo admin revisará tu alta." : "Usuario creado en pending_activation. Revisá el flujo de activación.");
    setPending(false);
  }

  return (
    <div className="mt-2 grid gap-3 md:grid-cols-2">
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Empresa" value={form.company} onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))} />
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Tenant slug" value={form.tenantSlug} onChange={(e) => setForm((s) => ({ ...s, tenantSlug: e.target.value }))} />
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Nombre completo" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
      <select suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>
        <option value="tenant-admin">Tenant Admin</option>
        <option value="reseller">Reseller</option>
        <option value="viewer">Viewer / Cliente</option>
      </select>
      <Button className="w-full md:col-span-2" onClick={submit} disabled={pending}>{submitLabel}</Button>
      {status ? <p className="md:col-span-2 text-xs text-cyan-200">{status}</p> : null}
    </div>
  );
}
