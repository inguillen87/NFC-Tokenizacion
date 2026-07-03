"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Building2,
  ChevronDown,
  CreditCard,
  KeyRound,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

type AccountMenuItem = {
  href: string;
  icon: ReactNode;
  label: string;
  meta: string;
  external?: boolean;
};

type TenantAccountMenuProps = {
  className?: string;
  email?: string | null;
  label?: string | null;
  mfaVerified?: boolean | null;
  mode: "tenant" | "global";
  role: string;
  setupCompleted?: boolean | null;
  tenantSlug?: string | null;
};

function tenantNameFromSlug(slug?: string | null) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (normalized === "demobodega" || normalized === "bodegabalmec" || normalized === "bodega-balmec") return "Bodega Balmec";
  if (!normalized) return "Global workspace";
  return normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleLabel(role: string) {
  if (role === "super-admin") return "Super Admin";
  if (role === "tenant-admin") return "Admin tenant";
  if (role === "viewer") return "Viewer";
  if (role === "reseller") return "Reseller";
  return role.replace(/[-_]+/g, " ");
}

function initialsFor(role: string) {
  if (role === "super-admin") return "SA";
  if (role === "tenant-admin") return "TA";
  if (role === "reseller") return "RS";
  return "NX";
}

export function TenantAccountMenu({
  className = "",
  email,
  label,
  mfaVerified,
  mode,
  role,
  setupCompleted,
  tenantSlug,
}: TenantAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const tenantName = tenantNameFromSlug(tenantSlug);
  const scopedTenant = String(tenantSlug || "").trim().toLowerCase();
  const tenantQuery = scopedTenant ? `?tenant=${encodeURIComponent(scopedTenant)}` : "";
  const tenantHref = scopedTenant ? `/tenants/${encodeURIComponent(scopedTenant)}` : "/tenants";
  const accountLabel = label || tenantName;
  const isTenantMode = mode === "tenant";

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const primaryItems = useMemo<AccountMenuItem[]>(() => [
    {
      href: "/settings",
      icon: <Settings className="h-4 w-4" />,
      label: "Configuracion del workspace",
      meta: "Tenant, seguridad, datos, integraciones y soporte",
    },
    {
      href: tenantHref,
      icon: <Building2 className="h-4 w-4" />,
      label: isTenantMode ? "Perfil Bodega Balmec" : "Directorio de tenants",
      meta: isTenantMode ? "Plan, vertical, health y playbook del tenant" : "Cuentas, planes, regiones y health global",
    },
    {
      href: "/users",
      icon: <Users className="h-4 w-4" />,
      label: "Usuarios y permisos",
      meta: "Roles, alcance por recurso, reset y MFA",
    },
    {
      href: "/mfa",
      icon: <ShieldCheck className="h-4 w-4" />,
      label: "Seguridad y MFA",
      meta: "Segundo factor y controles de acceso",
    },
  ], [isTenantMode, tenantHref]);

  const operationsItems = useMemo<AccountMenuItem[]>(() => [
    {
      href: `/api-keys${tenantQuery}`,
      icon: <KeyRound className="h-4 w-4" />,
      label: "API keys y webhooks",
      meta: "ERP, CRM, proof anchors y eventos",
    },
    {
      href: `/subscriptions${tenantQuery}`,
      icon: <CreditCard className="h-4 w-4" />,
      label: "Plan y facturacion",
      meta: "Plan, renovacion, uso y upgrade path",
    },
    {
      href: "/sales-playbook",
      icon: <BookOpen className="h-4 w-4" />,
      label: "Playbook comercial",
      meta: "Como explicar valor, riesgo y ROI",
    },
    {
      href: "mailto:soporte@nexid.lat?subject=nexID%20enterprise%20support",
      icon: <LifeBuoy className="h-4 w-4" />,
      label: "Soporte enterprise",
      meta: "Cuenta, integracion, incidentes o preventa",
      external: true,
    },
  ], [tenantQuery]);

  const itemContent = (item: AccountMenuItem) => (
    <>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 group-hover:border-cyan-200/55">
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-5 text-white">{item.label}</span>
        <span className="mt-0.5 block text-xs leading-4 text-slate-400">{item.meta}</span>
      </span>
    </>
  );

  const renderItem = (item: AccountMenuItem) => (
    item.external ? (
      <a
        key={item.label}
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="group flex min-h-14 items-start gap-3 rounded-xl border border-white/8 bg-slate-950/50 px-3 py-2.5 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/10"
      >
        {itemContent(item)}
      </a>
    ) : (
      <button
        key={item.label}
        type="button"
        data-nav-href={item.href}
        className="group flex min-h-14 w-full items-start gap-3 rounded-xl border border-white/8 bg-slate-950/50 px-3 py-2.5 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/10"
        onClick={() => {
          window.location.href = item.href;
        }}
      >
        {itemContent(item)}
      </button>
    )
  );

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="tenant-account-menu-trigger"
        title="Abrir cuenta, configuracion y logout del workspace"
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/12 bg-slate-950/65 px-3 py-2 text-left shadow-[0_16px_38px_rgba(2,6,23,.22)] transition hover:border-cyan-300/40 hover:bg-cyan-400/10 lg:min-w-[190px]"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-black text-white shadow-[0_0_22px_rgba(37,99,235,.35)]">
          {initialsFor(role)}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-sm leading-4 text-white">{roleLabel(role)}</b>
          <span className="mt-0.5 block truncate text-xs leading-4 text-slate-300">{tenantName}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180 text-cyan-200" : ""}`} />
      </button>

      {open ? (
        <div
          role="menu"
          data-testid="tenant-account-menu-panel"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-[160] w-[min(92vw,26rem)] overflow-hidden rounded-2xl border border-cyan-200/18 bg-[#07111f]/98 text-slate-100 shadow-[0_28px_90px_rgba(0,0,0,.55)] backdrop-blur-xl"
        >
          <div className="border-b border-white/8 bg-[radial-gradient(circle_at_85%_12%,rgba(34,211,238,.18),transparent_38%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(8,16,31,.98))] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-sm font-black text-cyan-100">
                {initialsFor(role)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Cuenta operativa</p>
                <h2 className="mt-1 truncate text-base font-black text-white">{accountLabel}</h2>
                <p className="truncate text-xs text-slate-400">{email || "Cuenta enterprise"}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-[0.08em]">
              <span className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-2 py-2 text-emerald-100">
                {setupCompleted === false ? "setup pendiente" : "setup ok"}
              </span>
              <span className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-2 py-2 text-cyan-100">
                {mfaVerified ? "mfa ok" : "mfa revisar"}
              </span>
              <span className="rounded-lg border border-violet-300/25 bg-violet-400/10 px-2 py-2 text-violet-100">
                {isTenantMode ? "tenant" : "global"}
              </span>
            </div>
          </div>

          <div className="max-h-[min(70vh,36rem)] overflow-y-auto p-3">
            <div className="grid gap-2">
              {primaryItems.map(renderItem)}
            </div>
            <div className="my-3 h-px bg-white/8" />
            <div className="grid gap-2">
              {operationsItems.map(renderItem)}
            </div>
          </div>

          <div className="border-t border-white/8 bg-slate-950/80 p-3">
            <form method="post" action="/logout">
              <button
                type="submit"
                data-testid="tenant-account-logout"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-500/18"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesion segura
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
