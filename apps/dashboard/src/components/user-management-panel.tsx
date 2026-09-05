"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@product/ui";
import {
  EnterpriseRoleCatalogGate,
  EnterpriseRolePresetSummary,
  EnterpriseRoleSelect,
  useEnterpriseRoleCatalog,
} from "./enterprise-role-catalog-control";
import {
  ENTERPRISE_ROLE_PERMISSION_MODE,
  normalizeEnterpriseRoleCode,
  type EnterpriseRoleCatalogEntry,
} from "../lib/enterprise-role-catalog";

type UserRow = {
  id: string;
  email: string;
  label: string;
  role: string;
  tenant_slug?: string | null;
  mfa_enabled: boolean;
  permissions: string[];
  denied_permissions?: string[];
};

type UserEditorState = Record<string, { role: string; tenantSlug: string }>;

function preferredRole(roles: EnterpriseRoleCatalogEntry[]) {
  return roles.find((role) => role.code === "viewer")?.code || roles[0]?.code || "";
}

export function UserManagementPanel() {
  const catalog = useEnterpriseRoleCatalog();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ email: "", fullName: "", password: "", role: "", tenantSlug: "" });
  const [editors, setEditors] = useState<UserEditorState>({});

  async function load() {
    try {
      const res = await fetch("/api/iam/users", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.users)) {
        throw new Error(data?.reason || "No se pudo cargar el directorio de usuarios.");
      }
      const nextUsers = data.users as UserRow[];
      setUsers(nextUsers);
      setEditors(Object.fromEntries(nextUsers.map((user) => [user.id, {
        role: normalizeEnterpriseRoleCode(user.role),
        tenantSlug: user.tenant_slug || "",
      }])));
    } catch (error) {
      setUsers([]);
      setEditors({});
      setStatus(error instanceof Error ? error.message : "No se pudo cargar el directorio de usuarios.");
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (catalog.status !== "ready") return;
    setForm((current) => catalog.byCode.has(normalizeEnterpriseRoleCode(current.role))
      ? current
      : { ...current, role: preferredRole(catalog.roles) });
  }, [catalog.status, catalog.roles, catalog.byCode]);

  async function createUser() {
    const selectedRole = catalog.byCode.get(normalizeEnterpriseRoleCode(form.role));
    if (catalog.status !== "ready" || !selectedRole) {
      setStatus("La operación quedó bloqueada porque el rol no pertenece al catálogo autorizado.");
      return;
    }
    const res = await fetch("/api/iam/users", {
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
    setStatus(res?.ok ? "Usuario guardado con el preset RBAC autoritativo." : (data?.reason || "No se pudo guardar el usuario."));
    if (res?.ok) {
      setForm({ email: "", fullName: "", password: "", role: preferredRole(catalog.roles), tenantSlug: "" });
      void load();
    }
  }

  async function saveUser(userId: string) {
    const editor = editors[userId];
    const selectedRole = editor && catalog.byCode.get(normalizeEnterpriseRoleCode(editor.role));
    if (catalog.status !== "ready" || !editor || !selectedRole) {
      setStatus("La operación quedó bloqueada porque el rol no pertenece al catálogo autorizado.");
      return;
    }
    const res = await fetch(`/api/iam/users/${userId}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: selectedRole.code,
        tenantSlug: selectedRole.tenantBound ? (editor.tenantSlug || null) : null,
        permissionMode: ENTERPRISE_ROLE_PERMISSION_MODE,
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setStatus(res?.ok ? "Usuario actualizado con el preset RBAC autoritativo." : (data?.reason || "No se pudo actualizar el usuario."));
    if (res?.ok) void load();
  }

  async function issueReset(userId: string) {
    const res = await fetch(`/api/iam/users/${userId}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setStatus(data?.reason || "No se pudo iniciar el restablecimiento.");
      return;
    }
    const deliveryConfirmed = ["sent", "delivered", "queued"].includes(String(data?.deliveryStatus || "").toLowerCase());
    setStatus(deliveryConfirmed
      ? "Restablecimiento solicitado y entrega confirmada por el proveedor."
      : "Restablecimiento creado, pero esta pantalla no confirmó ninguna entrega. Configurá el proveedor antes de depender de este flujo.");
  }

  async function resetMfa(userId: string) {
    const res = await fetch(`/api/iam/users/${userId}/mfa-reset`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setStatus(res.ok ? "MFA legacy revocado y sesiones invalidadas." : (data?.reason || "No se pudo revocar el MFA legacy."));
    if (res.ok) void load();
  }

  const selectedFormRole = catalog.byCode.get(normalizeEnterpriseRoleCode(form.role));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Usuarios y permisos</h2>
        <p className="mt-2 text-sm text-slate-400">Asigná presets enterprise autorizados. El backend aplica sus capacidades, revalida la delegación y revoca sesiones al cambiar un rol.</p>
        <div className="mt-4">
          <EnterpriseRoleCatalogGate status={catalog.status} error={catalog.error} onRetry={catalog.reload} />
        </div>
        <div className="mt-4 space-y-3">
          {users.map((user) => {
            const editor = editors[user.id] || { role: normalizeEnterpriseRoleCode(user.role), tenantSlug: user.tenant_slug || "" };
            const selectedRole = catalog.byCode.get(normalizeEnterpriseRoleCode(editor.role));
            return (
              <div key={user.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{user.label}</p>
                    <p className="text-xs text-cyan-200">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-400">tenant {user.tenant_slug || "global"} · {user.mfa_enabled ? "MFA legacy detectado" : "TOTP no habilitado"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="px-3 py-2 text-xs" onClick={() => issueReset(user.id)}>Iniciar restablecimiento</Button>
                    {user.mfa_enabled ? <Button className="px-3 py-2 text-xs" onClick={() => resetMfa(user.id)}>Revocar MFA legacy</Button> : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
                  <EnterpriseRoleSelect
                    roles={catalog.roles}
                    value={editor.role}
                    disabled={catalog.status !== "ready"}
                    onChange={(role) => setEditors((current) => ({ ...current, [user.id]: { ...editor, role } }))}
                  />
                  <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                    Tenant slug
                    <input
                      suppressHydrationWarning
                      className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={selectedRole?.tenantBound ? "tenant slug" : "Rol global"}
                      value={editor.tenantSlug}
                      disabled={!selectedRole?.tenantBound}
                      onChange={(event) => setEditors((current) => ({ ...current, [user.id]: { ...editor, tenantSlug: event.target.value } }))}
                    />
                  </label>
                  <Button disabled={catalog.status !== "ready" || !selectedRole} className="px-3 py-2 text-sm" onClick={() => saveUser(user.id)}>Guardar cambios</Button>
                </div>
                <div className="mt-3"><EnterpriseRolePresetSummary role={selectedRole} /></div>
                {(Array.isArray(user.permissions) && user.permissions.length > 0)
                  || (Array.isArray(user.denied_permissions) && user.denied_permissions.length > 0)
                  ? <p className="mt-3 text-xs text-slate-500">Este usuario conserva {user.permissions.length} permiso(s) directo(s) y {user.denied_permissions?.length || 0} denegación(es). Guardar el rol no elimina esas excepciones.</p>
                  : null}
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Alta / actualización</h2>
        <p className="mt-2 text-sm text-slate-400">Los permisos no se escriben manualmente: se derivan del rol publicado por el backend.</p>
        <div className="mt-4 grid gap-3">
          <label htmlFor="managed-user-email" className="grid gap-1.5 text-xs font-bold text-slate-300">
            Correo electrónico
            <input id="managed-user-email" name="email" type="email" autoComplete="username" suppressHydrationWarning className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label htmlFor="managed-user-full-name" className="grid gap-1.5 text-xs font-bold text-slate-300">
            Nombre completo
            <input id="managed-user-full-name" name="fullName" autoComplete="name" suppressHydrationWarning className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </label>
          <div className="grid gap-1.5">
            <label htmlFor="managed-user-initial-password" className="grid gap-1.5 text-xs font-bold text-slate-300">
              Contraseña inicial
              <input id="managed-user-initial-password" name="password" type="password" autoComplete="new-password" aria-describedby="managed-user-password-help" suppressHydrationWarning className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
            </label>
            <p id="managed-user-password-help" className="text-xs leading-relaxed text-slate-400">No vence ni exige cambio automático al ingresar. Crear la cuenta no verifica el correo.</p>
          </div>
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
              className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={selectedFormRole?.tenantBound ? "tenant slug" : "Rol global"}
              value={form.tenantSlug}
              disabled={!selectedFormRole?.tenantBound}
              onChange={(event) => setForm((current) => ({ ...current, tenantSlug: event.target.value }))}
            />
          </label>
          <EnterpriseRolePresetSummary role={selectedFormRole} />
          <Button disabled={catalog.status !== "ready" || !selectedFormRole} className="w-full" onClick={createUser}>Guardar usuario</Button>
          {status ? <p className="text-xs text-cyan-200" aria-live="polite">{status}</p> : null}
        </div>
      </Card>
    </div>
  );
}
