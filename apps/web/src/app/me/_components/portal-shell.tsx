import Link from "next/link";
import { ReactNode } from "react";
import { Bell, Gift, Home, PackageCheck, Radio, Store, WalletCards } from "lucide-react";
import { BrandLockup, ThemeToggle } from "@product/ui";
import { TapAssociationBanner } from "./tap-association-banner";

export function PortalShell({
  title,
  subtitle,
  notificationCount = 0,
  children,
}: {
  title: string;
  subtitle: string;
  notificationCount?: number;
  children: ReactNode;
}) {
  const unread = Math.max(0, Math.min(99, Math.round(notificationCount)));
  const mobileItems = [
    { href: "/me", label: "Home", icon: Home },
    { href: "/me/products", label: "Products", icon: PackageCheck },
    { href: "/me/taps", label: "Taps", icon: Radio },
    { href: "/me/brands", label: "Brands", icon: Gift, badge: unread },
    { href: "/me/marketplace", label: "Market", icon: Store },
    { href: "/me/wallet", label: "Wallet", icon: WalletCards },
  ];

  return (
    <div className="consumer-portal-root min-h-screen bg-[#0a0a0c] text-slate-200 selection:bg-cyan-500/30 font-sans">
      <div className="consumer-bottom-nav fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-slate-950/90 pb-safe backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-6 gap-1 p-2">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="relative flex flex-col items-center gap-1 rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-cyan-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.badge ? (
                  <span className="absolute right-2 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white ring-2 ring-slate-950">
                    {item.badge}
                  </span>
                ) : null}
                <span className="text-[9px] font-medium uppercase tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <nav className="consumer-portal-nav sticky top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/me" className="flex items-center gap-2">
            <BrandLockup size={44} variant="ripple" theme="dark" className="consumer-portal-brand" />
            <span className="hidden text-sm font-black tracking-tight text-white sm:block">Consumer Passport</span>
          </Link>

          <div className="hidden space-x-1 md:flex">
            <Link href="/me" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white">Home</Link>
            <Link href="/me/passport" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white">Passport</Link>
            <Link href="/me/products" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white">Collection</Link>
            <Link href="/me/brands" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white">Brands</Link>
            <Link href="/me/taps" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white">History</Link>
            <Link href="/me/rewards" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white">Rewards</Link>
            <Link href="/me/marketplace" className="rounded-lg px-3 py-1.5 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-950/30 hover:text-cyan-300">Marketplace</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/me/brands" className="consumer-bell-link relative grid h-9 w-9 place-items-center rounded-full border border-cyan-300/20 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-500/20" aria-label="Network notifications">
              <Bell className="h-4 w-4" aria-hidden="true" />
              {unread ? (
                <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-slate-950">
                  {unread}
                </span>
              ) : (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-slate-950" />
              )}
            </Link>
            <ThemeToggle />
            <Link href="/me/privacy" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold shadow-lg transition hover:bg-slate-700">US</Link>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto max-w-5xl space-y-8 px-4 py-8 pb-24 md:px-8 md:py-12 md:pb-12">
        <header className="consumer-portal-hero relative z-10 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/55 p-5 md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">nexID consumer network</p>
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">{subtitle}</p>
        </header>

        <div className="relative z-10 space-y-8">
          <TapAssociationBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
