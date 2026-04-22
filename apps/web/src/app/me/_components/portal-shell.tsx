import Link from "next/link";

const nav = [
  ["/me", "Inicio"],
  ["/me/passport", "Passport"],
  ["/me/products", "Productos"],
  ["/me/taps", "Taps"],
  ["/me/rewards", "Rewards"],
  ["/me/wallet", "Wallet"],
  ["/me/brands", "Marcas"],
  ["/me/marketplace", "Marketplace"],
  ["/me/privacy", "Privacidad"],
] as const;

export function PortalShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8 md:px-6">
        <aside className="hidden w-64 shrink-0 rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:block">
          <p className="mb-3 text-xs uppercase tracking-[0.15em] text-cyan-200">nexID Passport</p>
          <nav className="space-y-2">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="block rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:border-cyan-300/50 hover:bg-cyan-500/10">
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="flex-1 space-y-4">
          <header className="rounded-2xl border border-cyan-300/30 bg-gradient-to-r from-cyan-500/15 to-violet-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-cyan-200">Portal premium consumidor</p>
            <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
