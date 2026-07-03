"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

const ACCOUNT_MENU_Z_INDEX = 2147483000;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const ACCOUNT_MENU_DEFAULT_STYLE: CSSProperties = {
  position: "absolute",
  zIndex: 2,
  top: 86,
  right: 12,
  width: "min(calc(100vw - 24px), 26rem)",
  maxHeight: "calc(100vh - 104px)",
  transform: "translateZ(0)",
  backgroundColor: "#020817",
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

function roleDescription(role: string, mode: "tenant" | "global") {
  if (role === "super-admin") return "Control global: tenants, seguridad, red comercial y plataforma.";
  if (role === "tenant-admin") return mode === "tenant"
    ? "Administra lotes, tags, taps, CRM, marketplace y usuarios del tenant."
    : "Administra un tenant operativo desde el workspace global.";
  if (role === "reseller") return "Opera cuentas, pipeline comercial y soporte de partners.";
  return "Acceso operativo limitado por permisos del workspace.";
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
  const [panelStyle, setPanelStyle] = useState<CSSProperties>(ACCOUNT_MENU_DEFAULT_STYLE);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tenantName = tenantNameFromSlug(tenantSlug);
  const scopedTenant = String(tenantSlug || "").trim().toLowerCase();
  const tenantQuery = scopedTenant ? `?tenant=${encodeURIComponent(scopedTenant)}` : "";
  const tenantHref = scopedTenant ? `/tenants/${encodeURIComponent(scopedTenant)}` : "/tenants";
  const accountLabel = label || tenantName;
  const isTenantMode = mode === "tenant";
  const accountRoleDescription = roleDescription(role, mode);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("nexid-account-menu-open");
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("nexid-account-menu-open");
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const updatePanelPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || typeof window === "undefined") {
      setPanelStyle(ACCOUNT_MENU_DEFAULT_STYLE);
      return;
    }
    const gutter = 12;
    const top = Math.min(Math.max(rect.bottom + 10, gutter), window.innerHeight - 96);
    const right = Math.max(gutter, window.innerWidth - rect.right);
    setPanelStyle({
      ...ACCOUNT_MENU_DEFAULT_STYLE,
      top,
      right,
      maxHeight: Math.max(280, window.innerHeight - top - gutter),
    });
  }, []);

  const toggleMenu = useCallback(() => {
    if (!open) updatePanelPosition();
    setOpen((value) => !value);
  }, [open, updatePanelPosition]);

  useIsomorphicLayoutEffect(() => {
    if (open) updatePanelPosition();
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

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
      meta: "Cuenta, integración, incidentes o preventa",
      external: true,
    },
    {
      href: "/login",
      icon: <UserCog className="h-4 w-4" />,
      label: "Cambiar cuenta o perfil",
      meta: "Volver al login enterprise sin tocar el portal consumidor",
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

  const menuPanel = open ? (
    <div
      className="nexid-account-layer fixed inset-0 isolate"
      data-testid="tenant-account-menu-layer"
      style={{ zIndex: ACCOUNT_MENU_Z_INDEX }}
    >
      <button
        type="button"
        aria-label="Cerrar menu de cuenta"
        data-testid="tenant-account-menu-backdrop"
        className="absolute inset-0 z-[1] cursor-default bg-[#020713]/50 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />
      <div
        id="tenant-account-menu-panel"
        ref={panelRef}
        role="menu"
        data-testid="tenant-account-menu-panel"
        style={panelStyle}
        className="tenant-account-panel isolate overflow-hidden rounded-2xl border border-cyan-100/35 bg-slate-950 text-slate-100 shadow-[0_34px_140px_rgba(0,0,0,.88)] ring-1 ring-cyan-200/18"
      >
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_85%_12%,rgba(34,211,238,.2),transparent_40%),linear-gradient(135deg,#0f172a,#07111f)] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-sm font-black text-cyan-100">
              {initialsFor(role)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Cuenta operativa</p>
              <h2 className="mt-1 truncate text-base font-black text-white">{accountLabel}</h2>
              <p className="truncate text-xs text-slate-400">{email || "Cuenta enterprise"}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{accountRoleDescription}</p>
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
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-3 text-left text-sm font-black text-cyan-50 transition hover:border-cyan-200/70 hover:bg-cyan-400/20"
            onClick={() => {
              window.location.href = isTenantMode ? tenantHref : "/settings";
            }}
          >
            <span>{isTenantMode ? "Abrir perfil del tenant" : "Abrir configuración global"}</span>
            <span aria-hidden="true">-&gt;</span>
          </button>
        </div>

        <div className="max-h-[calc(100vh-18rem)] overflow-y-auto p-3">
          <div className="grid gap-2">
            {primaryItems.map(renderItem)}
          </div>
          <div className="my-3 h-px bg-white/8" />
          <div className="grid gap-2">
            {operationsItems.map(renderItem)}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#020817] p-3">
          <form method="post" action="/logout">
            <button
              type="submit"
              data-testid="tenant-account-logout"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-500/18"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión segura
            </button>
          </form>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div ref={menuRef} className={`relative z-[720] ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="tenant-account-menu-panel"
        data-testid="tenant-account-menu-trigger"
        data-account-menu-open={open ? "true" : "false"}
        title="Abrir cuenta, configuración y logout del workspace"
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/12 bg-slate-950/65 px-3 py-2 text-left shadow-[0_16px_38px_rgba(2,6,23,.22)] transition hover:border-cyan-300/40 hover:bg-cyan-400/10 lg:min-w-[190px]"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          setOpen(false);
        }}
        onClick={(event) => {
          event.preventDefault();
          toggleMenu();
        }}
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

      {typeof document !== "undefined" && menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
