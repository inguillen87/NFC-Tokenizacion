"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

type NavItem = { label: string; href: string };

type MobileNavSheetProps = {
  items: NavItem[];
  loginHref: string;
  loginLabel: string;
};

export function MobileNavSheet({ items, loginHref, loginLabel }: MobileNavSheetProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mobile-nav-toggle inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-2 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08)] md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="mobile-nav-overlay fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)}>
          <div className="mobile-nav-sheet absolute inset-x-3 top-3 rounded-2xl border border-cyan-400/20 bg-slate-950/95 p-4 shadow-[0_20px_60px_rgba(3,7,18,0.65)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold tracking-wide text-white">Menú</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/15 p-1.5 text-slate-300" aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Link
              href={loginHref}
              onClick={() => setOpen(false)}
              className="mb-3 flex items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100"
            >
              {loginLabel}
            </Link>

            <nav className="grid gap-2">
              {items.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100 transition-colors hover:border-cyan-300/30 hover:bg-cyan-500/10">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
