"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@product/ui";

const ROLES = ["super-admin", "tenant-admin", "reseller", "viewer"] as const;
const DEFAULT_PERMISSIONS = ["users:manage", "batches:write", "events:read", "analytics:read", "tenants:write"];

type UserRow = {
  id: string;
  email: string;
  label: string;
  role: string;
  tenant_slug?: string | null;
  mfa_enabled: boolean;
  permissions: string[];
};

type UserEditorState = Record<string, { role: string; tenantSlug: string; permissions: string }>;

export function UserManagementPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ email: "", fullName: "", password: "", role: "viewer", tenantSlug: "", permissions: "users:manage" });
  const [editors, setEditors] = useState<UserEditorState>({});

  async function load() {
    const res = await fetch(`/api/iam/users`, { cache: "no-store" });
    const data = await res.json();
    const nextUsers = data.users || [];
    setUsers(nextUsers);
    setEditors(Object.fromEntries(nextUsers.map((user: UserRow) => [user.id, { role: String(user.role).replaceAll('_', '-'), tenantSlug: user.tenant_slug || '', permissions: (user.permissions || []).join(', ') }])));
  }

  useEffect(() => { void load(); }, []);

  async function createUser() {
    const res = await fetch(`/api/iam/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, permissions: form.permissions.split(',').map((item) => item.trim()).filter(Boolean) }),
    });
    const data = await res.json().catch(() => null);
    setStatus(res.ok ? "Usuario guardado." : (data?.reason || "No se pudo guardar el usuario."));
    if (res.ok) {
      setForm({ email: "", fullName: "", password: "", role: "viewer", tenantSlug: "", permissions: "users:manage" });
      void load();
    }
  }

  async function saveUser(userId: string) {
    const editor = editors[userId];
    const res = await fetch(`/api/iam/users/${userId}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editor.role, tenantSlug: editor.tenantSlug || null, permissions: editor.permissions.split(',').map((item) => item.trim()).filter(Boolean) }),
    });
    const data = await res.json().catch(() => null);
    setStatus(res.ok ? "Usuario actualizado." : (data?.reason || "No se pudo actualizar el usuario."));
    if (res.ok) void load();
  }

  async function issueReset(userId: string) {
    const res = await fetch(`/api/iam/users/${userId}/reset-password`, { method: "POST" });
    const data = await res.json();
    setStatus(data?.resetToken ? `Reset token: ${data.resetToken}` : "Reset emitido. En producción no se expone el token por respuesta." );
  }

  async function resetMfa(userId: string) {
    const res = await fetch(`/api/iam/users/${userId}/mfa-reset`, { method: "POST" });
    setStatus(res.ok ? "MFA reseteado y sesiones revocadas." : "No se pudo resetear MFA.");
    if (res.ok) void load();
  }

  const permissionHint = useMemo(() => DEFAULT_PERMISSIONS.join(", "), []);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Usuarios y permisos</h2>
        <p className="mt-2 text-sm text-slate-400">Ahora podés editar rol, tenant y permisos por recurso desde la UI, además de emitir reset tokens y resetear MFA.</p>
        <div className="mt-4 space-y-3">
          {users.map((user) => {
            const editor = editors[user.id] || { role: "viewer", tenantSlug: "", permissions: "" };
            return (
              <div key={user.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{user.label}</p>
                    <p className="text-xs text-cyan-200">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-400">tenant {user.tenant_slug || 'global'} · MFA {user.mfa_enabled ? 'enabled' : 'off'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="px-3 py-2 text-xs" onClick={() => issueReset(user.id)}>Emit reset</Button>
                    <Button className="px-3 py-2 text-xs" onClick={() => resetMfa(user.id)}>Reset MFA</Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={editor.role} onChange={(e) => setEditors((prev) => ({ ...prev, [user.id]: { ...editor, role: e.target.value } }))}>
                    {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant slug" value={editor.tenantSlug} onChange={(e) => setEditors((prev) => ({ ...prev, [user.id]: { ...editor, tenantSlug: e.target.value } }))} />
                  <Button className="px-3 py-2 text-sm" onClick={() => saveUser(user.id)}>Guardar cambios</Button>
                </div>
                <textarea className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={editor.permissions} onChange={(e) => setEditors((prev) => ({ ...prev, [user.id]: { ...editor, permissions: e.target.value } }))} />
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Alta / actualización</h2>
        <div className="mt-4 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Work email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
          <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Temp password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
          <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>
            {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="tenant slug (optional)" value={form.tenantSlug} onChange={(e) => setForm((s) => ({ ...s, tenantSlug: e.target.value }))} />
          <textarea className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={permissionHint} value={form.permissions} onChange={(e) => setForm((s) => ({ ...s, permissions: e.target.value }))} />
          <Button className="w-full" onClick={createUser}>Guardar usuario</Button>
          {status ? <p className="text-xs text-cyan-200">{status}</p> : null}
        </div>
      </Card>
    </div>
  );
}
