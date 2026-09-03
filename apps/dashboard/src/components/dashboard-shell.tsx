"use client";

import { BrandDot, BrandLockup, ThemeToggle as SharedThemeToggle } from "@product/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { dashboardContent } from "../lib/dashboard-content";
import type { UserRole } from "../lib/dashboard-content";
import {
  DASHBOARD_DESTINATIONS,
  dashboardCanOpenDestination,
  type DashboardDestinationKey,
} from "../lib/dashboard-destination-policy";
import { productUrls } from "@product/config";
import { AudienceModeProvider, useAudienceMode } from "./audience-mode";
import { AdminNotificationBell } from "./admin-notification-bell";
import { TenantAccountMenu } from "./tenant-account-menu";
import { motion } from "framer-motion";
import {
  Compass,
  LayoutDashboard,
  Layers,
  Cpu,
  Activity,
  Coins,
  BarChart3,
  LifeBuoy,
  KeyRound,
  Network,
  Users,
  CreditCard,
  Award,
  UserSquare2,
  Gift,
  PartyPopper,
  Bot,
  ShoppingBag,
  Flame,
  Package,
  FileCheck2,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Presentation,
  BookOpen,
  Terminal,
  FlaskConical,
  Menu,
  X,
} from "lucide-react";

type DashboardText = typeof dashboardContent["es-AR"];

export function ThemeToggle() {
  return <SharedThemeToggle />;
}

export function LocaleSwitcher({ value, options }: { value: string; options: readonly string[] }) {
  return (
    <select suppressHydrationWarning
      value={value}
      onChange={(e) => { document.cookie = `locale=${e.target.value}; path=/; max-age=31536000`; window.location.reload(); }}
      aria-label="Idioma del dashboard"
      title="Cambiar idioma"
      className="locale-switcher min-h-11 rounded-lg border border-white/10 bg-transparent px-2 py-2 text-xs text-inherit outline-none"
    >
      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "amber" | "green" | "cyan" }) {
  const tones = {
    default: "border-white/10 bg-white/5 text-slate-300",
    amber: "border-amber-300/30 bg-amber-500/10 text-amber-200",
    green: "border-emerald-300/30 bg-emerald-500/10 text-emerald-200",
    cyan: "border-cyan-300/30 bg-cyan-500/10 text-cyan-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tones[tone]}`}>
      {tone !== "default" ? <span className={`h-1.5 w-1.5 rounded-full ${tone === "green" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : "bg-cyan-400"} animate-pulse`} /> : null}
      {children}
    </span>
  );
}

export function DashboardShellInner({
  children,
  title,
  subtitle,
  nav,
  roles,
  shell,
  locale,
  locales,
  currentRole,
  currentEmail,
  currentLabel,
  currentPermissions = [],
  currentDeniedPermissions = [],
  currentTenantSlug,
  currentMfaVerified,
  currentSetupCompleted,
  currentIsDemo = false,
  clerkEnabled,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  nav: DashboardText["nav"];
  roles: DashboardText["roles"];
  shell: DashboardText["shell"];
  locale: string;
  locales: readonly string[];
  currentRole: UserRole;
  currentEmail: string;
  currentLabel: string;
  currentPermissions?: string[];
  currentDeniedPermissions?: string[];
  currentTenantSlug?: string | null;
  currentMfaVerified?: boolean | null;
  currentSetupCompleted?: boolean | null;
  currentIsDemo?: boolean;
  clerkEnabled?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { mode, setMode } = useAudienceMode();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const destinationAccess = {
    role: currentRole,
    permissions: currentPermissions,
    deniedPermissions: currentDeniedPermissions,
    isDemo: currentIsDemo,
  };
  const canOpenDestination = (destination: DashboardDestinationKey) => (
    dashboardCanOpenDestination(destination, destinationAccess)
  );
  const isTenantAdministrator = currentRole === "tenant-owner" || currentRole === "tenant-admin";
  const isResellerRole = currentRole === "reseller-admin" || currentRole === "reseller";
  const canReadSensitiveEvents = canOpenDestination("events");
  const canAccessDemoLab = canOpenDestination("demoLab");
  type DestinationLink = { destination: DashboardDestinationKey; href: string; label: string };
  const itemCandidates: DestinationLink[] = [
    { destination: "overview", href: DASHBOARD_DESTINATIONS.overview.href, label: nav.overview },
    { destination: "batches", href: DASHBOARD_DESTINATIONS.batches.href, label: nav.batches },
    { destination: "supplierBatches", href: DASHBOARD_DESTINATIONS.supplierBatches.href, label: nav.supplierBatches },
    { destination: "logistics", href: DASHBOARD_DESTINATIONS.logistics.href, label: nav.logistics },
    { destination: "demoLab", href: DASHBOARD_DESTINATIONS.demoLab.href, label: "Demo Lab" },
    { destination: "proof", href: DASHBOARD_DESTINATIONS.proof.href, label: nav.proof },
    { destination: "tags", href: DASHBOARD_DESTINATIONS.tags.href, label: nav.tags },
    { destination: "events", href: DASHBOARD_DESTINATIONS.events.href, label: nav.events },
    { destination: "tokenization", href: DASHBOARD_DESTINATIONS.tokenization.href, label: "Tokenization" },
    { destination: "analytics", href: DASHBOARD_DESTINATIONS.analytics.href, label: nav.analytics },
    { destination: "serviceLevels", href: DASHBOARD_DESTINATIONS.serviceLevels.href, label: "SLO & Runbooks" },
    { destination: "riskAnalytics", href: DASHBOARD_DESTINATIONS.riskAnalytics.href, label: "Risk Analytics" },
    { destination: "leadsTickets", href: DASHBOARD_DESTINATIONS.leadsTickets.href, label: nav.leadsTickets },
  ];
  const items = itemCandidates.filter((item) => canOpenDestination(item.destination));

  if (canOpenDestination("tenants")) {
    items.unshift({ destination: "tenants", href: DASHBOARD_DESTINATIONS.tenants.href, label: nav.tenants });
    items.push({ destination: "resellers", href: DASHBOARD_DESTINATIONS.resellers.href, label: nav.resellers });
    items.push({ destination: "subscriptions", href: DASHBOARD_DESTINATIONS.subscriptions.href, label: nav.subscriptions });
  }
  if (canOpenDestination("apiKeys")) {
    items.push({ destination: "apiKeys", href: DASHBOARD_DESTINATIONS.apiKeys.href, label: nav.apiKeys });
  }

  const isActiveRoute = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const normalizedQuery = query.trim().toLowerCase();

  const role = currentRole;
  const forbidden = (pathname === "/tenants" && currentRole !== "super-admin") || (pathname.startsWith("/superadmin") && currentRole !== "super-admin");
  const canShowSandboxTools = currentIsDemo && !isTenantAdministrator && canOpenDestination("demoEncoder");

  const quick = { faq: "FAQ", stack: "Tech Stack", glossary: "Glossary", docs: "Docs" };
  const publicMobile = `${productUrls.web}/sun/simulate`;

  const audienceCopy = isTenantAdministrator
    ? { tone: "cyan" as const, label: "Tenant CRM" }
    : isResellerRole
      ? { tone: "default" as const, label: "Reseller Workspace" }
    : mode === "buyer"
      ? { tone: "default" as const, label: "Enterprise Buyer Preview" }
      : mode === "ceo"
        ? { tone: "cyan" as const, label: "CEO Mode" }
        : { tone: "amber" as const, label: "Operator Console" };

  const mobileQuickLinks = [
    { destination: "overview" as const, href: DASHBOARD_DESTINATIONS.overview.href, label: nav.overview },
    { destination: "events" as const, href: DASHBOARD_DESTINATIONS.events.href, label: nav.events },
    { destination: "demoLab" as const, href: DASHBOARD_DESTINATIONS.demoLab.href, label: "Demo" },
    { destination: "batches" as const, href: DASHBOARD_DESTINATIONS.batches.href, label: nav.batches },
    { destination: "tokenization" as const, href: DASHBOARD_DESTINATIONS.tokenization.href, label: "Chain" },
    { destination: "loyaltyOverview" as const, href: DASHBOARD_DESTINATIONS.loyaltyOverview.href, label: "CRM" },
    { destination: "analytics" as const, href: DASHBOARD_DESTINATIONS.analytics.href, label: nav.analytics },
  ].filter((item) => canOpenDestination(item.destination)).slice(0, 4);

  const searchableLinkCandidates: DestinationLink[] = [
    { destination: "onboarding", href: DASHBOARD_DESTINATIONS.onboarding.href, label: "Onboarding Setup" },
    { destination: "demoLab", href: DASHBOARD_DESTINATIONS.demoLab.href, label: "Demo Mission Control" },
    ...items,
    { destination: "supplierBatches", href: DASHBOARD_DESTINATIONS.supplierBatches.href, label: nav.supplierBatches },
    { destination: "logistics", href: DASHBOARD_DESTINATIONS.logistics.href, label: nav.logistics },
    { destination: "proof", href: DASHBOARD_DESTINATIONS.proof.href, label: nav.proof },
    { destination: "tokenization", href: DASHBOARD_DESTINATIONS.tokenization.href, label: "Tokenization Queue" },
    { destination: "serviceLevels", href: DASHBOARD_DESTINATIONS.serviceLevels.href, label: "SLO & Runbooks" },
    { destination: "superadminNetwork", href: DASHBOARD_DESTINATIONS.superadminNetwork.href, label: "Red de clientes" },
    { destination: "loyaltyOverview", href: DASHBOARD_DESTINATIONS.loyaltyOverview.href, label: "CRM de clientes" },
    { destination: "consumerOverview", href: DASHBOARD_DESTINATIONS.consumerOverview.href, label: "Clientes CRM" },
    { destination: "rewards", href: DASHBOARD_DESTINATIONS.rewards.href, label: "Catálogo Beneficios" },
    { destination: "experiences", href: DASHBOARD_DESTINATIONS.experiences.href, label: "Experiencias & Eventos" },
    { destination: "campaigns", href: DASHBOARD_DESTINATIONS.campaigns.href, label: "Campañas por señal" },
    { destination: "investorSnapshot", href: DASHBOARD_DESTINATIONS.investorSnapshot.href, label: "Investor Presentation" },
    { destination: "salesPlaybook", href: DASHBOARD_DESTINATIONS.salesPlaybook.href, label: "Sales Playbook & FAQs" },
    { destination: "marketplace", href: DASHBOARD_DESTINATIONS.marketplace.href, label: "Marketplace con opt-in" },
    { destination: "offers", href: DASHBOARD_DESTINATIONS.offers.href, label: "Ofertas & Drops" },
    { destination: "orderRequests", href: DASHBOARD_DESTINATIONS.orderRequests.href, label: "Order Requests" },
    { destination: "users", href: DASHBOARD_DESTINATIONS.users.href, label: "IAM Users" },
    { destination: "mfa", href: DASHBOARD_DESTINATIONS.mfa.href, label: "Account Security" },
    { destination: "sdkVision", href: DASHBOARD_DESTINATIONS.sdkVision.href, label: nav.sdkVision },
  ];
  const searchableLinks = Array.from(
    new Map(
      searchableLinkCandidates
        .filter((entry) => canOpenDestination(entry.destination))
        .map((entry) => [entry.href, entry] as const),
    ).values(),
  );

  const filteredLinks = normalizedQuery
    ? searchableLinks.filter((entry) => entry.label.toLowerCase().includes(normalizedQuery) || entry.href.toLowerCase().includes(normalizedQuery))
    : [];

  const contextualHeader = pathname.startsWith("/demo-lab")
    ? { title: "Demo Mission Control", subtitle: "Tenant demo operations" }
    : pathname.startsWith("/proof")
      ? { title: "Trust Operations", subtitle: "Evidence and anchors" }
      : pathname.startsWith("/tokenization")
        ? { title: "Ownership Operations", subtitle: "Polygon and digital twins" }
        : pathname.startsWith("/logistics")
          ? { title: "Secure Delivery", subtitle: "Custody and route control" }
          : { title, subtitle };

  type SidebarDestinationItem = {
    destination: DashboardDestinationKey;
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  };
  const coreOpsItemCandidates: SidebarDestinationItem[] = [
    { destination: "onboarding", href: DASHBOARD_DESTINATIONS.onboarding.href, label: "Onboarding Setup", icon: Compass },
    { destination: "overview", href: DASHBOARD_DESTINATIONS.overview.href, label: nav.overview, icon: LayoutDashboard },
    { destination: "logistics", href: DASHBOARD_DESTINATIONS.logistics.href, label: nav.logistics, icon: Package, badge: "NUEVO" },
    { destination: "demoLab", href: DASHBOARD_DESTINATIONS.demoLab.href, label: "Demo Mission Control", icon: FlaskConical, badge: "LAB" },
    { destination: "proof", href: DASHBOARD_DESTINATIONS.proof.href, label: nav.proof, icon: ShieldCheck, badge: "TRUST" },
    { destination: "batches", href: DASHBOARD_DESTINATIONS.batches.href, label: nav.batches, icon: Layers },
    { destination: "supplierBatches", href: DASHBOARD_DESTINATIONS.supplierBatches.href, label: nav.supplierBatches, icon: FileCheck2 },
    { destination: "tags", href: DASHBOARD_DESTINATIONS.tags.href, label: nav.tags, icon: Cpu },
    { destination: "events", href: DASHBOARD_DESTINATIONS.events.href, label: nav.events, icon: Activity },
    { destination: "tokenization", href: DASHBOARD_DESTINATIONS.tokenization.href, label: "Tokenization", icon: Coins },
    { destination: "analytics", href: DASHBOARD_DESTINATIONS.analytics.href, label: nav.analytics, icon: BarChart3 },
    { destination: "serviceLevels", href: DASHBOARD_DESTINATIONS.serviceLevels.href, label: "SLO & Runbooks", icon: Activity, badge: "SLO" },
    { destination: "riskAnalytics", href: DASHBOARD_DESTINATIONS.riskAnalytics.href, label: "Risk Analytics", icon: ShieldAlert, badge: "RISK" },
    { destination: "leadsTickets", href: DASHBOARD_DESTINATIONS.leadsTickets.href, label: nav.leadsTickets, icon: LifeBuoy },
    { destination: "sdkVision", href: DASHBOARD_DESTINATIONS.sdkVision.href, label: nav.sdkVision, icon: Terminal },
  ];
  const coreOpsItems = coreOpsItemCandidates.filter((item) => canOpenDestination(item.destination));

  if (canOpenDestination("tenants")) {
    coreOpsItems.unshift({ destination: "tenants", href: DASHBOARD_DESTINATIONS.tenants.href, label: nav.tenants, icon: Compass });
  }
  if (canOpenDestination("apiKeys")) {
    coreOpsItems.push({ destination: "apiKeys", href: DASHBOARD_DESTINATIONS.apiKeys.href, label: nav.apiKeys, icon: KeyRound });
  }

  const globalNetworkItemCandidates: SidebarDestinationItem[] = [
    { destination: "superadminNetwork", href: DASHBOARD_DESTINATIONS.superadminNetwork.href, label: "Red de clientes", icon: Network },
    { destination: "resellers", href: DASHBOARD_DESTINATIONS.resellers.href, label: nav.resellers, icon: Users },
    { destination: "subscriptions", href: DASHBOARD_DESTINATIONS.subscriptions.href, label: nav.subscriptions, icon: CreditCard },
  ];
  const globalNetworkItems = globalNetworkItemCandidates.filter((item) => canOpenDestination(item.destination));

  const loyaltyNetworkItemCandidates: SidebarDestinationItem[] = [
    { destination: "loyaltyOverview", href: DASHBOARD_DESTINATIONS.loyaltyOverview.href, label: "CRM de clientes", icon: Award },
    { destination: "consumerOverview", href: DASHBOARD_DESTINATIONS.consumerOverview.href, label: "Clientes CRM", icon: UserSquare2 },
    { destination: "rewards", href: DASHBOARD_DESTINATIONS.rewards.href, label: "Catálogo Beneficios", icon: Gift },
    { destination: "experiences", href: DASHBOARD_DESTINATIONS.experiences.href, label: "Experiencias & Eventos", icon: PartyPopper },
    { destination: "campaigns", href: DASHBOARD_DESTINATIONS.campaigns.href, label: "Campañas por señal", icon: Bot },
    { destination: "investorSnapshot", href: DASHBOARD_DESTINATIONS.investorSnapshot.href, label: "Investor Presentation", icon: Presentation, badge: "PDF" },
    { destination: "salesPlaybook", href: DASHBOARD_DESTINATIONS.salesPlaybook.href, label: "Sales Playbook & FAQs", icon: BookOpen, badge: "PDF" },
    { destination: "marketplace", href: DASHBOARD_DESTINATIONS.marketplace.href, label: "Marketplace con opt-in", icon: ShoppingBag, badge: "Web3" },
    { destination: "offers", href: DASHBOARD_DESTINATIONS.offers.href, label: "Ofertas & Drops", icon: Flame },
    { destination: "orderRequests", href: DASHBOARD_DESTINATIONS.orderRequests.href, label: "Order Requests", icon: FileCheck2 },
  ];
  const loyaltyNetworkItems = loyaltyNetworkItemCandidates.filter((item) => canOpenDestination(item.destination));

  const settingsItems: SidebarDestinationItem[] = [
    { destination: "mfa", href: DASHBOARD_DESTINATIONS.mfa.href, label: "Account Security", icon: ShieldCheck },
  ];
  if (canOpenDestination("users")) {
    settingsItems.unshift({ destination: "users", href: DASHBOARD_DESTINATIONS.users.href, label: "IAM Users", icon: Users });
  }

  const renderNavLink = (item: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }) => {
    const isActive = isActiveRoute(item.href);
    const IconComponent = item.icon;
    return (
      <Link key={item.href} href={item.href} className="relative block">
        <motion.div
          whileHover={{ x: 4 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-xs font-black tracking-tight transition duration-200 ${
            isActive
              ? "border-cyan-500/35 bg-cyan-500/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              : "border-transparent text-slate-400 hover:bg-white/[0.02] hover:text-white"
          }`}
        >
          {isActive && (
            <motion.div
              layoutId="activeSidebarIndicator"
              className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan-400"
            />
          )}
          <div className={`shrink-0 rounded-lg p-1.5 ${isActive ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-900 text-slate-500 border border-white/5"}`}>
            <IconComponent className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
            <span className={isActive ? "text-white" : "text-slate-300"}>{item.label}</span>
            {item.badge && (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                isActive
                  ? "border border-cyan-300/20 bg-cyan-500/10 text-cyan-200"
                  : "border border-white/5 bg-white/5 text-slate-400"
              }`}>
                {item.badge}
              </span>
            )}
          </div>
        </motion.div>
      </Link>
    );
  };

  return (
    <div className="dashboard-shell-root flex min-h-screen flex-col bg-[#020617] text-slate-200 lg:flex-row">
      {/* Backdrop for mobile sidebar drawer */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside className={`dashboard-sidebar border-r border-white/5 bg-slate-950/80 p-4 backdrop-blur-xl lg:w-80 lg:p-6 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.4)] flex flex-col h-screen overflow-y-auto transition-transform duration-300 fixed inset-y-0 left-0 w-72 lg:static lg:translate-x-0 ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between mb-8 shrink-0">
          <Link href="/" className="inline-flex items-center hover:opacity-80 transition-opacity">
            <BrandLockup size={40} variant="pulse" theme="dark" className="brand-surface-sidebar" />
          </Link>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg border border-white/10 bg-slate-900/50 text-slate-400 hover:text-white"
            aria-label="Close navigation menu"
            title="Cerrar menú de navegación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Grape / Winery Role Card */}
          <div className="dashboard-role-card relative overflow-hidden rounded-2xl border border-white/5 p-4 shadow-xl backdrop-blur-md">
            <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-violet-500/5 blur-2xl" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 text-xl border border-violet-500/20">
                🍇
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {roles[role] || "Tenant Admin"}
                </span>
                <h3 className="mt-0.5 text-xs font-black text-white truncate">
                  {currentLabel}
                </h3>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/90">
                    Polygon Amoy
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <input suppressHydrationWarning
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredLinks[0]) {
                  router.push(filteredLinks[0].href);
                  setQuery("");
                }
              }}
              placeholder={shell.search}
              className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all outline-none"
            />
            <div className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-mono border border-white/10 rounded px-1">/</div>
          </div>
          {normalizedQuery ? (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/25 p-2 text-xs">
              {filteredLinks.length ? (
                <div className="space-y-1">
                  {filteredLinks.slice(0, 4).map((entry) => (
                    <button suppressHydrationWarning key={entry.href} type="button" title={`Ir a ${entry.label}`} aria-label={`Ir a ${entry.label}`} onClick={() => { router.push(entry.href); setQuery(""); }} className="block w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-left text-cyan-100 hover:bg-cyan-500/15">
                      {entry.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-1 py-1 text-slate-400">Sin resultados para &quot;{query}&quot;.</p>
              )}
            </div>
          ) : null}
        </div>

        <nav className="mt-8 space-y-6">
          {/* Core Ops Group */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Core Ops</p>
            <div className="space-y-0.5">
              {coreOpsItems.map(renderNavLink)}
            </div>
          </div>

          {/* Global Network Group */}
          {globalNetworkItems.length > 0 && (
            <div>
              <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Global Network</p>
              <div className="space-y-0.5">
                {globalNetworkItems.map(renderNavLink)}
              </div>
            </div>
          )}

          {/* Clientes & campañas Group */}
          {loyaltyNetworkItems.length > 0 && (
            <div>
              <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Clientes & campañas</p>
              <div className="space-y-0.5">
                {loyaltyNetworkItems.map(renderNavLink)}
              </div>
            </div>
          )}

          {/* Settings Group */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Settings</p>
            <div className="space-y-0.5">
              {settingsItems.map(renderNavLink)}
            </div>
          </div>
        </nav>

        {/* Neutral pointers until billing and realtime metrics are supplied by trusted props. */}
        {canOpenDestination("billing") ? (
          <Link
            href={DASHBOARD_DESTINATIONS.billing.href}
            className="mt-8 block rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-slate-400 transition hover:border-cyan-500/20 hover:text-cyan-200 shrink-0"
          >
            <span className="block text-[10px] font-black uppercase tracking-[0.15em]">Uso</span>
            <span className="mt-2 block text-[10px] font-medium leading-4">Uso: consultar facturación</span>
          </Link>
        ) : null}

        {canOpenDestination("analytics") ? (
          <Link
            href={DASHBOARD_DESTINATIONS.analytics.href}
            className="mt-4 flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 transition hover:border-cyan-500/20 hover:text-cyan-200 shrink-0"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Realtime: estado en Analytics</span>
            </span>
            <span aria-hidden="true" className="text-[11px]">&rarr;</span>
          </Link>
        ) : null}

        {canShowSandboxTools ? (
          <div className="dashboard-ops-tools-card mt-4 rounded-xl border border-cyan-500/20 p-4 shadow-lg relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/20 blur-xl rounded-full pointer-events-none" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-3 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
               Ops Tools
            </p>
            <div className="grid gap-2">
              <Link href={DASHBOARD_DESTINATIONS.demoEncoder.href} className="dashboard-ops-tool-link rounded-lg border border-cyan-500/30 px-3 py-2 text-[11px] font-semibold text-cyan-100 transition-colors text-center">URL Encoder</Link>
              <a href={publicMobile} target="_blank" rel="noreferrer" className="dashboard-ops-tool-link rounded-lg border border-cyan-500/30 px-3 py-2 text-[11px] font-semibold text-cyan-100 transition-colors flex justify-between">
                 Mobile Scan <span>↗</span>
              </a>
            </div>
          </div>
        ) : null}
      </aside>

      <div className="dashboard-main min-w-0 flex-1 bg-slate-950/50">
        <header className="dashboard-header sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 px-4 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-white/10 bg-slate-900/50 text-slate-305 hover:text-white"
                aria-label="Open navigation menu"
                title="Abrir menú de navegación"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-1">
                   <BrandDot size={6} variant="pulse" theme="dark" />
                   {contextualHeader.subtitle}
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">{contextualHeader.title}</h1>
              </div>
            </div>
            <div className="flex w-full max-w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3">
              {canOpenDestination("leadsTickets") ? (
                <AdminNotificationBell canReadSensitiveEvents={canReadSensitiveEvents} />
              ) : null}
              <Badge tone={audienceCopy.tone}>{audienceCopy.label}</Badge>
              <Badge tone="green">{shell.apiConnected}</Badge>
              <div className="hidden h-6 w-px bg-white/10 mx-1 sm:block" />
              <LocaleSwitcher value={locale} options={[...locales]} />
              <SharedThemeToggle />
              <TenantAccountMenu
                className="dashboard-shell-account-menu shrink-0 sm:w-auto"
                email={currentEmail}
                label={currentLabel}
                mfaVerified={currentMfaVerified}
                mode={currentRole === "super-admin" ? "global" : "tenant"}
                permissions={currentPermissions}
                deniedPermissions={currentDeniedPermissions}
                role={currentRole}
                setupCompleted={currentSetupCompleted}
                surface="dashboard"
                tenantSlug={currentTenantSlug}
                isDemo={currentIsDemo}
                clerkEnabled={clerkEnabled}
              />
            </div>
          </div>
          {canShowSandboxTools ? (
            <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-3 flex items-center justify-between shadow-inner backdrop-blur-sm">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/30">🧪</div>
                  <div>
                     <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Sandbox tools enabled</p>
                     <p className="text-[10px] text-cyan-200/70">Production-safe scope for simulated interactions.</p>
                  </div>
               </div>
               <div className="flex gap-2">
                  <Link href={DASHBOARD_DESTINATIONS.demoLab.href} className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-colors">Mission Control</Link>
               </div>
            </div>
          ) : null}
        </header>

        <div className="p-4 lg:p-8">
          {forbidden ? (
            <div className="rounded-[2rem] border border-rose-500/20 bg-rose-950/20 p-8 text-center max-w-lg mx-auto mt-10 shadow-2xl backdrop-blur-xl">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-2xl mx-auto mb-4">🔒</div>
              <h2 className="text-lg font-bold text-white mb-2">Access Denied</h2>
              <p className="text-sm text-rose-200/70 mb-6">Your current role does not have access to this module.</p>
              <div className="flex justify-center gap-3">
                <Link href="/" className="rounded-xl border border-white/10 bg-slate-900 px-6 py-3 text-xs font-bold text-white transition hover:bg-slate-800 shadow-lg">Back to Overview</Link>
                {canAccessDemoLab ? <Link href={DASHBOARD_DESTINATIONS.demoLab.href} className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20">Open Demo Lab</Link> : null}
              </div>
            </div>
          ) : children}
        </div>

        <div className="dashboard-mobile-dock fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-slate-950/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-4 gap-2">
            {mobileQuickLinks.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center rounded-xl p-2 text-[10px] font-bold transition-all ${isActive ? "text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}>
                  <span className={`w-8 h-1 mb-1 rounded-full transition-colors ${isActive ? "bg-cyan-400" : "bg-transparent"}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


export function DashboardShell(props: Parameters<typeof DashboardShellInner>[0]) {
  return (
    <AudienceModeProvider>
      <DashboardShellInner {...props} />
    </AudienceModeProvider>
  );
}
