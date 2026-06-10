"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Layers, 
  BarChart3, 
  Users, 
  CreditCard, 
  PlayCircle, 
  FlaskConical, 
  Zap
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/": LayoutDashboard,
  "/batches": Layers,
  "/analytics": BarChart3,
  "/resellers": Users,
  "/billing": CreditCard,
  "/demo": PlayCircle,
  "/demo-lab": FlaskConical,
};

export function Sidebar({ items, title }: { title: string; items: Array<{ href: string; label: string; description?: string; badge?: string }> }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-80 shrink-0 border-r border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-5 lg:block">
      {/* Brand Header */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/40 via-cyan-900/10 to-transparent p-4 text-white">
        <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-cyan-400/10 blur-xl" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-500/20 text-cyan-200">
            <Zap className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-wider">{title}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/80 font-bold">Control plane v0.1.0</div>
          </div>
        </div>
      </div>

      {/* Selected Tenant Info (friendly representation for winery owners / non-tech managers) */}
      <div className="mt-4 rounded-xl border border-white/5 bg-slate-950/40 p-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-xl">
            🍇
          </div>
          <div>
            <div className="text-xs font-black text-white">DemoBodega Premium</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Polygon Amoy
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="mt-6 space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = iconMap[item.href] || LayoutDashboard;

          return (
            <Link key={item.href} href={item.href} className="relative block">
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-xs transition duration-200 ${
                  isActive 
                    ? "border-cyan-400/30 bg-cyan-400/5 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                    : "border-transparent text-slate-400 hover:bg-white/[0.02] hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeIndicator"
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-cyan-400"
                  />
                )}
                
                <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${isActive ? "bg-cyan-500/15 text-cyan-300" : "bg-slate-900 text-slate-500"}`}>
                  <IconComponent className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-black tracking-tight ${isActive ? "text-white" : "text-slate-300"}`}>
                      {item.label}
                    </span>
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
                  <p className="mt-1 text-[11px] leading-4 text-slate-500 font-medium group-hover:text-slate-400 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom usage stats widget for business owners */}
      <div className="mt-8 rounded-2xl border border-white/5 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
          <span>Uso de Lotes</span>
          <span className="text-cyan-300">30%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: "30%" }} />
        </div>
        <p className="mt-2 text-[10px] text-slate-500 leading-4 font-medium">
          Has consumido 3 de tus 10 lotes contratados. Contacta a soporte para ampliar tu plan.
        </p>
      </div>

      {/* Live Operations Stream Widget */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-400">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Stream Live</span>
        </div>
        <span className="text-[9px] opacity-70">120 TPM</span>
      </div>
    </aside>
  );
}
