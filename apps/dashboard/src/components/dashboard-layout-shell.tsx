import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Sidebar } from "@product/ui";

const navItems = [
  { href: "/", label: "Overview", description: "KPIs, mission control y contexto rápido para dirección.", badge: "core" },
  { href: "/batches", label: "Batches & Activation", description: "Alta, activación y lifecycle de lotes y tags.", badge: "ops" },
  { href: "/batches/supplier", label: "Factory Trust Room", description: "Supplier packs cifrados, manifest, QA, bóveda y Proof Layer.", badge: "factory" },
  { href: "/analytics", label: "Analytics", description: "Fraude, scans, geo y performance operacional/comercial.", badge: "insight" },
  { href: "/resellers", label: "White-label", description: "Canal, partners y operación reseller / enterprise.", badge: "gtm" },
  { href: "/billing", label: "Plans", description: "Planes, suscripciones y expansión monetizable.", badge: "rev" },
  { href: "/superadmin-network", label: "Superadmin Network", description: "Red global, control de tenants y auditoría de gas.", badge: "admin" },
  { href: "/demo", label: "Demo Control", description: "Entrada simple para contar el producto sin ruido técnico.", badge: "story" },
  { href: "/demo-lab", label: "Demo Lab", description: "Runbooks, pitch, mobile preview y evidencia en vivo.", badge: "live" },
];

export function DashboardLayoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar title="NFC Identity Ops" items={navItems} />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
          <div className="container-shell flex h-20 items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Enterprise control plane</p>
              <h1 className="text-lg font-semibold text-white">Authentication & Product Identity</h1>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone="green">API Connected</Badge>
              <Link href="/demo-lab" className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/20">
                Open Demo Lab
              </Link>
              <form action="/logout" method="post">
                <button type="submit" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:text-white">
                  Logout
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="container-shell flex-1 py-8">{children}</main>
      </div>
    </div>
  );
}
