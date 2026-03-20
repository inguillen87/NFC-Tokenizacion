"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Badge, BrandDot, BrandLockup, LocaleSwitcher, ThemeToggle } from "@product/ui";
import { AudienceModeProvider, useAudienceMode } from "./audience-mode";
import type { AppLocale } from "@product/config";
import type { UserRole } from "../lib/dashboard-content";
import { roleAccess } from "../lib/dashboard-content";

type NavKey = "overview" | "tenants" | "batches" | "tags" | "analytics" | "events" | "resellers" | "leadsTickets" | "subscriptions" | "apiKeys";

function DashboardShellInner({
  title,
  subtitle,
  nav,
  roles,
  shell,
  locale,
  locales,
  children,
}: {
  title: string;
  subtitle: string;
  nav: Record<NavKey, string>;
  roles: Record<UserRole, string>;
  shell: { search: string; role: string; logout: string; apiConnected: string };
  locale: AppLocale;
  locales: readonly AppLocale[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { mode, setMode } = useAudienceMode();
  const [role, setRole] = useState<UserRole>("super-admin");
  const [query, setQuery] = useState("");

  const quick = locale === "en"
    ? { faq: "FAQ", stack: "Stack", glossary: "Glossary", docs: "Docs" }
    : locale === "pt-BR"
      ? { faq: "FAQ", stack: "Stack", glossary: "Glossário", docs: "Docs" }
      : { faq: "FAQ", stack: "Stack", glossary: "Glosario", docs: "Docs" };



  const audienceCopy = mode === "ceo"
    ? { label: "CEO / Investor", summary: "Negocio, monetización, escala y control de riesgo.", tone: "cyan" as const }
    : mode === "operator"
      ? { label: "Operator / Engineer", summary: "Operación, activación, integraciones y trazabilidad.", tone: "green" as const }
      : { label: "Buyer / Client", summary: "Confianza, UX y valor final para el usuario.", tone: "default" as const };

  const items = useMemo(
    () =>
      roleAccess[role]
        .map((key) => ({
          key,
          href: key === "overview" ? "/" : `/${key === "apiKeys" ? "api-keys" : key === "leadsTickets" ? "leads-tickets" : key}`,
          label: nav[key as NavKey],
        }))
        .filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [nav, query, role],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white lg:flex">
      <aside className="w-full border-b border-white/10 bg-slate-950/90 p-4 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-5">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-white">
          <Link href="/" aria-label="nexID home" className="inline-flex items-center"><BrandLockup size={30} variant="ripple" theme="dark" /></Link>
          <div className="mt-3 text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Audience mode</p>
            <p className="mt-1 text-sm font-semibold text-white">{audienceCopy.label}</p>
            <p className="mt-1 text-xs text-slate-400">{audienceCopy.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <button type="button" onClick={() => setMode("ceo")} className={`rounded-full border px-2.5 py-1 ${mode === "ceo" ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/15 text-slate-300"}`}>CEO</button>
              <button type="button" onClick={() => setMode("operator")} className={`rounded-full border px-2.5 py-1 ${mode === "operator" ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-white/15 text-slate-300"}`}>Operator</button>
              <button type="button" onClick={() => setMode("buyer")} className={`rounded-full border px-2.5 py-1 ${mode === "buyer" ? "border-violet-300/40 bg-violet-500/10 text-violet-100" : "border-white/15 text-slate-300"}`}>Buyer</button>
            </div>
          </div>
          <label className="text-xs uppercase tracking-[0.16em] text-slate-400">{shell.role}</label>
          <select className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            {Object.entries(roles).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={shell.search} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
        </div>

        <nav className="mt-6 grid grid-cols-2 gap-1 lg:block lg:space-y-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={`block rounded-xl px-3 py-2 text-sm transition ${pathname === item.href ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-300"><BrandDot size={8} variant="pulse" theme="dark" />{subtitle}</div>
              <div className="mt-2 text-xl font-bold text-white">{title}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={audienceCopy.tone}>{audienceCopy.label}</Badge>
              <Badge tone="green">{shell.apiConnected}</Badge>
              <LocaleSwitcher value={locale} options={[...locales]} />
              <ThemeToggle />
              <Link href="/login" className="rounded-lg border border-white/10 px-3 py-2 text-xs">{shell.logout}</Link>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <a className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-cyan-200" href="/docs#faq" target="_blank" rel="noreferrer">{quick.faq}</a>
            <a className="rounded-full border border-indigo-300/30 bg-indigo-500/10 px-3 py-1.5 text-indigo-200" href="/stack" target="_blank" rel="noreferrer">{quick.stack}</a>
            <a className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-200" href="/glossary" target="_blank" rel="noreferrer">{quick.glossary}</a>
            <a className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-slate-200" href="/docs" target="_blank" rel="noreferrer">{quick.docs}</a>
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
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
