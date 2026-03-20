import Link from "next/link";
import * as React from "react";

export function Sidebar({ items, title }: { title: string; items: Array<{ href: string; label: string; description?: string; badge?: string }> }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/80 p-5 lg:block">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-white">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-slate-400">Product dashboard shell</div>
      </div>
      <nav className="mt-6 space-y-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="block rounded-2xl border border-transparent px-3 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{item.label}</span>
              {item.badge ? <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-100">{item.badge}</span> : null}
            </div>
            {item.description ? <p className="mt-1 text-xs text-slate-500">{item.description}</p> : null}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
