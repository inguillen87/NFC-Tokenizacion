import Link from "next/link";
import { ReactNode } from "react";
import { BadgeCheck, Bell, Gift, Home, PackageCheck, Radio, ShoppingBag, Sparkles, Store, WalletCards } from "lucide-react";
import { BrandLockup, ThemeToggle } from "@product/ui";
import { TapAssociationBanner } from "./tap-association-banner";
import { ConsumerLogoutButton } from "./consumer-logout-button";

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
  const navItems = [
    { href: "/me", label: "Home" },
    { href: "/me/passport", label: "Passport" },
    { href: "/me/products", label: "Coleccion" },
    { href: "/me/brands", label: "Marcas" },
    { href: "/me/taps", label: "Historial" },
    { href: "/me/rewards", label: "Beneficios" },
    { href: "/me/wallet", label: "Wallet" },
    { href: "/me/marketplace", label: "Marketplace", featured: true },
  ];
  const heroActions = [
    { href: "/me/marketplace", label: "Comprar", value: "Marketplace", icon: ShoppingBag },
    { href: "/me/products", label: "Ver", value: "Productos", icon: BadgeCheck },
    { href: "/me/rewards", label: "Canjear", value: "Beneficios", icon: Sparkles },
  ];

  return (
    <div className="consumer-portal-root min-h-screen bg-[#070a0f] text-slate-200 selection:bg-cyan-500/30 font-sans">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_10%,rgba(20,184,166,0.18),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(124,58,237,0.18),transparent_30%),linear-gradient(135deg,#07141a_0%,#090b12_45%,#120d1e_100%)]" />
      <div className="consumer-bottom-nav fixed bottom-0 inset-x-0 z-[120] border-t border-white/10 bg-slate-950/90 pb-safe backdrop-blur-xl md:hidden">
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

      <nav className="consumer-portal-nav sticky top-0 md:top-4 z-50 mx-auto w-full border-b border-white/10 bg-slate-950/90 backdrop-blur-xl transition-all md:my-4 md:w-[calc(100%-2rem)] md:max-w-[1480px] md:rounded-2xl md:border md:shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
          <Link href="/me" className="flex items-center gap-2">
            <BrandLockup size={40} variant="ripple" theme="dark" className="consumer-portal-brand" />
            <span className="hidden text-sm font-black tracking-tight text-white sm:block">nexID Passport</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition xl:text-xs ${
                  item.featured
                    ? "border border-cyan-300/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/me/brands" className="consumer-bell-link relative grid h-8 w-8 place-items-center rounded-full border border-cyan-300/20 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-500/20" aria-label="Network notifications">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              {unread ? (
                <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white ring-2 ring-slate-950">
                  {unread}
                </span>
              ) : (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-300 ring-2 ring-slate-950" />
              )}
            </Link>
            <ThemeToggle />
            <Link href="/me/privacy" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-bold shadow-lg transition hover:bg-slate-700">US</Link>
            <ConsumerLogoutButton />
          </div>
        </div>
      </nav>

      <main className="relative mx-auto w-full space-y-6 px-4 py-6 pb-32 md:w-[calc(100%-2rem)] md:max-w-[1480px] md:px-0 md:py-8 md:pb-12">
        <header className="consumer-portal-hero relative z-10 overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/60 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-7 lg:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.44fr)] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">nexID consumer network</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-black leading-[0.96] tracking-tight text-white md:text-5xl lg:text-6xl">{title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">{subtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {heroActions.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-500/10"
                  >
                    <Icon className="h-5 w-5 text-cyan-300 transition group-hover:text-white" aria-hidden="true" />
                    <span className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</span>
                    <strong className="mt-1 block text-sm font-black text-white">{item.value}</strong>
                  </Link>
                );
              })}
            </div>
          </div>
        </header>

        <div className="relative z-10 space-y-6">
          <TapAssociationBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
