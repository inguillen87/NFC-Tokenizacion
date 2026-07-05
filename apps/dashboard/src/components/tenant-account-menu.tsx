"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useClerk } from "@clerk/nextjs";
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
  Users,
  X,
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
  permissions?: string[];
  role: string;
  setupCompleted?: boolean | null;
  tenantSlug?: string | null;
  clerkEnabled?: boolean;
};

const ACCOUNT_MENU_Z_INDEX = 2147483630;
const ACCOUNT_MENU_PORTAL_ROOT_ID = "nexid-account-menu-root";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const ACCOUNT_MENU_CRITICAL_CSS = `
html.nexid-account-menu-open,
body.nexid-account-menu-open {
  overflow: hidden !important;
}
.nexid-account-layer {
  position: fixed !important;
  inset: 0 !important;
  display: block !important;
  width: 100vw !important;
  height: 100dvh !important;
  max-width: none !important;
  max-height: none !important;
  overflow: visible !important;
  isolation: isolate !important;
  contain: none !important;
  pointer-events: auto !important;
  z-index: 2147483630 !important;
  transform: translate3d(0, 0, 0) !important;
  overscroll-behavior: contain !important;
}
.nexid-account-layer [data-account-menu-backdrop="true"] {
  position: fixed !important;
  inset: 0 !important;
  pointer-events: auto !important;
  z-index: 2147483631 !important;
}
.nexid-account-layer .tenant-account-panel {
  position: fixed !important;
  inset-block: 0 !important;
  right: 0 !important;
  left: auto !important;
  width: min(100vw, 32rem) !important;
  height: 100dvh !important;
  max-height: 100dvh !important;
  display: flex !important;
  flex-direction: column !important;
  pointer-events: auto !important;
  isolation: isolate !important;
  z-index: 2147483632 !important;
}
body.nexid-account-menu-open .nexid-crm-shell,
html.nexid-account-menu-open .nexid-crm-shell {
  pointer-events: none !important;
  z-index: 0 !important;
  filter: saturate(0.78) brightness(0.48) blur(0.5px) !important;
  transform: none !important;
  contain: none !important;
  user-select: none !important;
}
body.nexid-account-menu-open .nexid-crm-shell *,
html.nexid-account-menu-open .nexid-crm-shell * {
  pointer-events: none !important;
}
body.nexid-account-menu-open .nexid-account-layer,
body.nexid-account-menu-open .nexid-account-layer *,
html.nexid-account-menu-open .nexid-account-layer,
html.nexid-account-menu-open .nexid-account-layer * {
  pointer-events: auto !important;
}
@media (max-width: 640px) {
  .nexid-account-layer .tenant-account-panel {
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
  }
}
`;
const ACCOUNT_LAYER_STYLE: CSSProperties = {
  position: "fixed",
  zIndex: ACCOUNT_MENU_Z_INDEX,
  inset: 0,
  width: "100vw",
  height: "100dvh",
  maxWidth: "none",
  maxHeight: "none",
  margin: 0,
  padding: 0,
  border: 0,
  overflow: "visible",
  pointerEvents: "auto",
  isolation: "isolate",
  background: "transparent",
  color: "inherit",
  transform: "translate3d(0,0,0)",
  overscrollBehavior: "contain",
};
const ACCOUNT_MENU_DEFAULT_STYLE: CSSProperties = {
  position: "fixed",
  zIndex: ACCOUNT_MENU_Z_INDEX + 2,
  top: 0,
  right: 0,
  bottom: 0,
  left: "auto",
  width: "min(100vw, 32rem)",
  height: "100dvh",
  maxHeight: "100dvh",
  pointerEvents: "auto",
  isolation: "isolate",
  transform: "translate3d(0,0,0)",
  backgroundColor: "#020817",
  boxShadow: "-36px 0 120px rgba(0,0,0,0.74)",
};

function getAccountMenuPortalRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(ACCOUNT_MENU_PORTAL_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ACCOUNT_MENU_PORTAL_ROOT_ID;
    root.setAttribute("data-account-menu-root", "true");
  }
  if (root.parentElement !== document.body || root !== document.body.lastElementChild) {
    document.body.appendChild(root);
  }
  root.style.setProperty("position", "fixed", "important");
  root.style.setProperty("inset", "0", "important");
  root.style.setProperty("z-index", String(ACCOUNT_MENU_Z_INDEX), "important");
  root.style.setProperty("pointer-events", "none", "important");
  root.style.setProperty("isolation", "isolate", "important");
  root.style.setProperty("contain", "none", "important");
  return root;
}

function setCrmShellSuppression(value: boolean) {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>(".nexid-crm-shell").forEach((node) => {
    if (value) {
      node.setAttribute("data-account-menu-suppressed", "true");
      node.setAttribute("aria-hidden", "true");
      node.style.setProperty("pointer-events", "none", "important");
      node.style.setProperty("z-index", "0", "important");
      node.style.setProperty("filter", "saturate(0.78) brightness(0.48) blur(0.5px)", "important");
      node.style.setProperty("transform", "none", "important");
      node.style.setProperty("contain", "none", "important");
      try {
        (node as HTMLElement & { inert?: boolean }).inert = true;
      } catch {
        // Older browser surfaces may not expose inert; CSS still suppresses the CRM shell.
      }
      return;
    }

    if (node.getAttribute("data-account-menu-suppressed") !== "true") return;
    node.removeAttribute("data-account-menu-suppressed");
    node.removeAttribute("aria-hidden");
    node.style.removeProperty("pointer-events");
    node.style.removeProperty("z-index");
    node.style.removeProperty("filter");
    node.style.removeProperty("transform");
    node.style.removeProperty("contain");
    try {
      (node as HTMLElement & { inert?: boolean }).inert = false;
    } catch {
      // No-op fallback for browser surfaces without inert.
    }
  });
}

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

function LocalSecureLogoutButton() {
  return (
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
  );
}

function ClerkSecureLogoutButton({ onStart }: { onStart?: () => void }) {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    onStart?.();

    await fetch("/logout", { method: "POST", cache: "no-store" }).catch(() => null);

    try {
      await signOut({ redirectUrl: "/login?logged_out=1" });
    } catch {
      window.location.href = "/login?logged_out=1";
    }
  }

  return (
    <button
      type="button"
      data-testid="tenant-account-logout"
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-500/18 disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      onClick={() => void handleLogout()}
    >
      <LogOut className="h-4 w-4" />
      {pending ? "Cerrando sesion..." : "Cerrar sesion segura"}
    </button>
  );
}

function SecureLogoutButton({ clerkEnabled, onStart }: { clerkEnabled?: boolean; onStart?: () => void }) {
  if (clerkEnabled) return <ClerkSecureLogoutButton onStart={onStart} />;
  return <LocalSecureLogoutButton />;
}

export function TenantAccountMenu({
  className = "",
  clerkEnabled,
  email,
  label,
  mfaVerified,
  mode,
  permissions = [],
  role,
  setupCompleted,
  tenantSlug,
}: TenantAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>(ACCOUNT_MENU_DEFAULT_STYLE);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const tenantName = tenantNameFromSlug(tenantSlug);
  const scopedTenant = String(tenantSlug || "").trim().toLowerCase();
  const tenantQuery = scopedTenant ? `?tenant=${encodeURIComponent(scopedTenant)}` : "";
  const tenantHref = scopedTenant ? `/tenants/${encodeURIComponent(scopedTenant)}` : "/tenants";
  const accountLabel = label || tenantName;
  const isTenantMode = mode === "tenant";
  const accountRoleDescription = roleDescription(role, mode);
  const canManageUsers = role === "super-admin" || permissions.includes("*") || permissions.includes("users:manage") || permissions.includes("employees:*");
  const hasWildcardAccess = permissions.includes("*");
  const normalizedPermissions = hasWildcardAccess
    ? [role === "super-admin" || mode === "global" ? "Acceso global" : "Tenant completo"]
    : permissions.length ? permissions.slice(0, 3) : ["Scope operativo"];
  const nextAction = setupCompleted === false && role === "tenant-admin"
    ? { href: "/onboarding", label: "Completar setup del tenant", meta: "Datos, equipo e integraciones base" }
    : !mfaVerified
      ? { href: "/mfa", label: "Revisar MFA y seguridad", meta: "Segundo factor antes de escalar permisos" }
      : isTenantMode
        ? { href: tenantHref, label: "Abrir perfil del tenant", meta: "Plan, vertical, health y playbook del workspace" }
        : { href: "/settings", label: "Abrir configuracion global", meta: "Seguridad, tenants, integraciones y soporte" };

  const setDocumentMenuState = useCallback((value: boolean) => {
    const root = getAccountMenuPortalRoot();
    if (root) {
      root.toggleAttribute("data-account-menu-active", value);
      root.style.setProperty("pointer-events", value ? "auto" : "none", "important");
      setPortalRoot(root);
    }
    document.documentElement.classList.toggle("nexid-account-menu-open", value);
    document.body.classList.toggle("nexid-account-menu-open", value);
    document.body.toggleAttribute("data-account-menu-open", value);
    setCrmShellSuppression(value);
  }, []);

  const closeMenu = useCallback(() => {
    setDocumentMenuState(false);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [setDocumentMenuState]);

  useIsomorphicLayoutEffect(() => {
    setPortalRoot(getAccountMenuPortalRoot());
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    setDocumentMenuState(true);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      setDocumentMenuState(false);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open, setDocumentMenuState]);

  const updatePanelPosition = useCallback(() => {
    if (typeof window === "undefined") {
      setPanelStyle(ACCOUNT_MENU_DEFAULT_STYLE);
      return;
    }
    const isCompact = window.innerWidth < 640;
    setPanelStyle({
      ...ACCOUNT_MENU_DEFAULT_STYLE,
      top: 0,
      right: 0,
      bottom: 0,
      left: isCompact ? 0 : "auto",
      width: isCompact ? "100vw" : "min(100vw, 32rem)",
      height: "100dvh",
      maxHeight: "100dvh",
    });
  }, []);

  const toggleMenu = useCallback(() => {
    if (!open) {
      setDocumentMenuState(true);
      updatePanelPosition();
    }
    setOpen((value) => !value);
  }, [open, setDocumentMenuState, updatePanelPosition]);

  useIsomorphicLayoutEffect(() => {
    if (open) updatePanelPosition();
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
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
      label: "Configuración del workspace",
      meta: "Tenant, seguridad, datos, integraciones y soporte",
    },
    {
      href: tenantHref,
      icon: <Building2 className="h-4 w-4" />,
      label: isTenantMode ? `Perfil ${tenantName}` : "Directorio de tenants",
      meta: isTenantMode ? "Plan, vertical, health y playbook del tenant" : "Cuentas, planes, regiones y health global",
    },
    {
      href: canManageUsers ? "/users" : "/settings",
      icon: <Users className="h-4 w-4" />,
      label: canManageUsers ? "Usuarios y permisos" : "Permisos del workspace",
      meta: canManageUsers ? "Roles, alcance por recurso, reset y MFA" : "Solicitudes, políticas y alcance autorizado",
    },
    {
      href: "/mfa",
      icon: <ShieldCheck className="h-4 w-4" />,
      label: "Seguridad y MFA",
      meta: "Segundo factor y controles de acceso",
    },
  ], [canManageUsers, isTenantMode, tenantHref, tenantName]);

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
      label: "Plan y facturación",
      meta: "Plan, renovación, uso y upgrade path",
    },
    {
      href: "/sales-playbook",
      icon: <BookOpen className="h-4 w-4" />,
      label: "Playbook comercial",
      meta: "Cómo explicar valor, riesgo y ROI",
    },
    {
      href: "mailto:soporte@nexid.lat?subject=nexID%20enterprise%20support",
      icon: <LifeBuoy className="h-4 w-4" />,
      label: "Soporte enterprise",
      meta: "Cuenta, integración, incidentes o preventa",
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
    item.href === "/logout" ? null : item.external ? (
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
      ref={layerRef}
      role="dialog"
      aria-modal="true"
      className="nexid-account-layer fixed inset-0 isolate"
      data-account-menu-portal="body"
      data-account-menu-version="drawer-v3"
      data-testid="tenant-account-menu-layer"
      aria-label="Cuenta operativa nexID"
      style={ACCOUNT_LAYER_STYLE}
    >
      <style
        data-account-menu-critical-style="true"
        data-testid="tenant-account-menu-critical-style"
        dangerouslySetInnerHTML={{ __html: ACCOUNT_MENU_CRITICAL_CSS }}
      />
      <button
        type="button"
        aria-label="Cerrar menu de cuenta"
        data-account-menu-backdrop="true"
        data-testid="tenant-account-menu-backdrop"
        className="tenant-account-backdrop fixed inset-0 cursor-default backdrop-blur-xl"
        style={{ zIndex: ACCOUNT_MENU_Z_INDEX + 1, pointerEvents: "auto", backgroundColor: "rgba(2, 6, 23, 0.86)" }}
        onClick={closeMenu}
      />
      <div
        id="tenant-account-menu-panel"
        ref={panelRef}
        data-account-menu-panel="drawer"
        data-testid="tenant-account-menu-panel"
        style={panelStyle}
        className="tenant-account-panel isolate flex flex-col overflow-hidden rounded-none border-l border-cyan-100/35 bg-slate-950 text-slate-100 shadow-[0_34px_140px_rgba(0,0,0,.88)] ring-1 ring-cyan-200/18"
      >
        <div className="tenant-account-panel__header border-b border-white/10 bg-[radial-gradient(circle_at_85%_12%,rgba(34,211,238,.2),transparent_40%),linear-gradient(135deg,#0f172a,#07111f)] p-4">
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
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Cerrar panel de cuenta"
              data-testid="tenant-account-menu-close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-950/45 text-slate-300 transition hover:border-cyan-200/55 hover:bg-cyan-400/10 hover:text-white"
              onClick={closeMenu}
            >
              <X className="h-4 w-4" />
            </button>
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
          <div
            data-testid="tenant-account-session-summary"
            className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300 sm:grid-cols-2"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Permisos</p>
              <p className="mt-1 truncate font-semibold text-white">{normalizedPermissions.join(" / ")}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Sesion</p>
              <p className="mt-1 font-semibold text-white">{clerkEnabled ? "Clerk + nexID" : "nexID local"}</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="tenant-account-primary-action"
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-3 text-left text-sm font-black text-cyan-50 transition hover:border-cyan-200/70 hover:bg-cyan-400/20"
            onClick={() => {
              window.location.href = nextAction.href;
            }}
          >
            <span className="min-w-0">
              <span className="block">{nextAction.label}</span>
              <span className="mt-0.5 block text-xs font-semibold normal-case text-cyan-100/75">{nextAction.meta}</span>
            </span>
            <span aria-hidden="true">-&gt;</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid gap-2">
            {primaryItems.map(renderItem)}
          </div>
          <div className="my-3 h-px bg-white/8" />
          <div className="grid gap-2">
            {operationsItems.map(renderItem)}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#020817] p-3">
          {clerkEnabled ? (
            <SecureLogoutButton clerkEnabled={clerkEnabled} onStart={() => setDocumentMenuState(false)} />
          ) : (
            <SecureLogoutButton clerkEnabled={false} />
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div ref={menuRef} className={`relative z-[720] ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="tenant-account-menu-panel"
        data-testid="tenant-account-menu-trigger"
        data-account-menu-open={open ? "true" : "false"}
        title="Abrir cuenta, configuración y logout del workspace"
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/12 bg-slate-950/65 px-3 py-2 text-left shadow-[0_16px_38px_rgba(2,6,23,.22)] transition hover:border-cyan-300/40 hover:bg-cyan-400/10 lg:min-w-[190px]"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          closeMenu();
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

      {typeof document !== "undefined" && menuPanel ? createPortal(menuPanel, portalRoot || document.body) : null}
    </div>
  );
}
