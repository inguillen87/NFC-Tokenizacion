"use client";

import { useEffect, useState } from "react";
import { Button } from "@product/ui";
import {
  EnterpriseRoleCatalogGate,
  EnterpriseRolePresetSummary,
  EnterpriseRoleSelect,
  useEnterpriseRoleCatalog,
} from "./enterprise-role-catalog-control";
import {
  ENTERPRISE_ROLE_PERMISSION_MODE,
  normalizeEnterpriseRoleCode,
} from "../lib/enterprise-role-catalog";

export function InviteUserPanel() {
  const catalog = useEnterpriseRoleCatalog();
  const [form, setForm] = useState({ email: "", fullName: "", role: "", tenantSlug: "" });
  const [status, setStatus] = useState("");
  const [activationLink, setActivationLink] = useState("");

  useEffect(() => {
    if (catalog.status !== "ready") return;
    setForm((current) => catalog.byCode.has(normalizeEnterpriseRoleCode(current.role))
      ? current
      : { ...current, role: catalog.roles.find((role) => role.code === "viewer")?.code || catalog.roles[0]?.code || "" });
  }, [catalog.status, catalog.roles, catalog.byCode]);

  async function submit() {
    setStatus("");
    setActivationLink("");
    const selectedRole = catalog.byCode.get(normalizeEnterpriseRoleCode(form.role));
    if (catalog.status !== "ready" || !selectedRole) {
      setStatus("La invitación quedó bloqueada porque el rol no pertenece al catálogo autorizado.");
      return;
    }
    const res = await fetch("/api/iam/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        role: selectedRole.code,
        tenantSlug: selectedRole.tenantBound ? (form.tenantSlug || null) : null,
        permissions: [],
        permissionMode: ENTERPRISE_ROLE_PERMISSION_MODE,
      }),
    }).catch(() => null);

    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setStatus(data?.reason || "No se pudo crear la invitación.");
      return;
    }
    setStatus("Invitación creada correctamente con el preset RBAC autoritativo.");
    if (data?.activationLink) setActivationLink(data.activationLink);
  }

  const selectedRole = catalog.byCode.get(normalizeEnterpriseRoleCode(form.role));

  return (
    <div className="mt-4 grid gap-3">
      <EnterpriseRoleCatalogGate status={catalog.status} error={catalog.error} onRetry={catalog.reload} />
      <input suppressHydrationWarning className="dashboard-auth-input rounded-xl border border-white/10 px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
      <input suppressHydrationWarning className="dashboard-auth-input rounded-xl border border-white/10 px-3 py-2 text-sm" placeholder="Nombre completo" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
      <EnterpriseRoleSelect
        roles={catalog.roles}
        value={form.role}
        disabled={catalog.status !== "ready"}
        onChange={(role) => setForm((current) => ({ ...current, role }))}
      />
      <label className="grid gap-1.5 text-xs font-bold text-slate-300">
        Tenant slug
        <input
          suppressHydrationWarning
          className="dashboard-auth-input min-h-11 rounded-xl border border-white/10 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={selectedRole?.tenantBound ? "tenant slug" : "Rol global"}
          value={form.tenantSlug}
          disabled={!selectedRole?.tenantBound}
          onChange={(event) => setForm((current) => ({ ...current, tenantSlug: event.target.value }))}
        />
      </label>
      <EnterpriseRolePresetSummary role={selectedRole} />
      <Button disabled={catalog.status !== "ready" || !selectedRole} className="w-full" onClick={submit}>Crear invitación</Button>
      {status ? <p className="text-xs text-cyan-200" aria-live="polite">{status}</p> : null}
      {activationLink ? <code className="break-all rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{activationLink}</code> : null}
    </div>
  );
}
