"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Badge } from "@product/ui";
import type { UserRole } from "../lib/dashboard-content";
import { roleAccess } from "../lib/dashboard-content";

type NavKey = "overview" | "tenants" | "batches" | "tags" | "analytics" | "events" | "resellers" | "subscriptions" | "apiKeys";

export function DashboardShell({
  title,
  subtitle,
  nav,
  roles,
  shell,
  children,
}: {
  title: string;
  subtitle: string;
  nav: Record<NavKey, string>;
  roles: Record<UserRole, string>;
  shell: { search: string; role: string; logout: string; apiConnected: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole>("super-admin");
  const [query, setQuery] = useState("");

  const items = useMemo(
    () =>
      roleAccess[role]
        .map((key) => ({
          key,
          href: key === "overview" ? "/" : `/${key === "apiKeys" ? "api-keys" : key}`,
          label: nav[key as NavKey],
        }))
        .filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [nav, query, role],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white lg:flex">
      <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/80 p-5 lg:block">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-white">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
        </div>

        <div className="mt-5 space-y-3">
          <label className="text-xs uppercase tracking-[0.16em] text-slate-400">{shell.role}</label>
          <select className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            {Object.entries(roles).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={shell.search} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
        </div>

        <nav className="mt-6 space-y-1">
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
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">{subtitle}</div>
              <div className="mt-1 text-xl font-bold text-white">{title}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="green">{shell.apiConnected}</Badge>
              <Link href="/login" className="rounded-lg border border-white/10 px-3 py-2 text-xs">{shell.logout}</Link>
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
