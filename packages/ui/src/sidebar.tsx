import Link from "next/link";
import * as React from "react";

export function Sidebar({ items, title }: { title: string; items: Array<{ href: string; label: string }> }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/80 p-5 lg:block">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-white">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-slate-400">Product dashboard shell</div>
      </div>
      <nav className="mt-6 space-y-1">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
