import Link from "next/link";
import { ReactNode } from "react";
import { TapAssociationBanner } from "./tap-association-banner";

export function PortalShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 selection:bg-cyan-500/30 font-sans">
      {/* Mobile-friendly bottom navigation (App-like UX) */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 md:hidden pb-safe">
         <div className="flex items-center justify-around p-2">
            <Link href="/me" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-cyan-400">
               <span className="text-xl">🏠</span>
               <span className="text-[9px] font-medium tracking-wider uppercase">Home</span>
            </Link>
            <Link href="/me/products" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-cyan-400">
               <span className="text-xl">🍷</span>
               <span className="text-[9px] font-medium tracking-wider uppercase">Products</span>
            </Link>
            <Link href="/me/taps" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-cyan-400">
               <span className="text-xl">📡</span>
               <span className="text-[9px] font-medium tracking-wider uppercase">Taps</span>
            </Link>
            <Link href="/me/wallet" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-cyan-400">
               <span className="text-xl">💰</span>
               <span className="text-[9px] font-medium tracking-wider uppercase">Wallet</span>
            </Link>
         </div>
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/me" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="font-bold text-white text-sm">NX</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white hidden sm:block">nexID <span className="font-light text-slate-400">Wallet</span></span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden space-x-1 md:flex">
             <Link href="/me" className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/5">Home</Link>
             <Link href="/me/passport" className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/5">Passport</Link>
             <Link href="/me/products" className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/5">Collection</Link>
             <Link href="/me/taps" className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/5">History</Link>
             <Link href="/me/wallet" className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/5">Wallet</Link>
             <Link href="/me/marketplace" className="px-3 py-1.5 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors rounded-lg hover:bg-cyan-950/30">Network</Link>
          </div>

          <div className="flex items-center gap-3">
             <Link href="/me/privacy" className="h-8 w-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-xs font-bold hover:bg-slate-700 transition shadow-lg shrink-0">US</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12 md:px-8 pb-24 md:pb-12 space-y-8 relative">
        {/* Background glow effects */}
        <div className="pointer-events-none absolute top-0 left-1/4 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute top-1/4 right-0 h-[300px] w-[300px] rounded-full bg-violet-500/10 blur-[100px]" />

        <header className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base text-slate-400 leading-relaxed">{subtitle}</p>
        </header>

        <div className="relative z-10 space-y-8">
           <TapAssociationBanner />
           {children}
        </div>
      </main>
    </div>
  );
}
