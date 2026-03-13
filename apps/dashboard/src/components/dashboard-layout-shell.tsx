import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Sidebar } from "@product/ui";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/batches", label: "Batches & Activation" },
  { href: "/analytics", label: "Analytics" },
  { href: "/resellers", label: "White-label" },
  { href: "/billing", label: "Plans" },
  { href: "/demo", label: "Demo Control" },
  { href: "/demo-lab", label: "Demo Lab" },
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
              <Link href="/login" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:text-white">
                Logout
              </Link>
            </div>
          </div>
        </header>
        <main className="container-shell flex-1 py-8">{children}</main>
      </div>
    </div>
  );
}
