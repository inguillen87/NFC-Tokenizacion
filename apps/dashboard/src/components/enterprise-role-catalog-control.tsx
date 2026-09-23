"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  enterpriseRoleCatalogFailureMessage,
  normalizeEnterpriseRoleCode,
  parseEnterpriseRoleCatalog,
  type EnterpriseRoleCatalogEntry,
} from "../lib/enterprise-role-catalog";

type CatalogState = {
  status: "loading" | "ready" | "failed";
  roles: EnterpriseRoleCatalogEntry[];
  error: string;
};

export function useEnterpriseRoleCatalog() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<CatalogState>({ status: "loading", roles: [], error: "" });

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setState({ status: "loading", roles: [], error: "" });
    void (async () => {
      try {
        const response = await fetch("/api/iam/rbac/roles", {
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok) {
          throw new Error(enterpriseRoleCatalogFailureMessage(response.status, payload?.reason));
        }
        const roles = parseEnterpriseRoleCatalog(payload);
        if (!roles) throw new Error(enterpriseRoleCatalogFailureMessage(502, "invalid_catalog"));
        if (current) setState({ status: "ready", roles, error: "" });
      } catch (error) {
        if (!current || controller.signal.aborted) return;
        setState({
          status: "failed",
          roles: [],
          error: error instanceof Error ? error.message : enterpriseRoleCatalogFailureMessage(503),
        });
      }
    })();
    return () => {
      current = false;
      controller.abort();
    };
  }, [revision]);

  const byCode = useMemo(
    () => new Map(state.roles.map((role) => [role.code, role])),
    [state.roles],
  );
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, byCode, reload };
}

export function EnterpriseRoleSelect({
  roles,
  value,
  disabled,
  onChange,
  label = "Rol enterprise",
}: {
  roles: EnterpriseRoleCatalogEntry[];
  value: string;
  disabled?: boolean;
  onChange: (role: string) => void;
  label?: string;
}) {
  const normalized = normalizeEnterpriseRoleCode(value);
  const known = roles.some((role) => role.code === normalized);
  return (
    <label className="grid gap-1.5 text-xs font-bold text-slate-300">
      {label}
      <select
        suppressHydrationWarning
        className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        value={known ? normalized : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>Seleccionar un preset autorizado</option>
        {roles.map((role) => <option key={role.code} value={role.code}>{role.displayName}</option>)}
      </select>
    </label>
  );
}

export function EnterpriseRolePresetSummary({ role }: { role?: EnterpriseRoleCatalogEntry }) {
  if (!role) {
    return <p className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">Seleccioná un rol del catálogo autorizado. No se aceptan permisos escritos manualmente.</p>;
  }
  return (
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/5 p-3 text-xs" data-testid="enterprise-role-preset">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-cyan-50">{role.displayName}</b>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">{role.code === "supplier_operator" ? "Interno · sólo asignadas" : role.tenantBound ? "tenant-bound" : "global"}</span>
      </div>
      <p className="mt-2 leading-5 text-slate-300">{role.description}</p>
      <p className="mt-3 font-black uppercase tracking-[0.12em] text-slate-500">Preset autoritativo</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {role.defaultPermissions.length
          ? role.defaultPermissions.map((permission) => <code key={permission} className="rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-[10px] text-cyan-100">{permission}</code>)
          : <span className="text-slate-400">Sin capacidades por defecto.</span>}
      </div>
      <p className="mt-3 leading-5 text-slate-500">El servidor vuelve a verificar el rol, el preset y los límites de delegación al guardar.</p>
    </div>
  );
}

export function EnterpriseRoleCatalogGate({
  status,
  error,
  onRetry,
}: {
  status: CatalogState["status"];
  error: string;
  onRetry: () => void;
}) {
  if (status === "ready") return null;
  return (
    <div className={`rounded-xl border px-3 py-3 text-xs leading-5 ${status === "failed" ? "border-rose-300/25 bg-rose-500/10 text-rose-100" : "border-cyan-300/20 bg-cyan-500/10 text-cyan-100"}`} role={status === "failed" ? "alert" : "status"}>
      <p>{status === "failed" ? error : "Validando catálogo RBAC y límites de delegación…"}</p>
      {status === "failed" ? <button type="button" className="mt-2 rounded-lg border border-rose-200/30 px-2.5 py-1 font-black" onClick={onRetry}>Reintentar catálogo</button> : null}
    </div>
  );
}
