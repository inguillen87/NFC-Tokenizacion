"use client";

import { BrandDot, BrandLockup } from "@product/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { dashboardContent } from "../lib/dashboard-content";
import { productUrls } from "@product/config";
import { AudienceModeProvider, useAudienceMode } from "./audience-mode";

type DashboardText = typeof dashboardContent["es-AR"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const isLight = document.documentElement.classList.contains("theme-light");
    setTheme(isLight ? "light" : "dark");
  }, []);

  const toggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    if (newTheme === "light") document.documentElement.classList.add("theme-light");
    else document.documentElement.classList.remove("theme-light");
    setTheme(newTheme);
  };

  return (
    <button onClick={toggle} className="rounded-lg border border-white/10 px-3 py-2 text-xs" title="Toggle theme">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

export function LocaleSwitcher({ value, options }: { value: string; options: readonly string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => { document.cookie = `locale=${e.target.value}; path=/; max-age=31536000`; window.location.reload(); }}
      className="rounded-lg border border-white/10 bg-transparent px-2 py-2 text-xs text-inherit outline-none"
    >
      {options.map((opt) => <option key={opt} value={opt} className="bg-slate-900 text-slate-100">{opt}</option>)}
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
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  nav: DashboardText["nav"];
  roles: DashboardText["roles"];
  shell: DashboardText["shell"];
  locale: string;
  locales: readonly string[];
  currentRole: string;
  currentEmail: string;
  currentLabel: string;
  currentPermissions?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { mode, setMode } = useAudienceMode();

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

  const items = [
    { href: "/", label: nav.overview },
    { href: "/batches", label: nav.batches },
    { href: "/tags", label: nav.tags },
    { href: "/events", label: nav.events },
    { href: "/analytics", label: nav.analytics },
    { href: "/leads-tickets", label: nav.leadsTickets },
  ];

  if (currentRole === "super-admin") {
    items.unshift({ href: "/tenants", label: nav.tenants });
    items.push({ href: "/resellers", label: nav.resellers });
    items.push({ href: "/subscriptions", label: nav.subscriptions });
  } else if (currentRole === "reseller") {
    items.unshift({ href: "/tenants", label: nav.tenants });
  } else {
    items.push({ href: "/api-keys", label: nav.apiKeys });
  }

  const isActiveRoute = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const normalizedQuery = query.trim().toLowerCase();

  const role = (currentRole as keyof typeof roles) || "tenant-admin";
  const forbidden = (pathname === "/tenants" && currentRole === "tenant-admin") || (pathname.startsWith("/superadmin") && currentRole !== "super-admin");
  const isDemoMode = currentLabel.toLowerCase().includes("demo") || currentEmail.includes("demo");
  const canAccessDemoLab = currentPermissions.includes("demo:run") || currentRole === "super-admin" || isDemoMode;

  const quick = { faq: "FAQ", stack: "Tech Stack", glossary: "Glossary", docs: "Docs" };
  const publicMobile = `${productUrls.web}/sun/simulate`;

  const audienceCopy = mode === "buyer"
    ? { tone: "default" as const, label: "Enterprise Buyer Preview" }
    : mode === "ceo"
    ? { tone: "cyan" as const, label: "CEO Mode" }
    : { tone: "amber" as const, label: "Operator Console" };

  const mobileQuickLinks = [
    { href: "/", label: nav.overview },
    { href: "/events", label: nav.events },
    { href: "/batches", label: nav.batches },
    { href: "/analytics", label: "KPIs" },
  ];

  const searchableLinks = [
    { href: "/onboarding", label: "Onboarding Setup" },
    ...items,
    { href: "/superadmin-network", label: "Consumer Network", role: "super-admin" },
    { href: "/loyalty/overview", label: "Loyalty Studio" },
    { href: "/consumer-network/overview", label: "Portal de Usuarios" },
    { href: "/loyalty/rewards", label: "Catálogo Beneficios" },
    { href: "/loyalty/experiences", label: "Experiencias & Eventos" },
    { href: "/loyalty/campaigns", label: "Growth & BotIA" },
    { href: "/consumer-network/marketplace", label: "Marketplace Opt-in" },
    { href: "/consumer-network/offers", label: "Ofertas & Drops" },
    { href: "/consumer-network/order-requests", label: "Order Requests" },
    { href: "/users", label: "IAM Users" },
    { href: "/mfa", label: "MFA Security" },
  ].filter((entry) => (entry as { role?: string }).role ? currentRole === (entry as { role?: string }).role : true);

  const filteredLinks = normalizedQuery
    ? searchableLinks.filter((entry) => entry.label.toLowerCase().includes(normalizedQuery) || entry.href.toLowerCase().includes(normalizedQuery))
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-[#020617] text-slate-200 lg:flex-row">
      <aside className="border-r border-white/5 bg-slate-950/80 p-4 backdrop-blur-xl lg:w-72 lg:p-6 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        <Link href="/" className="mb-8 inline-flex items-center hover:opacity-80 transition-opacity">
          <BrandLockup size={40} variant="pulse" theme="dark" className="brand-surface-sidebar" />
        </Link>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4 shadow-inner">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 block">{shell.role}</label>
            <div className="text-sm font-semibold text-white truncate">{roles[role]} · {currentLabel}</div>
            <div className="text-[11px] text-slate-400 truncate mt-1">{currentEmail}</div>
          </div>

          <div className="relative">
            <input
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
                    <button key={entry.href} onClick={() => { router.push(entry.href); setQuery(""); }} className="block w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-left text-cyan-100 hover:bg-cyan-500/15">
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

        <nav className="mt-8 space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Core Ops</p>

          <Link href="/onboarding" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${pathname.startsWith("/onboarding") ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
            Onboarding Setup
          </Link>

          {items.map((item) => (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute(item.href) ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
              {item.label}
            </Link>
          ))}

          {currentRole === "super-admin" ? (
             <div className="mt-8 mb-4">
                <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Global Network</p>
                <Link href="/superadmin-network" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/superadmin-network") ? "bg-violet-500/10 text-violet-300 border border-violet-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                  Consumer Network
                </Link>
             </div>
          ) : null}

          {currentRole === "tenant-admin" || currentRole === "super-admin" ? (
            <div className="mt-8 mb-4">
               <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Loyalty & Network</p>
               <Link href="/loyalty/overview" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/loyalty/overview") ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                 Loyalty Studio
               </Link>
               <Link href="/consumer-network/overview" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/consumer-network/overview") ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                 Portal de Usuarios
               </Link>
               <Link href="/loyalty/rewards" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/loyalty/rewards") ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                 Catálogo Beneficios
               </Link>
               <Link href="/loyalty/experiences" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/loyalty/experiences") ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                 Experiencias & Eventos
               </Link>
               <Link href="/loyalty/campaigns" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/loyalty/campaigns") ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                 Growth & BotIA
               </Link>
               <Link href="/consumer-network/marketplace" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all mt-2 ${isActiveRoute("/consumer-network/marketplace") ? "bg-violet-500/10 text-violet-300 border border-violet-500/20" : "text-violet-400 hover:bg-white/5 hover:text-violet-300"}`}>
                 Marketplace Opt-in
               </Link>
               <Link href="/consumer-network/offers" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/consumer-network/offers") ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                 Ofertas & Drops
               </Link>
               <Link href="/consumer-network/order-requests" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/consumer-network/order-requests") ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                 Order Requests
               </Link>
            </div>
          ) : null}

          <div className="mt-8 border-t border-white/5 pt-4">
             <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Settings</p>
             {(currentPermissions.includes("users:manage") || currentRole === "super-admin") && (
               <Link href="/users" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/users") ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                 IAM Users
               </Link>
             )}
             <Link href="/mfa" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActiveRoute("/mfa") ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
               MFA Security
             </Link>
          </div>
        </nav>

        {isDemoMode ? (
          <div className="mt-8 rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/40 to-transparent p-4 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/20 blur-xl rounded-full pointer-events-none" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-3 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
               Ops Tools
            </p>
            <div className="grid gap-2">
              <Link href="/demo-lab/encode" className="rounded-lg border border-cyan-500/30 bg-slate-950/80 px-3 py-2 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-950/50 transition-colors">URL Encoder</Link>
              <a href={publicMobile} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-500/30 bg-slate-950/80 px-3 py-2 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-950/50 transition-colors flex justify-between">
                 Mobile Scan <span>↗</span>
              </a>
            </div>
          </div>
        ) : null}
      </aside>

      <div className="min-w-0 flex-1 bg-slate-950/50">
        <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 px-4 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-1">
                 <BrandDot size={6} variant="pulse" theme="dark" />
                 {subtitle}
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={audienceCopy.tone}>{audienceCopy.label}</Badge>
              <Badge tone="green">{shell.apiConnected}</Badge>
              <div className="h-6 w-px bg-white/10 mx-1" />
              <LocaleSwitcher value={locale} options={[...locales]} />
              <ThemeToggle />
              <Link
                href="/logout"
                onClick={(event) => {
                  if (!window.confirm("¿Querés salir ahora?")) event.preventDefault();
                }}
                className="rounded-lg border border-rose-500/20 hover:bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors"
              >
                 {shell.logout}
              </Link>
            </div>
          </div>
          {isDemoMode ? (
            <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-3 flex items-center justify-between shadow-inner backdrop-blur-sm">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/30">🧪</div>
                  <div>
                     <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Sandbox tools enabled</p>
                     <p className="text-[10px] text-cyan-200/70">Production-safe scope for simulated interactions.</p>
                  </div>
               </div>
               <div className="flex gap-2">
                  <Link href="/demo-lab" className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-colors">Mission Control</Link>
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
                {canAccessDemoLab ? <Link href="/demo-lab" className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20">Open Demo Lab</Link> : null}
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
