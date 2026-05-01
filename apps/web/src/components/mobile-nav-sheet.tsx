"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowRight, FileText, LogIn, Menu, MessageCircle, Moon, PlayCircle, X } from "lucide-react";
import { BrandLockup, LocaleSwitcher, ThemeToggle } from "@product/ui";

type NavItem = { label: string; href: string };

type MobileNavSheetProps = {
  items: NavItem[];
  loginHref: string;
  loginLabel: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  locale: string;
  locales: string[];
};

export function MobileNavSheet({
  items,
  loginHref,
  loginLabel,
  primaryCtaHref,
  primaryCtaLabel,
  locale,
  locales,
}: MobileNavSheetProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  const sheet = open ? (
    <div className="mobile-nav-overlay fixed inset-0 z-[999] bg-slate-950/88 backdrop-blur-md lg:hidden" onClick={() => setOpen(false)}>
      <div
        id="mobile-nav-panel"
        className="mobile-nav-sheet fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] bottom-[max(12px,env(safe-area-inset-bottom))] flex flex-col overflow-hidden rounded-2xl border border-cyan-400/25 bg-slate-950 p-4 shadow-[0_24px_80px_rgba(3,7,18,0.78)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/" onClick={() => setOpen(false)} aria-label="nexID home" className="inline-flex items-center">
            <BrandLockup size={54} variant="ripple" theme="dark" className="mobile-menu-brand" />
          </Link>
          <button suppressHydrationWarning type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-200" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-2">
          <Link
            href={primaryCtaHref}
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100"
          >
            <PlayCircle className="h-4 w-4" />
            {primaryCtaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={loginHref}
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-100"
          >
            <LogIn className="h-4 w-4" />
            {loginLabel}
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="mobile-menu-control">
            <LocaleSwitcher value={locale} options={locales} />
          </div>
          <div className="mobile-menu-control">
            <ThemeToggle />
          </div>
        </div>

        <nav className="mt-4 grid flex-1 auto-rows-min content-start gap-2 overflow-y-auto pb-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Navegacion principal</p>
          {items.slice(0, 5).map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100 transition-colors hover:border-cyan-300/30 hover:bg-cyan-500/10">
              {item.label}
            </Link>
          ))}

          <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Recursos y accesos</p>
          {items.slice(5).map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100 transition-colors hover:border-cyan-300/30 hover:bg-cyan-500/10">
              {item.label}
            </Link>
          ))}

          <div className="mt-2 grid gap-2 rounded-xl border border-cyan-300/15 bg-cyan-500/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Acciones rapidas</p>
            <Link href="/docs" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-100">
              <FileText className="h-4 w-4" />
              Docs tecnicos
            </Link>
            <Link href="/?contact=sales#contact-modal" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 text-sm text-emerald-100">
              <MessageCircle className="h-4 w-4" />
              Hablar con ventas
            </Link>
            <div className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300">
              <Moon className="h-4 w-4" />
              Dark / white mode incluido
            </div>
          </div>
        </nav>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        suppressHydrationWarning
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mobile-nav-toggle inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-2 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08)] lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {mounted && sheet ? createPortal(sheet, document.body) : sheet}
    </>
  );
}
