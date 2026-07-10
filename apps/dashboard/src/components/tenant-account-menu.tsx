"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  BookOpen,
  Building2,
  ChevronDown,
  CreditCard,
  ArrowRight,
  FileSearch,
  FlaskConical,
  KeyRound,
  LifeBuoy,
  Network,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { SecureDashboardLogoutButton } from "./secure-dashboard-logout-button";

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
  surface?: "dashboard" | "crm";
  tenantSlug?: string | null;
  clerkEnabled?: boolean;
};

const ACCOUNT_MENU_Z_INDEX = 2147483647;
const ACCOUNT_MENU_BACKDROP_Z_INDEX = ACCOUNT_MENU_Z_INDEX - 1;
const ACCOUNT_MENU_PANEL_Z_INDEX = ACCOUNT_MENU_Z_INDEX;
const ACCOUNT_MENU_PORTAL_ROOT_ID = "nexid-account-menu-root";
const ACCOUNT_MENU_VERSION = "drawer-v19-modal-top-layer";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const ACCOUNT_MENU_CRITICAL_CSS = `
html.nexid-account-menu-open,
body.nexid-account-menu-open {
  overflow: hidden !important;
}
body.nexid-account-menu-open > :not(#nexid-account-menu-root):not(script):not(style),
html.nexid-account-menu-open body > :not(#nexid-account-menu-root):not(script):not(style) {
  pointer-events: none !important;
  user-select: none !important;
}
.nexid-account-dialog,
.nexid-account-overlay {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  display: block !important;
  background:
    radial-gradient(circle at 82% 8%, rgba(34, 211, 238, 0.2), transparent 34%),
    rgba(2, 6, 23, 0.98) !important;
  color: inherit !important;
  overflow: hidden !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
  transform: none !important;
  isolation: isolate !important;
  contain: none !important;
  z-index: ${ACCOUNT_MENU_Z_INDEX} !important;
}
.nexid-account-dialog::backdrop {
  background:
    radial-gradient(circle at 82% 8%, rgba(34, 211, 238, 0.12), transparent 34%),
    rgba(2, 6, 23, 0.82) !important;
  backdrop-filter: blur(2px) saturate(0.72) !important;
}
.nexid-account-dialog:not([open]) {
  display: none !important;
}
#nexid-account-menu-root {
  position: fixed !important;
  inset: 0 !important;
  z-index: ${ACCOUNT_MENU_Z_INDEX} !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  transform: none !important;
  pointer-events: none !important;
  isolation: isolate !important;
  contain: none !important;
}
#nexid-account-menu-root[data-account-menu-active="true"],
html.nexid-account-menu-open #nexid-account-menu-root,
body.nexid-account-menu-open #nexid-account-menu-root {
  display: block !important;
  pointer-events: auto !important;
  z-index: ${ACCOUNT_MENU_Z_INDEX} !important;
}
#nexid-account-menu-root,
#nexid-account-menu-root * {
  visibility: visible !important;
}
.nexid-account-layer {
  position: fixed !important;
  inset-block: 0 !important;
  right: 0 !important;
  left: auto !important;
  display: flex !important;
  width: min(100vw, 38rem) !important;
  height: 100dvh !important;
  max-width: min(100vw, 38rem) !important;
  max-height: 100dvh !important;
  overflow: hidden !important;
  isolation: isolate !important;
  contain: none !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
  transform: none !important;
  z-index: ${ACCOUNT_MENU_PANEL_Z_INDEX} !important;
  overscroll-behavior: contain !important;
  background:
    radial-gradient(circle at 88% 6%, rgba(34, 211, 238, 0.16), transparent 35%),
    linear-gradient(180deg, #08111f 0%, #020817 48%, #020817 100%) !important;
  color: inherit !important;
  box-shadow: -44px 0 140px rgba(0, 0, 0, 0.82) !important;
}
.nexid-account-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: ${ACCOUNT_MENU_BACKDROP_Z_INDEX} !important;
  background: transparent !important;
  pointer-events: auto !important;
  border: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}
.nexid-account-context {
  position: fixed !important;
  left: clamp(1.25rem, 6vw, 7rem) !important;
  top: 50% !important;
  z-index: ${ACCOUNT_MENU_PANEL_Z_INDEX} !important;
  width: min(44rem, calc(100vw - 42rem - 6vw)) !important;
  max-width: 44rem !important;
  transform: translateY(-50%) !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
}
.nexid-account-layer .tenant-account-panel {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  pointer-events: auto !important;
  isolation: isolate !important;
  z-index: ${ACCOUNT_MENU_PANEL_Z_INDEX} !important;
}
.nexid-account-layer .tenant-account-panel,
html.theme-light .nexid-account-layer .tenant-account-panel,
html[data-theme="light"] .nexid-account-layer .tenant-account-panel {
  background:
    radial-gradient(circle at 88% 6%, rgba(34, 211, 238, 0.16), transparent 35%),
    linear-gradient(180deg, #08111f 0%, #020817 48%, #020817 100%) !important;
  color: #f8fafc !important;
}
html.theme-light .nexid-account-layer .tenant-account-panel [class*="bg-slate-950"],
html.theme-light .nexid-account-layer .tenant-account-panel [class*="bg-slate-900"],
html.theme-light .nexid-account-layer .tenant-account-panel [class*="bg-white/"],
html[data-theme="light"] .nexid-account-layer .tenant-account-panel [class*="bg-slate-950"],
html[data-theme="light"] .nexid-account-layer .tenant-account-panel [class*="bg-slate-900"],
html[data-theme="light"] .nexid-account-layer .tenant-account-panel [class*="bg-white/"] {
  background: rgba(15, 23, 42, 0.62) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  color: #f8fafc !important;
}
html.theme-light .nexid-account-layer .tenant-account-panel .text-white,
html.theme-light .nexid-account-layer .tenant-account-panel .text-slate-100,
html.theme-light .nexid-account-layer .tenant-account-panel .text-slate-200,
html[data-theme="light"] .nexid-account-layer .tenant-account-panel .text-white,
html[data-theme="light"] .nexid-account-layer .tenant-account-panel .text-slate-100,
html[data-theme="light"] .nexid-account-layer .tenant-account-panel .text-slate-200 {
  color: #f8fafc !important;
}
html.theme-light .nexid-account-layer .tenant-account-panel .text-slate-300,
html.theme-light .nexid-account-layer .tenant-account-panel .text-slate-400,
html.theme-light .nexid-account-layer .tenant-account-panel .text-slate-500,
html[data-theme="light"] .nexid-account-layer .tenant-account-panel .text-slate-300,
html[data-theme="light"] .nexid-account-layer .tenant-account-panel .text-slate-400,
html[data-theme="light"] .nexid-account-layer .tenant-account-panel .text-slate-500 {
  color: #cbd5e1 !important;
}
body.nexid-account-menu-open .nexid-crm-shell,
html.nexid-account-menu-open .nexid-crm-shell {
  pointer-events: none !important;
  z-index: 0 !important;
  filter: saturate(0.5) brightness(0.16) blur(1px) !important;
  opacity: 0 !important;
  visibility: hidden !important;
  transform: none !important;
  contain: none !important;
  user-select: none !important;
}
body.nexid-account-menu-open .dashboard-shell-root,
html.nexid-account-menu-open .dashboard-shell-root,
body.nexid-account-menu-open .dashboard-header,
html.nexid-account-menu-open .dashboard-header,
body.nexid-account-menu-open .dashboard-sidebar,
html.nexid-account-menu-open .dashboard-sidebar,
body.nexid-account-menu-open .dashboard-mobile-dock,
html.nexid-account-menu-open .dashboard-mobile-dock {
  pointer-events: none !important;
  z-index: 0 !important;
  contain: none !important;
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
  .nexid-account-context {
    display: none !important;
  }
  .nexid-account-layer {
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    max-width: 100vw !important;
    max-height: 100dvh !important;
  }
}
`;
const ACCOUNT_LAYER_STYLE: CSSProperties = {
  position: "fixed",
  zIndex: ACCOUNT_MENU_PANEL_Z_INDEX,
  top: 0,
  right: 0,
  bottom: 0,
  left: "auto",
  width: "min(100vw, 38rem)",
  height: "100dvh",
  maxWidth: "min(100vw, 38rem)",
  maxHeight: "100dvh",
  margin: "0 0 0 auto",
  padding: 0,
  border: 0,
  overflow: "hidden",
  pointerEvents: "auto",
  isolation: "isolate",
  backgroundColor: "#020817",
  color: "inherit",
  overscrollBehavior: "contain",
  boxShadow: "-44px 0 140px rgba(0,0,0,0.82)",
};
const ACCOUNT_OVERLAY_STYLE: CSSProperties = {
  position: "fixed",
  zIndex: ACCOUNT_MENU_Z_INDEX,
  inset: 0,
  width: "100vw",
  height: "100dvh",
  margin: 0,
  padding: 0,
  overflow: "hidden",
  pointerEvents: "auto",
  background:
    "radial-gradient(circle at 82% 8%, rgba(34, 211, 238, 0.2), transparent 34%), rgba(2, 6, 23, 0.98)",
  color: "inherit",
  isolation: "isolate",
};
const ACCOUNT_MENU_DEFAULT_STYLE: CSSProperties = {
  position: "relative",
  zIndex: ACCOUNT_MENU_PANEL_Z_INDEX,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: "100%",
  height: "100%",
  maxHeight: "100%",
  pointerEvents: "auto",
  isolation: "isolate",
  backgroundColor: "transparent",
};

function promoteAccountMenuPortalRoot(root: HTMLElement) {
  if (root.parentElement !== document.body || root !== document.body.lastElementChild) {
    document.body.appendChild(root);
  }
  root.setAttribute("data-account-menu-root", "true");
  root.setAttribute("data-account-menu-version", ACCOUNT_MENU_VERSION);
  root.style.setProperty("position", "fixed", "important");
  root.style.setProperty("inset", "0", "important");
  root.style.setProperty("z-index", String(ACCOUNT_MENU_Z_INDEX), "important");
  root.style.setProperty("display", "block", "important");
  root.style.setProperty("visibility", "visible", "important");
  root.style.setProperty("opacity", "1", "important");
  root.style.setProperty("transform", "none", "important");
  root.style.setProperty("pointer-events", "none", "important");
  root.style.setProperty("isolation", "isolate", "important");
  root.style.setProperty("contain", "none", "important");
  root.style.setProperty("width", "100vw", "important");
  root.style.setProperty("height", "100dvh", "important");
  return root;
}

function getAccountMenuPortalRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(ACCOUNT_MENU_PORTAL_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ACCOUNT_MENU_PORTAL_ROOT_ID;
    root.setAttribute("data-account-menu-root", "true");
  }
  promoteAccountMenuPortalRoot(root);
  return root;
}

function setActiveDataAttribute(element: Element, name: string, value: boolean) {
  if (value) {
    element.setAttribute(name, "true");
    return;
  }

  element.removeAttribute(name);
}

function isNativeModalDialog(dialog: HTMLDialogElement) {
  try {
    return dialog.matches(":modal");
  } catch {
    return dialog.open;
  }
}

function showAccountMenuDialog(dialog?: HTMLDialogElement | null) {
  if (!dialog) return;

  const nativeModal = isNativeModalDialog(dialog);
  if (dialog.open && !nativeModal) {
    try {
      dialog.close();
    } catch {
      dialog.removeAttribute("open");
    }
  }

  if (!dialog.open) {
    try {
      dialog.showModal();
      dialog.setAttribute("data-account-menu-modal-state", "native-modal");
      return;
    } catch {
      dialog.setAttribute("open", "");
      dialog.setAttribute("data-account-menu-modal-state", "open-fallback");
      return;
    }
  }

  dialog.setAttribute("data-account-menu-modal-state", nativeModal ? "native-modal" : "open-fallback");
}

function setCrmShellSuppression(value: boolean) {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>(".nexid-crm-shell").forEach((node) => {
    if (value) {
      node.setAttribute("data-account-menu-suppressed", "true");
      node.setAttribute("aria-hidden", "true");
      node.style.setProperty("pointer-events", "none", "important");
      node.style.setProperty("z-index", "0", "important");
      node.style.setProperty("filter", "saturate(0.5) brightness(0.16) blur(1px)", "important");
      node.style.setProperty("opacity", "0", "important");
      node.style.setProperty("visibility", "hidden", "important");
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
    node.style.removeProperty("opacity");
    node.style.removeProperty("visibility");
    node.style.removeProperty("transform");
    node.style.removeProperty("contain");
    try {
      (node as HTMLElement & { inert?: boolean }).inert = false;
    } catch {
      // No-op fallback for browser surfaces without inert.
    }
  });
}

function forceAccountMenuModalLayer(
  root: HTMLElement | null,
  layer?: HTMLElement | null,
  panel?: HTMLElement | null,
  dialog?: HTMLDialogElement | null,
) {
  showAccountMenuDialog(dialog);
  if (root) {
    promoteAccountMenuPortalRoot(root);
    setActiveDataAttribute(root, "data-account-menu-active", true);
    root.setAttribute("data-account-menu-modal-ready", "true");
    root.style.setProperty("pointer-events", "auto", "important");
    root.style.setProperty("z-index", String(ACCOUNT_MENU_Z_INDEX), "important");
  }
  [layer, panel].forEach((node) => {
    if (!node) return;
    node.style.setProperty("position", node === layer ? "fixed" : "relative", "important");
    node.style.setProperty("z-index", String(ACCOUNT_MENU_PANEL_Z_INDEX), "important");
    node.style.setProperty("visibility", "visible", "important");
    node.style.setProperty("opacity", "1", "important");
    node.style.setProperty("pointer-events", "auto", "important");
    node.style.setProperty("transform", "none", "important");
    node.style.setProperty("contain", "none", "important");
  });
  setCrmShellSuppression(true);
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
  surface = "dashboard",
  tenantSlug,
}: TenantAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>(ACCOUNT_MENU_DEFAULT_STYLE);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openRef = useRef(open);
  const lastActivationRef = useRef(0);
  const tenantName = tenantNameFromSlug(tenantSlug);
  const scopedTenant = String(tenantSlug || "").trim().toLowerCase();
  const tenantQuery = scopedTenant ? `?tenant=${encodeURIComponent(scopedTenant)}` : "";
  const tenantHref = scopedTenant ? `/tenants/${encodeURIComponent(scopedTenant)}` : "/tenants";
  const accountLabel = label || tenantName;
  const isTenantMode = mode === "tenant";
  const accountRoleDescription = roleDescription(role, mode);
  const canManageUsers = role === "super-admin" || permissions.includes("*") || permissions.includes("users:manage") || permissions.includes("employees:*");
  const isClerkSsoSession = role === "super-admin" && Boolean(clerkEnabled);
  const identityVerified = Boolean(mfaVerified) || isClerkSsoSession;
  const accountSecurityOk = Boolean(mfaVerified);
  const hasWildcardAccess = permissions.includes("*");
  const normalizedPermissions = hasWildcardAccess
    ? [role === "super-admin" || mode === "global" ? "Acceso global" : "Tenant completo"]
    : permissions.length ? permissions.slice(0, 3) : ["Scope operativo"];
  const workspaceStatus = setupCompleted === false
    ? "Setup pendiente"
    : accountSecurityOk
      ? "Operativo"
      : "Seguridad pendiente";
  const workspacePlan = isTenantMode ? "Enterprise" : "Platform";
  const workspaceScope = isTenantMode ? tenantName : "Todos los tenants";
  const workspaceRegion = isTenantMode ? "AR / LATAM" : "Global";
  const workspaceInsights = [
    {
      label: "Workspace",
      value: workspaceScope,
      detail: isTenantMode ? "Datos, usuarios y CRM aislados por tenant." : "Vista global para operar red y cuentas.",
    },
    {
      label: "Seguridad",
      value: mfaVerified ? "MFA activo" : isClerkSsoSession ? "Google SSO" : "MFA pendiente",
      detail: accountSecurityOk
        ? "Sesion autorizada con segundo factor nexID."
        : identityVerified
          ? "Identidad Google verificada; MFA nexID queda separado."
          : "Conviene reforzar acceso antes de escalar.",
    },
    {
      label: "Plan",
      value: workspacePlan,
      detail: isTenantMode ? "Proof, CRM, marketplace e integraciones." : "Tenants, billing, IAM y soporte global.",
    },
    {
      label: "Region",
      value: workspaceRegion,
      detail: isTenantMode ? "Demo comercial con datos no sensibles." : "Control multi-region y partners.",
    },
  ];
  const nextAction = setupCompleted === false && role === "tenant-admin"
    ? { href: "/onboarding", label: "Completar setup del tenant", meta: "Datos, equipo e integraciones base" }
    : !accountSecurityOk
      ? { href: "/mfa", label: "Revisar MFA y seguridad", meta: "Segundo factor antes de escalar permisos" }
      : isTenantMode
        ? { href: tenantHref, label: "Abrir perfil del tenant", meta: "Plan, vertical, health y playbook del workspace" }
        : { href: "/settings", label: "Abrir configuracion global", meta: "Seguridad, tenants, integraciones y soporte" };

  const updatePanelPosition = useCallback(() => {
    if (typeof window === "undefined") {
      setPanelStyle(ACCOUNT_MENU_DEFAULT_STYLE);
      return;
    }
    const isCompact = window.innerWidth < 640;
    const layerStyle = isCompact
      ? {
          ...ACCOUNT_LAYER_STYLE,
          inset: 0,
          left: 0,
          width: "100vw",
          maxWidth: "100vw",
        }
      : ACCOUNT_LAYER_STYLE;
    const contentStyle = {
      ...ACCOUNT_MENU_DEFAULT_STYLE,
      width: "100%",
      height: "100%",
      maxHeight: "100%",
    };
    if (layerRef.current) {
      Object.entries(layerStyle).forEach(([key, value]) => {
        if (value == null) return;
        const cssKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
        layerRef.current?.style.setProperty(cssKey, String(value), "important");
      });
    }
    setPanelStyle({
      ...contentStyle,
      left: 0,
    });
  }, []);

  const setDocumentMenuState = useCallback((value: boolean) => {
    const root = getAccountMenuPortalRoot();
    if (root) {
      setActiveDataAttribute(root, "data-account-menu-active", value);
      root.style.setProperty("pointer-events", value ? "auto" : "none", "important");
      if (value) root.setAttribute("data-account-menu-modal-ready", "true");
      else root.removeAttribute("data-account-menu-modal-ready");
      if (value) {
        window.requestAnimationFrame(() => {
          if (!openRef.current) return;
          const promotedRoot = getAccountMenuPortalRoot();
          if (!promotedRoot) return;
          forceAccountMenuModalLayer(promotedRoot, layerRef.current, panelRef.current, dialogRef.current);
          setPortalRoot(promotedRoot);
        });
      }
      setPortalRoot(root);
    }
    document.documentElement.classList.toggle("nexid-account-menu-open", value);
    document.body.classList.toggle("nexid-account-menu-open", value);
    setActiveDataAttribute(document.body, "data-account-menu-open", value);
    setCrmShellSuppression(value);
  }, []);

  const closeMenu = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute("open");
      }
    }
    setDocumentMenuState(false);
    openRef.current = false;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [setDocumentMenuState]);

  useEffect(() => {
    openRef.current = open;
  }, [open, portalRoot]);

  useIsomorphicLayoutEffect(() => {
    setPortalRoot(getAccountMenuPortalRoot());
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    setDocumentMenuState(true);
    forceAccountMenuModalLayer(portalRoot || getAccountMenuPortalRoot(), layerRef.current, panelRef.current, dialogRef.current);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target)
        || panelRef.current?.contains(target)
        || contextRef.current?.contains(target)
        || layerRef.current?.contains(target)
      ) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const reinforceModalLayer = () => {
      if (!openRef.current) return;
      const promotedRoot = getAccountMenuPortalRoot();
      forceAccountMenuModalLayer(promotedRoot, layerRef.current, panelRef.current, dialogRef.current);
      updatePanelPosition();
    };
    const reinforceAnimationFrame = window.requestAnimationFrame(reinforceModalLayer);
    const reinforceInterval = window.setInterval(reinforceModalLayer, 350);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(reinforceAnimationFrame);
      window.clearInterval(reinforceInterval);
      const activeDialog = dialogRef.current;
      if (activeDialog?.open) {
        try {
          activeDialog.close();
        } catch {
          activeDialog.removeAttribute("open");
        }
      }
      setDocumentMenuState(false);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open, setDocumentMenuState, updatePanelPosition]);

  const openMenu = useCallback(() => {
    if (openRef.current) return;
    const root = getAccountMenuPortalRoot();
    if (!root) return;
    openRef.current = true;
    setDocumentMenuState(true);
    updatePanelPosition();
    flushSync(() => {
      setPortalRoot(root);
      setOpen(true);
    });
    forceAccountMenuModalLayer(root, layerRef.current, panelRef.current, dialogRef.current);
    window.requestAnimationFrame(() => {
      const promotedRoot = getAccountMenuPortalRoot();
      if (!promotedRoot || !openRef.current) return;
      forceAccountMenuModalLayer(promotedRoot, layerRef.current, panelRef.current, dialogRef.current);
      updatePanelPosition();
    });
    window.setTimeout(() => {
      if (!openRef.current) return;
      const promotedRoot = getAccountMenuPortalRoot();
      forceAccountMenuModalLayer(promotedRoot, layerRef.current, panelRef.current, dialogRef.current);
      updatePanelPosition();
    }, 0);
  }, [setDocumentMenuState, updatePanelPosition]);

  const toggleMenu = useCallback(() => {
    if (openRef.current) {
      closeMenu();
      return;
    }
    openMenu();
  }, [closeMenu, openMenu]);

  const activateMenu = useCallback((event: ReactMouseEvent<HTMLButtonElement> | ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    if (now - lastActivationRef.current < 220) return;
    lastActivationRef.current = now;
    toggleMenu();
  }, [toggleMenu]);

  const prepareMenuPortalRoot = useCallback(() => {
    if (openRef.current) return;
    setPortalRoot(getAccountMenuPortalRoot());
  }, []);

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
      label: "Configuracion del workspace",
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
      meta: canManageUsers ? "Roles, alcance por recurso, reset y MFA" : "Solicitudes, politicas y alcance autorizado",
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
      href: "/proof",
      icon: <FileSearch className="h-4 w-4" />,
      label: "Proof, IOTA y anchors",
      meta: "Hashes, Merkle roots, decoder y recibos publicos",
    },
    {
      href: "/demo-lab",
      icon: <FlaskConical className="h-4 w-4" />,
      label: "Demo Lab enterprise",
      meta: "Secure Delivery, pharma, agro y ventas guiadas",
    },
    {
      href: "/tokenization",
      icon: <Network className="h-4 w-4" />,
      label: "Polygon ownership",
      meta: "Claims, certificados, warranty y ownership transferible",
    },
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
    <>
      <style
        data-account-menu-critical-style="true"
        data-testid="tenant-account-menu-critical-style"
        dangerouslySetInnerHTML={{ __html: ACCOUNT_MENU_CRITICAL_CSS }}
      />
      <dialog
        ref={dialogRef}
        className="nexid-account-dialog nexid-account-overlay"
        data-account-menu-dialog="native-top-layer"
        data-testid="tenant-account-menu-dialog"
        style={ACCOUNT_OVERLAY_STYLE}
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
      >
        <button
          type="button"
          aria-label="Cerrar panel de cuenta"
          data-account-menu-backdrop="true"
          data-testid="tenant-account-menu-backdrop"
          className="nexid-account-backdrop"
          onClick={closeMenu}
        />
        <div
          ref={contextRef}
          className="nexid-account-context hidden xl:block"
          data-testid="tenant-account-menu-context"
          aria-label="Resumen del workspace activo"
        >
          <div className="rounded-[2rem] border border-cyan-200/18 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,.18),transparent_32%),linear-gradient(135deg,rgba(8,17,31,.94),rgba(2,8,23,.9))] p-6 text-slate-100 shadow-[0_30px_120px_rgba(0,0,0,.62)] ring-1 ring-white/8">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Workspace activo</p>
                <h2 className="mt-3 text-4xl font-black leading-tight tracking-[-0.03em] text-white">{tenantName}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{accountRoleDescription}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] ${
                accountSecurityOk && setupCompleted !== false
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                  : "border-amber-300/30 bg-amber-400/10 text-amber-100"
              }`}>
                {workspaceStatus}
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {workspaceInsights.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                  <p className="mt-2 truncate text-lg font-black text-white">{item.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-300/18 bg-cyan-400/8 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Accesos SaaS</p>
              <div className="mt-3 grid gap-2">
                {[nextAction, ...primaryItems.slice(0, 2)].map((item) => (
                  <button
                    key={`${item.href}-${item.label}`}
                    type="button"
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-left transition hover:border-cyan-300/45 hover:bg-cyan-400/10"
                    onClick={() => {
                      window.location.href = item.href;
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">{item.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{item.meta}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-cyan-200 transition group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div
          ref={layerRef}
          role="dialog"
          aria-modal="true"
          className="nexid-account-layer isolate"
          data-account-menu-portal="body"
          data-account-menu-version={ACCOUNT_MENU_VERSION}
          data-account-menu-source={surface}
          data-account-menu-top-layer="native-dialog"
          data-testid="tenant-account-menu-layer"
          aria-label="Cuenta operativa nexID"
          style={ACCOUNT_LAYER_STYLE}
        >
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
                <h2 className="mt-1 text-base font-black leading-5 text-white">{accountLabel}</h2>
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
                {mfaVerified ? "mfa ok" : isClerkSsoSession ? "sso google" : "mfa revisar"}
              </span>
              <span className="rounded-lg border border-violet-300/25 bg-violet-400/10 px-2 py-2 text-violet-100">
                {isTenantMode ? "tenant" : "global"}
              </span>
            </div>
            <div
              data-testid="tenant-account-session-summary"
              className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300"
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
            <div
              data-testid="tenant-account-workspace-command-center"
              className="mt-3 rounded-2xl border border-cyan-300/18 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,.16),transparent_34%),linear-gradient(145deg,rgba(8,47,73,.52),rgba(15,23,42,.68))] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Command center</p>
                  <p className="mt-1 text-sm font-black text-white">Cuenta lista para operar SaaS</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                  accountSecurityOk && setupCompleted !== false
                    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                    : "border-amber-300/30 bg-amber-400/10 text-amber-100"
                }`}>
                  {workspaceStatus}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {workspaceInsights.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                    <p className="mt-1 truncate text-sm font-black text-white">{item.value}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">{item.detail}</p>
                  </div>
                ))}
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
              <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-200/20 bg-cyan-300/10">
                <ArrowRight className="h-4 w-4" />
              </span>
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
            <SecureDashboardLogoutButton
              clerkEnabled={clerkEnabled}
              onStart={() => setDocumentMenuState(false)}
              testId="tenant-account-logout"
            />
          </div>
        </div>
      </div>
      </dialog>
    </>
  ) : null;
  const activePortalRoot = typeof document !== "undefined" ? (portalRoot || getAccountMenuPortalRoot()) : null;

  return (
    <div
      ref={menuRef}
      data-account-menu-surface={surface}
      className={`relative z-[720] ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="tenant-account-menu-panel"
        data-testid="tenant-account-menu-trigger"
        data-account-menu-compact={surface === "dashboard" ? "true" : undefined}
        data-account-menu-trigger-surface={surface}
        data-account-menu-open={open ? "true" : "false"}
        title="Abrir cuenta, configuracion y logout del workspace"
        className="flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-xl border border-white/12 bg-slate-950/65 px-3 py-2 text-left shadow-[0_16px_38px_rgba(2,6,23,.22)] transition hover:border-cyan-300/40 hover:bg-cyan-400/10 lg:min-w-[190px]"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          closeMenu();
        }}
        onPointerDownCapture={() => {
          prepareMenuPortalRoot();
        }}
        onPointerUp={(event) => {
          if (event.pointerType === "mouse") return;
          activateMenu(event);
        }}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          activateMenu(event);
        }}
        onClick={(event) => {
          activateMenu(event);
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

      {activePortalRoot && menuPanel ? createPortal(menuPanel, activePortalRoot) : null}
    </div>
  );
}
