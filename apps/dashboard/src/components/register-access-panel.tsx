"use client";

import { useState } from "react";
import { Button } from "@product/ui";
import { SignUpButton } from "@clerk/nextjs";

export function RegisterAccessPanel({ submitLabel, clerkEnabled }: { submitLabel: string; clerkEnabled?: boolean }) {
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
      {clerkEnabled && (
        <div className="md:col-span-2 grid gap-3 mb-2">
          <SignUpButton mode="modal">
            <button type="button" onClick={() => {}} className="flex items-center justify-center gap-3 w-full rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-3 font-semibold text-cyan-50 shadow-[0_18px_40px_rgba(6,182,212,0.12)] hover:border-cyan-200 hover:bg-cyan-400/20 transition">
              <span>🔐 Registrarse con Google o Facebook</span>
            </button>
          </SignUpButton>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">o solicitar acceso manual</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        </div>
      )}

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
